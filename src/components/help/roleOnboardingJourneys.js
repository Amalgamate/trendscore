export const ONBOARDING_VERSION = 1;

export const roleOnboardingJourneys = {
  SUPER_ADMIN: {
    id: 'administrator-start', title: 'Administrator Getting Started', landingPages: ['dashboard'],
    intro: 'Set up the school foundation in the right order before operational work begins.',
    steps: [
      { title: 'Complete school identity', description: 'Confirm the school name, logo, contacts and report identity.', page: 'settings-school' },
      { title: 'Set up academics', description: 'Create the active year, term, grades, streams, classes and learning areas.', page: 'settings-academic' },
      { title: 'Create staff accounts', description: 'Add staff with the minimum roles and permissions they need.', page: 'settings-users' },
      { title: 'Import and verify learners', description: 'Use the current template, review validation and confirm the learner list.', page: 'system-maintenance' },
      { title: 'Configure communication', description: 'Set up SMS, send one test and confirm it appears in message history.', page: 'settings-communication' },
    ],
  },
  ADMIN: null,
  HEAD_TEACHER: null,
  TEACHER: {
    id: 'teacher-start', title: 'Teacher Getting Started', landingPages: ['dashboard'],
    intro: 'Confirm your teaching assignments before recording attendance or assessment evidence.',
    steps: [
      { title: 'Review assigned classes', description: 'Confirm that the correct classes and learning areas are visible.', page: 'teachers-list' },
      { title: 'Open daily attendance', description: 'Select the correct date, grade and stream, then save every learner status.', page: 'attendance-daily' },
      { title: 'Review assessment setup', description: 'Confirm the test name, term, total marks and assigned learners.', page: 'assess-summative-tests' },
      { title: 'Record and verify results', description: 'Enter scores, handle absences correctly and inspect the report before publishing.', page: 'assess-summative-assessment' },
    ],
  },
  ACCOUNTANT: {
    id: 'accountant-start', title: 'Accountant Getting Started', landingPages: ['finance-dashboard'],
    intro: 'Prepare fee structures and opening balances before processing payments.',
    steps: [
      { title: 'Review fee types', description: 'Confirm the fee categories used by the school.', page: 'fees-types' },
      { title: 'Configure fee structures', description: 'Set amounts by grade, term and academic year before invoicing.', page: 'fees-structure' },
      { title: 'Verify learner balances', description: 'Check opening balances and resolve unmatched records before collection.', page: 'fees-invoices' },
      { title: 'Process and reconcile payments', description: 'Record receipts, match provider transactions and review the audit trail.', page: 'fees-collection' },
      { title: 'Review financial reports', description: 'Confirm totals against collections, invoices and outstanding balances.', page: 'accounting-reports' },
    ],
  },
};

roleOnboardingJourneys.ADMIN = roleOnboardingJourneys.SUPER_ADMIN;
roleOnboardingJourneys.HEAD_TEACHER = roleOnboardingJourneys.SUPER_ADMIN;

export function findRoleOnboarding(role, currentPage) {
  const journey = roleOnboardingJourneys[String(role || '').toUpperCase()];
  return journey?.landingPages.includes(currentPage) ? journey : null;
}
