# Digital Diary Module Plan and Self-Checking Checklist

**Status:** Teacher, parent, leadership, and student web/PWA role drafts implemented; student landing now follows the compact action-first visual system; all role review gates remain open; Flutter work remains last.  
**Working rule:** Finish and review **all web/PWA role UIs first** in this order: **Teacher → Parent → Admin/Head Teacher → Student**. Then deliver and review Flutter role UIs. The user approves the complete UI before functionality or backend work begins.  
**Reusable UI skill:** [TrendSCORE web UI](../.agents/skills/trendscore-web-ui/SKILL.md)  
**Local review app:** `http://localhost:3000` (web/PWA), API `http://localhost:5000`

This is the source-of-truth checklist for the Digital Diary module across the web app/PWA and Flutter app. Update the checkboxes and status notes as work proceeds. Do not mark a phase complete until its exit checks pass and the user has approved the relevant review gate.

## 1. Product goal

Make Digital Diary the teacher's daily teaching workspace: class communication, daily/holiday homework, assignment and submission follow-up, teacher-owned assessment entry and reports, class attendance, clock-in entry, and the day’s timetable/teaching resources. Reuse existing LMS and school workflows as the sources of truth; the Diary brings their teacher actions together instead of duplicating their records. Keep teacher assessment reports private to the teacher workflow; do not add report cards or parent score distribution to this scope.

The teacher workspace is day- and class-centred. Inbox conversations and school-wide notices remain separate. Administrative configuration and school-wide analytics remain outside the teacher Diary.

## 1.1 UI design rules

- Replace the teacher-facing Learning top-level destinations with a single **Digital Diary** entry; its horizontal workspace tabs are **Today, Class diary, Homework, Assessment, Attendance, Class plan**.
- Use compact, consistent cards. Use solid high-contrast blue, green, purple, and red fills for key summary/quick-action cards, with semantic meaning and readable text/icons. Keep long lists/forms on calm neutral surfaces; avoid decorative gradients and excessive saturated panels.
- Keep the module neat at desktop and phone widths; let tabs scroll horizontally on narrow screens and avoid a second redundant navigation row.
- Mark sample data and preview actions clearly. Before the user approves the UI, controls must not write records, publish, or notify.

## 2. Existing app surfaces to combine

| Existing surface | Current purpose | Digital Diary treatment |
|---|---|---|
| Web sidebar: **Learning → Assignments** (`learning-assignments`) | Teacher assignment authoring, publishing, assignment detail and submission review | Consolidate the teacher entry point into **Digital Diary**. Retain existing assignment routes/APIs as implementation destinations behind the approved Diary flows. |
| Web sidebar: **Assessment** (`assess-formative`, `assess-summative-assessment`, formative reports) | Score entry and assessment reporting | Surface teacher-owned score entry and teacher assessment reports inside the teacher workspace; no report-card publishing or parent sending. |
| Web sidebar: **Attendance** (`attendance-daily`) | Class attendance register and reports | Surface class register entry from the teacher workspace, retaining the existing attendance workflow and its permissions. |
| Teacher dashboard | Clock-in, timetable, class/learner summaries, pending assessment and attendance work | Bring daily clock-in status and class plan into the Diary landing flow. |
| Web sidebar: **Learning tools** (lessons, quizzes, revision library) | Lesson/resource authoring and interactive learning tools | Link to these from the Diary’s class plan/teaching tools area where they help teachers prepare and follow up lessons. Keep distinct destinations where their workflows need them. |
| Web sidebar: **Inbox → Notices & Announcements** (`comm-notices`) | Broader school notices | Keep separate. Diary class notes are scoped to the class/date; a teacher may link to or explicitly elevate a notice if permissions allow. |
| Web sidebar: **Inbox → Inbox** (`comm-messages`) | Private conversations | Keep separate. Do not turn diary entries into chat threads. |
| Web sidebar: **Student Portal → My Assignments** (`student-assignments`) | Student assignment list, submission, and feedback | Fold the student-facing assignment view into **My Diary**, retaining the assignment detail/submission flow. Other learning items such as courses/quizzes remain in their own destinations. |
| Parent portal: **Homework** (`parent-portal-homework`) | Per-child assignments and LMS status | Rename/reframe as **Diary & Homework** and add dated class communication; preserve child selection and homework status details. |
| Flutter teacher dashboard: legacy **My Assignments** sheet | Uses legacy `/assignments` API | Replace its role in the flow with the Diary UI; use the existing LMS assignment lifecycle when functionality work begins. |
| Flutter teacher Operations / Inbox / Notices | Operational shortcuts and general alerts | Add Diary as teacher work entry point; keep Inbox and broad notices distinct. |
| Flutter student/parent/admin shells | No complete Digital Diary flow confirmed | Add role-appropriate destinations after each corresponding UI is approved. |

## 3. Role scope and acceptance outcomes

### Teacher

- See a useful **Today** view with date, assigned classes, today's diary entries, due work, and items needing attention.
- Choose an assigned class and date; add/edit a class-scoped daily note; save as draft or publish.
- Create **Daily Homework** and **Holiday Homework** using class, learning area, instructions, issue date, due date, and submission mode.
- Reuse LMS assignment types, publishing, submissions, marking, feedback, and late/resubmission rules.
- Review a learner roster with distinct online status and offline/paper completion status.
- Mark offline work **Done**, **Not done**, or **Excused**, with optional notes and visible update history.
- See counts that reconcile to the correct active class roster; distinguish unmarked from not done.
- Only author or manage classes/subjects within the teacher's assigned workload.
- Reach class attendance, clock-in status, assessment score entry/reports, timetable, lessons, and learning resources from one teacher workspace without duplicating their underlying records.
- Keep general Inbox and school-wide Notices distinct from class/day diary communication.

### Student

- See **My Diary** for their currently enrolled class(es), ordered by date.
- Open the daily class note and find daily/holiday work with clear instructions and due dates.
- See status: not started, in progress, submitted, late, missing/overdue, returned, or marked, consistent with existing LMS lifecycle.
- Submit through existing LMS flow when the assignment accepts online submissions; view feedback and marks where permitted.
- Never see another learner's submission, private teacher notes, or class-level teacher completion controls.

### Parent/guardian

- See **Diary & Homework** for each linked child, with explicit child context.
- View class diary notes, daily/holiday work, due dates, online submission status, teacher-recorded paper completion, and released feedback.
- See a useful summary of upcoming, overdue, submitted, and completed work.
- Access only children already authorized by parent/learner relationship checks.
- No teacher-only authoring, marking, or other learner data.

### Admin / Head Teacher

- See a school-wide diary overview at a glance, with date range/day, class, teacher, and work-type filters.
- See whether each assigned class has a diary entry and work issued; surface missing diary days without treating weekends/holidays as teaching days by default.
- See assignment counts and a reliable roster denominator alongside submitted, late, marked, returned, offline done, not done, excused, and unmarked counts.
- Drill into a class/day and assignment detail with audit context.
- Oversight access should not silently change who authored the diary or assignment.
- Avoid exposing sensitive learner notes beyond the permissions intended for school leadership.

## 4. Decisions and rules to settle before functionality work

- [ ] Confirm whether parents see every teacher diary note or only entries published to families.
- [ ] Decide whether publishing a diary entry automatically creates an in-app notification, and whether SMS/WhatsApp requires a separate explicit action.
- [ ] Confirm whether a diary note may be edited after publishing; define edit history and whether recipients are notified about changes.
- [ ] Confirm what counts as a school day and how weekends, term breaks, holidays, and school-specific calendars affect diary completion indicators.
- [ ] Define whether holiday homework is one class assignment, class-by-class assignments, or a shared assignment with multiple classes.
- [ ] Decide whether online submission is optional per assignment and whether paper/offline completion can coexist with online submissions.
- [ ] Confirm who may change a teacher's offline completion record and how corrections are audited.
- [ ] Confirm default parent visibility for marks/feedback and any school setting that controls release timing.
- [ ] Define retention/archive rules for diary entries and completion registers.
- [ ] Confirm supported institution types/grades and whether class, stream, learning area, and term are all required in every diary flow.

## 5. UI-first phase checklist

No API, schema, permission, or workflow changes until the role's UI review gate is approved, except read-only inspection needed to inform its design.

### Phase UI-0 — Shared interaction and visual foundation

- [x] Start local web/PWA and API; health endpoint verified.
- [x] Keep local app available for live review during implementation.
- [x] Agree common terms: Digital Diary, Daily Homework, Holiday Homework, class note, online submission, offline completion.
- [x] Establish responsive page frame, spacing, date controls, class selector, status chips, and accessible focus/labels for the teacher UI preview.
- [x] Set role landing pages: Teacher → Digital Diary; Parent → family overview then selected child’s Diary; Admin/Head Teacher → school overview; Student → Student Workspace with My Diary as its first action. Diary assignment previews remain read-only until review, with the existing LMS detail route retained for the functional phase.
- [x] Confirm the teacher workspace areas shown in the first level: Today, Class Diary, Homework, Assessment, Attendance, and Class Plan.
- [x] Preserve existing assignment, assessment, attendance, and timetable route IDs while consolidating the teacher's visible entry points.

**Exit check:** shared patterns and labels are agreed before role-specific screens branch.

### Phase UI-1 — Teacher UI (web/PWA first)

- [x] Diary landing page preview: today's date, class switcher, quick summary, diary timeline, and work needing attention.
- [x] Daily class note composer preview: draft/published state, preview, audience cue, and edit affordance.
- [x] Daily Homework and Holiday Homework creation previews, including concise class/subject/due date fields.
- [x] Assignment progress preview with learner roster and independent online/offline status concepts.
- [ ] Leadership-safe preview of what students/parents will see.
- [x] Teacher workspace entry points for assessment score entry and teacher-only assessment reports.
- [x] Teacher workspace class attendance register preview, using the P/L/A/S/E interaction pattern.
- [x] Clock-in entry point and assigned timetable/class-plan preview.
- [x] Teaching tools preview (lessons, quizzes/activities, and revision resources) without duplicating their data.
- [x] Rename the visible Learning section to Digital Diary while retaining stable internal route IDs and role-specific views.
- [x] Replace the teacher's Learning submenu choices with one Digital Diary destination and six workspace tabs.
- [x] Add solid-color summary/quick-action cards based on the supplied color references.
- [ ] Responsive review at desktop and mobile/PWA widths.
- [ ] User reviews screenshots/live page and requests changes.
- [ ] **USER APPROVAL GATE: Teacher UI approved.**

### Phase UI-2 — Parent UI (web/PWA)

- [x] Reframe Parent Portal Homework as Diary & Homework.
- [x] Show one child at a time with a clear child switcher and child-specific diary workspace.
- [x] Include a parent-facing dated class note area, Daily/Holiday Homework, due dates, submission status, and released feedback from the existing assignment feed. Class-note content remains an empty state until diary sharing rules and the teacher publish flow are approved.
- [x] Make child with no assignments, overdue work, and all-caught-up states clear using the existing assignment tracker.
- [x] Add compact parent landing actions for children, diary, fees, attendance, inbox, and enabled school services.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Parent web/PWA UI approved.**

### Phase UI-3 — Admin / Head Teacher UI (web/PWA)

- [x] School-wide diary overview with date, class, teacher, and work-type filters (UI preview uses sample data).
- [x] Show missing diary entries, issued work, submission progress, offline completion, overdue and unmarked states (UI preview uses sample data).
- [x] Use clear roster denominator and drill-down into class/day/assignment details.
- [x] Show authorship/update history in the drill-down preview and keep learner marks/private feedback out of the leadership view.
- [ ] Review with Admin and Head Teacher role simulations; user requests changes.
- [ ] **USER APPROVAL GATE: Leadership web/PWA UI approved.**

### Phase UI-4 — Student UI (web/PWA)

- [x] Add My Diary destination, date navigation, class note area, Daily Homework, and Holiday Homework. Class notes remain a placeholder pending the teacher share flow.
- [x] Design assignment statuses, due dates, feedback, completed-work states, and a read-only assignment detail preview. Existing submission workflows remain outside this review preview.
- [x] Cover no work issued, offline/loading/error, overdue, returned for revision, and marked states.
- [x] Keep the view limited to the signed-in learner's assignments and exclude staff controls.
- [x] Replace the generic student landing with a compact, role-based workspace and distinct colored action rows; keep a clear account-link warning for student logins without a learner profile.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Student web/PWA UI approved.**

### Phase UI-5 — Teacher UI (Flutter)

- [ ] Add a clear Diary entry in the teacher app's four-item navigation or an agreed My Day entry point without overcrowding the menu.
- [ ] Rework the legacy My Assignments sheet concept into the same diary information architecture.
- [ ] Design class/date selection, daily note composition, assignment creation, and completion roster for phone use.
- [ ] Keep states and terminology aligned with approved web/PWA teacher UI.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Teacher Flutter UI approved.**

### Phase UI-6 — Parent UI (Flutter)

- [ ] Add or adapt parent Diary entry point in Flutter role navigation.
- [ ] Design child switching and compact diary/homework status cards.
- [ ] Match web/PWA rules and parent-visible content.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Parent Flutter UI approved.**

### Phase UI-7 — Admin / Head Teacher UI (Flutter)

- [ ] Add leadership Diary overview to Flutter Operations or agreed role location.
- [ ] Make at-a-glance school status useful on small screens; use filters/drill-down rather than dense tables.
- [ ] Match approved web/PWA concepts and permission boundaries.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Leadership Flutter UI approved.**

### Phase UI-8 — Student UI (Flutter)

- [ ] Add role-appropriate Diary navigation/entry point.
- [ ] Design compact diary feed and assignment status/detail for phone.
- [ ] Match approved web/PWA statuses and student-facing language.
- [ ] User reviews and requests changes.
- [ ] **USER APPROVAL GATE: Student Flutter UI approved.**

### Phase UI-9 — Whole UI consistency pass

- [x] Confirm role navigation destinations for Teacher, Parent, Admin/Head Teacher, and Student on web/PWA.
- [x] Keep Inbox as a conversation destination and Notices as school-wide communication.
- [x] Align visible role names, Daily/Holiday Homework categories, and the core assignment status terms across the web/PWA role previews.
- [ ] Review desktop, tablet, and phone widths; check keyboard access, contrast, screen reader labels, and touch targets.
- [ ] Review empty/loading/error/offline states and long names/instructions.
- [ ] **USER APPROVAL GATE: All role UIs approved before functionality work.**

## 6. Functional implementation checklist

Begin only after the whole UI gate above is approved. Reuse existing LMS assignment/submission records where possible; introduce diary-specific persistence only for diary communication and offline completion tracking.

### Data model and migration

- [ ] Inspect existing schema, school scoping, calendar/term records, user/class relationships, LMS assignments/submissions, and notification records before proposing schema changes.
- [ ] Define diary entry fields: school, class, date, author, content, audience/visibility, draft/published state, created/updated timestamps, archive state.
- [ ] Define offline completion record fields: assignment, learner, status (done/not done/excused/unmarked), note, actor, timestamp, and audit/update history.
- [ ] Decide uniqueness/idempotency rules for class/date diary entries and assignment/learner completion records.
- [ ] Add indexes for school/class/date, assignment status/due date, and completion lookups.
- [ ] Write reversible migration/backfill plan; protect existing LMS and notice data.
- [ ] Validate migration on local data and document rollback limits.

### API and service rules

- [ ] Implement school-scoped diary list/detail/create/update/publish endpoints.
- [ ] Implement teacher class/workload authorization on every write and relevant read.
- [ ] Implement Admin/Head Teacher oversight queries scoped to the active school.
- [ ] Implement student self and parent own-child reads; never trust learner IDs without resolving role ownership.
- [ ] Reuse LMS assignment create/publish/close and submission/detail/mark/return endpoints for online work.
- [ ] Add offline completion bulk read/write endpoints with validation and idempotent saves.
- [ ] Return paginated/filterable summary data for leadership; avoid N+1 per-assignment/per-learner queries.
- [ ] Define audit events for publish/edit, assignment issue, marking, offline completion changes, and oversight edits.
- [ ] Define error behavior for closed terms, moved learners, inactive classes, stale roster, duplicate submits, and unauthorized access.

### Notifications and communication

- [ ] Implement only the notification behaviors approved in Section 4.
- [ ] Notify the correct class/guardians when a diary entry or assignment is published, with duplicate protection.
- [ ] Respect user notification settings and school channel configuration.
- [ ] Keep SMS/WhatsApp external sends explicit and auditable; do not silently turn a class diary note into a broadcast.
- [ ] Deep-link notifications to the correct diary date or assignment and handle revoked/expired content safely.

### Web/PWA functionality

- [ ] Wire teacher diary, assignment workflow, roster completion, draft/publish/edit, and filters.
- [ ] Wire student diary feed, submission actions, status refresh, and feedback.
- [ ] Wire parent child diary and child-safe assignment status.
- [ ] Wire leadership overview, pagination/filters, school summary, and drill-down.
- [ ] Verify PWA reload/offline behavior and stale-cache invalidation for newly published diary entries.

### Flutter functionality

- [ ] Replace teacher legacy `/assignments` usage for the Diary flow with the agreed LMS/Diary APIs.
- [ ] Wire role-appropriate Diary screens in student, parent, and leadership shells.
- [ ] Handle loading, retry, offline, expired session, and permission errors consistently.
- [ ] Ensure deep links/open-from-notification route to the right role-safe Diary page.

## 7. Verification and release checklist

### Automated and integration checks

- [ ] Unit checks for diary visibility, date boundaries, status summaries, denominator/count calculations, and class membership changes.
- [ ] API checks for teacher assigned-class scope, Admin/Head Teacher oversight, student self scope, and parent own-child scope.
- [ ] Submission lifecycle checks: draft → submitted/late → marked/returned → resubmitted.
- [ ] Offline register checks: done/not done/excused/unmarked, reason note, correction history, and bulk save idempotency.
- [ ] Notification checks: correct recipients, preference respect, duplicate suppression, and deep links.
- [ ] Migration checks against a copy/snapshot of existing data and rollback procedure.
- [ ] Performance check for leadership view at realistic school/class sizes; inspect query count and pagination.
- [ ] Security review for cross-school leakage, learner-ID tampering, role escalation, and sensitive notes.

### Manual end-to-end role review

- [ ] Teacher creates and publishes a daily note for an assigned class.
- [ ] Teacher creates daily homework; learner/parent see the correct item and status.
- [ ] Teacher creates holiday homework with a distinct due date/category.
- [ ] Learner submits online work; teacher sees it and marks/returns it; learner/parent see released feedback.
- [ ] Teacher records offline completion and school summary updates correctly.
- [ ] Admin/Head Teacher sees the correct class/teacher/day counts and drills into one entry.
- [ ] Unauthorized teacher, student, parent, and cross-school access is denied.
- [ ] Check web, installable PWA, and Flutter against the approved UI.

### Release and follow-up

- [ ] Confirm feature/module entitlement and role permissions in the target environment.
- [ ] Prepare release notes, migration steps, environment requirements, and support notes.
- [ ] Deploy backend/schema before clients that depend on new endpoints, using the repository's deployment order.
- [ ] Build web/PWA and Flutter release artifacts from the same approved feature version.
- [ ] Verify health, login, role routing, and one happy-path diary flow after deployment.
- [ ] Monitor API errors, publish failures, submission failures, notification delivery, and slow leadership queries.
- [ ] Capture user feedback and create follow-up items; do not close the module until blockers are resolved or explicitly deferred.

## 8. Definition of done

Digital Diary is complete only when:

- [ ] All role UIs have explicit user approval before implementation and match the approved designs.
- [ ] Teachers can publish dated class communication and issue daily/holiday work to authorized classes.
- [ ] Students and parents can see only their permitted diary/work and act on online assignments where enabled.
- [ ] Online submissions and offline completion are reported distinctly and accurately.
- [ ] Admin/Head Teacher can review school-wide activity and drill down with correct counts and access controls.
- [ ] Web/PWA and Flutter workflows are consistent, accessible, responsive, and recover gracefully from errors/offline states.
- [ ] Security, migration, performance, audit, notification, and release checks pass.
- [ ] Documentation and support guidance are updated.

## 9. Current progress log

| Date | Update | Status |
|---|---|---|
| 2026-11-07 | Audited existing LMS assignment/submission, teacher legacy Flutter assignment sheet, parent homework, student assignments, notices, inbox, and role navigation. Started the local web/PWA and API; health endpoint passed. | Audit complete; no workflow or backend functionality has been connected. |
| 2026-11-07 | Expanded the teacher web/PWA preview into Today, Class Diary, Homework, Assessment, Attendance, and Class Plan; consolidated the teacher Learning navigation under one Diary entry; applied solid-color summary and quick-action cards; added the reusable TrendSCORE web UI skill. | Teacher actions remain preview-only. User review gate remains open. |
| 2026-11-07 | Added the parent child Diary date view, leadership school overview with filters and drill-down, student My Diary route and assignment feed, role-based navigation, and cross-role wording alignment. Clearly labeled sample data; kept leadership and student views read-only. Production web/PWA build and `git diff --check` passed. | Web/PWA role drafts are ready for review. Visual review at desktop/phone widths and user approval are still required before Flutter UI or functional/backend work. |
| 2026-11-07 | Replaced the student's generic dashboard landing with a compact Student Workspace using the teacher's mobile action-row style, semantic icon colors, and a greeting. Preserved a clear warning when the signed-in student has no linked learner profile; existing Diary, assignment submission, courses, attendance, timetable, and progress pages remain reachable. | Production web/PWA build and `git diff --check` passed. Role screens still need visual review and user approval. |

