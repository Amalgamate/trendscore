import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { redisCacheService } from './redis-cache.service';
import { authTokenService } from './auth-token.service';
import { buildParentLoginEmail, getParentLoginEmailCandidates } from './parent.service';
import { getKenyanPhoneLookupCandidates, normalizeKenyanPhone } from '../utils/phone.util';
import { selectPreferredPhoneLoginUser } from '../utils/phoneLoginUserSelector';

interface LoginParams {
  email?: string;
  phone?: string;
  password?: string;
  requestSchool?: {
    id?: string;
    institutionType?: string;
  } | null;
}

type LoginMethod = 'PASSWORD' | 'PHONE_OTP';

const MAX_PASSWORD_LOGIN_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_MINUTES = 15;

interface SessionParams {
  user: Record<string, any>;
  requestSchool?: LoginParams['requestSchool'];
  loginMethod?: LoginMethod;
  ipAddress?: string;
  userAgent?: string;
  sourceChallengeId?: string;
}

export interface AuthLoginResult {
  success: true;
  user: Record<string, any>;
  token: string;
  refreshToken: string;
  requiresOtp: boolean;
  mustChangePassword: boolean;
  message: string;
}

const xssPatterns = [/<script/gi, /javascript:/gi, /on\w+\s*=/gi, /<iframe/gi];

export class AuthLoginService {
  async loginWithPassword(params: LoginParams): Promise<AuthLoginResult> {
    const { email, phone, password, requestSchool } = params;

    if ((!email && !phone) || !password) throw new ApiError(400, 'Phone number and password are required');

    if (xssPatterns.some(pattern => pattern.test(password))) {
      throw new ApiError(400, 'Invalid password format');
    }

    const identifier = String(email || phone || '').trim();
    const cacheKey = `auth:v2:user:${identifier}`;
    let user = await redisCacheService.get<any>(cacheKey);

    if (!user) {
      const trimmedEmail = email ? String(email).trim().toLowerCase() : '';
      const phoneCandidates = phone ? getKenyanPhoneLookupCandidates(phone) : [];
      const emailCandidates = phone
        ? Array.from(new Set([
          buildParentLoginEmail(normalizeKenyanPhone(phone).digits),
          ...getParentLoginEmailCandidates(phone),
        ].filter((candidate): candidate is string => Boolean(candidate))))
        : [];

      if (trimmedEmail) {
        user = await prisma.user.findUnique({
          where: { email: trimmedEmail },
          select: {
            id: true, password: true, status: true, loginAttempts: true, lockedUntil: true,
            role: true, roles: true, email: true, firstName: true, lastName: true,
            phone: true, lastLogin: true, institutionType: true, emailVerified: true,
            verificationRequired: true,
            passwordResetToken: true,
          },
        });
      }
      if (!user && phone) {
        const matchingUsers = await prisma.user.findMany({
          where: {
            archived: false,
            OR: [
              { phone: { in: phoneCandidates } },
              { email: { in: emailCandidates } },
              { username: { in: emailCandidates } },
            ],
          },
          select: {
            id: true, password: true, status: true, loginAttempts: true, lockedUntil: true,
            role: true, roles: true, email: true, firstName: true, lastName: true,
            phone: true, lastLogin: true, institutionType: true, emailVerified: true,
            verificationRequired: true,
            passwordResetToken: true,
          },
          take: 10,
        });
        user = selectPreferredPhoneLoginUser(matchingUsers);
      }
      if (user) await redisCacheService.set(cacheKey, user, 5 * 60);
    }

    if (!user) throw new ApiError(401, 'Invalid credentials');

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new ApiError(403, 'Account is locked');
    }

    if (user.lockedUntil && user.lockedUntil <= now) {
      await redisCacheService.delete(cacheKey);
      await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });
      user.loginAttempts = 0;
      user.lockedUntil = null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const nextAttempts = (user.loginAttempts || 0) + 1;
      const shouldLock = nextAttempts >= MAX_PASSWORD_LOGIN_ATTEMPTS;
      await redisCacheService.delete(cacheKey);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: nextAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + PASSWORD_LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      });
      throw new ApiError(401, 'Invalid credentials');
    }

    if (user.status !== 'ACTIVE') throw new ApiError(403, 'Account is not active');

    const userRolesForVerify = ((user.roles && user.roles.length > 0) ? user.roles : [user.role]) as string[];
    const isSuperAdmin = userRolesForVerify.includes('SUPER_ADMIN');
    const schoolConfig = await prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, institutionType: true, institutionTypeLocked: true, requiresUserVerification: true },
    });
    const schoolRequiresVerification = schoolConfig?.requiresUserVerification !== false;
    const userRequiresVerification = user.verificationRequired !== false;

    if (
      !user.emailVerified &&
      !isSuperAdmin &&
      schoolRequiresVerification &&
      userRequiresVerification &&
      userRolesForVerify.some((r) => r === 'ADMIN')
    ) {
      throw new ApiError(
        403,
        'Please verify your account before signing in. Complete phone verification or use the link in your welcome email.'
      );
    }

    await redisCacheService.delete(cacheKey);
    return this.createAuthenticatedSession({
      user,
      requestSchool,
      loginMethod: 'PASSWORD',
    });
  }

  async createAuthenticatedSession(params: SessionParams): Promise<AuthLoginResult> {
    const { user, requestSchool, loginMethod = 'PASSWORD' } = params;

    const { password: _, passwordResetToken: __, ...userWithoutSensitive } = user;
    const schoolId = (user as any).schoolId || requestSchool?.id;
    const schoolWhere = schoolId ? { id: schoolId, archived: false } : { archived: false };
    const schoolOrder = schoolId ? undefined : [{ active: 'desc' as const }, { updatedAt: 'desc' as const }, { createdAt: 'desc' as const }];
    const schoolConfig = await prisma.school.findFirst({
      where: schoolWhere,
      ...(schoolOrder ? { orderBy: schoolOrder } : {}),
      select: { id: true, active: true, institutionType: true, institutionTypeLocked: true, requiresUserVerification: true },
    });
    if (!schoolConfig || schoolConfig.active === false) {
      throw new ApiError(403, 'School access is not active');
    }

    const mustChangePassword = !!user.passwordResetToken;
    const { accessToken, refreshToken } = authTokenService.issueTokenPair(user as any);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), loginAttempts: 0, lockedUntil: null },
    });

    if (loginMethod === 'PHONE_OTP') {
      await prisma.auditLog.create({
        data: {
          action: user.role === 'PARENT' ? 'PARENT_LOGIN_VIA_OTP' : 'LOGIN_VIA_OTP',
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          ipAddress: params.ipAddress || null,
          method: 'PHONE_OTP',
          path: '/api/auth/phone-otp/verify',
          params: JSON.stringify({
            schoolId: schoolConfig.id,
            device: params.userAgent || null,
            loginMethod: 'PHONE_OTP',
            challengeId: params.sourceChallengeId || null,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    }

    const resolvedSchoolId: string | undefined = schoolId || schoolConfig?.id;
    const userRoles = ((user.roles && user.roles.length > 0) ? user.roles : [user.role]) as string[];
    const requiresInstitutionSetup = userRoles.includes('SUPER_ADMIN') && !(schoolConfig?.institutionTypeLocked === true);
    const communicationConfig = await prisma.communicationConfig.findFirst({
      select: { emailTemplates: true },
    });
    const otpEnabled = (communicationConfig?.emailTemplates as any)?.__security?.otpEnabled !== false;
    const requiresOtp = otpEnabled && !userRoles.some(r => ['SUPER_ADMIN', 'STUDENT'].includes(r));

    return {
      success: true,
      user: {
        ...userWithoutSensitive,
        schoolId: resolvedSchoolId || null,
        roles: userRoles,
        institutionType: user.institutionType || schoolConfig?.institutionType || requestSchool?.institutionType || 'PRIMARY_CBC',
        institutionTypeLocked: schoolConfig?.institutionTypeLocked === true,
        requiresInstitutionSetup,
        availableInstitutionTypes: ['PRIMARY_CBC', 'SECONDARY', 'TERTIARY'],
      },
      token: accessToken,
      refreshToken,
      requiresOtp,
      mustChangePassword,
      message: mustChangePassword ? 'Login successful — please set a new password' : 'Login successful',
    };
  }
}

export const authLoginService = new AuthLoginService();
