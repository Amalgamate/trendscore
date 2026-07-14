# SPEC-001 — Student Module

## 1. Purpose

This specification defines the student-facing Pathway Decision Centre experience.

The module must reuse existing TrendScore authentication, learner profiles, assessments, academic results, recommendation services, notifications, reports, and audit infrastructure.

It must not create duplicate learner, assessment, pathway, recommendation, school, or authentication models.

---

## 2. Product Outcome

The student should be able to move through the following guided journey:

```text
Open My Future
→ Review pathway recommendation
→ Understand evidence
→ Explore alternative pathways
→ Explore careers
→ Compare approved subject combinations
→ Discover matching senior schools
→ Save preferred options
→ Request parent review
→ Receive counsellor feedback
→ Submit a decision plan
```

---

## 3. Navigation

Primary navigation label:

```text
My Future
```

Recommended route group:

```text
/student/my-future
/student/my-future/pathway
/student/my-future/careers
/student/my-future/combinations
/student/my-future/schools
/student/my-future/saved
/student/my-future/action-plan
/student/my-future/decision
```

Route names must be adapted to the existing routing conventions in the repository.

---

## 4. Access Rules

A student may access the module when:

- the authenticated user is linked to a learner profile;
- the learner belongs to the active tenant or school;
- the learner has permission to access pathway guidance;
- any required assessment has been completed, or the UI clearly shows the missing prerequisite.

A student may not:

- edit recommendation scores;
- change teacher observations;
- modify parent preferences;
- approve the final decision;
- modify official pathways, tracks, combinations, careers, or schools;
- bypass counsellor or parent approval rules.

All ownership checks must be enforced on the server.

---

## 5. Student Dashboard

### Route

```text
/student/my-future
```

### Purpose

Provide a single entry point showing the learner’s current progress.

### Required Cards

1. Current Pathway Recommendation
2. Recommendation Confidence
3. Suggested Careers
4. Subject Combination Progress
5. Saved Schools
6. Parent Review Status
7. Counsellor Review Status
8. Next Recommended Action

### Progress States

```text
NOT_STARTED
ASSESSMENT_REQUIRED
RECOMMENDATION_READY
EXPLORING
AWAITING_PARENT
AWAITING_COUNSELLOR
REVISION_REQUIRED
APPROVED
LOCKED
```

### Empty States

The screen must handle:

- no learner profile;
- incomplete assessment;
- recommendation generation pending;
- recommendation generation failed;
- no careers mapped;
- no school matches;
- final plan already locked.

---

## 6. Pathway Recommendation Screen

### Route

```text
/student/my-future/pathway
```

### Required Content

- primary recommended pathway;
- recommended track;
- fit score or confidence label;
- summary explanation;
- evidence categories;
- academic strengths;
- competency signals;
- interest signals;
- teacher contribution;
- parent contribution;
- areas requiring improvement;
- alternative pathway options;
- recommendation version and generated date.

### Explanation Rules

The UI must not expose raw internal weighting unless product configuration explicitly allows it.

Prefer:

```text
High confidence
Supported by strong academic, competency and interest evidence.
```

Avoid:

```text
Academic 50% + Competency 20% + Interest 15%.
```

### Required Actions

- Explore this pathway
- Compare alternatives
- View careers
- View subject combinations
- Ask for guidance
- Continue to action plan

---

## 7. Career Explorer

### Route

```text
/student/my-future/careers
```

### Features

- browse recommended careers;
- search careers;
- filter by pathway, track, career family, education route, and skill profile;
- save careers;
- compare up to three careers;
- view related careers;
- view degree, diploma, certificate, artisan, and TVET routes when available;
- view recommended subjects;
- view alternative routes.

### Career Card

Each card should include:

- title;
- short description;
- career family;
- recommended pathway;
- relevant subject combinations;
- matched learner strengths;
- saved state.

### Career Detail

Must include:

- overview;
- typical activities;
- skills;
- recommended pathway;
- recommended track;
- required or preferred subjects;
- tertiary routes;
- TVET routes;
- alternative careers;
- learner fit explanation;
- data source and last verification date.

---

## 8. Subject Combination Planner

### Route

```text
/student/my-future/combinations
```

### Features

- list approved combinations compatible with the selected pathway and track;
- explain the careers supported by each combination;
- show careers that may become restricted;
- show whether the current school offers the required subjects;
- show academic readiness;
- save preferred combinations;
- compare combinations;
- submit a preferred combination for review.

### Combination States

```text
AVAILABLE
RECOMMENDED
SAVED
SUBMITTED
APPROVED
REJECTED
UNAVAILABLE_AT_CURRENT_SCHOOL
```

### Validation

The server must validate combinations using the existing combination validation engine.

The frontend must never be the authoritative validator.

---

## 9. Senior School Discovery

### Route

```text
/student/my-future/schools
```

### Filters

- county;
- sub-county;
- school gender;
- day or boarding;
- public or private;
- pathway;
- track;
- subject combination;
- special support;
- family preference compatibility;
- verification status.

### Results

Group recommendations into:

- Strong Match
- Good Match
- Local Option
- Alternative Option

Do not show admission probability unless the system has verified placement data and a documented predictive model.

Use fit language, not certainty language.

### School Card

- school name;
- county and sub-county;
- school type;
- accommodation;
- gender;
- matched pathway;
- matched combination;
- fit explanation;
- verification status;
- last verified date;
- save action;
- compare action.

---

## 10. Saved Options

### Route

```text
/student/my-future/saved
```

The student may save:

- pathways;
- careers;
- subject combinations;
- schools.

Saved entities must be unique per learner.

The student must be able to:

- remove a saved item;
- add notes;
- prioritize items;
- share selected items with the parent or counsellor;
- view why the item was saved.

---

## 11. Action Plan

### Route

```text
/student/my-future/action-plan
```

### Purpose

Translate recommendations into concrete next steps.

### Action Types

- complete an assessment;
- improve a learning area;
- explore a career;
- compare combinations;
- shortlist schools;
- request parent feedback;
- book or request counselling;
- submit decision plan.

### Action Status

```text
PENDING
IN_PROGRESS
COMPLETED
DISMISSED
OVERDUE
```

Actions may be created by:

- system rules;
- AI explanation service;
- counsellor;
- student.

AI-generated actions must be distinguishable from counsellor-created actions.

---

## 12. Decision Plan

### Route

```text
/student/my-future/decision
```

### Required Data

- selected pathway;
- selected track;
- preferred subject combination;
- preferred careers;
- shortlisted schools;
- learner statement;
- supporting evidence;
- parent review status;
- counsellor review status;
- decision lifecycle state.

### Lifecycle

```text
DRAFT
SUBMITTED
PARENT_REVIEWED
COUNSELLOR_REVIEWED
APPROVED
LOCKED
REVISION_REQUIRED
```

### Submission Rules

A learner may submit only when required fields are complete.

Submission must create:

- audit log;
- notification to parent;
- notification to counsellor when applicable;
- immutable submission snapshot.

---

## 13. Notifications

Events:

- recommendation ready;
- recommendation updated;
- parent comment received;
- counsellor comment received;
- action assigned;
- review requested;
- revision required;
- decision approved;
- decision locked.

Use existing notification services.

---

## 14. API Requirements

Kiro must inspect existing endpoints before adding new ones.

Expected capabilities:

```text
GET    /student/pathway-dashboard
GET    /student/pathway-recommendation
GET    /student/careers
POST   /student/careers/:id/save
DELETE /student/careers/:id/save
GET    /student/subject-combinations
POST   /student/subject-combinations/:id/save
GET    /student/school-matches
POST   /student/schools/:id/save
GET    /student/action-plan
PATCH  /student/action-plan/:id
GET    /student/decision-plan
PATCH  /student/decision-plan
POST   /student/decision-plan/submit
```

Final route structure must follow existing repository conventions.

---

## 15. Analytics

Track:

- dashboard opened;
- recommendation viewed;
- pathway alternative compared;
- career saved;
- combination saved;
- school saved;
- parent review requested;
- counsellor review requested;
- decision submitted;
- decision approved.

Analytics must not expose sensitive learner data.

---

## 16. Accessibility and UX

- support keyboard navigation;
- use accessible labels;
- avoid unexplained technical terms;
- display progress clearly;
- support mobile layouts;
- provide calm, supportive language;
- avoid deterministic or alarming wording.

---

## 17. Testing Requirements

### Unit Tests

- student ownership checks;
- recommendation visibility;
- combination validation;
- decision state transitions;
- save/remove behavior.

### Integration Tests

- student dashboard aggregation;
- parent notification on submission;
- counsellor notification;
- audit log creation.

### End-to-End Tests

1. Student with no assessment
2. Student with recommendation
3. Student explores careers
4. Student saves combination
5. Student saves schools
6. Student submits decision
7. Student receives revision request
8. Student reaches approved state

---

## 18. Acceptance Criteria

The specification is complete when:

- the learner can access the module without admin privileges;
- all server-side ownership checks pass;
- existing recommendation logic is reused;
- every recommendation includes an explanation;
- student actions are audited;
- student decisions follow the approved lifecycle;
- mobile and desktop flows work;
- no duplicate learner or recommendation models are introduced.
