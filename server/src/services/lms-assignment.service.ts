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
import { auditService } from './audit.service';
import { documentService } from './document.service';
import { ApiError } from '../utils/error.util';
import type {
  LearningAssignment,
  LearningSubmission,
  AssignmentCategory,
  AssignmentStatus,
  SubmissionStatus,
  RubricRating,
} from '@prisma/client';

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
  page?: number;
  limit?: number;
}

export interface SubmissionFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CreateSubmissionInput {
  content?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSAssignmentService {
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
  ): Promise<LearningAssignment> {
    const { title, classId, learningAreaId, termId, category, schoolId } = data;

    if (!title || !classId || !learningAreaId || !termId || !category) {
      throw new ApiError(422, 'Missing required fields: title, classId, learningAreaId, termId, category');
    }

    return prisma.learningAssignment.create({
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
        dueDate: data.dueDate,
        estimatedMins: data.estimatedMins,
        totalMarks: data.totalMarks,
        passMark: data.passMark,
        rubric: data.rubric ?? undefined,
        cbcOutcomes: data.cbcOutcomes ?? [],
        allowLateSubmit: data.allowLateSubmit ?? true,
        allowResubmit: data.allowResubmit ?? false,
        maxFileSize: data.maxFileSize ?? 25,
        allowedFileTypes: data.allowedFileTypes ?? [],
        gradebookSync: data.gradebookSync ?? false,
      },
    });
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
  ): Promise<LearningAssignment> {
    // Build safe update — exclude status and createdById
    const { title, classId, learningAreaId, termId, category, streamId,
            instructions, dueDate, estimatedMins, totalMarks, passMark,
            rubric, cbcOutcomes, allowLateSubmit, allowResubmit,
            maxFileSize, allowedFileTypes, gradebookSync } = data;

    return prisma.learningAssignment.update({
      where: { id, schoolId },
      data: {
        ...(title !== undefined && { title }),
        ...(classId !== undefined && { classId }),
        ...(learningAreaId !== undefined && { learningAreaId }),
        ...(termId !== undefined && { termId }),
        ...(category !== undefined && { category }),
        ...(streamId !== undefined && { streamId }),
        ...(instructions !== undefined && { instructions }),
        ...(dueDate !== undefined && { dueDate }),
        ...(estimatedMins !== undefined && { estimatedMins }),
        ...(totalMarks !== undefined && { totalMarks }),
        ...(passMark !== undefined && { passMark }),
        ...(rubric !== undefined && { rubric }),
        ...(cbcOutcomes !== undefined && { cbcOutcomes }),
        ...(allowLateSubmit !== undefined && { allowLateSubmit }),
        ...(allowResubmit !== undefined && { allowResubmit }),
        ...(maxFileSize !== undefined && { maxFileSize }),
        ...(allowedFileTypes !== undefined && { allowedFileTypes }),
        ...(gradebookSync !== undefined && { gradebookSync }),
      },
    });
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
  ): Promise<LearningAssignment> {
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id },
    });

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    if (!assignment.title || !assignment.classId || !assignment.learningAreaId || !assignment.dueDate) {
      throw new ApiError(422, 'Assignment must have title, classId, learningAreaId, and dueDate before publishing');
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
  ): Promise<LearningAssignment> {
    return prisma.learningAssignment.update({
      where: { id, schoolId },
      data: { status: 'CLOSED' },
    });
  }

  /**
   * Archive an assignment (sets archived=true, does not change status).
   */
  static async archiveAssignment(
    id: string,
    schoolId: string,
  ): Promise<LearningAssignment> {
    return prisma.learningAssignment.update({
      where: { id, schoolId },
      data: { archived: true },
    });
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
    const { classId, learningAreaId, termId, status, category, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    // Role-scoped base filter
    const where: any = { schoolId, archived: false };

    if (role === 'TEACHER' || role === 'HEAD_TEACHER') {
      where.createdById = requesterId;
    } else if (role === 'STUDENT') {
      where.status = 'PUBLISHED';
      if (requesterClassId) where.classId = requesterClassId;
    }
    // ADMIN / SUPER_ADMIN: no extra filter — sees all for school

    // Apply caller-supplied filters
    if (classId) where.classId = classId;
    if (learningAreaId) where.learningAreaId = learningAreaId;
    if (termId) where.termId = termId;
    if (status) where.status = status;
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
      assignments: items,
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
  ): Promise<LearningAssignment & { files: any[] }> {
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    return assignment as LearningAssignment & { files: any[] };
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
    // 1. Load and validate assignment
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

    if (assignment.status !== 'PUBLISHED') {
      throw new ApiError(409, 'Assignment is not published')
        .withCode('LMS_ASSIGNMENT_NOT_PUBLISHED');
    }

    // 2. Load LMS settings for late/resubmission rules
    const settings = await LMSSettingsService.getSettings(schoolId);

    // 3. Check due date
    let isLate = false;
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      if (settings.allowLateSubmission === false) {
        throw new ApiError(409, 'The submission deadline has passed')
          .withCode('LMS_SUBMISSION_OVERDUE');
      }
      isLate = true;
    }

    // 4. Check resubmission
    let attemptNumber = 1;
    const existingSubmissions = await prisma.learningSubmission.findMany({
      where: {
        assignmentId,
        learnerId,
        status: { in: ['SUBMITTED', 'MARKED', 'LATE', 'RETURNED', 'RESUBMITTED'] },
        archived: false,
      },
      select: { attemptNumber: true },
      orderBy: { attemptNumber: 'desc' },
    });

    if (existingSubmissions.length > 0) {
      const resubmissionBlocked =
        settings.allowResubmission === false || assignment.allowResubmit === false;
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
    const submissionStatus: SubmissionStatus = isLate ? 'LATE' : 'SUBMITTED';
    const submission = await prisma.$transaction(async (tx) => {
      const sub = await tx.learningSubmission.create({
        data: {
          assignmentId,
          learnerId,
          status: submissionStatus,
          content: data.content,
          isLate,
          attemptNumber,
          submittedAt: new Date(),
          files: uploadedFiles.length > 0
            ? { create: uploadedFiles }
            : undefined,
        },
        include: { files: true },
      });
      return sub;
    });

    // 8. Fire-and-forget notification
    void LMSNotificationService.onSubmissionReceived(submission).catch((err: any) =>
      console.error('[LMSAssignmentService] createSubmission notification error:', err?.message),
    );

    return submission;
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
  ): Promise<any[]> {
    // Verify assignment belongs to school
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id: assignmentId },
      select: { schoolId: true },
    });

    if (!assignment || assignment.schoolId !== schoolId) {
      throw new ApiError(404, 'Assignment not found').withCode('LMS_ASSIGNMENT_NOT_FOUND');
    }

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
   * Get submissions for a specific learner (school-scoped).
   * Only returns records where learnerId matches the caller.
   * Requirements: 4.11, 17.5
   */
  static async getMySubmissions(
    learnerId: string,
    filters: { status?: SubmissionStatus },
    schoolId: string,
  ): Promise<any[]> {
    const where: any = {
      learnerId,
      archived: false,
      assignment: { schoolId },
    };

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

    // 2. Validate marks range
    const totalMarks = submission.assignment.totalMarks ?? null;
    if (marks < 0 || (totalMarks !== null && marks > totalMarks)) {
      throw new ApiError(422, `Marks must be between 0 and ${totalMarks ?? '∞'}`)
        .withCode('LMS_MARKS_OUT_OF_RANGE');
    }

    // 3. Update submission
    const marked = await prisma.learningSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'MARKED',
        marks,
        feedback,
        markedAt: new Date(),
        markedById: markerId,
      },
      include: { files: true },
    });

    // 4. Fire-and-forget: notification
    void LMSNotificationService.onSubmissionMarked(marked).catch((err: any) =>
      console.error('[LMSAssignmentService] markSubmission notification error:', err?.message),
    );

    // 5. Optionally sync to gradebook
    if (submission.assignment.gradebookSync) {
      void LMSAssignmentService._syncMarkToGradebook(marked, submission.assignment, markerId)
        .catch((err: any) =>
          console.error('[LMSAssignmentService] gradebook sync error:', err?.message),
        );
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
    if (!submission.marks || !assignment.totalMarks) return;

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
    // 1. Resolve learner from user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }, // username = admissionNumber
    });

    if (!user?.username) {
      return []; // No learner found
    }

    const learner = await prisma.learner.findUnique({
      where: { admissionNumber: user.username },
      select: { id: true },
    });

    if (!learner) {
      return []; // No learner record
    }

    // 2. Get learner's active class enrollment
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        learnerId: learner.id,
        active: true,
        archived: false,
      },
      select: { classId: true },
    });

    if (!enrollment) {
      return []; // No active enrollment
    }

    // 3. Fetch published assignments for the learner's class
    const assignments = await prisma.learningAssignment.findMany({
      where: {
        schoolId,
        classId: enrollment.classId,
        status: 'PUBLISHED',
        archived: false,
      },
      include: {
        learningArea: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        // Get learner's latest submission (any status)
        submissions: {
          where: { learnerId: learner.id },
          select: {
            id: true,
            status: true,
            marks: true,
            submittedAt: true,
            markedAt: true,
            attemptNumber: true,
          },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
        _count: { select: { submissions: true, files: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 4. Transform: attach mySubmission to each assignment
    return assignments.map((assignment) => ({
      ...assignment,
      mySubmission: assignment.submissions[0] ?? null,
      submissions: undefined, // Remove array, use mySubmission instead
    }));
  }
}

