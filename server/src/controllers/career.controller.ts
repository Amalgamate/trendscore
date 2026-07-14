/**
 * career.controller.ts
 * Thin controller layer for Career Explorer (SPEC-005).
 * Business logic lives in career.service.ts.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { careerService } from '../services/career.service';
import { parentAccessService } from '../services/parent-access.service';
import prisma from '../config/database';

// ─── Ownership helper ─────────────────────────────────────────────────────────

async function assertLearnerAccess(req: AuthRequest, learnerId: string): Promise<void> {
  const role   = req.user?.role ?? '';
  const userId = req.user?.userId;

  if (role === 'STUDENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const self = user?.username
      ? await prisma.learner.findUnique({ where: { admissionNumber: user.username }, select: { id: true } })
      : null;
    if (!self || self.id !== learnerId) throw new ApiError(403, 'Access denied');
    return;
  }
  if (role === 'PARENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const ids = await parentAccessService.getAccessibleLearnerIds(userId);
    if (!ids.includes(learnerId)) throw new ApiError(403, 'Access denied');
    return;
  }
}

const isAdmin = (role: string) =>
  ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(role);

// ─── Controllers ─────────────────────────────────────────────────────────────

export const careerController = {

  // GET /careers  — public browse (no learner context)
  listCareers: async (req: AuthRequest, res: Response) => {
    const { query, familyId, pathway, status, page, limit } = req.query as Record<string, string>;
    const result = await careerService.listCareers({
      query,
      familyId,
      recommendedPathway: pathway,
      verificationStatus: status,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    res.json({ success: true, ...result });
  },

  // GET /careers/families
  listFamilies: async (_req: AuthRequest, res: Response) => {
    const families = await careerService.listFamilies();
    res.json({ success: true, data: families });
  },

  compareCareers: async (req: AuthRequest, res: Response) => {
    const careerIds = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const learnerId = req.query.learnerId ? String(req.query.learnerId) : undefined;
    if (learnerId) await assertLearnerAccess(req, learnerId);
    const rows = await careerService.compareCareers(careerIds, learnerId);
    res.json({ success: true, data: rows });
  },

  // GET /careers/:careerId
  getCareer: async (req: AuthRequest, res: Response) => {
    const career = await careerService.getCareer(req.params.careerId);
    res.json({ success: true, data: career });
  },

  // POST /careers  — admin only
  createCareer: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const career = await careerService.createCareer(req.body);
    res.status(201).json({ success: true, data: career });
  },

  // POST /careers/seed  — admin only
  seedCareers: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const { seedCareers } = await import('../services/career-seed.service');
    const result = await seedCareers();
    res.json({ success: true, message: 'Career catalogue seeded', data: result });
  },

  // PATCH /careers/:careerId  — admin only
  updateCareer: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const career = await careerService.updateCareer(req.params.careerId, req.body);
    res.json({ success: true, data: career });
  },

  publishCareer: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const career = await careerService.publishCareer(req.params.careerId);
    res.json({ success: true, data: career });
  },

  retireCareer: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const career = await careerService.retireCareer(req.params.careerId);
    res.json({ success: true, data: career });
  },

  // POST /careers/families  — admin only
  createFamily: async (req: AuthRequest, res: Response) => {
    if (!isAdmin(req.user?.role ?? '')) throw new ApiError(403, 'Admin access required');
    const family = await careerService.createFamily(req.body);
    res.status(201).json({ success: true, data: family });
  },

  // ─── Learner-scoped endpoints ───────────────────────────────────────────────

  // GET /learners/:learnerId/career-matches
  getLearnerMatches: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    const matches = await careerService.getLearnerMatches(learnerId);
    res.json({ success: true, data: matches });
  },

  // POST /learners/:learnerId/career-matches/recalculate
  recalculateMatches: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    await assertLearnerAccess(req, learnerId);

    // Pull latest recommendation for this learner
    const latestRec = await prisma.learnerPathwayRecommendation.findFirst({
      where:   { learnerId },
      orderBy: { createdAt: 'desc' },
      select:  { recommendedPathway: true, confidenceScore: true },
    });

    const matches = await careerService.generateCareerMatches({
      learnerId,
      recommendedPathway: latestRec?.recommendedPathway ?? undefined,
      confidenceScore:    latestRec?.confidenceScore    ?? 0,
    });

    res.json({ success: true, data: matches.slice(0, 30), total: matches.length });
  },

  // GET /learners/:learnerId/saved-careers
  getSavedCareers: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    const saved = await careerService.getSavedCareers(learnerId);
    res.json({ success: true, data: saved });
  },

  getCombinationImpact: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    const careerIds = String(req.query.careerIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const combinationIds = String(req.query.combinationIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const rows = await careerService.combinationImpact(careerIds, combinationIds);
    res.json({ success: true, data: rows });
  },

  // POST /learners/:learnerId/saved-careers
  saveCareer: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    const { careerId, note } = req.body as { careerId: string; note?: string };
    if (!careerId) throw new ApiError(400, 'careerId is required');
    const saved = await careerService.saveCareer(
      learnerId, careerId,
      req.user?.userId ?? 'system',
      req.user?.role   ?? 'STUDENT',
      note,
    );
    res.status(201).json({ success: true, data: saved });
  },

  // PATCH /learners/:learnerId/saved-careers/:careerId
  updateSave: async (req: AuthRequest, res: Response) => {
    const { learnerId, careerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    const updated = await careerService.updateSave(learnerId, careerId, req.body);
    res.json({ success: true, data: updated });
  },

  // DELETE /learners/:learnerId/saved-careers/:careerId
  removeCareer: async (req: AuthRequest, res: Response) => {
    const { learnerId, careerId } = req.params;
    await assertLearnerAccess(req, learnerId);
    await careerService.removeSave(learnerId, careerId);
    res.json({ success: true });
  },
};
