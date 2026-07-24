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
];

export function findModuleGuide(page, role) {
  const normalizedRole = String(role || '').toUpperCase();
  return moduleGuides.find((guide) => guide.pages.includes(page) && guide.roles.includes(normalizedRole)) || null;
}
