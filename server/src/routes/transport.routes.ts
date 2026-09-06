import { Router } from 'express';
import { transportController } from '../controllers/transport.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Base PATH: /api/transport
router.use(authenticate);

// ── Summary / Stats ─────────────────────────────────────────────────────────
router.get('/summary', transportController.getSummary.bind(transportController));
router.get('/reports', transportController.getReports.bind(transportController));

// ── Fee Roster & Invoicing ──────────────────────────────────────────────────
router.get('/fee-roster',           transportController.getFeeRoster.bind(transportController));
router.post('/fee-roster/bill',      transportController.billSingleLearner.bind(transportController));
router.post('/fee-roster/bulk-bill', transportController.bulkBillLearners.bind(transportController));

// ── Vehicles ─────────────────────────────────────────────────────────────────
router.get('/vehicles',        transportController.getVehicles);
router.post('/vehicles',       transportController.createVehicle);
router.patch('/vehicles/:id',  transportController.updateVehicle);
router.delete('/vehicles/:id', transportController.deleteVehicle);

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/routes',        transportController.getRoutes);
router.post('/routes',       transportController.createRoute);
router.patch('/routes/:id',  transportController.updateRoute);
router.delete('/routes/:id', transportController.deleteRoute);

// ── Assignments ───────────────────────────────────────────────────────────────
// Specific learner lookup must come BEFORE :routeId to avoid route param collision
router.get('/assignments/learner/:learnerId', transportController.getLearnerAssignments);
router.get('/assignments/:routeId',           transportController.getAssignments);
router.post('/assignments',                   transportController.createAssignment);
router.patch('/assignments/:id',              transportController.updateAssignment);
router.delete('/assignments/:id',             transportController.deleteAssignment);

export default router;
