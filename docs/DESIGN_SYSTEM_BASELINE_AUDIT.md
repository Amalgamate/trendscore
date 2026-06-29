# TrendSCORE Design System Baseline Audit

Generated from:

```bash
npm run audit:design-system
```

Date: 2026-06-27

## Summary

The initial audit is report-only. It intentionally does not fail CI yet because the current codebase contains known legacy patterns that must be migrated incrementally.

| Check | Matches | Files | Current Status |
|---|---:|---:|---|
| Hardcoded colors outside token/global style files | 1,622 | 141 | Needs migration |
| Arbitrary Tailwind values that may need tokens | 2,986 | 265 | Needs migration |
| Inline style props outside token/global/report contexts | 637 | 127 | Needs migration |
| Raw checkbox/radio controls outside primitives | 70 | 35 | Needs primitives |
| Shadow utilities in app code | 1,622 | 285 | Needs cleanup or token decision |
| Local skeleton/loading placeholder patterns | 123 | 80 | Needs shared Skeleton |
| Toast patterns outside intended notification layer | 262 | 43 | Needs shared Toast policy |
| Duplicate component definition names | 5 component names | N/A | Needs consolidation |

## Checkpoint 1: Primitive Foundation

After adding `Checkbox`, `RadioGroup`, `Switch`, and `Skeleton` primitives, and migrating the simple local parent/student skeleton helpers:

| Check | Initial | Current | Change |
|---|---:|---:|---:|
| Local skeleton/loading placeholder patterns | 123 | 99 | -24 |
| Duplicate component definition names | 5 | 4 | -1 |
| Raw checkbox/radio controls outside primitives | 70 | 70 | No migration yet |

`Skeleton` is no longer reported as a duplicate component definition. Remaining duplicate names are `EmptyState`, `KpiCard`, `Card`, and `StatusBadge`.

## Duplicate Component Names Found

| Component | Finding |
|---|---|
| Skeleton | Multiple local skeleton implementations exist across mobile dashboards, parent portal pages, and dashboard pages. |
| EmptyState | Local EmptyState implementations coexist with `src/design-system/components/EmptyState.tsx`. |
| KpiCard | Local KPI cards coexist with the design-system KpiCard. |
| Card | Local Card helpers coexist with `src/components/ui/card.jsx`. |
| StatusBadge | Several modules define local StatusBadge implementations. |

## Interpretation

The baseline confirms the earlier design-system audit: TrendSCORE has useful tokens and primitives, but enforcement is not yet mature. The immediate priority should be foundation work, not broad visual refactors.

Recommended next implementation order:

1. Create missing primitives: Checkbox, Radio, Switch, Skeleton, Toast policy, Pagination, SearchBar.
2. Decide radius and elevation policy, then align Tailwind config, tokens, and global CSS.
3. Migrate high-traffic forms to shared FormField, Label, HelperText, and ErrorText.
4. Consolidate Card, EmptyState, KpiCard, StatusBadge, and Skeleton usages.
5. Turn `npm run audit:design-system:strict` on only after whitelists and migration thresholds are agreed.
