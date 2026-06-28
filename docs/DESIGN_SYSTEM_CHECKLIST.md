# TrendSCORE Design System Migration Checklist

Status: Proposed enforcement checklist  
Marking: Pass/fail, measurable, and verifiable  
Legend: `[ ]` Not started, `[~]` In progress, `[x]` Complete, `[!]` Blocked

## Completion Scoring

Each section should be scored as:

```text
Completed checks / Total checks = Section completion %
```

Final validation should report:

```text
Typography        0%
Colors            0%
Components        0%
Forms             0%
Tables            0%
Accessibility     0%
Performance       0%
Documentation     0%
```

## Phase 0: Freeze the Current System

Completion criteria: 100% pass.

| Status | Rule |
|---|---|
| [ ] | Stop creating new UI patterns. |
| [ ] | No new hardcoded colors. |
| [ ] | No new arbitrary spacing. |
| [ ] | No new custom buttons. |
| [ ] | No new custom inputs. |
| [ ] | No duplicate components. |
| [ ] | Every new screen uses existing primitives where possible. |

## Phase 1: Design Tokens

### Typography

| Status | Rule |
|---|---|
| [ ] | Single font family defined. |
| [ ] | Typography scale defined. |
| [ ] | Font weights defined. |
| [ ] | Line heights defined. |
| [ ] | Letter spacing defined. |
| [ ] | Code font defined. |
| [ ] | Number formatting rules defined. |
| [ ] | Typography documentation completed. |

### Colors

| Status | Rule |
|---|---|
| [ ] | Primary color token defined. |
| [ ] | Secondary color token defined. |
| [ ] | Accent color tokens defined. |
| [ ] | Success color tokens defined. |
| [ ] | Warning color tokens defined. |
| [ ] | Danger color tokens defined. |
| [ ] | Info color tokens defined. |
| [ ] | Surface color tokens defined. |
| [ ] | Background color tokens defined. |
| [ ] | Border color tokens defined. |
| [ ] | Text primary token defined. |
| [ ] | Text secondary token defined. |
| [ ] | Disabled state tokens defined. |
| [ ] | Focus state tokens defined. |
| [ ] | Hover state tokens defined. |
| [ ] | Active state tokens defined. |
| [ ] | Dark mode tokens defined or explicitly removed. |
| [ ] | High contrast mode tokens defined or explicitly deferred. |

### Spacing

| Status | Rule |
|---|---|
| [ ] | Base spacing scale defined. |
| [ ] | Margin scale defined. |
| [ ] | Padding scale defined. |
| [ ] | Gap scale defined. |
| [ ] | Grid spacing defined. |
| [ ] | Layout spacing defined. |

### Radius

| Status | Rule |
|---|---|
| [ ] | Button radius defined. |
| [ ] | Input radius defined. |
| [ ] | Card radius defined. |
| [ ] | Table radius defined. |
| [ ] | Dialog radius defined. |
| [ ] | Popover radius defined. |
| [ ] | Dropdown radius defined. |

### Shadows and Elevation

| Status | Rule |
|---|---|
| [ ] | No-shadow surface token defined. |
| [ ] | Small shadow token defined. |
| [ ] | Medium shadow token defined. |
| [ ] | Large shadow token defined. |
| [ ] | Overlay shadow token defined. |
| [ ] | Shadow usage rules documented. |

### Motion

| Status | Rule |
|---|---|
| [ ] | Duration scale defined. |
| [ ] | Easing scale defined. |
| [ ] | Hover motion rules defined. |
| [ ] | Focus motion rules defined. |
| [ ] | Loading motion rules defined. |
| [ ] | Dialog motion rules defined. |
| [ ] | Drawer motion rules defined. |
| [ ] | Reduced-motion behavior defined. |

## Phase 2: Primitive Components

Every component must exist exactly once.

### Buttons

| Status | Rule |
|---|---|
| [ ] | Primary variant exists. |
| [ ] | Secondary variant exists. |
| [ ] | Outline variant exists. |
| [ ] | Ghost variant exists. |
| [ ] | Link variant exists. |
| [ ] | Danger variant exists. |
| [ ] | Success variant exists. |
| [ ] | Icon variant exists. |
| [ ] | Loading state exists. |
| [ ] | Disabled state exists. |

### Inputs

| Status | Rule |
|---|---|
| [ ] | Text input exists. |
| [ ] | Password input exists. |
| [ ] | Email input exists. |
| [ ] | Search input exists. |
| [ ] | Number input exists. |
| [ ] | Date input exists. |
| [ ] | Currency input exists. |
| [ ] | Phone input exists. |

### Selection

| Status | Rule |
|---|---|
| [ ] | Checkbox exists. |
| [ ] | Radio exists. |
| [ ] | Switch exists. |
| [ ] | Select exists. |
| [ ] | MultiSelect exists. |
| [ ] | Combobox exists. |

### Feedback

| Status | Rule |
|---|---|
| [ ] | Toast exists. |
| [ ] | Alert exists. |
| [ ] | Dialog exists. |
| [ ] | Drawer exists. |
| [ ] | Tooltip exists. |
| [ ] | Popover exists. |

### Display

| Status | Rule |
|---|---|
| [ ] | Badge exists. |
| [ ] | Avatar exists. |
| [ ] | EmptyState exists. |
| [ ] | Spinner exists. |
| [ ] | Skeleton exists. |
| [ ] | Divider exists. |
| [ ] | Progress exists. |
| [ ] | StatusIndicator exists. |

### Navigation

| Status | Rule |
|---|---|
| [ ] | Sidebar exists. |
| [ ] | Header exists. |
| [ ] | Breadcrumb exists. |
| [ ] | Tabs exists. |
| [ ] | Pagination exists. |
| [ ] | SearchBar exists. |

### Data

| Status | Rule |
|---|---|
| [ ] | EnterpriseTable exists. |
| [ ] | StatCard exists. |
| [ ] | KpiCard exists. |
| [ ] | ActionCard exists. |
| [ ] | Timeline exists. |
| [ ] | ChartsWrapper exists. |

## Phase 3: Forms

| Status | Rule |
|---|---|
| [ ] | Form component exists. |
| [ ] | FormField component exists. |
| [ ] | Label component exists. |
| [ ] | Helper text component exists. |
| [ ] | Error text component exists. |
| [ ] | Validation pattern exists. |
| [ ] | Required marker pattern exists. |
| [ ] | Success state exists. |
| [ ] | Disabled state exists. |
| [ ] | Read-only state exists. |

## Phase 4: Dashboard Framework

Every dashboard should be built from:

| Status | Rule |
|---|---|
| [ ] | DashboardShell exists. |
| [ ] | DashboardHeader exists. |
| [ ] | SummaryCards pattern exists. |
| [ ] | QuickActions pattern exists. |
| [ ] | Widgets pattern exists. |
| [ ] | Charts pattern exists. |
| [ ] | RecentActivity pattern exists. |
| [ ] | Notifications pattern exists. |
| [ ] | Tasks pattern exists. |
| [ ] | EmptyDashboardState exists. |

## Phase 5: Table Framework

| Status | Rule |
|---|---|
| [ ] | Sorting exists. |
| [ ] | Filtering exists. |
| [ ] | Search exists. |
| [ ] | Sticky header exists. |
| [ ] | Pagination exists. |
| [ ] | Bulk actions exist. |
| [ ] | Export exists. |
| [ ] | Import exists. |
| [ ] | Density options exist. |
| [ ] | Column visibility exists. |
| [ ] | Loading state exists. |
| [ ] | Empty state exists. |
| [ ] | Error state exists. |

## Phase 6: Mobile

| Status | Rule |
|---|---|
| [ ] | Mobile navigation standardized. |
| [ ] | Bottom tabs standardized. |
| [ ] | Mobile cards standardized. |
| [ ] | Mobile forms standardized. |
| [ ] | Mobile tables standardized. |
| [ ] | Gesture behavior documented. |
| [ ] | Responsive rules documented. |
| [ ] | Safe-area handling standardized. |

## Phase 7: Accessibility

| Status | Rule |
|---|---|
| [ ] | WCAG AA target documented. |
| [ ] | Keyboard navigation verified. |
| [ ] | Focus states verified. |
| [ ] | Screen reader behavior verified. |
| [ ] | ARIA labels verified. |
| [ ] | Touch targets verified at 44px minimum. |
| [ ] | Contrast verified. |
| [ ] | Reduced motion verified. |

## Phase 8: Performance

| Status | Rule |
|---|---|
| [ ] | Memoization guidance documented. |
| [ ] | Lazy loading pattern documented. |
| [ ] | Code splitting pattern documented. |
| [ ] | Virtualized table pattern implemented. |
| [ ] | Tree shaking verified. |
| [ ] | Bundle analysis available. |

## Phase 9: Documentation

Every component must have:

| Status | Rule |
|---|---|
| [ ] | Description. |
| [ ] | Props. |
| [ ] | Variants. |
| [ ] | States. |
| [ ] | Accessibility notes. |
| [ ] | Examples. |
| [ ] | Do guidance. |
| [ ] | Do not guidance. |

## Phase 10: Cleanup

### Duplicate UI Search

The project should automatically search for:

| Status | Rule |
|---|---|
| [ ] | Duplicate buttons. |
| [ ] | Duplicate cards. |
| [ ] | Duplicate inputs. |
| [ ] | Duplicate tables. |
| [ ] | Duplicate empty states. |
| [ ] | Duplicate toasts. |
| [ ] | Duplicate search bars. |
| [ ] | Duplicate pagination. |
| [ ] | Duplicate skeletons. |
| [ ] | Duplicate status badges. |

### Hardcoded Values

| Status | Rule |
|---|---|
| [ ] | No hex colors outside token files. |
| [ ] | No `rgb()` or `rgba()` outside token files unless approved. |
| [ ] | No arbitrary spacing. |
| [ ] | No arbitrary radius. |
| [ ] | No arbitrary shadows. |
| [ ] | No inline styles except measured layout or third-party integration exceptions. |

### Tailwind Cleanup

| Status | Rule |
|---|---|
| [ ] | No arbitrary font sizes like `text-[13px]`. |
| [ ] | No arbitrary radius like `rounded-[17px]`. |
| [ ] | No arbitrary color classes like `bg-[#...]`. |
| [ ] | No unapproved `shadow-xl` or `shadow-2xl`. |
| [ ] | No duplicate utility chains for the same component role. |

## Phase 11: Migration Lifecycle

Each duplicate or legacy component follows this path:

```text
Old
  -> Deprecated
  -> Wrapped
  -> Replaced
  -> Deleted
```

| Status | Rule |
|---|---|
| [ ] | Old component identified. |
| [ ] | Replacement component selected. |
| [ ] | Deprecation note added. |
| [ ] | Wrapper created where needed. |
| [ ] | Usages migrated. |
| [ ] | Old component deleted after usage reaches zero. |

## Phase 12: Automated Enforcement

Recommended CI or local checks:

Current command:

```bash
npm run audit:design-system
```

Strict CI-ready mode:

```bash
npm run audit:design-system:strict
```

| Status | Rule |
|---|---|
| [ ] | Reject hardcoded hex colors outside token files. |
| [ ] | Reject arbitrary Tailwind values unless whitelisted. |
| [ ] | Flag duplicate component names outside the design system. |
| [ ] | Require new reusable UI components under `src/design-system`. |
| [ ] | Run accessibility checks for changed UI surfaces. |
| [ ] | Generate migration progress report. |
| [ ] | Fail PRs that introduce new duplicated UI patterns. |

## Golden Rules

| Status | Rule |
|---|---|
| [ ] | One component equals one implementation. |
| [ ] | One color equals one token. |
| [ ] | One spacing value equals one token. |
| [ ] | One typography scale. |
| [ ] | No duplicate UI. |
| [ ] | No hardcoded values. |
| [ ] | No unapproved inline styles. |
| [ ] | Accessibility first. |
| [ ] | Mobile first. |
| [ ] | Enterprise consistency over creativity. |
