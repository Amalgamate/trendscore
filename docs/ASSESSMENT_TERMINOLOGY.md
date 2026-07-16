# Assessment Module — Terminology Glossary

**Canonical grading vocabulary for TrendSCORE assessment/results UI.**  
Batch 7, Assessment UX Overhaul — 2026-07-12

---

## Core Terms

### cbcGrade (PRIMARY)

**What it is:** The school-configured Competency-Based Curriculum (CBC) performance band code.  
**Examples:** `EE`, `ME`, `AE`, `BE` (Exceeds / Meets / Approaches / Below Expectation).  
**Where it appears:** As the **primary grade badge** shown to parents and students on all results screens.  
**Database source:** `SummativeResult.cbcGrade` column.  
**Visual treatment:** Colour-coded pill badge (emerald for EE, blue for ME, amber for AE, rose for BE); full label ("Exceeds Expectation") shown on hover/aria-label for accessibility.

**Usage rule:** `cbcGrade` is always displayed **before** or **more prominently** than percentage. It's the primary indicator of learner performance in the CBC system.

---

### percentage (SECONDARY)

**What it is:** Numeric score out of 100.  
**Examples:** `87`, `62`, `45`.  
**Where it appears:** As **supporting detail** alongside the cbcGrade badge.  
**Database source:** `SummativeResult.percentage` column (0–100 scale).  
**Visual treatment:** Colour-coded text (emerald ≥70, amber ≥50, rose <50); shown as plain text next to cbcGrade badge, never as the sole indicator.

**Usage rule:** Percentage is displayed **after** cbcGrade or as secondary context (e.g., "EE 87%"). Use colour to reinforce the band, but never colour alone — the cbcGrade label is always present.

---

### grade (LEGACY — DO NOT USE)

**What it is:** Old 8-4-4 curriculum letter grades (A, A-, B+, ..., E).  
**Where it appears:** **Nowhere in the results/assessment UX.** This field exists in `SummativeResult` for historical/migration reasons only.  
**Usage rule:** **Never compute, display, or refer to 8-4-4 letter grades in CBC-facing screens.** Use cbcGrade instead.

---

## Supporting Terms

### teacherComment / remarks

**What they are:** Free-text feedback from the teacher on a learner's performance in a specific subject/term.  
**Database source:** `SummativeResult.teacherComment` (preferred) or `SummativeResult.remarks` (fallback).  
**Where they appear:** Below the subject row in expanded term accordions, prefixed with a message icon.  
**Visual treatment:** Small italic text, quoted ("Like this").

**Usage rule:** Always show teacher comments when present — they provide qualitative context that grades alone can't capture. If both `teacherComment` and `remarks` exist, prefer `teacherComment`.

---

### term

**What it is:** Academic term identifier.  
**Examples:** `TERM_1`, `TERM_2`, `TERM_3`.  
**Display labels:** "Term 1", "Term 2", "Term 3".  
**Usage rule:** Always use the human-readable label ("Term 1") in UI, never the raw enum (`TERM_1`). Term ordering is fixed: 1 → 2 → 3 within an academic year.

---

### academicYear

**What it is:** Four-digit year string representing the academic year for results.  
**Examples:** `"2026"`, `"2025"`.  
**Where it appears:** Year selector dropdown; query param for analytics endpoint.  
**Usage rule:** Default to current calendar year. Allow parent/student to select up to 2 years back for historical results.

---

### subjectTrends

**What it is:** The per-learning-area, per-term results array returned by `GET /api/reports/analytics/learner/:learnerId`.  
**Structure:** Array of `{ learningArea: string, termResults: [{ term, percentage, cbcGrade, teacherComment, remarks }] }`.  
**Usage rule:** This is the **source of truth** for all results screens. `summarizeAnalytics()` consumes this structure and collapses it into per-term summaries.

---

## Visual Hierarchy

**1. cbcGrade badge (large, coloured pill)** — PRIMARY  
**2. percentage (adjacent text, colour-coded)** — SECONDARY  
**3. Progress bar (colour matches percentage band)** — SUPPORTING VISUAL  
**4. teacherComment (small italic text)** — CONTEXTUAL DETAIL

**Never show:**
- 8-4-4 letter grades (A/B/C/D/E)
- Fabricated "vs class average" or "vs target" comparisons (unless real aggregated data exists)
- Placeholder / demo / seeded results

---

## Empty State Copy Standards

**When a learner has no results for a selected year:**
> No subject results yet for {year}.  
> Results will appear once assessments are entered by the teacher.

**When a learner has results but no pending homework:**
> All caught up 🎉

**When no assignments have been published yet:**
> No assignments issued yet.  
> Assignments will appear here once the teacher publishes them.

**Usage rule:** Empty states are honest and specific. Never fill empty data with invented numbers, heuristics, or "example" placeholders.

---

## Accessibility Notes

- **Colour is never the sole indicator:** cbcGrade badges carry text labels; progress bars have `aria-label` with the percentage value.
- **Interactive elements are `<button type="button">`** with visible focus rings (2px ring in brand colour).
- **Minimum tap target:** 44×44px enforced on all accordion toggles and interactive rows.
- **CBC band full labels** ("Exceeds Expectation") exposed via `title` attribute and `aria-label` on grade pills for screen reader users.

---

## Cross-Reference

**Shared code:**
- `src/components/CBCGrading/pages/results/useLearnerResults.js` — hook + helpers + glossary constants
- `src/components/CBCGrading/pages/results/ResultsShared.jsx` — presentational components (GradePill, PercentageBar, SubjectRow, TermAccordion, empty/error/loading states)

**Consumers:**
- `ParentPortalResults.jsx` (family overview)
- `ParentChildProfile.jsx` (Results tab)
- `MyResults.jsx` (student view)
- `ParentPortalHomework.jsx` (assignment tracker)
- `LatestResultsWidget.tsx` (dashboard widget)

**Backend endpoint:**
- `GET /api/reports/analytics/learner/:learnerId?academicYear=YYYY` (Batch 1)
- Ownership: STUDENT self-only, PARENT own-children-only, staff unrestricted
- Returns: `{ subjectTrends[], termAverages, formativeSummary, ... }`

---

**Last updated:** 2026-07-12 (Batch 7 completion)
