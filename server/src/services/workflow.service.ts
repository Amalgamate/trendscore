import { AssessmentStatus, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { auditService } from './audit.service';
import { SmsService } from './sms.service';
import { NotificationService, NotificationType } from './notification.service';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface WorkflowTransition {
  assessmentId: string;
  assessmentType: 'formative' | 'summative';
  userId: string;
  comments?: string;
  reason?: string;
}

interface WorkflowEvent {
  id: string;
  timestamp: Date;
  action: string;
  performedBy: string;
  performedByName: string;
  fromStatus: AssessmentStatus;
  toStatus: AssessmentStatus;
  comments?: string;
}

interface PendingApprovals {
  summative: any[];
  formative: any[];
  total: number;
}

// ============================================
// WORKFLOW CONFIGURATION
// ============================================

/**
 * Allowed state transitions
 * Defines which status can transition to which
 */
const WORKFLOW_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'DRAFT'], // Can approve or reject back to draft
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['LOCKED'],
  LOCKED: ['PUBLISHED'] // Only via admin unlock
};

/**
 * Roles allowed to perform each workflow action
 */
const WORKFLOW_PERMISSIONS: Record<string, UserRole[]> = {
  submit: ['TEACHER', 'HEAD_TEACHER', 'ADMIN', 'SUPER_ADMIN'],
  approve: ['HEAD_TEACHER', 'ADMIN', 'SUPER_ADMIN'],
  reject: ['HEAD_TEACHER', 'ADMIN', 'SUPER_ADMIN'],
  publish: ['ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'],
  lock: ['ADMIN', 'SUPER_ADMIN'],
  unlock: ['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']
};

// ============================================
// WORKFLOW SERVICE CLASS
// ============================================

export class WorkflowService {

  /**
   * Submit assessment for approval
   * Transition: DRAFT → SUBMITTED
   */
  async submitForApproval(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, comments } = params;

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate current status
    if (assessment.status !== 'DRAFT') {
      throw new Error(
        `Cannot submit assessment with status ${assessment.status}. Must be DRAFT.`
      );
    }

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.submit.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to submit assessments`
      );
    }

    // Validate assessment has data
    await this.validateAssessmentHasData(assessmentType, assessmentId);

    // Update status
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'SUBMITTED',
        submittedBy: userId,
        submittedAt: new Date()
      }
    );

    // Log workflow event
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'SUBMIT',
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      performedBy: userId,
      comments
    });

    // Notify approvers
    await this.notifyApprovers(assessment, user);

    return updated;
  }

  /**
   * Approve assessment
   * Transition: SUBMITTED → APPROVED
   */
  async approveAssessment(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, comments } = params;

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate current status
    if (assessment.status !== 'SUBMITTED') {
      throw new Error(
        `Cannot approve assessment with status ${assessment.status}. Must be SUBMITTED.`
      );
    }

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.approve.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to approve assessments`
      );
    }

    console.log(`Approving assessment ${assessmentId} by user ${userId}. Submitter: ${assessment.submittedBy}`);

    // Update status
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date()
      }
    );

    // Log workflow event
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'APPROVE',
      fromStatus: 'SUBMITTED',
      toStatus: 'APPROVED',
      performedBy: userId,
      comments
    });

    // Notify submitter
    await this.notifyApprovalStatus(assessment, user, 'approved');

    return updated;
  }

  /**
   * Reject assessment (send back to draft)
   * Transition: SUBMITTED → DRAFT
   */
  async rejectAssessment(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, reason } = params;

    if (!reason) {
      throw new Error('Rejection reason is required');
    }

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate current status
    if (assessment.status !== 'SUBMITTED') {
      throw new Error(
        `Cannot reject assessment with status ${assessment.status}. Must be SUBMITTED.`
      );
    }

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.reject.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to reject assessments`
      );
    }

    // Update status back to DRAFT
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'DRAFT',
        // Clear submission data
        submittedBy: null,
        submittedAt: null
      }
    );

    // Log workflow event
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'REJECT',
      fromStatus: 'SUBMITTED',
      toStatus: 'DRAFT',
      performedBy: userId,
      comments: reason
    });

    // Notify submitter
    await this.notifyApprovalStatus(assessment, user, 'rejected', reason);

    return updated;
  }

  /**
   * Publish assessment (make visible to students/parents)
   * Transition: APPROVED → PUBLISHED
   */
  async publishAssessment(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, comments } = params;

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate current status
    if (assessment.status !== 'APPROVED') {
      throw new Error(
        `Cannot publish assessment with status ${assessment.status}. Must be APPROVED.`
      );
    }

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.publish.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to publish assessments`
      );
    }

    // Update status
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'PUBLISHED',
        published: true, // Keep for backward compatibility
        publishedAt: new Date()
      }
    );

    // Log workflow event
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'PUBLISH',
      fromStatus: 'APPROVED',
      toStatus: 'PUBLISHED',
      performedBy: userId,
      comments
    });

    // Trigger SMS notification for summative tests
    if (assessmentType === 'summative') {
      this.triggerSmsNotification(assessmentId, userId).catch(err => {
        console.error(`[WorkflowService] SMS notification background task failed: ${err.message}`);
      });
    }

    return updated;
  }

  /**
   * Lock assessment (prevent all further edits)
   * Transition: PUBLISHED → LOCKED
   * Typically done at end of term
   */
  async lockAssessment(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, reason } = params;

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate current status
    if (assessment.status !== 'PUBLISHED') {
      throw new Error(
        `Cannot lock assessment with status ${assessment.status}. Must be PUBLISHED.`
      );
    }

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.lock.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to lock assessments`
      );
    }

    // Update status
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'LOCKED',
        locked: true,
        lockedAt: new Date(),
        lockedBy: userId
      }
    );

    // Log workflow event
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'LOCK',
      fromStatus: 'PUBLISHED',
      toStatus: 'LOCKED',
      performedBy: userId,
      comments: reason
    });

    return updated;
  }

  /**
   * Unlock assessment (admin emergency action)
   * Transition: LOCKED → PUBLISHED
   * Requires strong reason and admin role
   */
  async unlockAssessment(params: WorkflowTransition): Promise<any> {
    const { assessmentId, assessmentType, userId, reason } = params;

    if (!reason || reason.length < 10) {
      throw new Error('Detailed reason (minimum 10 characters) required for unlocking');
    }

    // Get current assessment
    const assessment = await this.getAssessment(assessmentType, assessmentId);

    // Validate: accept status LOCKED OR the locked flag being true (older records set only the flag)
    const isLocked = assessment.status === 'LOCKED' || assessment.locked === true;
    if (!isLocked) {
      throw new Error(
        `Cannot unlock assessment with status ${assessment.status}. Assessment must be locked.`
      );
    }

    // Check user permission (ADMIN, SUPER_ADMIN, or HEAD_TEACHER)
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.unlock.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to unlock assessments. Admin or Head Teacher role required.`
      );
    }

    const fromStatus = assessment.status as AssessmentStatus;

    // Update status back to PUBLISHED and clear lock fields
    const updated = await this.updateAssessmentStatus(
      assessmentType,
      assessmentId,
      {
        status: 'PUBLISHED',
        locked: false,
        lockedAt: null,
        lockedBy: null
      }
    );

    // Log workflow event (HIGH PRIORITY)
    await this.logWorkflowEvent({
      assessmentId,
      assessmentType,
      action: 'UNLOCK',
      fromStatus,
      toStatus: 'PUBLISHED',
      performedBy: userId,
      comments: `EMERGENCY UNLOCK: ${reason}`
    });

    return updated;
  }

  /**
   * Get workflow history for an assessment
   * Shows all status changes with timestamps and actors
   */
  async getWorkflowHistory(
    assessmentId: string,
    assessmentType: 'formative' | 'summative'
  ): Promise<WorkflowEvent[]> {
    const events = await prisma.changeHistory.findMany({
      where: {
        entityType: assessmentType === 'formative' ? 'FormativeAssessment' : 'SummativeTest',
        entityId: assessmentId,
        field: 'status'
      },
      include: {
        changer: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        changedAt: 'desc'
      }
    });

    return events.map(event => ({
      id: event.id,
      timestamp: event.changedAt,
      action: event.action,
      performedBy: event.changedBy,
      performedByName: `${event.changer.firstName} ${event.changer.lastName}`,
      fromStatus: (event.oldValue as AssessmentStatus) || 'DRAFT',
      toStatus: event.newValue as AssessmentStatus,
      comments: event.reason || undefined
    }));
  }

  /**
   * Bulk submit assessments for approval
   * Transition: DRAFT → SUBMITTED
   */
  async submitAssessmentsBulk(params: {
    ids: string[];
    assessmentType: 'formative' | 'summative';
    userId: string;
    comments?: string;
  }): Promise<{ submitted: number; errors: string[] }> {
    const { ids, assessmentType, userId, comments } = params;

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.submit.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to submit assessments`
      );
    }

    let submitted = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.submitForApproval({
          assessmentId: id,
          assessmentType,
          userId,
          comments
        });
        submitted++;
      } catch (error: any) {
        errors.push(`ID ${id}: ${error.message}`);
      }
    }

    return { submitted, errors };
  }

  /**
   * Get pending approvals for a user
   * Returns assessments awaiting their approval based on their role
   */
  async getPendingApprovals(userId: string): Promise<PendingApprovals> {
    const user = await this.getUser(userId);

    // Only approvers can see pending approvals
    if (!WORKFLOW_PERMISSIONS.approve.includes(user.role)) {
      return {
        summative: [],
        formative: [],
        total: 0
      };
    }

    // Get pending summative tests
    const summativeTests = await prisma.summativeTest.findMany({
      where: {
        status: 'SUBMITTED',
        // Don't show user their own submissions
        submittedBy: {
          not: userId
        }
      },
      include: {
        submittedByUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        results: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    });

    // Get pending formative assessments (if they have status field)
    const formativeAssessments = await prisma.formativeAssessment.findMany({
      where: {
        status: 'SUBMITTED'
      },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        learner: {
          select: {
            firstName: true,
            lastName: true,
            admissionNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 50 // Limit to prevent overwhelming
    });

    return {
      summative: summativeTests.map(test => ({
        ...test,
        submittedByName: `${test.submittedByUser?.firstName} ${test.submittedByUser?.lastName}`,
        resultCount: test.results.length
      })),
      formative: formativeAssessments.map(assessment => ({
        ...assessment,
        teacherName: `${assessment.teacher.firstName} ${assessment.teacher.lastName}`,
        learnerName: `${assessment.learner.firstName} ${assessment.learner.lastName}`
      })),
      total: summativeTests.length + formativeAssessments.length
    };
  }

  /**
   * Bulk approve assessments
   * Transition: SUBMITTED → APPROVED
   */
  async approveAssessmentsBulk(params: {
    ids: string[];
    assessmentType: 'formative' | 'summative';
    userId: string;
    comments?: string;
  }): Promise<{ approved: number; errors: string[] }> {
    const { ids, assessmentType, userId, comments } = params;

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.approve.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to approve assessments`
      );
    }

    let approved = 0;
    const errors: string[] = [];

    // Process each assessment
    // Note: Individual processing ensures all side effects like statusHistory and audit logs are correct
    for (const id of ids) {
      try {
        await this.approveAssessment({
          assessmentId: id,
          assessmentType,
          userId,
          comments
        });
        approved++;
      } catch (error: any) {
        errors.push(`ID ${id}: ${error.message}`);
      }
    }

    return { approved, errors };
  }

  /**
   * Bulk lock all assessments for a term
   * Used at end of term to lock everything at once
   */
  async bulkLockTermAssessments(params: {
    term: string;
    academicYear: number;
    userId: string;
    reason: string;
  }): Promise<{ locked: number; errors: string[] }> {
    const { term, academicYear, userId, reason } = params;

    // Check user permission
    const user = await this.getUser(userId);
    if (!WORKFLOW_PERMISSIONS.lock.includes(user.role)) {
      throw new Error(
        `Role ${user.role} is not permitted to lock assessments`
      );
    }

    let locked = 0;
    const errors: string[] = [];

    // Lock all published summative tests
    try {
      const result = await prisma.summativeTest.updateMany({
        where: {
          term: term as any,
          academicYear,
          status: 'PUBLISHED'
        },
        data: {
          status: 'LOCKED',
          locked: true,
          lockedAt: new Date()
        }
      });

      locked += result.count;

      // Log bulk action
      await auditService.logChange({
        entityType: 'SummativeTest',
        entityId: 'BULK',
        action: 'UPDATE',
        userId,
        field: 'status',
        oldValue: 'PUBLISHED',
        newValue: 'LOCKED',
        reason: `BULK LOCK: ${reason}`
      });
    } catch (error: any) {
      errors.push(`Summative tests: ${error.message}`);
    }

    return { locked, errors };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get assessment by type
   */
  private async getAssessment(
    type: 'formative' | 'summative',
    id: string
  ): Promise<any> {
    if (type === 'summative') {
      const test = await prisma.summativeTest.findUnique({
        where: { id },
        include: {
          submittedByUser: { select: { id: true, firstName: true, lastName: true } },
          approvedByUser: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      if (!test) {
        throw new Error(`Summative test ${id} not found`);
      }

      return test;
    } else {
      const assessment = await prisma.formativeAssessment.findUnique({
        where: { id },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          learner: {
            select: {
              id: true
            }
          }
        }
      });

      if (!assessment) {
        throw new Error(`Formative assessment ${id} not found`);
      }

      return assessment;
    }
  }

  /**
   * Get user by ID
   */
  private async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, role: true, email: true }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return user;
  }

  /**
   * Update assessment status
   */
  private async updateAssessmentStatus(
    type: 'formative' | 'summative',
    id: string,
    data: any
  ): Promise<any> {
    // Add to status history
    const statusHistory = {
      timestamp: new Date(),
      status: data.status,
      by: data.submittedBy || data.approvedBy || data.lockedBy
    };

    if (type === 'summative') {
      return await prisma.summativeTest.update({
        where: { id },
        data: {
          ...data,
          statusHistory: {
            push: statusHistory as any
          }
        }
      });
    } else {
      return await prisma.formativeAssessment.update({
        where: { id },
        data
      });
    }
  }

  /**
   * Log workflow event to audit trail
   */
  private async logWorkflowEvent(params: {
    assessmentId: string;
    assessmentType: string;
    action: string;
    fromStatus: AssessmentStatus;
    toStatus: AssessmentStatus;
    performedBy: string;
    comments?: string;
  }) {
    await auditService.logChange({
      entityType: params.assessmentType === 'formative' ? 'FormativeAssessment' : 'SummativeTest',
      entityId: params.assessmentId,
      action: 'UPDATE',
      userId: params.performedBy,
      field: 'status',
      oldValue: params.fromStatus,
      newValue: params.toStatus,
      reason: params.comments || `Workflow action: ${params.action}`
    });
  }

  /**
   * Validate assessment has data before submission
   */
  private async validateAssessmentHasData(
    type: 'formative' | 'summative',
    id: string
  ): Promise<void> {
    if (type === 'summative') {
      // Check if test has results
      const resultCount = await prisma.summativeResult.count({
        where: { testId: id }
      });

      if (resultCount === 0) {
        // Warning log instead of error - allow empty submission for test approval workflow
        console.warn(`Submitting summative test ${id} with 0 results. This is expected for initial test definition approval.`);
      }
    }
    // Formative assessments always have data if they exist
  }

  /**
   * Notify approvers of pending submission
   */
  private async notifyApprovers(assessment: any, submitter: any): Promise<void> {
    const approvers = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: WORKFLOW_PERMISSIONS.approve as any } },
          { roles: { hasSome: WORKFLOW_PERMISSIONS.approve as any } },
        ],
        status: 'ACTIVE',
        archived: false,
        id: { not: submitter.id },
      },
      select: { id: true },
    });

    const assessmentType = this.getAssessmentTypeLabel(assessment);
    const title = `${assessmentType} approval needed`;
    const message = `${submitter.firstName} ${submitter.lastName} submitted "${this.getAssessmentTitle(assessment)}" for approval.`;

    await Promise.all(
      approvers.map((approver) =>
        NotificationService.createNotification({
          userId: approver.id,
          title,
          message,
          type: NotificationType.APPROVAL,
          link: this.getAssessmentLink(assessment),
          showAsPopup: true,
          metadata: {
            kind: 'ASSESSMENT_WORKFLOW_APPROVAL',
            assessmentId: assessment.id,
            assessmentType: this.getAssessmentKind(assessment),
            submittedBy: submitter.id,
          },
        }).catch((err) =>
          console.warn(`[WorkflowService] Approval notification failed for ${approver.id}:`, err?.message)
        )
      )
    );
  }

  /**
   * Notify submitter of approval status
   */
  private async notifyApprovalStatus(
    assessment: any,
    approver: any,
    status: 'approved' | 'rejected',
    reason?: string
  ): Promise<void> {
    const recipientId = assessment.submittedBy || assessment.teacherId || assessment.createdBy;
    if (!recipientId || recipientId === approver.id) return;

    const approved = status === 'approved';
    const assessmentType = this.getAssessmentTypeLabel(assessment);
    const title = `${assessmentType} ${approved ? 'approved' : 'rejected'}`;
    const message = approved
      ? `${approver.firstName} ${approver.lastName} approved "${this.getAssessmentTitle(assessment)}".`
      : `${approver.firstName} ${approver.lastName} rejected "${this.getAssessmentTitle(assessment)}"${reason ? `: ${reason}` : '.'}`;

    await NotificationService.createNotification({
      userId: recipientId,
      title,
      message,
      type: approved ? NotificationType.SUCCESS : NotificationType.WARNING,
      link: this.getAssessmentLink(assessment),
      showAsPopup: false,
      metadata: {
        kind: 'ASSESSMENT_WORKFLOW_OUTCOME',
        assessmentId: assessment.id,
        assessmentType: this.getAssessmentKind(assessment),
        status,
        approverId: approver.id,
      },
    }).catch((err) =>
      console.warn('[WorkflowService] Approval outcome notification failed:', err?.message)
    );
  }

  private getAssessmentTitle(assessment: any): string {
    return assessment.title || assessment.learningArea || `Assessment ${assessment.id}`;
  }

  private getAssessmentTypeLabel(assessment: any): string {
    return this.getAssessmentKind(assessment) === 'summative' ? 'Summative test' : 'Formative assessment';
  }

  private getAssessmentLink(assessment: any): string {
    return this.getAssessmentKind(assessment) === 'summative'
      ? `/app/assess-summative-tests?testId=${assessment.id}`
      : `/app/assess-formative?assessmentId=${assessment.id}`;
  }

  private getAssessmentKind(assessment: any): 'formative' | 'summative' {
    return assessment.totalMarks !== undefined || assessment.testDate !== undefined
      ? 'summative'
      : 'formative';
  }

  /**
   * Background task to trigger SMS notifications for a published test
   */
  private async triggerSmsNotification(testId: string, performedBy: string): Promise<void> {
    try {
      console.log(`[WorkflowService] Triggering SMS notifications for test ${testId}`);

      // 1. Get test with results and learner parent info
      const test = await prisma.summativeTest.findUnique({
        where: { id: testId },
        include: {
          results: {
            include: {
              learner: {
                include: {
                  parent: true
                }
              }
            }
          }
        }
      });

      if (!test || !test.results || test.results.length === 0) {
        console.log(`[WorkflowService] No results found for test ${testId}, skipping notifications`);
        return;
      }

      const notificationPromises = test.results.map(async (result) => {
        const learner = result.learner;
        const parent = (learner as any)?.parent;

        if (!parent || !parent.phone) {
          return;
        }

        return SmsService.sendAssessmentReport({
          learnerId: learner.id,
          learnerName: `${learner.firstName} ${learner.lastName}`,
          learnerGrade: learner.grade,
          parentPhone: parent.phone,
          parentName: `${parent.firstName} ${parent.lastName}`,
          term: test.term as string,
          totalTests: 1,
          sentByUserId: performedBy
        });
      });

      const results = await Promise.all(notificationPromises);
      const successful = results.filter(r => r && r.success).length;
      console.log(`[WorkflowService] SMS notifications sent: ${successful}/${results.length}`);

    } catch (error: any) {
      console.error(`[WorkflowService] Failed to trigger SMS notifications: ${error.message}`);
    }
  }
}
export const workflowService = new WorkflowService();
