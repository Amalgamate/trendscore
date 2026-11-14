import { Request, Response } from 'express';
import prisma from '../config/database';
import { invalidateAuthLookupCache } from '../services/auth-cache.service';

export class OnboardingController {
  /**
   * Direct school registration is replaced by the review-first application flow.
   * POST /api/onboarding/register
   */
  async registerFull(_req: Request, res: Response) {
    return res.status(410).json({
      success: false,
      error: 'Direct school registration is closed. Submit a school application for internal review before installation.',
    });
  }

  /**
   * Verify email address via token
   * GET /api/onboarding/verify-email?token=...
   */
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.query as { token?: string };
      if (!token) {
        return res.status(400).json({ success: false, error: 'Missing token' });
      }
      const user = await prisma.user.findFirst({
        where: { emailVerificationToken: String(token) },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: 'Invalid token' });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: 'ACTIVE', emailVerificationToken: null, authVersion: { increment: 1 } },
      });
      await invalidateAuthLookupCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Verification failed' });
    }
  }

  /**
   * Verify phone OTP
   * POST /api/onboarding/verify-phone
   */
  async verifyPhone(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Missing email or code' });
      }
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, phoneVerificationCode: true },
      });
      if (!user || user.phoneVerificationCode !== code) {
        return res.status(400).json({ success: false, error: 'Invalid code' });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerificationCode: null,
          phoneVerificationSentAt: null,
          emailVerified: true,
        },
      });
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Phone verification failed' });
    }
  }
}
