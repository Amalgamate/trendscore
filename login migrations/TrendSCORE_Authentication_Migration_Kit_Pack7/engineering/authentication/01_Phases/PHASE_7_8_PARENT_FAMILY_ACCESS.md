# Phase 7-8 - Parent Family Access Compatibility

## Phase Goal

Allow authenticated parent accounts, including Phone + OTP parent sessions, to access learners linked through the existing family account tables as well as the legacy `Learner.parentId` relationship.

## Why This Phase Exists

Earlier phases made parent phone login possible, but several parent authorization and dashboard paths still depend mostly on `Learner.parentId`. The schema already contains `FamilyAccount`, `FamilyMember`, and `LearnerFamilyLink`; this phase makes parent access checks use those existing tables without redesigning the family model.

## Files Allowed To Modify

- `server/src/services/parent-access.service.ts`
- `server/src/middleware/permissions.middleware.ts`
- `server/src/controllers/dashboard.controller.ts`
- `server/src/controllers/learner.controller.ts`
- `server/src/controllers/fee.controller.ts` only for parent learner access compatibility
- `server/src/controllers/attendance.controller.ts` only for parent learner access compatibility
- targeted backend tests under `server/src/__tests__/`
- migration documentation under `login migrations/**/engineering/authentication/**`

## Files Forbidden

- `src/**`
- login UI
- parent portal UI
- finance feature behavior outside parent learner access checks
- assessment feature behavior outside parent learner access checks
- timetable modules
- database redesign
- new family schema
- non-parent authentication behavior
- package files unless explicitly approved

## Database Changes Allowed?

No.

Use the existing family tables only.

## API Changes Allowed?

No public contract changes.

Allowed:

- Broaden existing parent data access to include already-linked family learners.
- Keep response shapes unchanged.

Forbidden:

- Rename routes.
- Add required request fields.
- Change token or refresh behavior.
- Change non-parent authorization.

## UI Changes Allowed?

No.

The existing parent portal should simply receive the broader authorized learner set from existing APIs.

## Tests Required

- Parent can access direct `Learner.parentId` learner.
- Parent can access learner through `FamilyMember.userId -> LearnerFamilyLink`.
- Parent cannot access unrelated learner.
- Inactive/archived family links do not grant access.
- Existing teacher/admin learner guard behavior remains unchanged.
- Parent dashboard learner query includes both direct and family-linked learners.
- TypeScript compile.

## Acceptance Criteria

- Existing parent accounts still work.
- Phone OTP parent sessions inherit the same learner access as password parent sessions.
- Parent dashboard includes family-linked learners.
- Resource guards permit family-linked learners only for the authenticated parent.
- Unrelated learners remain blocked.
- No UI or database changes are made.
- Phase 9 remains locked.

## Rollback Strategy

Rollback by reverting the Phase 7-8 service, guard, controller, test, and documentation changes. Existing `parentId` behavior will remain as it was before this phase.

## Definition Of Done

- Combined Phase 7-8 checklist is complete.
- Combined Phase 7-8 report is complete.
- TypeScript passes.
- Targeted authorization tests pass.
- Existing auth tests pass.
- Phase 9 remains locked.

## Next Phase Prerequisites

Phase 9 may begin only after:

- Combined Phase 7-8 report says `Ready for Phase 9: Yes`.
- User approves starting Phase 9.
- Phase 9 phase document exists.
- Phase 9 checklist exists.
- Phase 9 report template exists.
- `LOCK_FILE.md` is updated to make Phase 9 active.
