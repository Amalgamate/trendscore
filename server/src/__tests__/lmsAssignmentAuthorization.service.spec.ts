const databaseMock = {
  class: { findFirst: jest.fn() },
  classSchedule: { findFirst: jest.fn() },
  classEnrollment: { findFirst: jest.fn() },
  subjectAssignment: { findFirst: jest.fn() },
  learningAssignment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  learningSubmission: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));
jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: { deleteByPrefix: jest.fn() },
}));
jest.mock('../services/lms-settings.service', () => ({
  LMSSettingsService: { getSettings: jest.fn() },
}));
jest.mock('../services/lms-notification.service', () => ({
  LMSNotificationService: {
    onSubmissionReceived: jest.fn().mockResolvedValue(undefined),
    onSubmissionMarked: jest.fn().mockResolvedValue(undefined),
    onSubmissionReturned: jest.fn().mockResolvedValue(undefined),
    onSubmissionResubmitted: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../services/lms-achievements.service', () => ({
  LMSAchievementsService: {
    onAssignmentSubmitted: jest.fn().mockResolvedValue(undefined),
    onPerfectScore: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../services/audit.service', () => ({
  auditService: { logChange: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../services/document.service', () => ({
  documentService: { uploadMultipleFiles: jest.fn() },
}));
jest.mock('../services/parent-access.service', () => ({ parentAccessService: {} }));

import { LMSAssignmentService } from '../services/lms-assignment.service';
import { LMSSettingsService } from '../services/lms-settings.service';
import { LMSNotificationService } from '../services/lms-notification.service';

const validDraft = {
  schoolId: 'school-1',
  title: 'Fractions practice',
  classId: 'class-1',
  learningAreaId: 'maths-1',
  termId: 'term-1',
  category: 'HOMEWORK' as const,
};

describe('LMS assignment teacher authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    databaseMock.class.findFirst.mockResolvedValue({
      id: 'class-1',
      grade: 'Grade 6',
      teacherId: null,
    });
    databaseMock.classSchedule.findFirst.mockResolvedValue(null);
    databaseMock.subjectAssignment.findFirst.mockResolvedValue(null);
    databaseMock.classEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    databaseMock.learningSubmission.findFirst.mockResolvedValue(null);
    databaseMock.learningSubmission.findMany.mockResolvedValue([]);
    databaseMock.$transaction.mockImplementation((callback: any) => callback(databaseMock));
    (LMSSettingsService.getSettings as jest.Mock).mockResolvedValue({
      allowLateSubmission: true,
      allowResubmission: true,
    });
  });

  it('rejects assignment creation outside a teacher workload', async () => {
    await expect(
      LMSAssignmentService.createAssignment(validDraft, 'teacher-1', 'TEACHER'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'LMS_ASSIGNMENT_OUTSIDE_WORKLOAD',
    });

    expect(databaseMock.learningAssignment.create).not.toHaveBeenCalled();
  });

  it('allows an explicitly assigned subject teacher to create an assignment', async () => {
    databaseMock.subjectAssignment.findFirst.mockResolvedValue({ id: 'workload-1' });
    databaseMock.learningAssignment.create.mockResolvedValue({ id: 'assignment-1' });

    await LMSAssignmentService.createAssignment(validDraft, 'teacher-1', 'TEACHER');

    expect(databaseMock.learningAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classId: 'class-1',
          learningAreaId: 'maths-1',
          createdById: 'teacher-1',
          status: 'DRAFT',
        }),
      }),
    );
  });

  it('prevents one teacher from closing another teacher assignment', async () => {
    databaseMock.learningAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      createdById: 'teacher-2',
      archived: false,
    });

    await expect(
      LMSAssignmentService.closeAssignment(
        'assignment-1',
        'school-1',
        'teacher-1',
        'TEACHER',
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'LMS_ASSIGNMENT_NOT_OWNER',
    });

    expect(databaseMock.learningAssignment.update).not.toHaveBeenCalled();
  });

  it('retains school-wide assignment oversight for curriculum leadership', async () => {
    databaseMock.learningAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      createdById: 'teacher-2',
      archived: false,
    });
    databaseMock.learningAssignment.update.mockResolvedValue({
      id: 'assignment-1',
      status: 'CLOSED',
    });

    await LMSAssignmentService.closeAssignment(
      'assignment-1',
      'school-1',
      'curriculum-head-1',
      'HEAD_OF_CURRICULUM',
    );

    expect(databaseMock.learningAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-1', schoolId: 'school-1' },
      data: { status: 'CLOSED' },
    });
  });

  it('rejects a submission when the learner is not enrolled in the target class', async () => {
    databaseMock.learningAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      status: 'PUBLISHED',
      allowedFileTypes: [],
      maxFileSize: 25,
      allowLateSubmit: true,
      allowResubmit: false,
      dueDate: new Date(Date.now() + 60_000),
    });
    databaseMock.classEnrollment.findFirst.mockResolvedValue(null);

    await expect(
      LMSAssignmentService.createSubmission(
        'assignment-1',
        'learner-1',
        { content: 'My answer', status: 'SUBMITTED' },
        [],
        'school-1',
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'LMS_ASSIGNMENT_NOT_ASSIGNED',
    });
  });

  it('saves one reusable draft and transitions it on final submission', async () => {
    databaseMock.learningAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      status: 'PUBLISHED',
      allowedFileTypes: [],
      maxFileSize: 25,
      allowLateSubmit: true,
      allowResubmit: false,
      dueDate: new Date(Date.now() + 60_000),
    });
    databaseMock.learningSubmission.findFirst.mockResolvedValue({ id: 'draft-1' });
    databaseMock.learningSubmission.update.mockResolvedValue({
      id: 'draft-1',
      status: 'SUBMITTED',
      files: [],
    });

    await LMSAssignmentService.createSubmission(
      'assignment-1',
      'learner-1',
      { content: 'Final answer', status: 'SUBMITTED' },
      [],
      'school-1',
    );

    expect(databaseMock.learningSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-1' },
        data: expect.objectContaining({
          content: 'Final answer',
          status: 'SUBMITTED',
        }),
      }),
    );
    expect(LMSNotificationService.onSubmissionReceived).toHaveBeenCalledTimes(1);
  });

  it('does not send final-submission events while saving a draft', async () => {
    databaseMock.learningAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      status: 'PUBLISHED',
      allowedFileTypes: [],
      maxFileSize: 25,
      allowLateSubmit: true,
      allowResubmit: false,
      dueDate: new Date(Date.now() + 60_000),
    });
    databaseMock.learningSubmission.create.mockResolvedValue({
      id: 'draft-1',
      status: 'DRAFT',
      files: [],
    });

    await LMSAssignmentService.createSubmission(
      'assignment-1',
      'learner-1',
      { content: 'Work in progress', status: 'DRAFT' },
      [],
      'school-1',
    );

    expect(databaseMock.learningSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          submittedAt: null,
        }),
      }),
    );
    expect(LMSNotificationService.onSubmissionReceived).not.toHaveBeenCalled();
  });

  it('enforces both school and assignment late-submission policies', async () => {
    databaseMock.learningAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      status: 'PUBLISHED',
      allowedFileTypes: [],
      maxFileSize: 25,
      allowLateSubmit: false,
      allowResubmit: false,
      dueDate: new Date(Date.now() - 60_000),
    });

    await expect(
      LMSAssignmentService.createSubmission(
        'assignment-1',
        'learner-1',
        { content: 'Late answer', status: 'SUBMITTED' },
        [],
        'school-1',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LMS_SUBMISSION_OVERDUE',
    });
  });

  it('blocks a second attempt when resubmission is disabled', async () => {
    databaseMock.learningAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      status: 'PUBLISHED',
      allowedFileTypes: [],
      maxFileSize: 25,
      allowLateSubmit: true,
      allowResubmit: false,
      dueDate: new Date(Date.now() + 60_000),
    });
    databaseMock.learningSubmission.findMany.mockResolvedValue([{ attemptNumber: 1 }]);

    await expect(
      LMSAssignmentService.createSubmission(
        'assignment-1',
        'learner-1',
        { content: 'Second answer', status: 'SUBMITTED' },
        [],
        'school-1',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LMS_RESUBMISSION_NOT_ALLOWED',
    });
  });

  it('rejects non-numeric marks before persisting them', async () => {
    databaseMock.learningSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      assignmentId: 'assignment-1',
      learnerId: 'learner-1',
      assignment: {
        id: 'assignment-1',
        schoolId: 'school-1',
        createdById: 'teacher-1',
        totalMarks: 20,
        gradebookSync: false,
        title: 'Fractions practice',
        learningAreaId: 'maths-1',
        termId: 'term-1',
      },
    });

    await expect(
      LMSAssignmentService.markSubmission(
        'submission-1',
        'teacher-1',
        Number.NaN,
        'Invalid score',
        'school-1',
        'TEACHER',
      ),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(databaseMock.learningSubmission.update).not.toHaveBeenCalled();
  });

  it('rejects rubric scores when their total differs from overall marks', async () => {
    databaseMock.learningSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      assignmentId: 'assignment-1',
      learnerId: 'learner-1',
      assignment: {
        id: 'assignment-1',
        schoolId: 'school-1',
        createdById: 'teacher-1',
        totalMarks: 20,
        gradebookSync: false,
        title: 'Fractions practice',
        learningAreaId: 'maths-1',
        termId: 'term-1',
      },
    });

    await expect(
      LMSAssignmentService.markSubmission(
        'submission-1',
        'teacher-1',
        15,
        'Good progress',
        'school-1',
        'TEACHER',
        [
          { criterion: 'Method', marks: 5, maxMarks: 10 },
          { criterion: 'Accuracy', marks: 5, maxMarks: 10 },
        ],
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'LMS_RUBRIC_TOTAL_MISMATCH',
    });
  });

  it('returns submitted work for correction with required teacher guidance', async () => {
    databaseMock.learningSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      status: 'SUBMITTED',
      assignment: {
        schoolId: 'school-1',
        createdById: 'teacher-1',
      },
    });
    databaseMock.learningSubmission.update.mockResolvedValue({
      id: 'submission-1',
      status: 'RETURNED',
      files: [],
    });

    await LMSAssignmentService.returnSubmissionForCorrection(
      'submission-1',
      'teacher-1',
      'Correct questions 2 and 3.',
      'school-1',
      'TEACHER',
    );

    expect(databaseMock.learningSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'submission-1' },
        data: expect.objectContaining({
          status: 'RETURNED',
          feedback: 'Correct questions 2 and 3.',
          marks: null,
        }),
      }),
    );
  });
});
