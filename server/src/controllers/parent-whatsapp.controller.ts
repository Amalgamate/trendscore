import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { parentWhatsAppLinkService } from '../services/parent-whatsapp-link.service';

const enabledSchema = z.object({ enabled: z.boolean() });
const linkConsentSchema = z.object({ consent: z.literal(true) });

const getUserId = (req: AuthRequest) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');
  if (req.user?.isImpersonation) throw new ApiError(403, 'WhatsApp account linking is unavailable during impersonation');
  return userId;
};

export const parentWhatsAppController = {
  async status(req: AuthRequest, res: Response) {
    const data = await parentWhatsAppLinkService.getStatus(getUserId(req));
    res.json({ success: true, data });
  },

  async createLinkCode(req: AuthRequest, res: Response) {
    linkConsentSchema.parse(req.body);
    const data = await parentWhatsAppLinkService.createLinkCode(getUserId(req));
    res.json({
      success: true,
      data,
      message: 'Send LINK followed by this code to the school WhatsApp number within 10 minutes.',
    });
  },

  /**
   * Default linking path: message the number on the parent's profile and wait
   * for them to reply YES. No code is shown to the parent.
   *
   * Returns the refreshed status so the popup can render the "check your
   * WhatsApp" state from server truth instead of guessing locally.
   */
  async requestConfirmation(req: AuthRequest, res: Response) {
    linkConsentSchema.parse(req.body);
    const userId = getUserId(req);
    const data = await parentWhatsAppLinkService.requestConfirmation(userId);
    const status = await parentWhatsAppLinkService.getStatus(userId);
    res.json({
      success: true,
      data: { ...data, status },
      message: `We sent a WhatsApp message to ${data.phone}. Reply YES to turn the assistant on.`,
    });
  },

  async updateSettings(req: AuthRequest, res: Response) {
    const { enabled } = enabledSchema.parse(req.body);
    const data = await parentWhatsAppLinkService.setEnabled(getUserId(req), enabled);
    res.json({ success: true, data });
  },

  async disconnect(req: AuthRequest, res: Response) {
    const data = await parentWhatsAppLinkService.disconnect(getUserId(req));
    res.json({ success: true, data, message: 'WhatsApp assistant disconnected' });
  },
};
