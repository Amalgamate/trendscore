/**
 * pathway.routes.ts
 *
 * Routes for Senior Secondary pathway and subject-selection catalogue.
 *
 * Guard contract:
 *   - authenticate                        — applied in index.ts
 *   - requireInstitutionType('SECONDARY') — applied in index.ts at mount point
 *   - requireRole                         — applied per-route here for write endpoints
 *
 * Read endpoints (GET) are intentionally open to all authenticated users in a
 * SECONDARY context so that the catalogue can be displayed to teachers, heads,
 * and admins without extra guard friction.
 */

import { Router } from 'express';
import { pathwayController } from '../controllers/pathway.controller';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { requireInstitutionType } from '../middleware/requireInstitutionType.middleware';
import { requireLearnerPathwayStage } from '../middleware/pathwayStage.middleware';

const router = Router();

// authenticate + requireInstitutionType('SECONDARY') already applied by index.ts

/**
 * @route  POST /api/pathways/seed
 * @desc   Seed the Senior Secondary pathway catalogue (idempotent)
 * @access SUPER_ADMIN, ADMIN
 */
router.post(
  '/seed',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  auditLog('SEED_PATHWAYS_CATALOG'),
  pathwayController.seedPathwaysCatalog
);

/**
 * @route  GET /api/pathways/integrity
 * @desc   Run pathway catalog integrity checks (duplicate/conflicting mappings)
 * @access SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/integrity',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  pathwayController.getCatalogIntegrity
);

/**
 * @route  GET /api/pathways
 * @desc   List all active pathways
 * @access Any authenticated user in SECONDARY context
 */
router.get('/', pathwayController.listPathways);

/**
 * @route  GET /api/pathways/:code/categories
 * @desc   Get subject categories for a pathway
 * @access Any authenticated user in SECONDARY context
 */
router.get('/:code/categories', pathwayController.getPathwayCategories);

/**
 * @route  GET /api/pathways/learner/:learnerId
 * @desc   Get learner's current pathway and subject selections
 * @access Any authenticated user in SECONDARY context
 */
router.get('/learner/:learnerId', pathwayController.getLearnerPathwayAndSubjects);

/**
 * @route  POST /api/pathways/learner/:learnerId/pathway
 * @desc   Set a learner's pathway
 * @access SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/learner/:learnerId/pathway',
  requireInstitutionType('SECONDARY'),
  requireLearnerPathwayStage(['SENIOR_EXECUTION']),
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('SET_LEARNER_PATHWAY'),
  pathwayController.setLearnerPathway
);

/**
 * @route  POST /api/pathways/learner/:learnerId/subjects
 * @desc   Set a learner's subject selections
 * @access SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/learner/:learnerId/subjects',
  requireInstitutionType('SECONDARY'),
  requireLearnerPathwayStage(['SENIOR_EXECUTION']),
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('SET_LEARNER_SUBJECTS'),
  pathwayController.setLearnerSubjects
);

export default router;
