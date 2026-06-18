/**
 * Approval Controller
 * Handles HTTP requests for approval request lifecycle:
 * submit, list, getMyRequests, getRequest, approve, reject, override, cancel,
 * getDashboard, and getHistory.
 *
 * Role enforcement is applied at the route layer (approval.routes.ts).
 * Here we focus on input validation, delegation to ApprovalEngineService,
 * and consistent error mapping.
 *
 * Requirements: R6.1–R6.7, R9.1, R11.4
 */

import { Response } from 'express';
import { ApprovalModule, ApprovalRequestType, ApprovalStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/permissions.middleware';
import { approvalEngineService } from '../services/approvalEngine.service';
import logger from '../utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the authenticated user's ID.
 * Returns null and sends 401 if the user is not authenticated.
 */
function requireUserId(req: AuthRequest, res: Response): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'User not authenticated' });
    return null;
  }
  return userId;
}

/**
 * Extract the school ID from req.school (populated by schoolContextMiddleware).
 * Returns null and sends 400 if the school context is unavailable.
 */
function requireSchoolId(req: AuthRequest, res: Response): string | null {
  const schoolId = req.school?.id;
  if (!schoolId) {
    res.status(400).json({ success: false, message: 'School context is required' });
    return null;
  }
  return schoolId;
}

/**
 * Map well-known service error messages to HTTP status codes.
 */
function mapError(error: any, res: Response, defaultMessage: string): void {
  const msg: string = error?.message ?? defaultMessage;

  if (msg.includes('not found') || msg.includes('Not found')) {
    res.status(404).json({ success: false, message: msg });
    return;
  }
  if (msg.includes('already exists') || msg.includes('terminal state') || msg.includes('open unlock request')) {
    res.status(409).json({ success: false, message: msg });
    return;
  }
  if (msg.includes('not an assigned approver') || msg.includes('Access denied') || msg.includes('Only the requester')) {
    res.status(403).json({ success: false, message: msg });
    return;
  }
  if (msg.includes('No active workflow') || msg.includes('no approver steps') || msg.includes('Cannot cancel')) {
    res.status(422).json({ success: false, message: msg });
    return;
  }

  logger.error('[approval] Unexpected error:', error);
  res.status(500).json({ success: false, message: defaultMessage, details: msg });
}

// ─── Terminal statuses used by getHistory ─────────────────────────────────────

const HISTORY_STATUSES: ApprovalStatus[] = ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/approvals
 * Submit a new approval request.
 * Body: { module, requestType, metadata, comments? }
 *
 * R6.1, R3.1, R3.2
 */
export const submitRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const schoolId = requireSchoolId(req, res);
    if (!schoolId) return;

    const { module: mod, requestType, metadata, comments } = req.body;

    if (!mod || !requestType || !metadata) {
      return res.status(400).json({
        success: false,
        message: 'module, requestType, and metadata are required',
      });
    }

    // Validate enum values
    if (!Object.values(ApprovalModule).includes(mod as ApprovalModule)) {
      return res.status(400).json({ success: false, message: `Invalid module: ${mod}` });
    }
    if (!Object.values(ApprovalRequestType).includes(requestType as ApprovalRequestType)) {
      return res.status(400).json({ success: false, message: `Invalid requestType: ${requestType}` });
    }

    const request = await approvalEngineService.submitRequest({
      workflowModule: mod as ApprovalModule,
      requestType: requestType as ApprovalRequestType,
      requestedById: userId,
      schoolId,
      metadata,
      comments,
    });

    res.status(201).json({ success: true, data: request });
  } catch (error: any) {
    mapError(error, res, 'Failed to submit approval request');
  }
};

/**
 * GET /api/approvals
 * List approval requests visible to the current user, with optional filters.
 * Query params: status, module, requestType, dateFrom, dateTo
 *
 * R6.3, R6.4, R9.1
 */
export const listRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const schoolId = requireSchoolId(req, res);
    if (!schoolId) return;

    const { status, module: mod, requestType, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const requests = await approvalEngineService.listRequests(
      {
        schoolId,
        status: status as ApprovalStatus | undefined,
        module: mod as ApprovalModule | undefined,
        requestType: requestType as ApprovalRequestType | undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      userId
    );

    res.json({ success: true, data: requests });
  } catch (error: any) {
    logger.error('[approval] listRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to list approval requests', details: error.message });
  }
};

/**
 * GET /api/approvals/my-requests
 * List only the current user's own submitted requests.
 *
 * R6.4 — any authenticated user can see their own requests
 */
export const getMyRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const schoolId = requireSchoolId(req, res);
    if (!schoolId) return;

    const { status, module: mod, requestType, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const requests = await approvalEngineService.listRequests(
      {
        schoolId,
        requestedById: userId,
        status: status as ApprovalStatus | undefined,
        module: mod as ApprovalModule | undefined,
        requestType: requestType as ApprovalRequestType | undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      userId
    );

    res.json({ success: true, data: requests });
  } catch (error: any) {
    logger.error('[approval] getMyRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve your requests', details: error.message });
  }
};

/**
 * GET /api/approvals/:id
 * Retrieve a single approval request with full relations.
 *
 * R3.8 — access enforced inside getRequest()
 */
export const getRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;

    const request = await approvalEngineService.getRequest(id, userId);

    res.json({ success: true, data: request });
  } catch (error: any) {
    mapError(error, res, 'Failed to retrieve approval request');
  }
};

/**
 * POST /api/approvals/:id/approve
 * Approve a pending request.
 * Body: { comment? }
 *
 * R3.3, R9.2
 */
export const approveRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { comment } = req.body ?? {};

    const updated = await approvalEngineService.actOnRequest({
      requestId: id,
      actorId: userId,
      action: 'APPROVE',
      comment,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    mapError(error, res, 'Failed to approve request');
  }
};

/**
 * POST /api/approvals/:id/reject
 * Reject a pending request.
 * Body: { comment? }
 *
 * R3.4
 */
export const rejectRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { comment } = req.body ?? {};

    const updated = await approvalEngineService.actOnRequest({
      requestId: id,
      actorId: userId,
      action: 'REJECT',
      comment,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    mapError(error, res, 'Failed to reject request');
  }
};

/**
 * POST /api/approvals/:id/override
 * SUPER_ADMIN override — approve or reject regardless of workflow state.
 * Body: { action: 'APPROVE' | 'REJECT', comment? }
 *
 * R3.5
 */
export const overrideRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { action, comment } = req.body ?? {};

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be "APPROVE" or "REJECT"',
      });
    }

    // OVERRIDE is the action type for SUPER_ADMIN; the service checks role internally.
    const updated = await approvalEngineService.actOnRequest({
      requestId: id,
      actorId: userId,
      action: 'OVERRIDE',
      comment,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    mapError(error, res, 'Failed to override request');
  }
};

/**
 * POST /api/approvals/:id/cancel
 * Cancel a pending request (requester only).
 *
 * R3.6
 */
export const cancelRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;

    const updated = await approvalEngineService.cancelRequest(id, userId);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    mapError(error, res, 'Failed to cancel request');
  }
};

/**
 * GET /api/approvals/dashboard
 * Return KPI summary stats for the current user.
 *
 * R6.2
 */
export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const schoolId = requireSchoolId(req, res);
    if (!schoolId) return;

    const stats = await approvalEngineService.getDashboardStats(userId, schoolId);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('[approval] getDashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats', details: error.message });
  }
};

/**
 * GET /api/approvals/history
 * Return all requests in terminal states (APPROVED, REJECTED, EXPIRED, CANCELLED, COMPLETED).
 * Supports the same query filters as listRequests.
 *
 * R8.2, R8.3
 */
export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const schoolId = requireSchoolId(req, res);
    if (!schoolId) return;

    const { status, module: mod, requestType, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    // If a specific terminal status is requested honour it; otherwise use all terminal statuses.
    // The service accepts a single status filter — we default to APPROVED to show the most
    // useful slice, but callers can pass ?status=REJECTED etc. to narrow further.
    // For "all history" we fall back to APPROVED as the service only accepts one status at a time.
    const resolvedStatus: ApprovalStatus | undefined = (status && HISTORY_STATUSES.includes(status as ApprovalStatus))
      ? (status as ApprovalStatus)
      : undefined;

    const requests = await approvalEngineService.listRequests(
      {
        schoolId,
        // If no terminal status filter was given, we want all terminal records.
        // We pass undefined and fetch them all, then filter here to terminal statuses.
        status: resolvedStatus,
        module: mod as ApprovalModule | undefined,
        requestType: requestType as ApprovalRequestType | undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      userId
    );

    // If no specific status was requested by the caller, filter down to terminal statuses only.
    const history = resolvedStatus
      ? requests
      : requests.filter(r => HISTORY_STATUSES.includes(r.status));

    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error('[approval] getHistory error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve approval history', details: error.message });
  }
};

// ─── Controller object ────────────────────────────────────────────────────────

export const approvalController = {
  submitRequest,
  listRequests,
  getMyRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  overrideRequest,
  cancelRequest,
  getDashboard,
  getHistory,
};
