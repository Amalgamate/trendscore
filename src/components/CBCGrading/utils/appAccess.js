const PAGE_APP_REQUIREMENTS = {
  'planner-calendar': 'planner',
  'events-calendar': 'planner',
  'planner-agenda': 'planner',
  'planner-timetable': 'timetable',
  'planner-schemes': 'curriculum',
  'planner-duty-roster': 'planner',

  'learners-list': 'student-registry',
  'teacher-learner-analysis': 'student-registry',
  'learners-admissions': 'student-registry',
  'learners-transfers-in': 'student-registry',
  'learners-exited': 'student-registry',
  'learners-promotion': 'student-registry',
  'learners-transfer-out': 'student-registry',
  'learner-profile': 'student-registry',
  'learners-uniform': 'inventory',

  'attendance-daily': 'attendance',
  'attendance-reports': 'attendance',

  'assess-mobile-dashboard': 'gradebook',
  'assess-formative': 'gradebook',
  'assess-formative-report': 'gradebook',
  'assess-summative-tests': 'gradebook',
  'assess-summative-assessment': 'gradebook',
  'assess-values': 'gradebook',
  'assess-cocurricular': 'gradebook',
  'assess-core-competencies': 'gradebook',
  'assess-learning-areas': 'gradebook',
  'assess-performance-scale': 'gradebook',
  'assess-summative-report': 'exams',
  'assess-custom-reports': 'exams',
  'assess-summary-report': 'exams',
  'assess-subject-analysis': 'exams',
  'assess-print-center': 'exams',
  'assess-termly-report': 'exams',
  'academic-intelligence': 'exams',
  'academic-section-analysis': 'exams',
  'academic-subject-intelligence': 'exams',
  'academic-gender-analysis': 'exams',
  'academic-stream-analysis': 'exams',
  'academic-competency-analysis': 'exams',
  'academic-learner-risk': 'exams',
  'academic-growth-trends': 'exams',
  'academic-ai-insights': 'exams',
  'academic-top-bottom-performers': 'exams',

  'comm-notices': 'announcements',
  'comm-messages': 'sms-notifications',
  'comm-history': 'sms-notifications',

  'learning-hub-materials': 'lms',
  'learning-hub-assignments': 'lms',
  'learning-hub-lesson-plans': 'lms',
  'coding-playground': 'lms',
  'learning-hub-library': 'library',

  'lms-courses': 'lms',
  'lms-content': 'lms',
  'lms-enrollments': 'lms',
  'lms-progress': 'lms',
  'lms-reports': 'lms',
  'student-courses': 'lms',
  'student-assignments': 'lms',
  'student-progress': 'lms',
  'student-quizzes': 'lms',
  'student-course-view': 'lms',

  'hr-portal': 'staff-hr',
  'hr-staff-profiles': 'staff-hr',
  'hr-leave': 'staff-hr',
  'hr-payroll': 'payroll',
  'hr-documents': 'staff-hr',
  'hr-performance': 'staff-hr',

  'accounting-dashboard': 'accounting',
  'accounting-accounts': 'accounting',
  'accounting-entries': 'accounting',
  'accounting-expenses': 'accounting',
  'accounting-vendors': 'accounting',
  'accounting-reconciliation': 'accounting',
  'accounting-reports': 'accounting',
  'accounting-config': 'accounting',

  'inventory-items': 'inventory',
  'inventory-categories': 'inventory',
  'inventory-stores': 'inventory',
  'inventory-movements': 'inventory',
  'inventory-requisitions': 'inventory',
  'inventory-transfers': 'inventory',
  'inventory-adjustments': 'inventory',
  'inventory-assets': 'inventory',
  'inventory-class-assignments': 'inventory',

  'library-catalog': 'library',
  'library-circulation': 'library',
  'library-fees': 'library',
  'library-inventory': 'library',
  'library-members': 'library',

  'transport-routes': 'transport',
  'transport-tracking': 'transport',
  'transport-drivers': 'transport',
  'transport-students': 'transport',
  'hostel-fees': 'transport',
  'transport-reports': 'transport',

  'biometric-dashboard': 'biometric',
  'biometric-enrollment': 'biometric',
  'biometric-devices': 'biometric',
  'biometric-logs': 'biometric',
  'biometric-reports': 'biometric',
  'biometric-api': 'biometric',

  'fees-overview': 'fee-management',
  'fees-collection': 'fee-management',
  'finance-dashboard': 'fee-management',
  'fees-invoice-detail': 'fee-management',
  'fees-invoices': 'fee-management',
  'fees-record-payment': 'fee-management',
  'fees-structure': 'fee-management',
  'fees-types': 'fee-management',
  'fees-reports': 'fee-management',
  'fees-statements': 'fee-management',
  'fees-unmatched': 'fee-management',
};

const ROLE_PAGE_ALLOWLIST = {
  STUDENT: new Set([
    'dashboard',
    'student-courses',
    'student-assignments',
    'student-progress',
    'student-quizzes',
    'student-course-view',
    'student-profile',
    'settings-profile'
  ])
};

const PARENT_PORTAL_PAGES = new Set([
  'parent-portal-home',
  'parent-portal-children',
  'parent-portal-fees',
  'parent-portal-messages',
  'parent-portal-more',
  'parent-portal-results',
  'parent-portal-attendance',
  'parent-portal-transport',
  'parent-portal-documents',
  'parent-portal-support',
]);

const FINANCE_ROLES = new Set(['ACCOUNTANT']);
const STUDENT_ROLES = new Set(['STUDENT']);
const PARENT_PORTAL_PERMISSIONS = new Set([
  'VIEW_OWN_CHILDREN',
  'VIEW_CHILDREN_REPORTS',
  'VIEW_CHILDREN_ATTENDANCE',
  'VIEW_OWN_BALANCE',
]);

export const normalizeRole = (role) => String(role || '').trim().toUpperCase();

export const userHasParentPortalAccess = (user) => {
  if (normalizeRole(user?.role) === 'PARENT') return true;
  const roles = Array.isArray(user?.roles) ? user.roles.map(normalizeRole) : [];
  if (roles.includes('PARENT')) return true;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.some(permission => PARENT_PORTAL_PERMISSIONS.has(String(permission || '').trim().toUpperCase()));
};

export const isParentPortalPage = (page) => {
  const normalizedPage = page?.split('?')[0];
  return PARENT_PORTAL_PAGES.has(normalizedPage);
};

export const resolveDashboardPage = (user) => {
  const role = normalizeRole(user?.role);
  if (userHasParentPortalAccess(user)) return 'parent-portal-home';
  if (STUDENT_ROLES.has(role)) return 'dashboard';
  if (FINANCE_ROLES.has(role)) return 'finance-dashboard';
  return 'dashboard';
};

const SECONDARY_ONLY_PAGES = new Set([
  'sec-pathways',
  'sec-subjects',
  'sec-form-groups',
  'sec-schemes',
  'sec-mark-entry',
  'sec-cats',
  'sec-mid-term',
  'sec-end-term',
  'sec-kcse-mock',
  'sec-mean-grades',
  'sec-rankings',
  'sec-subject-analysis',
  'sec-report-cards',
  'sec-kcse-prediction',
]);

const TERTIARY_ONLY_PAGES = new Set([
  'tert-departments',
  'tert-programs',
  'tert-units',
  'tert-enrollment',
  'tert-cats',
  'tert-exams',
  'tert-mark-entry',
  'tert-grade-sheet',
  'tert-unit-results',
  'tert-gpa',
  'tert-semester-report',
  'tert-transcripts',
  'tert-classifications',
  'tert-clubs',
  'tert-clearance',
]);

const INSTITUTION_AGNOSTIC_PAGES = new Set([
  'dashboard',
  'help',
  'settings-school',
  'settings-users',
  'settings-system-logs',
  'settings-system-control',
  'settings-communication',
  'settings-payment',
  'settings-profile',
  'system-maintenance',
  'comm-notices',
  'comm-messages',
  'comm-history',
]);

const isInstitutionPageAllowed = (institutionTypeRaw, page) => {
  const institutionType = String(institutionTypeRaw || 'PRIMARY_CBC').toUpperCase();
  if (INSTITUTION_AGNOSTIC_PAGES.has(page)) return true;
  if (SECONDARY_ONLY_PAGES.has(page)) return institutionType === 'SECONDARY';
  if (TERTIARY_ONLY_PAGES.has(page)) return institutionType === 'TERTIARY';
  return institutionType === 'PRIMARY_CBC' || institutionType === 'SECONDARY' || institutionType === 'TERTIARY';
};

export const getRequiredAppForPage = (page) => {
  const normalizedPage = page?.split('?')[0];
  return PAGE_APP_REQUIREMENTS[normalizedPage] || null;
};

export const hasAppAccess = (user, slug) => {
  return true;
};

export const hasPageAccess = (user, page) => {
  const normalizedPage = page?.split('?')[0];
  const role = user?.role;
  const allowlist = role ? ROLE_PAGE_ALLOWLIST[role] : null;

  if (isParentPortalPage(normalizedPage) && !userHasParentPortalAccess(user)) {
    return false;
  }

  if (allowlist && !allowlist.has(normalizedPage)) {
    return false;
  }

  if (!isInstitutionPageAllowed(user?.institutionType, normalizedPage)) {
    return false;
  }

  return true;
};

export { PAGE_APP_REQUIREMENTS };
