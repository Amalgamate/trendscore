# Authentication Migration Rules

These rules apply to every authentication migration phase.

## Hard Rules

1. Never modify production authentication code before reading `MASTER_PROMPT.md`, `RULES.md`, `LOCK_FILE.md`, `STATUS.md`, `PROGRESS.md`, and the active phase document.
2. Work only on the phase named in `LOCK_FILE.md`.
3. Never start a locked phase.
4. Never skip a phase.
5. Never delete existing authentication code in the first implementation pass.
6. Deprecate first. Delete later.
7. Never break existing email/password login.
8. Never break existing OTP verification.
9. Never change a public API contract without explicit approval.
10. Always preserve backward compatibility during migration phases.
11. Never rename public API routes, response fields, role names, or token fields unless the active phase explicitly allows it.
12. Never modify unrelated modules.
13. Never mix database schema changes, API behavior changes, and UI changes in the same phase unless the active phase explicitly allows all three.
14. Never add new dependencies without documenting why they are required.
15. Always update `STATUS.md` and `PROGRESS.md` after phase work.
16. Always update the active phase checklist.
17. Always produce or update the active phase report.
18. Always include tests run, risks, rollback strategy, and next-phase prerequisites in the report.
19. Stop after the current phase is complete.
20. If the codebase contradicts the migration docs, stop and document the conflict before changing code.

## Compatibility Rules

1. Existing users must still be able to log in.
2. Existing parent accounts must remain usable.
3. Existing JWT access and refresh behavior must remain usable until a later approved migration phase changes it.
4. Existing cookies and localStorage fallback must not be removed until a later approved phase.
5. Existing role resolution must remain unchanged unless the active phase explicitly authorizes role model changes.
6. Existing school deployments must not require emergency manual data repair after a phase.

## Reporting Rules

Every phase report must include:

1. Summary
2. Files reviewed or changed
3. Tests executed
4. Risks
5. Rollback strategy
6. Acceptance criteria status
7. Whether the next phase is safe to begin

