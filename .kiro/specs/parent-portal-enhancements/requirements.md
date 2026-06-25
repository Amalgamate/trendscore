# Requirements: Parent Portal Enhancements

## Overview

Three interconnected improvements that elevate the parent experience on desktop and keep every user on top of configuration health across the school:

1. Parent sidebar links for Fees and Academics on desktop
2. A daily, AI-enhanced configuration reminder engine that alerts the right person about every misconfigured entity, once per day
3. A dismissable in-app banner that surfaces those alerts on login

---

## Feature 1 — Parent Portal Desktop Sidebar

### REQ-1.1 School Fees section in sidebar
When a user with the PARENT role opens the application on desktop, the sidebar MUST include a "School Fees" section with a single navigation item that routes to `parent-portal-fees`.

**Acceptance criteria:**
- The section is visible in both collapsed (icon-only) and expanded sidebar modes
- The icon is the `Receipt` lucide icon in rose-500 colour, matching the existing colour palette for finance items
- Clicking the item in expanded mode navigates to `parent-portal-fees`
- Clicking the icon in collapsed mode navigates to `parent-portal-fees`

### REQ-1.2 Outstanding balance badge on the Fees link
When the parent has at least one linked child with a fee balance, the Fees navigation item MUST display a live badge showing the total outstanding amount.

**Acceptance criteria:**
- In expanded mode the badge shows "KES X,XXX" with a rose background when balance > 0
- In expanded mode the badge shows "✓ Cleared" with an emerald background when balance is 0 and children exist
- In collapsed mode a small coloured dot (red = owing, green = cleared) is shown instead of the full text
- No badge is rendered when no children are linked to the parent account
- Badge data comes from a single `FeeBadgeProvider` context that reuses the existing `dashboardAPI.getParentMetrics()` call and does NOT trigger an additional network request per sidebar render

### REQ-1.3 Academics section in sidebar
The sidebar for PARENT role MUST include an "Academics" section with three sub-navigation items:

| Label | Route |
|---|---|
| Results | `parent-portal-results` |
| Attendance | `parent-portal-attendance` |
| Children | `parent-portal-children` |

**Acceptance criteria:**
- The section header icon is the `GraduationCap` lucide icon in amber-500 colour
- All three items are visible when the sidebar is expanded
- In collapsed mode, clicking the section icon expands the sidebar and navigates to `parent-portal-results` (the first non-greyed item)
- Section appears below the "School Fees" section in the sidebar

### REQ-1.4 Sidebar sections only for PARENT role
The two new sidebar sections (School Fees and Academics) MUST only be rendered when the authenticated user's role is `PARENT`. All other roles must see no change to their existing navigation.

### REQ-1.5 Injection is non-destructive
The `injectParentPortalSections()` function that adds the two sections MUST NOT mutate or remove any existing nav sections already built by `transformNavForParentRole()`.

---

## Feature 2 — Global Configuration Reminder Engine

### REQ-2.1 Daily cron schedule
The configuration reminder engine MUST run once per day at 08:00 AM EAT (05:00 UTC), triggered by the existing `node-cron` worker in `cron-worker.ts`.

### REQ-2.2 Pluggable checker architecture
The engine MUST use a `ConfigurationCheckerRegistry` that accepts registered `ConfigurationChecker` implementations. Adding a new check MUST require only registering one new class with no changes to orchestrator logic.

**Acceptance criteria:**
- `ConfigurationCheckerRegistry.register(checker)` returns `this` (fluent interface)
- `ConfigurationCheckerRegistry.runAll()` executes all registered checkers concurrently via `Promise.allSettled`
- A checker that throws does NOT prevent other checkers from running

### REQ-2.3 Five initial checkers
The following checkers MUST be implemented and registered at launch:

| Checker | Condition | Notifies |
|---|---|---|
| `TeacherNoSubjectsChecker` | Teacher has 0 active subject assignments | That teacher |
| `TeacherNoClassChecker` | Teacher is not assigned as class teacher anywhere | That teacher |
| `NoFeeStructureChecker` | 0 FeeStructure rows exist for the current term/year | All ADMIN/OWNER users |
| `NoActiveFeeTypesChecker` | 0 active FeeType rows in the school | All ADMIN/OWNER users |
| `NoTermConfigChecker` | 0 TermConfig rows for the current academic year | All ADMIN/OWNER users |

### REQ-2.4 Once-per-day deduplication
The `DeduplicationGuard` MUST ensure that no user receives more than one notification of the same `reminderType` in a single calendar day.

**Acceptance criteria:**
- Before creating a notification, the guard checks `UserNotification` for a row matching `(userId, metadata.reminderType)` created on or after midnight today (UTC)
- If a matching row exists, the notification is silently skipped
- The guard processes findings in bulk for efficiency

### REQ-2.5 AI-enhanced notification messages
Notification messages for configuration reminders SHOULD be enhanced using the existing `AIBridgeService` (OpenAI GPT-4o-mini or Anthropic Claude) to produce personalized, warm, context-aware text.

**Acceptance criteria:**
- The `AIMessageEnhancer` groups all findings into a single batched prompt call (not one call per finding)
- The prompt uses `jsonMode: true` and requests a JSON array of `{ userId, title, message }` objects
- If the AI call fails for any reason (API error, timeout, key not configured), the enhancer falls back to the checker's static `title` and `message` strings
- Fallback messages are never lost — the notification is still sent with `aiEnhanced: false` in metadata

### REQ-2.6 Notification metadata structure
Every configuration reminder notification created by the engine MUST include a `metadata` JSON field with the following fields:

```json
{
  "reminderType": "CONFIG_TEACHER_NO_SUBJECTS",
  "isConfigAlert": true,
  "severity": "WARNING",
  "link": "assess-learning-areas",
  "aiEnhanced": true,
  "generatedAt": "2026-06-24T05:00:00.000Z"
}
```

### REQ-2.7 Admin digest notification
After all individual teacher notifications are processed, the orchestrator MUST send a single digest notification to every active ADMIN and OWNER user summarising all school-wide configuration gaps found that day.

**Acceptance criteria:**
- The digest uses `reminderType: 'CONFIG_ADMIN_DIGEST'` and is also subject to the once-per-day deduplication rule
- The digest message is AI-generated when the AI bridge is available, with a fallback summary listing gap counts per type
- The digest notification has `metadata.isConfigAlert: true` so it surfaces in the Config Alert Banner

### REQ-2.8 Notifications delivered via existing infrastructure
All configuration reminder notifications MUST be created using the existing `NotificationService.createNotification()` method, which automatically:
- Persists to the `UserNotification` database table
- Emits a `notification:new` socket.io event to the user's room
- Optionally sends a Web Push notification

---

## Feature 3 — In-App Configuration Alert Banner

### REQ-3.1 Banner appears on login when unresolved alerts exist
When a user logs in and has one or more unread notifications with `metadata.isConfigAlert === true`, a dismissable banner MUST appear at the top of the application content area (below the 72px header).

**Acceptance criteria:**
- The banner is rendered in `ConfigAlertBanner.jsx`, mounted at the layout level so it is visible regardless of which page is active
- The banner shows the count of unresolved configuration items
- The banner has a "Review" button and a "✕" (dismiss) button

### REQ-3.2 Once-per-day dismissal persisted in localStorage
When the user clicks "✕" to dismiss the banner, the dismissal MUST be remembered for the rest of the calendar day.

**Acceptance criteria:**
- Dismissal stores `new Date().toISOString().slice(0, 10)` (e.g. `"2026-06-24"`) under the key `configAlertDismissedAt_${userId}` in `localStorage`
- The banner does NOT reappear until the next calendar day, even if the page is refreshed
- Dismissal key is scoped by `userId` so different users sharing a browser session are not affected by each other's dismissal

### REQ-3.3 Banner visual design matches alert severity
The banner background colour MUST reflect the severity of the outstanding alerts:
- Amber-600 background when alert count is ≤ 3
- Rose-600 background when alert count is > 3
- Entry animation: slide down from above using Tailwind `translate-y` transition

### REQ-3.4 Config Alert Modal with "Fix It" deep links
Clicking "Review" on the banner MUST open `ConfigAlertModal.jsx` showing a scrollable list of all unresolved config alerts.

**Acceptance criteria:**
- Each item shows: icon (keyed by `reminderType`), title, message, severity badge, and a "Fix It →" button
- "Fix It →" calls `onNavigate(alert.metadata.link)` and closes the modal
- A "Mark All Read" button at the bottom of the modal calls `markAllAsRead()` from `UserNotificationContext`
- Once all config alerts are marked read, the banner automatically disappears on next render (no page refresh required)

### REQ-3.5 Banner only shows unread config alerts
The banner MUST only count and display notifications where both conditions are true:
- `metadata.isConfigAlert === true`
- `isRead === false`

Notifications that have been marked read (manually or via "Mark All Read") MUST NOT be counted in the banner or shown in the modal.

### REQ-3.6 No additional API calls
The banner MUST derive its data exclusively from the `notifications` array already present in `UserNotificationContext`. It MUST NOT make any additional API or database requests.

---

## Non-Functional Requirements

### REQ-NFR-1 Performance — Checker concurrency
All registered configuration checkers MUST execute concurrently. The total cron job wall-clock time MUST be bounded by the slowest individual checker, not the sum of all checker times.

### REQ-NFR-2 Performance — Badge context reuse
`FeeBadgeProvider` MUST reuse the `dashboardAPI.getParentMetrics()` response already fetched by the parent dashboard. It MUST NOT make a redundant network request solely for the badge.

### REQ-NFR-3 Security — Config alerts created server-side only
Configuration alert notifications MUST be created exclusively by the server-side cron worker. No user-facing API endpoint may trigger or forge a config alert notification.

### REQ-NFR-4 Security — AI prompt contains no sensitive PII
The AI prompt sent by `AIMessageEnhancer` MUST contain only the user's first name, the `reminderType` identifier, and structured context counts. It MUST NOT include email addresses, phone numbers, fee amounts, student records, or any other sensitive data.

### REQ-NFR-5 Resilience — AI unavailability must not block notifications
If the AI bridge is unavailable (key not configured, network error, rate limited), the reminder engine MUST still send all notifications using the checker's static fallback messages. No notification may be silently dropped due to an AI failure.

### REQ-NFR-6 Extensibility — New checkers without orchestrator changes
Adding a new configuration check MUST require only:
1. Creating a new class that implements `ConfigurationChecker`
2. Calling `registry.register(new MyChecker())`

No changes to `ConfigReminderOrchestrator`, `AIMessageEnhancer`, or `cron-worker.ts` are required to add a new checker.
