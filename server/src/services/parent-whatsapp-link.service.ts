import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import prisma from '../config/database';
import { parentAccessService } from './parent-access.service';
import { redisCacheService } from './redis-cache.service';
import { normalizeKenyanPhone } from '../utils/phone.util';
import { ApiError } from '../utils/error.util';
import { isWabaConfigured } from '../domains/communication/whatsapp-business.service';

const LINK_CODE_TTL_SECONDS = 10 * 60;
const LINK_CODE_RATE_TTL_SECONDS = 60 * 60;
const MAX_LINK_CODES_PER_HOUR = 5;
const MAX_LINK_ATTEMPTS = 5;
const isParentAccount = (user: { role: string; roles?: string[] } | null | undefined) =>
  user?.role === 'PARENT' || Boolean(user?.roles?.includes('PARENT'));

interface LinkChallenge {
  userId: string;
  phone: string;
  codeHash: string;
}

const phoneDigest = (phone: string) => createHash('sha256').update(phone).digest('hex');
const challengeKey = (phone: string) => `whatsapp:parent-link:${phoneDigest(phone)}`;
const attemptKey = (phone: string) => `whatsapp:parent-link-attempts:${phoneDigest(phone)}`;
const codeHash = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest();
const isSameCode = (candidate: string, expectedHex: string) => {
  const candidateHash = codeHash(candidate);
  const expected = Buffer.from(expectedHex, 'hex');
  return candidateHash.length === expected.length && timingSafeEqual(candidateHash, expected);
};

const maskPhone = (phone: string) => `+${phone.slice(0, 3)}••••${phone.slice(-3)}`;

export class ParentWhatsAppLinkService {
  async getStatus(userId: string) {
    const [parent, link] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, roles: true, phone: true },
      }),
      prisma.parentWhatsAppLink.findUnique({
        where: { userId },
        select: { phone: true, enabled: true, linkedAt: true },
      }),
    ]);

    if (!isParentAccount(parent)) throw new ApiError(403, 'This WhatsApp assistant is available to parent accounts only');

    let currentPhone: string | null = null;
    try { currentPhone = parent.phone ? normalizeKenyanPhone(parent.phone).digits : null; } catch { /* profile may have no valid phone yet */ }
    const validLink = Boolean(link && currentPhone && link.phone === currentPhone);
    const displayPhone = String(process.env.WABA_DISPLAY_PHONE || '').trim();
    const displayPhoneDigits = displayPhone.replace(/\D/g, '');
    const validDisplayPhone = /^\d{8,15}$/.test(displayPhoneDigits);

    return {
      linked: validLink,
      enabled: validLink && link!.enabled,
      phone: validLink ? maskPhone(link!.phone) : null,
      linkedAt: validLink ? link!.linkedAt : null,
      phoneReady: Boolean(currentPhone),
      whatsappNumber: validDisplayPhone ? `+${displayPhoneDigits}` : null,
      assistantAvailable: isWabaConfigured() && Boolean(process.env.WABA_APP_SECRET && process.env.WABA_VERIFY_TOKEN) && validDisplayPhone,
    };
  }

  async createLinkCode(userId: string) {
    const parent = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, roles: true, status: true, archived: true, phone: true },
    });
    if (!parent || !isParentAccount(parent) || parent.status !== 'ACTIVE' || parent.archived) {
      throw new ApiError(403, 'An active parent account is required to link WhatsApp');
    }
    if (!parent.phone) throw new ApiError(400, 'Add a valid phone number to your profile before linking WhatsApp');

    const phone = normalizeKenyanPhone(parent.phone).digits;
    const learnerIds = await parentAccessService.getAccessibleLearnerIds(userId);
    if (learnerIds.length === 0) throw new ApiError(400, 'No learners are linked to this parent account yet');

    const phoneOwner = await prisma.parentWhatsAppLink.findUnique({ where: { phone }, select: { userId: true } });
    if (phoneOwner && phoneOwner.userId !== parent.id) {
      throw new ApiError(409, 'This WhatsApp number is already linked to another parent account. Contact the school office for help.');
    }

    const issuedCount = await redisCacheService.incrementSecurityCounter(`whatsapp:parent-link-rate:${userId}`, LINK_CODE_RATE_TTL_SECONDS);
    if (issuedCount > MAX_LINK_CODES_PER_HOUR) throw new ApiError(429, 'Please wait before requesting another WhatsApp link code');

    const code = randomBytes(8).toString('hex').toUpperCase();
    const challenge: LinkChallenge = { userId, phone, codeHash: codeHash(code).toString('hex') };
    await redisCacheService.setSecurityValue(challengeKey(phone), challenge, LINK_CODE_TTL_SECONDS);
    await redisCacheService.delete(attemptKey(phone));

    return { code, phone: maskPhone(phone), expiresInSeconds: LINK_CODE_TTL_SECONDS };
  }

  async completeLink(phoneInput: string, suppliedCode: string): Promise<boolean> {
    let phone: string;
    try { phone = normalizeKenyanPhone(phoneInput).digits; } catch { return false; }

    const key = challengeKey(phone);
    const challenge = await redisCacheService.getSecurityValue<LinkChallenge>(key);
    if (!challenge) return false;
    if (challenge.phone !== phone || !/^[A-F0-9]{16}$/.test(suppliedCode.trim().toUpperCase())) return false;

    if (!isSameCode(suppliedCode, challenge.codeHash)) {
      const attempts = await redisCacheService.incrementSecurityCounter(attemptKey(phone), LINK_CODE_TTL_SECONDS);
      if (attempts >= MAX_LINK_ATTEMPTS) {
        await redisCacheService.delete(key);
        await redisCacheService.delete(attemptKey(phone));
      }
      return false;
    }

    // Atomic take makes a valid code single-use across concurrent webhook deliveries.
    const consumed = await redisCacheService.takeSecurityValue<LinkChallenge>(key);
    if (!consumed || consumed.userId !== challenge.userId || consumed.codeHash !== challenge.codeHash) return false;

    const parent = await prisma.user.findUnique({
      where: { id: consumed.userId },
      select: { id: true, role: true, roles: true, status: true, archived: true, phone: true },
    });
    if (!parent || !isParentAccount(parent) || parent.status !== 'ACTIVE' || parent.archived) return false;

    let currentPhone: string;
    try { currentPhone = normalizeKenyanPhone(parent.phone || '').digits; } catch { return false; }
    if (currentPhone !== phone) return false;
    if ((await parentAccessService.getAccessibleLearnerIds(parent.id)).length === 0) return false;

    const phoneOwner = await prisma.parentWhatsAppLink.findUnique({ where: { phone }, select: { userId: true } });
    if (phoneOwner && phoneOwner.userId !== parent.id) return false;

    try {
      await prisma.parentWhatsAppLink.upsert({
        where: { userId: parent.id },
        create: { userId: parent.id, phone, enabled: true, consentAt: new Date() },
        update: { phone, enabled: true, consentAt: new Date() },
      });
      await redisCacheService.delete(attemptKey(phone));
      return true;
    } catch (error: any) {
      if (error?.code === 'P2002') return false;
      throw error;
    }
  }

  async setEnabled(userId: string, enabled: boolean) {
    const currentStatus = await this.getStatus(userId);
    if (!currentStatus.linked) throw new ApiError(404, 'Link your current profile phone number before changing this setting');
    const result = await prisma.parentWhatsAppLink.updateMany({ where: { userId }, data: { enabled } });
    if (result.count === 0) throw new ApiError(404, 'Link your WhatsApp number before changing this setting');
    return this.getStatus(userId);
  }

  async disconnect(userId: string) {
    const parent = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, roles: true, phone: true } });
    if (!isParentAccount(parent)) throw new ApiError(403, 'This action is available to parent accounts only');
    let phone: string | null = null;
    try { phone = parent.phone ? normalizeKenyanPhone(parent.phone).digits : null; } catch { /* no pending code */ }
    if (phone) {
      await redisCacheService.delete(challengeKey(phone));
      await redisCacheService.delete(attemptKey(phone));
    }
    await prisma.parentWhatsAppLink.deleteMany({ where: { userId } });
    return { linked: false, enabled: false };
  }
}

export const parentWhatsAppLinkService = new ParentWhatsAppLinkService();
