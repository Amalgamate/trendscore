/**
 * WhatsApp Status Controller
 * Handles WhatsApp connection status and QR code retrieval
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { whatsappService } from '../services/whatsapp.service';
import { ApiError } from '../utils/error.util';
import { hasAnyRole } from '../utils/roleNormalizer';

import logger from '../utils/logger';
class WhatsAppStatusController {
    /**
     * Get WhatsApp connection status.
     * The raw QR string links a device to the school's WhatsApp number, so it is
     * only returned to administrators; other staff just see the status.
     */
    async getStatus(req: AuthRequest, res: Response) {
        try {
            const status = whatsappService.getStatus();
            const canSeeQr = hasAnyRole(req.user, ['SUPER_ADMIN', 'ADMIN']);

            res.json({
                success: true,
                data: {
                    status: status.status,
                    hasQRCode: !!status.qrCode,
                    ...(canSeeQr ? { qrCode: status.qrCode } : {})
                }
            });
        } catch (error: any) {
            logger.error('[WhatsApp Status] Error getting status:', error);
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({
                    success: false,
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get WhatsApp status',
                    error: error.message
                });
            }
        }
    }

    /**
     * Get QR code for authentication
     */
    async getQRCode(req: AuthRequest, res: Response) {
        try {
            const status = whatsappService.getStatus();

            if (!status.qrCode) {
                return res.json({
                    success: false,
                    message: 'No QR code available',
                    data: { qrCode: null }
                });
            }

            res.json({
                success: true,
                data: {
                    qrCode: status.qrCode,
                    status: status.status
                }
            });
        } catch (error: any) {
            logger.error('[WhatsApp Status] Error getting QR code:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get QR code',
                error: error.message
            });
        }
    }

    /**
     * Initialize WhatsApp service
     */
    async initialize(req: AuthRequest, res: Response) {
        try {
            // This triggers the internal initialization if not already running
            whatsappService.initialize();
            
            const status = whatsappService.getStatus();
            res.json({
                success: true,
                message: 'WhatsApp initialization started',
                data: { status: status.status }
            });
        } catch (error: any) {
            logger.error('[WhatsApp Status] Error initializing:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initialize WhatsApp',
                error: error.message
            });
        }
    }

    /**
     * Logout WhatsApp service
     */
    async logout(req: AuthRequest, res: Response) {
        try {
            const result = await whatsappService.logout();
            res.json(result);
        } catch (error: any) {
            logger.error('[WhatsApp Status] Error logging out:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to logout WhatsApp',
                error: error.message
            });
        }
    }
}

export const whatsappStatusController = new WhatsAppStatusController();
