import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { UserStatus } from '@prisma/client';
import { PRODUCT_EMAIL_DOMAIN, PRODUCT_PARENT_PORTAL_URL } from '../config/productIdentity';

export const normalizeParentPhoneForLogin = (phone?: string | null): string | null => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || null;
};

export const normalizeParentPhoneForFamily = (phone?: string | null): string | null => {
  const digits = normalizeParentPhoneForLogin(phone);
  if (!digits) return null;

  if (digits.length === 10 && digits.startsWith('0')) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9 && /^[17]/.test(digits)) {
    return `254${digits}`;
  }

  return digits;
};

export const getParentPhoneLookupCandidates = (phone?: string | null): string[] => {
  const rawDigits = normalizeParentPhoneForLogin(phone);
  const canonical = normalizeParentPhoneForFamily(phone);
  const candidates = new Set<string>();

  if (rawDigits) candidates.add(rawDigits);
  if (canonical) {
    candidates.add(canonical);
    if (canonical.startsWith('254') && canonical.length === 12) {
      candidates.add(`0${canonical.slice(3)}`);
    }
  }

  const raw = String(phone || '').trim();
  if (raw) candidates.add(raw);

  return Array.from(candidates).filter(Boolean);
};

export const buildParentLoginEmail = (phone?: string | null): string | null => {
  const normalizedPhone = normalizeParentPhoneForLogin(phone);
  return normalizedPhone ? `${normalizedPhone}@${PRODUCT_EMAIL_DOMAIN}` : null;
};

export const getParentLoginEmailCandidates = (phone?: string | null): string[] => {
  return getParentPhoneLookupCandidates(phone)
    .map((candidate) => buildParentLoginEmail(candidate))
    .filter((email): email is string => Boolean(email));
};

export interface CreateOrGetParentArgs {
  phone?: string;
  name?: string;
  email?: string;
  status?: UserStatus;
  skipNotifications?: boolean;
}

export class ParentService {
  /**
   * Generates a secure random 8-character password.
   * Format: 3 uppercase + 3 digits + 2 lowercase.
   */
  public generateTemporaryPassword(): string {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const rand   = (charset: string) => charset[randomBytes(1)[0] % charset.length];
    return [rand(upper), rand(upper), rand(upper), rand(digits), rand(digits), rand(digits), rand(lower), rand(lower)].join('');
  }

  /**
   * Safe helper to find an existing parent by phone, or completely onboard
   * a brand new parent securely with generated passwords and credentials.
   */
  public async getOrCreateParent(args: CreateOrGetParentArgs) {
    const normalizedPhone = normalizeParentPhoneForFamily(args.phone);
    const finalEmail = buildParentLoginEmail(normalizedPhone || args.phone);
    if (!args.phone || !finalEmail) return null;
    const phoneCandidates = getParentPhoneLookupCandidates(args.phone);
    const emailCandidates = Array.from(new Set([finalEmail, ...getParentLoginEmailCandidates(args.phone)]));

    const existingParent = await prisma.user.findFirst({
      where: {
        role: 'PARENT',
        OR: [
          { phone: { in: phoneCandidates } },
          { email: { in: emailCandidates } },
          { username: { in: emailCandidates } }
        ]
      }
    });
    if (existingParent) {
      await this.ensureFamilyMembership(existingParent, {
        name: args.name,
        phone: args.phone,
        normalizedPhone
      });
      return existingParent;
    }

    const existingParentByLogin = await prisma.user.findUnique({
      where: { email: finalEmail }
    });
    if (existingParentByLogin) {
      if (existingParentByLogin.role === 'PARENT') return existingParentByLogin;
      throw new Error(`Login email ${finalEmail} is already assigned to a non-parent user`);
    }

    // Prepare default values
    const phone = args.phone || null;
    const pName = args.name || 'Parent';
    const nameParts = pName.split(' ');
    const firstName = nameParts[0] || 'Parent';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Guardian';

    // Force secure temporary credentials
    const parentPassword = this.generateTemporaryPassword();
    const forceResetToken = randomBytes(32).toString('hex');
    const forceResetExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const parent = await prisma.user.create({
      data: {
        username: finalEmail,
        email: finalEmail,
        firstName,
        lastName,
        phone: normalizedPhone || phone,
        password: await bcrypt.hash(parentPassword, 11),
        role: 'PARENT',
        status: args.status || 'ACTIVE',
        passwordResetToken: forceResetToken,
        passwordResetExpiry: forceResetExpiry,
      }
    });

    await this.ensureFamilyMembership(parent, {
      name: pName,
      phone: normalizedPhone || phone,
      normalizedPhone
    });

    const skipNotifications = args.skipNotifications || process.env.SKIP_PARENT_PORTAL_NOTIFICATIONS === 'true' || process.env.NODE_ENV === 'test';

    // Ship welcome notifications
    if (!skipNotifications) {
      const portalUrl = PRODUCT_PARENT_PORTAL_URL;
      const credentialsMessage = `Hello ${firstName}, your Parent Portal account is ready. Login at ${portalUrl} with email: ${finalEmail} and temporary password: ${parentPassword}. You will be prompted to set a new password on first login.`;

      if (phone) {
        try {
          await SmsService.sendSms(phone, credentialsMessage);
        } catch (smsError: any) {
          console.warn('[ParentService] Parent portal SMS setup failed:', smsError?.message || smsError);
        }
      }

      if (finalEmail.includes('@') && !finalEmail.endsWith(`@${PRODUCT_EMAIL_DOMAIN}`)) {
        try {
          await EmailService.sendNotificationEmail({
            to: finalEmail,
            subject: 'Your Parent Portal Login Credentials',
            text: credentialsMessage,
            html: `<p>${credentialsMessage}</p>`
          });
        } catch (emailError: any) {
          console.warn('[ParentService] Parent portal email setup failed:', emailError?.message || emailError);
        }
      }
    }

    return parent;
  }

  public async linkLearnerToParentFamily(args: {
    parentId: string;
    learnerId: string;
    relationship?: string | null;
    isPrimary?: boolean;
  }): Promise<void> {
    const member = await prisma.familyMember.findUnique({
      where: { userId: args.parentId },
      select: { familyAccountId: true }
    });

    if (!member?.familyAccountId) return;

    await prisma.learnerFamilyLink.upsert({
      where: {
        familyAccountId_learnerId: {
          familyAccountId: member.familyAccountId,
          learnerId: args.learnerId
        }
      },
      update: {
        relationship: args.relationship || undefined,
        isPrimary: args.isPrimary ?? true
      },
      create: {
        familyAccountId: member.familyAccountId,
        learnerId: args.learnerId,
        relationship: args.relationship || undefined,
        isPrimary: args.isPrimary ?? true
      }
    });
  }

  private async ensureFamilyMembership(parent: any, args: {
    name?: string | null;
    phone?: string | null;
    normalizedPhone?: string | null;
  }): Promise<void> {
    const normalizedPhone = args.normalizedPhone || normalizeParentPhoneForFamily(args.phone || parent.phone);
    if (!normalizedPhone) return;

    const existingByUser = await prisma.familyMember.findUnique({
      where: { userId: parent.id }
    });
    if (existingByUser) return;

    const existingByPhone = await prisma.familyMember.findFirst({
      where: { normalizedPhone },
      include: { familyAccount: true }
    });

    const familyAccount = existingByPhone?.familyAccount || await prisma.familyAccount.create({
      data: {
        displayName: `${args.name || `${parent.firstName} ${parent.lastName}` || 'Family'} Family`,
        primaryPhone: normalizedPhone
      }
    });

    await prisma.familyMember.create({
      data: {
        familyAccountId: familyAccount.id,
        userId: parent.id,
        name: args.name || `${parent.firstName} ${parent.lastName}`.trim() || 'Parent',
        phone: args.phone || parent.phone || normalizedPhone,
        normalizedPhone,
        relationship: 'Guardian',
        role: existingByPhone ? 'GUARDIAN' : 'PRIMARY_GUARDIAN',
        status: 'ACTIVE',
        isPrimary: !existingByPhone,
        verifiedAt: parent.emailVerified ? new Date() : null
      }
    });
  }
}

export const parentService = new ParentService();
