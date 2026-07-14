# SPEC-004 — School Matching Service

## 1. Purpose

This specification defines the senior school directory, eligibility filtering, fit scoring, recommendation explanations, verification workflow, comparison features, and school shortlist services.

The service must remain explainable and must not claim admission probability unless TrendScore later acquires sufficient verified placement and capacity data.

---

## 2. Product Outcome

The service should transform learner and family information into a realistic shortlist:

```text
Learner recommendation
→ Selected pathway
→ Selected track
→ Approved subject combination
→ Hard eligibility filters
→ Family preference filters
→ Fit scoring
→ Recommendation explanation
→ Dream / Target / Safe / Local shortlist
```

---

## 3. Core Principles

- Eligibility filtering happens before scoring.
- Official data and community-reported data must be clearly separated.
- Every recommendation must include reasons.
- Missing or stale data must reduce confidence.
- Fit score is not admission probability.
- The learner and parent can explore alternatives.
- Final decisions remain human-controlled.

---

## 4. School Data Model

The service should extend any existing school model rather than duplicate it.

Expected school attributes:

- official name;
- official code;
- county;
- sub-county;
- ward, optional;
- latitude and longitude, optional;
- public or private;
- gender category;
- day, boarding, or mixed accommodation;
- school cluster or category;
- special support capabilities;
- contact details;
- pathways offered;
- tracks offered;
- subject combinations offered;
- facilities;
- fee or affordability band;
- verification status;
- verification source;
- verified by;
- last verified date;
- effective date;
- retirement or closure status.

---

## 5. Related Entities

Expected entities or relations:

```text
SeniorSchool
SchoolOffering
SchoolPathway
SchoolTrack
SchoolSubjectCombination
SchoolFacility
SchoolVerification
SchoolDataSource
SchoolCorrectionRequest
LearnerSchoolPreference
ParentSchoolPreference
SchoolMatch
SchoolShortlist
SchoolComparison
```

Names must be adapted to the existing schema.

---

## 6. Verification Status

```text
UNVERIFIED
MINISTRY_LISTED
SCHOOL_CONFIRMED
TREND_SCORE_VERIFIED
COMMUNITY_REPORTED
STALE
DISPUTED
RETIRED
```

### Verification Rules

- official source data must retain source reference;
- school-confirmed changes require authorized school personnel;
- community reports must never overwrite verified official values directly;
- disputed fields require review;
- stale records remain visible with warnings where appropriate;
- every change must be auditable.

---

## 7. Data Sources

The platform must distinguish:

- official government data;
- school-submitted data;
- TrendScore verification;
- community-reported data;
- inferred or calculated data.

Each field may require its own provenance rather than a single school-level source.

---

## 8. Eligibility Filtering

A school is ineligible when any hard constraint fails.

### Hard Constraints

- selected subject combination not offered;
- selected pathway not offered;
- gender category incompatible;
- required accommodation unavailable;
- school retired or closed;
- required special support unavailable;
- parent marks a constraint as non-negotiable;
- data is too incomplete for a safe recommendation, when configured.

### Soft Constraints

- preferred county;
- distance;
- affordability;
- school type;
- facility preferences;
- faith preference;
- local preference;
- learner interest.

Soft constraints influence fit score but do not automatically exclude unless marked `REQUIRED`.

---

## 9. Fit Score

The initial rules-based score may include:

```text
Subject combination fit
Pathway and track fit
Academic readiness
Career alignment
Learner preference fit
Parent preference fit
Location fit
Accommodation fit
Affordability fit
Support needs fit
Data confidence
```

Weights must be configurable and versioned.

The system must store:

- score;
- score version;
- contributing factors;
- exclusions;
- warnings;
- explanation;
- generated timestamp.

---

## 10. Confidence

Each match should include a confidence level:

```text
HIGH
MEDIUM
LOW
INSUFFICIENT_DATA
```

Confidence depends on:

- freshness of school data;
- verification status;
- completeness of offerings;
- completeness of learner preferences;
- recommendation confidence;
- consistency of subject combination data.

---

## 11. Recommendation Buckets

The service should support:

```text
DREAM
TARGET
SAFE
LOCAL
ALTERNATIVE
```

These are fit and planning categories, not admission guarantees.

Bucket assignment rules must be configurable and explainable.

---

## 12. Recommendation Explanation

Each school match must include:

- why the school matches;
- which pathway and combination are supported;
- which preferences are satisfied;
- which preferences are not satisfied;
- any warnings;
- data confidence;
- verification status;
- last verified date.

Example structure:

```text
Strong fit because the school offers the selected STEM track and subject combination, matches the boarding preference, and falls within the selected counties.

Watch-out: affordability data is community-reported and has not been verified.
```

---

## 13. Search and Filters

Required filters:

- school name;
- county;
- sub-county;
- gender;
- day or boarding;
- public or private;
- pathway;
- track;
- subject combination;
- support capability;
- verification status;
- affordability band;
- distance, where coordinates exist.

Search results must work even when a learner profile is not provided, but personalized ranking requires learner context.

---

## 14. Shortlist

A learner may save schools to a shortlist.

Expected fields:

- learner;
- school;
- rank or priority;
- bucket;
- learner note;
- parent note;
- counsellor note;
- saved by;
- saved date;
- current status.

Shortlist states:

```text
SAVED
UNDER_REVIEW
PREFERRED
REMOVED
APPROVED
```

Duplicate shortlist entries must be prevented.

---

## 15. Comparison

Users should compare up to a configurable number of schools.

Comparison fields:

- pathway;
- track;
- subject combination;
- location;
- school type;
- gender;
- accommodation;
- support;
- facilities;
- affordability band;
- verification;
- fit score;
- fit explanation;
- warnings;
- last verified.

Unknown values must be shown as unknown, not guessed.

---

## 16. School Corrections

Authorized users may submit corrections.

Correction workflow:

```text
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
PUBLISHED
```

Correction requests must include:

- school;
- field;
- current value;
- proposed value;
- evidence;
- submitter;
- source;
- reviewer;
- decision reason.

---

## 17. APIs

Kiro must inspect existing school and recommendation services before adding routes.

Expected capabilities:

```text
GET    /schools
GET    /schools/:schoolId
GET    /learners/:learnerId/school-matches
POST   /learners/:learnerId/school-matches/recalculate
GET    /learners/:learnerId/shortlist
POST   /learners/:learnerId/shortlist
PATCH  /learners/:learnerId/shortlist/:itemId
DELETE /learners/:learnerId/shortlist/:itemId
POST   /schools/:schoolId/corrections
GET    /admin/schools/corrections
POST   /admin/schools/corrections/:id/approve
POST   /admin/schools/corrections/:id/reject
```

Final routes must follow repository conventions.

---

## 18. Background Jobs

Potential jobs:

- stale data detection;
- school verification reminders;
- match recalculation after preference changes;
- match recalculation after school offering changes;
- match recalculation after pathway or combination changes;
- duplicate school detection;
- data quality reports.

Use existing background job infrastructure where present.

---

## 19. Performance

- paginate school searches;
- index pathway, combination, county, accommodation, gender, and verification fields;
- cache reference data where safe;
- avoid recalculating unchanged matches;
- store score version and input hash;
- invalidate cache after school or preference changes.

---

## 20. Security and Privacy

- school search may be public only if product policy allows;
- personalized matches require authorized learner access;
- parent and counsellor access must pass relationship checks;
- sensitive support needs must not be exposed in public queries;
- correction evidence must be access-controlled;
- all administrative changes must be audited.

---

## 21. Testing Requirements

### Unit Tests

- hard exclusions;
- soft preference scoring;
- confidence calculation;
- bucket assignment;
- versioned score behavior;
- duplicate shortlist prevention.

### Integration Tests

- match generation;
- preference update recalculation;
- school offering update recalculation;
- correction workflow;
- audit logs;
- access checks.

### End-to-End Tests

1. Learner with valid combination receives matches
2. Learner with impossible combination receives explanation
3. Parent marks boarding as required
4. Parent marks county as preferred
5. Counsellor reviews shortlist
6. School data becomes stale
7. Correction is submitted and approved
8. Unauthorized personalized match request is denied

---

## 22. Acceptance Criteria

The specification is complete when:

- school data has provenance and verification status;
- hard constraints filter before scoring;
- fit score is explainable and versioned;
- admission probability is not implied;
- learners and parents can save and compare schools;
- stale and missing data are visible;
- corrections follow review workflow;
- personalized matching respects privacy and tenant boundaries;
- no duplicate school model is introduced.
