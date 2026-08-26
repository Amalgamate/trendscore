export const ONBOARDING_VERSION = 1;

export const roleOnboardingJourneys = {
  SUPER_ADMIN: {
    id: 'administrator-start', title: 'Administrator Getting Started', landingPages: ['dashboard'],
    intro: 'Set up the school foundation in the right order before operational work begins.',
    steps: [
      { key: 'school_identity', title: 'Complete school identity', description: 'Confirm the school name, logo, contacts and report identity.', page: 'settings-school' },
      { key: 'academics', title: 'Set up academics', description: 'Create the active year, term, grades, streams, classes and learning areas.', page: 'settings-academic' },
      { key: 'staff_accounts', title: 'Create staff accounts', description: 'Add staff with the minimum roles and permissions they need.', page: 'settings-users' },
      { key: 'learners', title: 'Import and verify learners', description: 'Use the current template, review validation and confirm the learner list.', page: 'system-maintenance' },
      { key: 'communication', title: 'Configure communication', description: 'Set up SMS, email or WhatsApp and verify the selected channel.', page: 'settings-communication' },
      { key: 'presence_snapshot', title: 'Check the Presence snapshot', description: 'Once the first register is marked, visit the School Snapshot to confirm presence data is flowing.', page: 'presence-dashboard' },
      { key: 'timetable', title: 'Generate the school timetable', description: 'Open Planner → Timetable → Engine Setup to create a bell schedule, set weekly allocations and run the auto-generator.', page: 'planner-timetable' },
      { key: 'analytics_review', title: 'Review Analytics (after 1 week)', description: 'After 7+ days of attendance, open Analytics to see trends, at-risk learners and late patterns.', page: 'analytics-dashboard' },
    ],
  },
  BOARDING_ADMIN: {
    id: 'boarding-start', title: 'Boarding School Setup', landingPages: ['boarding-dashboard'],
    intro: 'Configure dormitories and house masters before the first roll call.',
    steps: [
      { key: 'dormitories', title: 'Create dormitories', description: 'Add each block or house with its gender and capacity.', page: 'boarding-dashboard' },
      { key: 'boarding_assignments', title: 'Assign boarders to beds', description: 'Place each boarder in a dormitory for the current academic year.', page: 'boarding-dashboard' },
      { key: 'house_masters', title: 'Assign house masters', description: 'Give each dormitory a PRIMARY house master and any DUTY staff.', page: 'boarding-dashboard' },
      { key: 'boarding_roll_call', title: 'Run the first roll call', description: 'Start a NIGHT roll call, mark all boarders, then complete it.', page: 'boarding-dashboard' },
    ],
  },
  ADMIN: null,
  HEAD_TEACHER: null,
  TEACHER: {
    id: 'teacher-start', title: 'Teacher Getting Started', landingPages: ['dashboard'],
    intro: 'Confirm your teaching assignments before recording attendance or assessment evidence.',
    steps: [
      { key: 'teacher_assignments', title: 'Review assigned classes', description: 'Confirm that the correct classes and learning areas are visible.', page: 'teachers-list' },
      { key: 'teacher_attendance', title: 'Open daily attendance', description: 'Select the correct date, grade and stream, then save every learner status.', page: 'attendance-daily' },
      { key: 'assessment_setup', title: 'Review assessment setup', description: 'Confirm the test name, term, total marks and assigned learners.', page: 'assess-summative-tests' },
      { key: 'assessment_results', title: 'Record and verify results', description: 'Enter scores, handle absences correctly and inspect the report before publishing.', page: 'assess-summative-assessment' },
    ],
  },
  ACCOUNTANT: {
    id: 'accountant-start', title: 'Accountant Getting Started', landingPages: ['finance-dashboard'],
    intro: 'Prepare fee structures and opening balances before processing payments.',
    steps: [
      { key: 'fee_types', title: 'Review fee types', description: 'Confirm the fee categories used by the school.', page: 'fees-types' },
      { key: 'fee_structures', title: 'Configure fee structures', description: 'Set amounts by grade, term and academic year before invoicing.', page: 'fees-structure' },
      { key: 'learner_balances', title: 'Verify learner balances', description: 'Check opening balances and resolve unmatched records before collection.', page: 'fees-invoices' },
      { key: 'payment_reconciliation', title: 'Process and reconcile payments', description: 'Record receipts, match provider transactions and review the audit trail.', page: 'fees-collection' },
      { key: 'financial_reports', title: 'Review financial reports', description: 'Confirm totals against collections, invoices and outstanding balances.', page: 'accounting-reports' },
    ],
  },
};

roleOnboardingJourneys.ADMIN = roleOnboardingJourneys.SUPER_ADMIN;
roleOnboardingJourneys.HEAD_TEACHER = roleOnboardingJourneys.SUPER_ADMIN;

export function findRoleOnboarding(role, currentPage) {
  const journey = getRoleOnboarding(role);
  return journey?.landingPages.includes(currentPage) ? journey : null;
}

export function getRoleOnboarding(role) {
  return roleOnboardingJourneys[String(role || '').toUpperCase()] || null;
}
