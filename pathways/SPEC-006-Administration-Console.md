# SPEC-006 — Administration Console

## 1. Purpose

This specification defines the TrendScore administration console for managing the Pathway Decision Centre knowledge base, recommendation configuration, school verification, career content, imports, publishing, analytics, and operational governance.

The console must integrate with the existing TrendScore super-administration environment.

---

## 2. Product Outcome

Authorized administrators should be able to:

```text
Manage reference data
→ Validate changes
→ Import structured records
→ Review corrections
→ Publish approved updates
→ Monitor data quality
→ Configure recommendation rules
→ Audit changes
→ Track product adoption and outcomes
```

---

## 3. Access Control

Recommended administrative capabilities:

```text
PATHWAY_VIEW
PATHWAY_MANAGE
CAREER_VIEW
CAREER_MANAGE
SCHOOL_VIEW
SCHOOL_MANAGE
SCHOOL_VERIFY
RULES_VIEW
RULES_MANAGE
IMPORT_RUN
IMPORT_APPROVE
CONTENT_PUBLISH
ANALYTICS_VIEW
AUDIT_VIEW
AI_CONFIGURE
```

Permissions should extend the existing authorization framework.

No administrator should receive all permissions automatically unless the existing super-admin model explicitly requires it.

---

## 4. Navigation

Recommended module navigation:

```text
Pathway Decision Centre
├── Dashboard
├── Pathways
├── Tracks
├── Subject Combinations
├── Careers
├── Senior Schools
├── School Offerings
├── Corrections
├── Recommendation Rules
├── AI Configuration
├── Imports
├── Data Quality
├── Analytics
├── Audit Logs
└── Settings
```

---

## 5. Dashboard

Required widgets:

- published pathways;
- active tracks;
- approved combinations;
- verified careers;
- verified schools;
- stale schools;
- disputed records;
- pending corrections;
- pending imports;
- failed imports;
- recommendation generation health;
- match generation health;
- parent participation;
- counsellor approval rate;
- incomplete learner journeys.

---

## 6. Pathways and Tracks

Administrators may:

- create draft records;
- edit draft records;
- version records;
- publish;
- retire;
- schedule an effective date;
- link tracks;
- view usage impact.

Required states:

```text
DRAFT
IN_REVIEW
PUBLISHED
SCHEDULED
RETIRED
```

Published records should not be destructively edited.

---

## 7. Subject Combinations

Required capabilities:

- create and edit combinations;
- assign official code;
- link pathway and track;
- add subjects;
- define required and optional subjects;
- define validation rules;
- map careers;
- map schools;
- version combinations;
- publish and retire;
- view affected learners and schools.

Before publishing a change, the system should display impact analysis.

---

## 8. Career Administration

Administrators may:

- create careers;
- manage career families;
- manage descriptions and skills;
- map pathways, tracks, subjects, and combinations;
- manage tertiary routes;
- add sources;
- verify content;
- publish or retire;
- resolve disputes;
- view learner engagement.

All content changes must be versioned.

---

## 9. Senior School Administration

Required capabilities:

- create and edit school profiles;
- merge duplicate records;
- manage official codes;
- manage location and school category;
- manage pathways and combinations offered;
- manage facilities and support capabilities;
- update verification status;
- review correction requests;
- view provenance by field;
- mark stale, disputed, or retired;
- view match impact.

---

## 10. School Offering Management

School offerings should be managed separately from the school identity where the existing schema permits.

Required features:

- effective date;
- academic year;
- pathway;
- track;
- combination;
- facility requirements;
- source;
- verification;
- last confirmed date;
- active or inactive state.

Historical offerings must remain available for audit and reporting.

---

## 11. Correction Review

Workflow:

```text
SUBMITTED
TRIAGED
UNDER_REVIEW
APPROVED
REJECTED
PUBLISHED
```

Administrators should be able to:

- compare current and proposed values;
- review evidence;
- request clarification;
- approve or reject;
- publish approved changes;
- record reason;
- notify submitter;
- audit all actions.

---

## 12. Recommendation Rules

The console should support versioned configuration for:

- pathway scoring;
- confidence thresholds;
- career-fit factors;
- school-match factors;
- recommendation buckets;
- hard exclusions;
- soft preferences;
- stale-data penalties;
- minimum evidence requirements.

Rules must be:

- validated before publish;
- versioned;
- testable against sample learners;
- reversible;
- auditable.

---

## 13. AI Configuration

Administrators may manage:

- prompt templates;
- provider configuration references;
- model selection references;
- feature toggles;
- output constraints;
- safety instructions;
- version history;
- evaluation results.

Secrets must never be displayed or stored directly in editable content fields.

AI configuration changes must not affect structured scoring logic unless explicitly approved through a separate rule change.

---

## 14. Imports

Supported import domains:

- schools;
- school offerings;
- pathways;
- tracks;
- subject combinations;
- careers;
- career mappings;
- education routes.

Import stages:

```text
UPLOADED
VALIDATING
VALIDATION_FAILED
READY_FOR_REVIEW
APPROVED
PROCESSING
COMPLETED
PARTIALLY_COMPLETED
FAILED
ROLLED_BACK
```

Required import features:

- template download;
- schema validation;
- duplicate detection;
- preview;
- row-level errors;
- impact summary;
- approval;
- idempotency;
- rollback where technically possible;
- audit history.

---

## 15. Data Quality

Required reports:

- missing official codes;
- missing combinations;
- schools without verification;
- stale schools;
- careers without sources;
- careers without pathway mappings;
- invalid combinations;
- duplicate schools;
- orphaned mappings;
- failed recommendation generations;
- low-confidence matches;
- source conflicts.

---

## 16. Analytics

Required analytics:

- pathway distribution;
- track distribution;
- combination demand;
- career interest trends;
- school shortlist trends;
- school match coverage;
- parent participation;
- counsellor participation;
- approval completion;
- time to final decision;
- recommendation confidence;
- revision rates;
- data quality trends.

Analytics should use aggregated data and respect privacy rules.

---

## 17. Audit Logs

Every sensitive administrative action must record:

- actor;
- timestamp;
- tenant or scope;
- entity;
- previous value;
- new value;
- action;
- reason;
- source;
- correlation ID.

Audit logs must be searchable and exportable by authorized users.

---

## 18. Publishing Workflow

Recommended workflow:

```text
DRAFT
→ IN_REVIEW
→ APPROVED
→ SCHEDULED or PUBLISHED
→ RETIRED
```

Publishing must:

- validate references;
- validate effective dates;
- prevent broken mappings;
- generate impact summary;
- invalidate caches;
- trigger required recalculations;
- write audit logs;
- notify affected operational users when needed.

---

## 19. APIs

Kiro must inspect current administrative APIs before adding routes.

Expected capabilities:

```text
GET    /admin/pathway-centre/dashboard
GET    /admin/pathways
POST   /admin/pathways
PATCH  /admin/pathways/:id
POST   /admin/pathways/:id/publish
GET    /admin/combinations
POST   /admin/combinations
PATCH  /admin/combinations/:id
GET    /admin/careers
POST   /admin/careers
PATCH  /admin/careers/:id
GET    /admin/schools
PATCH  /admin/schools/:id
GET    /admin/corrections
POST   /admin/corrections/:id/approve
POST   /admin/corrections/:id/reject
POST   /admin/imports
GET    /admin/imports/:id
POST   /admin/imports/:id/approve
GET    /admin/data-quality
GET    /admin/audit-logs
```

Final routes must align with repository conventions.

---

## 20. Background Jobs

Potential jobs:

- stale data scanning;
- import processing;
- duplicate detection;
- search index refresh;
- match recalculation;
- career match recalculation;
- notification dispatch;
- cache invalidation;
- scheduled publishing;
- data quality report generation.

---

## 21. Performance

- paginate all large tables;
- support server-side filtering and sorting;
- index common administrative filters;
- stream or background-process large imports;
- cache published reference data;
- avoid loading full audit payloads by default;
- provide progress state for long-running jobs.

---

## 22. Security

- enforce least privilege;
- require re-authentication for highly sensitive actions where supported;
- protect import files and evidence;
- prevent cross-tenant modification;
- sanitize uploaded content;
- validate all IDs server-side;
- audit all publish, retire, merge, import, and rule changes;
- never expose provider secrets.

---

## 23. Testing Requirements

### Unit Tests

- permission checks;
- publish state transitions;
- rule validation;
- import validation;
- correction workflow;
- audit payload generation.

### Integration Tests

- publishing invalidates cache;
- import approval starts processing;
- rule publishing creates version;
- school update triggers match recalculation;
- career update triggers match recalculation;
- audit search works.

### End-to-End Tests

1. Admin creates and publishes a career
2. Admin imports schools
3. Import fails validation
4. Reviewer approves correction
5. Unauthorized admin is denied
6. Rule version is published
7. Published combination affects matches
8. Retired school no longer appears in new matches

---

## 24. Acceptance Criteria

The specification is complete when:

- all reference data is managed through versioned workflows;
- permissions are granular;
- imports are reviewable and auditable;
- school corrections have a controlled workflow;
- recommendation rules are versioned and testable;
- AI configuration is separated from structured scoring;
- data quality is measurable;
- sensitive actions are audited;
- existing TrendScore admin and authorization systems are reused.
