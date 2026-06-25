# Tasks: Parent Portal Enhancements

## Task Overview

Three feature areas broken into independently-executable tasks, ordered so each task's dependencies are already satisfied when it runs.

---

- [ ] 1. Backend — Config Reminder Engine infrastructure
  - Create `server/src/services/config-reminder/types.ts` — `RawFinding`, `EnhancedFinding`, `ConfigReminderType`, `ConfigurationChecker` interface
  - Create `server/src/services/config-reminder/registry.ts` — `ConfigurationCheckerRegistry` with `register()`, `getAll()`, `runAll()` (concurrent via `Promise.allSettled`, swallows individual checker failures)
  - Create `server/src/services/config-reminder/dedup-guard.ts` — `DeduplicationGuard` with `isDuplicate(userId, reminderType)` and `bulkFilter(findings)` using Prisma `userNotification.findFirst` with today's date filter
  - Create `server/src/services/config-reminder/ai-enhancer.ts` — `AIMessageEnhancer` that groups findings into a single batched `aiBridgeService.generateCompletion()` call with `jsonMode: true`; fallback to raw title/message on any error
  - Create `server/src/services/config-reminder/orchestrator.ts` — `ConfigReminderOrchestrator.runDailyConfigCheck()` that runs registry → AI enhance → dedup → create notifications → admin digest
  - **Relevant files:** `server/src/services/notification.service.ts`, `server/src/services/ai-bridge.service.ts`, Prisma schema
  - **Tests:** Unit test for `registry.runAll()` (checker failure isolation), `dedup-guard` (already-sent vs not-sent), `ai-enhancer` (AI failure fallback)

- [ ] 2. Backend — Five initial configuration checkers
  - Create `server/src/services/config-reminder/checkers/teacher-no-subjects.checker.ts` — queries `SubjectAssignment` table; finds TEACHER users with 0 assignments; returns one `RawFinding` per teacher
  - Create `server/src/services/config-reminder/checkers/teacher-no-class.checker.ts` — queries `Class` table for class-teacher field; finds TEACHER users not assigned as class teacher anywhere
  - Create `server/src/services/config-reminder/checkers/no-fee-structure.checker.ts` — counts `FeeStructure` rows for current term/year; notifies all ADMIN/OWNER users if 0 found
  - Create `server/src/services/config-reminder/checkers/no-fee-types.checker.ts` — counts active `FeeType` rows; notifies all ADMIN/OWNER users if 0 found
  - Create `server/src/services/config-reminder/checkers/no-term-config.checker.ts` — counts `TermConfig` rows for current academic year; notifies all ADMIN/OWNER users if 0 found
  - Wire all five checkers into a `createDefaultRegistry()` factory function exported from the `config-reminder` index
  - **Depends on:** Task 1
  - **Tests:** Each checker tested with Prisma mock returning "gap exists" and "no gap" scenarios

- [ ] 3. Backend — Hook reminder engine into cron worker
  - Import `ConfigReminderOrchestrator` and `createDefaultRegistry()` into `server/src/cron-worker.ts`
  - Add a daily cron job at `5 5 * * *` (8:05 AM EAT / 05:05 UTC) that calls `orchestrator.runDailyConfigCheck()`
  - Error is caught and logged; cron worker continues if the config check fails
  - **Depends on:** Task 1, Task 2
  - **Relevant file:** `server/src/cron-worker.ts`

- [ ] 4. Frontend — `FeeBadgeProvider` context
  - Create `src/contexts/FeeBadgeContext.jsx` — lightweight React context that calls `dashboardAPI.getParentMetrics()` once on mount and exposes `{ totalBalance: number | null, isCleared: boolean }`
  - Only fetches when authenticated user role is `PARENT`
  - Memoize the context value to prevent unnecessary re-renders
  - Export `useFeeBadge()` hook
  - **Relevant files:** `src/services/api.js` (`dashboardAPI.getParentMetrics`), `src/hooks/useAuth.js`

- [ ] 5. Frontend — Parent sidebar sections injection
  - In `src/components/CBCGrading/hooks/useNavigation.js`, add `injectParentPortalSections(sections)` pure function that appends:
    - Section `parent-portal-finance` (label: "School Fees", icon: `Receipt`) with item `{ id: 'portal-fees', label: 'School Fees', path: 'parent-portal-fees' }`
    - Section `parent-portal-academics` (label: "Academics", icon: `GraduationCap`) with items: Results (`parent-portal-results`), Attendance (`parent-portal-attendance`), Children (`parent-portal-children`)
  - Call `injectParentPortalSections()` at the end of `transformNavForParentRole()` before the final filter step
  - Add two new cases to `getCollapsedIconColor()` in `Sidebar.jsx`:
    - `'parent-portal-finance'` → rose-500 with matching glow classes
    - `'parent-portal-academics'` → amber-500 with matching glow classes
  - **Depends on:** Task 4 (FeeBadgeProvider needed for badge in next task, but sections work without badge)
  - **Relevant files:** `src/components/CBCGrading/hooks/useNavigation.js`, `src/components/CBCGrading/layout/Sidebar.jsx`

- [ ] 6. Frontend — Fee badge on sidebar Fees link
  - Create `src/components/CBCGrading/layout/ParentNavLeafItem.jsx` — thin wrapper around `LeafItem` that renders a `BadgeSpec` pill when `badge` prop is present
  - In expanded mode: pill shows "KES X,XXX" (rose) or "✓ Cleared" (emerald)
  - In collapsed mode: coloured dot (red = owing, green = cleared, hidden = no children)
  - Use `useFeeBadge()` hook in the sidebar to pass badge data to the `parent-portal-fees` leaf item
  - Wrap `CBCGradingSystem` (or equivalent root) with `FeeBadgeProvider`
  - **Depends on:** Task 4, Task 5
  - **Relevant files:** `src/components/CBCGrading/layout/Sidebar.jsx`, `src/components/CBCGrading/layout/ParentNavLeafItem.jsx`

- [ ] 7. Frontend — `ConfigAlertBanner` and `ConfigAlertModal` components
  - Create `src/components/CBCGrading/layout/ConfigAlertBanner.jsx`:
    - Reads `notifications` from `useUserNotifications()`
    - Filters to `metadata?.isConfigAlert === true && !isRead`
    - Reads `configAlertDismissedAt_${user.id}` from `localStorage`; hides if dismissed today
    - Renders `fixed top-[72px] left-0 right-0 z-40` amber-600 banner (≤3 alerts) or rose-600 banner (>3)
    - Slide-down entry animation via Tailwind `translate-y` transition
    - "Review" button opens `ConfigAlertModal`; "✕" button stores today's ISO date in localStorage and hides banner
  - Create `src/components/CBCGrading/layout/ConfigAlertModal.jsx`:
    - Receives `alerts[]`, `onClose`, `onNavigate` props
    - Renders modal with title "🔧 X Configuration Items Need Attention"
    - Scrollable list: icon (by reminderType), title, message, severity badge, "Fix It →" button
    - "Fix It →" calls `onNavigate(alert.metadata?.link)` then `onClose()`
    - "Mark All Read" button calls `markAllAsRead()` from `useUserNotifications()`
  - **Depends on:** (none — reads from existing context)
  - **Relevant files:** `src/contexts/UserNotificationContext.jsx`, `src/hooks/useAuth.js`

- [ ] 8. Frontend — Mount `ConfigAlertBanner` in the application shell
  - Import and render `<ConfigAlertBanner onNavigate={handleNavigate} />` inside the authenticated layout in `CBCGradingSystem.jsx` (or equivalent root layout component), positioned below the Header component
  - Verify the banner only renders for authenticated users with the right notification type
  - **Depends on:** Task 7
  - **Relevant files:** `src/components/CBCGrading/CBCGradingSystem.jsx` (or the authenticated shell that wraps all pages)
