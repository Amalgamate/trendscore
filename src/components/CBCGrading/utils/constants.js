/**
 * System Constants
 * All static configuration and reference data
 */

// Assessment Types
export const ASSESSMENT_TYPES = [
  { value: 'Classwork', label: 'Classwork', icon: '📝' },
  { value: 'Homework', label: 'Homework', icon: '📚' },
  { value: 'Quiz', label: 'Quiz', icon: '❓' },
  { value: 'Project', label: 'Project', icon: '📊' },
  { value: 'Oral Assessment', label: 'Oral Assessment', icon: '🗣️' },
  { value: 'Practical Work', label: 'Practical Work', icon: '🔬' },
  { value: 'Group Work', label: 'Group Work', icon: '👥' },
  { value: 'Presentation', label: 'Presentation', icon: '🎤' }
];

// Status Colors
export const STATUS_COLORS = {
  'Active': 'bg-green-100 text-green-800',
  'Deactivated': 'bg-red-100 text-red-800',
  'Exited': 'bg-yellow-100 text-yellow-800',
  'Pending': 'bg-blue-100 text-blue-800',
  'Published': 'bg-green-100 text-green-800',
  'Draft': 'bg-orange-100 text-orange-800',
  'On Leave': 'bg-orange-100 text-orange-800',
  'Inactive': 'bg-gray-100 text-gray-800',
  'Present': 'bg-green-100 text-green-800',
  'Absent': 'bg-red-100 text-red-800',
  'Late': 'bg-orange-100 text-orange-800',
  'Unread': 'bg-blue-100 text-blue-800',
  'Read': 'bg-gray-100 text-gray-800',
  'DROPPED_OUT': 'bg-gray-100 text-gray-800'
};

// Attendance Statuses
export const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late'
};

// Transfer Reasons
export const TRANSFER_REASONS = [
  'Parent Job Transfer',
  'Family Relocation',
  'Academic Reasons',
  'Financial Constraints',
  'Other'
];

// Exit Reasons
export const EXIT_REASONS = [
  'Transferred to Another School',
  'Relocated',
  'Graduated',
  'Withdrawn',
  'Other'
];

// Communication Categories
export const NOTICE_CATEGORIES = [
  'Academic',
  'Events',
  'Finance',
  'Meetings',
  'General'
];

export const PRIORITY_LEVELS = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

// Channel Types
export const CHANNEL_TYPES = {
  CLASS: 'Class',
  STAFF: 'Staff',
  COMMITTEE: 'Committee',
  GENERAL: 'General'
};

// Terms
export const TERMS = ['Term 1', 'Term 2', 'Term 3'];

// Grade Levels for Filtering
export const GRADE_LEVELS = [
  'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6'
];

// Assessment Methods
export const ASSESSMENT_METHODS = [
  'Observation',
  'Written Test',
  'Oral Questioning',
  'Practical Demonstration',
  'Portfolio Review',
  'Group Discussion',
  'Peer Assessment',
  'Self Assessment'
];

// Test Types
export const TEST_TYPES = [
  'Tuner-Up',
  'Mid-term',
  'End of Term'
];

// Gender Options
export const GENDER_OPTIONS = ['Male', 'Female'];

// Blood Groups
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Transport Options
export const TRANSPORT_OPTIONS = ['Private', 'School Bus', 'Walking'];

// Relationships
export const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Other'];

// Kenya Counties (Sample)
export const KENYA_COUNTIES = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Nakuru',
  'Eldoret',
  'Thika',
  'Malindi',
  'Kitale',
  'Garissa',
  'Kakamega'
];

// User Roles
export const USER_ROLES = [
  'Administrator',
  'Teacher',
  'Parent',
  'Secretary',
  'Accountant'
];

// Page Titles Mapping
export const PAGE_TITLES = {
  'dashboard': 'Overview',
  'planner-calendar': 'School Calendar',
  'planner-timetable': 'Class Timetable',
  'planner-agenda': 'Agenda',
  'planner-schemes': 'Schemes of Work',

  // Learners
  'learners-list': 'Scholars List',
  'teacher-learner-analysis': 'My Learners Analysis',
  'learners-admissions': 'Admissions',
  'learners-transfers-in': 'Incoming Transfers',
  'learners-exited': 'Exited Scholars',
  'learners-promotion': 'Promotion',
  'learners-transfer-out': 'Transfer Out',

  // Teachers/Parents
  'teachers-list': 'Faculty List',
  'add-teacher': 'Add/Edit Faculty',
  'parents-list': 'Guardians List',

  // Timetable
  'timetable': 'School Timetable',

  // Attendance
  'attendance-daily': 'Daily Attendance',
  'attendance-reports': 'Attendance Reports',
  'attendance-configuration': 'Attendance Configuration',

  // Messages
  'comm-notices': 'Notices & Announcements',
  'comm-messages': 'Inbox',
  'comm-history': 'Message History',

  // Assessment
  'assess-formative': 'Formative Assessment',
  'assess-formative-report': 'Formative Report',
  'assess-summative-tests': 'Summative Tests',
  'assess-summative-assessment': 'Summative Assessment',
  'assess-summative-report': 'Summative Report',
  'assess-summary-report': 'Assessment Matrix',
  'assess-termly-report': 'Termly Report',
  'assess-learning-areas': 'Learning Areas',
  'assess-performance-scale': 'Performance Scale',

  // Learning Hub
  'learning-hub-materials': 'Resource Center',
  'learning-hub-assignments': 'Assignments',
  'learning-hub-lesson-plans': 'Lesson Plans',
  'learning-hub-library': 'Resource Library',
  'inventory-books': 'Inventory Management',

  // Facilities
  'facilities-classes': 'Campus Configuration',

  // Fees
  'reports-center': 'Reports Center',
  'fees-overview': 'Fee Overview',
  'fees-invoices': 'Fee Invoices',
  'fees-structure': 'Fee Structure',
  'fees-collection': 'Fee Collection',
  'fees-pledges': 'Pledge Management',
  'fees-types': 'Fee Types',
  'fees-unmatched': 'Unmatched Payments',
  'fees-reports': 'Fee Reports',
  'fees-statements': 'Student Statements',

  // Help
  'help': 'Help & Support',

  // Settings
  'settings-school': 'School Settings & Branding',
  'settings-academic': 'Academic Settings',
  'settings-users': 'System Users',
  'settings-branding': 'School Settings & Branding',
  'settings-backup': 'System Maintenance',
  'settings-system-logs': 'System Logs',
  'settings-system-control': 'System Control',
  'settings-communication': 'Message Settings',
  'settings-payment': 'Payment Settings',
  'settings-profile': 'My Profile'
};

/**
 * Helper function to get status color class
 * @param {string} status - Status value
 * @returns {string} Tailwind CSS classes
 */
export const getStatusColor = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800';

  // Try exact match first
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];

  // Try case-insensitive match
  const lowerStatus = status.toLowerCase();
  const key = Object.keys(STATUS_COLORS).find(k => k.toLowerCase() === lowerStatus);
  return key ? STATUS_COLORS[key] : 'bg-gray-100 text-gray-800';
};
