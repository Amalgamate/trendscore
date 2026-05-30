# TrendsCORE — Secondary Assessment & Pathway Flow Audit (Revised)

**Date:** 2026-05-13  
**Scope:** Senior Secondary (SECONDARY institution type) — full assessment lifecycle + Grade 9→10 pathway placement  
**Method:** Live codebase read. No files modified.

---

## 1. THE CORRECT INTENDED FLOW (How it SHOULD Work)

Below is the definitive step-by-step flow the system is being built towards.
Each step lists what already exists, what is broken, and what is missing.

---

### PHASE 1 — GRADE 9 → GRADE 10 TRANSITION (for Junior→Senior movers)

```
Step 1: Open learner profile (Grade 9 learner)
        → Pathways tab becomes visible
        → "Grade 9 Transition Readiness" panel appears (isGrade9Learner check)

Step 2: Run Readiness Analysis
        → Input: Learner interest, Teacher recommendation, Parent preference
        → Input: Optional national exam scores (Math %, Science %, English %)
        → POST /api/pathways/transition/:id/readiness
        → Service: buildGrade9TransitionReadiness()
          - Reads all SummativeResults (Grade 7-9) grouped by subject cluster (STEM/SOCIAL/ARTS)
          - Reads latest CoreCompetency record
          - Applies stakeholder weights (learner 20%, teacher 30%, parent 10%, academic 40%)
          - Returns: recommendedPathway, confidence %, clusterScores, mismatchWarning

Step 3: Review recommendation + Pathway Intelligence panel
        → Recommended pathway shown with confidence score
        → Career outlook from CAREER_MAP
        → Growth tips from GROWTH_MAP
        → Mismatch warning if stakeholder preferences conflict with academic evidence

Step 4: Save Review Decision (role-gated: ADMIN / HEAD_TEACHER / HEAD_OF_CURRICULUM)
        → POST /api/pathways/transition/:id/decision
        → Fields: recommendedPathway, finalApprovedPathway, confidenceScore,
                  learnerInterest, teacherRecommendation, parentPreference,
                  mismatchWarning, overrideReason (required if pathway differs)
        → Decision versioned — full history in Decision Timeline

Step 5: Promote learner to Grade 10
        → Learner grade updated to GRADE_10
        → institutionType updated to SECONDARY (if transitioning school)
```

---

### PHASE 2 — SENIOR SCHOOL PATHWAY ASSIGNMENT (Grade 10–12)

```
Step 6: Open learner Pathways tab
        → "Current Pathway" dropdown shows: STEM / Social Sciences / Arts & Sports Science
        → Select pathway → POST /api/pathways/learner/:id/pathway
        → Pathway saved to learner.pathwayId

Step 7: Core Subjects Auto-Display (LOCKED)
        → All LearningAreas WHERE isCore=true AND gradeLevel=learner.grade appear
        → These are PRE-CHECKED and cannot be unchecked
        → Currently: "No core subjects mapped for this learner grade" bug (seeding issue)

Step 8: Suggested Combos
        → "Apply Minimum Rules Pack" — selects minimum required electives per category
        → "Apply Pure Sciences Pack" (STEM only) — selects Physics, Chemistry, Biology, Math
        → These populate the elective checkboxes but remain EDITABLE

Step 9: Elective Subject Selection (editable)
        → Subjects grouped by Category chips (e.g. Pure Sciences, Applied Sciences for STEM)
        → Search box + category filter dropdown
        → Checkbox list — learner/admin ticks desired subjects
        → Category compliance pills show real-time: "Need 1 more", "0/0 min" etc.
        → Rules & Compliance panel (right side) shows min/max per category

Step 10: Probable Career Highlighted
        → Pathway Intelligence panel shows recommended pathway, confidence %
        → Career outlook lists 5 probable careers for the selected/recommended pathway
        → Growth tips (3) displayed

Step 11: Validate & Save
        → Client-side validation runs before save button enables
        → "Save Subject Selection" → POST /api/pathways/learner/:id/subjects
        → Server re-validates (validateSelections): CORE_REQUIRED, CATEGORY_MIN, CATEGORY_MAX
        → Saved to LearnerSubjectSelection (upsert per learningAreaId)
        → Status badge updates: "Valid Combination" (green) / "Needs Attention" (amber)
```

---

### PHASE 3 — ASSESSMENT CYCLE (per term, per exam type)

```
Step 12: Test Creation
         → Admin: POST /api/assessments/tests (single) or /tests/bulk
         → Required: title, testType (CAT/MID_TERM/END_TERM/MOCK/EXAM), grade,
                     term, academicYear, totalMarks, learningArea
         → UI: CreateTestPage.jsx or BulkCreateTest.jsx

Step 13: Mark Entry
         → Teacher opens: SummativeAssessment.jsx (desktop) or SummativeAssessmentMobile.jsx
         → Secondary hub: pages/secondary/MarkEntryHub.jsx
           - CAT Mark Entry → testType: CAT
           - Mid-Term → testType: MID_TERM
           - End-Term → testType: END_TERM
           - Mock → testType: MOCK
         → Single:  POST /api/assessments/summative/results
         → Bulk:    POST /api/assessments/summative/results/bulk
         → MISSING: marks entry should ONLY show subjects in learner's LearnerSubjectSelection
                    Currently shows ALL subjects for the grade

Step 14: Grading
         → grading.service.ts → getGradingSystem('SECONDARY')
         → Looks up active SECONDARY GradingSystem → ranges
         → Derives: percentage = (marksObtained / totalMarks) * 100
         → Finds range → grade letter (A / B / C / D / E) + points

Step 15: Mean Grade Calculation
         → secondary.service.ts → calculateMeanGrade(learnerId, term, academicYear)
         → Reads ALL SummativeResults for the term
         → MISSING: should read ONLY results for the learner's selected subjects
         → Calculates: meanScore (avg %), totalPoints, meanGrade letter
         → Persists to MeanGrade model

Step 16: Class Rankings
         → secondary.service.ts → updateClassRankings(classId, term, academicYear)
         → Calls calculateMeanGrade for each enrolled learner
         → Sorts by meanScore DESC → assigns position (1st, 2nd, ...)
         → MISSING: same subject-filter problem propagates here

Step 17: Reports
         → Summative:  GET /api/reports/summative/:learnerId
         → Termly:     GET /api/reports/termly/:learnerId
         → Analytics:  GET /api/reports/analytics/class/:classId
         → UI: ReportsHub.jsx → SummativeReport.jsx / TermlyReport.jsx
         → learningAreaRef.isCore, .pathway, .category present on each result
         → MISSING: no category-level average column
         → MISSING: no "Pathway Readiness" commentary section
         → MISSING: AI advisory not wired into report output

Step 18: PDF Generation
         → pdf.routes.ts + pdf.service.ts
         → Patches applied: patch_pdf_rendering.cjs, patch_summative_report.js
```

---

## 2. FULL AUDIT TABLE

| # | Area | Expected Feature | Status | Evidence | Notes |
|---|------|-----------------|--------|----------|-------|
| 1 | Transition | Dedicated transition wizard page | PARTIAL | LearnerProfile.jsx pathways tab | Embedded in profile tab; no batch/class-level wizard |
| 1 | Transition | Learner profile summary on transition | DONE | LearnerProfile overview tab | Full profile present |
| 1 | Transition | Grade 9 academic history pulled in | DONE | pathway-transition.service.ts reads SummativeResult (all history) | DB read from existing results |
| 1 | Transition | Transition status badge | DONE | transitionStatusClass / transitionStatusLabel in pathways tab | Pending Review / Final Approved / Overridden badges present |
| 1 | Transition | "Proceed to pathway assignment" flow | PARTIAL | After saveTransitionDecision, user manually selects pathway in same tab | No auto-advance wizard step |
| 2 | JS Performance | Mathematics → STEM | DONE | ai-assistant.service.ts CLUSTER_MAP | |
| 2 | JS Performance | Integrated Science → STEM | DONE | Same | |
| 2 | JS Performance | Pre-Technical Studies → STEM | DONE | Same | |
| 2 | JS Performance | English → SOCIAL | DONE | Same | |
| 2 | JS Performance | Kiswahili → SOCIAL | DONE | Same | |
| 2 | JS Performance | Social Studies → SOCIAL | DONE | Same | |
| 2 | JS Performance | Creative Arts → ARTS | DONE | Same | |
| 2 | JS Performance | Agriculture/Life Skills | DONE | Agriculture→STEM, Life Skills→SOCIAL | |
| 2 | JS Performance | Term-by-term trend | DONE | performance.service.ts getLearnerPerformanceTrend() | IMPROVING/STABLE/DECLINING |
| 2 | JS Performance | Subject strength ranking (per subject) | PARTIAL | Cluster-level averages only | No per-subject ranked list surfaced in UI |
| 3 | CBC Competency | Critical thinking | DONE | pathway-transition.service.ts latestCompetency.criticalThinking | Weighted to STEM |
| 3 | CBC Competency | Problem solving | MISSING | Not in transition service mapping | Field likely in CoreCompetency model |
| 3 | CBC Competency | Communication | DONE | latestCompetency.communication | Weighted to SOCIAL |
| 3 | CBC Competency | Creativity | DONE | latestCompetency.creativity | Weighted to ARTS |
| 3 | CBC Competency | Collaboration | DONE | latestCompetency.collaboration | Weighted to SOCIAL |
| 3 | CBC Competency | Digital literacy | MISSING | Not mapped in transition service | |
| 3 | CBC Competency | Citizenship | MISSING | Not mapped | |
| 3 | CBC Competency | Self-efficacy | MISSING | Not mapped | |
| 3 | CBC Competency | Learning to learn | DONE | latestCompetency.learningToLearn | Weighted to STEM |
| 4 | Rec Engine | STEM recommendation | DONE | pathway-recommendation.service.ts | Full scoring |
| 4 | Rec Engine | Social Sciences recommendation | DONE | Same | |
| 4 | Rec Engine | Arts & Sports recommendation | DONE | Same | |
| 4 | Rec Engine | Confidence score | DONE | ai-assistant.service.ts deriveConfidence() | 50–95% gap-based |
| 4 | Rec Engine | Primary recommendation | DONE | predictedPathway normalised | |
| 4 | Rec Engine | Alternative recommendations | PARTIAL | Ranked clusters in service output | UI shows only top recommendation |
| 4 | Rec Engine | Explanation/reasoning | DONE | justification field in prediction | |
| 4 | Rec Engine | Weakness/risk areas | DONE | Below-threshold cluster flagged in risk section | |
| 4 | Rec Engine | Pathway mismatch warning | DONE | mismatchWarning field, rendered in UI | Shown when stakeholder preference ≠ academic evidence |
| 5 | Rec Criteria | Academic performance | DONE | Summative buckets per cluster | |
| 5 | Rec Criteria | Subject trends | DONE | performance.service.ts | |
| 5 | Rec Criteria | Competency levels | PARTIAL | 5 of 9 CBC competencies mapped | See area 3 |
| 5 | Rec Criteria | Learner interests | DONE | transitionForm.learnerInterest | |
| 5 | Rec Criteria | Teacher recommendation | DONE | transitionForm.teacherRecommendation | |
| 5 | Rec Criteria | Parent preference | DONE | transitionForm.parentPreference | |
| 5 | Rec Criteria | Career interest as input | PARTIAL | CAREER_MAP output only; no learner-stated career input field | |
| 5 | Rec Criteria | School capacity/resources | MISSING | Not modelled anywhere | |
| 6 | Interest Form | Career interest input | MISSING | No form field for this | CAREER_MAP is output only |
| 6 | Interest Form | Preferred pathway | DONE | transitionForm.learnerInterest dropdown | |
| 6 | Interest Form | Preferred subjects | MISSING | No subject-level preference field | |
| 6 | Interest Form | Talent/co-curricular interest | MISSING | CoCurricularActivities.jsx exists but not linked to transition | |
| 6 | Interest Form | Parent preference | DONE | transitionForm.parentPreference | |
| 6 | Interest Form | Teacher comment/recommendation | DONE | transitionForm.teacherRecommendation + overrideReason textarea | |
| 7 | Final Approval | Approve recommended pathway | DONE | saveTransitionDecision, role-gated | ADMIN/HT/HoC only |
| 7 | Final Approval | Select alternative pathway | PARTIAL | finalApprovedPathway can differ from recommendedPathway | No dedicated "select alternative" label/step |
| 7 | Final Approval | Override with reason | DONE | overrideReason textarea shown when mismatch detected | Required before save |
| 7 | Final Approval | Save final approved pathway | DONE | pathway-transition-decision.service.ts persists row | |
| 7 | Final Approval | Store approval date | PARTIAL | createdAt on row used as timestamp | No explicit approvedAt field |
| 7 | Final Approval | Store approved by | DONE | updatedBy: req.user.userId | Shown in Decision Timeline |
| 7 | Final Approval | Parent/guardian approval status | MISSING | No flag in payload or model | |
| 7 | Final Approval | Teacher/admin approval status | PARTIAL | Implicit via updatedBy role | No boolean field |
| 8 | SS Assignment | Assign to STEM | DONE | pathway.controller.ts setLearnerPathway | Upserts learner.pathwayId |
| 8 | SS Assignment | Assign to SOCIAL_SCIENCES | DONE | Same | |
| 8 | SS Assignment | Assign to ARTS_SPORTS | DONE | Same | |
| 8 | SS Assignment | Assign to category/track | DONE | setLearnerSubjects + SubjectCategory model | |
| 8 | SS Assignment | View current pathway | DONE | getLearnerPathwayAndSubjects + profile UI | |
| 8 | SS Assignment | Edit/change pathway | DONE | Re-POST setLearnerPathway is idempotent | |
| 8 | SS Assignment | History of pathway changes | PARTIAL | Transition decision history versioned | Direct learner.pathwayId field changes not separately logged |
| 9 | Subject Selection | Core subjects locked/auto-shown | PARTIAL | coreSubjects computed from isCore flag; "Core Subjects (LOCKED)" section renders | **BUG: "No core subjects mapped for this learner grade" for GRADE_10** — gradeLevel mismatch between seed ('GRADE10') and learner field ('GRADE_10') |
| 9 | Subject Selection | Pathway subjects by category | DONE | getPathwayCategories() + category filter chips | |
| 9 | Subject Selection | Suggested combos (Minimum Rules Pack) | DONE | applySuggestedCombo('MIN_RULES') in LearnerProfile.jsx | Selects minSelect per category |
| 9 | Subject Selection | Suggested combos (Pure Sciences Pack) | DONE | applySuggestedCombo('PURE_SCIENCES_PACK') | Selects Physics/Chemistry/Biology/Math |
| 9 | Subject Selection | Combos remain editable after applying | DONE | Checkboxes stay interactive after combo applied | |
| 9 | Subject Selection | Optional subjects selectable | DONE | Checkbox list, category-filtered | |
| 9 | Subject Selection | Selected subjects saved per learner | DONE | LearnerSubjectSelection upsert | |
| 9 | Subject Selection | Subject selection editable | DONE | updateMany active=false + re-upsert | |
| 9 | Subject Selection | Subject selection locked after approval | MISSING | No lock mechanism in backend or frontend | |
| 9 | Subject Selection | Career outlook shown after selection | PARTIAL | Pathway Intelligence panel shows careerRecommendations | Only from recommendation fetch, not dynamically on subject change |
| 10 | Validation | Core subjects required | DONE | validateSelections() CORE_REQUIRED error | Client + server both check |
| 10 | Validation | Min subject rules | DONE | CATEGORY_MIN error | |
| 10 | Validation | Max subject rules | DONE | CATEGORY_MAX error | |
| 10 | Validation | Category-specific rules | DONE | Per-category minSelect/maxSelect | PURE_SCIENCES min 2, HUMANITIES min 1, etc. |
| 10 | Validation | Real-time client validation | DONE | effectiveErrors computed live in UI | Category pills update instantly |
| 10 | Validation | How-to-fix guidance | DONE | pathwayFixActions rendered when errors exist | "Select at least one Core subject", "Add 1 more in Humanities" |
| 10 | Validation | Lock save button when invalid | DONE | canSavePathwaySubjects = (selectedPathwayCode && !saving) | |
| 10 | Validation | Validation before assessment entry | MISSING | assessmentController ignores LearnerSubjectSelection | Marks can be entered for non-selected subjects |
| 11 | Assessment Linkage | Filter marks entry to selected subjects | MISSING | assessmentController has no LearnerSubjectSelection join | |
| 11 | Assessment Linkage | Report shows only selected subjects | PARTIAL | learningAreaRef metadata present; no active-selection filter | |
| 11 | Assessment Linkage | Rankings use only selected subject set | MISSING | calculateMeanGrade() aggregates ALL SummativeResults | Mean grades are incorrect for pathway learners |
| 11 | Assessment Linkage | Non-selected subjects excluded | MISSING | No exclusion logic in any backend query | |
| 11 | Assessment Linkage | Pathway/category averages calculated | PARTIAL | Metadata field present; no dedicated average aggregation | |
| 12 | Report Card | Learner pathway shown | PARTIAL | institutionType fetched; learner.pathway not joined in report query | |
| 12 | Report Card | Selected subjects only | PARTIAL | All subjects in results shown | See #11 |
| 12 | Report Card | Core vs pathway subject split | PARTIAL | isCore flag available per result | PDF template rendering unconfirmed |
| 12 | Report Card | Category averages | MISSING | Not aggregated in reportController | |
| 12 | Report Card | Pathway readiness commentary | MISSING | Not generated in reportController | |
| 12 | Report Card | AI pathway/career advisory | MISSING | aiAssistantService not called in reportController | Only in profile AI tab |
| 13 | AI Insights | Pathway Intelligence panel | DONE | Rendered in pathways tab when pathwayRecommendation exists | |
| 13 | AI Insights | Recommended pathway | DONE | pathwayRecommendation.prediction.predictedPathway | |
| 13 | AI Insights | Confidence score | DONE | prediction.confidence | |
| 13 | AI Insights | Reasoning/justification | DONE | prediction.justification | |
| 13 | AI Insights | Career outlook | DONE | prediction.careerRecommendations (5 per pathway) | |
| 13 | AI Insights | Growth tips | DONE | GROWTH_MAP in ai-assistant.service.ts | |
| 13 | AI Insights | Risk indicators | DONE | aiData.risk in AI Insights tab | |
| 13 | AI Insights | Alternative pathways listed | PARTIAL | Ranked clusters in service; only top shown in UI | |
| 14 | Admin Analytics | Learners per pathway | MISSING | No dashboard route | |
| 14 | Admin Analytics | Learners per category | MISSING | No route | |
| 14 | Admin Analytics | Subject demand report | MISSING | No LearnerSubjectSelection aggregation | |
| 14 | Admin Analytics | Teacher load implications | MISSING | Not implemented | |
| 14 | Admin Analytics | Pathway performance averages | MISSING | No MeanGrade group-by-pathway query | |
| 14 | Admin Analytics | At-risk learners by pathway | MISSING | insights.service.ts not pathway-aware | |

---

## 3. CRITICAL BUGS (Break the current UI)

### BUG-1 — Grade Format Normalization Risk (`GRADE_10` vs `GRADE10`)

**Symptom (environment-dependent):** "No core subjects mapped for this learner grade" can appear when grade formats are mixed.

**Root cause:**
- Some seed/migration/data paths use `GRADE10` while some records/services may still use `GRADE_10`
- `LearnerProfile.jsx` fetches: `api.getLearningAreas({ institutionType: 'SECONDARY', gradeLevel: currentLearner.grade })`
- When request grade and `learning_areas.gradeLevel` format differ, the filter returns zero matches

**Fix needed:** enforce one canonical grade format across seed + learner + query layers (or normalize at the API boundary). Treat as consistency hardening, not a guaranteed active bug in every environment.

---

### BUG-2 — Elective Subjects Not Loading for Pathway

**Symptom:** "No subjects loaded for this pathway yet. Loaded Areas: 192"

**Root cause:**
- 192 areas loaded (all SECONDARY areas, unfiltered fallback worked)
- But `visiblePathwaySubjects` filter checks: `row.pathwayId === selectedPathwayId`
- `selectedPathwayId` is derived from `pathwayCatalog.find(p => p.code === selectedPathwayCode)?.id`
- If the pathway catalog fetch returns pathways with IDs that differ from what's stored on the LearningArea rows → zero match
- Also: the elective filter further excludes core subjects → if pathwayId mismatch, `electiveSubjects = []`

**Fix needed:** Verify that `pathwayId` on `LearningArea` rows matches the `id` in `Pathway` table. Run `GET /api/pathways/integrity` to confirm.

---

### BUG-3 — Mean Grade & Rankings Include Non-Pathway Subjects

**Symptom:** Mean grade calculation uses every `SummativeResult` regardless of whether the subject is in the learner's `LearnerSubjectSelection`.

**Location:** `server/src/services/secondary.service.ts` → `calculateMeanGrade()`

**Fix needed:**
```ts
// Add this to the where clause in calculateMeanGrade:
const selections = await prisma.learnerSubjectSelection.findMany({
  where: { learnerId, active: true },
  select: { learningAreaId: true }
});
const selectedAreaIds = selections.map(s => s.learningAreaId);

const results = await prisma.summativeResult.findMany({
  where: {
    learnerId,
    test: { term, academicYear, archived: false },
    // Add this:
    test: {
      term, academicYear, archived: false,
      learningAreaId: { in: selectedAreaIds }
    }
  }, ...
});
```

---

## 4. ASSET REGISTER

### Backend Routes
| File | Key Endpoints |
|------|--------------|
| `assessmentRoutes.ts` | POST/GET /assessments/tests, /summative/results, /formative |
| `secondary.routes.ts` | GET /secondary/learner/:id/summary, /class/:id/rankings |
| `reportRoutes.ts` | GET /reports/summative/:id, /termly/:id, /analytics/* |
| `pathway.routes.ts` | GET /pathways, POST /pathways/learner/:id/pathway+subjects |
| `pathwayRecommendation.routes.ts` | GET /pathways/recommendations/:id, POST /pathways/transition/:id/readiness+decision |
| `grading.routes.ts` | Grading system CRUD |

### Backend Services
| File | Responsibility |
|------|---------------|
| `secondary.service.ts` | Mean grade, rankings — **needs subject-selection filter** |
| `pathway-recommendation.service.ts` | AI pathway prediction + subject list suggestion |
| `pathway-transition.service.ts` | Grade 9 readiness scoring |
| `pathway-integrity.service.ts` | Catalog health check |
| `ai-assistant.service.ts` | Deterministic rule-based prediction engine |
| `performance.service.ts` | Longitudinal trend |
| `grading.service.ts` | Grading system lookup |
| `report.service.ts` | Report data assembly |
| `ss-pathways.seed.ts` | Pathway + category seed (in services/) |

### Seed Files (⚠️ Potential Duplicate)
| File | Purpose |
|------|---------|
| `prisma/seed-ss-pathways.ts` | Seeds Pathway + SubjectCategory rows |
| `services/ss-pathways.seed.ts` | Also seeds Pathway + SubjectCategory rows |
> Both upsert the same rows. Safe but wasteful. Consolidate to one.

### Frontend (Secondary-Specific)
| Component | Location | Purpose |
|-----------|----------|---------|
| `LearnerProfile.jsx` | pages/profiles/ | Pathway tab + transition form + AI insights |
| `PathwaysHub.jsx` | pages/secondary/ | Pathway catalog viewer + seed trigger |
| `MarkEntryHub.jsx` | pages/secondary/ | CAT/Mid/End-term/Mock navigation hub |
| `SecondaryExamWorkbench.jsx` | pages/secondary/ | Per-exam-type workbench |
| `ReportsHub.jsx` | pages/secondary/ | Reports navigation hub |
| `SubjectManagement.jsx` | pages/secondary/ | Learning area management |
| `ResultsWorkbench.jsx` | pages/secondary/ | Results review |
| `SummativeAssessment.jsx` | pages/ | Desktop mark entry |
| `BulkCreateTest.jsx` | pages/ | Bulk test creation |
| `TermlyReport.jsx` | pages/ | Termly report |
| `SummativeReport.jsx` | pages/ | Summative detailed report |

---

## 5. SUMMARY

### ✅ What Is Working
- Three-pathway catalog (STEM / SOCIAL_SCIENCES / ARTS_SPORTS) seeded with categories
- Pathway assignment on learner (`setLearnerPathway`)
- Subject selection UI: search, category filter, combo packs (Minimum Rules + Pure Sciences)
- Real-time client-side validation with "How to Fix" guidance
- Server-side combination validation (core required, min/max per category)
- Grade 9 transition readiness scoring (academic + competency + stakeholder inputs)
- Transition decision versioning with Decision Timeline in UI
- Role-gated pathway finalisation
- Pathway Intelligence panel: recommended pathway, confidence, career outlook
- Mismatch warning when stakeholder preference conflicts with evidence
- Full exam lifecycle: create test → mark entry → grade → mean grade → rankings → reports

### ❌ Critical Gaps (Fix These First)

| Priority | Issue | Impact |
|----------|-------|--------|
| 🟠 P1 | **Grade format mismatch risk (`GRADE_10` vs `GRADE10`)** | Can hide core subjects in non-normalized environments; consistency hardening required |
| 🔴 P0 | **Pathway ID mismatch on LearningArea rows** | Elective subjects never load — run integrity check |
| 🔴 P0 | **Mean grade ignores LearnerSubjectSelection** | Rankings and report cards are wrong |
| 🔴 P0 | **Report card not filtered to selected subjects** | Learners see marks for subjects they didn't choose |
| 🟠 P1 | **Subject selection lock post-approval** | Admin can change selections after reports issued |
| 🟠 P1 | **Category averages missing from report card** | Pathway report card is incomplete |
| 🟠 P1 | **4 of 9 CBC competencies unmapped** | Transition recommendation quality reduced |
| 🟡 P2 | **Admin analytics entirely absent** | No visibility on pathway distribution |
| 🟡 P2 | **Career interest not captured as learner input** | Output-only — not personalised |
| 🟡 P2 | **Duplicate seed files** | Risk of catalog corruption on re-seed |
| 🟢 P3 | **Class-level batch transition page** | Currently per-learner only |
| 🟢 P3 | **Parent/guardian approval flag** | Audit trail incomplete |
| 🟢 P3 | **AI advisory wired into report card** | Currently only in profile tab |

---

## 6. RECOMMENDED PATCH ORDER

```
Sprint 1 (Data Integrity — must fix before anything else works)
  [1] Enforce canonical grade format end-to-end (`GRADE10` or `GRADE_10`, pick one)
      → Normalize seed scripts, learner grade writes, and getLearningAreas query boundary
  [2] Run GET /api/pathways/integrity — fix any pathwayId mismatches on LearningArea
  [3] Filter calculateMeanGrade() by LearnerSubjectSelection.active=true
  [4] Filter reportController.getSummativeReport by LearnerSubjectSelection.active=true

Sprint 2 (Subject Selection Completion)
  [5] Add subject selection lock (backend flag + frontend disabled state)
  [6] Auto-populate career outlook dynamically when pathway is selected (not only from recommendation)
  [7] Add category-level average aggregation in reportController

Sprint 3 (Recommendation Quality)
  [8] Map 4 missing CBC competencies: problemSolving, digitalLiteracy, citizenship, selfEfficacy
  [9] Expose alternative pathway ranking in UI (not just top recommendation)
  [10] Add career interest input field to transition form

Sprint 4 (Admin & Reporting)
  [11] Build admin analytics: learners-per-pathway, subject demand, at-risk by pathway
  [12] Wire aiAssistantService advisory into termly report card output
  [13] Consolidate duplicate seed files (keep prisma/seed-ss-learning-areas.ts + prisma/seed-ss-pathways.ts, remove service-level duplicate)
  [14] Add parent/guardian approval flag to transition decision

Sprint 5 (Polish)
  [15] Class-level batch Grade 9→10 transition center page
  [16] Co-curricular activities bridged to recommendation scoring
  [17] Explicit approvedAt field on transition decision model
```

---

*Audit complete. No files were modified.*
