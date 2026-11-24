import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import prisma from '../config/database';
import { parentAccessService } from './parent-access.service';
import { redisCacheService } from './redis-cache.service';
import { normalizeKenyanPhone } from '../utils/phone.util';
import { ApiError } from '../utils/error.util';
import { isWhatsAppChannelReady } from '../domains/communication/whatsapp-channel';
import { whatsappService } from './whatsapp.service';

const LINK_CODE_TTL_SECONDS = 10 * 60;
const LINK_CODE_RATE_TTL_SECONDS = 60 * 60;
const MAX_LINK_CODES_PER_HOUR = 5;
const MAX_LINK_ATTEMPTS = 5;

// ── Consent-confirmation path ────────────────────────────────────────────────
// The default parent flow never shows a code. The school messages the number on
// the parent's profile and the parent answers YES. The challenge lives briefly so
// an unanswered message cannot be replayed days later.
const CONFIRM_TTL_SECONDS = 15 * 60;
const CONFIRM_RATE_TTL_SECONDS = 60 * 60;
const MAX_CONFIRM_REQUESTS_PER_HOUR = 5;
const CONFIRM_REPLY_PATTERN = /^(yes|yeah|yep|ndio|sawa|ok(ay)?)$/i;

// Type predicate so callers narrow a possibly-null user to non-null on success.
const isParentAccount = (
  user: { role: string; roles?: string[] } | null | undefined,
): user is { role: string; roles?: string[] } =>
  Boolean(user) && (user!.role === 'PARENT' || Boolean(user!.roles?.includes('PARENT')));

interface LinkChallenge {
  userId: string;
  phone: string;
  codeHash: string;
}

/**
 * A yes-to-confirm challenge. `codeHash` is left null deliberately: possession
 * of the WhatsApp account is the whole proof, so there is no secret to compare.
 * The optional hash is only present when the parent chose the manual fallback,
 * in which case both proofs are accepted for the same phone.
 */
interface ConfirmChallenge {
  userId: string;
  phone: string;
  codeHash: string | null;
  requestedAt: number;
}

const phoneDigest = (phone: string) => createHash('sha256').update(phone).digest('hex');
const challengeKey = (phone: string) => `whatsapp:parent-link:${phoneDigest(phone)}`;
const attemptKey = (phone: string) => `whatsapp:parent-link-attempts:${phoneDigest(phone)}`;
const confirmKey = (phone: string) => `whatsapp:parent-confirm:${phoneDigest(phone)}`;
const confirmRateKey = (userId: string) => `whatsapp:parent-confirm-rate:${userId}`;
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
    // With Baileys the school number is whatever account the admin paired, so read
    // it from the live session instead of a WABA_DISPLAY_PHONE env var.
    const displayPhoneDigits = whatsappService.getLinkedNumber() || '';
    const validDisplayPhone = /^\d{8,15}$/.test(displayPhoneDigits);

    return {
      linked: validLink,
      enabled: validLink && link!.enabled,
      phone: validLink ? maskPhone(link!.phone) : null,
      linkedAt: validLink ? link!.linkedAt : null,
      phoneReady: Boolean(currentPhone),
      // The number the school holds on file, shown in the consent popup so the
      // parent can see exactly which SIM will receive the message.
      profilePhone: currentPhone ? maskPhone(currentPhone) : null,
      whatsappNumber: validDisplayPhone ? `+${displayPhoneDigits}` : null,
      // Available once an admin has paired the school's Baileys session — there is
      // no separate provider credential to check any more.
      assistantAvailable: isWhatsAppChannelReady() && validDisplayPhone,
      // True while a consent prompt is waiting for the parent's YES, so the UI
      // can resume showing "check your WhatsApp" after a page reload.
      awaitingConfirmation: !validLink && currentPhone
        ? Boolean(await redisCacheService.getSecurityValue<ConfirmChallenge>(confirmKey(currentPhone)))
        : false,
    };
  }

  async createLinkCode(userId: string) {
    const parent = await this.loadLinkableParent(userId);
    const phone = normalizeKenyanPhone(parent.phone!).digits;
    await this.assertLinkable(phone, parent.id);
    await this.assertRateLimit(`whatsapp:parent-link-rate:${userId}`);

    const code = randomBytes(8).toString('hex').toUpperCase();
    const challenge: LinkChallenge = { userId, phone, codeHash: codeHash(code).toString('hex') };
    await redisCacheService.setSecurityValue(challengeKey(phone), challenge, LINK_CODE_TTL_SECONDS);
    await redisCacheService.delete(attemptKey(phone));

    return { code, phone: maskPhone(phone), expiresInSeconds: LINK_CODE_TTL_SECONDS };
  }

  /**
   * The one-tap path. Sends the consent prompt to the number already on the
   * parent's profile instead of asking the parent to copy a code anywhere.
   *
   * Returns the masked number so the popup can say "check +254••••123" without
   * the caller having to re-read the profile.
   */
  async requestConfirmation(userId: string) {
    const parent = await this.loadLinkableParent(userId);
    const phone = normalizeKenyanPhone(parent.phone!).digits;
    await this.assertLinkable(phone, parent.id);
    await this.assertRateLimit(confirmRateKey(userId), MAX_CONFIRM_REQUESTS_PER_HOUR);

    const challenge: ConfirmChallenge = {
      userId,
      phone,
      codeHash: null,
      requestedAt: Date.now(),
    };
    await redisCacheService.setSecurityValue(confirmKey(phone), challenge, CONFIRM_TTL_SECONDS);
    await redisCacheService.delete(attemptKey(phone));

    const sent = await this.sendConsentPrompt(phone);
    if (!sent) {
      // Never leave a live challenge behind for a message we could not deliver —
      // the parent would be waiting for something that never arrives.
      await redisCacheService.delete(confirmKey(phone));
      throw new ApiError(503, 'We could not send the WhatsApp message right now. Please try again in a moment.');
    }

    return {
      phone: maskPhone(phone),
      expiresInSeconds: CONFIRM_TTL_SECONDS,
      awaitingReply: true,
    };
  }

  /**
   * Called from the inbound message pipeline. Returns true only when this
   * message was a link confirmation — so the caller knows whether to stop
   * before intent classification.
   */
  async confirmFromInbound(phoneInput: string, text: string): Promise<boolean> {
    if (!CONFIRM_REPLY_PATTERN.test(text.trim())) return false;

    let phone: string;
    try { phone = normalizeKenyanPhone(phoneInput).digits; } catch { return false; }

    const key = confirmKey(phone);
    const pending = await redisCacheService.getSecurityValue<ConfirmChallenge>(key);
    // A bare YES with no pending challenge belongs to the conversation, not to
    // linking, so leave it for the intent router.
    if (!pending || pending.phone !== phone) return false;

    const consumed = await redisCacheService.takeSecurityValue<ConfirmChallenge>(key);
    if (!consumed || consumed.userId !== pending.userId) return false;

    return this.applyLink(consumed.userId, phone);
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

    // Atomic take makes a valid code single-use across concurrent deliveries.
    const consumed = await redisCacheService.takeSecurityValue<LinkChallenge>(key);
    if (!consumed || consumed.userId !== challenge.userId || consumed.codeHash !== challenge.codeHash) return false;

    return this.applyLink(consumed.userId, phone);
  }

  /**
   * Shared final gate for both linking paths. Re-reads the parent from the
   * database because the challenge may have been issued minutes ago — the
   * account could have been deactivated or the phone changed since.
   */
  private async applyLink(userId: string, phone: string): Promise<boolean> {
    const parent = await prisma.user.findUnique({
      where: { id: userId },
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
      await redisCacheService.delete(confirmKey(phone));
      await redisCacheService.delete(challengeKey(phone));
      return true;
    } catch (error: any) {
      if (error?.code === 'P2002') return false;
      throw error;
    }
  }

  private async loadLinkableParent(userId: string) {
    const parent = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, roles: true, status: true, archived: true, phone: true },
    });
    if (!parent || !isParentAccount(parent) || parent.status !== 'ACTIVE' || parent.archived) {
      throw new ApiError(403, 'An active parent account is required to link WhatsApp');
    }
    if (!parent.phone) throw new ApiError(400, 'Add a valid phone number to your profile before linking WhatsApp');
    if (!isWhatsAppChannelReady() || !whatsappService.getLinkedNumber()) {
      throw new ApiError(503, 'The school WhatsApp account is offline. Ask an administrator to reconnect it, then try again.');
    }
    return parent;
  }

  private async assertLinkable(phone: string, parentId: string) {
    const learnerIds = await parentAccessService.getAccessibleLearnerIds(parentId);
    if (learnerIds.length === 0) throw new ApiError(400, 'No learners are linked to this parent account yet');

    const phoneOwner = await prisma.parentWhatsAppLink.findUnique({ where: { phone }, select: { userId: true } });
    if (phoneOwner && phoneOwner.userId !== parentId) {
      throw new ApiError(409, 'This WhatsApp number is already linked to another parent account. Contact the school office for help.');
    }
  }

  private async assertRateLimit(key: string, max = MAX_LINK_CODES_PER_HOUR) {
    const issuedCount = await redisCacheService.incrementSecurityCounter(key, LINK_CODE_RATE_TTL_SECONDS);
    if (issuedCount > max) throw new ApiError(429, 'Please wait before requesting another WhatsApp link message');
  }

  private async sendConsentPrompt(phone: string): Promise<boolean> {
    const body = [
      'Hello from your school office.',
      '',
      `You are turning on the parent WhatsApp assistant for ${maskPhone(phone)}.`,
      '',
      'Reply YES to confirm.',
      'If you did not ask for this, ignore this message — nothing will be turned on.',
    ].join('\n');

    try {
      const result = await whatsappService.sendMessage({ to: phone, message: body });
      return Boolean(result.success);
    } catch {
      return false;
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
      await redisCacheService.delete(confirmKey(phone));
    }
    await prisma.parentWhatsAppLink.deleteMany({ where: { userId } });
    return { linked: false, enabled: false };
  }
}

export const parentWhatsAppLinkService = new ParentWhatsAppLinkService();
