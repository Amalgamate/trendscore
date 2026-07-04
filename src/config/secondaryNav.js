/**
 * secondaryNav.js
 * Navigation structure for Secondary Schools (8-4-4 / KCSE curriculum)
 */

import {
  Home, Mail, Calendar, Users, GraduationCap, UserCheck,
  TrendingUp, Settings, BookOpen, Users2, Truck, Fingerprint,
  CreditCard, PieChart, Package, HelpCircle, Receipt, FileText,
  ClipboardList, BarChart3, Award, BookMarked, Activity, Wrench
} from 'lucide-react';

export const secondaryNavSections = [
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

  // ── School ────────────────────────────────────────────────────────────────
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    permission: null,
    items: [
      { id: 'students-list',       label: 'Students List',   path: 'learners-list',       permission: 'VIEW_ALL_LEARNERS' },
      { id: 'students-admissions', label: 'Admissions',      path: 'learners-admissions', permission: 'CREATE_LEARNER'    },
      { id: 'students-id-print',   label: 'ID Card Printing',path: 'learners-id-print',   permission: 'VIEW_ALL_LEARNERS', icon: CreditCard },
      { id: 'parents-list',        label: 'Parents List',    path: 'parents-list',        permission: 'VIEW_ALL_USERS' },
    ],
  },
  {
    id: 'teachers',
    label: 'Teachers',
    icon: GraduationCap,
    permission: 'MANAGE_TEACHERS',
    items: [
      { id: 'teachers-list', label: 'Teachers List', path: 'teachers-list', permission: 'MANAGE_TEACHERS' },
    ],
  },
  // Parents is no longer a standalone menu — Parents List is nested under Students
  // {
  //   id: 'parents',
  //   label: 'Parents',
  //   icon: UserCheck,
  //   permission: 'VIEW_ALL_USERS',
  //   items: [
  //     { id: 'parents-list', label: 'Parents List', path: 'parents-list', permission: 'VIEW_ALL_USERS' },
  //   ],
  // },

  // ── Academics ─────────────────────────────────────────────────────────────
  {
    id: 'secondary-academics',
    label: 'Academics',
    icon: BookMarked,
    permission: null,
    items: [
      { id: 'sec-pathways',    label: 'CBC Pathways (SS)',  path: 'sec-pathways',    permission: 'ACADEMIC_SETTINGS' },
      { id: 'sec-subjects',    label: 'Subject Catalog',    path: 'sec-subjects',    permission: 'ACADEMIC_SETTINGS' },
      { id: 'sec-form-groups', label: 'Grade Streams',      path: 'sec-form-groups', permission: 'MANAGE_FACILITIES' },
      { id: 'sec-timetable',   label: 'Timetable',          path: 'planner-timetable', permission: 'ACCESS_TIMETABLE' },
      { id: 'sec-schemes',     label: 'Schemes of Work',    path: 'planner-schemes', permission: null, icon: ClipboardList },
    ],
  },

  // ── Assessment ────────────────────────────────────────────────────────────
  {
    id: 'secondary-assessment',
    label: 'Assessment',
    icon: TrendingUp,
    permission: 'ACCESS_ASSESSMENT_MODULE',
    items: [
      { id: 'sec-mark-entry',  label: 'Mark Entry',     path: 'sec-mark-entry',  permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'sec-cats',        label: 'CATs',           path: 'sec-mark-entry',  params: { defaultTestType: 'CAT' },      permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'sec-mid-term',    label: 'Mid-term Exams', path: 'sec-mark-entry',  params: { defaultTestType: 'MID_TERM' }, permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'sec-end-term',    label: 'End-term Exams', path: 'sec-mark-entry',  params: { defaultTestType: 'END_TERM' }, permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'sec-kcse-mock',   label: 'Mock Exams',     path: 'sec-mark-entry',  params: { defaultTestType: 'MOCK' },     permission: 'ACCESS_ASSESSMENT_MODULE' },
    ],
  },

  // ── Results ───────────────────────────────────────────────────────────────
  {
    id: 'secondary-results',
    label: 'Reports & Growth',
    icon: BarChart3,
    permission: 'VIEW_ALL_REPORTS',
    items: [
      { id: 'sec-mean-grades',      label: 'Mean Grades',       path: 'sec-mean-grades',      permission: 'VIEW_ALL_REPORTS' },
      { id: 'sec-rankings',         label: 'Class Rankings',    path: 'sec-rankings',          permission: 'VIEW_ALL_REPORTS' },
      { id: 'sec-subject-analysis', label: 'Subject Intelligence', path: 'sec-subject-analysis', permission: 'VIEW_ALL_REPORTS' },
      { id: 'sec-report-cards',     label: 'Report Cards',      path: 'sec-report-cards',     permission: 'DOWNLOAD_REPORTS' },
      { id: 'sec-kcse-prediction',  label: 'Performance Forecast', path: 'sec-kcse-prediction',  permission: 'VIEW_ALL_REPORTS' },
    ],
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    id: 'attendance',
    label: 'Attendance',
    icon: ClipboardList,
    permission: null,
    items: [
      { id: 'attendance-daily',   label: 'Daily Attendance',   path: 'attendance-daily',   permission: 'MARK_ATTENDANCE' },
      { id: 'attendance-reports', label: 'Attendance Reports', path: 'attendance-reports', permission: 'GENERATE_ATTENDANCE_REPORTS' },
      { id: 'attendance-configuration', label: 'Configuration', path: 'attendance-configuration', permission: 'VIEW_ALL_ATTENDANCE' },
    ],
  },

  // ── LMS ───────────────────────────────────────────────────────────────────
  {
    id: 'lms',
    label: 'Learning Management',
    icon: BookOpen,
    permission: 'ACCESS_LMS',
    items: [
      { id: 'lms-courses',     label: 'Courses',           path: 'lms-courses',     permission: 'ACCESS_LMS' },
      { id: 'lms-content',     label: 'Content Library',   path: 'lms-content',     permission: 'ACCESS_LMS' },
      { id: 'lms-enrollments', label: 'Enrollments',       path: 'lms-enrollments', permission: 'ACCESS_LMS' },
      { id: 'lms-progress',    label: 'Progress Tracking', path: 'lms-progress',    permission: 'ACCESS_LMS' },
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
    id: 'transport',
    label: 'Transport & Hostel',
    icon: Truck,
    permission: 'TRANSPORT_MANAGEMENT',
    items: [
      { id: 'transport-routes',  label: 'Bus Routes',         path: 'transport-routes',   permission: 'TRANSPORT_MANAGEMENT' },
      { id: 'hostel-allocation', label: 'Hostel Allocation',  path: 'hostel-allocation',  permission: 'TRANSPORT_MANAGEMENT' },
      { id: 'hostel-fees',       label: 'Transport Fee Manager',     path: 'hostel-fees',        permission: 'TRANSPORT_MANAGEMENT' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    permission: 'SCHOOL_SETTINGS',
    items: [
      { id: 'inventory-items',       label: 'Items',           path: 'inventory-items',       permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-stores',      label: 'Stores',          path: 'inventory-stores',      permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-movements',   label: 'Stock Movements', path: 'inventory-movements',   permission: 'SCHOOL_SETTINGS' },
      { id: 'inventory-assets',      label: 'Asset Register',  path: 'inventory-assets',      permission: 'SCHOOL_SETTINGS' },
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
    items: [],
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'SCHOOL_SETTINGS',
    items: [
      { id: 'settings-school',        label: 'School Settings',        path: 'settings-school',        permission: 'SCHOOL_SETTINGS'   },
      { id: 'settings-modules',       label: 'Modules & Package',      path: 'settings-modules',       permission: 'SCHOOL_SETTINGS'   },
      { id: 'settings-academic',      label: 'Academic Settings',      path: 'settings-academic',      permission: 'ACADEMIC_SETTINGS' },
      { id: 'settings-communication', label: 'Communication Settings', path: 'settings-communication', permission: 'SCHOOL_SETTINGS'   },
      { id: 'settings-users',         label: 'User Management',        path: 'settings-users',         permission: 'EDIT_USER'         },
      { id: 'settings-approvals',     label: 'Approvals',              path: 'settings-approvals',     permission: 'SCHOOL_SETTINGS'   },
      { id: 'settings-system-logs',   label: 'System Logs',            path: 'settings-system-logs',    permission: 'SYSTEM_SETTINGS', icon: Activity },
      { id: 'settings-system-control',label: 'System Control',          path: 'settings-system-control', permission: 'SYSTEM_SETTINGS', icon: Wrench   },
      { id: 'system-maintenance',     label: 'Backup, Restore & Reset', path: 'system-maintenance',      permission: 'SYSTEM_SETTINGS', icon: Wrench },
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

// ── Secondary-specific category groupings ─────────────────────────────────────
export const SECONDARY_SCHOOL_SECTIONS   = ['students', 'teachers', 'secondary-academics', 'secondary-assessment', 'attendance'];
export const SECONDARY_RESULTS_SECTIONS  = ['secondary-results'];
export const SECONDARY_BACKOFFICE_SECTIONS = ['finance', 'hr', 'transport', 'inventory'];
export const SECONDARY_SYSTEM_SECTIONS   = ['settings'];
