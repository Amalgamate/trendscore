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
  Settings,
  MessageSquare,
  Award,
  BookOpen
} from 'lucide-react';

export type RoleType = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'TEACHER' | 'PARENT' | 'HEAD_TEACHER' | 'STUDENT';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  color?: string; // Tailwind color class
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
        color: 'text-emerald-600'
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        path: 'finance-management',
        color: 'text-amber-600'
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        path: 'assess-summary-report',
        color: 'text-blue-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
    ]
  },

  // Super Admin (same as OWNER)
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
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
        color: 'text-emerald-600'
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        path: 'finance-management',
        color: 'text-amber-600'
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        path: 'assess-summary-report',
        color: 'text-blue-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
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
        id: 'attendance',
        label: 'Attendance',
        icon: Clock,
        path: 'attendance-daily',
        color: 'text-emerald-600'
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        path: 'finance-management',
        color: 'text-amber-600'
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        path: 'assess-summary-report',
        color: 'text-blue-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
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
        path: 'dashboard',
        color: 'text-brand-purple'
      },
      {
        id: 'collections',
        label: 'Collections',
        icon: Wallet,
        path: 'finance-management',
        color: 'text-emerald-600'
      },
      {
        id: 'bank',
        label: 'Bank',
        icon: Zap,
        path: 'bank-reconciliation',
        color: 'text-blue-600'
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        path: 'financial-reports',
        color: 'text-amber-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
    ]
  },

  // Head Teacher
  HEAD_TEACHER: {
    role: 'HEAD_TEACHER',
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
        color: 'text-emerald-600'
      },
      {
        id: 'grades',
        label: 'Grades',
        icon: FileText,
        path: 'assess-summative-assessment',
        color: 'text-blue-600'
      },
      {
        id: 'learners',
        label: 'Learners',
        icon: Users,
        path: 'learners-list',
        color: 'text-violet-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
    ]
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
        color: 'text-emerald-600'
      },
      {
        id: 'grades',
        label: 'Grades',
        icon: FileText,
        path: 'assess-summative-assessment',
        color: 'text-blue-600'
      },
      {
        id: 'learners',
        label: 'Learners',
        icon: Users,
        path: 'learners-list',
        color: 'text-violet-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
    ]
  },

  // Parent - Mobile-first portal redesign
  PARENT: {
    role: 'PARENT',
    items: [
      {
        id: 'home',
        label: 'Overview',
        icon: Home,
        path: 'parent-portal-home',
        color: 'text-brand-purple'
      },
      {
        id: 'children',
        label: 'Children',
        icon: Users,
        path: 'parent-portal-children',
        color: 'text-blue-600'
      },
      {
        id: 'fees',
        label: 'Fees',
        icon: Wallet,
        path: 'parent-portal-fees',
        color: 'text-amber-600'
      },
      {
        id: 'messages',
        label: 'Messages',
        icon: MessageSquare,
        path: 'parent-portal-messages',
        color: 'text-violet-600'
      },
      {
        id: 'more',
        label: 'Menu',
        icon: Settings,
        path: 'parent-portal-more',
        color: 'text-gray-600'
      }
    ]
  },

  // Student
  STUDENT: {
    role: 'STUDENT',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
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
        label: 'Work',
        icon: FileText,
        path: 'student-assignments',
        color: 'text-emerald-600'
      },
      {
        id: 'achievements',
        label: 'Progress',
        icon: Award,
        path: 'student-profile',
        color: 'text-violet-600'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: 'settings',
        color: 'text-gray-600'
      }
    ]
  }
};

/**
 * Get mobile navigation config for a role
 */
export function getMobileNavConfig(role?: string): MobileNavConfig | null {
  if (!role) return null;
  return MOBILE_NAV_CONFIGS[role as RoleType] || null;
}

/**
 * Resolve navigation item path
 * Can handle nested routes or direct paths
 */
export function resolveNavItemPath(item: MobileNavItem): string {
  return item.path;
}
