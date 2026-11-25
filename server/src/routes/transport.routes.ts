import { Router } from 'express';
import { transportController } from '../controllers/transport.controller';
import { authenticate } from '../middleware/auth.middleware';
import { auditLog, requirePermission } from '../middleware/permissions.middleware';

const router = Router();

// Base PATH: /api/transport
router.use(authenticate);

// ── Summary / Stats ─────────────────────────────────────────────────────────
router.get('/summary', requirePermission('MANAGE_TRANSPORT_TRIPS'), transportController.getSummary.bind(transportController));
router.get('/reports', requirePermission('MANAGE_TRANSPORT_TRIPS'), transportController.getReports.bind(transportController));

// ── Fee Roster & Invoicing ──────────────────────────────────────────────────
router.get('/fee-roster', requirePermission('FEE_MANAGEMENT'), transportController.getFeeRoster.bind(transportController));
router.post('/fee-roster/bill', requirePermission('FEE_MANAGEMENT'), auditLog('BILL_TRANSPORT_FEE'), transportController.billSingleLearner.bind(transportController));
router.post('/fee-roster/bulk-bill', requirePermission('FEE_MANAGEMENT'), auditLog('BULK_BILL_TRANSPORT_FEES'), transportController.bulkBillLearners.bind(transportController));

// ── Vehicles ─────────────────────────────────────────────────────────────────
router.get('/vehicles', requirePermission('MANAGE_TRANSPORT_TRIPS'), transportController.getVehicles);
router.post('/vehicles', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('CREATE_TRANSPORT_VEHICLE'), transportController.createVehicle);
router.patch('/vehicles/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('UPDATE_TRANSPORT_VEHICLE'), transportController.updateVehicle);
router.delete('/vehicles/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('DELETE_TRANSPORT_VEHICLE'), transportController.deleteVehicle);

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/routes', requirePermission('MANAGE_TRANSPORT_TRIPS'), transportController.getRoutes);
router.post('/routes', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('CREATE_TRANSPORT_ROUTE'), transportController.createRoute);
router.patch('/routes/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('UPDATE_TRANSPORT_ROUTE'), transportController.updateRoute);
router.delete('/routes/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('DELETE_TRANSPORT_ROUTE'), transportController.deleteRoute);

// ── Assignments ───────────────────────────────────────────────────────────────
// Specific learner lookup must come BEFORE :routeId to avoid route param collision
router.get('/assignments/learner/:learnerId', transportController.getLearnerAssignments);
router.get('/assignments/:routeId', requirePermission('MANAGE_TRANSPORT_TRIPS'), transportController.getAssignments);
router.post('/assignments', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('CREATE_TRANSPORT_ASSIGNMENT'), transportController.createAssignment);
router.patch('/assignments/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('UPDATE_TRANSPORT_ASSIGNMENT'), transportController.updateAssignment);
router.delete('/assignments/:id', requirePermission('MANAGE_TRANSPORT_TRIPS'), auditLog('DELETE_TRANSPORT_ASSIGNMENT'), transportController.deleteAssignment);

export default router;
