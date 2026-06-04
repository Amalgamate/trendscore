/**
 * Widget Registry
 * Central registry of all dashboard widgets
 * Each widget is identified by a unique ID and mapped to its component
 */

import React from 'react';
import { lazy } from 'react';

// Widget type definition
export interface WidgetDefinition {
  id: string;
  name: string;
  description?: string;
  component: React.ComponentType<any>;
  lazyLoad?: boolean;
  defaultProps?: Record<string, any>;
  responsive?: boolean;
}

/**
 * Widget IDs - All available widgets in the system
 * These are used to reference widgets in dashboard configs
 */
export const WIDGET_IDS = {
  // Admin/Owner Widgets
  METRIC_BANNER: 'metric_banner',
  OVERVIEW_METRICS: 'overview_metrics',
  ATTENDANCE_CHART: 'attendance_chart',
  ASSESSMENT_CHART: 'assessment_chart',
  FINANCE_CHART: 'finance_chart',
  RECENT_ACTIVITY: 'recent_activity',
  OPERATIONS_HUB: 'operations_hub',
  SYSTEM_ALERTS: 'system_alerts',
  FINANCE_METRICS: 'finance_metrics',
  REVENUE_BREAKDOWN: 'revenue_breakdown',
  SHORTCUT_BUTTONS: 'shortcut_buttons',

  // Executive Command Center
  EXECUTIVE_SNAPSHOT: 'executive_snapshot',
  FEE_INTELLIGENCE: 'fee_intelligence',
  FINANCIAL_PERFORMANCE: 'financial_performance',
  EXECUTIVE_INSIGHTS: 'executive_insights',
  COMPLIANCE_RISK: 'compliance_risk',
  COMMUNICATION_OVERVIEW: 'communication_overview',

  // Teacher Widgets
  TEACHER_METRICS: 'teacher_metrics',
  CLOCK_IN_STATUS: 'clock_in_status',
  INSTRUCTIONAL_PRIORITIES: 'instructional_priorities',
  IMMEDIATE_SCHEDULE: 'immediate_schedule',
  WEEKLY_TIMETABLE: 'weekly_timetable',
  PROFICIENCY_METRICS: 'proficiency_metrics',
  LEARNING_OUTCOMES: 'learning_outcomes',

  // Parent Widgets
  GREETING_HEADER: 'greeting_header',
  QUICK_ACTIONS: 'quick_actions',
  CHILDREN_CARDS: 'children_cards',
  IMPORTANT_NOTICES: 'important_notices',
  ATTENDANCE_SUMMARY: 'attendance_summary',
  LATEST_RESULTS: 'latest_results',
  PHOTOS_BANNER: 'photos_banner',

  // Student Widgets
  WELCOME_BANNER: 'welcome_banner',
  STUDENT_STATS: 'student_stats',
  MY_COURSES: 'my_courses',
  DUE_SOON: 'due_soon',

  // Accountant Widgets
  FINANCIAL_SUMMARY: 'financial_summary',
  PAYMENT_STATUS: 'payment_status',
  INVOICE_LIST: 'invoice_list',
  LEDGER_SUMMARY: 'ledger_summary',

  // Head Teacher Widgets
  SCHOOL_PERFORMANCE: 'school_performance',
  CLASS_PERFORMANCE: 'class_performance',
  TEACHER_PERFORMANCE: 'teacher_performance',
  CURRICULUM_TRACKER: 'curriculum_tracker',

  // Intelligence Engine Widgets
  AI_INSIGHTS: 'ai_insights',
  RISK_ALERTS: 'risk_alerts',
  FEE_COLLECTION_FORECAST: 'fee_collection_forecast',
  ATTENDANCE_ANOMALIES: 'attendance_anomalies',
  ACADEMIC_INSIGHTS: 'academic_insights',
} as const;

/**
 * Widget Registry
 * Maps widget IDs to their component definitions
 */
export class WidgetRegistry {
  private static widgets: Map<string, WidgetDefinition> = new Map();
  private static initialized = false;

  /**
   * Initialize the widget registry with all available widgets
   * This is called once at application startup
   */
  static initialize() {
    if (this.initialized) return;

    // Import and register widgets
    // Lazy-loaded for performance
    const widgets: WidgetDefinition[] = [
      // Admin/Owner Widgets
      {
        id: WIDGET_IDS.METRIC_BANNER,
        name: 'Metric Banner',
        description: 'Dashboard top metrics overview',
        component: lazy(() => import('./widgets/admin/MetricBannerWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.OVERVIEW_METRICS,
        name: 'Overview Metrics',
        description: 'Compact metric cards grid',
        component: lazy(() => import('./widgets/admin/OverviewMetricsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.ATTENDANCE_CHART,
        name: 'Attendance Chart',
        description: 'Daily attendance pie chart',
        component: lazy(() => import('./widgets/admin/AttendanceChartWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.ASSESSMENT_CHART,
        name: 'Assessment Chart',
        description: 'Assessment fulfillment pie chart',
        component: lazy(() => import('./widgets/admin/AssessmentChartWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.FINANCE_CHART,
        name: 'Finance Chart',
        description: 'Finance collection bar chart',
        component: lazy(() => import('./widgets/admin/FinanceChartWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.RECENT_ACTIVITY,
        name: 'Recent Activity',
        description: 'Recent activity log table',
        component: lazy(() => import('./widgets/admin/RecentActivityWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.OPERATIONS_HUB,
        name: 'Operations Hub',
        description: 'Quick action operations buttons',
        component: lazy(() => import('./widgets/admin/OperationsHubWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.SYSTEM_ALERTS,
        name: 'System Alerts',
        description: 'System alerts and warnings',
        component: lazy(() => import('./widgets/admin/SystemAlertsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.FINANCE_METRICS,
        name: 'Finance Metrics',
        description: 'Financial metrics overview',
        component: lazy(() => import('./widgets/admin/FinanceMetricsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.REVENUE_BREAKDOWN,
        name: 'Revenue Breakdown',
        description: 'Revenue breakdown table',
        component: lazy(() => import('./widgets/admin/RevenueBreakdownWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.SHORTCUT_BUTTONS,
        name: 'Shortcut Buttons',
        description: 'Quick access shortcut buttons',
        component: lazy(() => import('./widgets/admin/ShortcutButtonsWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Executive Command Center Widgets
      {
        id: WIDGET_IDS.EXECUTIVE_SNAPSHOT,
        name: 'Executive Snapshot',
        description: 'High-level KPI overview',
        component: lazy(() => import('./widgets/admin/ExecutiveSnapshotWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.FEE_INTELLIGENCE,
        name: 'Fee Intelligence',
        description: 'Financial health and fee collection overview',
        component: lazy(() => import('./widgets/admin/FeeIntelligenceWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.FINANCIAL_PERFORMANCE,
        name: 'Financial Performance',
        description: 'Revenue and expense trends',
        component: lazy(() => import('./widgets/admin/FinancialPerformanceWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.EXECUTIVE_INSIGHTS,
        name: 'Expenses Summary',
        description: 'Track daily, monthly and term expenses',
        component: lazy(() => import('./widgets/admin/ExpensesWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.COMPLIANCE_RISK,
        name: 'Compliance & Risk',
        description: 'Warning center for school operations',
        component: lazy(() => import('./widgets/admin/ComplianceRiskWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.COMMUNICATION_OVERVIEW,
        name: 'Communication Overview',
        description: 'SMS and email health snapshot',
        component: lazy(() => import('./widgets/admin/CommunicationOverviewWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Teacher Widgets
      {
        id: WIDGET_IDS.TEACHER_METRICS,
        name: 'Teacher Metrics',
        description: 'Teacher dashboard metrics',
        component: lazy(() => import('./widgets/teacher/TeacherMetricsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.CLOCK_IN_STATUS,
        name: 'Clock In Status',
        description: 'Teacher clock in/out status',
        component: lazy(() => import('./widgets/teacher/ClockInStatusWidget')),
        lazyLoad: true,
        responsive: false,
      },
      {
        id: WIDGET_IDS.INSTRUCTIONAL_PRIORITIES,
        name: 'Instructional Priorities',
        description: 'Teacher instructional priorities',
        component: lazy(() => import('./widgets/teacher/InstructionalPrioritiesWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.IMMEDIATE_SCHEDULE,
        name: 'Immediate Schedule',
        description: 'Immediate schedule preview',
        component: lazy(() => import('./widgets/teacher/ImmediateScheduleWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.WEEKLY_TIMETABLE,
        name: 'Weekly Timetable',
        description: 'Weekly curricular timetable',
        component: lazy(() => import('./widgets/teacher/WeeklyTimetableWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.PROFICIENCY_METRICS,
        name: 'Proficiency Metrics',
        description: 'Subject proficiency metrics',
        component: lazy(() => import('./widgets/teacher/ProficiencyMetricsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.LEARNING_OUTCOMES,
        name: 'Learning Outcomes',
        description: 'Learning outcomes distribution',
        component: lazy(() => import('./widgets/teacher/LearningOutcomesWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Parent Widgets
      {
        id: WIDGET_IDS.GREETING_HEADER,
        name: 'Greeting Header',
        description: 'Parent greeting header',
        component: lazy(() => import('./widgets/parent/GreetingHeaderWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.QUICK_ACTIONS,
        name: 'Quick Actions',
        description: 'Parent quick action buttons',
        component: lazy(() => import('./widgets/parent/QuickActionsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.CHILDREN_CARDS,
        name: 'Children Cards',
        description: 'Children status cards',
        component: lazy(() => import('./widgets/parent/ChildrenCardsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.IMPORTANT_NOTICES,
        name: 'Important Notices',
        description: 'Important notices list',
        component: lazy(() => import('./widgets/parent/ImportantNoticesWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.ATTENDANCE_SUMMARY,
        name: 'Attendance Summary',
        description: 'Attendance monthly summary',
        component: lazy(() => import('./widgets/parent/AttendanceSummaryWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.LATEST_RESULTS,
        name: 'Latest Results',
        description: 'Latest assessment results',
        component: lazy(() => import('./widgets/parent/LatestResultsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.PHOTOS_BANNER,
        name: 'Photos Banner',
        description: 'Photos gallery banner',
        component: lazy(() => import('./widgets/parent/PhotosBannerWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Student Widgets
      {
        id: WIDGET_IDS.WELCOME_BANNER,
        name: 'Welcome Banner',
        description: 'Student welcome banner',
        component: lazy(() => import('./widgets/student/WelcomeBannerWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.STUDENT_STATS,
        name: 'Student Stats',
        description: 'Student statistics grid',
        component: lazy(() => import('./widgets/student/StudentStatsWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.MY_COURSES,
        name: 'My Courses',
        description: 'Enrolled courses list',
        component: lazy(() => import('./widgets/student/MyCoursesWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.DUE_SOON,
        name: 'Due Soon',
        description: 'Assignments due soon',
        component: lazy(() => import('./widgets/student/DueSoonWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Accountant Widgets
      {
        id: WIDGET_IDS.FINANCIAL_SUMMARY,
        name: 'Financial Summary',
        description: 'Financial summary overview',
        component: lazy(() => import('./widgets/accountant/FinancialSummaryWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.PAYMENT_STATUS,
        name: 'Payment Status',
        description: 'Payment status overview',
        component: lazy(() => import('./widgets/accountant/PaymentStatusWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.INVOICE_LIST,
        name: 'Invoice List',
        description: 'Invoice list and management',
        component: lazy(() => import('./widgets/accountant/InvoiceListWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.LEDGER_SUMMARY,
        name: 'Ledger Summary',
        description: 'Ledger summary overview',
        component: lazy(() => import('./widgets/accountant/LedgerSummaryWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Head Teacher Widgets
      {
        id: WIDGET_IDS.SCHOOL_PERFORMANCE,
        name: 'School Performance',
        description: 'Overall school performance metrics',
        component: lazy(() => import('./widgets/headteacher/SchoolPerformanceWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.CLASS_PERFORMANCE,
        name: 'Class Performance',
        description: 'Class-by-class performance',
        component: lazy(() => import('./widgets/headteacher/ClassPerformanceWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.TEACHER_PERFORMANCE,
        name: 'Teacher Performance',
        description: 'Teacher performance metrics',
        component: lazy(() => import('./widgets/headteacher/TeacherPerformanceWidget')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.CURRICULUM_TRACKER,
        name: 'Curriculum Tracker',
        description: 'Curriculum completion tracker',
        component: lazy(() => import('./widgets/headteacher/CurriculumTrackerWidget')),
        lazyLoad: true,
        responsive: true,
      },

      // Intelligence Engine Widgets
      {
        id: WIDGET_IDS.AI_INSIGHTS,
        name: 'AI Insights',
        description: 'AI-generated insights and recommendations',
        component: lazy(() => import('./widgets/AIInsights')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.RISK_ALERTS,
        name: 'Risk Alerts',
        description: 'At-risk learner identification and alerts',
        component: lazy(() => import('./widgets/RiskAlerts')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.FEE_COLLECTION_FORECAST,
        name: 'Fee Collection Forecast',
        description: 'Fee collection trends and predictions',
        component: lazy(() => import('./widgets/FeeCollectionForecast')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.ATTENDANCE_ANOMALIES,
        name: 'Attendance Anomalies',
        description: 'Unusual attendance patterns and alerts',
        component: lazy(() => import('./widgets/AttendanceAnomalies')),
        lazyLoad: true,
        responsive: true,
      },
      {
        id: WIDGET_IDS.ACADEMIC_INSIGHTS,
        name: 'Academic Insights',
        description: 'Academic performance trends and analysis',
        component: lazy(() => import('./widgets/AcademicInsights')),
        lazyLoad: true,
        responsive: true,
      },
    ];

    // Register all widgets
    widgets.forEach((widget) => {
      this.register(widget);
    });

    this.initialized = true;
  }

  /**
   * Register a widget
   */
  static register(widget: WidgetDefinition) {
    this.widgets.set(widget.id, widget);
  }

  /**
   * Get a widget by ID
   */
  static getWidget(id: string): WidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  /**
   * Get all registered widgets
   */
  static getAllWidgets(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Check if a widget exists
   */
  static hasWidget(id: string): boolean {
    return this.widgets.has(id);
  }

  /**
   * Get widgets by category (prefix)
   */
  static getWidgetsByCategory(category: string): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter((w) => w.id.startsWith(category));
  }
}

export default WidgetRegistry;
