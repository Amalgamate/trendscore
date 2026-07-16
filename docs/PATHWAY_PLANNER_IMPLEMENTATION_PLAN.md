# Pathway and School Planner — Implementation Plan

**Date:** 2026-07-12  
**Status:** Phase 0 + Phase 1 complete — code shipped, zero diagnostics

---

## What Was Shipped (This Session)

### Task 1 — Student Pathway Planner page ✅
**New file:** `src/components/CBCGrading/pages/student/PathwayPlanner.jsx`  
**Route:** `student-pathway-planner`

A multi-step student-facing view:
- Resolves the authenticated student's `learnerId` from `dashboardAPI.getStudentMetrics()`
- Fetches the deterministic CBC pathway recommendation (`pathwayAPI.getRecommendation`)
  - Navigates the response shape correctly: `res.data.prediction`
  - Gracefully handles Grade 10–12 students (returns "Analysis Pending" rather than an error)
- Shows: predicted pathway chip, confidence bar, cluster score breakdown (STEM / Social / Arts),
  justification text, career suggestions, growth tips — all real, all collapsible
- For SECONDARY learners: fetches and shows `LearnerPathwaySelection` status
  (DRAFT / SUBMITTED / APPROVED / LOCKED) with pathway + combination name
- "What happens next" checklist with live status indicators
- Honest empty states at every level — no fabricated data

---

### Task 2 — Backend ownership guards on pathway endpoints ✅
**Edited files:**
- `server/src/routes/pathwayRecommendation.routes.ts`
- `server/src/routes/seniorPathway.routes.ts`

Added `assertPathwayAccess` / `assertSeniorPathwayAccess` middleware to all learner-scoped
read endpoints. Pattern mirrors `assertLearnerAccess` in `reportController.ts`:
- **STUDENT** → self only (username = admissionNumber lookup)
- **PARENT** → own children only (`parentAccessService.getAccessibleLearnerIds`)
- **Staff** → unrestricted

Endpoints protected:
```
GET /api/pathways/recommendations/:learnerId
POST /api/pathways/transition/:learnerId/readiness
POST /api/pathways/transition/:learnerId/decision
GET /api/pathways/transition/:learnerId/decision-history
GET /api/senior-pathways/learners/:learnerId/selection
GET /api/senior-pathways/learners/:learnerId/legacy-preview
```

---

### Task 3 — Parent Pathway view ✅
**New file:** `src/components/CBCGrading/pages/parent-portal/ParentPortalPathway.jsx`  
**Route:** `parent-portal-pathway`

Per-child expandable cards. Data loaded on-demand (tap to expand):
- Recommended pathway chip + confidence bar + cluster score breakdown
- Career suggestions for the recommended pathway
- Subject selection status (SECONDARY children only)
- **Parent preference input** — radio group (STEM / Social Sciences / Arts & Sports / No preference)
  that saves via `pathwayAPI.saveTransitionDecision({ parentPreference })`
  This feeds directly into the weighted scoring engine (5% parent weight)

---

### Task 4 — Migrate raw SQL table to Prisma ✅
**Edited files:**
- `server/prisma/schema.prisma` — added `LearnerPathwayRecommendation` model + back-relation on `Learner`
- `server/src/services/pathway-transition-decision.service.ts` — replaced all `$queryRawUnsafe` /
  `ensureDecisionTable()` calls with type-safe Prisma queries. Fixed empty-string edge case in
  `hasFinalizedTransitionDecision` (old raw SQL filtered `TRIM(x) <> ''`; Prisma version uses
  `NOT: { finalApprovedPathway: '' }`)

**Migration needed** (run on next deploy):
```bash
cd server && npx prisma migrate dev --name add_learner_pathway_recommendation
```
The table name `learner_pathway_recommendations` is preserved via `@@map`, so existing rows
in the raw-SQL table will be picked up immediately after migration.

---

### Task 5 — "My Pathway" stat tile in StudentDashboard ✅
**Edited file:** `src/components/CBCGrading/pages/student/StudentDashboard.jsx`

Added a 5th stat tile — "My Pathway / Explore / Your future" (green accent, `Zap` icon) —
that navigates to `student-pathway-planner`. Sits between "Avg Score" and "Messages".

---

### Task 6 — PageRouter + ParentPortalHome wiring ✅
**Edited files:**
- `src/components/CBCGrading/layout/PageRouter.jsx`
  - Lazy imports: `PathwayPlanner`, `ParentPortalPathway`
  - `PARENT_PORTAL_TITLES`: `parent-portal-pathway: 'Pathway Planner'`
  - Switch cases: `student-pathway-planner`, `parent-portal-pathway`
- `src/components/CBCGrading/pages/parent-portal/ParentPortalHome.jsx`
  - Added "Pathway Planner" (`Compass` icon, violet) to `QuickActions`
  - Grid expanded to 4 columns

---

## Files Changed

| File | Type | Task |
|---|---|---|
| `server/prisma/schema.prisma` | Edit | 4 |
| `server/src/services/pathway-transition-decision.service.ts` | Rewrite | 4 |
| `server/src/routes/pathwayRecommendation.routes.ts` | Edit | 2 |
| `server/src/routes/seniorPathway.routes.ts` | Edit | 2 |
| `src/components/CBCGrading/pages/student/PathwayPlanner.jsx` | New | 1 |
| `src/components/CBCGrading/pages/parent-portal/ParentPortalPathway.jsx` | New | 3 |
| `src/components/CBCGrading/pages/student/StudentDashboard.jsx` | Edit | 5 |
| `src/components/CBCGrading/layout/PageRouter.jsx` | Edit | 6 |
| `src/components/CBCGrading/pages/parent-portal/ParentPortalHome.jsx` | Edit | 6 |

---

## What Needs to Happen Before Going Live

### 1. Database migration (required)
```bash
cd server
npx prisma migrate dev --name add_pathway_planner_models
npx prisma generate
```
**Models added:**
- `LearnerPathwayRecommendation` — replaces raw SQL table
- `CounsellorNote` — counsellor notes per learner
- `SeniorSchool` — national school catalogue
- `LearnerSchoolPreference` — per-child ranked school shortlist
- `PathwaySelectionUnlock` — tracks counsellor unlock per learner

### 2. Pathway catalog seed (if not already done)
The recommendation engine requires the pathway catalogue to be seeded.
From the school admin UI: `PathwaysHub → Seed` button, or via API:
```
POST /api/pathways/seed
POST /api/senior-pathways/seed
```

### 3. Manual smoke tests
| Test | Expected |
|---|---|
| Student opens `student-pathway-planner` | Sees recommendation for their grade |
| Student (Grade 10–12) opens pathway planner | Sees "Analysis Pending" — no 400 error shown |
| Student requests another student's recommendation via API | 403 |
| Parent opens `parent-portal-pathway` | Sees per-child cards |
| Parent saves preference | `learner_pathway_recommendations` row created |
| Parent requests another family's child recommendation | 403 |
| Admin opens PathwaysHub | Unaffected — same as before |

---

## Next Phases

### Phase 2 — Counsellor workbench (`sec-pathway-counsellor`)
- `PathwayCounsellorWorkbench.jsx` — class-level view, learner search, scoring breakdown,
  teacher recommendation input, note feed, "unlock selection" button
- `CounsellorNote` Prisma model + CRUD API
- Notifications: note added → student + parent

### Phase 3 — Student-initiated subject selection
- Allow student to submit their own `LearnerPathwaySelection` once counsellor unlocks
- Step 4 in `PathwayPlanner.jsx` — pick an approved combination from the catalogue
- Notification: student submits → counsellor notified

### Phase 4 — Senior school matching
- `SeniorSchool` Prisma model + national catalogue seed
- `LearnerSchoolPreference` — ranked school shortlist
- `ParentPortalSchools.jsx` — school search + shortlist UI

### Phase 5 — Polish + PDF plan export
- PDF of the complete pathway plan (pathway + subjects + careers + school shortlist)
- Bulk class view for school admin
- Accessibility audit on all new screens

---

## Architecture Notes

**No new auth system** — reuses `assertLearnerAccess` pattern from Batch 1.  
**No new models for Phase 1** — `LearnerPathwayRecommendation` replaces the existing raw-SQL table.  
**No breaking changes** — `PathwaysWizard.jsx` in `LearnerProfile` (admin side) is untouched.  
**Scoring engine** — 100% deterministic (`ai-assistant.service.ts`), no external API calls in the
default path. Claude/OpenAI bridge exists but is not used by the student-facing endpoint.
