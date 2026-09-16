/**
 * Report Template Routes
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 */

import express from 'express';
import { reportTemplateController } from '../controllers/reportTemplateController';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = express.Router();

/**
 * List selectable report templates.
 * GET /api/report-templates
 */
router.get(
  '/',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  reportTemplateController.listTemplates
);

/**
 * Get one report template by id (includes retired templates).
 * GET /api/report-templates/:id
 */
router.get(
  '/:id',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  reportTemplateController.getTemplate
);

export default router;
