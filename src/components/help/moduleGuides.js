export const GUIDE_VERSION = 1;

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];

export const moduleGuides = [
  {
    id: 'academic-setup',
    title: 'School & Academic Setup',
    pages: ['settings-school', 'settings-academic'],
    roles: adminRoles,
    summary: 'Prepare the academic structure that every learner, class, attendance and assessment screen depends on.',
    required: 'School profile, academic year, active term, grades, streams and classes.',
    steps: [
      { title: 'Confirm school details', description: 'Check the school name, contacts, logo and report identity.', page: 'settings-school' },
      { title: 'Set the active year and term', description: 'Create the academic year and verify term dates before entering operational data.', page: 'settings-academic' },
      { title: 'Create grades and streams', description: 'Use the official grade structure and add each stream used by the school.', page: 'settings-academic' },
      { title: 'Confirm class availability', description: 'Classes created here must appear in learner, attendance and assessment dropdowns.', page: 'settings-academic' },
    ],
    tips: ['Complete this workflow before importing learners.', 'Do not create duplicate grade names with different spellings.'],
    support: { query: 'First Time Setup', section: 'getting-started' },
  },
  {
    id: 'learner-import',
    title: 'Import Learners',
    pages: ['system-maintenance', 'learners-list', 'admissions'],
    roles: adminRoles,
    summary: 'Import learners safely using the provided template and verify the result before continuing.',
    required: 'Academic year, grades/classes, completed learner template and admission numbers where available.',
    steps: [
      { title: 'Download a fresh template', description: 'Always start with the current system template; older headers may map differently.', page: 'system-maintenance' },
      { title: 'Complete learner details', description: 'Provide at least one name, class, gender and date of birth. Use First Name + Other Names when no surname is available.' },
      { title: 'Upload and review validation', description: 'Correct every rejected or suspicious row before confirming the import.', page: 'system-maintenance' },
      { title: 'Verify the learner list', description: 'Filter by the imported grade and confirm names, admission numbers, class and guardian contacts.', page: 'learners-list' },
    ],
    tips: ['Never type placeholder words such as Student into name columns.', 'Keep the original spreadsheet as the correction source.'],
    support: { query: 'Bulk Import Learners', section: 'learners' },
  },
  {
    id: 'assessment-results',
    title: 'Assessments & Parent Results',
    pages: ['assess-summative-tests', 'assess-summative-assessment', 'assess-summative-report', 'assess-formative'],
    roles: [...adminRoles, 'TEACHER'],
    summary: 'Create the assessment, enter verified scores, publish results and preview parent communication.',
    required: 'Active term, learners in classes, learning areas and an assessment with correct total marks.',
    steps: [
      { title: 'Create or select the assessment', description: 'Use the exact exam name parents should see and confirm term, grade and total marks.', page: 'assess-summative-tests' },
      { title: 'Enter and verify scores', description: 'Check absent learners, zero scores and totals before publishing.', page: 'assess-summative-assessment' },
      { title: 'Review the report', description: 'Preview several learners and confirm the calculated score and performance level.', page: 'assess-summative-report' },
      { title: 'Preview before sending', description: 'Review recipients and exact SMS content. Previously delivered messages are skipped automatically.', page: 'assess-summative-report' },
    ],
    tips: ['A zero is a real score; use the absence status for a learner who did not sit the exam.', 'Send one test message before a large parent broadcast.'],
    support: { query: 'Summative Tests', section: 'assessment' },
  },
  {
    id: 'attendance',
    title: 'Attendance & Approvals',
    pages: ['attendance-daily', 'attendance-reports', 'attendance-configuration'],
    roles: [...adminRoles, 'TEACHER'],
    summary: 'Record daily attendance, resolve missing entries and approve controlled corrections.',
    required: 'Active classes with enrolled learners and staff assigned to the correct class.',
    steps: [
      { title: 'Select date and class', description: 'Confirm the active date, grade and stream before marking anyone.' },
      { title: 'Record every learner', description: 'Use Present, Absent, Late or Excused and add a useful note when needed.' },
      { title: 'Save and confirm totals', description: 'Verify that the class summary matches the number of enrolled learners.' },
      { title: 'Review reports and approvals', description: 'Investigate missing days and approve unlock requests only with a valid reason.', page: 'attendance-reports' },
    ],
    tips: ['Do not infer attendance from a report; save the daily register first.', 'Corrections should remain attributable to the requester and approver.'],
    support: { query: 'Attendance', section: 'attendance' },
  },
  {
    id: 'communications',
    title: 'Communications & SMS',
    pages: ['settings-communication', 'comm-history', 'comm-notices', 'messages'],
    roles: adminRoles,
    summary: 'Configure a provider, send controlled tests, broadcast safely and review delivery history.',
    required: 'Provider credentials, approved sender ID, sufficient balance and valid parent phone numbers.',
    steps: [
      { title: 'Configure the SMS provider', description: 'Enter the credentials and sender identity supplied by the active provider.', page: 'settings-communication' },
      { title: 'Send a test SMS', description: 'Test one known phone number and confirm provider acceptance before bulk use.', page: 'settings-communication' },
      { title: 'Preview recipients and content', description: 'Check the exact message, learner, grade and phone before confirming a bulk send.' },
      { title: 'Review message history', description: 'Use status and grade filters to inspect sent, failed and skipped records, then retry only genuine failures.', page: 'comm-history' },
    ],
    tips: ['A provider acceptance is not the same as handset delivery.', 'Do not retry a duplicate failure until checking whether an earlier copy was delivered.'],
    support: { query: 'SMS', section: 'communications' },
  },

  // ── Phase 2.0 guides ────────────────────────────────────────────────────────

  {
    id: 'presence-overview',
    title: 'Presence Platform Overview',
    pages: ['presence-dashboard'],
    roles: adminRoles,
    summary: 'The Presence Platform aggregates attendance from every source — classes, biometric gates, school buses, and boarding roll calls — into one real-time school snapshot.',
    required: 'At least one attendance source active (daily register, biometric device, or transport trips).',
    steps: [
      { title: 'Check today\'s snapshot', description: 'The School Snapshot shows total learners, present count, absent count, and unmarked count as of right now. Refresh it after the morning register is complete.', page: 'presence-dashboard' },
      { title: 'Review absent learners', description: 'The Absent / Unmarked panel lists every learner with no attendance record today. Use this list to follow up before dismissal.', page: 'presence-dashboard' },
      { title: 'Check grade breakdown', description: 'The attendance-by-grade chart shows which grades are below target. Drill down to find specific classes.', page: 'presence-dashboard' },
      { title: 'View a learner timeline', description: 'Navigate to Learner Timeline to see a specific learner\'s full day — gate arrival, class mark, bus boarding. Use date navigation to go back to any previous day.', page: 'presence-timeline' },
    ],
    tips: [
      'The snapshot updates in real time as teachers submit registers.',
      'A learner with a biometric gate scan but no class attendance is a concern — check the Analytics dashboard.',
      'Parents can see their child\'s timeline via the Parent Portal → Attendance.',
    ],
    support: { query: 'Presence Platform', section: 'attendance' },
  },

  {
    id: 'presence-analytics',
    title: 'Attendance Analytics & Early Warning',
    pages: ['analytics-dashboard'],
    roles: adminRoles,
    summary: 'Surface at-risk learners, detect chronic absence patterns, and trigger early warnings before they become serious problems.',
    required: 'At least 2 weeks of attendance records for meaningful trend analysis.',
    steps: [
      { title: 'Review the 7-day trend', description: 'The bar chart shows school-wide attendance rate for each of the past 7 days. A dip on a specific day often indicates a timetable clash or a missing class register.', page: 'analytics-dashboard' },
      { title: 'Check the at-risk list', description: 'Switch to the At-Risk tab to see learners whose absence rate exceeds 20% over the past 4 weeks, ranked by risk level (LOW → CRITICAL).', page: 'analytics-dashboard' },
      { title: 'Review late arrival patterns', description: 'The Late Patterns tab shows grades with repeated late arrivals. This helps identify transport issues or specific class start time problems.', page: 'analytics-dashboard' },
      { title: 'Run early warning checks', description: 'Click "Run Checks" to immediately evaluate all four signals: chronic absence, late pattern, dorm abscond, and bus no-arrival. New violations appear in the Violations tab.', page: 'analytics-dashboard' },
      { title: 'Resolve violations', description: 'When a violation has been followed up, click Resolve to close it. This prevents it from reappearing in reports.', page: 'analytics-dashboard' },
    ],
    tips: [
      'Run checks every Monday morning for a weekly risk review.',
      'A CRITICAL risk level means a learner has missed more than 40% of recorded days — escalate immediately.',
      'Late pattern alerts fire when a learner is late 3 or more times in a 5-day window.',
    ],
    support: { query: 'Attendance Analytics', section: 'attendance' },
  },

  {
    id: 'boarding-setup',
    title: 'Boarding School Setup',
    pages: ['boarding-dashboard'],
    roles: adminRoles,
    summary: 'Set up dormitories, assign boarders to beds, configure house masters, and run the first roll call.',
    required: 'School configured as boarding type. Learners imported and active.',
    steps: [
      { title: 'Create dormitories', description: 'Click "Add Dormitory" and enter the name (e.g. Block A), gender (Boys / Girls / Mixed), and capacity. Create one dormitory per physical block or house.', page: 'boarding-dashboard' },
      { title: 'Assign learners to dorms', description: 'Use the Assignments section to place each boarder in a dormitory. Optionally assign a specific bed number. The system tracks one active assignment per learner per academic year.', page: 'boarding-dashboard' },
      { title: 'Assign house masters', description: 'Go to House Masters and assign each dormitory a PRIMARY house master and any DUTY or MATRON staff.', page: 'boarding-dashboard' },
      { title: 'Run the first roll call', description: 'Click "Start Roll Call", select the dormitory, session (MORNING or NIGHT), and today\'s date. Mark each boarder as Present, Absent, Excused, or On Exeat. Complete the roll call when done.', page: 'boarding-dashboard' },
      { title: 'Process an exeat request', description: 'When a parent requests weekend leave, click "Request Exeat", fill in the learner ID, dates, and reason. Approve or deny from the Exeat tab. Record departure and return when they happen.', page: 'boarding-dashboard' },
    ],
    tips: [
      'Night roll call is the most critical — an absent boarder at night triggers an alert to the house master and head teacher.',
      'Always record departure before return — the system blocks return recording if no departure is on file.',
      'Exeat overdue alerts fire automatically the morning after a learner\'s expected return date if no return has been recorded.',
    ],
    support: { query: 'Boarding', section: 'boarding' },
  },
];

export function findModuleGuide(page, role) {
  const normalizedRole = String(role || '').toUpperCase();
  return moduleGuides.find((guide) => guide.pages.includes(page) && guide.roles.includes(normalizedRole)) || null;
}
