/**
 * Dashboard Widget Framework
 * Configuration-driven dashboard system
 */

export { DashboardRenderer } from './DashboardRenderer';
export type { DashboardRendererProps } from './DashboardRenderer';

export { WidgetRegistry, WIDGET_IDS } from './WidgetRegistry';
export type { WidgetDefinition } from './WidgetRegistry';

export {
  DASHBOARD_CONFIGS,
  getDashboardConfig,
  getRoleTabs,
  getRoleWidgets,
  getTabWidgets,
} from './configs/RoleDashboardConfig';
export type { RoleType, DashboardConfig, TabConfig, WidgetConfig } from './configs/RoleDashboardConfig';

// Widget directories are lazily loaded via WidgetRegistry
