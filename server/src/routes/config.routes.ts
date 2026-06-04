import { Router } from 'express';
import { z } from 'zod';
import { configController } from '../controllers/config.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  validateTermConfig,
  validateAggregationConfig,
  validateCompleteTermConfig,
  validateCompleteAggregationConfig
} from '../middleware/config.validation';

const router = Router();

// Protect all routes
router.use(authenticate);

// ============================================
// TERM CONFIGURATION ROUTES
// ============================================

/**
 * @route   GET /api/config/term
 * @desc    Get all term configurations
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/term',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getTermConfigs
);

/**
 * @route   GET /api/config/term/active
 * @desc    Get active term configuration
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, TEACHER, ACCOUNTANT
 */
router.get(
  '/term/active',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getActiveTermConfig
);

/**
 * @route   GET /api/config/term/:term/:year
 * @desc    Get specific term configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/term/:term/:year',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getSpecificTermConfig
);

/**
 * @route   POST /api/config/term
 * @desc    Create or update term configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/term',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validateCompleteTermConfig,
  auditLog('UPSERT_TERM_CONFIG'),
  configController.upsertTermConfig
);

/**
 * @route   PUT /api/config/term/:id
 * @desc    Update term configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.put(
  '/term/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validateTermConfig,
  auditLog('UPDATE_TERM_CONFIG'),
  configController.updateTermConfig
);

// ============================================
// AGGREGATION CONFIGURATION ROUTES
// ============================================

/**
 * @route   GET /api/config/aggregation
 * @desc    Get all aggregation configurations
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/aggregation',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getAggregationConfigs
);

/**
 * @route   GET /api/config/aggregation/:assessmentType
 * @desc    Get specific aggregation configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/aggregation/:assessmentType',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getSpecificAggregationConfig
);

/**
 * @route   POST /api/config/aggregation
 * @desc    Create aggregation configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/aggregation',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validateCompleteAggregationConfig,
  auditLog('CREATE_AGGREGATION_CONFIG'),
  configController.createAggregationConfig
);

/**
 * @route   PUT /api/config/aggregation/:id
 * @desc    Update aggregation configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.put(
  '/aggregation/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validateAggregationConfig,
  auditLog('UPDATE_AGGREGATION_CONFIG'),
  configController.updateAggregationConfig
);

/**
 * @route   DELETE /api/config/aggregation/:id
 * @desc    Delete aggregation configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.delete(
  '/aggregation/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_AGGREGATION_CONFIG'),
  configController.deleteAggregationConfig
);

// ============================================
// STREAM CONFIGURATION ROUTES
// ============================================

/**
 * @route   GET /api/config/streams
 * @desc    Get stream configurations
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, TEACHER
 */
router.get(
  '/streams',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER', 'TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getStreamConfigs
);

/**
 * @route   POST /api/config/streams
 * @desc    Create or update stream configuration
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.post(
  '/streams',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('UPSERT_STREAM_CONFIG'),
  configController.upsertStreamConfig
);

/**
 * @route   DELETE /api/config/streams/:id
 * @desc    Delete stream configuration
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.delete(
  '/streams/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_STREAM_CONFIG'),
  configController.deleteStreamConfig
);

/**
 * @route   POST /api/config/streams/seed
 * @desc    Seed default streams
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.post(
  '/streams/seed',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SEED_STREAMS'),
  configController.seedStreams
);

// ============================================
// CLASS MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/config/classes
 * @desc    Get classes
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, TEACHER
 */
router.get(
  '/classes',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER', 'TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getClasses
);

/**
 * @route   POST /api/config/classes
 * @desc    Create or update class
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.post(
  '/classes',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('UPSERT_CLASS'),
  configController.upsertClass
);

/**
 * @route   DELETE /api/config/classes/:id
 * @desc    Delete class
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.delete(
  '/classes/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_CLASS'),
  configController.deleteClass
);

/**
 * @route   POST /api/config/classes/seed
 * @desc    Seed default classes
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.post(
  '/classes/seed',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SEED_CLASSES'),
  configController.seedClasses
);

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * @route   GET /api/config/grades
 * @desc    Get available grades
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, TEACHER
 */
router.get(
  '/grades',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getGrades
);

/**
 * @route   GET /api/config/summary
 * @desc    Get configuration summary
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/summary',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  configController.getConfigurationSummary
);

/**
 * @route   GET /api/config/strategies
 * @desc    Get available strategies
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/strategies',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  configController.getAvailableStrategies
);

/**
 * @route   POST /api/config/recalculate-class
 * @desc    Recalculate class scores
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/recalculate-class',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('RECALCULATE_CLASS_SCORES'),
  configController.recalculateClassScores
);

export default router;
