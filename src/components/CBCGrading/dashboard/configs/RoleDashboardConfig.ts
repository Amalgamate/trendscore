/**
 * Role Dashboard Configuration
 * Defines which widgets appear for each role and their layout
 */

import { WIDGET_IDS } from '../WidgetRegistry';

/**
 * Role types
 */
export type RoleType = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'TEACHER' | 'PARENT' | 'HEAD_TEACHER' | 'STUDENT';

/**
 * Widget layout configuration
 */
export interface WidgetConfig {
  id: string;
  props?: Record<string, any>;
  gridColSpan?: number; // 1-12 based on 12-column grid
  order?: number;
  visible?: boolean;
  tab?: string; // Optional tab grouping
  responsive?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

/**
 * Tab configuration for tabbed dashboards
 */
export interface TabConfig {
  id: string;
  label: string;
  widgets: WidgetConfig[];
  icon?: string;
}

/**
 * Dashboard configuration for a role
 */
export interface DashboardConfig {
  role: RoleType;
  name: string;
  description?: string;
  widgets?: WidgetConfig[]; // For non-tabbed dashboards
  tabs?: TabConfig[]; // For tabbed dashboards
  layout?: {
    type: 'grid' | 'flex' | 'list';
    columns?: number; // For grid layout
    gap?: string;
    responsive?: boolean;
  };
  refreshInterval?: number; // Auto-refresh interval in ms
  enablePrint?: boolean;
}

/**
 * Dashboard Configurations for all roles
 */

const executiveWidgets: WidgetConfig[] = [
  {
    id: WIDGET_IDS.EXECUTIVE_SNAPSHOT,
    gridColSpan: 12,
    order: 1,
  },
  {
    id: WIDGET_IDS.FEE_INTELLIGENCE,
    gridColSpan: 6,
    order: 2,
    responsive: { mobile: 12, tablet: 12, desktop: 6 },
  },
  {
    id: WIDGET_IDS.FINANCIAL_PERFORMANCE,
    gridColSpan: 6,
    order: 3,
    responsive: { mobile: 12, tablet: 12, desktop: 6 },
  },
  {
    id: WIDGET_IDS.EXECUTIVE_INSIGHTS,
    gridColSpan: 4,
    order: 4,
    responsive: { mobile: 12, tablet: 12, desktop: 4 },
  },
  {
    id: WIDGET_IDS.COMPLIANCE_RISK,
    gridColSpan: 4,
    order: 5,
    responsive: { mobile: 12, tablet: 12, desktop: 4 },
  },
  {
    id: WIDGET_IDS.COMMUNICATION_OVERVIEW,
    gridColSpan: 4,
    order: 6,
    responsive: { mobile: 12, tablet: 12, desktop: 4 },
  },
];

export const DASHBOARD_CONFIGS: Record<RoleType, DashboardConfig> = {
  // OWNER
  OWNER: {
    role: 'OWNER',
    name: 'Executive Command Center',
    description: 'Complete institutional overview and executive intelligence',
    tabs: [
      {
        id: 'executive',
        label: 'Executive Summary',
        widgets: executiveWidgets,
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 30000,
    enablePrint: true,
  },

  // SUPER_ADMIN
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    name: 'Super Admin Command Center',
    description: 'Complete institutional overview and executive intelligence',
    tabs: [
      {
        id: 'executive',
        label: 'Executive Summary',
        widgets: executiveWidgets,
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 30000,
    enablePrint: true,
  },

  // ADMIN
  ADMIN: {
    role: 'ADMIN',
    name: 'Admin Command Center',
    description: 'School administration overview and executive intelligence',
    tabs: [
      {
        id: 'executive',
        label: 'Executive Summary',
        widgets: executiveWidgets,
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 30000,
    enablePrint: true,
  },

  // ACCOUNTANT
  ACCOUNTANT: {
    role: 'ACCOUNTANT',
    name: 'Accountant Dashboard',
    description: 'Financial management overview',
    widgets: [
      {
        id: WIDGET_IDS.FINANCIAL_SUMMARY,
        gridColSpan: 12,
        order: 1,
      },
      {
        id: WIDGET_IDS.PAYMENT_STATUS,
        gridColSpan: 12,
        order: 2,
      },
      {
        id: WIDGET_IDS.INVOICE_LIST,
        gridColSpan: 8,
        order: 3,
        responsive: { mobile: 12, tablet: 12, desktop: 8 },
      },
      {
        id: WIDGET_IDS.LEDGER_SUMMARY,
        gridColSpan: 4,
        order: 4,
        responsive: { mobile: 12, tablet: 12, desktop: 4 },
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 60000, // 60 seconds
    enablePrint: true,
  },

  // TEACHER
  TEACHER: {
    role: 'TEACHER',
    name: 'Teacher Dashboard',
    description: 'Faculty instruction console',
    tabs: [
      {
        id: 'overview',
        label: 'Performance Hub',
        widgets: [
          {
            id: WIDGET_IDS.TEACHER_METRICS,
            gridColSpan: 12,
            order: 1,
          },
          {
            id: WIDGET_IDS.CLOCK_IN_STATUS,
            gridColSpan: 4,
            order: 2,
            responsive: { mobile: 12, tablet: 12, desktop: 4 },
          },
          {
            id: WIDGET_IDS.INSTRUCTIONAL_PRIORITIES,
            gridColSpan: 4,
            order: 3,
            responsive: { mobile: 12, tablet: 6, desktop: 4 },
          },
          {
            id: WIDGET_IDS.IMMEDIATE_SCHEDULE,
            gridColSpan: 4,
            order: 4,
            responsive: { mobile: 12, tablet: 6, desktop: 4 },
          },
        ],
      },
      {
        id: 'instructional',
        label: 'Daily Timetable',
        widgets: [
          {
            id: WIDGET_IDS.WEEKLY_TIMETABLE,
            gridColSpan: 12,
            order: 1,
          },
        ],
      },
      {
        id: 'analytics',
        label: 'Statistical Insight',
        widgets: [
          {
            id: WIDGET_IDS.PROFICIENCY_METRICS,
            gridColSpan: 12,
            order: 1,
          },
          {
            id: WIDGET_IDS.LEARNING_OUTCOMES,
            gridColSpan: 12,
            order: 2,
          },
        ],
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 60000,
    enablePrint: false,
  },

  // PARENT
  PARENT: {
    role: 'PARENT',
    name: 'Parent Dashboard',
    description: 'Family education portal',
    widgets: [
      {
        id: WIDGET_IDS.GREETING_HEADER,
        gridColSpan: 12,
        order: 1,
      },
      {
        id: WIDGET_IDS.QUICK_ACTIONS,
        gridColSpan: 12,
        order: 2,
      },
      {
        id: WIDGET_IDS.CHILDREN_CARDS,
        gridColSpan: 12,
        order: 3,
      },
      {
        id: WIDGET_IDS.IMPORTANT_NOTICES,
        gridColSpan: 4,
        order: 4,
        responsive: { mobile: 12, tablet: 12, desktop: 4 },
      },
      {
        id: WIDGET_IDS.ATTENDANCE_SUMMARY,
        gridColSpan: 4,
        order: 5,
        responsive: { mobile: 12, tablet: 6, desktop: 4 },
      },
      {
        id: WIDGET_IDS.LATEST_RESULTS,
        gridColSpan: 4,
        order: 6,
        responsive: { mobile: 12, tablet: 6, desktop: 4 },
      },
      {
        id: WIDGET_IDS.PHOTOS_BANNER,
        gridColSpan: 12,
        order: 7,
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 120000, // 2 minutes
    enablePrint: true,
  },

  // HEAD_TEACHER
  HEAD_TEACHER: {
    role: 'HEAD_TEACHER',
    name: 'Head Teacher Dashboard',
    description: 'School performance leadership view',
    widgets: [
      {
        id: WIDGET_IDS.SCHOOL_PERFORMANCE,
        gridColSpan: 12,
        order: 1,
      },
      {
        id: WIDGET_IDS.CLASS_PERFORMANCE,
        gridColSpan: 6,
        order: 2,
        responsive: { mobile: 12, tablet: 12, desktop: 6 },
      },
      {
        id: WIDGET_IDS.TEACHER_PERFORMANCE,
        gridColSpan: 6,
        order: 3,
        responsive: { mobile: 12, tablet: 12, desktop: 6 },
      },
      {
        id: WIDGET_IDS.CURRICULUM_TRACKER,
        gridColSpan: 12,
        order: 4,
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 60000,
    enablePrint: true,
  },

  // STUDENT
  STUDENT: {
    role: 'STUDENT',
    name: 'Student Dashboard',
    description: 'Personal learning portal',
    widgets: [
      {
        id: WIDGET_IDS.WELCOME_BANNER,
        gridColSpan: 12,
        order: 1,
      },
      {
        id: WIDGET_IDS.STUDENT_STATS,
        gridColSpan: 12,
        order: 2,
      },
      {
        id: WIDGET_IDS.MY_COURSES,
        gridColSpan: 8,
        order: 3,
        responsive: { mobile: 12, tablet: 12, desktop: 8 },
      },
      {
        id: WIDGET_IDS.DUE_SOON,
        gridColSpan: 4,
        order: 4,
        responsive: { mobile: 12, tablet: 12, desktop: 4 },
      },
    ],
    layout: {
      type: 'grid',
      columns: 12,
      gap: '1.5rem',
      responsive: true,
    },
    refreshInterval: 120000,
    enablePrint: false,
  },
};

/**
 * Get dashboard config for a role
 */
export function getDashboardConfig(role: RoleType): DashboardConfig | undefined {
  return DASHBOARD_CONFIGS[role];
}

/**
 * Get all tabs for a role
 */
export function getRoleTabs(role: RoleType): TabConfig[] {
  const config = DASHBOARD_CONFIGS[role];
  return config?.tabs || [];
}

/**
 * Get all widgets for a role
 */
export function getRoleWidgets(role: RoleType): WidgetConfig[] {
  const config = DASHBOARD_CONFIGS[role];
  if (config?.tabs) {
    // For tabbed dashboards, flatten all widgets from all tabs
    return config.tabs.flatMap((tab) => tab.widgets);
  }
  return config?.widgets || [];
}

/**
 * Get widgets for a specific tab
 */
export function getTabWidgets(role: RoleType, tabId: string): WidgetConfig[] {
  const config = DASHBOARD_CONFIGS[role];
  const tab = config?.tabs?.find((t) => t.id === tabId);
  return tab?.widgets || [];
}

export default {
  DASHBOARD_CONFIGS,
  getDashboardConfig,
  getRoleTabs,
  getRoleWidgets,
  getTabWidgets,
};
