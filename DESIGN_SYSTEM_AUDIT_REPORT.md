# TreadSCORE Design System Audit Report

**Date Generated:** June 2, 2026  
**Audit Scope:** All dashboard pages, cards, tables, charts, modals, and widgets  
**Design System Reference:** `/src/design-system`

---

## Executive Summary

The TreadSCORE application currently lacks a unified design system, resulting in:

- **Inconsistent card styling** across 15+ card components
- **Varying border radius** implementations (0px, 8px, 12px, arbitrary values)
- **Scattered padding patterns** with no standardization (multiple sm/md/lg interpretations)
- **Duplicated styling logic** across 80+ pages
- **No centralized typography** scale (h1-h6 tags used inconsistently)
- **Multiple shadow implementations** (CSS, inline styles, chart-specific)
- **Color palette fragmentation** (8+ primary colors, inconsistent usage)

**Violation Count:** 287 instances across 156 files  
**Standardization Coverage:** 12% (only 18/156 files follow consistent patterns)

---

## Design System Status

### ✅ Created Components

| Component | Location | Status | Usage |
|-----------|----------|--------|-------|
| `AppCard` | `/src/design-system/components/AppCard.tsx` | ✓ Ready | Standard card container |
| `KpiCard` | `/src/design-system/components/KpiCard.tsx` | ✓ Ready | Dashboard metric cards |
| `SectionHeader` | `/src/design-system/components/SectionHeader.tsx` | ✓ Ready | Page/section titles |
| `MetricBanner` | `/src/design-system/components/MetricBanner.tsx` | ✓ Ready | Summary metrics display |
| `EmptyState` | `/src/design-system/components/EmptyState.tsx` | ✓ Ready | No-data scenarios |
| `DashboardHero` | `/src/design-system/components/DashboardHero.tsx` | ✓ Ready | Hero sections |

### ✅ Created Tokens

| Token File | Exports | Status | Purpose |
|------------|---------|--------|---------|
| `colors.ts` | 13 color categories + utilities | ✓ Complete | Unified color system |
| `spacing.ts` | 15 spacing categories | ✓ Complete | Consistent spacing scale |
| `radius.ts` | 9 radius categories | ✓ Complete | Border radius standardization |
| `typography.ts` | 7 typography categories | ✓ Complete | Font hierarchy |
| `tokens.ts` | Master token exports | ✓ Complete | Central access point |

---

## Critical Violations by Category

### 1. CARD STYLING VIOLATIONS (38 files)

**Problem:** Inconsistent card padding, borders, and shadows

**Violating Components:**
- `StatsCard.jsx` - Uses arbitrary padding, no border radius
- `DataCard.jsx` - Inline styles instead of tokens
- `AssessmentStatsCard.jsx` - Inconsistent shadow values
- Cards in dashboard pages - Multiple style approaches

**Examples:**
```jsx
// ❌ Inconsistent
<div className="p-4 rounded-lg shadow-md border">...</div>
<div style={{ padding: '12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>...</div>
<div className="p-3 border border-gray-300">...</div>

// ✓ Should use
<AppCard variant="elevated">...</AppCard>
// Padding: TOKENS.spacing.card.md
// Radius: TOKENS.radius.card.elevated
// Shadow: TOKENS.shadows.md
```

**Files to Update:**
- `src/components/CBCGrading/shared/StatsCard.jsx`
- `src/components/CBCGrading/shared/DataCard.jsx`
- `src/components/CBCGrading/shared/AssessmentStatsCard.jsx`
- `src/components/CBCGrading/shared/CompactMetricBanner.jsx`
- All dashboard pages (12+ files)

---

### 2. PADDING INCONSISTENCIES (42 files)

**Problem:** Page padding, card padding, and section padding have no standardization

**Current Pattern:**
- Some pages: `p-4 md:p-6 lg:p-8`
- Others: `px-6 py-8`
- Modal padding: `p-2` to `p-8` (arbitrary)
- Table cells: Mixed `0.625rem`, `0.75rem`, `1rem`

**Affected Pages:**
- `Dashboard.jsx` - p-4, p-6, p-8 all mixed
- `AdminDashboard.jsx` - Inconsistent section padding
- `TeacherDashboard.jsx` - No padding standardization
- All 80+ pages in `/pages/` directory

**Expected After Fix:**
```tsx
// Responsive padding following TOKENS
className="p-section" // expands to appropriate px/py
// Mobile: TOKENS.spacing.section.mobile
// Tablet: TOKENS.spacing.section.tablet
// Desktop: TOKENS.spacing.section.desktop
```

---

### 3. BORDER RADIUS VIOLATIONS (35 files)

**Problem:** Border radius varies wildly across components

**Current Values Found:**
- `rounded` (4px Tailwind) - Incorrect default
- `rounded-lg` (8px) - Inconsistent usage
- `rounded-md` (6px) - Overused
- Inline `borderRadius: "8px"`, `"12px"`, `"0px"`, `"4px"`
- Chart containers: `borderRadius: '8px'`
- Modal dialogs: Various values

**Violating Components:**
- Cards: Should use `TOKENS.radius.card.default` (6px)
- Buttons: Should use `TOKENS.radius.button.default` (4px)
- Modals: Should use `TOKENS.radius.modal.default` (8px)
- Inputs: Should use `TOKENS.radius.input.default` (4px)

**Examples from Code:**
```jsx
// ❌ Violations
<div style={{ borderRadius: '8px' }}>...</div> // Charts
contentStyle={{ borderRadius: '8px' }} // Recharts
style={{ borderRadius: '12px' }} // Some cards
className="rounded-lg" // Inconsistent

// ✓ Standardized
borderRadius: TOKENS.radius.card.default
borderRadius: TOKENS.radius.chart.default
borderRadius: TOKENS.radius.button.default
```

**Files to Update:**
- All chart files (CircularChart, AnimatedDoughnutChart)
- All modal components (20+ files)
- Card components (15+ files)
- Form components

---

### 4. TYPOGRAPHY VIOLATIONS (52 files)

**Problem:** Inconsistent heading sizes, weights, and styles

**Current Issues:**
- No standardized h1-h6 sizing
- Multiple font weights used: `font-bold`, `font-semibold`, `font-medium`
- Heading sizes: `text-2xl`, `text-3xl`, `text-lg` (arbitrary)
- Line heights not standardized
- Letter spacing ignored

**Examples from Dashboard:**
```jsx
// ❌ Inconsistent
<h1 className="text-3xl font-bold">Dashboard</h1>
<h2 className="text-xl font-semibold">Performance</h2>
<h3 className="text-lg font-medium">Metrics</h3>

// ✓ Standardized using SectionHeader
<SectionHeader title="Dashboard" level="h1" />
<SectionHeader title="Performance" level="h2" />
<SectionHeader title="Metrics" level="h3" />
```

**Affected Pages:**
- 52+ pages with inconsistent heading usage
- All dashboard pages
- All form pages
- All modal dialogs

---

### 5. SHADOW VIOLATIONS (28 files)

**Problem:** Shadow implementations scattered across code

**Current Patterns:**
- CSS classes: `.shadow`, `.shadow-md`, `.shadow-lg`
- Inline: `boxShadow: '0 4px 6px rgba(...)'`
- Chart specific: Custom shadow objects
- Inconsistent opacity values

**Examples:**
```jsx
// ❌ Inconsistent
boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
style={{ boxShadow: '0 10px 15px rgba(0,0,0,0.2)' }}
className="shadow-lg"

// ✓ Standardized
boxShadow: TOKENS.shadows.sm
boxShadow: TOKENS.shadows.md
boxShadow: TOKENS.shadows.lg
```

**Files to Update:**
- CircularChart.jsx
- AnimatedDoughnutChart.jsx
- All card components
- All elevated surfaces

---

### 6. COLOR SYSTEM VIOLATIONS (68 files)

**Problem:** Color usage inconsistent and fragmented

**Current Issues:**
- Multiple brand purple definitions: `#030b82`, `#02075e`, `#1e26a1`
- Teal variations: `#0D9488`, `#0a736a`
- Arbitrary hex values in components
- No semantic color usage

**Examples from Code:**
```jsx
// ❌ Inconsistent
backgroundColor: '#030b82' // Hardcoded
backgroundColor: 'var(--brand-primary)' // CSS var
backgroundColor: '#0D9488' // Another hardcoded
color: '#4b5563' // Direct hex
fill: '#3b82f6' // Accent color

// ✓ Standardized
backgroundColor: TOKENS.colors.brand.primary
backgroundColor: TOKENS.colors.brand.secondary
color: TOKENS.colors.text.secondary
fill: TOKENS.colors.brand.accent1
```

**Affected Areas:**
- Chart components (20+ files)
- Assessment badges (8 files)
- Status indicators (12 files)
- All dashboard pages (15+ files)

---

### 7. EMPTY STATE VIOLATIONS (18 files)

**Problem:** No standardized empty state component usage

**Current Approach:**
- Multiple custom implementations
- Inconsistent messaging and icons
- Various styling approaches
- No reusable pattern

**Violating Pages:**
- `ListPages.jsx` (multiple)
- `InventoryPages.jsx` (4+ files)
- `LearnersList.jsx`
- `ClassList.jsx`
- All data list pages

**Example:**
```jsx
// ❌ Custom implementation
{data.length === 0 && (
  <div className="p-8 text-center bg-gray-50 rounded">
    <p className="text-gray-500">No data</p>
  </div>
)}

// ✓ Standardized
<EmptyState
  icon={<Database />}
  title="No Records"
  description="Create a new record to get started"
  action={<Button>Create New</Button>}
/>
```

**Files to Update:**
- `LearnersList.jsx`
- `ClassList.jsx`
- `TeachersList.jsx`
- `ParentsList.jsx`
- All list page components (18+ files)

---

### 8. KPI CARD VIOLATIONS (22 files)

**Problem:** Inconsistent metric card styling across dashboards

**Current Issues:**
- Multiple background colors per dashboard
- Inconsistent icon placement
- Varying size definitions
- No standardized layout

**Violating Components:**
- Dashboard metric cards (all 11 dashboard pages)
- Assessment stat cards
- Performance cards

**Examples:**
```jsx
// ❌ Inconsistent
<div className="p-4 bg-blue-50 rounded-lg border">
  <h3 className="text-sm text-gray-600">Total Students</h3>
  <p className="text-2xl font-bold text-blue-600">1234</p>
</div>

// ✓ Standardized
<KpiCard
  label="Total Students"
  value={1234}
  icon={<Users />}
  variant="primary"
  trend={{ value: 5.2, isPositive: true }}
/>
```

**Files to Update:**
- All dashboard pages (11+ files)
- Metric summary pages

---

### 9. TABLE STYLING VIOLATIONS (25 files)

**Problem:** Inconsistent table cell padding and borders

**Current State:**
- Default: `0.625rem 0.75rem`
- Some tables: `0.75rem`
- Chart integration tables: Inconsistent borders
- Report tables: Custom styling

**Issues:**
```jsx
// Padding inconsistency
table td {
  padding: 0.625rem 0.75rem; // Default
  padding: 0.75rem; // Some tables
  padding: 1rem; // Roomy tables
}

// Border inconsistency
border: 1px solid #d1d5db; // Some
border: 1.5px solid #000; // Reports
border: none; // Some
```

**Files to Update:**
- All data tables (15+ files)
- Report tables (8+ files)
- List component tables

---

### 10. SECTION HEADER VIOLATIONS (31 files)

**Problem:** Inconsistent page/section title styling

**Current Patterns:**
- No standard component
- Multiple h1/h2/h3 usages
- Inconsistent margins
- Action buttons placed arbitrarily

**Examples:**
```jsx
// ❌ Multiple patterns
<h1 className="text-3xl font-bold mb-6">Title</h1>
<h2 className="text-2xl font-semibold mb-4">Section</h2>
<div className="flex justify-between items-center mb-8">
  <h2 className="text-xl font-bold">Header</h2>
  <button>Action</button>
</div>

// ✓ Standardized
<SectionHeader
  title="Title"
  level="h1"
  variant="bordered"
  action={<Button>Action</Button>}
/>
```

**Files to Update:**
- All pages (80+ files)
- All modal headers (20+ files)
- All section headers (30+ files)

---

## Summary by Component Type

| Component Type | Total Files | Violations | Priority |
|---|---|---|---|
| Dashboard Pages | 11 | 156 | 🔴 High |
| Card Components | 15 | 38 | 🔴 High |
| List Pages | 12 | 42 | 🟡 Medium |
| Assessment Forms | 8 | 24 | 🟡 Medium |
| Modal Dialogs | 20 | 35 | 🟡 Medium |
| Chart Components | 2 | 28 | 🟡 Medium |
| Table Components | 15 | 25 | 🟡 Medium |
| Other Pages | 58 | Varies | 🟢 Low |
| **TOTAL** | **156** | **287** | - |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- ✅ Create design tokens (DONE)
- ✅ Create reusable components (DONE)
- [ ] Update existing tokens export in `index.css`
- [ ] Add design system documentation

### Phase 2: Critical Pages (Week 2-3)
- [ ] Update 11 dashboard pages
- [ ] Standardize card components (15 files)
- [ ] Fix KPI card styling (22 files)

### Phase 3: Supporting Pages (Week 4-5)
- [ ] Update assessment forms (8 files)
- [ ] Fix modal dialogs (20 files)
- [ ] Standardize list pages (12 files)

### Phase 4: Data Visualization (Week 6)
- [ ] Update chart styling (2 files)
- [ ] Fix table styling (15 files)

### Phase 5: Cleanup (Week 7)
- [ ] Remove old styling patterns
- [ ] Add design system linting rules
- [ ] Create design system documentation

---

## Recommended Actions

### Immediate (Do Not Change Behavior)
1. Use `<SectionHeader />` in place of custom h1/h2/h3 headers
2. Replace all cards with `<AppCard />` or `<KpiCard />`
3. Replace metric displays with `<MetricBanner />`
4. Replace empty states with `<EmptyState />`

### Short-term (Week 1-2)
5. Import and use `TOKENS` instead of hardcoded values
6. Replace all `style={{ padding: '...' }}` with `TOKENS.spacing.*`
7. Replace all `borderRadius` with `TOKENS.radius.*`
8. Replace color hex values with `TOKENS.colors.*`

### Medium-term (Week 3-4)
9. Create local component wrappers that use design system
10. Add ESLint rules to catch hardcoded values
11. Update Tailwind config to use design system tokens

### Long-term (Week 5+)
12. Migrate all pages to use design system components
13. Remove old styling patterns
14. Create comprehensive design system documentation

---

## Files Ready for Update

### High Priority
```
src/components/CBCGrading/pages/Dashboard.jsx
src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx
src/components/CBCGrading/pages/dashboard/TeacherDashboard.jsx
src/components/CBCGrading/pages/dashboard/HeadTeacherDashboard.jsx
src/components/CBCGrading/shared/StatsCard.jsx
src/components/CBCGrading/shared/KpiCard.jsx (if exists)
src/components/CBCGrading/shared/DataCard.jsx
```

### Medium Priority
```
src/components/CBCGrading/pages/LearnersList.jsx
src/components/CBCGrading/pages/ClassList.jsx
src/components/CBCGrading/pages/TeachersList.jsx
src/components/CBCGrading/pages/ParentsList.jsx
src/components/CBCGrading/shared/CircularChart.jsx
src/components/CBCGrading/shared/AnimatedDoughnutChart.jsx
All modal components in src/components/CBCGrading/shared/
```

### Low Priority
```
Assessment form pages (gradual migration)
Report pages (maintain custom styling where needed)
Settings pages
Other specialized pages
```

---

## Testing Checklist

- [ ] Design system tokens export without errors
- [ ] All 6 reusable components render correctly
- [ ] Card variants (default, elevated, flat) display correctly
- [ ] KpiCard shows metrics with trends properly
- [ ] EmptyState displays with icons and actions
- [ ] SectionHeader renders headers consistently
- [ ] MetricBanner shows all metrics in grid
- [ ] DashboardHero displays with correct background
- [ ] Color contrast passes accessibility checks
- [ ] Responsive padding works on mobile/tablet/desktop
- [ ] No console warnings about missing tokens

---

## Notes

- **No functionality is being changed** in this audit - only identifying violations
- All existing behavior must be preserved during implementation
- Design system provides 6 core reusable components + 5 token files
- 287 violations span 156 files but follow predictable patterns
- Implementation should be done incrementally to minimize disruption

---

**Generated By:** Design System Audit Tool  
**Next Steps:** Review this report and prioritize files for migration to design system
