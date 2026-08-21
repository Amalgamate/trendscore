/**
 * LMSAssignmentService
 *
 * Manages the full assignment lifecycle: CRUD, publishing, submissions,
 * and marking. All operations are school-scoped (multi-tenant safe).
 *
 * Requirements: 3.1, 3.9, 3.10, 4.1, 4.6, 4.7, 4.9, 4.10, 5.1, 5.2, 5.5, 17.4
 *
 * @module services/lms-assignment.service
 */

import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';
import { LMSSettingsService } from './lms-settings.service';
import { LMSNotificationService } from './lms-notification.service';
import { LMSAchievementsService } from './lms-achievements.service';
import { auditService } from './audit.service';
import { documentService } from './document.service';
import { parentAccessService } from './parent-access.service';
import { ApiError } from '../utils/error.util';
import { resolveStudentLearnerForUser } from './student-account-link.service';
import type {
  LearningAssignment,
  LearningSubmission,
  AssignmentCategory,
  AssignmentStatus,
  SubmissionStatus,
  RubricRating,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

// ─── Cache helpers ────────────────────────────────────────────────────────────

/** Invalidate the analytics overview cache for a school (wildcard prefix). */
async function invalidateAnalyticsCache(schoolId: string): Promise<void> {
  await redisCacheService.deleteByPrefix(`lms:analytics:overview:${schoolId}:`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateAssignmentInput {
  title: string;
  classId: string;
  learningAreaId: string;
  termId: string;
  category: AssignmentCategory;
  schoolId: string;
  streamId?: string;
  instructions?: string;
  dueDate?: Date;
  estimatedMins?: number;
  totalMarks?: number;
  passMark?: number;
  rubric?: object;
  questions?: object[];
  cbcOutcomes?: string[];
  allowLateSubmit?: boolean;
  allowResubmit?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  gradebookSync?: boolean;
}

export type UpdateAssignmentInput = Partial<
  Omit<CreateAssignmentInput, 'schoolId' | 'category'>
> & { category?: AssignmentCategory };

export interface AssignmentFilters {
  classId?: string;
  learningAreaId?: string;
  termId?: string;
  status?: AssignmentStatus;
  category?: AssignmentCategory;
  /** Filter the list down to a single assignment by id. */
  assignmentId?: string;
  /**
   * Restrict results to assignments visible to these learners' classes.
   * Primarily used by the PARENT role branch (own children only), but any
   * caller may narrow further by supplying a subset of learner ids.
   */
  learnerIds?: string[];
  page?: number;
  limit?: number;
}

const hideQuestionAnswers = <T extends { questions?: unknown }>(assignment: T): T => {
  if (!Array.isArray(assignment.questions)) return assignment;
  return {
    ...assignment,
    questions: assignment.questions.map((question: any) => {
      const { correctAnswer: _correctAnswer, explanation: _explanation, ...studentQuestion } = question || {};
      return studentQuestion;
    }),
  };
};

const FINAL_SUBMISSION_STATUSES: SubmissionStatus[] = ['SUBMITTED', 'LATE', 'MARKED', 'RESUBMITTED'];

const summarizeSubmission = (submission: { status: SubmissionStatus } | null, isOverdue: boolean) => {
  if (!submission) return isOverdue ? 'MISSING' : 'NOT_STARTED';
  switch (submission.status) {
    case 'DRAFT': return 'IN_PROGRESS';
    case 'LATE': return 'LATE';
    case 'MARKED': return 'MARKED';
    case 'RETURNED': return 'RETURNED';
    case 'RESUBMITTED': return 'RESUBMITTED';
    default: return 'SUBMITTED';
  }
};

async function fetchAssignmentsForLearner(learnerId: string, schoolId: string): Promise<any[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { learnerId, active: true, archived: false },
    select: { classId: true },
  });
  const classIds = [...new Set(enrollments.map((enrollment) => enrollment.classId))];
  if (classIds.length === 0) {
    throw new ApiError(409, 'No active class enrollment is linked to this student')
      .withCode('LMS_STUDENT_CLASS_NOT_LINKED');
  }

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      schoolId,
      classId: { in: classIds },
      status: { in: ['PUBLISHED', 'CLOSED'] },
      archived: false,
    },
    include: {
      learningArea: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      submissions: {
        where: { learnerId, archived: false },
        select: {
          id: true,
          status: true,
          marks: true,
          submittedAt: true,
          markedAt: true,
          attemptNumber: true,
          feedback: true,
          rubricScores: true,
          updatedAt: true,
        },
        orderBy: { attemptNumber: 'desc' },
        take: 1,
      },
      _count: { select: { submissions: true, files: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { publishedAt: 'desc' }],
  });

  const now = new Date();
  return assignments.map((assignment) => {
    const submission = assignment.submissions[0] ?? null;
    const hasTurnedIn = submission ? FINAL_SUBMISSION_STATUSES.includes(submission.status) : false;
    const isOverdue = !hasTurnedIn && (
      assignment.status === 'CLOSED' || Boolean(assignment.dueDate && assignment.dueDate < now)
    );
    return {
      ...hideQuestionAnswers(assignment),
      mySubmission: submission,
      submissions: undefined,
      statusSummary: summarizeSubmission(submission, isOverdue),
      isOverdue,
      canSubmit: assignment.status === 'PUBLISHED' && (!isOverdue || assignment.allowLateSubmit),
    };
  });
}

export interface SubmissionFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CreateSubmissionInput {
  content?: string;
  status?: 'DRAFT' | 'SUBMITTED';
  questionResponses?: unknown;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSAssignmentService {
  static async getAssignmentsForLearner(learnerId: string, schoolId: string): Promise<any[]> {
    return fetchAssignmentsForLearner(learnerId, schoolId);
  }

  private static readonly OVERSIGHT_ROLES = new Set([
    'SUPER_ADMIN',
    'ADMIN',
    'HEAD_TEACHER',
    'HEAD_OF_CURRICULUM',
  ]);

  private static hasOversight(role: string): boolean {
    return LMSAssignmentService.OVERSIGHT_ROLES.has(String(role).toUpperCase());
  }

  /**
   * Teachers may issue work only for a class/learning-area combination that is
   * present in their timetable, explicit subject workload, or homeroom class.
   * Leadership roles are intentionally allowed to manage the whole school.
   */
  private static async assertTeacherWorkload(
    teacherId: string,
    role: string,
    schoolId: string,
    classId: string,
    learningAreaId: string,
  ): Promise<void> {
    if (LMSAssignmentService.hasOversight(role)) return;

    const targetClass = await prisma.class.findFirst({
      where: { id: classId, active: true, archived: false },
      select: { id: true, grade: true, teacherId: true },
    });

    if (!targetClass) {
      throw new ApiError(422, 'The selected class is not active or does not exist')
        .withCode('LMS_ASSIGNMENT_CLASS_INVALID');
    }

    const [scheduled, subjectAssigned] = await Promise.all([
      prisma.classSchedule.findFirst({
        where: {
          classId,
          learningAreaId,
          teacherId,
          active: true,
          archived: false,
        },
        select: { id: true },
      }),
      prisma.subjectAssignment.findFirst({
        where: {
          teacherId,
          learningAreaId,
          grade: targetClass.grade,
          active: true,
        },
        select: { id: true },
      }),
    ]);

    if (!scheduled && !subjectAssigned && targetClass.teacherId !== teacherId) {
      throw new ApiError(403, 'You are not assigned to teach this learning area for the selected class')
        .withCode('LMS_ASSIGNMENT_OUTSIDE_WORKLOAD');
    }
  }

  private static async assertCanManageAssignment(
    id: string,
    schoolId: string,
    requesterId: string,
    role: string,
  ): Promise<LearningAssignment> {
    const assignment = await prisma.learningAssignment.findFirst({
      where: { id, schoolId, archived: false },
    });

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    if (!LMSAssignmentService.hasOversight(role) && assignment.createdById !== requesterId) {
      throw new ApiError(403, 'You can only manage assignments you created')
        .withCode('LMS_ASSIGNMENT_NOT_OWNER');
    }

    return assignment;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 8.1 — CRUD and Publishing
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new assignment in DRAFT status.
   * Validates required fields: title, classId, learningAreaId, termId, category.
   * Requirements: 3.1
   */
  static async createAssignment(
    data: CreateAssignmentInput,
    teacherId: string,
    role: string,
  ): Promise<LearningAssignment> {
    const { title, classId, learningAreaId, termId, category, schoolId } = data;

    if (!title || !classId || !learningAreaId || !termId || !category) {
      throw new ApiError(422, 'Missing required fields: title, classId, learningAreaId, termId, category');
    }

    // The assignment builder submits HTML number inputs as strings (and empty
    // optional fields as ""). Prisma rejects those values for Int columns,
    // which previously surfaced to users as an unhelpful 500 error.
    const optionalInteger = (value: unknown, field: string): number | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new ApiError(422, `${field} must be a non-negative whole number`);
      }
      return parsed;
    };

    const optionalDate = (value: unknown): Date | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(422, 'Due date is invalid');
      }
      return parsed;
    };

    const maxFileSize = optionalInteger(data.maxFileSize, 'Maximum file size');

    await LMSAssignmentService.assertTeacherWorkload(
      teacherId,
      role,
      schoolId,
      classId,
      learningAreaId,
    );

    const created = await prisma.learningAssignment.create({
      data: {
        title,
        classId,
        learningAreaId,
        termId,
        category,
        schoolId,
        createdById: teacherId,
        status: 'DRAFT',
        streamId: data.streamId,
        instructions: data.instructions,
        dueDate: optionalDate(data.dueDate),
        estimatedMins: optionalInteger(data.estimatedMins, 'Estimated minutes'),
        totalMarks: optionalInteger(data.totalMarks, 'Total marks'),
        passMark: optionalInteger(data.passMark, 'Pass mark'),
        rubric: data.rubric ?? undefined,
        questions: data.questions ?? undefined,
        cbcOutcomes: data.cbcOutcomes ?? [],
        allowLateSubmit: data.allowLateSubmit ?? true,
        allowResubmit: data.allowResubmit ?? false,
        maxFileSize: maxFileSize ?? 25,
        allowedFileTypes: data.allowedFileTypes ?? [],
        gradebookSync: data.gradebookSync ?? false,
      },
    });
    void auditService.logChange({
      entityType: 'LearningAssignment',
      entityId: created.id,
      action: 'CREATE',
      userId: teacherId,
      field: 'status',
      oldValue: undefined,
      newValue: 'DRAFT',
      reason: 'ASSIGNMENT_CREATED',
    }).catch(() => undefined);
    return created;
  }

  /**
   * Partially update an assignment.
   * Always enforces schoolId for tenant isolation.
   * Does not allow updating status or createdById.
   * Requirements: 3.9
   */
  static async updateAssignment(
    id: string,
    schoolId: string,
    data: UpdateAssignmentInput,
    requesterId: string,
    role: string,
  ): Promise<LearningAssignment> {
    const existing = await LMSAssignmentService.assertCanManageAssignment(
      id,
      schoolId,
      requesterId,
      role,
    );

    // Build safe update — exclude status and createdById
    const { title, classId, learningAreaId, termId, category, streamId,
            instructions, dueDate, estimatedMins, totalMarks, passMark,
            rubric, questions, cbcOutcomes, allowLateSubmit, allowResubmit,
            maxFileSize, allowedFileTypes, gradebookSync } = data;

    const nextClassId = classId ?? existing.classId;
    const nextLearningAreaId = learningAreaId ?? existing.learningAreaId;

    // Update payloads arrive from HTML controls as strings. Keep updates on
    // the same normalization contract as creates so Prisma never receives a
    // date-only string or numeric text for typed columns.
    const optionalInteger = (value: unknown, field: string): number | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new ApiError(422, `${field} must be a non-negative whole number`);
      }
      return parsed;
    };

    const optionalDate = (value: unknown): Date | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(422, 'Due date is invalid');
      }
      return parsed;
    };

    await LMSAssignmentService.assertTeacherWorkload(
      requesterId,
      role,
      schoolId,
      nextClassId,
      nextLearningAreaId,
    );

    if (questions !== undefined && JSON.stringify(questions) !== JSON.stringify(existing.questions)) {
      const startedSubmissions = await prisma.learningSubmission.count({
        where: { assignmentId: id, status: { not: 'DRAFT' } },
      });
      if (startedSubmissions > 0) {
        throw new ApiError(409, 'Questions cannot be changed after students begin submitting. Duplicate the assignment to create a new version.')
          .withCode('LMS_ASSIGNMENT_QUESTIONS_LOCKED');
      }
    }

    const updated = await prisma.learningAssignment.update({
      where: { id, schoolId },
      data: {
        ...(title !== undefined && { title }),
        ...(classId !== undefined && { classId }),
        ...(learningAreaId !== undefined && { learningAreaId }),
        ...(termId !== undefined && { termId }),
        ...(category !== undefined && { category }),
        ...(streamId !== undefined && { streamId }),
        ...(instructions !== undefined && { instructions }),
        ...(dueDate !== undefined && { dueDate: optionalDate(dueDate) }),
        ...(estimatedMins !== undefined && { estimatedMins: optionalInteger(estimatedMins, 'Estimated minutes') }),
        ...(totalMarks !== undefined && { totalMarks: optionalInteger(totalMarks, 'Total marks') }),
        ...(passMark !== undefined && { passMark: optionalInteger(passMark, 'Pass mark') }),
        ...(rubric !== undefined && { rubric }),
        ...(questions !== undefined && { questions }),
        ...(cbcOutcomes !== undefined && { cbcOutcomes }),
        ...(allowLateSubmit !== undefined && { allowLateSubmit }),
        ...(allowResubmit !== undefined && { allowResubmit }),
        ...(maxFileSize !== undefined && { maxFileSize: optionalInteger(maxFileSize, 'Maximum file size') }),
        ...(allowedFileTypes !== undefined && { allowedFileTypes }),
        ...(gradebookSync !== undefined && { gradebookSync }),
      },
    });
    void auditService.logChange({
      entityType: 'LearningAssignment',
      entityId: id,
      action: 'UPDATE',
      userId: requesterId,
      field: 'assignment',
      oldValue: 'EXISTING',
      newValue: 'UPDATED',
      reason: 'ASSIGNMENT_UPDATED',
    }).catch(() => undefined);
    return updated;
  }

  /**
   * Publish an assignment.
   * Validates presence of title, classId, learningAreaId, dueDate.
   * Sets status=PUBLISHED and publishedAt=now().
   * Fires notifications and audit log; invalidates analytics cache.
   * Requirements: 3.10
   */
  static async publishAssignment(
    id: string,
    schoolId: string,
    teacherId: string,
    role: string,
  ): Promise<LearningAssignment> {
    const assignment = await LMSAssignmentService.assertCanManageAssignment(
      id,
      schoolId,
      teacherId,
      role,
    );

    await LMSAssignmentService.assertTeacherWorkload(
      teacherId,
      role,
      schoolId,
      assignment.classId,
      assignment.learningAreaId,
    );

    if (!assignment.title || !assignment.classId || !assignment.learningAreaId || !assignment.dueDate) {
      throw new ApiError(422, 'Assignment must have title, classId, learningAreaId, and dueDate before publishing');
    }

    const questions = Array.isArray(assignment.questions) ? assignment.questions as any[] : [];
    for (const [index, question] of questions.entries()) {
      if (!question?.id || !String(question.prompt || '').trim() || !(Number(question.marks) > 0)) {
        throw new ApiError(422, `Question ${index + 1} needs question text and marks before publishing`)
          .withCode('LMS_ASSIGNMENT_QUESTION_INVALID');
      }
      if (question.type !== 'ESSAY' && (question.correctAnswer === '' || question.correctAnswer === undefined)) {
        throw new ApiError(422, `Question ${index + 1} needs a correct answer before publishing`)
          .withCode('LMS_ASSIGNMENT_QUESTION_ANSWER_REQUIRED');
      }
    }
    if (questions.length > 0) {
      const questionMarks = questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
      if (assignment.totalMarks !== questionMarks) {
        throw new ApiError(422, `Total marks must equal the question total (${questionMarks}) before publishing`)
          .withCode('LMS_ASSIGNMENT_MARKS_MISMATCH');
      }
    }

    const published = await prisma.learningAssignment.update({
      where: { id, schoolId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Fire-and-forget: notification and audit
    void LMSNotificationService.onAssignmentPublished(published).catch((err: any) =>
      console.error('[LMSAssignmentService] publishAssignment notification error:', err?.message),
    );

    void auditService.logChange({
      entityType: 'LearningAssignment',
      entityId: id,
      action: 'UPDATE',
      userId: teacherId,
      field: 'status',
      oldValue: assignment.status,
      newValue: 'PUBLISHED',
      reason: 'ASSIGNMENT_PUBLISHED',
    }).catch(() => undefined);

    await invalidateAnalyticsCache(schoolId);

    return published;
  }

  /**
   * Close an assignment (status=CLOSED).
   */
  static async closeAssignment(
    id: string,
    schoolId: string,
    requesterId: string,
    role: string,
  ): Promise<LearningAssignment> {
    await LMSAssignmentService.assertCanManageAssignment(id, schoolId, requesterId, role);
    const closed = await prisma.learningAssignment.update({
      where: { id, schoolId },
      data: { status: 'CLOSED' },
    });
    void auditService.logChange({
      entityType: 'LearningAssignment',
      entityId: id,
      action: 'UPDATE',
      userId: requesterId,
      field: 'status',
      oldValue: 'PUBLISHED',
      newValue: 'CLOSED',
      reason: 'ASSIGNMENT_CLOSED',
    }).catch(() => undefined);
    return closed;
  }

  /**
   * Archive an assignment (sets archived=true, does not change status).
   */
  static async archiveAssignment(
    id: string,
    schoolId: string,
    requesterId: string,
    role: string,
  ): Promise<LearningAssignment> {
    await LMSAssignmentService.assertCanManageAssignment(id, schoolId, requesterId, role);
    const archived = await prisma.learningAssignment.update({
      where: { id, schoolId },
      data: { archived: true },
    });
    void auditService.logChange({
      entityType: 'LearningAssignment',
      entityId: id,
      action: 'DELETE',
      userId: requesterId,
      field: 'archived',
      oldValue: 'false',
      newValue: 'true',
      reason: 'ASSIGNMENT_ARCHIVED',
    }).catch(() => undefined);
    return archived;
  }

  /**
   * Get a paginated, role-scoped list of assignments.
   *
   * - TEACHER / HEAD_TEACHER: only assignments they created
   * - STUDENT: published assignments for their classId
   * - ADMIN / SUPER_ADMIN: all assignments for the school
   *
   * Requirements: 17.4
   */
  static async getAssignments(
    filters: AssignmentFilters,
    requesterId: string,
    role: string,
    schoolId: string,
    requesterClassId?: string,
  ): Promise<{ assignments: any[]; pagination: object }> {
    const {
      classId, learningAreaId, termId, status, category,
      assignmentId, learnerIds, page = 1, limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    // Role-scoped base filter
    const where: any = { schoolId, archived: false };

    // Roles that are locked to PUBLISHED-only visibility. The caller-supplied
    // `status` filter below must not be allowed to override this for them.
    let lockStatusToPublished = false;

    if (role === 'TEACHER' || role === 'HEAD_TEACHER') {
      where.createdById = requesterId;
    } else if (role === 'STUDENT') {
      lockStatusToPublished = true;
      if (requesterClassId) where.classId = requesterClassId;
    } else if (role === 'PARENT') {
      // PARENT branch: own children only. Resolve every learner the parent is
      // permitted to view (direct children + any linked family account),
      // narrow to a caller-supplied subset if provided, then scope to the
      // active classes those learners belong to.
      lockStatusToPublished = true;

      const accessibleLearnerIds = await parentAccessService.getAccessibleLearnerIds(requesterId);
      const scopedLearnerIds = learnerIds?.length
        ? learnerIds.filter((id) => accessibleLearnerIds.includes(id))
        : accessibleLearnerIds;

      if (scopedLearnerIds.length === 0) {
        return { assignments: [], pagination: { page, limit, total: 0, pages: 0 } };
      }

      const enrollments = await prisma.classEnrollment.findMany({
        where: { learnerId: { in: scopedLearnerIds }, active: true, archived: false },
        select: { classId: true },
      });
      const classIds = [...new Set(enrollments.map((e) => e.classId))];

      if (classIds.length === 0) {
        return { assignments: [], pagination: { page, limit, total: 0, pages: 0 } };
      }

      where.classId = classIds.length === 1 ? classIds[0] : { in: classIds };
    }
    // ADMIN / SUPER_ADMIN: no extra filter — sees all for school

    if (lockStatusToPublished) {
      where.status = 'PUBLISHED';
    }

    // Apply caller-supplied filters. `classId` and `status` are intentionally
    // skipped for roles locked above so callers cannot widen their own scope.
    if (assignmentId) where.id = assignmentId;
    if (classId && role !== 'PARENT') where.classId = classId;
    if (learningAreaId) where.learningAreaId = learningAreaId;
    if (termId) where.termId = termId;
    if (status && !lockStatusToPublished) where.status = status;
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      prisma.learningAssignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { files: true, submissions: true } },
        },
      }),
      prisma.learningAssignment.count({ where }),
    ]);

    return {
      assignments: lockStatusToPublished ? items.map(hideQuestionAnswers) : items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full assignment detail, including files array.
   * Throws 404 if not found or not owned by the school.
   * Requirements: 17.4
   */
  static async getAssignmentDetail(
    id: string,
    schoolId: string,
    requesterId: string,
    role: string,
    learnerId?: string,
  ): Promise<LearningAssignment & { files: any[] }> {
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    if (LMSAssignmentService.hasOversight(role)) {
      return assignment as LearningAssignment & { files: any[] };
    }

    if (role === 'TEACHER') {
      if (assignment.createdById !== requesterId) {
        throw new ApiError(403, 'You can only view assignments you created')
          .withCode('LMS_ASSIGNMENT_NOT_OWNER');
      }
      return assignment as LearningAssignment & { files: any[] };
    }

    if (!['PUBLISHED', 'CLOSED'].includes(assignment.status)) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    let accessibleLearnerIds: string[] = [];
    if (role === 'STUDENT' && learnerId) {
      accessibleLearnerIds = [learnerId];
    } else if (role === 'PARENT') {
      accessibleLearnerIds = await parentAccessService.getAccessibleLearnerIds(requesterId);
    }

    const enrollment = accessibleLearnerIds.length
      ? await prisma.classEnrollment.findFirst({
          where: {
            learnerId: { in: accessibleLearnerIds },
            classId: assignment.classId,
            active: true,
            archived: false,
          },
          select: { id: true },
        })
      : null;

    if (!enrollment) {
      throw new ApiError(403, 'This assignment is not issued to your class')
        .withCode('LMS_ASSIGNMENT_NOT_ASSIGNED');
    }

    return hideQuestionAnswers(assignment) as LearningAssignment & { files: any[] };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 8.2 — Submission Flow
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new submission for a published assignment.
   *
   * Business rules:
   *  - Assignment must be PUBLISHED
   *  - Late submission respects settings.allowLateSubmission
   *  - Resubmission respects settings.allowResubmission AND assignment.allowResubmit
   *  - File MIME type and size are validated before upload
   *  - Files uploaded to Cloudinary: lms/submissions/{schoolId}/{assignmentId}/{learnerId}/
   *
   * Requirements: 4.1, 4.6, 4.7, 4.9, 4.10
   */
  static async createSubmission(
    assignmentId: string,
    learnerId: string,
    data: CreateSubmissionInput,
    files: Express.Multer.File[],
    schoolId: string,
  ): Promise<LearningSubmission & { files: any[] }> {
    if (data.status && data.status !== 'DRAFT' && data.status !== 'SUBMITTED') {
      throw new ApiError(422, 'Submission status must be DRAFT or SUBMITTED')
        .withCode('LMS_SUBMISSION_STATUS_INVALID');
    }
    const saveAsDraft = data.status === 'DRAFT';
    let questionResponses: Record<string, unknown> = {};
    if (data.questionResponses) {
      try {
        questionResponses = typeof data.questionResponses === 'string'
          ? JSON.parse(data.questionResponses)
          : data.questionResponses as Record<string, unknown>;
      } catch {
        throw new ApiError(422, 'Question responses must be valid JSON')
          .withCode('LMS_QUESTION_RESPONSES_INVALID');
      }
    }

    // 1. Load and validate assignment
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id: assignmentId },
    });

    const assignmentQuestions = Array.isArray(assignment?.questions) ? assignment.questions as any[] : [];
    let autoMarks = 0;
    let objectiveCount = 0;
    let requiresManualMarking = false;
    if (!saveAsDraft) {
      for (const question of assignmentQuestions) {
        const response = questionResponses[String(question.id)];
        if (question.type === 'ESSAY') {
          requiresManualMarking = true;
          continue;
        }
        objectiveCount += 1;
        const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();
        const correct = question.type === 'MULTIPLE_CHOICE'
          ? Number(response) === Number(question.correctAnswer)
          : normalize(response) === normalize(question.correctAnswer);
        if (correct) autoMarks += Number(question.marks) || 0;
      }
    }

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    if (assignment.status !== 'PUBLISHED') {
      throw new ApiError(409, 'Assignment is not published')
        .withCode('LMS_ASSIGNMENT_NOT_PUBLISHED');
    }

    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        learnerId,
        classId: assignment.classId,
        active: true,
        archived: false,
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ApiError(403, 'This assignment is not issued to your class')
        .withCode('LMS_ASSIGNMENT_NOT_ASSIGNED');
    }

    // 2. Load LMS settings for late/resubmission rules
    const settings = await LMSSettingsService.getSettings(schoolId);

    // 3. Check due date
    let isLate = false;
    if (!saveAsDraft && assignment.dueDate && new Date() > assignment.dueDate) {
      if (
        settings.allowLateSubmission === false ||
        assignment.allowLateSubmit === false
      ) {
        throw new ApiError(409, 'The submission deadline has passed')
          .withCode('LMS_SUBMISSION_OVERDUE');
      }
      isLate = true;
    }

    // 4. Check resubmission
    let attemptNumber = 1;
    const [existingDraft, existingSubmissions] = await Promise.all([
      prisma.learningSubmission.findFirst({
        where: { assignmentId, learnerId, status: 'DRAFT', archived: false },
        select: { id: true },
      }),
      prisma.learningSubmission.findMany({
        where: {
          assignmentId,
          learnerId,
          status: { in: ['SUBMITTED', 'MARKED', 'LATE', 'RETURNED', 'RESUBMITTED'] },
          archived: false,
        },
        select: { attemptNumber: true, status: true },
        orderBy: { attemptNumber: 'desc' },
      }),
    ]);

    if (!saveAsDraft && existingSubmissions.length > 0) {
      const returnedForCorrection = existingSubmissions[0]?.status === 'RETURNED';
      const resubmissionBlocked =
        !returnedForCorrection &&
        (settings.allowResubmission === false || assignment.allowResubmit === false);
      if (resubmissionBlocked) {
        throw new ApiError(409, 'Resubmission is not allowed for this assignment')
          .withCode('LMS_RESUBMISSION_NOT_ALLOWED');
      }
      const maxAttempt = existingSubmissions[0]?.attemptNumber ?? 0;
      attemptNumber = maxAttempt + 1;
    }

    // 5. Validate files
    if (files && files.length > 0) {
      for (const file of files) {
        // MIME type check (skip if assignment.allowedFileTypes is empty)
        if (assignment.allowedFileTypes.length > 0) {
          const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
          const mimeOk =
            assignment.allowedFileTypes.includes(file.mimetype) ||
            assignment.allowedFileTypes.includes(ext);
          if (!mimeOk) {
            throw new ApiError(422, `File type not allowed: ${file.mimetype}`)
              .withCode('LMS_INVALID_FILE_TYPE');
          }
        }
        // Size check (assignment.maxFileSize is in MB)
        const maxBytes = (assignment.maxFileSize ?? 25) * 1024 * 1024;
        if (file.size > maxBytes) {
          throw new ApiError(413, `File exceeds maximum size of ${assignment.maxFileSize ?? 25} MB`)
            .withCode('LMS_FILE_TOO_LARGE');
        }
      }
    }

    // 6. Upload files to Cloudinary
    const folder = `lms/submissions/${schoolId}/${assignmentId}/${learnerId}`;
    const uploadedFiles: Array<{ name: string; url: string; fileType: string; fileSize: number }> = [];

    if (files && files.length > 0) {
      const results = await documentService.uploadMultipleFiles(files, { folder, resourceType: 'auto' });
      for (let i = 0; i < results.length; i++) {
        uploadedFiles.push({
          name: files[i].originalname,
          url: results[i].url,
          fileType: files[i].mimetype,
          fileSize: files[i].size,
        });
      }
    }

    // 7. Create submission + submission files in a transaction
    const fullyAutoMarked = !saveAsDraft && assignmentQuestions.length > 0
      && objectiveCount === assignmentQuestions.length && !requiresManualMarking;
    const submissionStatus: SubmissionStatus = saveAsDraft
      ? 'DRAFT'
      : fullyAutoMarked
        ? 'MARKED'
      : isLate
        ? 'LATE'
        : existingSubmissions.length > 0
          ? 'RESUBMITTED'
          : 'SUBMITTED';
    const submission = await prisma.$transaction(async (tx) => {
      if (existingDraft) {
        return tx.learningSubmission.update({
          where: { id: existingDraft.id },
          data: {
            content: data.content,
            questionResponses: questionResponses as Prisma.InputJsonValue,
            autoMarks: saveAsDraft ? null : autoMarks,
            autoMarked: fullyAutoMarked,
            requiresManualMarking,
            marks: fullyAutoMarked ? autoMarks : undefined,
            markedAt: fullyAutoMarked ? new Date() : undefined,
            status: submissionStatus,
            isLate,
            attemptNumber,
            submittedAt: saveAsDraft ? null : new Date(),
            files: uploadedFiles.length > 0
              ? { create: uploadedFiles }
              : undefined,
          },
          include: { files: true },
        });
      }

      const sub = await tx.learningSubmission.create({
        data: {
          assignmentId,
          learnerId,
          status: submissionStatus,
          content: data.content,
          questionResponses: questionResponses as Prisma.InputJsonValue,
          autoMarks: saveAsDraft ? null : autoMarks,
          autoMarked: fullyAutoMarked,
          requiresManualMarking,
          marks: fullyAutoMarked ? autoMarks : undefined,
          markedAt: fullyAutoMarked ? new Date() : undefined,
          isLate,
          attemptNumber,
          submittedAt: saveAsDraft ? null : new Date(),
          files: uploadedFiles.length > 0
            ? { create: uploadedFiles }
            : undefined,
        },
        include: { files: true },
      });
      return sub;
    });

    if (!saveAsDraft) {
      // 8. Fire-and-forget notification
      const notification = submissionStatus === 'RESUBMITTED'
        ? LMSNotificationService.onSubmissionResubmitted(submission)
        : LMSNotificationService.onSubmissionReceived(submission);
      void notification.catch((err: any) =>
        console.error('[LMSAssignmentService] createSubmission notification error:', err?.message),
      );

      void auditService.logChange({
        entityType: 'LearningSubmission',
        entityId: submission.id,
        action: 'UPDATE',
        userId: learnerId,
        field: 'status',
        oldValue: existingDraft ? 'DRAFT' : undefined,
        newValue: submissionStatus,
        reason: submissionStatus === 'RESUBMITTED'
          ? 'SUBMISSION_RESUBMITTED'
          : 'SUBMISSION_SUBMITTED',
      }).catch(() => undefined);

      // Fire-and-forget: achievement awarding
      void LMSAchievementsService.onAssignmentSubmitted({ learnerId, schoolId, assignmentId }).catch(() => undefined);
    }

    return submission as LearningSubmission & { files: any[] };
  }

  /**
   * Update a DRAFT submission (learner editing before final submit).
   * Verifies the submission belongs to this learner and is still in DRAFT status.
   * Requirements: 4.10
   */
  static async updateDraftSubmission(
    submissionId: string,
    learnerId: string,
    data: CreateSubmissionInput,
    files: Express.Multer.File[],
    schoolId: string,
  ): Promise<LearningSubmission & { files: any[] }> {
    const submission = await prisma.learningSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });

    if (!submission) {
      throw new ApiError(404, 'Submission not found');
    }

    if (submission.learnerId !== learnerId) {
      throw new ApiError(403, 'You do not have permission to edit this submission');
    }

    if (submission.assignment.schoolId !== schoolId) {
      throw new ApiError(403, 'Access denied');
    }

    if (submission.status !== 'DRAFT') {
      throw new ApiError(409, 'Cannot update a submission that has already been submitted');
    }

    // Upload any new files
    const newFileRecords: Array<{ name: string; url: string; fileType: string; fileSize: number }> = [];
    if (files && files.length > 0) {
      const folder = `lms/submissions/${schoolId}/${submission.assignmentId}/${learnerId}`;
      const results = await documentService.uploadMultipleFiles(files, { folder, resourceType: 'auto' });
      for (let i = 0; i < results.length; i++) {
        newFileRecords.push({
          name: files[i].originalname,
          url: results[i].url,
          fileType: files[i].mimetype,
          fileSize: files[i].size,
        });
      }
    }

    const updated = await prisma.learningSubmission.update({
      where: { id: submissionId },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(newFileRecords.length > 0 && {
          files: { create: newFileRecords },
        }),
      },
      include: { files: true },
    });

    return updated;
  }

  /**
   * Get all submissions for a given assignment (school-scoped).
   * Includes files and learner name.
   * Requirements: 4.1
   */
  static async getSubmissions(
    assignmentId: string,
    schoolId: string,
    requesterId: string,
    role: string,
  ): Promise<any[]> {
    await LMSAssignmentService.assertCanManageAssignment(
      assignmentId,
      schoolId,
      requesterId,
      role,
    );

    return prisma.learningSubmission.findMany({
      where: { assignmentId, archived: false },
      include: {
        files: true,
        learner: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Get submissions for one or more learners (school-scoped).
   * Only returns records where learnerId matches the caller (or, for a
   * PARENT-style caller, one of the learnerIds it has already been
   * authorized to view — authorization is the caller's responsibility).
   * Requirements: 4.11, 17.5
   */
  static async getMySubmissions(
    learnerId: string | string[],
    filters: { assignmentId?: string; status?: SubmissionStatus },
    schoolId: string,
  ): Promise<any[]> {
    const learnerIds = Array.isArray(learnerId) ? learnerId : [learnerId];

    const where: any = {
      learnerId: learnerIds.length === 1 ? learnerIds[0] : { in: learnerIds },
      archived: false,
      assignment: { schoolId },
    };

    if (filters.assignmentId) where.assignmentId = filters.assignmentId;
    if (filters.status) where.status = filters.status;

    return prisma.learningSubmission.findMany({
      where,
      include: {
        files: true,
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            totalMarks: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 8.3 — Marking Flow
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Mark a submission with a score and feedback.
   *
   * - Validates marks are within [0, assignment.totalMarks]
   * - Sets status=MARKED, markedAt, markedById, marks, feedback
   * - Fires notification; optionally syncs to gradebook; logs audit
   * - Invalidates analytics cache
   *
   * Requirements: 5.1, 5.2, 5.5
   */
  static async markSubmission(
    submissionId: string,
    markerId: string,
    marks: number,
    feedback: string,
    schoolId: string,
    role: string,
    rubricScores?: unknown,
  ): Promise<LearningSubmission & { files: any[] }> {
    // 1. Load submission + assignment
    const submission = await prisma.learningSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            id: true,
            schoolId: true,
            totalMarks: true,
            gradebookSync: true,
            title: true,
            learningAreaId: true,
            termId: true,
            createdById: true,
          },
        },
      },
    });

    if (!submission) {
      throw new ApiError(404, 'Submission not found');
    }

    if (submission.assignment.schoolId !== schoolId) {
      throw new ApiError(403, 'Access denied');
    }
    if (
      !LMSAssignmentService.hasOversight(role) &&
      submission.assignment.createdById !== markerId
    ) {
      throw new ApiError(403, 'You can only mark submissions for assignments you created')
        .withCode('LMS_ASSIGNMENT_NOT_OWNER');
    }

    // 2. Validate marks range
    const totalMarks = submission.assignment.totalMarks ?? null;
    if (!Number.isFinite(marks) || marks < 0 || (totalMarks !== null && marks > totalMarks)) {
      throw new ApiError(422, `Marks must be between 0 and ${totalMarks ?? '∞'}`)
        .withCode('LMS_MARKS_OUT_OF_RANGE');
    }

    let normalizedRubricScores: Array<{
      criterion: string;
      marks: number;
      maxMarks: number;
      comment?: string;
    }> | undefined;
    if (rubricScores !== undefined) {
      if (!Array.isArray(rubricScores)) {
        throw new ApiError(422, 'Rubric scores must be an array')
          .withCode('LMS_RUBRIC_SCORES_INVALID');
      }
      normalizedRubricScores = rubricScores.map((entry: any, index: number) => {
        const criterion = String(entry?.criterion ?? '').trim();
        const criterionMarks = Number(entry?.marks);
        const maxMarks = Number(entry?.maxMarks);
        if (
          !criterion ||
          !Number.isFinite(criterionMarks) ||
          !Number.isFinite(maxMarks) ||
          criterionMarks < 0 ||
          maxMarks < 0 ||
          criterionMarks > maxMarks
        ) {
          throw new ApiError(422, `Rubric criterion ${index + 1} has invalid marks`)
            .withCode('LMS_RUBRIC_SCORES_INVALID');
        }
        return {
          criterion,
          marks: criterionMarks,
          maxMarks,
          ...(entry?.comment ? { comment: String(entry.comment).trim() } : {}),
        };
      });
      const rubricTotal = normalizedRubricScores.reduce((sum, entry) => sum + entry.marks, 0);
      if (Math.abs(rubricTotal - marks) > 0.001) {
        throw new ApiError(422, 'Overall marks must equal the rubric total')
          .withCode('LMS_RUBRIC_TOTAL_MISMATCH');
      }
    }

    // 3. Update submission
    const marked = await prisma.learningSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'MARKED',
        marks,
        feedback,
        rubricScores: normalizedRubricScores,
        markedAt: new Date(),
        markedById: markerId,
      },
      include: { files: true },
    });

    // 4. Fire-and-forget: notification
    void LMSNotificationService.onSubmissionMarked(marked).catch((err: any) =>
      console.error('[LMSAssignmentService] markSubmission notification error:', err?.message),
    );

    // Fire-and-forget: perfect score achievement
    if (totalMarks !== null && marks === totalMarks) {
      void LMSAchievementsService.onPerfectScore({
        learnerId: marked.learnerId,
        schoolId,
        submissionId: marked.id,
        marks,
        totalMarks,
      }).catch(() => undefined);
    }

    // 5. Optionally sync to gradebook
    if (submission.assignment.gradebookSync) {
      void LMSAssignmentService._syncMarkToGradebook(marked, submission.assignment, markerId)
        .catch((err: any) => {
          console.error('[LMSAssignmentService] gradebook sync error:', err?.message);
          return auditService.logChange({
            entityType: 'LearningSubmission',
            entityId: submissionId,
            action: 'UPDATE',
            userId: markerId,
            field: 'gradebookSync',
            oldValue: 'PENDING',
            newValue: 'FAILED',
            reason: `GRADEBOOK_SYNC_FAILED: ${String(err?.message ?? err).slice(0, 300)}`,
          });
        });
    }

    // 6. Audit log (fire-and-forget)
    void auditService.logChange({
      entityType: 'LearningSubmission',
      entityId: submissionId,
      action: 'UPDATE',
      userId: markerId,
      field: 'status',
      oldValue: submission.status,
      newValue: 'MARKED',
      reason: 'SUBMISSION_MARKED',
    }).catch(() => undefined);

    // 7. Invalidate analytics cache
    await invalidateAnalyticsCache(schoolId);

    return marked;
  }

  static async returnSubmissionForCorrection(
    submissionId: string,
    markerId: string,
    feedback: string,
    schoolId: string,
    role: string,
  ): Promise<LearningSubmission & { files: any[] }> {
    const reason = feedback.trim();
    if (!reason) {
      throw new ApiError(422, 'Correction instructions are required')
        .withCode('LMS_RETURN_FEEDBACK_REQUIRED');
    }

    const submission = await prisma.learningSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!submission || submission.assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Submission not found');
    }
    if (
      !LMSAssignmentService.hasOversight(role) &&
      submission.assignment.createdById !== markerId
    ) {
      throw new ApiError(403, 'You can only return submissions for assignments you created')
        .withCode('LMS_ASSIGNMENT_NOT_OWNER');
    }
    if (!['SUBMITTED', 'LATE', 'RESUBMITTED', 'MARKED'].includes(submission.status)) {
      throw new ApiError(409, 'Only submitted work can be returned for correction')
        .withCode('LMS_SUBMISSION_RETURN_INVALID_STATE');
    }

    const returned = await prisma.learningSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'RETURNED',
        feedback: reason,
        marks: null,
        rubricScores: Prisma.JsonNull,
        markedAt: null,
        markedById: markerId,
      },
      include: { files: true },
    });
    void LMSNotificationService.onSubmissionReturned(returned).catch((err: any) =>
      console.error('[LMSAssignmentService] return notification error:', err?.message),
    );
    void auditService.logChange({
      entityType: 'LearningSubmission',
      entityId: submissionId,
      action: 'UPDATE',
      userId: markerId,
      field: 'status',
      oldValue: submission.status,
      newValue: 'RETURNED',
      reason: 'SUBMISSION_RETURNED_FOR_CORRECTION',
    }).catch(() => undefined);
    await invalidateAnalyticsCache(schoolId);
    return returned;
  }

  /**
   * Push a marked submission's score to the Gradebook module as a
   * FormativeAssessment record. This keeps the LMS marks in sync with
   * the wider CBC assessment data.
   *
   * This is an internal helper and runs fire-and-forget from markSubmission.
   */
  private static async _syncMarkToGradebook(
    submission: LearningSubmission,
    assignment: {
      id: string;
      title: string;
      learningAreaId: string;
      termId: string;
      totalMarks: number | null;
    },
    markerId: string,
  ): Promise<void> {
    if (submission.marks === null || submission.marks === undefined || !assignment.totalMarks) return;

    const percentage = Math.round((submission.marks / assignment.totalMarks) * 100);

    // Derive a CBC-compatible overallRating from percentage
    let overallRating: RubricRating;
    if (percentage >= 75) overallRating = 'EE';
    else if (percentage >= 50) overallRating = 'ME';
    else if (percentage >= 25) overallRating = 'AE';
    else overallRating = 'BE';

    await prisma.formativeAssessment.create({
      data: {
        learnerId: submission.learnerId,
        teacherId: markerId,
        learningArea: assignment.learningAreaId,
        learningAreaId: assignment.learningAreaId,
        overallRating,
        weight: 1,
        title: assignment.title,
        type: 'OTHER',
        term: 'TERM_1',           // fallback; caller should pass real term if needed
        academicYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Resolve the parent User.id for a learner.
   * Returns parentId or null if the learner has no linked parent account.
   * Requirements: 5.5
   */
  static async resolveParentUserId(learnerId: string): Promise<string | null> {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { parentId: true },
    });
    return learner?.parentId ?? null;
  }

  /**
   * Get assignments for a student (authenticated learner).
   * Returns published assignments for the student's active class,
   * enriched with learner's submission status on each.
   *
   * Data shape includes:
   * - assignment metadata (title, dueDate, totalMarks, etc.)
   * - mySubmission (learner's latest submission if exists)
   * - learningArea relationship
   * - class relationship
   *
   * Used by StudentLearningTab to show "My Assignments" dashboard.
   * Requirements: 2.4, 7.7, 7.8
   */
  static async getStudentAssignments(
    userId: string,
    schoolId: string,
  ): Promise<any[]> {
    const learner = await resolveStudentLearnerForUser(userId);
    return LMSAssignmentService.getAssignmentsForLearner(learner.id, schoolId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Parent-facing: assignments for a specific child learner
  // Batch 4, Assessment UX Overhaul
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get visible assignments for a specific learner, with that learner's
   * submission status attached to each. Intended for the parent portal.
   *
   * Authorization (PARENT → own children only, STUDENT → self only) is the
   * caller's responsibility — this method trusts the learnerId it receives.
   *
   * Returns an array where each item includes:
   *   - assignment metadata (title, dueDate, totalMarks, learningArea, class)
   *   - mySubmission (latest submission for this learner, or null)
   *   - statusSummary: learner-friendly assignment lifecycle state
   *   - isOverdue: boolean (dueDate in the past, no submitted submission)
   */
  static async getChildAssignments(
    learnerId: string,
    schoolId: string,
  ): Promise<any[]> {
    return LMSAssignmentService.getAssignmentsForLearner(learnerId, schoolId);
  }
}
