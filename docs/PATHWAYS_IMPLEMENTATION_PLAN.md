# Pathways Module — Consolidated Implementation Plan

Synthesizes SPEC-001 through SPEC-006 gap audits (correcting one stale claim: the
family-preferences API endpoint already exists — `GET`/`PUT
/senior-pathways/learners/:learnerId/search-criteria` — only its UI is missing).

Ordered by dependency: foundational schema first, since SPEC-001/002/003/004 all
build on models that don't exist yet.

---

## Stage 1 — Foundational schema (unblocks everything else)

**UPDATE (same day, hours later):** All seven models now exist in schema.prisma
and are applied to the database — built by the concurrent session while this
plan was being written. Confirmed via direct inspection, not assumed:

- [x] `DecisionPlan` model exists
- [x] `LearnerActionPlan` / `ActionItem` models exist
- [x] `ParentComment` model exists
- [x] `CounsellingSession` model exists
- [x] `SchoolMatchScore` model exists
- [x] `SchoolCorrection` model exists
- [x] `SeniorSchool` additions (affordability, facilities, lat/long, special-support, verification workflow, dataSource) all present
- [x] Note visibility field on `CounsellorNote` present

**Migration hardening complete (2026-07-14):** the loose SQL deployment path
has been replaced by scoped timestamped migrations for search criteria, auth /
family schema alignment, Phase 0 recommendations, Career Explorer adoption,
and the Stage 1 foundation. They support both fresh databases and databases
where the former scripts were already executed manually. The complete 93-file
migration history and a second adoption-style replay both passed against a
disposable PostgreSQL 15 database.

**Decision Plan lifecycle complete (2026-07-14):** versioned immutable submission
snapshots, parent review, counsellor review, structured revision requests,
approval and leadership lock are now implemented with ownership guards, named
permissions, CSRF, route audit events, notifications and lifecycle tests. The
student, parent and counsellor screens now consume the lifecycle API, including
role-filtered parent comments. Action items, counselling sessions and pathway
interventions now have guarded application services and counsellor UI. Match
scores and school corrections still need their application services.

---

## Stage 2 — SPEC-004: School Matching Service

- [x] Senior school catalogue (search/filter/CRUD) — done
- [x] Learner + parent school shortlist — done
- [x] Fit-scoring engine: eligibility → hard constraints → soft scoring → DREAM/TARGET/SAFE/LOCAL classification
- [x] Personalised matching using pathway + combination + family preferences (needs Stage 1 `SeniorSchool` fields + the `LearnerSchoolSearchCriteria` we already built)
- [x] School comparison tool
- [x] Verification workflow UI (needs Stage 1 field)
- [x] Correction request workflow (needs Stage 1 `SchoolCorrection` model)

## Stage 3 — SPEC-005: Career Explorer (mostly done, finish the rest)

- [x] Career catalogue, detail + education routes, fit-matching, save/unsave — done
- [x] Career comparison (side-by-side, up to N)
- [x] Career seed data — starter catalogue seeded: 7 families, 17 careers with education routes (`server/prisma/seed-careers.ts`, `npm run seed:careers`). Expand via admin console once built (Stage 6)
- [x] Career → combination impact classification (`STRONGLY_SUPPORTS`/`MAY_RESTRICT`/etc.)
- [x] Parent career review (mark saved careers as supported/uncertain)
- [x] Admin career management UI

## Stage 4 — SPEC-003: Counsellor Workspace

Counsellor workspace completed 2026-07-14, including consolidated evidence,
filtered intervention queue, bulk assignment and audited administrator escalation.

- [x] Counsellor dashboard (pending reviews, revision cases, overdue actions, upcoming sessions, completion)
- [x] Session scheduling UI on `CounsellingSession`, including outcomes and follow-up dates
- [x] Intervention queue — create, filter, bulk-assign, prioritise, track, escalate and resolve
- [x] Full learner workspace (preferences + career interests + school shortlist + parent input + notes)
- [x] Counsellor reports (pathway distribution, approval progress, intervention outcomes)
- [x] Escalate-to-admin action with audit event and administrator notification
- [x] Action items / follow-up tasks
- [x] Decision-plan revision return (not just selection rejection)

## Stage 5 — SPEC-001/002: Student & Parent Decision Plan UX

- [x] Pathway preference (STEM/Social/Arts), school shortlist search+save, multi-child context — done
- [x] Family preferences form UI (county, boarding, affordability, faith, special needs, distance, non-negotiables) — built as `FamilyPreferencesForm` in `ParentPortalPathway.jsx`, wired to the existing search-criteria API. Non-negotiables/special-needs/distance folded into free-text notes for now rather than adding more structured fields
- [x] Decision Plan backend lifecycle — immutable versioned submissions, parent/counsellor review, structured revisions, approval, lock, audit and notifications
- [x] Decision plan approve/request-revision UI
- [x] Parent comments with visibility rules
- [x] Parent career review page
- [x] Subject combination review
- [x] Fit-scored school matching UI (depends on Stage 2)
- [x] School comparison tool (depends on Stage 2)
- [x] Subject combination planner: "which careers does this support/restrict" analysis
- [x] Student-facing senior school discovery with fit scoring (depends on Stage 2)
- [x] Saved Options screen (pathways + careers + combos + schools together)
- [x] Action Plan screen
- [x] Decision Plan screen + full lifecycle
- [x] Request-parent-review action from student side
- [x] Real progress states on dashboard (replace static "Explore" link)
- [x] Full student pathway dashboard (currently one tile linking to planner, not a full dashboard)
- [x] Remaining notifications: recommendation ready, parent comment, counsellor comment, revision (currently only unlock/submission notify)

## Stage 6 — SPEC-006: Administration Console

- [x] School catalogue admin, school pathway offerings config — done (PathwaysHub)
- [x] Pathway/track/combination admin with versioning (create/edit/publish/retire) — currently read-only
- [x] Career administration UI
- [x] Bulk import (schools/careers/pathways CSV)
- [x] Data quality report
- [x] Recommendation rules configuration (currently hardcoded weights)
- [x] Pathway analytics dashboard
- [x] Audit logs viewer for pathway actions specifically (only system-level logs exist)

---

## Notes

- This module has at least one other agent session actively editing it concurrently (discovered mid-session — see `/areas/pathways.md`). Re-check file state before large edits; don't assume a prior read is still current.
- Ground-truth every claim against actual code before building — this same audit style has been partially stale before (see the search-criteria endpoint correction above).
- Given the size, this is tracked in stages, not a single pass. Update checkboxes here as work completes, same convention as `MARKETPLACE_IMPLEMENTATION_PLAN.md`.
