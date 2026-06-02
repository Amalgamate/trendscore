# Dashboard Widget Framework Implementation Guide

## Overview

The TreadSCORE Dashboard Widget Framework is a configuration-driven system that replaces hardcoded dashboard components with a flexible, extensible widget registry and configuration system. This allows dashboards to be easily customized, extended, and maintained.

## Architecture

```
dashboard/
├── WidgetRegistry.ts           # Central registry of all available widgets
├── DashboardRenderer.tsx       # Main component that renders dashboards
├── index.ts                    # Public API exports
├── configs/
│   └── RoleDashboardConfig.ts # Configuration for each role
└── widgets/
    ├── admin/                  # Admin/Owner dashboard widgets
    ├── teacher/                # Teacher dashboard widgets
    ├── parent/                 # Parent dashboard widgets
    ├── student/                # Student dashboard widgets
    ├── accountant/             # Accountant dashboard widgets
    └── headteacher/            # Head Teacher dashboard widgets
```

## Key Concepts

### 1. Widget Registry (`WidgetRegistry.ts`)

The widget registry is a centralized mapping of widget IDs to their component definitions. All widgets must be registered here before they can be used in dashboards.

**Features:**
- Centralized widget registration
- Lazy-loading support for performance
- Widget metadata (name, description, responsive settings)
- Widget lookup and validation

**Key Methods:**
- `WidgetRegistry.initialize()` - Initialize registry (called once on app startup)
- `WidgetRegistry.register(widget)` - Register a widget
- `WidgetRegistry.getWidget(id)` - Get widget by ID
- `WidgetRegistry.getAllWidgets()` - Get all registered widgets
- `WidgetRegistry.hasWidget(id)` - Check if widget exists

### 2. Dashboard Configuration (`RoleDashboardConfig.ts`)

Dashboard configurations define which widgets appear for each role and their layout settings.

**Supported Roles:**
- `OWNER` - System owner with full access
- `SUPER_ADMIN` - Super administrator
- `ADMIN` - School administrator
- `ACCOUNTANT` - Financial management
- `TEACHER` - Faculty member
- `PARENT` - Student's parent/guardian
- `HEAD_TEACHER` - School head teacher
- `STUDENT` - Student/learner

**Config Structure:**
```typescript
{
  role: 'TEACHER',
  name: 'Teacher Dashboard',
  description: 'Faculty instruction console',
  tabs?: [
    {
      id: 'overview',
      label: 'Performance Hub',
      widgets: [
        {
          id: WIDGET_IDS.TEACHER_METRICS,
          gridColSpan: 12,
          order: 1,
          responsive: { mobile: 12, tablet: 12, desktop: 12 }
        },
        // ... more widgets
      ]
    }
  ],
  widgets?: [
    // For non-tabbed dashboards
  ],
  layout: {
    type: 'grid',
    columns: 12,
    gap: '1.5rem',
    responsive: true
  },
  refreshInterval: 60000,  // Auto-refresh every 60 seconds
  enablePrint: true
}
```

### 3. Dashboard Renderer (`DashboardRenderer.tsx`)

The main component that renders a dashboard based on its configuration.

**Features:**
- Renders widgets from configuration
- Tab support for multi-tab dashboards
- Responsive grid layout
- Error boundaries for widget isolation
- Lazy loading with suspense
- Auto-refresh support

**Props:**
```typescript
interface DashboardRendererProps {
  config: DashboardConfig;
  role: RoleType;
  user: any;
  onNavigate?: (path: string) => void;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
```

## How to Use

### 1. Create a New Widget

1. Create a new component file in the appropriate role folder:
   ```typescript
   // src/components/CBCGrading/dashboard/widgets/teacher/MyNewWidget.tsx
   
   import React from 'react';
   
   interface WidgetProps {
     user?: any;
     config?: any;
     onNavigate?: (path: string) => void;
   }
   
   const MyNewWidget: React.FC<WidgetProps> = ({ user, config, onNavigate }) => {
     return (
       <div>
         {/* Your widget content */}
       </div>
     );
   };
   
   export default MyNewWidget;
   ```

2. Register it in `WidgetRegistry.ts`:
   ```typescript
   {
     id: WIDGET_IDS.MY_NEW_WIDGET,
     name: 'My New Widget',
     description: 'Detailed description',
     component: lazy(() => import('../widgets/teacher/MyNewWidget')),
     lazyLoad: true,
     responsive: true,
   }
   ```

3. Add the widget ID to `WIDGET_IDS` enum:
   ```typescript
   export const WIDGET_IDS = {
     MY_NEW_WIDGET: 'my_new_widget',
     // ... other widgets
   };
   ```

### 2. Update a Dashboard Configuration

To add a widget to a dashboard, update `RoleDashboardConfig.ts`:

```typescript
export const DASHBOARD_CONFIGS: Record<RoleType, DashboardConfig> = {
  TEACHER: {
    // ... existing config
    tabs: [
      {
        id: 'overview',
        label: 'Performance Hub',
        widgets: [
          // ... existing widgets
          {
            id: WIDGET_IDS.MY_NEW_WIDGET,
            gridColSpan: 6,
            order: 10,
            responsive: { mobile: 12, tablet: 6, desktop: 6 }
          }
        ]
      }
    ]
  }
};
```

### 3. Use Dashboard in a Page Component

```typescript
import { DashboardRenderer, DASHBOARD_CONFIGS, RoleType } from '@/components/CBCGrading/dashboard';

const TeacherDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role: RoleType = 'TEACHER';
  const config = DASHBOARD_CONFIGS[role];

  return (
    <DashboardRenderer
      config={config}
      role={role}
      user={user}
      onNavigate={(path) => navigate(path)}
    />
  );
};
```

## Widget IDs Reference

### Admin/Owner Widgets
- `METRIC_BANNER` - Top metrics overview
- `OVERVIEW_METRICS` - Metric cards grid
- `ATTENDANCE_CHART` - Daily attendance pie chart
- `ASSESSMENT_CHART` - Assessment fulfillment chart
- `FINANCE_CHART` - Finance collection bar chart
- `RECENT_ACTIVITY` - Recent activity log
- `OPERATIONS_HUB` - Quick action buttons
- `SYSTEM_ALERTS` - System alerts
- `FINANCE_METRICS` - Financial metrics
- `REVENUE_BREAKDOWN` - Revenue breakdown table
- `SHORTCUT_BUTTONS` - Quick access buttons

### Teacher Widgets
- `TEACHER_METRICS` - Teacher dashboard metrics
- `CLOCK_IN_STATUS` - Clock in/out status
- `INSTRUCTIONAL_PRIORITIES` - Instructional priorities
- `IMMEDIATE_SCHEDULE` - Immediate schedule preview
- `WEEKLY_TIMETABLE` - Weekly timetable
- `PROFICIENCY_METRICS` - Proficiency metrics
- `LEARNING_OUTCOMES` - Learning outcomes distribution

### Parent Widgets
- `GREETING_HEADER` - Greeting header
- `QUICK_ACTIONS` - Quick action buttons
- `CHILDREN_CARDS` - Children status cards
- `IMPORTANT_NOTICES` - Important notices
- `ATTENDANCE_SUMMARY` - Attendance summary
- `LATEST_RESULTS` - Latest results
- `PHOTOS_BANNER` - Photos gallery

### Student Widgets
- `WELCOME_BANNER` - Welcome banner
- `STUDENT_STATS` - Statistics grid
- `MY_COURSES` - Enrolled courses
- `DUE_SOON` - Assignments due soon

### Accountant Widgets
- `FINANCIAL_SUMMARY` - Financial summary
- `PAYMENT_STATUS` - Payment status
- `INVOICE_LIST` - Invoice management
- `LEDGER_SUMMARY` - Ledger summary

### Head Teacher Widgets
- `SCHOOL_PERFORMANCE` - School performance metrics
- `CLASS_PERFORMANCE` - Class performance
- `TEACHER_PERFORMANCE` - Teacher performance
- `CURRICULUM_TRACKER` - Curriculum tracker

## Grid Layout System

The dashboard uses a 12-column responsive grid:

```typescript
// Desktop (1200px+): 12 columns
// Tablet (768px-1199px): 6 columns
// Mobile (0-767px): 1 column
```

**Grid Span Examples:**
- `gridColSpan: 12` - Full width
- `gridColSpan: 6` - Half width
- `gridColSpan: 4` - One third width
- `gridColSpan: 3` - One quarter width

**Responsive Settings:**
```typescript
{
  id: WIDGET_IDS.MY_WIDGET,
  gridColSpan: 6,  // Default desktop span
  responsive: {
    mobile: 12,     // Full width on mobile
    tablet: 6,      // Half width on tablet
    desktop: 4      // One third on desktop
  }
}
```

## Tab Support

Dashboards can have multiple tabs. The DashboardRenderer handles tab switching automatically:

```typescript
tabs: [
  {
    id: 'overview',
    label: 'Overview',
    widgets: [ /* widgets for this tab */ ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    widgets: [ /* different widgets */ ]
  }
]
```

## Auto-Refresh

Dashboards can auto-refresh data at specified intervals:

```typescript
{
  role: 'TEACHER',
  name: 'Teacher Dashboard',
  refreshInterval: 60000,  // Refresh every 60 seconds
  // ...
}
```

The `DashboardRenderer` automatically invalidates widget cache on refresh.

## Error Handling

Each widget is wrapped in an error boundary to prevent one widget from breaking the entire dashboard. Widget errors are logged and displayed inline.

## Performance Optimization

- **Lazy Loading**: Widgets are lazy-loaded on demand
- **Suspense Fallback**: Loading placeholders shown while widgets load
- **Memo**: Components are memoized to prevent unnecessary re-renders
- **Error Isolation**: Widget errors don't affect other widgets

## Migration from Hardcoded Dashboards

### Before (Hardcoded):
```typescript
const AdminDashboard = ({ user, onNavigate }) => {
  return (
    <div>
      <MetricBanner data={metrics} />
      <AttendanceChart data={attendance} />
      <FinanceChart data={finance} />
      {/* ... many more components */}
    </div>
  );
};
```

### After (Configuration-Driven):
```typescript
const AdminDashboard = ({ user, onNavigate }) => {
  const config = DASHBOARD_CONFIGS.ADMIN;
  return (
    <DashboardRenderer
      config={config}
      role="ADMIN"
      user={user}
      onNavigate={onNavigate}
    />
  );
};
```

## Next Steps

1. **Implement Widgets**: Convert existing components to widgets by creating widget files
2. **Extract Logic**: Move dashboard logic from components to widgets
3. **Update Registry**: Register all widgets in WidgetRegistry
4. **Replace Hardcoded Dashboards**: Replace old dashboard components with DashboardRenderer
5. **Add New Roles**: Support additional roles by adding configurations
6. **Customize Layouts**: Modify configurations to customize dashboard layouts per role

## Troubleshooting

### Widget Not Loading
- Check widget is registered in WidgetRegistry
- Verify widget ID matches in config
- Check console for error messages

### Grid Layout Issues
- Ensure gridColSpan values are 1-12
- Check responsive settings for all breakpoints
- Verify column count in layout config

### Tab Navigation Not Working
- Ensure tabs have unique IDs
- Check tab widget counts (should have at least one widget)
- Verify activeTabId management in DashboardRenderer

## API Reference

See `src/components/CBCGrading/dashboard/index.ts` for exported types and components.
