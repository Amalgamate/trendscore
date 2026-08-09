/**
 * pathwayPlanner.routes.ts
 *
 * Routes for the Pathway Planner module (Phases 2, 3, 4).
 *
 * Guard contract (applied here, not in index.ts):
 *   authenticate + requireInstitutionType('SECONDARY') already applied at mount.
 *   Per-route ownership checks are enforced inside the controller (assertAccess).
 *
 * Mount point: /api/pathway-planner
 */

import { Router } from 'express';
import { requireCsrf } from '../middleware/csrf.middleware';
import { requirePermission, requireRole, auditLog } from '../middleware/permissions.middleware';
import { requireLearnerPathwayAccess } from '../middleware/pathwayAccess.middleware';
import * as ctrl from '../controllers/pathwayPlanner.controller';
import { decisionPlanController } from '../controllers/decisionPlan.controller';
import { counsellorWorkspaceController } from '../controllers/counsellorWorkspace.controller';
import { pathwayAdminConsoleController as admin } from '../controllers/pathwayAdminConsole.controller';
import { requireLearnerPathwayStage } from '../middleware/pathwayStage.middleware';

const router = Router();

// ─── Administration console ─────────────────────────────────────────────────
router.get('/admin/dashboard', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.dashboard);
router.get('/admin/references/:type', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.listReferences);
router.get('/admin/references/:type/:id/impact', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.referenceImpact);
router.post('/admin/references/:type', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('SAVE_PATHWAY_REFERENCE'), admin.saveReference);
router.post('/admin/references/:type/:id/publish', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('PUBLISH_PATHWAY_REFERENCE'), admin.publishReference);
router.post('/admin/references/:type/:id/retire', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('RETIRE_PATHWAY_REFERENCE'), admin.retireReference);
router.get('/admin/versions', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.versions);
router.post('/admin/versions/:id/rollback', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('ROLLBACK_PATHWAY_REFERENCE'), admin.rollbackVersion);
router.get('/admin/rules', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.rules);
router.post('/admin/rules', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('CREATE_PATHWAY_RULE_VERSION'), admin.createRule);
router.post('/admin/rules/:id/publish', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('PUBLISH_PATHWAY_RULE_VERSION'), admin.publishRule);
router.get('/admin/imports', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.imports);
router.post('/admin/imports', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('UPLOAD_PATHWAY_IMPORT'), admin.createImport);
router.post('/admin/imports/:id/approve', requirePermission('MANAGE_PATHWAY_CATALOG'), requireCsrf, auditLog('APPROVE_PATHWAY_IMPORT'), admin.approveImport);
router.get('/admin/data-quality', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.dataQuality);
router.get('/admin/analytics', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.analytics);
router.get('/admin/audit-logs', requirePermission('MANAGE_PATHWAY_CATALOG'), admin.auditLogs);

// ─── Seed — super-admin only ──────────────────────────────────────────────────

router.post(
  '/seed-schools',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('SEED_SENIOR_SCHOOLS'),
  ctrl.seedSeniorSchools
);

// ─── Discover Me — learner-owned reflection profile ──────────────────────────
router.get('/learners/:learnerId/profile', requireLearnerPathwayAccess, ctrl.getPathwayProfile);
router.put('/learners/:learnerId/profile', requireLearnerPathwayAccess, requireCsrf, auditLog('SAVE_PATHWAY_PROFILE'), ctrl.savePathwayProfile);
router.get('/learners/:learnerId/conversation', requireLearnerPathwayAccess, ctrl.getPathwayConversation);
router.post('/learners/:learnerId/conversation', requireLearnerPathwayAccess, requireCsrf, auditLog('ADD_PATHWAY_CONVERSATION_MESSAGE'), ctrl.addPathwayConversationMessage);

// ─── Phase 2 — Counsellor notes ───────────────────────────────────────────────

router.get(
  '/learners/:learnerId/notes',
  ctrl.getCounsellorNotes
);

router.post(
  '/learners/:learnerId/notes',
  requirePermission('COUNSEL_PATHWAY'),
  requireCsrf,
  auditLog('ADD_COUNSELLOR_NOTE'),
  ctrl.addCounsellorNote
);

// ─── Phase 2 — Selection unlock ───────────────────────────────────────────────

router.get(
  '/learners/:learnerId/unlock',
  ctrl.getSelectionUnlock
);

router.post(
  '/learners/:learnerId/unlock',
  requirePermission('COUNSEL_PATHWAY'),
  requireCsrf,
  auditLog('UNLOCK_STUDENT_PATHWAY_SELECTION'),
  ctrl.unlockSelection
);

// ─── Phase 2 — Counsellor workbench summary ───────────────────────────────────

router.get(
  '/learners/:learnerId/counsellor-summary',
  requirePermission('VIEW_PATHWAY_CASES'),
  ctrl.getCounsellorSummary
);

router.get(
  '/classes/:classId/distribution',
  requirePermission('VIEW_PATHWAY_CASES'),
  ctrl.getClassPathwayDistribution
);

router.get(
  '/classes/:classId/learners',
  requirePermission('VIEW_PATHWAY_CASES'),
  ctrl.getClassLearners
);

// ─── Counsellor case management ─────────────────────────────────────────────

router.get(
  '/counsellor/dashboard',
  requirePermission('VIEW_PATHWAY_CASES'),
  counsellorWorkspaceController.getReport,
);

router.get(
  '/counsellor/interventions',
  requirePermission('VIEW_PATHWAY_CASES'),
  counsellorWorkspaceController.getInterventionQueue,
);

router.patch(
  '/counsellor/interventions/bulk',
  requirePermission('COUNSEL_PATHWAY'),
  requireCsrf,
  auditLog('BULK_UPDATE_PATHWAY_INTERVENTIONS'),
  counsellorWorkspaceController.bulkUpdateInterventions,
);

router.get(
  '/learners/:learnerId/case-management',
  requirePermission('VIEW_PATHWAY_CASES'),
  requireLearnerPathwayAccess,
  counsellorWorkspaceController.getCaseManagement,
);

router.get(
  '/learners/:learnerId/participant-progress',
  requireLearnerPathwayAccess,
  counsellorWorkspaceController.getParticipantProgress,
);

router.post(
  '/learners/:learnerId/actions',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('CREATE_PATHWAY_ACTION_ITEM'),
  counsellorWorkspaceController.createAction,
);

router.patch(
  '/learners/:learnerId/actions/:actionId',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('UPDATE_PATHWAY_ACTION_ITEM'),
  counsellorWorkspaceController.updateAction,
);

router.patch(
  '/learners/:learnerId/my-actions/:actionId',
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('UPDATE_OWN_PATHWAY_ACTION_ITEM'),
  counsellorWorkspaceController.updateOwnAction,
);

router.post(
  '/learners/:learnerId/sessions',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('SCHEDULE_PATHWAY_COUNSELLING_SESSION'),
  counsellorWorkspaceController.createSession,
);

router.patch(
  '/learners/:learnerId/sessions/:sessionId',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('UPDATE_PATHWAY_COUNSELLING_SESSION'),
  counsellorWorkspaceController.updateSession,
);

router.post(
  '/learners/:learnerId/interventions',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('CREATE_PATHWAY_INTERVENTION'),
  counsellorWorkspaceController.createIntervention,
);

router.patch(
  '/learners/:learnerId/interventions/:interventionId',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('UPDATE_PATHWAY_INTERVENTION'),
  counsellorWorkspaceController.updateIntervention,
);

router.post(
  '/learners/:learnerId/escalate',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('ESCALATE_PATHWAY_CASE'),
  counsellorWorkspaceController.escalate,
);

// ─── Phase 3 — Student-initiated selection ────────────────────────────────────

router.post(
  '/learners/:learnerId/selection',
  requireLearnerPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('STUDENT_SUBMIT_PATHWAY_SELECTION'),
  ctrl.submitStudentSelection
);

// ─── Stage 1 — Decision Plan lifecycle ───────────────────────────────────────

router.get(
  '/learners/:learnerId/decision-plan',
  requireLearnerPathwayAccess,
  decisionPlanController.get,
);

router.post(
  '/learners/:learnerId/decision-plan/submit',
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('SUBMIT_PATHWAY_DECISION_PLAN'),
  decisionPlanController.submit,
);

router.post(
  '/learners/:learnerId/decision-plan/parent-review',
  requireRole(['PARENT']),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('REVIEW_PATHWAY_DECISION_PLAN_AS_PARENT'),
  decisionPlanController.parentReview,
);

router.post(
  '/learners/:learnerId/decision-plan/counsellor-review',
  requirePermission('COUNSEL_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('REVIEW_PATHWAY_DECISION_PLAN_AS_COUNSELLOR'),
  decisionPlanController.counsellorReview,
);

router.post(
  '/learners/:learnerId/decision-plan/approve',
  requirePermission('APPROVE_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('APPROVE_PATHWAY_DECISION_PLAN'),
  decisionPlanController.approve,
);

router.post(
  '/learners/:learnerId/decision-plan/lock',
  requirePermission('LOCK_PATHWAY'),
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('LOCK_PATHWAY_DECISION_PLAN'),
  decisionPlanController.lock,
);

// ─── Phase 4 — Senior school catalogue ───────────────────────────────────────

router.get('/senior-schools', ctrl.searchSeniorSchools);

// Super-admin school catalogue management
router.post(
  '/senior-schools/seed',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('SEED_SENIOR_SCHOOL_CATALOG'),
  ctrl.seedSeniorSchools
);

router.post(
  '/senior-schools',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('UPSERT_SENIOR_SCHOOL'),
  ctrl.upsertSeniorSchool
);

router.patch(
  '/senior-schools/:schoolId/verification',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('VERIFY_SENIOR_SCHOOL'),
  ctrl.verifySeniorSchool,
);

router.post(
  '/senior-schools/:schoolId/corrections',
  requireCsrf,
  auditLog('SUBMIT_SENIOR_SCHOOL_CORRECTION'),
  ctrl.submitSchoolCorrection,
);

router.get(
  '/admin/school-corrections',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  ctrl.listSchoolCorrections,
);

router.post(
  '/admin/school-corrections/:correctionId/review',
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('REVIEW_SENIOR_SCHOOL_CORRECTION'),
  ctrl.reviewSchoolCorrection,
);

// ─── Phase 4 — School preferences (shortlist) ────────────────────────────────

router.get(
  '/learners/:learnerId/school-preferences',
  ctrl.getSchoolPreferences
);

router.put(
  '/learners/:learnerId/school-preferences',
  requireCsrf,
  auditLog('SAVE_SCHOOL_PREFERENCES'),
  ctrl.saveSchoolPreferences
);

// ─── Phase 4 — Family search preferences ─────────────────────────────────────

router.get(
  '/learners/:learnerId/family-preferences',
  ctrl.getFamilyPreferences
);

router.put(
  '/learners/:learnerId/family-preferences',
  requireCsrf,
  auditLog('SAVE_FAMILY_PREFERENCES'),
  ctrl.saveFamilyPreferences
);

router.get(
  '/learners/:learnerId/school-matches',
  requireLearnerPathwayAccess,
  ctrl.getSchoolMatches,
);

router.post(
  '/learners/:learnerId/school-matches/recalculate',
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('RECALCULATE_SCHOOL_MATCHES'),
  ctrl.recalculateSchoolMatches,
);

router.get(
  '/learners/:learnerId/school-matches/compare',
  requireLearnerPathwayAccess,
  ctrl.compareSchoolMatches,
);

export default router;
