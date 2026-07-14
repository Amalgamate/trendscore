# Codex Phase 0 Review

**Reviewed:** 2026-07-14  
**Scope:** Prisma adoption of pathway recommendations, offering `schoolId`
nullability, counsellor authorization, learner ownership, audit coverage,
rollback safety, and focused tests.

`MASTER-PRD.md` and `IMPLEMENTATION-BACKLOG.md`, referenced by the agent
instructions, are not present in this worktree. This review used the discovery
report, engineering bibles, Phase 12 roadmap, SPEC-003, and the implementation
diff as the available sources of truth.

## Findings and corrections

### BLOCKER — fixed: no deployable, data-preserving Phase 0 migration

- **Location:** `server/prisma/migrations/_stage1_diff.sql`,
  `server/src/services/pathway-transition-decision.service.ts`
- **Issue:** the service moved from runtime raw SQL to Prisma, but the only SQL
  creating `learner_pathway_recommendations` was an unversioned loose Stage 1
  diff. A normal `prisma migrate deploy` would not run it, while running it
  manually could fail when the legacy runtime-created table already existed.
- **Risk:** deployment failure, schema drift, or lost access to existing
  recommendation history.
- **Correction:** added the timestamped
  `20260714010000_pathway_phase0_recommendations` migration. It adopts an
  existing UUID-backed table without deleting rows, creates the table on fresh
  databases, aligns indexes/defaults, checks for orphaned learners before
  adding the foreign key, and includes a data-preserving manual rollback.
- **Merge impact:** fixed for the Phase 0 slice. The migration must still be
  exercised against a sanitized production-shaped database before promotion.

### HIGH — fixed: learner access guard defaulted to allow

- **Location:** `server/src/routes/pathwayRecommendation.routes.ts`,
  `server/src/routes/seniorPathway.routes.ts`
- **Issue:** only STUDENT and PARENT were checked; every other authenticated
  role, including non-academic staff, fell through to unrestricted access.
- **Risk:** exposure of learner recommendations and pathway decisions.
- **Correction:** centralized the guard in
  `pathwayAccess.middleware.ts`, explicitly allowlisted pathway staff, retained
  student-self and parent-family checks, and default-denied all other roles.
- **Merge impact:** fixed and covered by focused tests.

### HIGH — fixed: selection history had no resource ownership check

- **Location:** `GET /senior-pathways/selections/:id/history`
- **Issue:** any authenticated user who knew a selection ID could read its
  history.
- **Risk:** insecure direct object reference and learner data disclosure.
- **Correction:** resolve the selection's learner and apply the same learner
  ownership guard before loading history.
- **Merge impact:** fixed and covered by a focused test.

### HIGH — fixed: nullable school offering ownership

- **Location:** `SchoolLearningAreaOffering.schoolId`
- **Issue:** application writes require a school, but Prisma allowed null.
- **Risk:** unowned offerings and ambiguous school configuration.
- **Correction:** made the field required. The migration backfills only when
  exactly one school makes ownership unambiguous; otherwise it aborts without
  changing ambiguous rows so they can be reconciled manually.
- **Merge impact:** fixed with a deliberate safe-deploy precondition.

### MEDIUM — fixed: counsellor capability was encoded as scattered role lists

- **Location:** pathway route files and `server/src/config/permissions.ts`
- **Issue:** the codebase has no dedicated COUNSELLOR role and pathway actions
  repeated raw role arrays.
- **Risk:** permission drift and accidental expansion of approval/locking
  powers.
- **Correction:** formalized named pathway permissions. Per the discovery
  report's supported fallback, `HEAD_OF_CURRICULUM` is the counsellor proxy.
  It may counsel and approve, but only school leadership/admin roles may lock.
- **Merge impact:** fixed without introducing a partially integrated new role.

### MEDIUM — fixed: state-changing pathway requests lacked consistent controls

- **Location:** pathway recommendation and senior-pathway routes
- **Issue:** several writes did not apply CSRF enforcement; transition-decision
  saves and search-criteria changes were not explicitly audited.
- **Risk:** forged browser requests and incomplete accountability.
- **Correction:** added CSRF checks to state changes and audit events to the
  sensitive learner decision/preference writes.
- **Merge impact:** fixed; frontend requests must continue using the shared API
  client that supplies CSRF tokens.

## Validation

- `npx prisma validate` — passed (one pre-existing SetNull schema warning).
- Focused Jest suites — 2 passed, 8 tests passed.
- Targeted ESLint — 0 errors; test files are excluded by repository config.
- `npx tsc --noEmit` — passed for the full server after aligning the M-Pesa
  marketplace callback payload with its existing `success` result contract.

## Merge recommendation

**Phase 0 migration and security slice: ready for integration review.**

The full 93-migration history passed on a disposable PostgreSQL 15 database.
The five new migrations were then removed from migration history without
removing their tables and replayed successfully, exercising the adoption path
needed by databases where the former loose scripts were run manually.

**The whole current Pathways worktree is not yet merge-ready.** The loose Stage
1 scripts have now been replaced by timestamped migrations, but the broader
application stages in `PATHWAYS_IMPLEMENTATION_PLAN.md` remain unfinished.
Those should continue as separate, reviewable vertical slices, beginning with
the Decision Plan lifecycle.
