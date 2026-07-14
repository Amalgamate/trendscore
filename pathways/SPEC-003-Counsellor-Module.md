# SPEC-003 — Counsellor Module

## 1. Purpose

This specification defines the counsellor-facing workspace for reviewing learner evidence, guiding decisions, documenting interventions, and approving or returning pathway plans.

The module must reuse existing TrendScore authentication, learner records, school tenancy, assessment data, recommendations, notes, notifications, reporting, and audit services.

It must not create duplicate learner, school, recommendation, or user models.

---

## 2. Product Outcome

The counsellor should be able to:

```text
Open Counsellor Workspace
→ View assigned learners and priority cases
→ Review recommendation evidence
→ Review learner and parent preferences
→ Add counselling notes
→ Recommend actions or alternatives
→ Review subject combinations and school matches
→ Approve, return, or escalate a decision plan
→ Track follow-up and completion
```

---

## 3. Role and Access

Introduce or formalize a `COUNSELLOR` role if the existing authorization model supports role extension.

A counsellor may access a learner only when:

- assigned directly to the learner;
- assigned to the learner's class, grade, or school;
- granted access by a school administrator;
- operating within the correct tenant;
- any required consent and privacy conditions are satisfied.

A counsellor may not:

- alter raw assessment results;
- alter academic results;
- change parent or learner identities;
- modify national reference data;
- bypass tenant boundaries;
- lock plans outside authorized workflow rules.

All access checks must be enforced server-side.

---

## 4. Navigation

Primary navigation label:

```text
Counsellor Workspace
```

Recommended route group:

```text
/counsellor
/counsellor/learners
/counsellor/learners/:learnerId
/counsellor/reviews
/counsellor/interventions
/counsellor/sessions
/counsellor/reports
```

Use existing routing conventions where available.

---

## 5. Dashboard

### Required Widgets

1. Learners awaiting review
2. Learners requiring intervention
3. Parent-student disagreement cases
4. Low-confidence recommendations
5. Overdue counselling actions
6. Upcoming sessions
7. Approval progress
8. Pathway distribution
9. Subject combination demand
10. School matching completion

### Priority Categories

```text
URGENT
HIGH
NORMAL
LOW
```

Priority may be driven by:

- low recommendation confidence;
- parent revision request;
- learner indecision;
- missing subject combination;
- no eligible school matches;
- conflicting evidence;
- upcoming deadline;
- safeguarding or support concern.

Safeguarding concerns must follow separate school procedures and permissions.

---

## 6. Learner Review Workspace

### Required Sections

- learner profile;
- school, class, and grade;
- assessment summary;
- academic trends;
- current recommendation;
- recommendation confidence;
- evidence breakdown;
- learner interests;
- learner-saved careers;
- parent preferences;
- teacher observations;
- subject combination options;
- school shortlist;
- decision lifecycle;
- counselling notes;
- action plan;
- approval history;
- audit history.

### Required Actions

- add counselling note;
- create action item;
- recommend career exploration;
- recommend subject combination;
- flag concern;
- request learner revision;
- request parent review;
- approve decision;
- escalate to school administrator;
- schedule follow-up.

---

## 7. Counselling Notes

### Note Types

```text
GENERAL
ACADEMIC
CAREER
PATHWAY
SUBJECT_COMBINATION
SCHOOL_SELECTION
PARENT_DISCUSSION
INTERVENTION
FOLLOW_UP
```

### Visibility

```text
COUNSELLOR_ONLY
LEARNER_VISIBLE
PARENT_VISIBLE
SCHOOL_TEAM_VISIBLE
```

### Note Requirements

Each note must include:

- author;
- learner;
- note type;
- content;
- visibility;
- timestamp;
- edit history;
- optional linked decision, career, combination, or school.

Deleted notes should be soft-deleted where existing platform policy allows.

---

## 8. Counselling Sessions

### Session States

```text
REQUESTED
SCHEDULED
COMPLETED
CANCELLED
NO_SHOW
FOLLOW_UP_REQUIRED
```

### Session Fields

- learner;
- parent participants;
- counsellor;
- scheduled date and time;
- location or online link;
- purpose;
- outcome summary;
- next actions;
- follow-up date;
- visibility.

Integrate with existing scheduling or calendar capabilities where available.

---

## 9. Review Workflow

### Review States

```text
NOT_STARTED
IN_REVIEW
AWAITING_LEARNER
AWAITING_PARENT
REVISION_REQUIRED
APPROVED
ESCALATED
LOCKED
```

### Approval Requirements

Before approval, the counsellor must review:

- pathway;
- track;
- subject combination;
- career interests;
- learner statement;
- parent review status;
- school shortlist;
- recommendation evidence;
- unresolved warnings.

### Return for Revision

A revision request must include:

- reason category;
- explanation;
- affected section;
- required action;
- optional due date.

It must create:

- audit record;
- notification to learner;
- notification to parent when relevant;
- updated workflow state.

---

## 10. Intervention Queue

### Intervention Types

- low confidence;
- academic mismatch;
- interest mismatch;
- parent-student conflict;
- no valid combination;
- no eligible school;
- incomplete assessment;
- repeated indecision;
- missed deadline;
- support need.

### Queue Features

- filter by school, grade, class, pathway, priority, and status;
- bulk assign counsellors;
- set due dates;
- mark resolved;
- export summary;
- track intervention outcomes.

Bulk actions must be permission-controlled and audited.

---

## 11. Reports

### Required Reports

- pathway distribution;
- track distribution;
- subject combination demand;
- parent participation;
- learner completion;
- counsellor workload;
- intervention outcomes;
- approval turnaround time;
- unresolved cases;
- school shortlist trends.

Reports should support filters by:

- school;
- academic year;
- grade;
- class;
- counsellor;
- pathway;
- status.

Exports must use existing reporting infrastructure.

---

## 12. Notifications

Events:

- learner assigned;
- review requested;
- parent requested counselling;
- revision response received;
- session scheduled;
- session reminder;
- overdue action;
- learner submitted plan;
- parent approved;
- approval deadline approaching.

Use existing notification preferences and channels.

---

## 13. API Requirements

Kiro must inspect existing routes and services before creating new endpoints.

Expected capabilities:

```text
GET    /counsellor/dashboard
GET    /counsellor/learners
GET    /counsellor/learners/:learnerId
POST   /counsellor/learners/:learnerId/notes
PATCH  /counsellor/notes/:noteId
POST   /counsellor/learners/:learnerId/actions
POST   /counsellor/learners/:learnerId/sessions
PATCH  /counsellor/sessions/:sessionId
POST   /counsellor/learners/:learnerId/approve
POST   /counsellor/learners/:learnerId/request-revision
POST   /counsellor/learners/:learnerId/escalate
GET    /counsellor/reports
```

Final route structure must match repository conventions.

---

## 14. Analytics

Track:

- learner opened;
- note added;
- intervention created;
- session scheduled;
- revision requested;
- decision approved;
- decision escalated;
- case resolved;
- report exported.

Analytics must not expose sensitive note content.

---

## 15. Testing Requirements

### Unit Tests

- counsellor assignment checks;
- tenant isolation;
- note visibility;
- approval authorization;
- revision validation;
- escalation rules.

### Integration Tests

- dashboard aggregation;
- learner review loading;
- notification creation;
- audit logging;
- report filters;
- session lifecycle.

### End-to-End Tests

1. Assigned counsellor reviews learner
2. Unassigned counsellor denied
3. Counsellor adds private note
4. Counsellor adds learner-visible note
5. Counsellor requests revision
6. Counsellor approves decision
7. Counsellor escalates case
8. Counsellor handles multiple learners

---

## 16. Acceptance Criteria

The specification is complete when:

- counsellors can access only authorized learners;
- the workspace surfaces high-priority cases;
- counsellors can document guidance without altering source evidence;
- notes respect visibility settings;
- reviews follow the approved lifecycle;
- approvals and revisions are audited;
- existing TrendScore services are reused;
- no duplicate learner, school, or recommendation models are introduced.
