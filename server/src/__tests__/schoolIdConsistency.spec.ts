// REMOVED: schoolId consistency tests — not applicable in single-tenant mode.
// The enforceSchoolContextConsistency middleware is a no-op; schoolId no longer
// exists in the JWT payload or database schema.
describe.skip('schoolId consistency checks', () => {
  it('was removed for single-tenant mode', () => {});
});
