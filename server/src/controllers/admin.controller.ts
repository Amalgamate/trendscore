import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { encrypt } from '../utils/encryption.util';
import { ApiError } from '../utils/error.util';
import { impersonationService } from '../services/impersonation.service';
import { type ImpersonationJWTPayload } from '../types/impersonation.types';
import { AuthRequest } from '../middleware/auth.middleware';

export class AdminController {
  /**
   * Get available system modules
   * GET /api/admin/modules
   */
  async getSchoolModules(_req: Request, res: Response) {
    const modules = {
      ASSESSMENT: true,
      LEARNERS: true,
      TUTORS: true,
      PARENTS: true,
      ATTENDANCE: true,
      FEES: true,
      REPORTS: true,
      SETTINGS: true,
    };
    res.json({ success: true, data: modules });
  }

  /**
   * Get communication configuration
   * GET /api/admin/communication
   */
  async getSchoolCommunication(_req: Request, res: Response) {
    const config = await prisma.communicationConfig.findFirst();

    if (!config) {
      return res.json({
        success: true,
        data: {
          smsEnabled: true,
          smsProvider: 'mobilesasa',
          emailProvider: 'resend',
          mpesaProvider: 'intasend',
        },
      });
    }

    res.json({ success: true, data: config });
  }

  /**
   * Update communication configuration
   * PUT /api/admin/communication
   */
  async updateSchoolCommunication(req: Request, res: Response) {
    const updateData = { ...req.body };

    // Encrypt sensitive keys before storing
    if (updateData.smsApiKey)       updateData.smsApiKey       = encrypt(updateData.smsApiKey);
    if (updateData.emailApiKey)     updateData.emailApiKey     = encrypt(updateData.emailApiKey);
    if (updateData.mpesaSecretKey)  updateData.mpesaSecretKey  = encrypt(updateData.mpesaSecretKey);
    if (updateData.mpesaPublicKey)  updateData.mpesaPublicKey  = encrypt(updateData.mpesaPublicKey);
    if (updateData.smsCustomToken)  updateData.smsCustomToken  = encrypt(updateData.smsCustomToken);

    const existing = await prisma.communicationConfig.findFirst();

    const config = existing
      ? await prisma.communicationConfig.update({ where: { id: existing.id }, data: updateData })
      : await prisma.communicationConfig.create({ data: updateData });

    res.json({ success: true, data: config });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Impersonation endpoints  (Requirements 3.1, 3.2, 5.1, 5.2, 7.1–7.10)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search users available for impersonation.
   * GET /api/admin/impersonate/search?q=<query>&limit=<n>
   */
  async searchUsersForImpersonation(req: AuthRequest, res: Response, next: NextFunction) {
    const q = String(req.query.q ?? '');
    const limit = parseInt(String(req.query.limit ?? '10'), 10) || 10;

    const results = await impersonationService.searchUsers(q, req.user!, limit);
    res.json({ success: true, data: results });
  }

  /**
   * Start an impersonation session for the given target user.
   * POST /api/admin/impersonate/start
   */
  async startImpersonation(req: AuthRequest, res: Response, next: NextFunction) {
    const { targetUserId } = req.body as { targetUserId: string };
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await impersonationService.startImpersonation(
      targetUserId,
      req.user!,
      ipAddress,
      userAgent,
    );

    // Set the impersonation access token as an httpOnly cookie.
    // No refresh token is issued for impersonation sessions (Req 8.2).
    // We set only the accessToken cookie directly — authTokenService.setTokenCookies
    // requires a refresh token, which impersonation sessions intentionally omit.
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
        ? (process.env.SECURE_COOKIES || '').toLowerCase() === 'true'
        : false,
      sameSite: (process.env.NODE_ENV === 'production' && (process.env.SECURE_COOKIES || '').toLowerCase() === 'true')
        ? ('none' as const)
        : ('lax' as const),
      path: '/',
      maxAge: 30 * 60 * 1000, // 30 min — matches the impersonation JWT TTL (Req 8.1)
    };
    res.cookie('accessToken', result.accessToken, cookieOptions);

    res.json({ success: true, data: result });
  }

  /**
   * Stop the active impersonation session.
   * POST /api/admin/impersonate/stop
   */
  async stopImpersonation(req: AuthRequest, res: Response, next: NextFunction) {
    const token: string = req.cookies?.accessToken ?? '';

    if (!req.user?.isImpersonation) {
      throw new ApiError(400, 'Not in an impersonation session');
    }

    await impersonationService.stopImpersonation(
      token,
      req.user as unknown as ImpersonationJWTPayload,
      res,
    );

    res.json({ success: true, message: 'Impersonation session ended' });
  }
}
