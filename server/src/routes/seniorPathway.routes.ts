import { Router } from 'express';
import { seniorPathwayController } from '../controllers/seniorPathway.controller';
import { auditLog, requireRole } from '../middleware/permissions.middleware';

const router = Router();

router.get('/catalog', seniorPathwayController.getCatalog);
router.get('/combinations', seniorPathwayController.getCombinations);
router.get('/offerings', seniorPathwayController.getSchoolOfferings);
router.get('/school-offerings', seniorPathwayController.getSchoolOfferings);
router.get('/learners/:learnerId/selection', seniorPathwayController.getLearnerSelection);
router.get('/learners/:learnerId/legacy-preview', seniorPathwayController.previewLegacySelection);
router.get('/selections/:id/history', seniorPathwayController.getSelectionHistory);

router.post(
  '/seed',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  auditLog('SEED_SENIOR_PATHWAY_OFFICIAL_CATALOG'),
  seniorPathwayController.seedCatalog
);

router.post('/validate-selection', seniorPathwayController.validateSelection);

router.put(
  '/offerings',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('UPDATE_SENIOR_SCHOOL_OFFERINGS'),
  seniorPathwayController.updateSchoolOfferings
);

router.put(
  '/school-offerings',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('UPDATE_SENIOR_SCHOOL_OFFERINGS'),
  seniorPathwayController.updateSchoolOfferings
);

router.post(
  '/selections',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('SAVE_SENIOR_PATHWAY_SELECTION_DRAFT'),
  seniorPathwayController.saveSelection
);

router.post(
  '/selections/:id/submit',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('SUBMIT_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.submitSelection
);

router.post(
  '/selections/:id/approve',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('APPROVE_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.approveSelection
);

router.post(
  '/selections/:id/lock',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('LOCK_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.lockSelection
);

export default router;
