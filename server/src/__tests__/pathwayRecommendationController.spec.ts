/**
 * pathwayRecommendationController.spec.ts
 *
 * Unit tests for:
 *  - saveTransitionDecision  — COUNSEL_PATHWAY gate is route-only (no PARENT re-check in controller)
 *  - saveParentPreference    — staff fields preserved; 'PENDING' sentinel never written
 */

const saveDecisionMock = jest.fn();
const notifyMock       = jest.fn();
const hasFinalizedMock = jest.fn();

const databaseMock = {
  learner: {
    findUnique: jest.fn(),
  },
  learnerPathwayRecommendation: {
    findFirst: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));

jest.mock('../services/pathway-transition-decision.service', () => ({
  saveTransitionDecision:       saveDecisionMock,
  getTransitionDecisionHistory: jest.fn().mockResolvedValue([]),
  hasFinalizedTransitionDecision: hasFinalizedMock,
}));

// Silence the notification helper — it is fire-and-forget in the controller.
jest.mock('../services/notification.service', () => ({
  NotificationService: { createNotification: notifyMock },
  NotificationType: { INFO: 'INFO' },
}));

import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { pathwayRecommendationController } from '../controllers/pathwayRecommendation.controller';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRes() {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    params: { learnerId: 'learner-1' },
    body:   {},
    user:   { userId: 'user-1', email: 'u@test.com', role: 'HEAD_OF_CURRICULUM', roles: ['HEAD_OF_CURRICULUM'] },
    ...overrides,
  } as unknown as AuthRequest;
}

// ─── saveTransitionDecision ─────────────────────────────────────────────────

describe('saveTransitionDecision controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasFinalizedMock.mockResolvedValue(false);
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue(null);
  });

  it('requires recommendedPathway in the body', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await expect(
      pathwayRecommendationController.saveTransitionDecision(req, res),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks non-admin roles from writing finalApprovedPathway', async () => {
    const req = makeReq({
      user: { userId: 'teacher-1', email: 't@test.com', role: 'TEACHER', roles: ['TEACHER'] } as any,
      body: { recommendedPathway: 'STEM', finalApprovedPathway: 'STEM' },
    });
    const res = makeRes();

    await expect(
      pathwayRecommendationController.saveTransitionDecision(req, res),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('finalizes the explicitly approved pathway rather than the recommendation', async () => {
    const req = makeReq({
      user: { userId: 'admin-1', email: 'a@test.com', role: 'ADMIN', roles: ['ADMIN'] } as any,
      body: { recommendedPathway: 'STEM', finalApprovedPathway: 'ARTS_SPORTS' },
    });
    const res = makeRes();
    databaseMock.learnerPathwayRecommendation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
      id: 'decision-existing',
      learnerId: 'learner-1',
      recommendedPathway: 'STEM',
      confidenceScore: 75,
      learnerInterest: null,
      teacherRecommendation: null,
      parentPreference: 'ARTS_SPORTS',
      finalApprovedPathway: null,
      mismatchWarning: null,
      analysisPayload: null,
    });
    saveDecisionMock.mockResolvedValue({ id: 'decision-final', finalApprovedPathway: 'ARTS_SPORTS' });
    databaseMock.learner.findUnique.mockResolvedValue({ admissionNumber: 'ADM-001', parentId: null });
    databaseMock.user.findUnique.mockResolvedValue(null);

    await pathwayRecommendationController.saveTransitionDecision(req, res);

    expect(saveDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ finalApprovedPathway: 'ARTS_SPORTS' }),
    );
  });

  it('persists and returns 201 for a valid staff decision', async () => {
    const req = makeReq({ body: { recommendedPathway: 'SOCIAL_SCIENCES', confidenceScore: 68 } });
    const res = makeRes();
    const mockRow = { id: 'decision-1', recommendedPathway: 'SOCIAL_SCIENCES' };

    saveDecisionMock.mockResolvedValue(mockRow);
    databaseMock.learner.findUnique.mockResolvedValue({ admissionNumber: 'ADM-001', parentId: null });
    databaseMock.user.findUnique.mockResolvedValue(null);

    await pathwayRecommendationController.saveTransitionDecision(req, res);

    expect(saveDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ recommendedPathway: 'SOCIAL_SCIENCES' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRow });
  });

  it('rejects ordinary recommendation edits after finalization', async () => {
    hasFinalizedMock.mockResolvedValue(true);
    const req = makeReq({ body: { recommendedPathway: 'STEM', confidenceScore: 80 } });

    await expect(
      pathwayRecommendationController.saveTransitionDecision(req, makeRes()),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(saveDecisionMock).not.toHaveBeenCalled();
  });

  it('rejects changing an already finalized pathway without an override workflow', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue({
      id: 'decision-final',
      learnerId: 'learner-1',
      recommendedPathway: 'STEM',
      confidenceScore: 80,
      finalApprovedPathway: 'STEM',
    });
    const req = makeReq({
      user: { userId: 'admin-1', email: 'a@test.com', role: 'ADMIN', roles: ['ADMIN'] } as any,
      body: { recommendedPathway: 'STEM', finalApprovedPathway: 'ARTS_SPORTS' },
    });

    await expect(
      pathwayRecommendationController.saveTransitionDecision(req, makeRes()),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(saveDecisionMock).not.toHaveBeenCalled();
  });
});

// ─── saveParentPreference ────────────────────────────────────────────────────

describe('saveParentPreference controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasFinalizedMock.mockResolvedValue(false);
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue(null);
  });

  it('preserves all staff fields from the existing row and never writes PENDING', async () => {
    const existing = {
      recommendedPathway:    'SOCIAL_SCIENCES',
      confidenceScore:       68,
      learnerInterest:       'SOCIAL_SCIENCES',
      teacherRecommendation: 'SOCIAL_SCIENCES',
      parentPreference:      null,
      finalApprovedPathway:  null,
      mismatchWarning:       null,
      analysisPayload:       { version: 'GRADE9_READINESS_V1', generatedAt: '2026-08-01T00:00:00.000Z' },
    };
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue(existing);
    saveDecisionMock.mockResolvedValue({ id: 'decision-2', ...existing, parentPreference: 'STEM' });

    const req = makeReq({
      user: { userId: 'parent-1', email: 'p@test.com', role: 'PARENT', roles: ['PARENT'] } as any,
      body: { parentPreference: 'STEM' },
    });
    const res = makeRes();

    await pathwayRecommendationController.saveParentPreference(req, res);

    const callArg = saveDecisionMock.mock.calls[0][0];
    expect(callArg.recommendedPathway).toBe('SOCIAL_SCIENCES');         // preserved
    expect(callArg.recommendedPathway).not.toBe('PENDING');             // regression guard
    expect(callArg.parentPreference).toBe('STEM');                      // updated
    expect(callArg.confidenceScore).toBe(68);                           // preserved
    expect(callArg.teacherRecommendation).toBe('SOCIAL_SCIENCES');      // preserved
    expect(callArg.analysisPayload).toEqual(existing.analysisPayload);  // preserved
  });

  it('writes recommendedPathway: null (not PENDING) when no prior staff row exists', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue(null);
    saveDecisionMock.mockResolvedValue({ id: 'decision-3', recommendedPathway: null, parentPreference: 'ARTS_SPORTS' });

    const req = makeReq({
      user: { userId: 'parent-1', email: 'p@test.com', role: 'PARENT', roles: ['PARENT'] } as any,
      body: { parentPreference: 'ARTS_SPORTS' },
    });
    const res = makeRes();

    await pathwayRecommendationController.saveParentPreference(req, res);

    const callArg = saveDecisionMock.mock.calls[0][0];
    expect(callArg.recommendedPathway).toBeNull();
    expect(callArg.recommendedPathway).not.toBe('PENDING');
    expect(callArg.parentPreference).toBe('ARTS_SPORTS');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects an invalid parentPreference value with 422', async () => {
    const req = makeReq({
      user: { userId: 'parent-1', email: 'p@test.com', role: 'PARENT', roles: ['PARENT'] } as any,
      body: { parentPreference: 'INVALID_PATHWAY' },
    });
    const res = makeRes();

    await expect(
      pathwayRecommendationController.saveParentPreference(req, res),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('accepts empty string parentPreference to clear the preference', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue({
      recommendedPathway: 'STEM', confidenceScore: 75,
      learnerInterest: null, teacherRecommendation: null,
      parentPreference: 'ARTS_SPORTS', finalApprovedPathway: null,
      mismatchWarning: null, analysisPayload: null,
    });
    saveDecisionMock.mockResolvedValue({ id: 'decision-4', parentPreference: null });

    const req = makeReq({
      user: { userId: 'parent-1', email: 'p@test.com', role: 'PARENT', roles: ['PARENT'] } as any,
      body: { parentPreference: '' },
    });
    const res = makeRes();

    await pathwayRecommendationController.saveParentPreference(req, res);

    const callArg = saveDecisionMock.mock.calls[0][0];
    expect(callArg.parentPreference).toBeNull();
  });

  it('blocks non-PARENT non-SUPER_ADMIN callers with 403', async () => {
    const req = makeReq({
      user: { userId: 'teacher-1', email: 't@test.com', role: 'TEACHER', roles: ['TEACHER'] } as any,
      body: { parentPreference: 'STEM' },
    });
    const res = makeRes();

    await expect(
      pathwayRecommendationController.saveParentPreference(req, res),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('overrideFinalizedDecision controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasFinalizedMock.mockResolvedValue(true);
  });

  it('blocks roles without LOCK_PATHWAY authority', async () => {
    const req = makeReq({
      user: { userId: 'curriculum-1', email: 'c@test.com', role: 'HEAD_OF_CURRICULUM', roles: ['HEAD_OF_CURRICULUM'] } as any,
      body: { finalApprovedPathway: 'STEM', reason: 'Approved after review meeting' },
    });

    await expect(
      pathwayRecommendationController.overrideFinalizedDecision(req, makeRes()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('requires a meaningful override reason', async () => {
    const req = makeReq({
      user: { userId: 'admin-1', email: 'a@test.com', role: 'ADMIN', roles: ['ADMIN'] } as any,
      body: { finalApprovedPathway: 'STEM', reason: 'short' },
    });

    await expect(
      pathwayRecommendationController.overrideFinalizedDecision(req, makeRes()),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects an override that repeats the current finalized pathway', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue({
      id: 'decision-final',
      learnerId: 'learner-1',
      finalApprovedPathway: 'STEM',
    });
    const req = makeReq({
      user: { userId: 'admin-1', email: 'a@test.com', role: 'ADMIN', roles: ['ADMIN'] } as any,
      body: { finalApprovedPathway: 'STEM', reason: 'Reviewed after the final transition meeting' },
    });

    await expect(
      pathwayRecommendationController.overrideFinalizedDecision(req, makeRes()),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(saveDecisionMock).not.toHaveBeenCalled();
  });

  it('appends an audited override while preserving the prior decision fields', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue({
      id: 'decision-final',
      learnerId: 'learner-1',
      recommendedPathway: 'STEM',
      confidenceScore: 82,
      learnerInterest: 'ARTS_SPORTS',
      teacherRecommendation: 'STEM',
      parentPreference: 'ARTS_SPORTS',
      finalApprovedPathway: 'STEM',
      mismatchWarning: 'Family preference differs',
      analysisPayload: { version: 'GRADE9_READINESS_V1' },
    });
    saveDecisionMock.mockResolvedValue({ id: 'decision-override', finalApprovedPathway: 'ARTS_SPORTS' });
    databaseMock.learner.findUnique.mockResolvedValue({ admissionNumber: 'ADM-001', parentId: 'parent-1' });
    databaseMock.user.findUnique.mockResolvedValue({ id: 'student-1' });
    const req = makeReq({
      user: { userId: 'admin-1', email: 'a@test.com', role: 'ADMIN', roles: ['ADMIN'] } as any,
      body: {
        finalApprovedPathway: 'ARTS_SPORTS',
        reason: 'Approved after learner and parent review meeting',
      },
    });
    const res = makeRes();

    await pathwayRecommendationController.overrideFinalizedDecision(req, res);

    expect(saveDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      recommendedPathway: 'STEM',
      parentPreference: 'ARTS_SPORTS',
      finalApprovedPathway: 'ARTS_SPORTS',
      analysisPayload: expect.objectContaining({
        override: expect.objectContaining({
          previousPathway: 'STEM',
          reason: 'Approved after learner and parent review meeting',
          overriddenBy: 'admin-1',
        }),
      }),
    }));
    expect(notifyMock).toHaveBeenCalledTimes(2);
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      title: 'Finalized pathway updated',
      link: '/app/student-pathway-planner',
      metadata: expect.objectContaining({ event: 'DECISION_OVERRIDDEN', learnerId: 'learner-1' }),
    }));
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'parent-1',
      link: '/app/parent-portal-pathway',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
