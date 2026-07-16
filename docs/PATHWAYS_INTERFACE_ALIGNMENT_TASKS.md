# Pathways Interface Alignment Task List

## Objective

Align the completed Pathways capabilities with the different jobs performed by:

- Primary / Junior School (Grades 7–9): transition planning into senior school.
- Secondary / Senior School (Grades 10–12): pathway execution, progress tracking and intervention.
- System Administration: shared catalogue, rules, data governance and oversight.

This backlog covers interface alignment and operational usability. It does not replace `PATHWAYS_IMPLEMENTATION_PLAN.md`, whose functional implementation checklist is complete.

---

## Phase 1 — Correct Institution Routing and Access (Blocking)

- [x] Remove the `SECONDARY` institution restriction from Grade 7–9 pathway recommendation and transition-decision routes.
- [x] Keep senior-subject execution routes restricted to secondary institutions.
- [x] Add explicit grade eligibility checks to recommendation, selection and tracking controllers.
- [x] Define shared route groups:
  - [x] Transition planning: Primary CBC and authorized cross-institution users.
  - [x] Senior pathway execution: Secondary only.
  - [x] Catalogue administration: System Admin and Admin.
- [ ] Add automated access tests for Primary CBC, Secondary, Student, Parent, Counsellor proxy, Admin and System Admin.
- [x] Verify that unauthorized institution types receive a clear `403` response rather than an empty or broken screen.

### Acceptance checks

- A Grade 7–9 learner can generate and view a recommendation.
- A Grade 10–12 learner can access senior pathway execution.
- A primary learner cannot use senior-subject execution endpoints.
- System Admin can administer both institution experiences.

---

## Phase 2 — Create the Junior Transition Centre (Primary)

- [x] Rename the primary staff module to **Junior Transition Centre**.
- [ ] Create a primary-specific landing dashboard with:
  - [ ] Recommendation coverage.
  - [ ] Learners awaiting assessment evidence.
  - [ ] Parent-review completion.
  - [ ] Career exploration completion.
  - [ ] School-shortlist completion.
  - [ ] Decision Plans needing review or revision.
- [ ] Present the Grade 7–9 learner journey in the correct order:
  - [ ] Strength and assessment evidence.
  - [ ] Pathway recommendation.
  - [ ] Career exploration.
  - [ ] Subject-combination implications.
  - [ ] Senior-school matching.
  - [ ] Saved Options.
  - [ ] Parent and counsellor review.
  - [ ] Transition Decision Plan.
- [x] Show fit-scored school matching to eligible Grade 7–9 learners instead of restricting it to secondary learners.
- [x] Show the Saved Options and Decision Plan workspace to Grade 7–9 learners.
- [x] Add a clear **Find Senior Schools** call to action after pathway and combination evidence is ready.
- [ ] Add readiness messages when recommendation, preferences or combination data are incomplete.
- [ ] Provide staff filters by grade, class, recommendation state and transition readiness.

### Acceptance checks

- A primary learner can complete the journey without entering a secondary-labelled screen.
- School discovery is a primary transition milestone.
- Staff can identify learners who are not ready to make a senior-school decision.

---

## Phase 3 — Create the Senior Pathway Progress Centre (Secondary)

- [x] Rename the secondary staff module to **Senior Pathway Progress Centre**.
- [x] Create a secondary-specific landing dashboard with:
  - [x] Active pathway and track distribution.
  - [x] Combination distribution.
  - [x] Approval and lock status.
  - [x] Action Plan completion.
  - [x] Intervention and escalation counts.
  - [x] Learners at risk of pathway mismatch.
- [x] Reorder the secondary student interface around:
  - [x] Current pathway and track.
  - [x] Current subject combination.
  - [x] Approval/lock state.
  - [x] Progress and readiness evidence.
  - [x] Action Plan.
  - [x] Counselling sessions and interventions visible to the learner.
- [x] Move senior-school matching into a secondary **Previous Decision / Alternatives** section rather than making it a primary dashboard step.
- [x] Clearly distinguish an approved selection from a locked final decision.
- [x] Add revision history and visible reasons for requested changes.
- [ ] Add filters for grade, pathway, track, combination, approval state, action status and intervention priority.

### Acceptance checks

- A secondary learner sees execution and progress before exploration.
- Counsellors can move from overview to a learner case without re-searching.
- School matching remains available when needed but does not dominate the senior experience.

---

## Phase 4 — Make Pathways Administration a First-Class Destination

- [x] Add a dedicated **Pathways Administration** navigation item for System Admin and Admin.
- [x] Remove the requirement to open Pathway Catalogue before finding the Admin Console.
- [x] Split the console into clear sections:
  - [x] Overview.
  - [x] Pathways and tracks.
  - [x] Subject combinations.
  - [x] Careers.
  - [x] Senior schools.
  - [x] Corrections and verification.
  - [x] Recommendation rules.
  - [x] Imports.
  - [x] Data quality.
  - [x] Analytics.
  - [x] Audit logs.
- [x] Replace raw pathway and track ID inputs with searchable selectors.
- [x] Add a visual subject-mapping editor for combinations.
- [ ] Add pathway, track, subject and career mapping controls to the career editor (pathway and track are complete; subject mapping remains).
- [x] Consolidate school profile editing, offerings, verification and corrections into the same school administration area.
- [x] Add publish-impact previews showing affected learners, combinations, schools and matches.
- [x] Add version-history comparison and rollback/re-publish actions.
- [x] Add downloadable CSV templates for supported import domains.
- [x] Improve import preview with row-level validation, duplicates and impact counts before approval.
- [x] Add export controls for data-quality, analytics and audit results.

### Acceptance checks

- System Admin can reach administration directly from navigation.
- No administrator must copy database IDs into a form.
- Published content changes show impact and preserve version history.
- School verification and correction decisions happen in one coherent workspace.

---

## Phase 5 — Parent Experience Alignment

- [ ] For Grade 7–9 parents, present:
  - [ ] Recommendation explanation.
  - [ ] Career review.
  - [ ] Family preferences.
  - [ ] School matches and shortlist.
  - [ ] Combination implications.
  - [ ] Decision Plan review.
- [x] For Grade 10–12 parents, present:
  - [x] Current approved pathway and combination.
  - [x] Progress and Action Plan.
  - [x] Revision or counselling requests.
  - [x] Final approval/lock state.
- [x] Replace separate, disconnected Pathway and School Shortlist entry points with linked steps in one journey.
- [x] Preserve direct School Shortlist access as a shortcut for primary parents.
- [x] Add clear explanations that fit scores are guidance, not admission probabilities.

### Acceptance checks

- [x] Parent screens adapt to the child’s grade and institution stage.
- [x] Parents can move from recommendation to school shortlist without returning to the portal home.
- [x] Senior parents are not prompted to repeat completed transition decisions.

---

## Phase 6 — Navigation, Language and Visual Consistency

- [ ] Replace `sec-*` terminology in user-facing primary navigation.
- [ ] Keep internal route IDs stable where possible to avoid unnecessary routing regressions.
- [ ] Use stage-appropriate labels:
  - [ ] Primary: Explore, Prepare, Compare, Decide.
  - [ ] Secondary: Track, Review, Improve, Complete.
- [ ] Standardize status chips across learner, parent, counsellor and admin interfaces.
- [ ] Standardize empty, loading, error and insufficient-data states.
- [ ] Ensure desktop and mobile interfaces expose the same essential operations.
- [ ] Confirm all new navigation entries respect application-module access and role permissions.

---

## Phase 7 — End-to-End Verification

- [ ] Add a Primary CBC end-to-end scenario:
  - [ ] Recommendation generated.
  - [ ] Careers saved and reviewed.
  - [ ] Family preferences saved.
  - [ ] Schools matched and shortlisted.
  - [ ] Decision Plan submitted and reviewed.
- [ ] Add a Secondary end-to-end scenario:
  - [ ] Existing pathway loaded.
  - [ ] Combination reviewed.
  - [ ] Action assigned and completed.
  - [ ] Counsellor intervention recorded.
  - [ ] Plan approved and locked.
- [ ] Add a System Admin end-to-end scenario:
  - [ ] Create draft content.
  - [ ] Map related records.
  - [ ] Preview impact.
  - [ ] Publish a version.
  - [ ] Verify audit history.
- [ ] Test responsive layouts for student, parent, counsellor and admin screens.
- [ ] Run permission, migration, TypeScript, ESLint and production-build gates.
- [ ] Conduct user-acceptance testing with one primary-school workflow and one secondary-school workflow before deployment.

---

## Recommended Delivery Order

1. Phase 1 — Correct routing and access.
2. Phase 2 — Junior Transition Centre.
3. Phase 4 — First-class System Admin experience.
4. Phase 3 — Senior Pathway Progress Centre.
5. Phase 5 — Parent experience alignment.
6. Phase 6 — Navigation and visual consistency.
7. Phase 7 — End-to-end verification and release readiness.

## Definition of Interface Completion

The interface-alignment work is complete when:

- Primary and secondary users receive different stage-appropriate experiences.
- System Admin has a direct, polished administrative workspace.
- No operational form requires raw database IDs.
- Every major Pathways capability is reachable through navigation.
- Permissions match both role and institution stage.
- Primary, secondary and administrative end-to-end scenarios pass.
