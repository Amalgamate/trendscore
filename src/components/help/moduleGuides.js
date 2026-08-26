export const GUIDE_VERSION = 1;

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];
const biometricAdminRoles = ['SUPER_ADMIN', 'ADMIN'];

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
  {
    id: 'biometric-attendance',
    title: 'Biometric Attendance',
    pages: ['biometric-dashboard'],
    roles: biometricAdminRoles,
    summary: 'Set up secure face attendance from AWS readiness through terminal activation, consent-based enrollment, daily scanning, manual fallback and audit review.',
    required: 'The biometric module enabled, a supported AWS Face Liveness configuration, an internet-connected phone, and documented consent before face enrollment.',
    steps: [
      { title: 'Confirm platform readiness', description: 'Open Setup & API and confirm Encryption ready and FACE READY. Do not continue with face enrollment when either check is missing.', page: 'biometric-dashboard?tab=config' },
      { title: 'Register the phone terminal', description: 'In Terminal Management, create a PHONE terminal with a stable hardware ID, a clear name and its physical location.', page: 'biometric-dashboard?tab=devices' },
      { title: 'Activate the phone', description: 'Choose Activate phone, open the terminal link on the intended phone and exchange the one-use 8-digit code within ten minutes.', page: 'biometric-dashboard?tab=devices' },
      { title: 'Enroll a consenting person', description: 'Find the learner or staff member, confirm documented consent, and let that same person complete the live face challenge in suitable lighting.', page: 'biometric-dashboard?tab=enrollment' },
      { title: 'Record a test attendance event', description: 'On the activated phone choose Check In or Check Out, start face recognition and complete the AWS liveness challenge. Use manual admission or staff ID only as fallback.' },
      { title: 'Verify the result', description: 'Review Attendance Data Feed for the correct person, direction, FACE modality, liveness result, confidence and local timestamp, then test the terminal connection.', page: 'biometric-dashboard?tab=logs' },
      { title: 'Maintain access safely', description: 'Revoke face enrollment when consent is withdrawn, rotate a lost terminal token, and decommission a retired or stolen phone without deleting its audit history.', page: 'biometric-dashboard?tab=devices' },
    ],
    tips: [
      'The activated terminal must remain in the same browser profile; clearing its browser storage requires a new activation code.',
      'Face recognition requires internet. Manual events can queue offline and synchronize when connectivity returns.',
      'Never enter AWS credentials or the biometric encryption key into the browser, phone or school settings UI.',
      'Every school has its own face collection, terminals, device tokens, consent records and face enrollments.',
    ],
    support: { section: 'biometrics' },
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

  // ── Timetable Engine ────────────────────────────────────────────────────────
  {
    id: 'timetable-generator',
    title: 'Timetable Generator',
    pages: ['planner-timetable'],
    roles: adminRoles,
    summary: 'Generate a conflict-free weekly timetable for all classes in minutes using the Kenya CBE scheduling engine. The engine respects teacher availability, room types, double lessons, and locked periods.',
    required: 'Active classes for the current term, subject assignments linking teachers to grades and learning areas, and at least one bell schedule configured.',
    steps: [
      {
        title: 'Create a bell schedule',
        description: 'Open Engine Setup → Bell schedules. Enter the school start time, period duration in minutes, and number of periods. Click "Create schedule". After creation, click any period\'s type chip to mark it as a Break so the engine skips it.',
        page: 'planner-timetable',
      },
      {
        title: 'Set weekly allocations',
        description: 'Go to Allocations and set how many periods per week each grade should have for each learning area. For example: Grade 7 — Mathematics — 5 periods. These targets drive the generator.',
        page: 'planner-timetable',
      },
      {
        title: 'Assign teachers to subjects',
        description: 'In Subject Assignments, link each teacher to the grade and learning area they teach. The generator uses these assignments to pick the right teacher for each lesson. A lesson with no matching assignment is scheduled as "Teacher unassigned".',
        page: 'assess-learning-areas',
      },
      {
        title: 'Mark teacher availability (optional)',
        description: 'Go to Availability and add any blocked windows — for example, a part-time teacher who is unavailable on Friday afternoons. The engine will not schedule lessons for that teacher during those windows.',
        page: 'planner-timetable',
      },
      {
        title: 'Register specialist rooms (optional)',
        description: 'Go to Rooms and add labs, computer rooms or any space that specific subjects require. Then set the required room type on the relevant allocation. The engine will only schedule that subject when the room is free.',
        page: 'planner-timetable',
      },
      {
        title: 'Create a timetable plan',
        description: 'Go to Plans, give the plan a name, select the academic year, term and bell schedule, then click "Create draft plan". A version 1 draft is created immediately.',
        page: 'planner-timetable',
      },
      {
        title: 'Generate the timetable',
        description: 'Click "Generate timetable" on your draft plan. The engine runs in seconds and shows a result card with lesson count, unresolved allocations, and hard conflicts. Review the unresolved list — it tells you exactly which subject/class combination could not be placed and why.',
        page: 'planner-timetable',
      },
      {
        title: 'Review and edit in the grid',
        description: 'Click "Edit grid" to open the drag-and-drop editor. Drag any unlocked lesson to a different period. Click the lock icon to pin important lessons before regenerating. Conflicts are highlighted in red — hover to see the reason.',
        page: 'planner-timetable',
      },
      {
        title: 'Submit for review and approve',
        description: 'When the grid looks right, click "Submit review" to move it through the approval workflow: Department Review → Deputy → Principal → Approved. Each reviewer can send it back or advance it.',
        page: 'planner-timetable',
      },
      {
        title: 'Publish to live schedule',
        description: 'Once approved, the green "Publish" button appears. Click it — the engine writes all lessons into the live class schedule immediately. Teachers and students will see the new timetable right away. Any manual edits made since the last publish are shown as a warning before you confirm.',
        page: 'planner-timetable',
      },
    ],
    tips: [
      'Run the generator once to get a baseline, then lock your most important lessons (assemblies, PE) before regenerating.',
      'If a subject shows as unresolved, check that the teacher assignment exists for that exact grade and learning area.',
      'Mark break periods in the bell schedule before generating — the engine skips non-instructional periods.',
      'Use "New version" to fork the current draft and experiment without losing the approved baseline.',
      'The live timetable stays intact until you publish a new version — teachers can make quick manual overrides any time.',
    ],
    support: { query: 'Timetable Generator', section: 'planner' },
  },
];

export function findModuleGuide(page, role) {
  const normalizedRole = String(role || '').toUpperCase();
  const normalizedPage = String(page || '').split('?')[0];
  return moduleGuides.find((guide) => guide.pages.includes(normalizedPage) && guide.roles.includes(normalizedRole)) || null;
}
