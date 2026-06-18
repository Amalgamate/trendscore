/**
 * approval.routes.ts
 *
 * Routes for the Centralized Approval & Notification Engine — request lifecycle.
 * Mounted at /api/approvals by index.ts.
 *
 * Middleware contract:
 *   - authenticate           — applied globally in index.ts (protected section)
 *   - schoolContextMiddleware — applied globally in server.ts
 *   Both are also applied via router.use() here for explicitness and
 *   defence-in-depth in case this router is ever mounted standalone.
 *
 * Role enforcement (R9.1 permissions table):
 *   - Any authenticated user   → submit, my-requests, get single, approve, reject, cancel
 *   - ADMIN / SUPER_ADMIN / HEAD_TEACHER → list all, dashboard, history
 *   - SUPER_ADMIN only         → override
 *
 * IMPORTANT: Static paths (/dashboard, /my-requests, /history) are registered
 * before parameterised paths (/:id) to prevent Express matching "dashboard"
 * as an :id value.
 *
 * Requirements: R6.1–R6.7, R9.1, R11.4
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { schoolContextMiddleware } from '../middleware/schoolContext.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import {
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
} from '../controllers/approval.controller';

const router = Router();

// ── Global guards (defence-in-depth) ─────────────────────────────────────────
// Both are already applied at the application level, but we apply them here
// explicitly so this router is safe if mounted independently.
router.use(authenticate);
router.use(schoolContextMiddleware);

// ── Roles shorthand ───────────────────────────────────────────────────────────
// Users who can view all school-level approvals (R9.1 "View all approvals")
const ADMIN_ROLES = requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

// ── Static routes — MUST come before /:id ────────────────────────────────────

/**
 * POST /api/approvals
 * Submit a new approval request.
 * Any authenticated user (teachers, admins, etc.) may submit.
 * R3.1, R6.1, R9.1 (Submit requests — any authenticated user)
 */
router.post('/', submitRequest);

/**
 * GET /api/approvals
 * List all approval requests visible at school scope.
 * Restricted to ADMIN, SUPER_ADMIN, HEAD_TEACHER per R9.1.
 * Service layer further scopes by school (R3.8).
 */
router.get('/', ADMIN_ROLES, listRequests);

/**
 * GET /api/approvals/dashboard
 * KPI stats: Pending, Awaiting My Action, My Submitted, Approved Today, Rejected Today.
 * R6.2 — accessible to ADMIN, SUPER_ADMIN, HEAD_TEACHER per R6.1.
 */
router.get('/dashboard', ADMIN_ROLES, getDashboard);

/**
 * GET /api/approvals/my-requests
 * List only the current user's own submitted requests.
 * R6.4 — any authenticated user; service scopes to requestedById = current user.
 */
router.get('/my-requests', getMyRequests);

/**
 * GET /api/approvals/history
 * Full audit history of terminal-state requests (APPROVED, REJECTED, EXPIRED, etc.).
 * R8.2, R8.3 — restricted to ADMIN, SUPER_ADMIN, HEAD_TEACHER per R9.1.
 */
router.get('/history', ADMIN_ROLES, getHistory);

// ── Parameterised routes — registered after static paths ─────────────────────

/**
 * GET /api/approvals/:id
 * Retrieve a single approval request with full relations.
 * Any authenticated user may attempt; service enforces access control (R3.8):
 * admins see all, requesters see own, assigned approvers see theirs.
 */
router.get('/:id', getRequest);

/**
 * POST /api/approvals/:id/approve
 * Approve a pending request.
 * Any authenticated user may call; service validates the actor is in
 * resolvedApproverIds for the current step (R9.2).
 */
router.post('/:id/approve', approveRequest);

/**
 * POST /api/approvals/:id/reject
 * Reject a pending request.
 * Any authenticated user may call; service validates approver membership (R3.4, R9.2).
 */
router.post('/:id/reject', rejectRequest);

/**
 * POST /api/approvals/:id/override
 * SUPER_ADMIN override — approve or reject regardless of workflow state.
 * Body: { action: 'APPROVE' | 'REJECT', comment? }
 * R3.5, R9.1 (Override any request — SUPER_ADMIN only).
 */
router.post('/:id/override', requireRole(['SUPER_ADMIN']), overrideRequest);

/**
 * POST /api/approvals/:id/cancel
 * Cancel a pending request.
 * Any authenticated user may call; service enforces requester-only check (R3.6).
 */
router.post('/:id/cancel', cancelRequest);

export default router;
