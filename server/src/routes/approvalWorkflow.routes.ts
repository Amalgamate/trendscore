/**
 * approvalWorkflow.routes.ts
 *
 * Routes for approval workflow configuration (create/read/update/toggle/steps).
 * Mounted at /api/approval-workflows by index.ts.
 *
 * Middleware contract:
 *   - authenticate           — applied globally in index.ts (protected section)
 *   - schoolContextMiddleware — applied globally in server.ts
 *   Both are also applied via router.use() here for explicitness and
 *   defence-in-depth in case this router is ever mounted standalone.
 *
 * Role enforcement (R1.2, R9.1):
 *   ALL endpoints in this router are restricted to ADMIN and SUPER_ADMIN.
 *   Workflow configuration is a privileged administrative operation and must
 *   never be accessible to TEACHER, HEAD_TEACHER, or any other role.
 *
 * Route ordering note:
 *   Static sub-paths (/:id/toggle, /:id/steps) are Express-safe here because
 *   they are all scoped under a parameterised :id prefix — Express differentiates
 *   them by HTTP method and trailing path segment, not by param vs. literal.
 *
 * Requirements: R1.2, R7.1–R7.5, R9.1
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { schoolContextMiddleware } from '../middleware/schoolContext.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  toggleWorkflow,
  getWorkflowSteps,
  updateWorkflowSteps,
} from '../controllers/approvalWorkflow.controller';

const router = Router();

// ── Global guards (defence-in-depth) ─────────────────────────────────────────
// authenticate and schoolContextMiddleware are already applied at the application
// level, but we apply them here explicitly so the router is safe if ever mounted
// standalone or tested in isolation.
router.use(authenticate);
router.use(schoolContextMiddleware);

// ── Role restriction — all workflow management endpoints are ADMIN/SUPER_ADMIN ─
// R1.2: only administrators may create, view, edit, or toggle approval workflows.
router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

// ── Workflow collection routes ────────────────────────────────────────────────

/**
 * GET /api/approval-workflows
 * List all approval workflows (with step counts and optional filters).
 * R7.1, R9.1 (View workflows — ADMIN / SUPER_ADMIN)
 */
router.get('/', listWorkflows);

/**
 * POST /api/approval-workflows
 * Create a new approval workflow (with optional initial steps).
 * R7.2, R9.1 (Create workflow — ADMIN / SUPER_ADMIN)
 */
router.post('/', createWorkflow);

// ── Workflow instance routes ──────────────────────────────────────────────────

/**
 * PUT /api/approval-workflows/:id
 * Update workflow metadata (name, description, mode, minApprovals, relock duration).
 * R7.3, R9.1 (Edit workflow — ADMIN / SUPER_ADMIN)
 */
router.put('/:id', updateWorkflow);

/**
 * PATCH /api/approval-workflows/:id/toggle
 * Activate or deactivate a workflow without deleting it.
 * R7.4, R9.1 (Toggle workflow active state — ADMIN / SUPER_ADMIN)
 */
router.patch('/:id/toggle', toggleWorkflow);

/**
 * GET /api/approval-workflows/:id/steps
 * Retrieve all steps for a specific workflow.
 * R7.5, R9.1 (View workflow steps — ADMIN / SUPER_ADMIN)
 */
router.get('/:id/steps', getWorkflowSteps);

/**
 * PUT /api/approval-workflows/:id/steps
 * Replace all steps for a workflow (transactional — old steps are removed first).
 * R7.5, R9.1 (Edit workflow steps — ADMIN / SUPER_ADMIN)
 */
router.put('/:id/steps', updateWorkflowSteps);

export default router;
