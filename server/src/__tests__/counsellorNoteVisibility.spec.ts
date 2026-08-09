const databaseMock = {
  counsellorNote: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  learner: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
};

const accessMock = jest.fn();
const createNotificationMock = jest.fn();

jest.mock('../config/database', () => ({ __esModule: true, default: databaseMock }));
jest.mock('../middleware/pathwayAccess.middleware', () => ({
  assertLearnerPathwayAccess: accessMock,
}));
jest.mock('../services/notification.service', () => ({
  NotificationService: {
    createNotification: createNotificationMock,
    notifyRoles: jest.fn(),
  },
  NotificationType: { INFO: 'INFO' },
}));
jest.mock('../services/senior-pathway-rule-engine.service', () => ({
  validateSeniorPathwaySelection: jest.fn(),
}));

import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { addCounsellorNote, getCounsellorNotes } from '../controllers/pathwayPlanner.controller';
import {
  normalizeCounsellorNoteVisibility,
  readableCounsellorNoteVisibilities,
} from '../services/counsellor-note-visibility.service';

const requestFor = (role: string, body: Record<string, unknown> = {}) => ({
  params: { learnerId: 'learner-1' },
  body,
  user: { userId: `${role.toLowerCase()}-1`, email: 'user@example.test', role, roles: [role] },
}) as unknown as AuthRequest;

const responseMock = () => {
  const res = { json: jest.fn(), status: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
};

describe('counsellor note visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    accessMock.mockResolvedValue(undefined);
    databaseMock.counsellorNote.findMany.mockResolvedValue([]);
    databaseMock.counsellorNote.count.mockResolvedValue(0);
  });

  it('maps legacy learner/parent visibility values to canonical values', () => {
    expect(normalizeCounsellorNoteVisibility('COUNSELLOR_AND_LEARNER'))
      .toBe('SHARED_WITH_STUDENT');
    expect(normalizeCounsellorNoteVisibility('PARENT_VISIBLE'))
      .toBe('SHARED_WITH_PARENT');
    expect(() => normalizeCounsellorNoteVisibility('PUBLIC'))
      .toThrow('visibility must be one of');
  });

  it('defines separate readable visibility sets for students, parents, and teachers', () => {
    expect(readableCounsellorNoteVisibilities({ role: 'STUDENT' }))
      .toEqual(expect.arrayContaining(['SHARED_WITH_STUDENT', 'LEARNER_VISIBLE']));
    expect(readableCounsellorNoteVisibilities({ role: 'PARENT' }))
      .toEqual(expect.arrayContaining(['SHARED_WITH_PARENT', 'PARENT_VISIBLE']));
    expect(readableCounsellorNoteVisibilities({ role: 'TEACHER' }))
      .toEqual(['SCHOOL_TEAM_VISIBLE']);
    expect(readableCounsellorNoteVisibilities({ role: 'HEAD_OF_CURRICULUM' }))
      .toBeNull();
  });

  it('filters student note queries and enforces learner ownership first', async () => {
    const req = requestFor('STUDENT');
    await getCounsellorNotes(req, responseMock());

    expect(accessMock).toHaveBeenCalledWith(req, 'learner-1');
    expect(databaseMock.counsellorNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          learnerId: 'learner-1',
          visibility: {
            in: expect.arrayContaining(['SHARED_WITH_STUDENT', 'COUNSELLOR_AND_LEARNER']),
          },
        },
      }),
    );
  });

  it('allows counsellors to query all notes for an authorized learner', async () => {
    await getCounsellorNotes(requestFor('HEAD_OF_CURRICULUM'), responseMock());
    expect(databaseMock.counsellorNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { learnerId: 'learner-1' } }),
    );
  });

  it('stores private notes without notifying learner or parent accounts', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.counsellorNote.create.mockResolvedValue({
      id: 'note-1',
      author: { firstName: 'Case', lastName: 'Worker', role: 'HEAD_OF_CURRICULUM' },
    });

    await addCounsellorNote(
      requestFor('HEAD_OF_CURRICULUM', {
        note: 'Private safeguarding context',
        visibility: 'COUNSELLOR_ONLY',
      }),
      responseMock(),
    );

    expect(databaseMock.counsellorNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: 'COUNSELLOR_ONLY' }),
      }),
    );
    expect(databaseMock.user.findUnique).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
