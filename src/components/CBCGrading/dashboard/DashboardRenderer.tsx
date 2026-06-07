import React, { useState, useEffect, Suspense } from 'react';
import { DashboardConfig, TabConfig, WidgetConfig, RoleType } from './configs/RoleDashboardConfig';
import { WidgetRegistry, WidgetDefinition } from './WidgetRegistry';

/**
 * Props for DashboardRenderer
 */
export interface DashboardRendererProps {
  config: DashboardConfig;
  role: RoleType;
  user: any;
  onNavigate?: (path: string) => void;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Widget loading placeholder
 */
const WidgetLoadingPlaceholder: React.FC<{ widgetId: string }> = ({ widgetId }) => (
  <div
    style={{
      padding: '1.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: 0,
      border: '1px solid #e2e8f0',
      minHeight: '200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b',
      fontSize: '0.875rem',
    }}
  >
    Loading {widgetId}...
  </div>
);

/**
 * Widget error boundary
 */
interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetId: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`Error in widget ${this.props.widgetId}:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#fef2f2',
            borderRadius: 0,
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          Error loading {this.props.widgetId}
          {this.state.error && <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>{this.state.error.message}</p>}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Single Widget Renderer
 */
interface RenderedWidgetProps {
  widgetDef: WidgetDefinition;
  config: WidgetConfig;
  user: any;
  onNavigate?: (path: string) => void;
  gridColSpan?: number;
}

const RenderedWidget: React.FC<RenderedWidgetProps> = ({ widgetDef, config, user, onNavigate, gridColSpan }) => {
  const WidgetComponent = widgetDef.component;

  const gridClass = gridColSpan ? `col-span-${gridColSpan}` : '';
  const responsiveClass = config.responsive
    ? `md:col-span-${config.responsive.tablet || gridColSpan} lg:col-span-${config.responsive.desktop || gridColSpan}`
    : '';

  return (
    <div
      style={{
        gridColumn: `span ${gridColSpan || 12}`,
      }}
      className={`${gridClass} ${responsiveClass}`}
    >
      <WidgetErrorBoundary widgetId={config.id}>
        <Suspense fallback={<WidgetLoadingPlaceholder widgetId={config.id} />}>
          <WidgetComponent user={user} config={config} onNavigate={onNavigate} />
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
};

/**
 * Tab Navigation
 */
interface TabNavigationProps {
  tabs: TabConfig[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ tabs, activeTabId, onTabChange }) => (
  <div
    style={{
      display: 'flex',
      gap: '1rem',
      borderBottom: '1px solid #e5e7eb',
      marginBottom: '1.5rem',
      overflow: 'auto',
      scrollBehavior: 'smooth',
    }}
  >
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        style={{
          padding: '0.75rem 1rem',
          borderBottom: activeTabId === tab.id ? '2px solid #030b82' : '2px solid transparent',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontWeight: activeTabId === tab.id ? 600 : 500,
          color: activeTabId === tab.id ? '#030b82' : '#6b7280',
          fontSize: '0.875rem',
          transition: 'all 200ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

/**
 * DashboardRenderer
 * Renders a dashboard based on configuration with optional tabs
 * Replaces hardcoded dashboard components
 */
export const DashboardRenderer: React.FC<DashboardRendererProps> = ({
  config,
  role,
  user,
  onNavigate,
  loading = false,
  className = '',
  style,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(config.tabs?.[0]?.id || '');
  const [autoRefreshKey, setAutoRefreshKey] = useState(0);

  // Initialize widget registry on mount
  useEffect(() => {
    WidgetRegistry.initialize();
  }, []);

  // Handle auto-refresh
  useEffect(() => {
    if (!config.refreshInterval) return;

    const interval = setInterval(() => {
      setAutoRefreshKey((prev) => prev + 1);
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.refreshInterval]);

  // Determine which widgets to render
  const widgetsToRender: WidgetConfig[] = config.tabs
    ? config.tabs.find((tab) => tab.id === activeTabId)?.widgets || []
    : config.widgets || [];

  // Get grid configuration
  const layout = config.layout || { type: 'grid', columns: 12, gap: '1.5rem' };

  // Sort widgets by order
  const sortedWidgets = widgetsToRender.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Render grid
  const renderGrid = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: layout.type === 'grid' ? `repeat(${layout.columns || 12}, minmax(0, 1fr))` : undefined,
        gap: layout.gap || '1.5rem',
        width: '100%',
      }}
    >
      {sortedWidgets.map((widgetConfig) => {
        const widgetDef = WidgetRegistry.getWidget(widgetConfig.id);

        if (!widgetDef) {
          console.warn(`Widget not found: ${widgetConfig.id}`);
          return null;
        }

        return (
          <RenderedWidget
            key={`${widgetConfig.id}-${autoRefreshKey}`}
            widgetDef={widgetDef}
            config={widgetConfig}
            user={user}
            onNavigate={onNavigate}
            gridColSpan={widgetConfig.gridColSpan}
          />
        );
      })}
    </div>
  );

  return (
    <div
      className={className}
      style={{
        padding: '0',
        ...style,
      }}
    >
      {loading && (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#eff6ff',
            borderRadius: 0,
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          Loading dashboard...
        </div>
      )}

      {/* Tab Navigation */}
      {config.tabs && config.tabs.length > 0 && (
        <TabNavigation tabs={config.tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
      )}

      {/* Widgets Grid */}
      {widgetsToRender.length > 0 ? (
        renderGrid()
      ) : (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          No widgets configured for this dashboard
        </div>
      )}
    </div>
  );
};

export default DashboardRenderer;
