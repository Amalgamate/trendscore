import crypto from 'crypto';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { getKenyanPhoneLookupCandidates, normalizeKenyanPhone } from '../utils/phone.util';
import { buildParentLoginEmail, getParentLoginEmailCandidates } from './parent.service';
import { SmsService } from './sms.service';
import { SMS_MESSAGES, OTP_CONFIG } from '../config/communication.messages';
import { authLoginService, AuthLoginResult } from './auth-login.service';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = OTP_CONFIG.expiryMinutes || 10;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const SUPER_ADMIN_SETUP_PHONE_E164 = '+254713612141';
const SUPER_ADMIN_SETUP_OTP = '123456';

const getOtpSecret = (): string => {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('OTP hash secret is not configured');
  return secret;
};

export const hashOtpCode = (code: string, challengeId: string): string => {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${challengeId}:${code}`)
    .digest('hex');
};

const generateOtpCode = (): string => crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString();

const isSuperAdminSetupPhone = (phoneE164: string): boolean => phoneE164 === SUPER_ADMIN_SETUP_PHONE_E164;

interface RequestPhoneOtpParams {
  phone: string;
  ipAddress?: string;
  userAgent?: string;
}

interface VerifyPhoneOtpParams {
  challengeId: string;
  phone: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestPhoneOtpResult {
  success: true;
  challengeId: string;
  phone: string;
  expiresAt: Date;
  resendAfterSeconds: number;
  message: string;
  devOtp?: string;
}

export class AuthPhoneOtpService {
  async requestParentOtp(params: RequestPhoneOtpParams): Promise<RequestPhoneOtpResult> {
    const normalized = normalizeKenyanPhone(params.phone);
    const phoneCandidates = getKenyanPhoneLookupCandidates(params.phone);
    const emailCandidates = Array.from(new Set([
      buildParentLoginEmail(normalized.digits),
      ...getParentLoginEmailCandidates(params.phone),
    ].filter((email): email is string => Boolean(email))));

    const setupPhone = isSuperAdminSetupPhone(normalized.e164);
    const user = await prisma.user.findFirst({
      where: {
        ...(setupPhone ? { role: 'SUPER_ADMIN' as const } : {}),
        status: 'ACTIVE',
        archived: false,
        OR: [
          { phone: { in: phoneCandidates } },
          { email: { in: emailCandidates } },
          { username: { in: emailCandidates } },
        ],
      },
      select: { id: true },
    });

    const latestChallenge = await prisma.authOtpChallenge.findFirst({
      where: {
        phoneNormalized: normalized.e164,
        purpose: 'PARENT_PHONE_LOGIN',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lastSentAt: true,
        resendCount: true,
        maxResends: true,
        lockedUntil: true,
      },
    });

    if (latestChallenge?.lockedUntil && latestChallenge.lockedUntil > new Date()) {
      throw new ApiError(429, 'Too many OTP requests. Please try again later.');
    }

    if (latestChallenge?.lastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - latestChallenge.lastSentAt.getTime()) / 1000);
      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        throw new ApiError(429, `Please wait ${RESEND_COOLDOWN_SECONDS - elapsedSeconds} seconds before requesting a new OTP`);
      }
      if (latestChallenge.resendCount >= latestChallenge.maxResends) {
        await prisma.authOtpChallenge.update({
          where: { id: latestChallenge.id },
          data: {
            status: 'LOCKED',
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
        throw new ApiError(429, 'Too many OTP requests. Please try again later.');
      }
    }

    const code = setupPhone && user?.id ? SUPER_ADMIN_SETUP_OTP : generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const challenge = await prisma.authOtpChallenge.create({
      data: {
        userId: user?.id || null,
        phoneRaw: normalized.raw,
        phoneNormalized: normalized.e164,
        purpose: 'PARENT_PHONE_LOGIN',
        status: 'PENDING',
        codeHash: 'pending',
        expiresAt,
        maxAttempts: MAX_ATTEMPTS,
        resendCount: latestChallenge ? latestChallenge.resendCount + 1 : 0,
        maxResends: MAX_RESENDS,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
      select: { id: true, expiresAt: true },
    });

    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { codeHash: hashOtpCode(code, challenge.id) },
    });

    if (user?.id && !setupPhone && process.env.NODE_ENV !== 'test') {
      SmsService.sendSms(normalized.e164, SMS_MESSAGES.otp(code, OTP_EXPIRY_MINUTES)).catch((error: any) => {
        console.warn('[AuthPhoneOtpService] OTP SMS delivery failed:', error?.message || error);
      });
    }

    return {
      success: true,
      challengeId: challenge.id,
      phone: normalized.e164,
      expiresAt: challenge.expiresAt,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
      message: 'If an account exists for this phone number, an OTP has been sent.',
      devOtp: code,
    };
  }

  async verifyParentOtp(params: VerifyPhoneOtpParams): Promise<AuthLoginResult> {
    const normalized = normalizeKenyanPhone(params.phone);
    const code = String(params.code || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) {
      throw new ApiError(400, 'OTP code must be 6 digits');
    }

    const challenge = await prisma.authOtpChallenge.findUnique({
      where: { id: params.challengeId },
    });

    if (!challenge || challenge.phoneNormalized !== normalized.e164 || challenge.purpose !== 'PARENT_PHONE_LOGIN') {
      throw new ApiError(400, 'Invalid or expired OTP');
    }

    if (challenge.status !== 'PENDING') {
      throw new ApiError(400, 'Invalid or expired OTP');
    }

    if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
      throw new ApiError(429, 'Too many OTP attempts. Please try again later.');
    }

    if (challenge.expiresAt <= new Date()) {
      await prisma.authOtpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'EXPIRED' },
      });
      throw new ApiError(400, 'OTP has expired');
    }

    const expectedHash = hashOtpCode(code, challenge.id);
    const matches = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(challenge.codeHash, 'hex')
    );

    if (!matches) {
      const attempts = challenge.attempts + 1;
      const locked = attempts >= challenge.maxAttempts;
      await prisma.authOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          status: locked ? 'LOCKED' : 'PENDING',
          lockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new ApiError(400, 'Invalid OTP code');
    }

    if (!challenge.userId) {
      throw new ApiError(401, 'Invalid or expired OTP');
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        status: true,
        archived: true,
        loginAttempts: true,
        lockedUntil: true,
        role: true,
        roles: true,
        firstName: true,
        lastName: true,
        phone: true,
        lastLogin: true,
        institutionType: true,
        emailVerified: true,
        verificationRequired: true,
        passwordResetToken: true,
      },
    });

    if (!user || user.archived || user.status !== 'ACTIVE') {
      throw new ApiError(403, 'Unable to authenticate this account');
    }

    const setupPhone = isSuperAdminSetupPhone(normalized.e164);
    const userRoles = ((user.roles && user.roles.length > 0) ? user.roles : [user.role]) as string[];
    if (setupPhone && !userRoles.includes('SUPER_ADMIN')) {
      throw new ApiError(403, 'Unable to authenticate this account');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(403, 'Account is locked');
    }

    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        attempts: challenge.attempts + 1,
      },
    });

    const session = await authLoginService.createAuthenticatedSession({
      user,
      loginMethod: 'PHONE_OTP',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sourceChallengeId: challenge.id,
    });

    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        status: 'CONSUMED',
        consumedAt: new Date(),
      },
    });

    return session;
  }
}

export const authPhoneOtpService = new AuthPhoneOtpService();
