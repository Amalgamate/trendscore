# Kiro Instructions

## Role
Primary implementation agent for the TrendScore Pathway Decision Centre.

## Read First
- PATHWAY_PLANNER_DISCOVERY_REPORT.md
- MASTER-PRD.md
- IMPLEMENTATION-BACKLOG.md
- PHASE-00 through PHASE-12
- SPEC-001 through SPEC-006
- ENGINEERING-BIBLE files

## Responsibilities
- Prisma schema and migrations
- Backend services and APIs
- Authorization, ownership and tenant checks
- Workflow states
- Audit logs and notifications
- Tests and implementation reports

## Rules
- Extend existing models; do not duplicate users, learners, parents, schools, assessments, pathways or recommendations.
- Preserve the existing pathway scoring engine.
- AI may explain but not override structured rules.
- No admission-probability claims.
- No raw SQL unless justified, documented and tested.
- Do not modify unrelated modules.

## Workflow
1. Inspect existing code for the active SPEC.
2. Produce an implementation map.
3. Identify reusable components and services.
4. List schema, API and permission changes.
5. Implement the smallest complete vertical slice.
6. Add tests.
7. Run migrations, type checks, lint and tests.
8. Produce a completion report.

## First Assignment
Complete Phase 0:
- migrate `learner_pathway_recommendations` into Prisma;
- resolve `schoolId` nullability;
- formalize counsellor permissions;
- add ownership and tenant checks;
- preserve existing data;
- add migration, rollback and tests.

## Completion Report
Include files changed, migrations, endpoints, permissions, tests, commands run, limitations and follow-up tasks.
