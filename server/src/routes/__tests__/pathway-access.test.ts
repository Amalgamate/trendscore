/**
 * pathway-access.test.ts
 *
 * Unit tests for pathway role-based access controls.
 *
 * Tests the middleware and controller guard functions directly —
 * no Express app, no HTTP stack, no service chain startup overhead.
 *
 * Coverage:
 *   1. assertLearnerPathwayAccess middleware
 *      - PARENT: own child passes, stranger denied
 *      - STUDENT: own record passes, stranger denied
 *      - Staff roles: always pass
 *      - Unauthenticated: 401
 *
 *   2. requireInstitutionType middleware
 *      - SECONDARY institution passes SECONDARY guard
 *      - PRIMARY_CBC blocked by SECONDARY guard
 *
 *   3. pathwayRecommendation controller
 *      - saveTransitionDecision blocks PARENT role (403)
 *      - saveParentPreference blocks non-PARENT roles (403)
 *      - saveParentPreference validates pathway values (422)
 *      - saveParentPreference preserves staff fields from existing row
 */

/// <reference types="jest" />

// ── Prisma mock ───────────────────────────────────────────────────────────────
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user:    { findUnique: jest.fn() },
    learner: { findUnique: jest.fn(), findFirst: jest.fn() },
    learnerPathwayRecommendation: {
      findFirst: jest.fn(),
    },
    learnerPathwaySelectionUnlock: { findUnique: jest.fn() },
  },
}));

// ── Parent access service mock ────────────────────────────────────────────────
jest.mock('../../services/parent-access.service', () => ({
  parentAccessService: {
    canAccessLearner: jest.fn().mockImplementation(
      (_userId: string, learnerId: string) =>
        Promise.resolve(learnerId === 'child-1')
    ),
  },
}));

// ── Notification mock (fire-and-forget calls) ─────────────────────────────────
jest.mock('../../services/notification.service', () => ({
  NotificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
    notifyRoles:        jest.fn().mockResolvedValue([]),
  },
  NotificationType: { INFO: 'INFO', WARNING: 'WARNING' },
}));

// ── Transition decision service mock ─────────────────────────────────────────
jest.mock('../../services/pathway-transition-decision.service', () => ({
  saveTransitionDecision: jest.fn().mockResolvedValue({ id: 'rec-1', parentPreference: 'STEM' }),
  getTransitionDecisionHistory: jest.fn().mockResolvedValue([]),
  hasFinalizedTransitionDecision: jest.fn().mockResolvedValue(false),
}));

import prisma from '../../config/database';
import { assertLearnerPathwayAccess } from '../../middleware/pathwayAccess.middleware';
import { pathwayRecommendationController } from '../../controllers/pathwayRecommendation.controller';
import { requireInstitutionType } from '../../middleware/requireInstitutionType.middleware';
import { ApiError } from '../../utils/error.util';

const db = prisma as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, any> = {}) {
  return {
    user: { userId: 'user-1', role: 'PARENT' },
    params: {},
    body: {},
    school: { id: 'school-1', institutionType: 'PRIMARY_CBC' },
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const next = jest.fn();

// ─────────────────────────────────────────────────────────────────────────────
// 1. assertLearnerPathwayAccess middleware
// ─────────────────────────────────────────────────────────────────────────────

describe('assertLearnerPathwayAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 401 when no userId on request', async () => {
    const req = makeReq({ user: null });
    await expect(assertLearnerPathwayAccess(req, 'child-1'))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('allows SUPER_ADMIN unconditionally', async () => {
    const req = makeReq({ user: { userId: 'admin-1', role: 'SUPER_ADMIN' } });
    await expect(assertLearnerPathwayAccess(req, 'any-learner')).resolves.toBeUndefined();
  });

  it('allows HEAD_OF_CURRICULUM unconditionally', async () => {
    const req = makeReq({ user: { userId: 'staff-1', role: 'HEAD_OF_CURRICULUM' } });
    await expect(assertLearnerPathwayAccess(req, 'any-learner')).resolves.toBeUndefined();
  });

  it('allows TEACHER unconditionally', async () => {
    const req = makeReq({ user: { userId: 'teacher-1', role: 'TEACHER' } });
    await expect(assertLearnerPathwayAccess(req, 'any-learner')).resolves.toBeUndefined();
  });

  describe('STUDENT role', () => {
    beforeEach(() => {
      db.user.findUnique.mockResolvedValue({ id: 'user-2', username: 'ADM001' });
      db.learner.findUnique.mockImplementation(({ where }: any) =>
        where?.admissionNumber === 'ADM001'
          ? Promise.resolve({ id: 'student-1' })
          : Promise.resolve(null)
      );
    });

    it('allows STUDENT accessing their own record', async () => {
      const req = makeReq({ user: { userId: 'user-2', role: 'STUDENT' } });
      await expect(assertLearnerPathwayAccess(req, 'student-1')).resolves.toBeUndefined();
    });

    it('throws 403 when STUDENT accesses another learner', async () => {
      const req = makeReq({ user: { userId: 'user-2', role: 'STUDENT' } });
      await expect(assertLearnerPathwayAccess(req, 'stranger-1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('PARENT role', () => {
    it('allows PARENT accessing their own child', async () => {
      const req = makeReq({ user: { userId: 'user-1', role: 'PARENT' } });
      await expect(assertLearnerPathwayAccess(req, 'child-1')).resolves.toBeUndefined();
    });

    it('throws 403 when PARENT accesses someone else\'s child', async () => {
      const req = makeReq({ user: { userId: 'user-1', role: 'PARENT' } });
      await expect(assertLearnerPathwayAccess(req, 'stranger-1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  it('throws 403 for unknown role', async () => {
    const req = makeReq({ user: { userId: 'user-x', role: 'UNKNOWN' } });
    await expect(assertLearnerPathwayAccess(req, 'child-1'))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. requireInstitutionType middleware
// ─────────────────────────────────────────────────────────────────────────────

describe('requireInstitutionType', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next() when institution type matches', () => {
    const req = makeReq({ resolvedInstitutionType: 'SECONDARY' });
    const guard = requireInstitutionType('SECONDARY');
    guard(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // no error argument
  });

  it('calls next(ApiError 403) when institution type does not match', () => {
    const req = makeReq({ resolvedInstitutionType: 'PRIMARY_CBC' });
    const guard = requireInstitutionType('SECONDARY');
    guard(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it('treats missing resolvedInstitutionType as a mismatch (403)', () => {
    const req = makeReq({ resolvedInstitutionType: undefined });
    const guard = requireInstitutionType('SECONDARY');
    guard(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. pathwayRecommendationController role guards
// ─────────────────────────────────────────────────────────────────────────────

describe('pathwayRecommendationController.saveTransitionDecision', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ApiError 403 when called by a PARENT (must use /parent-preference)', async () => {
    const req = makeReq({
      user: { userId: 'user-1', role: 'PARENT' },
      params: { learnerId: 'child-1' },
      body:   { recommendedPathway: 'STEM', confidenceScore: 80 },
    });
    await expect(pathwayRecommendationController.saveTransitionDecision(req, makeRes()))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/parent-preference/i) });
  });

  it('proceeds (no throw) for HEAD_OF_CURRICULUM with valid body', async () => {
    const req = makeReq({
      user: { userId: 'staff-1', role: 'HEAD_OF_CURRICULUM' },
      params: { learnerId: 'child-1' },
      body:   { recommendedPathway: 'STEM', confidenceScore: 75 },
    });
    db.learner.findUnique.mockResolvedValue({ id: 'child-1', admissionNumber: null, parentId: null });
    const { saveTransitionDecision } = require('../../services/pathway-transition-decision.service');
    saveTransitionDecision.mockResolvedValue({ id: 'rec-1', recommendedPathway: 'STEM' });
    // Should resolve without throwing 403
    await expect(pathwayRecommendationController.saveTransitionDecision(req, makeRes()))
      .resolves.not.toThrow();
  });

  it('throws ApiError 403 when TEACHER tries to set finalApprovedPathway', async () => {
    const req = makeReq({
      user: { userId: 'teacher-1', role: 'TEACHER' },
      params: { learnerId: 'child-1' },
      body:   { recommendedPathway: 'STEM', finalApprovedPathway: 'STEM', confidenceScore: 80 },
    });
    await expect(pathwayRecommendationController.saveTransitionDecision(req, makeRes()))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('pathwayRecommendationController.saveParentPreference', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ApiError 403 when called by a TEACHER (parent endpoint only)', async () => {
    const req = makeReq({
      user: { userId: 'teacher-1', role: 'TEACHER' },
      params: { learnerId: 'child-1' },
      body:   { parentPreference: 'STEM' },
    });
    await expect(pathwayRecommendationController.saveParentPreference(req, makeRes()))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws ApiError 403 when called by HEAD_OF_CURRICULUM', async () => {
    const req = makeReq({
      user: { userId: 'staff-1', role: 'HEAD_OF_CURRICULUM' },
      params: { learnerId: 'child-1' },
      body:   { parentPreference: 'STEM' },
    });
    await expect(pathwayRecommendationController.saveParentPreference(req, makeRes()))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws ApiError 422 for an invalid pathway code', async () => {
    const req = makeReq({
      user: { userId: 'user-1', role: 'PARENT' },
      params: { learnerId: 'child-1' },
      body:   { parentPreference: 'INVALID_CODE' },
    });
    await expect(pathwayRecommendationController.saveParentPreference(req, makeRes()))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('resolves without error for all valid pathway codes', async () => {
    db.learner.findUnique.mockResolvedValue({ id: 'child-1', admissionNumber: null, parentId: null });

    for (const code of ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS', '']) {
      jest.clearAllMocks();
      db.learnerPathwayRecommendation.findFirst.mockResolvedValue({
        id: 'rec-1', recommendedPathway: 'STEM', confidenceScore: 75,
        learnerInterest: null, teacherRecommendation: null, parentPreference: null,
        finalApprovedPathway: null, mismatchWarning: null, analysisPayload: null,
      });
      db.learner.findUnique.mockResolvedValue({ id: 'child-1', admissionNumber: null, parentId: null });

      const req = makeReq({
        user:   { userId: 'user-1', role: 'PARENT' },
        params: { learnerId: 'child-1' },
        body:   { parentPreference: code },
      });
      await expect(pathwayRecommendationController.saveParentPreference(req, makeRes()))
        .resolves.not.toThrow();
    }
  });

  it('preserves existing staff fields and only updates parentPreference', async () => {
    const existingRec = {
      id: 'rec-1',
      recommendedPathway:    'SOCIAL_SCIENCES',
      confidenceScore:       68,
      learnerInterest:       'STEM',
      teacherRecommendation: 'STEM',
      parentPreference:      null,
      finalApprovedPathway:  null,
      mismatchWarning:       null,
      analysisPayload:       { clusterBreakdown: { STEM: 55 } },
    };
    db.learnerPathwayRecommendation.findFirst.mockResolvedValue(existingRec);
    db.learner.findUnique.mockResolvedValue({ id: 'child-1', admissionNumber: null, parentId: null });

    const { saveTransitionDecision } = require('../../services/pathway-transition-decision.service');

    const req = makeReq({
      user:   { userId: 'user-1', role: 'PARENT' },
      params: { learnerId: 'child-1' },
      body:   { parentPreference: 'ARTS_SPORTS' },
    });
    await pathwayRecommendationController.saveParentPreference(req, makeRes());

    expect(saveTransitionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendedPathway:    'SOCIAL_SCIENCES',
        confidenceScore:       68,
        learnerInterest:       'STEM',
        teacherRecommendation: 'STEM',
        parentPreference:      'ARTS_SPORTS',
      })
    );
  });
});
