/**
 * Admin Dashboard Widgets
 * Placeholder widget files that delegate to existing components
 * These will be gradually refactored to use the design system
 */

// Re-export from existing components to maintain functionality
// This allows gradual migration to new widget framework

// Export widget interfaces
export interface WidgetProps {
  user?: any;
  config?: any;
  onNavigate?: (path: string) => void;
}

// TODO: Create widget implementations by extracting from AdminDashboard.jsx
export const metricBannerWidget = () => null;
export const overviewMetricsWidget = () => null;
export const attendanceChartWidget = () => null;
export const assessmentChartWidget = () => null;
export const financeChartWidget = () => null;
export const recentActivityWidget = () => null;
export const operationsHubWidget = () => null;
export const systemAlertsWidget = () => null;
export const financeMetricsWidget = () => null;
export const revenueBreakdownWidget = () => null;
export const shortcutButtonsWidget = () => null;
