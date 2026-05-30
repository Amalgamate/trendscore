/**
 * learningArea.routes.ts
 *
 * Guard contract:
 *   - authenticate — applied once in index.ts; NOT repeated here
 *   - requireRole  — applied per-route for mutation endpoints
 *
 * NOTE: The GET / listing endpoint does NOT carry a requireInstitutionType guard
 * here.  The controller is responsible for scoping results to
 * req.resolvedInstitutionType so that Secondary callers see Secondary learning
 * areas and Primary callers see Primary learning areas.
 * (Data-level filtering is Chunk 6; do not add an institution guard here that
 * would break Primary flows while Secondary is being fixed.)
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  getLearningAreas,
  getLearningArea,
  createLearningArea,
  updateLearningArea,
  deleteLearningArea,
  seedLearningAreas
} from '../controllers/learningArea.controller';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const createLearningAreaSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().min(1).max(20).optional(),
  gradeLevel: z.string().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().max(500).optional(),
  isCore: z.boolean().optional(),
  pathway: z.string().optional(),
  category: z.string().optional(),
  pathwayId: z.string().optional(),
  categoryId: z.string().optional(),
  // strip legacy / multi-tenant fields silently
  code: z.string().optional(),
  schoolId: z.string().optional(),
});

const updateLearningAreaSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  shortName: z.string().min(1).max(20).optional(),
  gradeLevel: z.string().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().max(500).optional(),
  isCore: z.boolean().optional(),
  pathway: z.string().optional(),
  category: z.string().optional(),
  pathwayId: z.string().optional(),
  categoryId: z.string().optional(),
});

// authenticate is applied in index.ts — do NOT add router.use(authenticate) here

// ── GET /api/learning-areas ─────────────────────────────────────────────────
router.get(
  '/',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  getLearningAreas
);

// ── POST /api/learning-areas/seed/default ───────────────────────────────────
// MUST be declared before /:id routes to avoid Express treating "seed" as an id
router.post(
  '/seed/default',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SEED_LEARNING_AREAS'),
  seedLearningAreas
);

// ── POST /api/learning-areas ────────────────────────────────────────────────
router.post(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createLearningAreaSchema),
  auditLog('CREATE_LEARNING_AREA'),
  createLearningArea
);

// ── GET /api/learning-areas/:id ─────────────────────────────────────────────
router.get(
  '/:id',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  getLearningArea
);

// ── PUT /api/learning-areas/:id ─────────────────────────────────────────────
router.put(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(updateLearningAreaSchema),
  auditLog('UPDATE_LEARNING_AREA'),
  updateLearningArea
);

// ── DELETE /api/learning-areas/:id ──────────────────────────────────────────
router.delete(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_LEARNING_AREA'),
  deleteLearningArea
);

export default router;
