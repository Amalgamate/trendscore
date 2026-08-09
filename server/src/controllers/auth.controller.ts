import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type {} from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { Role, canManageRole } from '../config/permissions';
import { AuthRequest } from '../middleware/permissions.middleware';
import { validatePassword, DEFAULT_PASSWORD_POLICY, PARENT_PASSWORD_POLICY } from '../utils/password.util';
import { EmailService } from '../services/email-resend.service';
import { whatsappService } from '../services/whatsapp.service';
import { redisCacheService } from '../services/redis-cache.service';
import { markGlobalForceLogout } from '../services/auth-session.service';
import { authLoginService } from '../services/auth-login.service';
import { authPhoneOtpService } from '../services/auth-phone-otp.service';
import { authTokenService } from '../services/auth-token.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { buildParentLoginEmail } from '../services/parent.service';
import { studentPhoneLookupService } from '../services/studentPhoneLookup.service';
import { studentPhoneLoginService } from '../services/studentPhoneLogin.service';

import logger from '../utils/logger';

const MAX_LOGIN_ATTEMPTS = 999; // lockout disabled
const ACCOUNT_LOCK_MINUTES = 0; // lockout disabled

export class AuthController {
  async register(req: AuthRequest, res: Response) {
    let { email, password, firstName, lastName, role, phone } = req.body;

    if (!password || !firstName || !lastName) {
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

    if (requestedRole === 'PARENT') {
      const parentLoginEmail = buildParentLoginEmail(phone);
      if (!parentLoginEmail) {
        throw new ApiError(400, 'Parent phone number is required before issuing a login account');
      }
      email = parentLoginEmail;
    } else if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ApiError(400, 'User already exists');

    const passwordPolicy = requestedRole === 'PARENT' ? PARENT_PASSWORD_POLICY : DEFAULT_PASSWORD_POLICY;
    const passwordValidation = validatePassword(password, passwordPolicy);
    if (!passwordValidation.valid) throw new ApiError(400, passwordValidation.errors.join(', '));

    const hashedPassword = await bcrypt.hash(password, 11);

    const user = await prisma.user.create({
      data: {
        email, username: requestedRole === 'PARENT' ? email : undefined, password: hashedPassword, firstName, lastName,
        role: requestedRole, roles: [requestedRole], phone: phone || null, status: 'ACTIVE'
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, 
        role: true, roles: true, phone: true, createdAt: true, institutionType: true
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (requestedRole !== 'PARENT') {
      EmailService.sendWelcomeEmail({
        to: email,
        schoolName: PRODUCT_DISPLAY_NAME,
        adminName: `${firstName} ${lastName}`,
        loginUrl: `${frontendUrl}/login`
      }).catch(err => logger.error('Failed to send welcome email:', err));
    }

    const { accessToken, refreshToken } = authTokenService.issueTokenPair(user);

    authTokenService.setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true, 
      user, 
      token: '__cookie__', // placeholder for frontend state compatibility
      refreshToken: '__cookie__', // placeholder for frontend state compatibility
      message: 'User registered successfully'
    });
  }

  async login(req: Request, res: Response) {
    const result = await authLoginService.loginWithPassword({
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      rememberMe: req.body.rememberMe === true,
      requestSchool: (req as any).school || null,
    });

    authTokenService.setTokenCookies(res, result.token, result.refreshToken, req.body.rememberMe === true);
    res.json(result);
  }

  async loginConfig(_req: Request, res: Response) {
    const config = await prisma.communicationConfig.findFirst({
      select: { emailTemplates: true },
    });
    // Schools without an explicit, working SMS setup use password login.
    const otpEnabled = (config?.emailTemplates as any)?.__security?.otpEnabled === true;

    res.json({ otpEnabled });
  }

  async requestPhoneOtp(req: Request, res: Response) {
    const result = await authPhoneOtpService.requestParentOtp({
      phone: req.body.phone,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined,
    });

    res.json(result);
  }

  async verifyPhoneOtp(req: Request, res: Response) {
    const result = await authPhoneOtpService.verifyParentOtp({
      challengeId: req.body.challengeId,
      phone: req.body.phone,
      code: req.body.code,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined,
      rememberMe: req.body.rememberMe === true,
    });

    authTokenService.setTokenCookies(res, result.token, result.refreshToken, req.body.rememberMe === true);
    res.json(result);
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
      message: `Your ${PRODUCT_DISPLAY_NAME} verification code is: ${otp}`
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

    try {
      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        rememberMe,
      } = await authTokenService.rotateRefreshToken(refreshToken);

      authTokenService.setTokenCookies(res, newAccessToken, newRefreshToken, rememberMe);

      res.json({ 
        success: true,
        token: newAccessToken,
        refreshToken: newRefreshToken
      }); // tokens rotated in cookies, actual tokens returned for headers fallback
    } catch (error) {
      if (error instanceof ApiError && error.message === 'Session invalidated by administrator') {
        authTokenService.clearTokenCookies(res);
      }
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
        schoolName: PRODUCT_DISPLAY_NAME,
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
      try { await authTokenService.revokeRefreshToken(refreshToken); } catch { /* non-blocking */ }
    }
    authTokenService.clearTokenCookies(res);
    res.json({ success: true, message: 'Logged out' });
  }

  /**
   * Force-logout ALL users by flushing every active auth cache key.
   * Only SUPER_ADMIN and ADMIN may call this.
   */
  async logoutAll(req: AuthRequest, res: Response) {
    let forcedAfter: number | null = null;
    try {
      forcedAfter = await markGlobalForceLogout();
      await redisCacheService.deleteByPrefix('auth:user:');
    } catch (error) {
      logger.error('[AUTH] Force-logout-all failed:', error);
      throw new ApiError(500, 'Failed to invalidate active sessions. Please try again.');
    }
    logger.info(`[AUTH] Force-logout-all triggered by user ${req.user?.userId}`);
    authTokenService.clearTokenCookies(res);
    res.json({
      success: true,
      forcedAfter,
      message: 'All user sessions have been invalidated.',
    });
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
        id: true, email: true, firstName: true, middleName: true, lastName: true, phone: true,
        profilePicture: true, staffId: true, subject: true, gender: true,
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

  async studentPhoneLookup(req: Request, res: Response) {
    const result = await studentPhoneLookupService.lookup(req.body.phone, req.ip);
    res.json(result);
  }

  async studentPhoneLogin(req: Request, res: Response) {
    const result = await studentPhoneLoginService.login({
      sessionToken: req.body.sessionToken,
      studentUserId: req.body.studentUserId,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined,
      rememberMe: req.body.rememberMe === true,
    });

    authTokenService.setTokenCookies(res, result.token, result.refreshToken, req.body.rememberMe === true);
    res.json(result);
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
