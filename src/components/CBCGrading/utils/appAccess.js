const PAGE_APP_REQUIREMENTS = {
  'planner-calendar': 'planner',
  'events-calendar': 'planner',
  'planner-agenda': 'planner',
  'planner-timetable': 'timetable',
  'planner-schemes': 'curriculum',
  'planner-duty-roster': 'planner',

  'learners-list': 'student-registry',
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
  'assess-termly-report': 'exams',

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

  'fees-collection': 'fee-management',
  'fees-invoice-detail': 'fee-management',
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
    'student-course-view'
  ])
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
  'settings-communication',
  'settings-payment',
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

export const getUserActiveApps = (user) => user?.activeApps || [];

export const getRequiredAppForPage = (page) => {
  const normalizedPage = page?.split('?')[0];
  return PAGE_APP_REQUIREMENTS[normalizedPage] || null;
};

export const hasAppAccess = (user, slug) => {
  if (!slug) return true;
  if (user?.role === 'SUPER_ADMIN') return true;
  if (!Array.isArray(user?.activeApps)) return true;
  return getUserActiveApps(user).includes(slug);
};

export const hasPageAccess = (user, page) => {
  const normalizedPage = page?.split('?')[0];
  const role = user?.role;
  const allowlist = role ? ROLE_PAGE_ALLOWLIST[role] : null;

  if (allowlist && !allowlist.has(normalizedPage)) {
    return false;
  }

  if (!isInstitutionPageAllowed(user?.institutionType, normalizedPage)) {
    return false;
  }

  return hasAppAccess(user, getRequiredAppForPage(normalizedPage));
};

export { PAGE_APP_REQUIREMENTS };
