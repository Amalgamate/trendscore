/**
 * Mobile Navigation Configuration
 * Defines role-specific bottom navigation items
 */

import {
  Home,
  Clock,
  Wallet,
  FileText,
  Users,
  Zap,
  CalendarDays,
  MessageSquare,
  Mail,
  Award,
  BookOpen,
  Compass,
} from 'lucide-react';

export type RoleType = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'TEACHER' | 'PARENT' | 'HEAD_TEACHER' | 'DEPUTY_HEAD_TEACHER' | 'HEAD_OF_CURRICULUM' | 'RECEPTIONIST' | 'LIBRARIAN' | 'NURSE' | 'SECURITY' | 'DRIVER' | 'COOK' | 'CLEANER' | 'GROUNDSKEEPER' | 'IT_SUPPORT' | 'STUDENT';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  activePaths?: string[];
  color?: string; // Tailwind color class
  permission?: string;
}

export interface MobileNavConfig {
  role: RoleType;
  items: MobileNavItem[];
}

/**
 * Mobile Navigation Configurations for all roles
 */
export const MOBILE_NAV_CONFIGS: Record<RoleType, MobileNavConfig> = {
  // Owner / Super Admin
  OWNER: {
    role: 'OWNER',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        path: 'dashboard',
        color: 'text-brand-purple'
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: Clock,
        path: 'attendance-daily',
        permission: 'VIEW_ALL_ATTENDANCE',
        color: 'text-emerald-600'
      },
      {
        id: 'finance',
        label: 'Fees',
        icon: Wallet,
        path: 'fees-overview',
        permission: 'FEE_MANAGEMENT',
        activePaths: ['finance-dashboard', 'fees-overview', 'fees-collection', 'fees-invoices', 'fees-reports', 'fees-statements'],
        color: 'text-amber-600'
      },
      {
        id: 'timetable',
        label: 'Timetable',
        icon: CalendarDays,
        path: 'planner-timetable',
        permission: 'ACCESS_TIMETABLE',
        activePaths: ['planner-timetable', 'timetable'],
        color: 'text-indigo-600'
      }
    ]
  },

  // Platform governance
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    items: [
      { id: 'dashboard', label: 'Platform', icon: Home, path: 'dashboard' },
      { id: 'users', label: 'Users', icon: Users, path: 'settings-users', permission: 'EDIT_USER' },
      { id: 'logs', label: 'Logs', icon: FileText, path: 'settings-system-logs', permission: 'VIEW_SYSTEM_LOGS' },
      { id: 'system', label: 'System', icon: Zap, path: 'settings-system-control', permission: 'SYSTEM_SETTINGS' },
    ]
  },

  // Admin
  ADMIN: {
    role: 'ADMIN',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        path: 'dashboard',
        color: 'text-brand-purple'
      },
      {
        id: 'students',
        label: 'Students',
        icon: Users,
        path: 'learners-list',
        permission: 'VIEW_ALL_LEARNERS',
        activePaths: ['learners-list', 'learners-admissions', 'learners-transfers-in', 'learners-exited'],
        color: 'text-violet-600'
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: Clock,
        path: 'attendance-daily',
        permission: 'VIEW_ALL_ATTENDANCE',
        color: 'text-emerald-600'
      },
      {
        id: 'finance',
        label: 'Fees',
        icon: Wallet,
        path: 'fees-overview',
        permission: 'FEE_MANAGEMENT',
        activePaths: ['finance-dashboard', 'fees-overview', 'fees-collection', 'fees-invoices', 'fees-reports', 'fees-statements'],
        color: 'text-amber-600'
      },
      {
        id: 'timetable',
        label: 'Timetable',
        icon: CalendarDays,
        path: 'planner-timetable',
        permission: 'ACCESS_TIMETABLE',
        activePaths: ['planner-timetable', 'timetable'],
        color: 'text-indigo-600'
      }
    ]
  },

  // Accountant
  ACCOUNTANT: {
    role: 'ACCOUNTANT',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        path: 'finance-dashboard',
        activePaths: ['dashboard', 'finance-dashboard'],
        color: 'text-brand-purple'
      },
      {
        id: 'collections',
        label: 'Collections',
        icon: Wallet,
        path: 'fees-overview',
        permission: 'FEE_MANAGEMENT',
        activePaths: ['fees-overview', 'fees-collection', 'fees-invoices', 'fees-record-payment', 'fees-statements', 'fees-unmatched'],
        color: 'text-emerald-600'
      },
      {
        id: 'bank',
        label: 'Bank',
        icon: Zap,
        path: 'accounting-dashboard',
        permission: 'ACCOUNTING_MANAGEMENT',
        activePaths: ['accounting-dashboard'],
        color: 'text-blue-600'
      },
    ]
  },

  // Front Office Receptionist
  RECEPTIONIST: {
    role: 'RECEPTIONIST',
    items: [
      { id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard', color: 'text-brand-purple' },
      { id: 'learners', label: 'Learners', icon: Users, path: 'learners-list', permission: 'VIEW_ALL_LEARNERS', color: 'text-blue-600' },
      { id: 'payments', label: 'Payments', icon: Wallet, path: 'fees-record-payment', permission: 'RECORD_PAYMENT', color: 'text-emerald-600' },
      { id: 'inbox', label: 'Inbox', icon: Mail, path: 'comm-messages', permission: 'VIEW_INBOX', color: 'text-violet-700' },
    ],
  },

  // Academic leadership roles use their own information hierarchy.
  DEPUTY_HEAD_TEACHER: {
    role: 'DEPUTY_HEAD_TEACHER',
    items: [
      { id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' },
      { id: 'attendance', label: 'Attendance', icon: Clock, path: 'attendance-daily', permission: 'VIEW_ALL_ATTENDANCE' },
      { id: 'diary', label: 'Diary', icon: BookOpen, path: 'digital-diary', permission: 'LEARNING_VIEW' },
      { id: 'grades', label: 'Assess', icon: Award, path: 'assess-mobile-dashboard', permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'learners', label: 'Students', icon: Users, path: 'learners-list', permission: 'VIEW_ALL_LEARNERS' },
    ],
  },
  HEAD_OF_CURRICULUM: {
    role: 'HEAD_OF_CURRICULUM',
    items: [
      { id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' },
      { id: 'diary', label: 'Diary', icon: BookOpen, path: 'digital-diary', permission: 'LEARNING_VIEW' },
      { id: 'grades', label: 'Assess', icon: Award, path: 'assess-mobile-dashboard', permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'timetable', label: 'Schedule', icon: CalendarDays, path: 'planner-timetable', permission: 'ACCESS_TIMETABLE' },
      { id: 'teachers', label: 'Staff', icon: Users, path: 'teachers-list', permission: 'MANAGE_TEACHERS' },
    ],
  },

  // Teacher
  TEACHER: {
    role: 'TEACHER',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        path: 'dashboard',
        color: 'text-brand-purple'
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: Clock,
        path: 'attendance-daily',
        permission: 'MARK_ATTENDANCE',
        color: 'text-emerald-600'
      },
      {
        id: 'grades',
        label: 'Assess',
        icon: FileText,
        path: 'assess-mobile-dashboard',
        permission: 'ACCESS_ASSESSMENT_MODULE',
        activePaths: ['assess-mobile-dashboard', 'assess-summative-assessment', 'assess-summative-tests', 'assess-summary-report', 'assess-learner-reports', 'assess-termly-report'],
        color: 'text-blue-600'
      },
      {
        id: 'timetable',
        label: 'Timetable',
        icon: CalendarDays,
        path: 'planner-timetable',
        permission: 'ACCESS_TIMETABLE',
        activePaths: ['planner-timetable', 'timetable'],
        color: 'text-indigo-600'
      },
      {
        id: 'inbox',
        label: 'Inbox',
        icon: Mail,
        path: 'comm-messages',
        permission: 'VIEW_INBOX',
        activePaths: ['comm-messages'],
        color: 'text-violet-700'
      }
    ]
  },

  HEAD_TEACHER: {
    role: 'HEAD_TEACHER',
    items: [
      { id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' },
      { id: 'attendance', label: 'Attendance', icon: Clock, path: 'attendance-daily', permission: 'VIEW_ALL_ATTENDANCE' },
      { id: 'diary', label: 'Diary', icon: BookOpen, path: 'digital-diary', permission: 'LEARNING_VIEW' },
      { id: 'grades', label: 'Assess', icon: Award, path: 'assess-mobile-dashboard', permission: 'ACCESS_ASSESSMENT_MODULE' },
      { id: 'inbox', label: 'Inbox', icon: Mail, path: 'comm-messages', permission: 'VIEW_INBOX' },
    ],
  },

  // Parent - Redesigned portal navigation
  PARENT: {
    role: 'PARENT',
    items: [
      {
        id: 'home',
        label: 'Home',
        icon: Home,
        path: 'parent-portal-home',
        color: 'text-brand-purple'
      },
      {
        id: 'children',
        label: 'Children',
        icon: Users,
        path: 'parent-portal-children',
        activePaths: ['parent-portal-children'],
        color: 'text-blue-600'
      },
      {
        id: 'academics',
        label: 'Academics',
        icon: Award,
        path: 'parent-portal-academics',
        activePaths: ['parent-portal-academics', 'parent-portal-results', 'parent-portal-homework'],
        color: 'text-amber-600'
      },
      {
        id: 'communication',
        label: 'Messages',
        icon: MessageSquare,
        path: 'parent-portal-communication',
        activePaths: ['parent-portal-communication', 'parent-portal-messages'],
        color: 'text-indigo-600'
      },
    ]
  },

  // Student
  STUDENT: {
    role: 'STUDENT',
    items: [
      {
        id: 'dashboard',
        label: 'Home',
        icon: Home,
        path: 'dashboard',
        color: 'text-brand-purple'
      },
      {
        id: 'courses',
        label: 'Courses',
        icon: BookOpen,
        path: 'student-courses',
        color: 'text-blue-600'
      },
      {
        id: 'assignments',
        label: 'Diary',
        icon: FileText,
        path: 'student-diary',
        activePaths: ['student-diary', 'student-assignments'],
        color: 'text-emerald-600'
      },
      {
        id: 'pathway',
        label: 'Pathway',
        icon: Compass,
        path: 'student-pathway-planner',
        color: 'text-violet-600'
      },
      {
        id: 'timetable',
        label: 'Timetable',
        icon: CalendarDays,
        path: 'student-timetable',
        activePaths: ['student-timetable'],
        color: 'text-indigo-600'
      }
    ]
  },

  LIBRARIAN: {
    role: 'LIBRARIAN',
    items: [
      { id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' },
      { id: 'catalog', label: 'Books', icon: BookOpen, path: 'library-catalog', permission: 'LIBRARY_MANAGEMENT' },
      { id: 'circulation', label: 'Loans', icon: FileText, path: 'library-circulation', permission: 'LIBRARY_MANAGEMENT' },
      { id: 'inventory', label: 'Stock', icon: Wallet, path: 'library-inventory', permission: 'LIBRARY_MANAGEMENT' },
      { id: 'members', label: 'Members', icon: Users, path: 'library-members', permission: 'LIBRARY_MANAGEMENT' },
    ],
  },
  NURSE: { role: 'NURSE', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  SECURITY: { role: 'SECURITY', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  DRIVER: { role: 'DRIVER', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  COOK: { role: 'COOK', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  CLEANER: { role: 'CLEANER', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  GROUNDSKEEPER: { role: 'GROUNDSKEEPER', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
  IT_SUPPORT: { role: 'IT_SUPPORT', items: [{ id: 'dashboard', label: 'Home', icon: Home, path: 'dashboard' }] },
};

/**
 * Get mobile navigation config for a role
 */
export function getMobileNavConfig(role?: string): MobileNavConfig | null {
  if (!role) return null;
  const normalizedRole = role.toUpperCase();
  return MOBILE_NAV_CONFIGS[normalizedRole as RoleType] || null;
}

/**
 * Resolve navigation item path
 * Can handle nested routes or direct paths
 */
export function resolveNavItemPath(item: MobileNavItem): string {
  return item.path;
}
