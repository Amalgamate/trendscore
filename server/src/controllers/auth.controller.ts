import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type {} from '@prisma/client';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { ApiError } from '../utils/error.util';
import { Role, canManageRole } from '../config/permissions';
import { AuthRequest } from '../middleware/permissions.middleware';
import { validatePassword, DEFAULT_PASSWORD_POLICY, PARENT_PASSWORD_POLICY } from '../utils/password.util';
import { EmailService } from '../services/email-resend.service';
import { whatsappService } from '../services/whatsapp.service';
import { redisCacheService } from '../services/redis-cache.service';

import logger from '../utils/logger';
/**
 * Redis key for a revoked refresh token.
 * TTL is set to the remaining lifetime of the token (7d), so Redis auto-cleans.
 */
const revokedTokenKey = (token: string) => `revoked_rt:${token}`;

const revokeRefreshToken = async (token: string): Promise<void> => {
  const ttl = 7 * 24 * 60 * 60;
  await redisCacheService.set(revokedTokenKey(token), '1', ttl);
};

const isRefreshTokenRevoked = async (token: string): Promise<boolean> => {
  const val = await redisCacheService.get<string>(revokedTokenKey(token));
  return val !== null;
};

const MAX_LOGIN_ATTEMPTS = 999; // lockout disabled
const ACCOUNT_LOCK_MINUTES = 0; // lockout disabled

export class AuthController {
  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const secureCookies = (process.env.SECURE_COOKIES || '').toLowerCase() === 'true';
    const useSecureCookies = isProd ? secureCookies : false;
    const commonOptions: any = {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: useSecureCookies ? 'none' : 'lax',
      path: '/'
    };

    res.cookie('accessToken', accessToken, {
      ...commonOptions,
      maxAge: 60 * 60 * 1000 // 60 mins (align with 1h JWT expiration)
    });

    res.cookie('refreshToken', refreshToken, {
      ...commonOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (matching JWT_REFRESH_EXPIRES_IN default)
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }

  async register(req: AuthRequest, res: Response) {
    const { email, password, firstName, lastName, role, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new ApiError(400, 'Missing required fields');
    }

    const isAuthenticatedCreation = !!req.user;
    const requestedRole = (role || 'TEACHER') as Role;

    if (isAuthenticatedCreation) {
      const currentUserRole = req.user!.role;
      if (!canManageRole(currentUserRole, requestedRole)) {
        throw new ApiError(403, `You cannot create users with role: ${requestedRole}`);
      }
      if (['SUPER_ADMIN', 'ADMIN'].includes(requestedRole) && currentUserRole !== 'SUPER_ADMIN') {
        throw new ApiError(403, 'Only SUPER_ADMIN can create admin users');
      }
    } else {
      if (role && role !== 'PARENT') {
        throw new ApiError(403, 'Public registration is only allowed for parent accounts');
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ApiError(400, 'User already exists');

    const passwordPolicy = requestedRole === 'PARENT' ? PARENT_PASSWORD_POLICY : DEFAULT_PASSWORD_POLICY;
    const passwordValidation = validatePassword(password, passwordPolicy);
    if (!passwordValidation.valid) throw new ApiError(400, passwordValidation.errors.join(', '));

    const hashedPassword = await bcrypt.hash(password, 11);

    const user = await prisma.user.create({
      data: {
        email, password: hashedPassword, firstName, lastName,
        role: requestedRole, roles: [requestedRole], phone: phone || null, status: 'ACTIVE'
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, 
        role: true, roles: true, phone: true, createdAt: true, institutionType: true
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    EmailService.sendWelcomeEmail({
      to: email,
      schoolName: 'Trends CORE V1.0',
      adminName: `${firstName} ${lastName}`,
      loginUrl: `${frontendUrl}/login`
    }).catch(err => logger.error('Failed to send welcome email:', err));

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    this.setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true, 
      user, 
      token: '__cookie__', // placeholder for frontend state compatibility
      refreshToken: '__cookie__', // placeholder for frontend state compatibility
      message: 'User registered successfully'
    });
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const xssPatterns = [/<script/gi, /javascript:/gi, /on\w+\s*=/gi, /<iframe/gi];
    if (xssPatterns.some(pattern => pattern.test(password))) {
      throw new ApiError(400, 'Invalid password format');
    }

    const cacheKey = `auth:user:${email}`;
    let user = await redisCacheService.get<any>(cacheKey);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, password: true, status: true, loginAttempts: true, lockedUntil: true,
          role: true, roles: true, email: true, firstName: true, lastName: true,
          phone: true, lastLogin: true, institutionType: true, emailVerified: true,
          verificationRequired: true,
          // mustChangePassword indicator — set on auto-created parent/student accounts
          passwordResetToken: true,
        }
      });
      if (user) await redisCacheService.set(cacheKey, user, 5 * 60);
    }

    if (!user) throw new ApiError(401, 'Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Lockout disabled — clear and continue
      await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await redisCacheService.delete(cacheKey);
      // No lockout — just increment counter for auditing but never lock
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: (user.loginAttempts || 0) + 1 }
      });
      throw new ApiError(401, 'Invalid credentials');
    }

    if (user.status !== 'ACTIVE') throw new ApiError(403, 'Account is not active');

    const userRolesForVerify = ((user.roles && user.roles.length > 0) ? user.roles : [user.role]) as string[];
    const isSuperAdmin = userRolesForVerify.includes('SUPER_ADMIN');
    const schoolConfig = await prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, institutionType: true, institutionTypeLocked: true, requiresUserVerification: true }
    });
    const schoolRequiresVerification = schoolConfig?.requiresUserVerification !== false;
    const userRequiresVerification = user.verificationRequired !== false;
    // School admins must verify email/phone; platform SUPER_ADMIN is exempt (OTP also bypassed below).
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

    // ── C1 fix: detect auto-created accounts that must change their password ──
    // passwordResetToken is set on parent/student accounts created via learner admission.
    // We surface this as mustChangePassword so the frontend can intercept and redirect.
    const mustChangePassword = !!user.passwordResetToken;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    this.setTokenCookies(res, accessToken, refreshToken);

    await redisCacheService.delete(cacheKey);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), loginAttempts: 0, lockedUntil: null }
    });

    const { password: _, passwordResetToken: __, ...userWithoutSensitive } = user;

    const schoolId = (user as any).schoolId || (req as any).school?.id;
    // Single-tenant fallback: the user record has no schoolId column, so we
    // resolve the one-and-only school from the DB.
    const resolvedSchoolId: string | undefined = schoolId || schoolConfig?.id;

    const userRoles = ((user.roles && user.roles.length > 0) ? user.roles : [user.role]) as string[];
    const requiresInstitutionSetup = userRoles.includes('SUPER_ADMIN') && !(schoolConfig?.institutionTypeLocked === true);
    const communicationConfig = await prisma.communicationConfig.findFirst({
      select: { emailTemplates: true }
    });
    const otpEnabled = (communicationConfig?.emailTemplates as any)?.__security?.otpEnabled !== false;
    const requiresOtp = otpEnabled && !userRoles.some(r => ['SUPER_ADMIN', 'STUDENT'].includes(r));
    res.json({
      success: true,
      user: {
        ...userWithoutSensitive,
        schoolId: resolvedSchoolId || null,
        roles: userRoles,
        institutionType: user.institutionType || schoolConfig?.institutionType || (req as any).school?.institutionType || 'PRIMARY_CBC',
        institutionTypeLocked: schoolConfig?.institutionTypeLocked === true,
        requiresInstitutionSetup,
        availableInstitutionTypes: ['PRIMARY_CBC', 'SECONDARY', 'TERTIARY'],
      },
      token: accessToken, // Return actual token for cross-domain headers fallback
      refreshToken: refreshToken,
      requiresOtp,
      mustChangePassword,
      message: mustChangePassword ? 'Login successful — please set a new password' : 'Login successful'
    });
  }

  async checkAvailability(req: Request, res: Response) {
    const { email, phone } = req.body;
    if (!email && !phone) throw new ApiError(400, 'Email or phone required');

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: String(email).trim() }] : []),
          ...(phone ? [{ phone: String(phone).replace(/\s+/g, '') }] : []),
        ],
      },
      select: { id: true },
    });

    res.json({ success: true, available: !user });
  }

  async sendWhatsAppVerification(req: Request, res: Response) {
    const { phone } = req.body;
    if (!phone) throw new ApiError(400, 'Phone number required');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await whatsappService.sendMessage({
      to: phone,
      message: `Your Trends CORE V1.0 verification code is: ${otp}`
    });
    if (!result.success) throw new ApiError(500, result.message || 'Failed to send WhatsApp verification');
    res.json({ success: true, message: 'Verification code sent via WhatsApp' });
  }

  /**
   * Refresh token endpoint with rotation.
   * Verify → revoke consumed token → issue new pair.
   */
  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) throw new ApiError(400, 'Refresh token required');

    const revoked = await isRefreshTokenRevoked(refreshToken);
    if (revoked) throw new ApiError(401, 'Refresh token has already been used');

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Invalid user or account inactive');

      await revokeRefreshToken(refreshToken);

      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      this.setTokenCookies(res, newAccessToken, newRefreshToken);

      res.json({ 
        success: true,
        token: newAccessToken,
        refreshToken: newRefreshToken
      }); // tokens rotated in cookies, actual tokens returned for headers fallback
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Invalid refresh token');
    }
  }

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) throw new ApiError(400, 'Email required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ success: true, message: 'Reset link sent if account exists' });

    const resetToken = randomUUID();
    const resetExpiry = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: resetExpiry }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await EmailService.sendPasswordReset({
        to: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        schoolName: 'Trends CORE V1.0',
        resetLink: resetUrl
      });
    } catch (error) {
      logger.error('Email failed:', error);
    }

    res.json({ success: true, message: 'Reset link sent if account exists' });
  }

  async resetPassword(req: Request, res: Response) {
    const { token, newPassword, passwordConfirm } = req.body;
    if (!token || !newPassword || !passwordConfirm) throw new ApiError(400, 'Missing fields');
    if (newPassword !== passwordConfirm) throw new ApiError(400, 'Passwords do not match');

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token, passwordResetExpiry: { gt: new Date() } }
    });
    if (!user) throw new ApiError(400, 'Invalid or expired token');

    const hashedPassword = await bcrypt.hash(newPassword, 11);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,   // Clears the mustChangePassword flag
        passwordResetExpiry: null,
        loginAttempts: 0,
        lockedUntil: null
      }
    });

    res.json({ success: true, message: 'Password reset successful' });
  }

  async logout(req: AuthRequest, res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      try { await revokeRefreshToken(refreshToken); } catch { /* non-blocking */ }
    }
    this.clearTokenCookies(res);
    res.json({ success: true, message: 'Logged out' });
  }

  /**
   * Force-logout ALL users by flushing every active auth cache key.
   * Only SUPER_ADMIN and ADMIN may call this.
   */
  async logoutAll(req: AuthRequest, res: Response) {
    try {
      await redisCacheService.deleteByPrefix('revoked_rt:');
      await redisCacheService.deleteByPrefix('auth:user:');
      await redisCacheService.set('global:force_logout', Date.now().toString(), 60 * 60);
    } catch {
      // Non-fatal — best-effort Redis flush
    }
    logger.info(`[AUTH] Force-logout-all triggered by user ${req.user?.userId}`);
    res.json({ success: true, message: 'All user sessions have been invalidated.' });
  }

  /**
   * Flush the application-level Redis cache.
   * Clears all cached data (dashboard metrics, school data, etc.).
   * Only SUPER_ADMIN and ADMIN may call this.
   */
  async flushCache(req: AuthRequest, res: Response) {
    try {
      await redisCacheService.clear();
    } catch {
      // Non-fatal
    }
    logger.info(`[CACHE] Cache flush triggered by user ${req.user?.userId}`);
    res.json({ success: true, message: 'Application cache has been cleared.' });
  }

  async me(req: AuthRequest, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, status: true, createdAt: true,
        roles: true, passwordResetToken: true, institutionType: true,
      }
    });

    if (!user) throw new ApiError(404, 'User not found');

    const schoolId = (user as any).schoolId || (req as any).school?.id;
    const school = schoolId
      ? null
      : await prisma.school.findFirst({
        where: { archived: false },
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true }
      });
    const resolvedSchoolId = schoolId || school?.id;
    const { passwordResetToken, ...userPublic } = user;
    res.json({
      success: true,
      data: {
        ...userPublic,
        schoolId: resolvedSchoolId || null,
        roles: user.roles && user.roles.length > 0 ? user.roles : [user.role],
        institutionType: user.institutionType || (req as any).school?.institutionType || 'PRIMARY_CBC',
        mustChangePassword: !!passwordResetToken,
      }
    });
  }

  async getSeededUsers(_req: Request, res: Response) {
    if (process.env.NODE_ENV !== 'development') {
      throw new ApiError(403, 'This route is only available in development environment');
    }
    const users = await prisma.user.findMany({
      take: 20, orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true }
    });
    res.json({ success: true, count: users.length, data: users });
  }
}

export const authController = new AuthController();
