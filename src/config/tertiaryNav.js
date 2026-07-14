/**
 * tertiaryNav.js
 * Navigation structure for Tertiary Institutions (Colleges / Universities)
 */

import {
  Home, Mail, Users, GraduationCap, UserCheck,
  TrendingUp, Settings, BookOpen, Users2, Truck,
  CreditCard, PieChart, Package, HelpCircle, FileText, Receipt,
  ClipboardList, BarChart3, Building2,
  Award, Fingerprint, BookMarked, Activity, Wrench
} from 'lucide-react';

export const tertiaryNavSections = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: Home,
    items: [],
    permission: null,
  },
  {
    id: 'communications',
    label: 'Inbox',
    icon: Mail,
    permission: null,
    items: [
      { id: 'comm-notices',  label: 'Notices & Announcements', path: 'comm-notices',  permission: null },
      { id: 'comm-messages', label: 'Messages',                path: 'comm-messages', permission: 'VIEW_INBOX' },
      { id: 'comm-history',  label: 'Message History',         path: 'comm-history',  permission: null },
    ],
  },

  // ── Students ──────────────────────────────────────────────────────────────
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    permission: null,
    items: [
      { id: 'students-list',       label: 'Students List',   path: 'learners-list',       permission: 'VIEW_ALL_LEARNERS' },
      { id: 'students-admissions', label: 'Admissions',      path: 'learners-admissions', permission: 'CREATE_LEARNER'    },
      { id: 'students-id-print',   label: 'ID Card Printing',path: 'learners-id-print',   permission: 'VIEW_ALL_LEARNERS', icon: CreditCard },
    ],
  },
  {
    id: 'lecturers',
    label: 'Lecturers',
    icon: GraduationCap,
    permission: 'MANAGE_TEACHERS',
    items: [
      { id: 'lecturers-list', label: 'Lecturers List', path: 'teachers-list', permission: 'MANAGE_TEACHERS' },
    ],
  },

  // ── Academic Programs ─────────────────────────────────────────────────────
  {
    id: 'tertiary-programs',
    label: 'Academic Programs',
    icon: BookMarked,
    comingSoon: true,
    permission: null,
    items: [
      { id: 'tert-departments', label: 'Departments',       path: 'tert-departments', permission: 'ACADEMIC_SETTINGS', comingSoon: true },
      { id: 'tert-programs',    label: 'Programs',          path: 'tert-programs',    permission: 'ACADEMIC_SETTINGS', comingSoon: true },
      { id: 'tert-units',       label: 'Unit Management',   path: 'tert-units',       permission: 'ACADEMIC_SETTINGS', comingSoon: true },
      { id: 'tert-enrollment',  label: 'Unit Enrollment',   path: 'tert-enrollment',  permission: 'MANAGE_FACILITIES', comingSoon: true },
      { id: 'tert-timetable',   label: 'Lecture Timetable', path: 'planner-timetable',permission: 'ACCESS_TIMETABLE',  comingSoon: true },
    ],
  },

  // ── Assessment ────────────────────────────────────────────────────────────
  {
    id: 'tertiary-assessment',
    label: 'Assessments',
    icon: TrendingUp,
    comingSoon: true,
    permission: 'ACCESS_ASSESSMENT_MODULE',
    items: [
      { id: 'tert-cats',       label: 'CATs (30%)',       path: 'tert-cats',        permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
      { id: 'tert-exams',      label: 'Exams (70%)',      path: 'tert-exams',       permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
      { id: 'tert-mark-entry', label: 'Mark Entry',       path: 'tert-mark-entry',  permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
      { id: 'tert-grade-sheet',label: 'Grade Sheets',     path: 'tert-grade-sheet', permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
      {
        id: 'group-reports',
        label: 'Reports',
        type: 'group',
        icon: FileText,
        items: [
          { id: 'tert-assessment-learner-reports', label: 'Learner Reports', path: 'assess-learner-reports', permission: 'ACCESS_ASSESSMENT_MODULE' },
          { id: 'tert-assessment-stream-sheet',        label: 'Stream Sheet',          path: 'assess-summative-report', params: { reportType: 'STREAM_REPORT' }, permission: 'ACCESS_ASSESSMENT_MODULE' },
          { id: 'tert-assessment-grade-sheet',         label: 'Grade Sheet',           path: 'assess-summative-report', params: { reportType: 'GRADE_REPORT' },  permission: 'ACCESS_ASSESSMENT_MODULE' },
          { id: 'tert-assessment-performance-analysis', label: 'Performance Analysis', path: 'academic-section-analysis', permission: 'VIEW_ALL_REPORTS' },
          { id: 'tert-assessment-learner-insights',    label: 'Learner Insights',      path: 'academic-learner-risk', permission: 'VIEW_ALL_REPORTS' },
        ],
      },
    ],
  },

  // ── Results ───────────────────────────────────────────────────────────────
  {
    id: 'tertiary-results',
    label: 'Results & Transcripts',
    icon: BarChart3,
    comingSoon: true,
    permission: 'VIEW_ALL_REPORTS',
    items: [
      { id: 'tert-unit-results',    label: 'Unit Results',          path: 'tert-unit-results',    permission: 'VIEW_ALL_REPORTS', comingSoon: true },
      { id: 'tert-gpa',             label: 'GPA Calculator',        path: 'tert-gpa',             permission: 'VIEW_ALL_REPORTS', comingSoon: true },
      { id: 'tert-semester-report', label: 'Semester Reports',      path: 'tert-semester-report', permission: 'DOWNLOAD_REPORTS', comingSoon: true },
      { id: 'tert-transcripts',     label: 'Transcripts',           path: 'tert-transcripts',     permission: 'DOWNLOAD_REPORTS', comingSoon: true },
      { id: 'tert-classifications', label: 'Degree Classification', path: 'tert-classifications', permission: 'VIEW_ALL_REPORTS', comingSoon: true },
    ],
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    id: 'attendance',
    label: 'Attendance',
    icon: ClipboardList,
    permission: null,
    items: [
      { id: 'attendance-daily',   label: 'Lecture Attendance', path: 'attendance-daily',   permission: 'MARK_ATTENDANCE' },
      { id: 'attendance-reports', label: 'Attendance Reports', path: 'attendance-reports', permission: 'GENERATE_ATTENDANCE_REPORTS' },
      { id: 'attendance-configuration', label: 'Configuration', path: 'attendance-configuration', permission: 'VIEW_ALL_ATTENDANCE' },
    ],
  },

  // ── Digital Learning (Professional LMS) ───────────────────────────────────
  {
    id: 'digital-learning',
    label: 'Learning',
    icon: BookOpen,
    permission: 'ACCESS_LMS',
    items: [
      { id: 'learning-dashboard',    label: 'Dashboard',        path: 'learning-dashboard',    permission: 'ACCESS_LMS' },
      { id: 'learning-assignments',  label: 'Assignments',      path: 'learning-assignments',  permission: 'ACCESS_LMS' },
      { id: 'learning-lessons',      label: 'Lessons',          path: 'learning-lessons',      permission: 'ACCESS_LMS' },
      { id: 'learning-revision',     label: 'Revision Library', path: 'learning-revision',     permission: 'ACCESS_LMS' },
      { id: 'learning-analytics',    label: 'Analytics',        path: 'learning-analytics',    permission: 'ANALYTICS_LEARNING' },
      { id: 'learning-settings',     label: 'Settings',         path: 'learning-settings',     permission: 'SCHOOL_SETTINGS' },
      { id: 'learning-marketplace',  label: 'Marketplace',      path: 'learning-marketplace',  permission: 'MARKETPLACE_PURCHASE' },
    ],
  },

  // ── LMS ───────────────────────────────────────────────────────────────────
  {
    id: 'lms',
    label: 'E-Learning',
    icon: BookOpen,
    permission: 'ACCESS_LMS',
    items: [
      { id: 'lms-courses',     label: 'Courses',           path: 'lms-courses',     permission: 'ACCESS_LMS' },
      { id: 'lms-content',     label: 'Content Library',   path: 'lms-content',     permission: 'ACCESS_LMS' },
      { id: 'lms-enrollments', label: 'Enrollments',       path: 'lms-enrollments', permission: 'ACCESS_LMS' },
      { id: 'lms-progress',    label: 'Progress Tracking', path: 'lms-progress',    permission: 'ACCESS_LMS' },
    ],
  },

  // ── Student Affairs ───────────────────────────────────────────────────────
  {
    id: 'student-affairs',
    label: 'Student Affairs',
    icon: Award,
    permission: 'MANAGE_FACILITIES',
    items: [
      { id: 'tert-hostels',   label: 'Hostel Allocation', path: 'hostel-allocation', permission: 'MANAGE_FACILITIES' },
      { id: 'tert-clubs',     label: 'Clubs & Societies', path: 'tert-clubs',        permission: 'MANAGE_FACILITIES' },
      { id: 'tert-clearance', label: 'Student Clearance', path: 'tert-clearance',    permission: 'MANAGE_FACILITIES' },
    ],
  },

  // ── Back Office ───────────────────────────────────────────────────────────
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    permission: 'FEE_MANAGEMENT',
    items: [
      {
        id: 'group-fees',
        label: 'Fee Management',
        type: 'group',
        icon: Receipt,
        permission: 'FEE_MANAGEMENT',
        items: [
          { id: 'fees-overview',   label: 'Fee Overview',       path: 'fees-overview',   permission: 'FEE_MANAGEMENT' },
          { id: 'fees-invoices',   label: 'Fee Invoices',       path: 'fees-invoices',   permission: 'FEE_MANAGEMENT' },
          { id: 'fees-pledges',    label: 'Pledges',            path: 'fees-pledges',    permission: 'FEE_MANAGEMENT' },
          { id: 'fees-statements', label: 'Student Statements', path: 'fees-statements', permission: 'FEE_MANAGEMENT' },
          { id: 'fees-types',      label: 'Fee Types',          path: 'fees-types',      permission: 'FEE_MANAGEMENT' },
          { id: 'fees-structure',  label: 'Fee Structure',      path: 'fees-structure',  permission: 'FEE_MANAGEMENT' },
          { id: 'fees-unmatched',  label: 'Unmatched Payments', path: 'fees-unmatched',  permission: 'FEE_MANAGEMENT' },
        ],
      },
      {
        id: 'group-accounting',
        label: 'Accounting',
        type: 'group',
        icon: PieChart,
        permission: 'ACCOUNTING_MANAGEMENT',
        items: [
          { id: 'accounting-dashboard',      label: 'Accounting Dashboard', path: 'accounting-dashboard',      permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-accounts',       label: 'Chart of Accounts',    path: 'accounting-accounts',       permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-entries',        label: 'Journal Entries',      path: 'accounting-entries',        permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-expenses',       label: 'Expenses',             path: 'accounting-expenses',       permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-vendors',        label: 'Vendors',              path: 'accounting-vendors',        permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-reconciliation', label: 'Reconciliation',       path: 'accounting-reconciliation', permission: 'ACCOUNTING_MANAGEMENT' },
          { id: 'accounting-reports',        label: 'Financial Reports',    path: 'accounting-reports',        permission: 'ACCOUNTING_MANAGEMENT' },
        ],
      },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: Users2,
    permission: 'HR_MANAGEMENT',
    items: [
      { id: 'hr-portal',         label: 'HR Dashboard',       path: 'hr-portal',         permission: 'HR_MANAGEMENT' },
      { id: 'hr-staff-profiles', label: 'Staff Directory',    path: 'hr-staff-profiles', permission: 'HR_MANAGEMENT' },
      { id: 'hr-payroll',        label: 'Payroll Processing', path: 'hr-payroll',         permission: 'HR_MANAGEMENT' },
      { id: 'hr-leave',          label: 'Leave Management',   path: 'hr-leave',           permission: 'HR_MANAGEMENT' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    permission: 'SCHOOL_SETTINGS',
    items: [
      { id: 'inventory-items',     label: 'Items',           path: 'inventory-items',     permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-stores',    label: 'Stores',          path: 'inventory-stores',    permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-movements', label: 'Stock Movements', path: 'inventory-movements', permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-assets',    label: 'Asset Register',  path: 'inventory-assets',    permission: 'SCHOOL_SETTINGS' },
    ],
  },
  {
    id: 'biometric',
    label: 'Biometric Attendance',
    icon: Fingerprint,
    permission: 'BIOMETRIC_ATTENDANCE',
    items: [
      { id: 'biometric-dashboard',  label: 'Biometric Authority',    path: 'biometric-dashboard', permission: 'BIOMETRIC_ATTENDANCE' },
      { id: 'biometric-enrollment', label: 'Fingerprint Enrollment', path: 'biometric-dashboard?tab=enrollment', permission: 'ENROLL_FINGERPRINTS' },
    ],
  },
  {
    id: 'docs-center',
    label: 'Document Center',
    icon: FileText,
    permission: null,
    items: [
      { id: 'docs-all',      label: 'All Records',      path: 'docs-center', params: { category: 'all' },      permission: null },
      { id: 'docs-students', label: 'Student Files',    path: 'docs-center', params: { category: 'students' }, permission: null },
      { id: 'docs-staff',    label: 'Staff Records',    path: 'docs-center', params: { category: 'staff' },    permission: null },
      { id: 'docs-finance',  label: 'Financial Docs',   path: 'docs-center', params: { category: 'finance' },  permission: null },
      { id: 'docs-reports',  label: 'Academic Reports', path: 'docs-center', params: { category: 'reports' },  permission: null },
    ],
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'SCHOOL_SETTINGS',
    items: [
      { id: 'settings-school-group', label: 'School', type: 'group', items: [
        { id: 'settings-school', label: 'Institution Settings', path: 'settings-school', permission: 'SCHOOL_SETTINGS' },
        { id: 'settings-modules', label: 'Modules & Package', path: 'settings-modules', permission: 'SCHOOL_SETTINGS' },
      ]},
      { id: 'settings-academics-group', label: 'Academics', type: 'group', items: [
        { id: 'settings-academic', label: 'Academic Settings', path: 'settings-academic', permission: 'ACADEMIC_SETTINGS' },
      ]},
      { id: 'settings-operations-group', label: 'Operations', type: 'group', items: [
        { id: 'settings-communication', label: 'Communication Settings', path: 'settings-communication', permission: 'SCHOOL_SETTINGS' },
      ]},
      { id: 'settings-people-group', label: 'People & Approvals', type: 'group', items: [
        { id: 'settings-users', label: 'User Management', path: 'settings-users', permission: 'EDIT_USER' },
        { id: 'settings-approvals', label: 'Approvals', path: 'settings-approvals', permission: 'SCHOOL_SETTINGS' },
      ]},
      { id: 'settings-system-group', label: 'System', type: 'group', items: [
        { id: 'settings-system-logs', label: 'System Logs', path: 'settings-system-logs', permission: 'SYSTEM_SETTINGS', icon: Activity },
        { id: 'settings-system-control', label: 'System Control', path: 'settings-system-control', permission: 'SYSTEM_SETTINGS', icon: Wrench },
        { id: 'system-maintenance', label: 'Backup, Restore & Reset', path: 'system-maintenance', permission: 'SYSTEM_SETTINGS', icon: Wrench },
      ]},
    ],
  },
  // {
  //   id: 'help',
  //   label: 'Help & Support',
  //   icon: HelpCircle,
  //   permission: null,
  //   items: [],
  // },
];

// ── Tertiary category groupings ───────────────────────────────────────────────
export const TERTIARY_SCHOOL_SECTIONS     = ['students', 'lecturers', 'attendance', 'tertiary-assessment', 'tertiary-programs'];
export const TERTIARY_RESULTS_SECTIONS    = ['tertiary-results', 'student-affairs'];
export const TERTIARY_BACKOFFICE_SECTIONS = ['finance', 'hr', 'inventory'];
export const TERTIARY_SYSTEM_SECTIONS     = ['settings'];
