import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import * as tertiaryController from '../controllers/tertiary.controller';
import * as mpesaController from '../controllers/mpesa.controller';
import { requireAnyPermission } from '../middleware/permissions.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';

const router = Router();

// Ensure all tertiary routes require authentication
router.use(authenticate);

// ==========================================
// Departments
// ==========================================
// Assuming we require a specific permission. We'll use 'ACADEMIC_SETTINGS' or simply authenticate for now since Tertiary permissions aren't fully spec'd.
router.get('/departments', tertiaryController.getDepartments);
router.post('/departments', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.createDepartment);
router.patch('/departments/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.updateDepartment);
router.delete('/departments/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.deleteDepartment);

// ==========================================
// Programs
// ==========================================
router.get('/programs', tertiaryController.getPrograms);
router.post('/programs', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.createProgram);
router.patch('/programs/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.updateProgram);
router.delete('/programs/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.deleteProgram);

// ==========================================
// Units
// ==========================================
router.get('/units', tertiaryController.getUnits);
router.post('/units', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.createUnit);
router.patch('/units/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.updateUnit);
router.delete('/units/:id', requirePermission('ACADEMIC_SETTINGS'), tertiaryController.deleteUnit);

// ==========================================
// M-Pesa Payments
// ==========================================
router.post(
  '/payments/stkpush',
  requireSchoolContext,
  requireAnyPermission(['RECORD_PAYMENT', 'VIEW_OWN_BALANCE']),
  mpesaController.initiatePayment,
);

export default router;
