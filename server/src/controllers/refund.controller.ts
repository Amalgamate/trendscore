import { Request, Response } from 'express';
import { refundService } from '../services/refund.service';
import logger from '../utils/logger';

/**
 * Refund Controller
 *
 * Routes:
 *  POST   /refunds              — submit a refund request (SUBMIT_REFUND)
 *  POST   /refunds/:id/approve  — approve a refund (APPROVE_REFUND — SUPER_ADMIN only)
 *  POST   /refunds/:id/reject   — reject a refund (APPROVE_REFUND — SUPER_ADMIN only)
 *  GET    /refunds              — list refunds (FINANCIAL_REPORTS)
 *  GET    /refunds/:id          — get a single refund
 */

// ─── Submit Refund ──────────────────────────────────────────────────────────
export const submitRefund = async (req: Request, res: Response) => {
    const { paymentId, reason, method, notes } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const schoolId = (req as any).schoolId || (req as any).user?.schoolId;

    if (!paymentId || !reason) {
        return res.status(400).json({
            success: false,
            message: 'paymentId and reason are required',
        });
    }

    try {
        const result = await refundService.submitRefund({
            paymentId,
            reason,
            submittedById: userId,
            schoolId: schoolId || '',
            method,
            notes,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('[RefundController] Submit error:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

// ─── Approve Refund ─────────────────────────────────────────────────────────
export const approveRefund = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const role = (req as any).user?.role;

    try {
        const result = await refundService.approveRefund({
            refundId: id,
            approverId: userId,
            approverRole: role,
            comment,
        });
        res.json(result);
    } catch (error: any) {
        logger.error('[RefundController] Approve error:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

// ─── Reject Refund ──────────────────────────────────────────────────────────
export const rejectRefund = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const role = (req as any).user?.role;

    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required',
        });
    }

    try {
        const result = await refundService.rejectRefund({
            refundId: id,
            rejectorId: userId,
            rejectorRole: role,
            reason,
        });
        res.json(result);
    } catch (error: any) {
        logger.error('[RefundController] Reject error:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

// ─── List Refunds ───────────────────────────────────────────────────────────
export const listRefunds = async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;

    try {
        const result = await refundService.listRefunds({
            status: status as string | undefined,
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Get Single Refund ──────────────────────────────────────────────────────
export const getRefund = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const refund = await refundService.getRefund(id);
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Refund not found' });
        }
        res.json({ success: true, data: refund });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
