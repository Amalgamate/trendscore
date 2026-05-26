// REMOVED: Multi-tenant report scoping tests — not applicable in single-tenant mode.
// The reportController no longer performs any schoolId / branchId ownership checks.
// Learner access is governed solely by role-based permissions (permissions.middleware.ts).
describe.skip('report controller tenant scoping checks', () => {
  it('was removed for single-tenant mode', () => {});
});
