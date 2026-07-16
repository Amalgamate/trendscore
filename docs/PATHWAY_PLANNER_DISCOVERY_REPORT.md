# Pathway and School Planner — Discovery & Integration Audit Report

**Date:** 2026-07-12  
**Status:** Discovery complete — no files modified  
**Scope:** Pre-implementation codebase audit for the "Pathway and School Planner" feature

---

## 1. Executive Summary

TrendSCORE is a mature, multi-tenant Kenyan school management platform. The codebase already
contains a **substantial but incomplete** pathway infrastructure built specifically for Senior
Secondary School (Grade 10–12) CBC curriculum. The core pathway catalogue (STEM / Social Sciences /
Arts & Sports Science), subject combination rules, a weighted scoring engine, an AI-backed
recommendation service, a selection workflow with approval and locking, and the start of a
school-offerings model are all present. What is **missing** is the user-facing journey that
connects all of this together for students, parents, and counsellors — and the school-matching
(senior school selection) layer entirely.

The new module does not need to build a pathway system from scratch. It needs to:
1. Surface the existing scoring and selection machinery to students and parents (no current UX).
2. Add the career implication layer (career → pathway → subject combination mapping).
3. Add senior school discovery and matching (search / preference / counsellor review).
4. Unify the currently fragmented admin-only workflows into a guided planner journey.

---

## 2. Existing System Map

### 2.1 Portals and Dashboards

| Portal | Entry Component | Role(s) | Key Pages |
|---|---|---|---|
| **Student portal** | `pages/student/StudentDashboard.jsx` | STUDENT | Dashboard, MyCourses, MyAssignments, MyProgress, MyResults (new) |
| **Parent portal** | `pages/parent-portal/ParentPortalHome.jsx` + `pages/dashboard/ParentDashboard.jsx` | PARENT | Home, Children, Results, Attendance, Fees, Homework (new) |
| **Teacher dashboard** | Embedded in `RoleDashboard` via `PageRouter.jsx` | TEACHER, HEAD_TEACHER, HEAD_OF_CURRICULUM | Assessment, Formative, Summative, Reports, Schemes, Timetable |
| **School admin dashboard** | `RoleDashboard` (ADMIN role path) | ADMIN | All modules; user management, settings, finance, HR |
| **Secondary school pages** | `pages/secondary/` | ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM | PathwaysHub, SubjectManagement, FormGroups, ReportsHub, ResultsWorkbench |
| **Super-admin dashboard** | `RoleDashboard` (SUPER_ADMIN path) | SUPER_ADMIN | Everything + system settings, school provisioning, audit logs |
| **Counsellor** | No dedicated portal — no COUNSELLOR role defined | — | **Gap — see §7** |

**PageRouter.jsx** (`src/components/CBCGrading/layout/PageRouter.jsx`) is the single-file switch
that routes all pages for all roles. New pages require: (a) a `lazy()` import, (b) a case in the
switch, (c) an entry in the relevant title map.


### 2.2 Authentication and Role System

**Mechanism:** JWT (Bearer token or `accessToken` cookie). `authenticate` middleware in
`server/src/middleware/auth.middleware.ts` validates the token, normalises roles once at the
boundary, and populates `req.user { userId, role, roles, isImpersonation, originalAdminId }`.
Optional impersonation is fully supported.

**Roles** (from `roleDefinitions.ts`):
```
SUPER_ADMIN  ADMIN  HEAD_TEACHER  HEAD_OF_CURRICULUM  TEACHER
PARENT  ACCOUNTANT  RECEPTIONIST  LIBRARIAN  NURSE
SECURITY  DRIVER  COOK  CLEANER  GROUNDSKEEPER  IT_SUPPORT  STUDENT
```
Role hierarchy is numeric (SUPER_ADMIN=7 … STUDENT=0).

**RBAC:** `permissions.ts` defines named permissions (e.g. `ACCESS_ASSESSMENT_MODULE`,
`VIEW_CHILDREN_REPORTS`, `LEARNING_VIEW`) mapped to role arrays. `requirePermission(perm)` and
`requireRole(roles[])` middleware enforce these per route.

**Multi-tenancy:** `req.school` is populated by `schoolContext.middleware.ts` or
`school.middleware.ts` using a `schoolId` claim in the JWT or a subdomain header. Most routes
use `requireApp(slug)` to gate module access per school subscription. There is **no global
cross-tenant scoping on the `Learner`, `School`, or `User` models** — all filtering is done
manually using `schoolId` in query `where` clauses. This means every new feature must
explicitly scope its queries. This is documented in `schoolIdConsistency.spec.ts`.

**Module gating** (`requireApp`): Each school enables optional modules (e.g. `lms-professional`,
`exams`, `gradebook`, `fee-management`). Pathway routes are currently gated behind
`requireInstitutionType('SECONDARY')` only — no module slug gate yet.


### 2.3 Data Linkage: Students, Parents, Teachers, Classes, Schools

```
School (schools)
 └── Class (classes) ──schoolId implied by Class.grade+stream+academicYear+term
      ├── ClassEnrollment ──> Learner
      ├── ClassSchedule ──> LearningArea, User(teacher)
      └── User (teacherId)

User (users)
 ├── role: TEACHER  ──> classesAsTeacher[], subjectAssignments[]
 ├── role: PARENT   ──> learners[] (via Learner.parentId FK)
 │                  ──> FamilyAccount / FamilyMember / LearnerFamilyLink (extended family)
 └── role: STUDENT  ──> Learner (via Learner.admissionNumber = User.username)

Learner (learners)
 ├── parentId ──> User(PARENT)         [direct parent link]
 ├── LearnerFamilyLink ──> FamilyAccount [extended family link]
 ├── ClassEnrollment[] ──> Class
 ├── pathwayId ──> Pathway             [legacy pathway assignment]
 ├── LearnerSubjectSelection[]         [legacy subject selections]
 ├── LearnerPathwaySelection[]         [new senior pathway selection]
 └── institutionType: PRIMARY_CBC | SECONDARY | TERTIARY
```

**Key observation:** `User` and `Learner` are **separate models**. A student's `User.username`
equals their `Learner.admissionNumber`. There is no direct FK between them — all lookups
resolve via the admission number. This is a known design quirk used throughout (e.g.
`resolveLearnerId()` in `lms.controller.ts`).

The School model has no direct FK to User or Learner — tenancy is implicit through the
`schoolId` on the JWT and enforced via middleware. `Class` also lacks an explicit `schoolId`
column; school scoping for classes relies on the `req.school` context.


---

## 3. Relevant Database Models

### 3.1 Core academic models

| Model | Table | Purpose |
|---|---|---|
| `Learner` | `learners` | Learner profile. Fields: grade, institutionType, pathwayId, upiNumber |
| `User` | `users` | Auth identity for all roles including STUDENT and PARENT |
| `Class` / `ClassEnrollment` | `classes` / `class_enrollments` | Class membership, teacher assignment |
| `FormativeAssessment` | `formative_assessments` | CBC rubric-based assessments (OPENER, CAT, etc.) |
| `SummativeResult` | `summative_results` | Exam scores: percentage, grade, cbcGrade, teacherComment, remarks |
| `CoreCompetency` | `core_competencies` | Detailed rubric ratings (EE1/EE2/ME1… BE2) per CBC competency |
| `LearningArea` | `learning_areas` | Subject catalogue for primary/junior secondary |
| `GradingSystem` / `GradingRange` | — | School-configurable grading scales |
| `CoCurricularActivity` | — | Extra-curricular records |
| `ValuesAssessment` | — | CBC values assessment |

### 3.2 Pathway models (existing — the backbone of the new feature)

| Model | Table | Purpose |
|---|---|---|
| `Pathway` | `pathways` | CBC SS pathway: STEM / SOCIAL_SCIENCES / ARTS_SPORTS / CORE |
| `PathwayTrack` | `pathway_tracks` | Sub-track: PURE_SCIENCES, APPLIED_SCIENCES, HUMANITIES_BUSINESS, etc. |
| `OfficialLearningArea` | `official_learning_areas` | Kenya MoE official SS subjects with type (EXAMINABLE_CORE/OPTIONAL/SUPPORT) |
| `LearningAreaAlias` | `learning_area_aliases` | Maps legacy subject names to official codes |
| `SubjectCombinationRule` | `subject_combination_rules` | Official approved subject triplets per pathway+track |
| `SubjectCombinationRuleItem` | `subject_combination_rule_items` | Subjects in each rule |
| `SchoolLearningAreaOffering` | `school_learning_area_offerings` | Which official subjects a school actually offers |
| `LearnerSubjectSelection` | `learner_subject_selections` | Legacy subject selections (linked to LearningArea) |
| `LearnerPathwaySelection` | `learner_pathway_selections` | New selection: pathway + track + combination rule; status: DRAFT/SUBMITTED/APPROVED/LOCKED |
| `LearnerPathwaySelectionItem` | `learner_pathway_selection_items` | Individual official subjects in the selection |
| `PathwayApproval` | `pathway_approvals` | Approval records per selection (approverRole, status, comment) |
| `PathwaySelectionHistory` | `pathway_selection_history` | Audit trail of selection lifecycle |
| `SubjectCategory` | `subject_categories` | Min/max selection constraints per pathway category (legacy) |

### 3.3 Transition / recommendation (partial — raw SQL table)

| Model | Notes |
|---|---|
| `learner_pathway_recommendations` | **Raw SQL table** — NOT in Prisma schema. Created lazily by `ensureDecisionTable()`. Stores: recommendedPathway, confidenceScore, learnerInterest, teacherRecommendation, parentPreference, finalApprovedPathway, mismatchWarning, analysisPayload. **Major technical debt item.** |

### 3.4 Tertiary models (exist but very thin)

| Model | Purpose |
|---|---|
| `TertiaryDepartment` | University/college department stub |
| `TertiaryProgram` | Degree/diploma programme stub |
| `TertiaryUnit` | Unit of study stub |

These are minimal CRUD stubs — no career matching, no entry requirements, no subject prerequisite logic.

### 3.5 Models that do NOT yet exist (gaps)

- `CareerProfile` / `CareerCluster` — no career catalogue
- `SeniorSchool` — no school discovery catalogue
- `SchoolPreference` / `LearnerSchoolPlan` — no school selection workflow
- `LearnerInterestSurvey` / `TalentProfile` — no formal interest/talent capture
- `CounsellorNote` / `CounsellorReview` — no counsellor workflow model
- `PathwayCareerMapping` — no pathway → career implication table


---

## 4. Existing Pathway Implementation — Deep Dive

### 4.1 The two parallel pathway systems

**IMPORTANT:** There are currently **two separate pathway systems** in the codebase that serve
different levels of the student journey:

| System | Files | Purpose | Status |
|---|---|---|---|
| **Legacy pathway** | `pathway.controller.ts`, `pathway.routes.ts`, `LearnerSubjectSelection`, `SubjectCategory` | Assign a pathway + select subjects from the LearningArea catalogue (primary/junior-secondary style) | Functional but admin-only |
| **Senior pathway** | `seniorPathway.controller.ts`, `seniorPathway.routes.ts`, `LearnerPathwaySelection`, `OfficialLearningArea`, `SubjectCombinationRule` | Full Grade 10–12 official subject combination selection with validation, approval and locking | Backend complete; no student/parent UX |

The two systems are **not yet unified**. `legacy-pathway-selection-adapter.service.ts` provides
a preview bridge that maps legacy `LearnerSubjectSelection` records to official `OfficialLearningArea`
codes — intended to help migrate schools that used the old system.

### 4.2 Scoring / recommendation logic

**File:** `pathway-transition.service.ts` → `buildGrade9TransitionReadiness()`

**Inputs:**
- Historical `SummativeResult` percentages, keyword-matched to pathway buckets
- `CoreCompetency` detailed rubric ratings (EE1–BE2), mapped to competency dimension scores
- Optional: `nationalExam` scores (manual, keyed by subject name)
- Optional: `learnerInterest` (STEM | SOCIAL_SCIENCES | ARTS_SPORTS) — direct signal
- Optional: `teacherRecommendation` — direct signal
- Optional: `parentPreference` — direct signal

**Algorithm:** Weighted linear combination:
```
Academic:   50%  (subject keyword → pathway bucket average)
Competency: 20%  (critical thinking + learning → STEM; communication + collaboration → Social; creativity + collaboration → Arts)
Interest:   15%  (learner self-report)
Teacher:    10%  (teacher recommendation)
Parent:      5%  (parent preference)
```

**Outputs:** Ranked array of pathways with weighted scores; recommended pathway;
confidence score (score gap + 60, clamped 0–99); parent mismatch warning.

**AI-backed alternative:** `pathway-recommendation.service.ts` calls
`aiAssistantService.generatePathwayPrediction()` which uses Claude/OpenAI to predict
the pathway. Outputs are then used to suggest specific subject combinations from the catalogue.
Only available for Grade 7–9 learners.

**File:** `senior-pathway-rule-engine.service.ts` → `validateSeniorPathwaySelection()`

Validates a `LearnerPathwaySelection` against:
- Exactly 4 compulsory subjects (English, Kiswahili/KSL, Core/Essential Math, CSL required)
- Exactly 3 optional subjects matching an approved `SubjectCombinationRule`
- School offerings (if `strictSchoolOfferings: true`)
- Pathway / track / combination rule consistency

### 4.3 API endpoints (current)

**Mount:** All behind `authenticate` + `requireInstitutionType('SECONDARY')`

```
GET  /api/pathways                                   — list active pathways
GET  /api/pathways/integrity                         — catalog health check
GET  /api/pathways/:code/categories                  — category constraints for pathway
GET  /api/pathways/learner/:learnerId                — learner's legacy pathway + subjects
POST /api/pathways/learner/:learnerId/pathway        — assign legacy pathway (admin only)
POST /api/pathways/learner/:learnerId/subjects       — save legacy subject selection (admin only)
POST /api/pathways/seed                              — seed catalog (admin only)

GET  /api/pathways/recommendations/:learnerId        — AI + weighted recommendation
POST /api/pathways/transition/:learnerId/readiness   — weighted scoring (no AI)
POST /api/pathways/transition/:learnerId/decision    — save transition decision record
GET  /api/pathways/transition/:learnerId/decision-history

GET  /api/senior-pathways/catalog                    — full official pathway/track/subject catalog
GET  /api/senior-pathways/combinations               — official combination rules
GET  /api/senior-pathways/offerings                  — school's active subject offerings
GET  /api/senior-pathways/learners/:learnerId/selection
GET  /api/senior-pathways/learners/:learnerId/legacy-preview
GET  /api/senior-pathways/selections/:id/history
POST /api/senior-pathways/validate-selection         — validate without saving
POST /api/senior-pathways/selections                 — save/update draft (admin only)
POST /api/senior-pathways/selections/:id/submit      — submit for review (admin only)
POST /api/senior-pathways/selections/:id/approve     — approve (admin only)
POST /api/senior-pathways/selections/:id/lock        — lock final selection (admin only)
PUT  /api/senior-pathways/offerings                  — update school subject offerings (admin)
```

### 4.4 Frontend screens (current)

| File | Route | Who sees it | What it does |
|---|---|---|---|
| `secondary/PathwaysHub.jsx` | `sec-pathways` | ADMIN, HEAD_TEACHER | View catalog integrity, configure which subjects the school offers. Seed/refresh catalog. View category constraints. |
| `secondary/SubjectManagement.jsx` | `sec-subject-management` | ADMIN, HEAD_TEACHER | CRUD for legacy LearningArea subjects (Grade 10–12 filter). |
| `secondary/ReportsHub.jsx` | `sec-reports-hub` | ADMIN, HEAD_TEACHER | Navigation hub to secondary report pages |
| `secondary/ResultsWorkbench.jsx` | `sec-mean-grades` etc. | ADMIN, HEAD_TEACHER | Stub — 3 static action cards linking to existing screens |
| `secondary/FormGroups.jsx` | `sec-form-groups` | ADMIN, HEAD_TEACHER | Form group management stub |

**No student, parent, or counsellor pathway screens exist at all.**

### 4.5 Missing or incomplete functionality

| Gap | Severity | Notes |
|---|---|---|
| No student pathway view | Critical | Students cannot see their recommendation or selection |
| No parent pathway view | Critical | Parents cannot participate in pathway decision |
| No counsellor role or UI | Critical | No way to capture professional guidance |
| `learner_pathway_recommendations` is a raw SQL table | High | Not in Prisma schema, managed by `ensureDecisionTable()`. Fragile, not type-safe, won't survive schema migrations cleanly. |
| Recommendation engine uses subject keyword matching | Medium | Broad strings like "MATHEMATICS" matched by `includes()` — can mis-classify |
| No career implication layer | High | Pathway → career pathway → tertiary requirements not connected |
| No senior school discovery or matching | High | `SeniorSchool` model does not exist |
| AI recommendation gated to Grade 7–9 only | Medium | Grade 10–12 students cannot request a re-recommendation |
| Transition decision `finalApprovedPathway` has no lock on `LearnerPathwaySelection` | Medium | Two separate approval flows that are not yet linked |
| No parent/student preference capture in the new selection flow | Medium | `parentPreference` only exists in the transition decision table |
| School offerings are not school-scoped via a `schoolId` FK in the Prisma model | Medium | `SchoolLearningAreaOffering.schoolId` is `String?` (nullable) |


---

## 5. Reusable Components and Services

### 5.1 Backend services to reuse directly

| Service | Reuse |
|---|---|
| `pathway-recommendation.service.ts` | Wrap for student/parent consumption — add ownership scoping |
| `pathway-transition.service.ts` | Core scoring logic — reuse as-is; expose via student/parent routes |
| `senior-pathway-rule-engine.service.ts` | Validation — reuse for student-initiated selections |
| `legacy-pathway-selection-adapter.service.ts` | Data migration bridge — reuse during onboarding |
| `parent-access.service.ts` | `getAccessibleLearnerIds(parentUserId)` — reuse for all parent pathway routes |
| `audit.service.ts` | Log all pathway decisions — reuse as-is |
| `notification.service.ts` | Notify parent/student when counsellor adds note or approves selection |
| `ai-bridge.service.ts` | Claude/OpenAI wrapper — reuse for career suggestion prompts |
| `redis-cache.service.ts` | Cache pathway catalog (changes rarely) |
| `report.service.ts` | Extend for pathway-aware report cards |
| `grading.service.ts` | cbcGrade computation — reuse for eligibility checks |

### 5.2 Frontend components to reuse

| Component / hook | Location | Reuse |
|---|---|---|
| `useLearnerResults` hook | `pages/results/useLearnerResults.js` | Fetch academic history for pathway scoring display |
| `ResultsShared.jsx` | `pages/results/ResultsShared.jsx` | `TermAccordion`, `GradePill`, `SubjectRow`, `YearSelector` — reuse in pathway screens |
| `ParentChildProfile` tabs pattern | `pages/parent/ParentChildProfile.jsx` | Tab navigation pattern for multi-step planner |
| `ChildPerformanceRow` in `ParentPortalResults` | `pages/parent-portal/ParentPortalResults.jsx` | Per-child card pattern |
| `Skeleton` from `components/ui` | — | Loading states |
| `PathwaysHub.jsx` configuration UI | `pages/secondary/PathwaysHub.jsx` | Subject offerings config — extend for school admin |
| `SubjectManagement.jsx` | `pages/secondary/SubjectManagement.jsx` | Subject catalog filter/CRUD — extend |
| `ReportsCenterPage`, `LearnerReportsPage` | existing | Report print/export patterns |
| `MobilePortalAppBar` | `layout/MobilePortalAppBar` | Mobile header — reuse in planner screens |
| `EmptyState` | `shared/EmptyState` | Consistent empty states |
| `ComingSoon` | `shared/ComingSoon` | Placeholder for phased rollout |

### 5.3 Infrastructure to reuse

| Infrastructure | Notes |
|---|---|
| `requireApp(slug)` middleware | Gate new module behind a `pathway-planner` app slug |
| `requireInstitutionType('SECONDARY')` | Already gates all pathway routes |
| `auditLog(action)` middleware | Already on write pathway routes — extend |
| `requireCsrf` middleware | Apply to all new state-mutating routes |
| `PageRouter.jsx` switch | Add new page cases |
| App subscriptions system | Register `pathway-planner` as an optional module slug |


---

## 6. User-Role Integration Map

| Stakeholder | Current Access to Pathway | Needed |
|---|---|---|
| **STUDENT** | None — no route, no screen | See own recommendation; explore careers; express subject preferences; view selection status |
| **PARENT** | None — no route, no screen | See child's recommendation; express preferences; view selection status and counsellor notes; view matched schools |
| **TEACHER / HEAD_OF_CURRICULUM** | Can read all pathway endpoints (GET routes open to authenticated SECONDARY users) | Review class-level pathway distribution; contribute teacher recommendation signal |
| **HEAD_TEACHER / ADMIN** | Full write access to pathway and senior-pathway endpoints; manage school offerings | Approve/lock selections; manage school profile for matching |
| **COUNSELLOR** | **Role does not exist** | Own dedicated role or use HEAD_OF_CURRICULUM as proxy; add counsellor notes; finalize plan |
| **SUPER_ADMIN** | Full access; can seed catalogs | Global career catalogue management; school catalogue management |

**Assumption:** No dedicated COUNSELLOR role. Recommend either (a) adding it to `USER_ROLES` in
`roleDefinitions.ts`, or (b) treating `HEAD_OF_CURRICULUM` as the counsellor proxy with additional
pathway-planner permissions. This is a product decision — see §11.


---

## 7. Gaps and Technical Risks

### 7.1 Critical gaps

**G1 — `learner_pathway_recommendations` not in Prisma schema**
The transition decision table is created by raw SQL in `ensureDecisionTable()`. It will not
appear in migrations, type-safe queries, or Prisma Studio. Risk: silent data loss during
`prisma migrate reset`, no compile-time safety. **Must be migrated into the Prisma schema.**

**G2 — No counsellor role or workflow**
The entire "counsellor review" step of the journey has no role, no model, no route, and no UI.
This is the biggest structural gap.

**G3 — No career layer**
Pathways are academically defined but carry no career implication data. A student cannot answer
"what jobs does STEM → Pure Sciences → Bio+Chem+Phy lead to?" from the current system.

**G4 — No senior school catalogue**
There is no `SeniorSchool` model, no school features/type/location data, no entry requirements,
and no matching logic. The `TertiaryDepartment/Program/Unit` stubs are university-level and too
thin to serve as school profiles.

**G5 — Student has no access to their own pathway data**
All pathway write routes require `HEAD_TEACHER` / `ADMIN` / `HEAD_OF_CURRICULUM`. Students cannot
initiate or even view their own selection. Parents are similarly excluded.

### 7.2 Technical risks

**R1 — Two parallel pathway systems**
`LearnerSubjectSelection` (legacy) and `LearnerPathwaySelection` (new senior) both exist.
Schools may have data in the legacy system. The adapter service handles preview mapping but not
data migration. Need a clear strategy before adding a third pathway touchpoint.

**R2 — No schoolId on Class model**
Class is scoped to school implicitly via the JWT `req.school` context, not by a column FK.
Pathway planner features that list "schools offering X pathway" will need careful scoping.

**R3 — AI recommendation depends on external API key**
`aiAssistantService.generatePathwayPrediction()` calls Claude/OpenAI. No API key = 500 error.
The weighted scoring path (`buildGrade9TransitionReadiness`) is the non-AI fallback and should
always be the primary path for the student-facing feature.

**R4 — Recommendation eligible for Grade 7–9 only**
The AI recommendation service throws a 400 for Grade 10–12. The weighted scoring service has
no such restriction. New routes for Grade 10–12 students need to use the weighted path
(or a re-scoped AI path) rather than `recommendSeniorPathwayAndSubjects`.

**R5 — Subject keyword matching is fragile**
`pathwayFromKeywords()` does `areaName.toUpperCase().includes(keyword)`. A subject named
"History" gets matched to SOCIAL_SCIENCES only if "HISTORY" appears in the keyword list.
New subjects or non-standard names will be silently unmatched (score stays 0). Needs a
structured subject-to-pathway mapping table.

**R6 — PageRouter.jsx is large and centralized**
Every new page requires editing a single large file. As we add 8–10 new planner screens,
this becomes a merge-conflict risk if other features are developed in parallel.

**R7 — `SchoolLearningAreaOffering.schoolId` is nullable**
School offerings can be created without a schoolId, breaking multi-tenant isolation for school
subject matching. This needs a NOT NULL migration before the school-matching feature ships.

### 7.3 Duplicated functionality

- Two pathway assignment systems (legacy `LearnerSubjectSelection` + new `LearnerPathwaySelection`)
- Two scoring paths (AI-backed `recommendSeniorPathwayAndSubjects` and non-AI
  `buildGrade9TransitionReadiness`) with overlapping but not identical inputs
- `getStudentMetrics()` in `dashboard.controller.ts` returns a `reportCard` object that partially
  overlaps with what `getLearnerAnalytics()` returns — not unified


---

## 8. Proposed Feature Architecture

### 8.1 Where the module lives

**Student application** (`pages/student/`)
- `PathwayPlanner.jsx` — single guided multi-step view:
  Step 1: Academic results summary (existing `useLearnerResults`)
  Step 2: Recommendation display (pathway, confidence, component scores)
  Step 3: Career exploration (pathway → career cluster cards)
  Step 4: Subject preference expression (read-only until counsellor opens it)
  Step 5: Selection status / counsellor notes
  Linked from `StudentDashboard.jsx` as a new "My Future" / "Pathway" stat tile.

**Parent application** (`pages/parent-portal/`)
- `ParentPortalPathway.jsx` — per-child pathway card:
  Shows recommendation, child's expressed preferences, parent preference input,
  counsellor notes, selection status, school shortlist.
  Linked from `ParentPortalHome.jsx` QuickActions (new "Pathway" button).

**Teacher / counsellor application** (`pages/secondary/`)
- `PathwayCounsellorWorkbench.jsx` — learner-level counsellor workflow:
  View scoring breakdown, add counsellor note, record teacher recommendation,
  submit for admin approval, view class-wide pathway distribution.
  Extend `PathwaysHub.jsx` or create as separate page under `sec-pathway-counsellor`.

**School administrator application** (`pages/secondary/`)
- Extend existing `PathwaysHub.jsx` with a new "School Profile" tab:
  School type (day/boarding/mixed), county, available pathways, KCSE entry grade,
  contact details — used for school matching.
- New `SchoolDirectory.jsx` — national senior school catalogue (super-admin seeded,
  school-admin verified).

**Super-admin application**
- `CareerCatalogueAdmin.jsx` — manage global career clusters + pathway mappings
- `SeniorSchoolDirectory.jsx` — manage national school catalogue

### 8.2 Information flow

```
Grade 7–9 academic results + CoreCompetency
    │
    ▼
buildGrade9TransitionReadiness()   ← learnerInterest (student form)
    │                              ← teacherRecommendation (counsellor workbench)
    │                              ← parentPreference (parent portal)
    │                              ← nationalExam (optional KCPE/KCSE input)
    ▼
PathwayTransitionDecision saved to DB (migrate raw SQL → Prisma model)
    │
    ▼
Student sees recommendation → explores career clusters → expresses subject preferences
Parent sees recommendation → inputs preferences → views school shortlist
Counsellor reviews all signals → adds note → unlocks student subject selection → submits
Admin approves → LearnerPathwaySelection status: APPROVED
Admin locks → LearnerPathwaySelection status: LOCKED
    │
    ▼
School matching: LearnerPathwaySelection + preferred school features
    → filter SeniorSchool catalogue by pathway offered + school type + county
    → rank by match score → produce shortlist
    → student/parent preference + counsellor endorsement → final plan
```


---

## 9. Proposed Data-Model Changes

### 9.1 Migrate raw SQL table to Prisma (Gap G1 fix)

Replace `learner_pathway_recommendations` raw SQL with a proper Prisma model:

```prisma
model LearnerPathwayRecommendation {
  id                    String   @id @default(uuid())
  learnerId             String
  recommendedPathway    String                        // STEM | SOCIAL_SCIENCES | ARTS_SPORTS
  confidenceScore       Float    @default(0)
  learnerInterest       String?
  teacherRecommendation String?
  parentPreference      String?
  finalApprovedPathway  String?
  mismatchWarning       String?
  analysisPayload       Json?
  updatedBy             String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  learner               Learner  @relation(fields: [learnerId], references: [id])

  @@index([learnerId])
  @@map("learner_pathway_recommendations")
}
```

Add `pathwayRecommendations LearnerPathwayRecommendation[]` to `Learner`.

### 9.2 New models required

```prisma
// Career cluster — global catalogue seeded by super-admin
model CareerCluster {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  description String?
  pathwayCodes String[] // STEM | SOCIAL_SCIENCES | ARTS_SPORTS
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  careers     Career[]

  @@map("career_clusters")
}

// Individual career within a cluster
model Career {
  id              String        @id @default(uuid())
  clusterId       String
  name            String
  description     String?
  tertiaryPathway String?       // e.g. "Medicine", "Engineering", "Law"
  active          Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  cluster         CareerCluster @relation(fields: [clusterId], references: [id])
  interestedLearners LearnerCareerInterest[]

  @@map("careers")
}

// Learner's expressed career interest(s)
model LearnerCareerInterest {
  id        String   @id @default(uuid())
  learnerId String
  careerId  String
  rank      Int      @default(1)  // 1 = top choice
  createdAt DateTime @default(now())
  learner   Learner  @relation(fields: [learnerId], references: [id])
  career    Career   @relation(fields: [careerId], references: [id])

  @@unique([learnerId, careerId])
  @@index([learnerId])
  @@map("learner_career_interests")
}

// Senior school in the national catalogue
model SeniorSchool {
  id              String   @id @default(uuid())
  name            String
  knecCode        String?  @unique
  county          String
  subCounty       String?
  schoolType      String   // DAY | BOARDING | DAY_AND_BOARDING
  gender          String   // MIXED | BOYS | GIRLS
  category        String?  // NATIONAL | EXTRA_COUNTY | COUNTY | SUB_COUNTY
  pathwayCodes    String[] // which SS pathways are offered
  minimumKcpeGrade Float?
  website         String?
  phone           String?
  active          Boolean  @default(true)
  verified        Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  preferences     LearnerSchoolPreference[]

  @@index([county])
  @@index([pathwayCodes])
  @@map("senior_schools")
}

// Learner's school shortlist with preference ranking
model LearnerSchoolPreference {
  id           String      @id @default(uuid())
  learnerId    String
  schoolId     String
  rank         Int         // 1 = first choice
  source       String      @default("LEARNER") // LEARNER | PARENT | COUNSELLOR
  notes        String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  learner      Learner     @relation(fields: [learnerId], references: [id])
  school       SeniorSchool @relation(fields: [schoolId], references: [id])

  @@unique([learnerId, schoolId])
  @@index([learnerId])
  @@map("learner_school_preferences")
}

// Counsellor note on a learner's pathway journey
model CounsellorNote {
  id          String   @id @default(uuid())
  learnerId   String
  authorId    String
  authorRole  String
  note        String
  noteType    String   @default("GENERAL") // GENERAL | RECOMMENDATION | APPROVAL | CONCERN
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  learner     Learner  @relation(fields: [learnerId], references: [id])
  author      User     @relation(fields: [authorId], references: [id])

  @@index([learnerId])
  @@map("counsellor_notes")
}
```

### 9.3 Model extensions (no new tables)

- `Learner` — add `pathwayRecommendations[]`, `careerInterests[]`, `schoolPreferences[]`, `counsellorNotes[]`
- `SchoolLearningAreaOffering` — make `schoolId` NOT NULL (data migration needed)
- `LearnerPathwaySelection` — add `counsellorNoteId String?` FK to link the approving note

### 9.4 Data migration considerations

- `learner_pathway_recommendations` raw SQL → backfill into `LearnerPathwayRecommendation` Prisma model
- `LearnerSubjectSelection` (legacy) → run adapter to populate `LearnerPathwaySelection` for existing secondary learners
- `SchoolLearningAreaOffering.schoolId` — null rows need a schoolId before making NOT NULL


---

## 10. Proposed API and Screen Map

### 10.1 New API endpoints

All new routes under `/api/pathway-planner/` (new module slug: `pathway-planner`).
Mount: `router.use('/pathway-planner', requireApp('pathway-planner'), requireInstitutionType('SECONDARY'), pathwayPlannerRoutes)`

```
# Student / Parent — read-only pathway data
GET  /api/pathway-planner/learners/:learnerId/summary
     → recommendation + scores + selection status + career interests + school shortlist
     Access: STUDENT (self) | PARENT (own child) | staff

GET  /api/pathway-planner/learners/:learnerId/recommendation
     → weighted scoring result (same as transition readiness but with ownership check)
     Access: STUDENT (self) | PARENT (own child) | staff

POST /api/pathway-planner/learners/:learnerId/recommendation
     → trigger/refresh recommendation (non-AI path as primary)
     Body: { learnerInterest?, teacherRecommendation?, parentPreference?, nationalExam? }
     Access: STUDENT (self-interest only) | PARENT (parent preference only) | staff (all inputs)

# Career exploration
GET  /api/pathway-planner/career-clusters
     → list all active CareerClusters with careers
     Access: any authenticated

GET  /api/pathway-planner/learners/:learnerId/career-interests
GET  /api/pathway-planner/learners/:learnerId/career-interests (POST/PUT)
     → CRUD learner career interest list
     Access: STUDENT (self) | PARENT (own child) | staff

# Subject selection — extend existing senior-pathway routes or add here
POST /api/pathway-planner/learners/:learnerId/selection
     → student/parent-initiated selection draft (delegates to senior-pathway service)
     Access: STUDENT (self — if counsellor has unlocked) | staff

# Counsellor workflow
GET  /api/pathway-planner/learners/:learnerId/counsellor-notes
POST /api/pathway-planner/learners/:learnerId/counsellor-notes
     Access: HEAD_OF_CURRICULUM | HEAD_TEACHER | ADMIN | SUPER_ADMIN

POST /api/pathway-planner/learners/:learnerId/unlock-selection
     → allows student to submit their own selection draft
     Access: HEAD_OF_CURRICULUM | HEAD_TEACHER | ADMIN

# School matching
GET  /api/pathway-planner/senior-schools
     → search national catalogue with filters: county, schoolType, gender, pathwayCodes
     Access: any authenticated SECONDARY user

GET  /api/pathway-planner/learners/:learnerId/school-preferences
PUT  /api/pathway-planner/learners/:learnerId/school-preferences
     → save ranked school shortlist
     Access: STUDENT (self) | PARENT (own child) | staff

# School admin
GET  /api/pathway-planner/school-profile         → this school's SeniorSchool record
PUT  /api/pathway-planner/school-profile         → update (ADMIN+)

# Super-admin
POST /api/pathway-planner/admin/career-clusters  → CRUD career catalogue
POST /api/pathway-planner/admin/senior-schools   → CRUD national school catalogue
```

### 10.2 New frontend screens

| Screen | Route key | Component | Portal | Stakeholder |
|---|---|---|---|---|
| Pathway Planner (student) | `student-pathway-planner` | `pages/student/PathwayPlanner.jsx` | Student | STUDENT |
| My Career Interests | `student-career-interests` | `pages/student/CareerExplorer.jsx` | Student | STUDENT |
| Parent Pathway View | `parent-portal-pathway` | `pages/parent-portal/ParentPortalPathway.jsx` | Parent portal | PARENT |
| School Shortlist (parent) | `parent-portal-schools` | `pages/parent-portal/ParentPortalSchools.jsx` | Parent portal | PARENT |
| Counsellor Workbench | `sec-pathway-counsellor` | `pages/secondary/PathwayCounsellorWorkbench.jsx` | Secondary admin | HEAD_OF_CURRICULUM, HEAD_TEACHER |
| School Directory (matching) | `sec-school-directory` | `pages/secondary/SeniorSchoolDirectory.jsx` | Secondary admin | ADMIN, HEAD_TEACHER |
| School Profile Config | tab in `PathwaysHub` | extend `PathwaysHub.jsx` | Secondary admin | ADMIN |
| Career Catalogue Admin | `admin-career-catalogue` | `pages/settings/CareerCatalogueAdmin.jsx` | Super-admin | SUPER_ADMIN |

### 10.3 Permissions additions to `permissions.ts`

```typescript
// Pathway Planner
VIEW_OWN_PATHWAY:         ['STUDENT'],
VIEW_CHILDREN_PATHWAY:    ['PARENT'],
VIEW_ALL_PATHWAYS:        ['SUPER_ADMIN','ADMIN','HEAD_TEACHER','HEAD_OF_CURRICULUM','TEACHER'],
MANAGE_PATHWAY_PLANNER:   ['SUPER_ADMIN','ADMIN','HEAD_TEACHER','HEAD_OF_CURRICULUM'],
COUNSEL_PATHWAYS:         ['SUPER_ADMIN','ADMIN','HEAD_TEACHER','HEAD_OF_CURRICULUM'],
MANAGE_CAREER_CATALOGUE:  ['SUPER_ADMIN'],
MANAGE_SCHOOL_CATALOGUE:  ['SUPER_ADMIN','ADMIN'],
```

### 10.4 Notifications / events between stakeholders

| Trigger | Notification |
|---|---|
| Counsellor adds a note | → Notify STUDENT + PARENT |
| Counsellor unlocks selection | → Notify STUDENT |
| ADMIN approves selection | → Notify STUDENT + PARENT |
| ADMIN locks selection | → Notify STUDENT + PARENT |
| Student submits selection draft | → Notify HEAD_OF_CURRICULUM + HEAD_TEACHER |
| Parent saves preference | → Notify HEAD_OF_CURRICULUM |

All notifications via existing `notification.service.ts`.


---

## 11. Phased Implementation Plan

> **Constraint:** No implementation code until this report is reviewed and approved.

---

### Phase 0 — Foundation fixes (prerequisite — no new features)

**Goal:** Fix the technical debt that would undermine everything else.

Tasks:
1. Migrate `learner_pathway_recommendations` raw SQL table into a Prisma model
   (`LearnerPathwayRecommendation`). Write a migration script to preserve existing rows.
2. Make `SchoolLearningAreaOffering.schoolId` NOT NULL. Write a backfill migration.
3. Add `pathway-planner` to the app slug catalogue and `requireApp` allowlist.
4. Add ownership checks to the GET endpoints on `/api/pathway-planner/*`
   (same pattern as `assertLearnerAccess` in `reportController.ts`).
5. Optionally: add `COUNSELLOR` to `USER_ROLES` if product approves (see §11 Q1).

**Estimated scope:** 1–2 backend sprints. No frontend changes.

---

### Phase 1 — Student self-service pathway view

**Goal:** Student can see their recommendation and component scores.

Tasks:
1. New `GET /api/pathway-planner/learners/:learnerId/summary` — STUDENT self-only scope.
2. New `POST /api/pathway-planner/learners/:learnerId/recommendation` — student can
   supply `learnerInterest` only; delegates to `buildGrade9TransitionReadiness`.
3. `pages/student/PathwayPlanner.jsx` — Step 1 (academic summary) + Step 2 (recommendation).
4. Link from `StudentDashboard.jsx` stat tile.
5. `pages/student/CareerExplorer.jsx` — Step 3 (career cluster cards, read-only initially).
6. Seed minimal career cluster catalogue (STEM / Social Sciences / Arts, ~5 careers each).

**Deliverable:** Student opens the app and sees their recommended pathway, component scores,
and a list of example careers aligned to the recommendation — for the first time.

---

### Phase 2 — Parent pathway participation

**Goal:** Parents can see and contribute to their child's pathway journey.

Tasks:
1. Parent-scoped endpoints for summary, recommendation (parentPreference input only),
   career interests (read), school preferences (CRUD).
2. `pages/parent-portal/ParentPortalPathway.jsx` — per-child recommendation card.
3. Parent preference input widget (radio: STEM / Social / Arts / No preference).
4. Add "Pathway" quick action to `ParentPortalHome.jsx`.
5. Show counsellor notes (read-only) when present.
6. Notification: parent saves preference → notify HEAD_OF_CURRICULUM.

**Deliverable:** Parent can see what pathway the system recommends for their child,
express a preference, and see any notes the school has added.

---

### Phase 3 — Counsellor workbench

**Goal:** Head of Curriculum / Head Teacher can review all signals and guide the decision.

Tasks:
1. `CounsellorNote` Prisma model + CRUD API.
2. Teacher recommendation input on the workbench (sets `teacherRecommendation` on the decision).
3. "Unlock selection" action — allows student to create a `LearnerPathwaySelection` draft.
4. `pages/secondary/PathwayCounsellorWorkbench.jsx` — learner search, scoring breakdown,
   note feed, recommendation refresh, unlock button.
5. Class-wide pathway distribution chart (reuse recharts, same pattern as ParentPortalResults).
6. Notifications: note added → student + parent; selection unlocked → student.

**Deliverable:** Counsellor has a single screen where they see all signals for a learner,
record their professional recommendation, and control when the student can make their selection.

---

### Phase 4 — Student-initiated subject selection

**Goal:** Student can submit their own subject combination selection.

Tasks:
1. `POST /api/pathway-planner/learners/:learnerId/selection` — delegates to
   `validateSeniorPathwaySelection` + `saveLearnerPathwaySelection` with ownership check.
   Only allowed if counsellor has unlocked. Only pathway + combination rule (not raw subject IDs)
   to keep it simple for students.
2. Step 4 in `PathwayPlanner.jsx` — subject preference expression:
   Show available combinations for their recommended pathway; let student pick one.
3. Selection status indicator in all stakeholder views.
4. Notification: student submits → counsellor notified.

**Deliverable:** Student makes their selection through the app. Counsellor sees it.

---

### Phase 5 — Senior school matching and shortlist

**Goal:** System suggests schools. Student and parent build a shortlist. Final plan is documented.

Tasks:
1. Seed `SeniorSchool` catalogue (minimal: 50–100 Kenyan secondary schools, county + pathway).
2. `GET /api/pathway-planner/senior-schools` with filters.
3. Simple matching: filter by `pathwayCodes contains selectedPathway + county preference`.
4. `LearnerSchoolPreference` CRUD + `pages/parent-portal/ParentPortalSchools.jsx`.
5. School profile step added to `PathwayPlanner.jsx` (Step 5).
6. Counsellor can endorse or add schools to the shortlist from the workbench.
7. School admin can claim/update their `SeniorSchool` profile.

**Deliverable:** Student and parent build a ranked school shortlist. Counsellor sees and can
endorse it. The full journey from results → recommendation → career → subjects → schools is
connected end to end.

---

### Phase 6 — Polish, reports, and approvals

**Goal:** The planner is production-ready with PDF exports and formal approval flow.

Tasks:
1. PDF export of the final pathway plan (pathway + subjects + careers + school shortlist + counsellor note).
2. Admin approval and locking of selections via the existing `LearnerPathwaySelection` workflow.
3. Bulk class view for school admin — which students are at which stage.
4. Career catalogue admin UI for super-admin.
5. Full accessibility pass on all new screens.
6. Terminology glossary update (extend `ASSESSMENT_TERMINOLOGY.md`).

---

## 12. Questions and Assumptions Requiring Product Decisions

**Q1 — COUNSELLOR role**
Should a new `COUNSELLOR` role be added to `USER_ROLES`? If yes, it needs its own permissions,
dashboard entry point, and user management UI. If no, `HEAD_OF_CURRICULUM` plays the counsellor
role — simpler but reduces clarity.
*Assumption: HEAD_OF_CURRICULUM is used as proxy until confirmed otherwise.*

**Q2 — Student-initiated vs. admin-assigned selection**
Should a student be able to initiate their own `LearnerPathwaySelection`, or should staff
always be the one to create it and the student only confirm?
*Assumption: student can initiate once counsellor unlocks.*

**Q3 — Grade 10–12 recommendation**
The current AI recommendation service restricts to Grade 7–9. Should Grade 10–12 students
(already in senior secondary) be able to get a re-recommendation? If yes, needs a
grade-agnostic scoring path.
*Assumption: weighted scoring (non-AI) is available for all grades; AI-backed for Grade 7–9 only.*

**Q4 — Two pathway systems**
Should the legacy `LearnerSubjectSelection` system be deprecated once the new
`LearnerPathwaySelection` system is fully adopted? If yes, when and how (migration script)?
*Assumption: both coexist in Phase 1–3; deprecation plan deferred until Phase 6.*

**Q5 — Career catalogue ownership**
Is the career catalogue global (managed by Trendscore super-admin) or per-school?
*Assumption: global catalogue, school-agnostic.*

**Q6 — Senior school catalogue**
Is the school catalogue global (all Kenyan secondary schools) or school-contributed?
Where does the initial data come from (KNEC list, manual entry)?
*Assumption: global catalogue seeded by super-admin from available public KNEC data.*

**Q7 — Parent preference in scoring**
Should a parent's `parentPreference` saved in the parent portal automatically feed into the
weighted scoring recalculation, or does the counsellor trigger that manually?
*Assumption: parent saving a preference does NOT auto-recalculate — counsellor triggers refresh.*

**Q8 — Module gating**
Should `pathway-planner` be a separate purchasable app module, or included with the existing
`exams` / `gradebook` modules for SECONDARY institution types?
*Assumption: separate `pathway-planner` module slug for flexibility.*

**Q9 — Privacy: student sees parent preference**
Should a student see what preference their parent expressed? (Could create family conflict.)
*Assumption: student sees parent preference label but not before counsellor has reviewed.*

**Q10 — Subject combination vs. free selection**
The current rule engine validates against pre-approved `SubjectCombinationRule` triplets.
Should students pick from the approved list only, or freely choose 3 optional subjects
(and the engine checks validity)? Free selection is more flexible but harder to guide.
*Assumption: guided — student picks from approved combinations, not raw subjects.*

---

*This report is discovery-only. No files have been modified.*  
*Ready for product review before Phase 0 implementation begins.*
