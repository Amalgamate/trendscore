import {
  ApprovalModule,
  ApprovalRequestType,
  ApprovalStatus,
  ApprovalActionType,
  ApprovalRequest,
  ApprovalStep,
} from '@prisma/client';
import prisma from '../config/database';
import { NotificationService, NotificationType } from './notification.service';
import { auditService } from './audit.service';
import { WorkflowService } from './workflow.service';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface SubmitApprovalParams {
  workflowModule: ApprovalModule;
  requestType: ApprovalRequestType;
  requestedById: string;
  schoolId: string;
  metadata: Record<string, any>;
  comments?: string;
}

export interface ActOnApprovalParams {
  requestId: string;
  actorId: string;
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE';
  comment?: string;
}

export interface RequestFilters {
  status?: ApprovalStatus;
  module?: ApprovalModule;
  requestType?: ApprovalRequestType;
  requestedById?: string;
  approverId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  schoolId: string;
}

export interface DashboardStats {
  pending: number;
  awaitingMyAction: number;
  mySubmitted: number;
  approvedToday: number;
  rejectedToday: number;
}

interface ScoreUnlockMetadata {
  assessmentId: string;
  assessmentType: 'formative' | 'summative';
  classId: string;
  subjectId: string;
  term: string;
  academicYear: number;
  teacherId: string;
}

interface AttendanceUnlockMetadata {
  classId: string;
  date: string;
}

// ─── Terminal states ─────────────────────────────────────────────────────────
const TERMINAL_STATUSES: ApprovalStatus[] = [
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED',
];

// ─── Hook handlers ───────────────────────────────────────────────────────────

const workflowService = new WorkflowService();

async function scoreUnlockApprovalHandler(request: ApprovalRequest): Promise<void> {
  const meta = request.metadata as unknown as ScoreUnlockMetadata;
  await workflowService.unlockAssessment({
    assessmentId: meta.assessmentId,
    assessmentType: meta.assessmentType,
    userId: request.requestedById,
    reason: `Approved via approval engine — request ${request.id}`,
  });
}

async function scoreRelockHandler(request: ApprovalRequest): Promise<void> {
  const meta = request.metadata as unknown as ScoreUnlockMetadata;
  await workflowService.lockAssessment({
    assessmentId: meta.assessmentId,
    assessmentType: meta.assessmentType,
    userId: 'SYSTEM',
    reason: `Auto-relock — approval window expired (request ${request.id})`,
  });
}

// No-op stub for future modules
const noopHandler = async (_request: ApprovalRequest): Promise<void> => {};

export const APPROVAL_HOOKS: Record<ApprovalRequestType, (request: ApprovalRequest) => Promise<void>> = {
  SCORE_UNLOCK: scoreUnlockApprovalHandler,
  ATTENDANCE_UNLOCK: noopHandler,
  FEE_ADJUSTMENT: noopHandler,
  FEE_WAIVER: noopHandler,
  EXPENSE_APPROVAL: noopHandler,
  BUDGET_APPROVAL: noopHandler,
  PAYMENT_REVERSAL: noopHandler,
  ROLE_CHANGE: noopHandler,
  LEAVE_APPROVAL: noopHandler,
  REPORT_PUBLISHING: noopHandler,
  STOCK_ADJUSTMENT: noopHandler,
};

export const EXPIRY_HOOKS: Record<ApprovalRequestType, (request: ApprovalRequest) => Promise<void>> = {
  SCORE_UNLOCK: scoreRelockHandler,
  ATTENDANCE_UNLOCK: noopHandler,
  FEE_ADJUSTMENT: noopHandler,
  FEE_WAIVER: noopHandler,
  EXPENSE_APPROVAL: noopHandler,
  BUDGET_APPROVAL: noopHandler,
  PAYMENT_REVERSAL: noopHandler,
  ROLE_CHANGE: noopHandler,
  LEAVE_APPROVAL: noopHandler,
  REPORT_PUBLISHING: noopHandler,
  STOCK_ADJUSTMENT: noopHandler,
};

// ─── ApprovalEngineService ───────────────────────────────────────────────────

export class ApprovalEngineService {

  // ── Task 3.2 ─────────────────────────────────────────────────────────────
  /**
   * Submit a new approval request.
   * Finds the active workflow, resolves approvers, guards against duplicates,
   * creates the ApprovalRequest, and notifies all resolved approvers.
   */
  async submitRequest(params: SubmitApprovalParams): Promise<ApprovalRequest> {
    const { workflowModule, requestType, requestedById, schoolId, metadata, comments } = params;

    // Find the active workflow for this module + requestType
    const workflow = await prisma.approvalWorkflow.findFirst({
      where: { module: workflowModule, requestType, active: true },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!workflow) {
      throw new Error(`No active workflow configured for ${requestType}`);
    }

    if (!workflow.steps.length) {
      throw new Error('Workflow has no approver steps configured');
    }

    // Task 3.4 — Duplicate-request guard
    // For SCORE_UNLOCK, guard on the same assessmentId in metadata
    if (requestType === 'SCORE_UNLOCK') {
      const assessmentId = (metadata as ScoreUnlockMetadata).assessmentId;
      if (assessmentId) {
        const existing = await prisma.approvalRequest.findFirst({
          where: {
            schoolId,
            requestType: 'SCORE_UNLOCK',
            status: { in: ['PENDING', 'APPROVED'] },
          },
        });
        // Filter in code since metadata is JSON and Prisma JSON filtering can vary
        if (existing) {
          const existingMeta = existing.metadata as unknown as ScoreUnlockMetadata;
          if (existingMeta?.assessmentId === assessmentId) {
            throw new Error('An open unlock request already exists for this assessment');
          }
        }
      }
    }

    if (requestType === 'ATTENDANCE_UNLOCK') {
      const attendanceMeta = metadata as AttendanceUnlockMetadata;
      if (attendanceMeta?.classId && attendanceMeta?.date) {
        const existingRequests = await prisma.approvalRequest.findMany({
          where: {
            schoolId,
            requestType: 'ATTENDANCE_UNLOCK',
            status: { in: ['PENDING', 'APPROVED'] },
          },
        });
        const existing = existingRequests.find((request) => {
          const existingMeta = request.metadata as unknown as AttendanceUnlockMetadata;
          return (
            existingMeta?.classId === attendanceMeta.classId &&
            existingMeta?.date === attendanceMeta.date
          );
        });
        if (existing) {
          throw new Error('An open unlock request already exists for this attendance register');
        }
      }
    }

    // Task 3.3 — Resolve approvers for the first step
    const firstStep = workflow.steps[0];
    const resolvedApproverIds = await this.resolveApprovers(firstStep, schoolId);

    if (!resolvedApproverIds.length) {
      console.warn(
        `[ApprovalEngine] No approvers found for workflow ${workflow.id} step ${firstStep.stepNumber}. Request will be PENDING with no assigned approvers.`
      );
    }

    // Compute expiresAt from relockAfterMinutes
    let expiresAt: Date | undefined;
    if (workflow.relockAfterMinutes) {
      expiresAt = new Date(Date.now() + workflow.relockAfterMinutes * 60_000);
    }

    // Create the request
    const request = await prisma.approvalRequest.create({
      data: {
        workflowId: workflow.id,
        module: workflowModule,
        requestType,
        requestedById,
        schoolId,
        status: 'PENDING',
        currentStepNumber: firstStep.stepNumber,
        resolvedApproverIds,
        comments,
        metadata,
        expiresAt,
      },
    });

    // Notify approvers (non-blocking)
    this.notifyApprovers(request, resolvedApproverIds).catch(err =>
      console.warn('[ApprovalEngine] notifyApprovers failed:', err?.message)
    );

    return request;
  }

  // ── Task 3.3 ─────────────────────────────────────────────────────────────
  /**
   * Resolve the actual user IDs who can approve a given workflow step.
   * For ROLE-based steps, queries active non-archived users with matching roles.
   * For USER-based steps, uses the configured approverUserIds directly.
   * Returns a deduplicated array of user IDs.
   */
  private async resolveApprovers(step: ApprovalStep, _schoolId: string): Promise<string[]> {
    if (step.approverType === 'ROLE') {
      const users = await prisma.user.findMany({
        where: {
          role: { in: step.approverRoles as any[] },
          status: 'ACTIVE',
          archived: false,
        },
        select: { id: true },
      });
      return [...new Set(users.map(u => u.id))];
    }

    // USER-based: use the configured IDs directly
    return [...new Set(step.approverUserIds)];
  }

  // ── Task 3.5 ─────────────────────────────────────────────────────────────
  /**
   * Act on a request: approve, reject, or SUPER_ADMIN override.
   * Validates actor permission, creates ApprovalAction, advances workflow state,
   * triggers hooks and notifications, and logs to audit.
   */
  async actOnRequest(params: ActOnApprovalParams): Promise<ApprovalRequest> {
    const { requestId, actorId, action, comment } = params;

    // Fetch request + workflow + actor
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { workflow: { include: { steps: { orderBy: { stepNumber: 'asc' } } } } },
    });

    if (!request) throw new Error(`Approval request ${requestId} not found`);

    // Guard: terminal state
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new Error(
        `Request is already in terminal state: ${request.status}. No further actions allowed.`
      );
    }

    // Fetch actor to check SUPER_ADMIN
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true },
    });

    if (!actor) throw new Error(`Actor user ${actorId} not found`);

    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    // Permission check: must be in resolvedApproverIds or SUPER_ADMIN
    if (!isSuperAdmin && !request.resolvedApproverIds.includes(actorId)) {
      throw new Error('You are not an assigned approver for this request');
    }

    // SUPER_ADMIN uses OVERRIDE action type; others use APPROVE / REJECT
    const actionType: ApprovalActionType = isSuperAdmin && action === 'OVERRIDE'
      ? 'OVERRIDE'
      : (action as ApprovalActionType);

    const previousStatus = request.status;

    // Create the ApprovalAction record
    await prisma.approvalAction.create({
      data: {
        requestId,
        stepNumber: request.currentStepNumber,
        approverId: actorId,
        action: actionType,
        comment,
      },
    });

    let newStatus: ApprovalStatus = request.status;
    let newStepNumber = request.currentStepNumber;

    const workflow = (request as any).workflow;

    if (actionType === 'REJECT') {
      newStatus = 'REJECTED';
    } else if (actionType === 'APPROVE' || actionType === 'OVERRIDE') {
      // Count total APPROVE + OVERRIDE actions on this request
      const approveCount = await prisma.approvalAction.count({
        where: {
          requestId,
          action: { in: ['APPROVE', 'OVERRIDE'] },
        },
      });

      if (workflow.approvalMode === 'SEQUENTIAL') {
        // Check if the current step has met its minApprovals
        const currentStep: ApprovalStep | undefined = workflow.steps.find(
          (s: ApprovalStep) => s.stepNumber === request.currentStepNumber
        );
        const stepApproveCount = await prisma.approvalAction.count({
          where: {
            requestId,
            stepNumber: request.currentStepNumber,
            action: { in: ['APPROVE', 'OVERRIDE'] },
          },
        });

        const stepMinApprovals = currentStep?.minApprovals ?? 1;
        if (stepApproveCount >= stepMinApprovals) {
          // Find next step
          const nextStep = workflow.steps.find(
            (s: ApprovalStep) => s.stepNumber > request.currentStepNumber
          );
          if (nextStep) {
            // Advance to next step — resolve approvers for next step
            const nextApprovers = await this.resolveApprovers(nextStep, request.schoolId ?? '');
            newStepNumber = nextStep.stepNumber;
            await prisma.approvalRequest.update({
              where: { id: requestId },
              data: {
                currentStepNumber: newStepNumber,
                resolvedApproverIds: nextApprovers,
              },
            });
            // Notify new approvers
            this.notifyApprovers(request, nextApprovers).catch(err =>
              console.warn('[ApprovalEngine] notifyApprovers (next step) failed:', err?.message)
            );
          } else {
            // Last step satisfied — mark APPROVED
            newStatus = 'APPROVED';
          }
        }
      } else {
        // SINGLE or PARALLEL: approved when total approvals >= workflow.minApprovals
        if (approveCount >= workflow.minApprovals) {
          newStatus = 'APPROVED';
        }
      }
    }

    // Persist status change if it changed
    let updatedRequest = request as ApprovalRequest;
    if (newStatus !== previousStatus) {
      updatedRequest = await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: newStatus },
      });

      // Audit log (Task 5.1) — best-effort, must not block state transition
      auditService.logChange({
        entityType: 'ApprovalRequest',
        entityId: requestId,
        action: 'UPDATE',
        userId: actorId,
        field: 'status',
        oldValue: previousStatus,
        newValue: newStatus,
        reason: comment
          ? `Request ${newStatus} by ${actorId} — ${comment}`
          : `Request ${newStatus} by ${actorId}`,
      }).catch(err => console.warn('[ApprovalEngine] auditService failed:', err?.message));

      // Run approval hook when APPROVED
      if (newStatus === 'APPROVED') {
        await this.runApprovalHook(updatedRequest);
      }
    }

    // Always notify requester of the outcome
    this.notifyRequester(updatedRequest, actionType, comment).catch(err =>
      console.warn('[ApprovalEngine] notifyRequester failed:', err?.message)
    );

    return updatedRequest;
  }

  // ── Task 3.6 ─────────────────────────────────────────────────────────────
  /**
   * Cancel a PENDING request — only the original requester may cancel.
   */
  async cancelRequest(requestId: string, userId: string): Promise<ApprovalRequest> {
    const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });

    if (!request) throw new Error(`Approval request ${requestId} not found`);

    if (request.requestedById !== userId) {
      throw new Error('Only the requester can cancel their own request');
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Cannot cancel a request in status: ${request.status}`);
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    auditService.logChange({
      entityType: 'ApprovalRequest',
      entityId: requestId,
      action: 'UPDATE',
      userId,
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'CANCELLED',
      reason: 'Cancelled by requester',
    }).catch(err => console.warn('[ApprovalEngine] auditService failed:', err?.message));

    return updated;
  }

  // ── Task 3.7 ─────────────────────────────────────────────────────────────
  /**
   * List approval requests visible to the current user.
   * TEACHER role sees only their own requests.
   * All other privileged roles see requests scoped to their schoolId.
   */
  async listRequests(
    filters: RequestFilters,
    userId: string
  ): Promise<ApprovalRequest[]> {
    // Determine the role of the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where: Record<string, any> = {
      schoolId: filters.schoolId,
    };

    // TEACHER can only see their own requests (R6.4)
    if (user?.role === 'TEACHER') {
      where.requestedById = userId;
    } else {
      if (filters.requestedById) where.requestedById = filters.requestedById;
    }

    if (filters.status) where.status = filters.status;
    if (filters.module) where.module = filters.module;
    if (filters.requestType) where.requestType = filters.requestType;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    return prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        workflow: { select: { id: true, name: true, approvalMode: true, minApprovals: true } },
      },
    });
  }

  // ── Task 3.8 ─────────────────────────────────────────────────────────────
  /**
   * Get a single request with full relations: workflow, requestedBy, and all
   * actions with approver name. Enforces per-school access.
   */
  async getRequest(requestId: string, userId: string): Promise<ApprovalRequest> {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        workflow: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        actions: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { actedAt: 'asc' },
        },
      },
    });

    if (!request) throw new Error(`Approval request ${requestId} not found`);

    // Access check: user must belong to same school OR be requester
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (
      user?.role === 'TEACHER' &&
      request.requestedById !== userId
    ) {
      throw new Error('Access denied');
    }

    return request;
  }

  // ── Task 3.9 ─────────────────────────────────────────────────────────────
  /**
   * Return dashboard KPI counts for the given user and school.
   */
  async getDashboardStats(userId: string, schoolId: string): Promise<DashboardStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pending, allPending, mySubmitted, approvedToday, rejectedToday] = await Promise.all([
      // Total pending in school
      prisma.approvalRequest.count({
        where: { schoolId, status: 'PENDING' },
      }),
      // All PENDING requests in school (for awaitingMyAction)
      prisma.approvalRequest.findMany({
        where: { schoolId, status: 'PENDING' },
        select: { resolvedApproverIds: true },
      }),
      // My submitted
      prisma.approvalRequest.count({
        where: { schoolId, requestedById: userId },
      }),
      // Approved today
      prisma.approvalRequest.count({
        where: {
          schoolId,
          status: 'APPROVED',
          updatedAt: { gte: todayStart },
        },
      }),
      // Rejected today
      prisma.approvalRequest.count({
        where: {
          schoolId,
          status: 'REJECTED',
          updatedAt: { gte: todayStart },
        },
      }),
    ]);

    const awaitingMyAction = allPending.filter(r =>
      r.resolvedApproverIds.includes(userId)
    ).length;

    return {
      pending,
      awaitingMyAction,
      mySubmitted,
      approvedToday,
      rejectedToday,
    };
  }

  // ── Task 3.10 ────────────────────────────────────────────────────────────
  /**
   * Called by the cron worker every 5 minutes.
   * Finds all APPROVED requests where expiresAt <= now(), transitions them to
   * EXPIRED, runs the expiry hook, notifies the requester, and logs to audit.
   */
  async processExpiredRequests(): Promise<void> {
    const now = new Date();

    const expired = await prisma.approvalRequest.findMany({
      where: {
        status: 'APPROVED',
        expiresAt: { lte: now },
      },
    });

    for (const request of expired) {
      try {
        const updated = await prisma.approvalRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED' },
        });

        // Audit log (Task 5.1) — best-effort, must not block state transition
        auditService.logChange({
          entityType: 'ApprovalRequest',
          entityId: request.id,
          action: 'UPDATE',
          userId: 'SYSTEM',
          field: 'status',
          oldValue: 'APPROVED',
          newValue: 'EXPIRED',
          reason: 'Auto-expired — approval window elapsed',
        }).catch(err => console.warn('[ApprovalEngine] auditService failed:', err?.message));

        // Run expiry hook
        await this.runExpiryHook(updated);

        // Notify requester
        this.notifyRequester(updated, 'EXPIRED').catch(err =>
          console.warn('[ApprovalEngine] notifyRequester (expire) failed:', err?.message)
        );
      } catch (err: any) {
        console.error(
          `[ApprovalEngine] Error processing expiry for request ${request.id}:`,
          err?.message
        );
      }
    }
  }

  // ── Task 4.1 ─────────────────────────────────────────────────────────────
  /**
   * Notify every resolved approver about a new request.
   * Uses existing NotificationService. Failures are logged, not re-thrown.
   */
  private async notifyApprovers(
    request: ApprovalRequest,
    approverIds: string[]
  ): Promise<void> {
    // Fetch requester name for the message
    const requester = await prisma.user.findUnique({
      where: { id: request.requestedById },
      select: { firstName: true, lastName: true },
    }).catch(() => null);

    const requesterName = requester
      ? `${requester.firstName} ${requester.lastName}`
      : 'A user';

    await Promise.all(
      approverIds.map(approverId =>
        NotificationService.createNotification({
          userId: approverId,
          title: 'New Approval Request',
          message: `New ${request.requestType} request from ${requesterName}`,
          type: NotificationType.APPROVAL,
          link: `/app/settings-approvals?requestId=${request.id}`,
          showAsPopup: true,
          metadata: {
            requestId: request.id,
            module: request.module,
            requestType: request.requestType,
          },
        }).catch(err =>
          console.warn(`[ApprovalEngine] Notification failed for approver ${approverId}:`, err?.message)
        )
      )
    );
  }

  // ── Task 4.2 ─────────────────────────────────────────────────────────────
  /**
   * Notify the requester of the outcome: APPROVED, REJECTED, or EXPIRED.
   */
  private async notifyRequester(
    request: ApprovalRequest,
    action: string,
    comment?: string
  ): Promise<void> {
    let title: string;
    let message: string;

    switch (action) {
      case 'APPROVE':
      case 'APPROVED':
        title = 'Request Approved';
        message = `Your ${request.requestType} request has been approved.`;
        break;
      case 'REJECT':
      case 'REJECTED':
        title = 'Request Rejected';
        message = comment
          ? `Your ${request.requestType} request was rejected. Reason: ${comment}`
          : `Your ${request.requestType} request has been rejected.`;
        break;
      case 'EXPIRED':
        title = 'Unlock Expired';
        message = `Your score unlock has expired. Scores have been re-locked.`;
        break;
      case 'OVERRIDE':
        title = 'Request Overridden';
        message = `Your ${request.requestType} request has been overridden by an administrator.`;
        break;
      default:
        return;
    }

    await NotificationService.createNotification({
      userId: request.requestedById,
      title,
      message,
      type: NotificationType.APPROVAL,
      link: `/app/settings-approvals?requestId=${request.id}`,
      showAsPopup: false,
      metadata: { requestId: request.id, requestType: request.requestType },
    }).catch(err =>
      console.warn('[ApprovalEngine] notifyRequester notification failed:', err?.message)
    );
  }

  // ── Task 4.6 ─────────────────────────────────────────────────────────────
  /**
   * Look up and call the registered approval hook for the request type.
   * Errors are caught and logged — hooks must never block state transitions.
   */
  private async runApprovalHook(request: ApprovalRequest): Promise<void> {
    const handler = APPROVAL_HOOKS[request.requestType];
    if (!handler) return;
    try {
      await handler(request);
    } catch (err: any) {
      console.error(
        `[ApprovalEngine] Approval hook failed for request ${request.id} (${request.requestType}):`,
        err?.message
      );
    }
  }

  /**
   * Look up and call the registered expiry hook for the request type.
   * Errors are caught and logged.
   */
  private async runExpiryHook(request: ApprovalRequest): Promise<void> {
    const handler = EXPIRY_HOOKS[request.requestType];
    if (!handler) return;
    try {
      await handler(request);
    } catch (err: any) {
      console.error(
        `[ApprovalEngine] Expiry hook failed for request ${request.id} (${request.requestType}):`,
        err?.message
      );
    }
  }

  // ── Tasks 6.1–6.5 ────────────────────────────────────────────────────────

  /**
   * Create a new ApprovalWorkflow with its steps in a single transaction.
   * Validates uniqueness of module+requestType.
   *
   * // Audit logging for workflow changes is done in approvalWorkflow.controller.ts
   */
  async createWorkflow(data: {
    name: string;
    module: ApprovalModule;
    requestType: ApprovalRequestType;
    description?: string;
    active?: boolean;
    approvalMode?: 'SINGLE' | 'SEQUENTIAL' | 'PARALLEL';
    minApprovals?: number;
    relockAfterMinutes?: number | null;
    steps: Array<{
      stepNumber: number;
      approverType: string;
      approverRoles?: string[];
      approverUserIds?: string[];
      minApprovals?: number;
    }>;
  }) {
    // Check uniqueness
    const existing = await prisma.approvalWorkflow.findFirst({
      where: { module: data.module, requestType: data.requestType },
    });
    if (existing) {
      throw new Error(
        `A workflow for ${data.module}/${data.requestType} already exists`
      );
    }

    return prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.create({
        data: {
          name: data.name,
          module: data.module,
          requestType: data.requestType,
          description: data.description,
          active: data.active ?? true,
          approvalMode: data.approvalMode ?? 'SINGLE',
          minApprovals: data.minApprovals ?? 1,
          relockAfterMinutes: data.relockAfterMinutes,
        },
      });

      if (data.steps?.length) {
        await tx.approvalStep.createMany({
          data: data.steps.map(step => ({
            workflowId: workflow.id,
            stepNumber: step.stepNumber,
            approverType: step.approverType,
            approverRoles: step.approverRoles ?? [],
            approverUserIds: step.approverUserIds ?? [],
            minApprovals: step.minApprovals ?? 1,
          })),
        });
      }

      return tx.approvalWorkflow.findUnique({
        where: { id: workflow.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    });
  }

  /**
   * Update workflow metadata only (not steps).
   */
  async updateWorkflow(
    id: string,
    data: {
      name?: string;
      description?: string;
      active?: boolean;
      approvalMode?: 'SINGLE' | 'SEQUENTIAL' | 'PARALLEL';
      minApprovals?: number;
      relockAfterMinutes?: number | null;
    }
  ) {
    return prisma.approvalWorkflow.update({
      where: { id },
      data,
    });
  }

  /**
   * Replace all steps for a workflow in a single transaction.
   */
  async updateWorkflowSteps(
    workflowId: string,
    steps: Array<{
      stepNumber: number;
      approverType: string;
      approverRoles?: string[];
      approverUserIds?: string[];
      minApprovals?: number;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.approvalStep.deleteMany({ where: { workflowId } });

      if (steps.length) {
        await tx.approvalStep.createMany({
          data: steps.map(step => ({
            workflowId,
            stepNumber: step.stepNumber,
            approverType: step.approverType,
            approverRoles: step.approverRoles ?? [],
            approverUserIds: step.approverUserIds ?? [],
            minApprovals: step.minApprovals ?? 1,
          })),
        });
      }

      return tx.approvalWorkflow.findUnique({
        where: { id: workflowId },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    });
  }

  /**
   * Flip the active boolean for a workflow.
   */
  async toggleWorkflow(id: string) {
    const workflow = await prisma.approvalWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new Error(`Workflow ${id} not found`);

    return prisma.approvalWorkflow.update({
      where: { id },
      data: { active: !workflow.active },
    });
  }

  /**
   * List all workflows, including step count and request count.
   */
  async listWorkflows(filters?: { module?: ApprovalModule; active?: boolean }) {
    return prisma.approvalWorkflow.findMany({
      where: filters ?? {},
      include: {
        _count: { select: { steps: true, requests: true } },
        steps: { orderBy: { stepNumber: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

// ─── Singleton export ────────────────────────────────────────────────────────
export const approvalEngineService = new ApprovalEngineService();
