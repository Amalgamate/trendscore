# SPEC-002 — Parent Module

## 1. Purpose

This specification defines the parent-facing Pathway Decision Centre experience.

The module enables parents or guardians to review recommendations, provide practical family preferences, compare options, participate in discussions, and approve or request revision of a learner decision plan.

The parent experience must be distinct from the student experience.

---

## 2. Product Outcome

The parent should be able to:

```text
Open My Child's Future
→ Review the learner recommendation
→ Understand the evidence
→ Add family preferences and constraints
→ Review careers and subject combinations
→ Compare senior schools
→ Comment on the learner plan
→ Approve or request revision
→ View counsellor guidance
```

---

## 3. Navigation

Primary navigation label:

```text
My Child's Future
```

Recommended route group:

```text
/parent/children/:learnerId/future
/parent/children/:learnerId/future/pathway
/parent/children/:learnerId/future/preferences
/parent/children/:learnerId/future/careers
/parent/children/:learnerId/future/combinations
/parent/children/:learnerId/future/schools
/parent/children/:learnerId/future/decision
```

Use existing parent-child routing conventions if already present.

---

## 4. Access Rules

A parent may access a learner only when:

- the authenticated user has an active verified parent or guardian relationship;
- the learner belongs to a tenant the parent is authorized to access;
- the relationship is not expired, revoked, or pending;
- required consent and privacy rules are satisfied.

A parent may not:

- view unrelated learners;
- edit assessment results;
- edit teacher observations;
- modify pathway scores;
- modify counsellor notes;
- change official reference data;
- lock a decision unless explicitly permitted by workflow rules.

All relationship checks must be server-side.

---

## 5. Parent Dashboard

### Route

```text
/parent/children/:learnerId/future
```

### Required Cards

1. Learner recommendation
2. Recommendation confidence
3. Learner preferred careers
4. Preferred subject combination
5. Saved schools
6. Family preferences completion
7. Counsellor status
8. Decision status
9. Next parent action

### Parent Actions

- Review recommendation
- Add or update family preferences
- Compare careers
- Compare combinations
- Compare schools
- Add comments
- Approve
- Request revision
- Contact or request counsellor guidance

---

## 6. Recommendation Review

### Required Content

- primary recommended pathway;
- alternative pathways;
- recommendation confidence;
- explanation in parent-friendly language;
- academic evidence;
- competency evidence;
- interest evidence;
- teacher observations;
- parent contribution status;
- learner concerns or preferences;
- areas needing improvement.

### Rules

- raw scoring formulas should not be the primary presentation;
- parents must see why a recommendation was made;
- uncertainty must be visible;
- any conflict between learner interests and academic evidence must be explained neutrally.

---

## 7. Family Preferences

### Route

```text
/parent/children/:learnerId/future/preferences
```

### Preference Categories

- preferred counties;
- preferred sub-counties;
- maximum travel distance;
- day or boarding;
- public or private;
- gender category;
- affordability range;
- special support needs;
- accessibility requirements;
- family priorities;
- faith preference, optional;
- notes for counsellor;
- non-negotiable constraints;
- flexible preferences.

### Data Classification

Each preference must be tagged as:

```text
REQUIRED
PREFERRED
OPTIONAL
```

This distinction is required for the school matching engine.

### Privacy

Sensitive family or support information must be protected and shown only to authorized roles.

---

## 8. Parent Career Review

Parents can:

- view careers saved by the learner;
- review education routes;
- view related careers;
- add comments;
- save additional careers for discussion;
- mark a career as supported, uncertain, or needing counselling.

Parents cannot remove the learner's saved career without an auditable action and product-approved rule.

---

## 9. Subject Combination Review

Parents can:

- view the learner's preferred combinations;
- understand supported careers;
- view academic readiness;
- view school availability;
- compare combinations;
- comment;
- support or request review.

The parent must see warnings when:

- a combination is not offered by the current school;
- a combination restricts a selected career;
- academic readiness is low;
- school availability is limited.

---

## 10. School Comparison

### Route

```text
/parent/children/:learnerId/future/schools
```

### Parent Filters

- location;
- distance;
- day or boarding;
- affordability;
- gender;
- public or private;
- support needs;
- pathway;
- subject combination;
- verification status.

### Comparison Fields

- school name;
- location;
- school type;
- accommodation;
- gender;
- matched combination;
- verification status;
- estimated affordability classification;
- family preference compatibility;
- learner fit explanation;
- known data gaps;
- last verification date.

Do not represent community-reported fees or facilities as official facts.

---

## 11. Parent Comments and Discussion

Parents may add comments to:

- pathway recommendation;
- career choices;
- subject combination;
- school shortlist;
- final decision plan.

Comments must record:

- author;
- timestamp;
- context;
- visibility;
- edit history.

Visibility options:

```text
LEARNER_AND_PARENT
COUNSELLOR_VISIBLE
SCHOOL_TEAM_VISIBLE
PRIVATE_PARENT_NOTE
```

Visibility must follow existing privacy capabilities.

---

## 12. Decision Review

### Route

```text
/parent/children/:learnerId/future/decision
```

### Parent Outcomes

```text
APPROVED
REVISION_REQUESTED
NEEDS_COUNSELLING
NOT_REVIEWED
```

### Approval Requirements

Before approving, the parent should review:

- selected pathway;
- track;
- subject combination;
- selected careers;
- school shortlist;
- learner statement;
- recommendation explanation;
- counsellor status.

### Revision Request

A revision request must include:

- category;
- explanation;
- affected selection;
- optional suggested alternative.

It must create:

- audit record;
- notification to learner;
- notification to counsellor when applicable;
- updated decision state.

---

## 13. Multi-Child Support

The parent module must support parents linked to multiple learners.

Required behavior:

- child selector;
- no cross-child data leakage;
- per-child notification context;
- per-child preference profiles;
- independent decision lifecycles.

---

## 14. Notifications

Events:

- learner recommendation ready;
- learner submitted decision;
- learner requested parent review;
- counsellor added guidance;
- revision requested;
- decision approved;
- decision locked;
- school shortlist changed.

Use existing notification services and preferences.

---

## 15. API Requirements

Kiro must inspect existing parent and learner relationship endpoints before adding new routes.

Expected capabilities:

```text
GET    /parent/learners/:learnerId/pathway-dashboard
GET    /parent/learners/:learnerId/recommendation
GET    /parent/learners/:learnerId/preferences
PUT    /parent/learners/:learnerId/preferences
GET    /parent/learners/:learnerId/careers
POST   /parent/learners/:learnerId/comments
GET    /parent/learners/:learnerId/combinations
GET    /parent/learners/:learnerId/school-matches
GET    /parent/learners/:learnerId/decision-plan
POST   /parent/learners/:learnerId/decision-plan/approve
POST   /parent/learners/:learnerId/decision-plan/request-revision
```

Final routes must follow existing repository standards.

---

## 16. Analytics

Track:

- recommendation viewed;
- preferences completed;
- career reviewed;
- combination compared;
- school compared;
- comment added;
- approval submitted;
- revision requested;
- counsellor support requested.

Analytics must use anonymized or pseudonymized identifiers where possible.

---

## 17. Accessibility and UX

- use plain parent-friendly language;
- explain unfamiliar CBC terms;
- provide contextual help;
- work well on mobile devices;
- make required versus optional preferences clear;
- avoid ranking schools solely by prestige;
- show missing or unverified data clearly.

---

## 18. Testing Requirements

### Unit Tests

- parent-child ownership checks;
- preference validation;
- approval authorization;
- revision request validation;
- multi-child separation.

### Integration Tests

- parent dashboard aggregation;
- learner notification after comment;
- counsellor notification after revision request;
- decision transition after approval;
- audit log creation.

### End-to-End Tests

1. Parent with one learner
2. Parent with multiple learners
3. Parent with pending relationship
4. Parent completes preferences
5. Parent compares schools
6. Parent approves decision
7. Parent requests revision
8. Unauthorized parent access attempt

---

## 19. Acceptance Criteria

The specification is complete when:

- verified parents can access only linked learners;
- the parent experience is distinct from the student interface;
- family preferences influence school matching correctly;
- parents can review, comment, approve, or request revision;
- all sensitive actions are audited;
- multi-child support works;
- parent actions do not alter recommendation scores;
- no duplicate parent or relationship models are introduced.
