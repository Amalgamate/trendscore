/**
 * Boarding Routes — /api/v1/boarding/
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { boardingController } from '../domains/boarding/boarding.controller';

const router = Router();

// ── Dormitories ───────────────────────────────────────────────────────────────
router.get('/',                authenticate, requirePermission('VIEW_BOARDING'),         asyncHandler(boardingController.getDashboard.bind(boardingController)));
router.get('/dormitories',     authenticate, requirePermission('VIEW_BOARDING'),         asyncHandler(boardingController.getDormitories.bind(boardingController)));
router.post('/dormitories',    authenticate, requirePermission('MANAGE_DORMITORIES'),    asyncHandler(boardingController.createDormitory.bind(boardingController)));
router.patch('/dormitories/:id', authenticate, requirePermission('MANAGE_DORMITORIES'), asyncHandler(boardingController.updateDormitory.bind(boardingController)));

// ── Beds ──────────────────────────────────────────────────────────────────────
router.get('/dormitories/:dormitoryId/beds',  authenticate, requirePermission('VIEW_BOARDING'),       asyncHandler(boardingController.getBeds.bind(boardingController)));
router.post('/dormitories/:dormitoryId/beds', authenticate, requirePermission('MANAGE_DORMITORIES'),  asyncHandler(boardingController.createBed.bind(boardingController)));

// ── Assignments ───────────────────────────────────────────────────────────────
router.post('/assignments',                   authenticate, requirePermission('ASSIGN_DORMITORY_BEDS'), asyncHandler(boardingController.assignLearner.bind(boardingController)));
router.get('/assignments/learner/:learnerId', authenticate, requirePermission('VIEW_BOARDING'),         asyncHandler(boardingController.getLearnerAssignment.bind(boardingController)));

// ── House Masters ─────────────────────────────────────────────────────────────
router.post('/house-masters',                          authenticate, requirePermission('MANAGE_HOUSE_MASTERS'), asyncHandler(boardingController.assignHouseMaster.bind(boardingController)));
router.get('/dormitories/:dormitoryId/house-masters',  authenticate, requirePermission('VIEW_BOARDING'),        asyncHandler(boardingController.getHouseMasters.bind(boardingController)));

// ── Exeat ─────────────────────────────────────────────────────────────────────
router.get('/exeat',                         authenticate, requirePermission('VIEW_BOARDING'),         asyncHandler(boardingController.getExeats.bind(boardingController)));
router.post('/exeat',                        authenticate, requireAnyPermission(['MANAGE_EXEAT_REQUESTS','SUBMIT_EXEAT_REQUEST']), asyncHandler(boardingController.requestExeat.bind(boardingController)));
router.post('/exeat/:exeatId/approve',       authenticate, requirePermission('MANAGE_EXEAT_REQUESTS'), asyncHandler(boardingController.approveExeat.bind(boardingController)));
router.post('/exeat/:exeatId/depart',        authenticate, requirePermission('MANAGE_EXEAT_REQUESTS'), asyncHandler(boardingController.recordDeparture.bind(boardingController)));
router.post('/exeat/:exeatId/return',        authenticate, requirePermission('MANAGE_EXEAT_REQUESTS'), asyncHandler(boardingController.recordReturn.bind(boardingController)));

// ── Roll Call ─────────────────────────────────────────────────────────────────
router.post('/roll-calls',                             authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.startRollCall.bind(boardingController)));
router.get('/roll-calls/:rollCallId',                  authenticate, requirePermission('VIEW_BOARDING'),     asyncHandler(boardingController.getRollCall.bind(boardingController)));
router.post('/roll-calls/:rollCallId/entries',         authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.markEntry.bind(boardingController)));
router.post('/roll-calls/:rollCallId/entries/bulk',    authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.bulkMarkEntries.bind(boardingController)));
router.post('/roll-calls/:rollCallId/complete',        authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.completeRollCall.bind(boardingController)));

// ── Dining ────────────────────────────────────────────────────────────────────
router.post('/dining',      authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.markDining.bind(boardingController)));
router.post('/dining/bulk', authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.bulkMarkDining.bind(boardingController)));

// ── Prep ──────────────────────────────────────────────────────────────────────
router.post('/prep', authenticate, requirePermission('CONDUCT_ROLL_CALL'), asyncHandler(boardingController.markPrep.bind(boardingController)));

export default router;
