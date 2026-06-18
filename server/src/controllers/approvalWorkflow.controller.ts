/**
 * Approval Workflow Controller
 * Handles HTTP requests for approval workflow configuration (create/read/update/toggle/steps).
 *
 * Audit logging (R7.5, R8.1): every mutating operation (create, update, toggle) calls
 * auditService.logChange() in a best-effort, non-blocking manner after a successful
 * DB operation so that the HTTP response is never blocked by audit failures.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { approvalEngineService } from '../services/approvalEngine.service';
import { auditService } from '../services/audit.service';
import logger from '../utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the authenticated user's ID from the request.
 * Returns null and sends a 401 if the user is not authenticated.
 */
function requireUserId(req: AuthRequest, res: Response): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'User not authenticated' });
    return null;
  }
  return userId;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/approval-workflows
 * List all approval workflows (with step + request counts).
 */
export const listWorkflows = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUserId(req, res)) return;

    const { module: mod, active } = req.query as Record<string, string | undefined>;

    const filters: Record<string, any> = {};
    if (mod) filters.module = mod;
    if (active !== undefined) filters.active = active === 'true';

    const workflows = await approvalEngineService.listWorkflows(filters as any);

    res.json({ success: true, data: workflows });
  } catch (error: any) {
    logger.error('[approvalWorkflow] listWorkflows error:', error);
    res.status(500).json({ success: false, message: 'Failed to list workflows', details: error.message });
  }
};

/**
 * POST /api/approval-workflows
 * Create a new approval workflow.
 *
 * Audit: logs action=CREATE, entityType=ApprovalWorkflow, entityId=<new id>
 */
export const createWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const {
      name,
      module: mod,
      requestType,
      description,
      active,
      approvalMode,
      minApprovals,
      relockAfterMinutes,
      steps,
    } = req.body;

    if (!name || !mod || !requestType) {
      return res.status(400).json({
        success: false,
        message: 'name, module, and requestType are required',
      });
    }

    const workflow = await approvalEngineService.createWorkflow({
      name,
      module: mod,
      requestType,
      description,
      active,
      approvalMode,
      minApprovals,
      relockAfterMinutes,
      steps: steps ?? [],
    });

    // Audit log — best-effort, non-blocking (R7.5, R8.1)
    auditService.logChange({
      entityType: 'ApprovalWorkflow',
      entityId: workflow!.id,
      action: 'CREATE',
      userId,
      reason: `Workflow '${workflow!.name}' (${workflow!.module}/${workflow!.requestType}) created`,
    }).catch(err => logger.warn('[approvalWorkflow] audit CREATE failed:', err?.message));

    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    logger.error('[approvalWorkflow] createWorkflow error:', error);

    if (error.message?.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: 'Failed to create workflow', details: error.message });
  }
};

/**
 * PUT /api/approval-workflows/:id
 * Update workflow metadata (name, description, approvalMode, etc.).
 *
 * Audit: logs action=UPDATE, entityType=ApprovalWorkflow, field='metadata'
 */
export const updateWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const {
      name,
      description,
      active,
      approvalMode,
      minApprovals,
      relockAfterMinutes,
    } = req.body;

    const workflow = await approvalEngineService.updateWorkflow(id, {
      name,
      description,
      active,
      approvalMode,
      minApprovals,
      relockAfterMinutes,
    });

    // Audit log — best-effort, non-blocking (R7.5, R8.1)
    const changedFields = Object.keys(req.body).filter(k => req.body[k] !== undefined);
    auditService.logChange({
      entityType: 'ApprovalWorkflow',
      entityId: id,
      action: 'UPDATE',
      userId,
      field: 'metadata',
      reason: `Workflow '${workflow.name}' updated — changed fields: ${changedFields.join(', ')}`,
    }).catch(err => logger.warn('[approvalWorkflow] audit UPDATE failed:', err?.message));

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    logger.error('[approvalWorkflow] updateWorkflow error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.status(500).json({ success: false, message: 'Failed to update workflow', details: error.message });
  }
};

/**
 * PATCH /api/approval-workflows/:id/toggle
 * Activate or deactivate a workflow.
 *
 * Audit: logs action=UPDATE, entityType=ApprovalWorkflow, field='active',
 *        oldValue=<previous>, newValue=<new>
 */
export const toggleWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;

    // toggleWorkflow throws if the id is not found; capture the old state first
    // by letting the service do the lookup internally — it returns the updated record
    // and we can infer previousActive as !newActive.
    const workflow = await approvalEngineService.toggleWorkflow(id);

    // toggleWorkflow returns the updated workflow; old state was the inverse
    const newActive = workflow.active;
    const previousActive = !newActive;

    // Audit log — best-effort, non-blocking (R7.5, R8.1)
    auditService.logChange({
      entityType: 'ApprovalWorkflow',
      entityId: id,
      action: 'UPDATE',
      userId,
      field: 'active',
      oldValue: String(previousActive),
      newValue: String(newActive),
      reason: newActive
        ? `Workflow '${workflow.name}' activated`
        : `Workflow '${workflow.name}' deactivated`,
    }).catch(err => logger.warn('[approvalWorkflow] audit TOGGLE failed:', err?.message));

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    logger.error('[approvalWorkflow] toggleWorkflow error:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: 'Failed to toggle workflow', details: error.message });
  }
};

/**
 * GET /api/approval-workflows/:id/steps
 * Return all steps for a workflow.
 */
export const getWorkflowSteps = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUserId(req, res)) return;

    const { id } = req.params;

    // listWorkflows includes steps — filter to the requested workflow id
    const all = await approvalEngineService.listWorkflows();
    const workflow = all.find(w => w.id === id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.json({ success: true, data: workflow.steps });
  } catch (error: any) {
    logger.error('[approvalWorkflow] getWorkflowSteps error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch workflow steps', details: error.message });
  }
};

/**
 * PUT /api/approval-workflows/:id/steps
 * Replace all steps for a workflow.
 */
export const updateWorkflowSteps = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({ success: false, message: 'steps must be an array' });
    }

    const workflow = await approvalEngineService.updateWorkflowSteps(id, steps);

    // Audit log — best-effort, non-blocking (R7.5, R8.1)
    auditService.logChange({
      entityType: 'ApprovalWorkflow',
      entityId: id,
      action: 'UPDATE',
      userId,
      field: 'steps',
      reason: `Workflow steps replaced — ${steps.length} step(s) configured`,
    }).catch(err => logger.warn('[approvalWorkflow] audit UPDATE steps failed:', err?.message));

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    logger.error('[approvalWorkflow] updateWorkflowSteps error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.status(500).json({ success: false, message: 'Failed to update workflow steps', details: error.message });
  }
};

// ─── Controller object ────────────────────────────────────────────────────────

export const approvalWorkflowController = {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  toggleWorkflow,
  getWorkflowSteps,
  updateWorkflowSteps,
};
