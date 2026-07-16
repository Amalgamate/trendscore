# Assessment Module UX Overhaul — Implementation Plan

Goal: make the assessment experience trustworthy and useful for parents and students —
no fabricated data, real CBC grading vocabulary, and full visibility into homework/assignment
completion, not just exam scores. Students currently have **no** visibility into their own
results at all; that's the single biggest gap this plan closes.

Work is sequenced in small, independently-shippable batches. Later batches depend on the
backend batch that precedes them (2 needs 1, 5 needs 4, 6 needs 1). Check items off as they land.

Key finding driving this plan: most of the real backend infrastructure already exists
(`SummativeResult.cbcGrade`, `teacherComment`, `remarks`, `GET /api/reports/analytics/learner/:learnerId`,
`GET /api/reports/termly/:learnerId`, the parent-scoped `LearningAssignment` system from the
earlier bug-fix session). The frontend built fabricated placeholders instead of wiring to it.
Most of this work is *connecting real data*, not building new systems from scratch.

---

## Batch 1 — Backend: real, properly-scoped family results data

**Files:** `server/src/controllers/reportController.ts`, `server/src/routes/reportRoutes.ts`

- [x] Add ownership scoping to `GET /api/reports/analytics/learner/:learnerId` (currently `authenticate`-only, no ownership check — any logged-in user can query any learner). Use the same pattern applied elsewhere this session: STUDENT → self only, PARENT → own children only (via `parentAccessService`/`learner.parentId`), staff roles → unrestricted.
- [x] Apply the same ownership check to `GET /api/reports/termly/:learnerId` and `GET /api/reports/summative/:learnerId` / `GET /api/reports/formative/:learnerId` if they don't already have it — audit all four.
- [x] Confirm/standardize the response shape so the frontend can rely on: `subjectTrends` (per learning area, per term: `percentage`, `grade`, `cbcGrade`/`gradeCode`, `status`), `termAverages`, and — where present on `SummativeResult` — `teacherComment` and `remarks`. Add these two fields to the analytics query's `select`/`include` if missing.
- [x] Decide and document the canonical grading vocabulary for the whole app: **`cbcGrade` is primary** (e.g. EE/ME/AE/BE family from the school's configured scale), percentage is secondary/supporting detail. Note this decision at the top of `reportController.ts`.
- [ ] Smoke-test: call the endpoint as a parent for their own child (success), for another parent's child (403), and for a learner with zero results yet (empty `subjectTrends`, not an error). **Manual step — needs a running server/DB; not run in this environment.**

**Definition of done:** a parent or student can request one learner's full-year, cross-term, cross-subject results and get back only real numbers, with no dummy data, and only if they're authorized to see that learner.

**Implementation notes:**
- Added a shared `assertLearnerAccess(req, learnerId)` helper in `reportController.ts` (STUDENT self-only via admission-number lookup, PARENT via `parentAccessService.getAccessibleLearnerIds`, staff roles unrestricted) and wired it into `getFormativeReport`, `getSummativeReport`, `getTermlyReport`, `getLearnerAnalytics`.
- `getLearnerAnalytics`'s `termResults` now includes `cbcGrade`, `teacherComment`, `remarks` alongside the existing `percentage`/`grade`/`status` fields — these were already fetched from the DB (no `select` clause restricted them) but were being dropped before reaching the response.
- `getClassAnalytics` was left as-is (staff-only use case, out of scope for this batch's parent/student focus) but is worth a follow-up ownership pass later.

---

## Batch 2 — Frontend: remove fabricated data from `ParentPortalResults.jsx`

**File:** `src/components/CBCGrading/pages/parent-portal/ParentPortalResults.jsx`

- [x] Delete `buildDemoHistory`, `seeded`, `gradeFromMean`, `pathwayFromRows`, `priorGradeLabel`, and any other synthetic-data generator in this file.
- [x] Replace the local fabrication with a real fetch to Batch 1's endpoint (per child, per selected academic year).
- [x] Build a proper **empty state** for terms/tests with no real data yet — honest "No results recorded yet" copy, not invented numbers.
- [x] Replace the computed 8-4-4 letter grade (A/A-/B+.../D) with the real `cbcGrade` from the backend, styled as the primary badge; percentage becomes secondary/supporting text.
- [x] Remove the "vs Class Average" and "vs Target" comparisons — no fabricated substitute.
- [x] Surface `teacherComment` / `remarks` on the term/subject detail view where present.
- [x] Keep the good structural bones (year selector, expandable child cards) — driven from real data.

**Definition of done:** every number, badge, and comparison on this screen is traceable to a real database record. If there's nothing to show, the screen says so honestly.

---

## Batch 3 — Unify the two "Results" UIs

**Files:** `ParentPortalResults.jsx` (family overview), `src/components/CBCGrading/pages/parent/ParentChildProfile.jsx` (Results tab)

- [x] Fix the broken `ResultsTab` fallback in `ParentChildProfile.jsx` — was missing `academicYear` param and reading `data.subjects` (wrong field) instead of `data.subjectTrends`. Replaced with a full rewrite that always fetches from the real analytics endpoint with the current year, collapses results into per-term accordions, and shows `cbcGrade` badges + teacher comments.
- [x] Extract one shared data-fetching hook (`useLearnerResults`) used by all screens, wrapping Batch 1's endpoint. Includes `summarizeAnalytics`, colour helpers, and canonical glossary constants.
- [x] Extract one shared set of presentational components (`ResultsShared.jsx`): `GradePill`, `PercentageBar`, `SubjectRow`, `TermAccordion`, `YearSelector`, `ResultsLoadingState`, `ResultsErrorState`, `ResultsEmptyState`. All accessibility-compliant (focus rings, aria-labels, 44px min tap target).
- [x] Refactored all three consumers (`ParentPortalResults`, `ParentChildProfile ResultsTab`, `MyResults`) to use shared hook + components. Removed all duplicate helpers (`scoreColor`, `barColor`, `termLabel`, `summarizeAnalytics`, inline `YearSelector`).

**Definition of done:** a parent moving between the family view and a single child's profile sees the same terminology, the same grade vocabulary, and the same visual treatment throughout. ✅

---

## Batch 4 — Backend: parent-facing homework/assignment tracking

**Files:** `server/src/services/lms-assignment.service.ts`, `server/src/controllers/lms.controller.ts`, `server/src/routes/lms.routes.ts`, `server/src/controllers/dashboard.controller.ts`

- [x] Add `LMSAssignmentService.getChildAssignments(learnerId, schoolId)` — learnerId-parameterized variant of `getStudentAssignments`; computes `statusSummary` and `isOverdue` per assignment.
- [x] Add `getChildAssignments` controller + `GET /api/lms/children/:learnerId/assignments` route with PARENT → own children only, STUDENT → self only, staff unrestricted.
- [x] Replace the fake `homeworkCount` heuristic in `dashboard.controller.ts` (`|| Math.min(5, child.formativeAssessments.length)`) with `0` — dashboard carries no fabricated count; the dedicated homework route provides real data.
- [ ] Smoke-test as a parent for their own child (success + accurate counts) and for another parent's child (403). **Manual step.**

**Definition of done:** the backend can answer, for any child a parent has access to: which assignments are outstanding, which are submitted, which are graded, and which are overdue — from real data.

---

## Batch 5 — Frontend: homework tracker for parents

**Files:** `src/components/CBCGrading/pages/parent-portal/ParentPortalHomework.jsx` _(new)_, `ParentPortalHome.jsx`, `PageRouter.jsx`

- [x] New `ParentPortalHomework` component: per-child expandable cards, each fetching real assignments from Batch 4's endpoint. Filter tabs (All / Pending / Graded). Status pills: Not submitted / Submitted / Late / Graded (with marks + feedback). Overdue badge.
- [x] Three distinct, honest empty states: "No assignments issued yet" / "Nothing pending — all caught up 🎉" / list view.
- [x] Added "Homework" quick action to `ParentPortalHome.jsx` `QuickActions` (grid expanded to 3 columns; `BookOpen` icon).
- [x] Registered `parent-portal-homework` route in `PageRouter.jsx` and `PARENT_PORTAL_TITLES`.

**Definition of done:** a parent can see, at a glance from the home screen, whether their child has outstanding homework, and drill in for full detail — all from real assignment/submission data.

---

## Batch 6 — Student-facing results view (closes the biggest gap)

**Files:** `src/components/CBCGrading/pages/student/MyResults.jsx` _(new)_, `PageRouter.jsx`, `StudentDashboard.jsx`

- [x] New `MyResults` page at route `student-results`: fetches learnerId from student metrics, then calls `getLearnerAnalytics` scoped to the authenticated student. Renders per-term accordions (latest open by default) with `cbcGrade` band pills, percentage bars, and teacher comments.
- [x] Year selector; honest empty state ("No results yet for {year}"); trend badge (vs previous term).
- [x] Added "View My Results" button to the Report Card panel in `StudentDashboard.jsx`; "Avg Score" stat tile now navigates to `student-results`.
- [x] `student-results` route registered in `PageRouter.jsx`.
- [ ] CoreCompetency data — left out; model not confirmed ready. No fabrication. Can be added once confirmed available.

**Definition of done:** a student can open the app and see how they actually did — real grades, real comments — for the first time in this product. ✅

---

## Batch 7 — Polish pass

- [x] Wrote `ASSESSMENT_TERMINOLOGY.md` — one-page glossary (cbcGrade primary, percentage secondary, grade/8-4-4 banned, empty state copy standards, accessibility notes, cross-reference to shared code). Applied vocabulary consistently across every results screen.
- [x] Unified empty/error/loading states — `ResultsEmptyState`, `ResultsErrorState`, `ResultsLoadingState` shared components used by all three results screens. No screen silently swallows errors or shows blank content.
- [x] Accessibility pass: `min-h-[44px]` on all accordion toggle buttons; `focus-visible:ring-2` focus rings; `aria-expanded` on accordions; `role="progressbar"` + `aria-label` on `PercentageBar`; `aria-hidden` on decorative icons; cbcGrade full label in `title` + `aria-label`; `<label htmlFor>` on `YearSelector`. Only `text-[9px]` remaining is the non-interactive "Latest" badge chip.
- [x] Rebuilt `LatestResultsWidget.tsx` — replaced "Coming Soon" stub with a real per-child latest-term summary card (avg % + cbcGrade band), sourced from `getLearnerAnalytics`. Taps through to `parent-portal-results`.
- [x] Final pass: searched the whole assessment module for `Math.random`, seeded generators, and hardcoded placeholder arrays — none found in results/assessment screens. `ParentPortalResults`, `ParentChildProfile ResultsTab`, `ParentPortalHomework`, `MyResults`, and `LatestResultsWidget` are all fabrication-free.

---

## Progress log
_(add a line each time a batch ships, with date and any notes/deviations from plan)_

- 2026-07-12 — Batch 1 shipped (code complete). Ownership checks added to `getFormativeReport`/`getSummativeReport`/`getTermlyReport`/`getLearnerAnalytics`; `cbcGrade`/`teacherComment`/`remarks` now surfaced in cross-term analytics; canonical grading vocabulary documented in code. Runtime smoke test still needed on a live environment before calling this batch fully verified.
- 2026-07-12 — Batches 2–7 shipped (code complete). Fabricated data removed from `ParentPortalResults` (was already clean from Batch 1 session); `ParentChildProfile ResultsTab` broken fallback fixed (missing `academicYear`, wrong field `subjects` → `subjectTrends`); fake `homeworkCount` heuristic removed from `dashboard.controller.ts`; `LMSAssignmentService.getChildAssignments` + `GET /api/lms/children/:learnerId/assignments` added; `ParentPortalHomework` component built and wired; `MyResults` student page built and wired; `LatestResultsWidget` rebuilt as real data card. Manual smoke tests (Batch 1 and Batch 4 endpoint authorization) still needed on a live environment.
- 2026-07-12 — Batch 3 + Batch 7 completed. Shared `useLearnerResults` hook extracted (`pages/results/useLearnerResults.js`) — canonical vocabulary constants, `summarizeAnalytics`, colour helpers, all duplicates removed from three consumers. Shared `ResultsShared.jsx` presentational components extracted (`GradePill`, `PercentageBar`, `SubjectRow`, `TermAccordion`, `YearSelector`, three state components). All consumers (`ParentPortalResults`, `ParentChildProfile`, `MyResults`) refactored to use shared module. `ASSESSMENT_TERMINOLOGY.md` written. Full accessibility pass applied to shared components. All plan items now complete except manual runtime smoke tests.
