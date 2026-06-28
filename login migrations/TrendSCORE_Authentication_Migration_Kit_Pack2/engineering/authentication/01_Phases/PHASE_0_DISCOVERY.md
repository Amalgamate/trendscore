# Phase 0 - Discovery

## Phase Goal

Understand the current TrendSCORE authentication implementation without changing production code.

## Why This Phase Exists

Authentication is a critical subsystem. Before adding phone + OTP parent login, the current behavior must be mapped so later phases preserve backward compatibility and avoid breaking existing staff, student, admin, and parent access.

## Files Allowed To Modify

Documentation only:

- `login migrations/**/engineering/authentication/**`

## Files Forbidden

Production code and runtime configuration are forbidden in this phase:

- `server/src/**`
- `server/prisma/**`
- `src/**`
- `public/**`
- `.env*`
- `package.json`
- `package-lock.json`
- deployment files

## Database Changes Allowed?

No.

Do not modify Prisma schema, migrations, seed files, or live data.

## API Changes Allowed?

No.

Do not change routes, controllers, middleware, request payloads, response payloads, token behavior, cookies, or headers.

## UI Changes Allowed?

No.

Do not modify login, OTP, parent portal, PWA, or notification UI.

## Scope

Allowed:

- Read source code.
- Map current login flow.
- Map current OTP flow.
- Map current JWT and refresh-token flow.
- Map current parent account model.
- Map current parent-child relationship model.
- Map current role and permission model.
- Map current session storage and logout behavior.
- Map current PWA, service worker, offline, and push notification behavior.
- Identify security risks.
- Identify duplicate logic.
- Identify dead or unused authentication code.
- Document findings in Phase 0 report.

Forbidden:

- Code changes.
- Refactoring.
- Database migrations.
- Dependency changes.
- UI changes.
- API behavior changes.
- Cleanup or deletion.

## Tests Required

No test execution is required because this is an inspection-only phase.

If commands are run, they must be read-only commands such as:

- `rg`
- `Get-Content`
- `git diff`
- `git status`

## Deliverables

1. Authentication flow diagram.
2. API inventory.
3. Middleware inventory.
4. OTP flow.
5. Session flow.
6. Role resolution flow.
7. Parent account and relationship model.
8. PWA/offline/push readiness notes.
9. Security findings.
10. Technical debt list.
11. Duplicate code list.
12. Dead code list.
13. Recommendation on whether Phase 1 is safe to begin.

## Acceptance Criteria

- Login endpoints are mapped.
- OTP endpoints are mapped.
- JWT access-token behavior is documented.
- Refresh-token behavior is documented.
- Cookie and localStorage behavior is documented.
- Parent account creation and login behavior is documented.
- Parent-child relationship model is documented.
- Role resolution is documented.
- Route protection is documented.
- Device handling is documented, including missing capabilities.
- PWA, offline, and push notification state is documented.
- Security risks are listed.
- Duplicate and dead auth code are identified where visible.
- No production code is modified.

## Rollback Strategy

No production rollback is required. If documentation is incorrect, correct the Phase 0 report and checklist before proceeding.

## Definition Of Done

- `PHASE_0_CHECKLIST.md` is fully completed.
- `PHASE_0_REPORT.md` is complete.
- `STATUS.md` marks Phase 0 complete.
- `PROGRESS.md` records Phase 0 completion.
- Report explicitly states whether Phase 1 is safe to begin.
- No production files are changed.

## Next Phase Prerequisites

Phase 1 may begin only after:

- Phase 0 report says `Ready for Phase 1: Yes`.
- User approves starting Phase 1.
- `LOCK_FILE.md` is updated to make Phase 1 active.
