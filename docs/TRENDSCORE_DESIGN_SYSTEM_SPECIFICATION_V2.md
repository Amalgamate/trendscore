# TrendSCORE Design System Specification v2.0

Status: Proposed standard  
Scope: Web app, mobile web app, dashboards, portals, and future modules  
Audience: Engineers, designers, product owners, QA, and AI coding assistants

## 1. Product Context

TrendSCORE is a comprehensive School Management Information System and ERP used daily by school owners, principals, deputy principals, bursars, accountants, teachers, parents, students, librarians, transport managers, HR staff, and system administrators.

The platform includes Finance, Assessments, Attendance, Admissions, Communication, Academics, Timetables, Transport, Inventory, Human Resources, Library, Boarding, Discipline, Medical, Analytics, and Mobile Applications.

TrendSCORE must scale from small private schools to large multi-campus institutions with thousands of concurrent users. The design system must therefore optimize clarity, speed, accessibility, consistency, and long-term maintainability over decoration.

## 2. Design Philosophy

| Principle | Meaning |
|---|---|
| Simplicity over decoration | UI should help users finish work quickly, not compete for attention. |
| Speed over visual complexity | Screens must feel responsive and direct, especially for high-volume users. |
| Consistency over creativity | Similar problems must use the same components and patterns. |
| Information density without clutter | Operational screens should fit real data while staying scannable. |
| Enterprise professionalism | The product should feel reliable, calm, and mature. |
| Accessibility first | WCAG AA is a baseline, not an enhancement. |
| Mobile-first responsiveness | Parent, student, and teacher workflows must work naturally on small screens. |
| Low cognitive load | Labels, actions, and layouts should be predictable. |

TrendSCORE should feel modern, minimal, elegant, calm, premium, professional, trustworthy, fast, and confident. It should never feel flashy, playful, childish, or visually experimental.

Avoid gradients unless they clarify hierarchy. Avoid glassmorphism, neumorphism, oversized rounded corners, and decorative shadows. Prefer subtle borders, clear spacing, and semantic color.

## 3. User Priorities

| User | Primary Design Need |
|---|---|
| Teachers | Fast daily entry of marks, attendance, comments, and reports. |
| Accountants | Dense, accurate financial tables, invoices, payments, and statements. |
| School owners | Executive KPIs, risks, trends, and next actions. |
| Parents | Simple, readable, mobile-first interfaces. |
| Students | Clean mobile-first academic and communication experiences. |
| Receptionists | Extremely fast lookup, admission, communication, and front-desk workflows. |
| Administrators | Powerful configuration without confusing custom UI patterns. |

## 4. Typography

Typography should be one of the strongest elements of TrendSCORE.

Requirements:

| Area | Standard |
|---|---|
| Font family | Use one primary sans-serif family across the app. |
| Scale | All text must derive from the documented typography scale. |
| Hierarchy | Headings, body, captions, labels, and buttons must be visually distinct. |
| Numbers | Financial values and KPIs must be easy to scan and align consistently. |
| Tables | Table typography must remain dense but readable. |
| Arbitrary sizes | Avoid `text-[...]` unless a token does not yet exist and the exception is documented. |

## 5. Color System

Colors must be tokens first. A color should not be introduced directly in a screen unless it is being added to the token system.

Required token groups:

| Group | Examples |
|---|---|
| Brand | Primary, secondary, accent |
| Semantic | Success, warning, danger, info |
| Surface | Page, panel, card, popover, modal |
| Text | Primary, secondary, muted, inverse, disabled |
| Border | Subtle, default, strong, focus |
| State | Hover, active, selected, disabled |
| Data | Chart, grade, assessment, finance, attendance |
| Modes | Light, dark, high contrast |

Color must communicate meaning rather than decoration. Financial, assessment, attendance, and risk states should use stable semantic mappings.

## 6. Spacing

Spacing must follow a predictable scale and should support dense enterprise workflows.

Required scales:

| Scale | Usage |
|---|---|
| Base spacing | Primitive layout unit. |
| Component spacing | Buttons, inputs, badges, tabs, controls. |
| Form spacing | Field groups, sections, helper text, validation text. |
| Table spacing | Compact, standard, and comfortable row density. |
| Page spacing | App shell gutters, dashboard gaps, section spacing. |
| Mobile spacing | Touch-friendly but compact mobile patterns. |

Avoid arbitrary spacing and one-off layout values unless approved as a temporary migration exception.

## 7. Radius and Elevation

TrendSCORE should use a restrained enterprise radius system. Rounded corners should help recognition, not create a playful visual language.

Required radius tokens:

| Component | Token Needed |
|---|---|
| Buttons | Default, icon, pill |
| Inputs | Default, compact |
| Cards | Default, elevated, mobile |
| Tables | Container, cells |
| Dialogs | Modal, drawer, sheet |
| Popovers | Menu, tooltip |

Elevation should primarily use borders and surface contrast. Shadows should be rare, tokenized, and reserved for overlays, floating menus, and dialogs.

## 8. Motion

Motion must be purposeful and fast.

Required motion tokens:

| Token | Usage |
|---|---|
| Fast | Hover, focus, small state changes |
| Base | Menus, tabs, field feedback |
| Slow | Dialogs and drawers |
| Easing | Standard enter, exit, and interactive easing |
| Reduced motion | Respect user preference |

Avoid decorative animation on operational screens.

## 9. Component Constitution

Every reusable component must have:

| Rule | Standard |
|---|---|
| One purpose | It should solve one clear UI problem. |
| One API | Consumers should not choose between competing APIs. |
| One implementation | No duplicate Button, Card, Toast, Table, or EmptyState. |
| One source of truth | Tokens and variants must live in the design system. |
| Documented states | Default, hover, focus, disabled, loading, error, empty. |
| Accessibility contract | Keyboard behavior, ARIA, labels, focus management. |

No new screen should invent a UI pattern when a primitive or framework component exists.

## 10. Required Component Catalogue

| Category | Components |
|---|---|
| Actions | Button, IconButton, ButtonGroup |
| Inputs | Input, SearchInput, PasswordInput, NumberInput, CurrencyInput, DateInput, PhoneInput, Textarea |
| Selection | Checkbox, Radio, Switch, Select, MultiSelect, Combobox |
| Feedback | Toast, Alert, Dialog, Drawer, Tooltip, Popover |
| Display | Badge, StatusBadge, Avatar, EmptyState, Spinner, Skeleton, Divider, Progress |
| Navigation | Sidebar, Header, Breadcrumb, Tabs, Pagination, MobileBottomNav |
| Data | EnterpriseTable, StatCard, KpiCard, ActionCard, Timeline, ChartWrapper |
| Forms | Form, FormField, Label, HelperText, ErrorText, RequiredMarker |
| Layout | PageShell, Section, Toolbar, FilterBar, DashboardShell |

## 11. Dashboard Framework

Dashboards should prioritize actions before analytics.

Every dashboard should answer:

1. What needs my attention?
2. What changed today?
3. What should I do next?
4. How is the school performing?

Required dashboard parts:

| Part | Purpose |
|---|---|
| DashboardShell | Consistent page structure and spacing. |
| DashboardHeader | Role, date, term, and primary context. |
| Attention queue | Tasks, alerts, approvals, exceptions. |
| Quick actions | High-frequency next steps. |
| Summary cards | Key metrics only. |
| Widgets | Role-specific operational panels. |
| Charts | Trends and comparisons, never chart clutter. |
| Recent activity | Audit and workflow context. |
| Empty state | Useful setup path when data is missing. |

Analytics must support decisions. It must not overwhelm the user.

## 12. Table Framework

Tables are a first-class citizen in TrendSCORE.

The table framework must support:

| Capability | Requirement |
|---|---|
| Large datasets | Virtualization when row counts are large. |
| Sticky headers | Required for long operational tables. |
| Sorting | Clear accessible indicators. |
| Filtering | Fast, visible, resettable filters. |
| Search | Debounced and keyboard-friendly. |
| Bulk actions | Selection states and confirmation patterns. |
| Export/import | Consistent controls and file-state feedback. |
| Financial readability | Aligned amounts, clear debit/credit/status treatment. |
| Density | Compact, standard, comfortable modes. |
| Responsive behavior | Mobile cards or horizontal strategy per module. |
| Print/PDF | Report tables must remain print friendly. |

## 13. Form Framework

Forms are the most-used interface in TrendSCORE.

Every form should minimize effort with:

| Capability | Requirement |
|---|---|
| Smart defaults | Pre-fill known term, class, user, date, and institution context. |
| Inline validation | Errors near the field, not only at submit. |
| Keyboard navigation | Tab order and Enter behavior must be predictable. |
| Auto focus | First meaningful field or first error. |
| Consistent spacing | Field groups and section rhythm must be standardized. |
| Required fields | One required marker pattern. |
| Helper text | Consistent placement and tone. |
| Error states | Field border, message, and summary where needed. |
| Read-only states | Clear visual difference from editable disabled fields. |

## 14. Mobile Design Language

Mobile must be treated as a first-class product surface, not only a responsive fallback.

Requirements:

| Area | Standard |
|---|---|
| Navigation | Role-aware bottom navigation and clear app bar. |
| Touch targets | Minimum 44px. |
| Safe areas | Respect device safe-area insets. |
| Cards | Dense, readable mobile cards for operational data. |
| Forms | Single-column, large enough controls, minimal typing. |
| Tables | Convert to cards or use deliberate horizontal scroll. |
| Performance | Avoid heavy dashboards on mobile. |

## 15. Accessibility Standards

Target WCAG AA.

Required:

| Area | Standard |
|---|---|
| Keyboard | All interactive elements reachable and operable. |
| Focus | Visible focus states on all controls. |
| Screen readers | Semantic HTML, labels, and ARIA where needed. |
| Contrast | WCAG AA for text and key UI states. |
| Touch | 44px minimum interactive target on touch surfaces. |
| Dialogs | Focus trap, escape close, labelled title. |
| Tooltips | Keyboard and touch accessible. |
| Motion | `prefers-reduced-motion` respected. |

## 16. Performance Standards

Design-system components must not create unnecessary runtime cost.

Required:

| Area | Standard |
|---|---|
| Rendering | Avoid unnecessary re-renders in high-volume screens. |
| Composition | Components should be composable without deep prop drilling. |
| CSS | Prefer tree-shakable utilities and tokenized classes. |
| Splitting | Support lazy loading for heavy modules and dashboards. |
| Tables | Virtualize large row sets. |
| Charts | Avoid expensive chart renders unless visible. |

## 17. Documentation Standards

Every design-system component must document:

| Section | Required Content |
|---|---|
| Description | What problem the component solves. |
| Props | Public API and types. |
| Variants | Visual and behavioral variants. |
| States | Default, hover, focus, disabled, loading, error, empty. |
| Accessibility | Keyboard and ARIA contract. |
| Examples | Common usage patterns. |
| Do | Approved usage. |
| Do not | Anti-patterns and migration warnings. |

## 18. Folder Structure

Recommended target structure:

```text
src/design-system/
  tokens/
    colors.ts
    typography.ts
    spacing.ts
    radius.ts
    elevation.ts
    motion.ts
    breakpoints.ts
  primitives/
    button/
    input/
    select/
    checkbox/
    dialog/
    table/
  patterns/
    forms/
    dashboards/
    tables/
    navigation/
  docs/
    component-guides/
  index.ts
```

## 19. Migration Strategy

Migration must be incremental.

1. Freeze new custom patterns.
2. Define tokens and primitives.
3. Wrap old components where a direct replacement is risky.
4. Deprecate duplicates with clear replacement paths.
5. Migrate high-traffic screens first.
6. Delete old components only after usage reaches zero.
7. Add automated checks after the rules are stable.

Existing screens must continue functioning during migration. New screens should immediately adopt the new design system.

## 20. Governance Rules

Golden rules:

| Rule | Standard |
|---|---|
| One component = one implementation | No duplicate UI component families. |
| One color = one token | No direct hex/rgb values outside tokens. |
| One spacing = one token | No arbitrary spacing without approval. |
| One typography scale | No arbitrary font sizes. |
| Accessibility first | No component ships without keyboard and screen reader review. |
| Mobile first | Mobile behavior must be designed, not patched later. |
| Enterprise consistency over creativity | Stable UI patterns win over novelty. |

