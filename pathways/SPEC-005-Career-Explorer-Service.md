# SPEC-005 — Career Explorer Service

## 1. Purpose

This specification defines the career knowledge base, learner-fit logic, career exploration features, tertiary progression routes, career comparison, data governance, and integration with pathway and subject-combination decisions.

The Career Explorer must reuse existing TrendScore learner profiles, assessments, recommendation services, reporting, notifications, and authorization.

It must not replace the pathway recommendation engine.

---

## 2. Product Outcome

The Career Explorer should help learners answer:

```text
What careers fit me?
→ Why do they fit?
→ Which pathway supports them?
→ Which subject combinations preserve them?
→ Which university or TVET routes are available?
→ What alternatives exist?
```

---

## 3. Core Principles

- Career recommendations must be explainable.
- Career exploration must remain broader than a single job title.
- University and TVET routes must be treated as valid progression options.
- Missing data must be visible.
- Career content must be versioned and sourced.
- Career suggestions must not override learner choice.
- AI may summarize and personalize, but structured rules remain authoritative.

---

## 4. Career Domain Model

Expected entities or relations:

```text
Career
CareerFamily
CareerSkill
CareerTask
CareerInterestProfile
CareerCompetencyProfile
CareerPathwayMapping
CareerTrackMapping
CareerSubjectCombinationMapping
CareerEducationRoute
CareerInstitutionRoute
CareerAlternative
CareerDataSource
CareerVerification
LearnerCareerPreference
LearnerCareerMatch
CareerComparison
```

Names must follow existing repository conventions.

---

## 5. Career Record

Each career should support:

- official or canonical title;
- alternative titles;
- career family;
- short summary;
- full description;
- typical activities;
- work environments;
- key skills;
- competencies;
- interest profile;
- recommended pathway;
- recommended track;
- required subjects;
- preferred subject combinations;
- university routes;
- TVET routes;
- certificate or artisan routes;
- alternative careers;
- progression opportunities;
- labour-market notes;
- source;
- verification status;
- last verified date;
- effective date;
- retired status.

---

## 6. Career Verification

Statuses:

```text
DRAFT
UNVERIFIED
SOURCE_VERIFIED
TREND_SCORE_VERIFIED
STALE
DISPUTED
RETIRED
```

Rules:

- every published career must have at least one source;
- changes must be versioned;
- stale careers remain visible with a warning if product policy allows;
- disputed content must not be treated as authoritative;
- retired careers may remain available for historical reporting.

---

## 7. Learner Career Match

Career fit may consider:

- pathway recommendation;
- academic performance;
- competency profile;
- interest profile;
- teacher observations;
- parent observations;
- learner-saved careers;
- counsellor guidance;
- subject readiness.

Expected match output:

```text
careerId
learnerId
fitScore
confidence
matchedStrengths[]
developmentAreas[]
supportedPathways[]
recommendedCombinations[]
warnings[]
scoreVersion
generatedAt
```

---

## 8. Career Fit Rules

The service should use configurable rules.

Example factor groups:

```text
Interest alignment
Competency alignment
Academic readiness
Pathway alignment
Subject readiness
Learner preference
Counsellor guidance
Data confidence
```

The UI should present a plain-language explanation rather than raw internal weights.

---

## 9. Career Recommendation Buckets

```text
STRONG_FIT
GOOD_FIT
EXPLORE
ASPIRATIONAL
ALTERNATIVE
INSUFFICIENT_DATA
```

These buckets must not be presented as deterministic career outcomes.

---

## 10. Career Search

Required search and filters:

- career title;
- career family;
- pathway;
- track;
- subject;
- subject combination;
- education route;
- skill;
- interest type;
- work environment;
- verification status.

Search should support both personalized and non-personalized use.

---

## 11. Career Detail

Required sections:

1. Overview
2. What the work involves
3. Skills and competencies
4. Recommended pathway
5. Tracks
6. Subject combinations
7. Academic preparation
8. University routes
9. TVET and alternative routes
10. Related careers
11. Learner fit explanation
12. Data sources
13. Last verified date

---

## 12. Career Comparison

Allow comparison of up to a configurable number of careers.

Comparison fields:

- career family;
- pathway;
- track;
- subjects;
- subject combinations;
- tertiary routes;
- skills;
- work environment;
- learner fit;
- confidence;
- development areas;
- alternatives.

Unknown values must be shown as unknown.

---

## 13. Saved Careers

Learners and authorized parents may save careers.

Expected fields:

- learner;
- career;
- saved by;
- priority;
- note;
- support status;
- created date;
- updated date.

Support statuses:

```text
LEARNER_INTERESTED
PARENT_SUPPORTS
PARENT_UNCERTAIN
COUNSELLOR_RECOMMENDS
UNDER_DISCUSSION
REMOVED
```

---

## 14. Education Routes

Each career may link to multiple routes:

```text
DEGREE
DIPLOMA
CERTIFICATE
ARTISAN
TVET
APPRENTICESHIP
OTHER
```

Each route should support:

- route type;
- qualification title;
- minimum subject expectations;
- relevant subject combination;
- example institutions;
- duration;
- progression options;
- source;
- verification.

Institution examples must not be interpreted as guarantees of admission.

---

## 15. Career-to-Combination Impact

For each career and subject combination, the system should classify:

```text
STRONGLY_SUPPORTS
SUPPORTS
POSSIBLE_WITH_CONDITIONS
MAY_RESTRICT
NOT_RECOMMENDED
UNKNOWN
```

This supports the Career Door Analysis used in subject-combination decisions.

---

## 16. AI Usage

AI may:

- summarize career descriptions;
- personalize explanations;
- generate discussion questions;
- suggest related careers;
- explain differences between routes.

AI may not:

- invent admission requirements;
- invent institutions;
- override structured mappings;
- represent labour-market predictions as fact;
- hide uncertainty.

All AI-generated content must be auditable and clearly derived from structured source data where possible.

---

## 17. APIs

Kiro must inspect existing services and routes first.

Expected capabilities:

```text
GET    /careers
GET    /careers/:careerId
GET    /learners/:learnerId/career-matches
POST   /learners/:learnerId/career-matches/recalculate
GET    /learners/:learnerId/saved-careers
POST   /learners/:learnerId/saved-careers
PATCH  /learners/:learnerId/saved-careers/:id
DELETE /learners/:learnerId/saved-careers/:id
GET    /careers/compare
GET    /admin/careers
POST   /admin/careers
PATCH  /admin/careers/:careerId
POST   /admin/careers/:careerId/publish
POST   /admin/careers/:careerId/retire
```

Final route naming must match repository conventions.

---

## 18. Background Jobs

Potential jobs:

- stale content detection;
- career match recalculation;
- re-indexing search;
- missing mapping detection;
- source verification reminders;
- duplicate career detection;
- AI summary regeneration after structured data changes.

---

## 19. Performance

- paginate career search;
- index career family, pathway, track, verification, and route type;
- cache published career content;
- invalidate caches after publish or retire;
- avoid recalculating matches when learner inputs have not changed;
- store input hash and score version.

---

## 20. Security and Privacy

- public career content may be accessible according to product policy;
- personalized career matches require authorized learner access;
- parent and counsellor access must pass relationship checks;
- learner notes are private by default;
- administrative changes must be audited;
- sensitive learner evidence must not be exposed in public career endpoints.

---

## 21. Testing Requirements

### Unit Tests

- career match factors;
- confidence calculation;
- combination impact classification;
- save and remove behavior;
- versioning;
- publish and retire rules.

### Integration Tests

- learner match generation;
- personalized explanation;
- search and filters;
- education routes;
- audit logs;
- stale career detection.

### End-to-End Tests

1. Learner receives career matches
2. Learner compares careers
3. Learner saves a career
4. Parent reviews saved career
5. Counsellor recommends an alternative
6. Admin publishes a career
7. Stale career displays warning
8. Unauthorized learner match request is denied

---

## 22. Acceptance Criteria

The specification is complete when:

- career data is structured, sourced, and versioned;
- learner career fit is explainable;
- university and TVET routes are supported;
- career-to-combination impact is visible;
- users can search, compare, and save careers;
- AI does not override authoritative mappings;
- personalized data is protected;
- no duplicate learner or recommendation models are introduced.
