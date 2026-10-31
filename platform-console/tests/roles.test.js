'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLE_ACCESS } = require('../auth-config');

const EXPECTED = {
  super_admin:      ['overview', 'instances', 'storage', 'deployments', 'controls', 'billing', 'logs', 'leads', 'agents', 'settings'],
  platform_owner:   ['overview', 'instances', 'storage', 'deployments', 'billing', 'logs', 'leads', 'agents', 'settings'],
  finance_approver: ['overview', 'billing', 'logs'],
  billing_operator: ['overview', 'billing', 'leads', 'agents', 'logs'],
};

for (const [role, sections] of Object.entries(EXPECTED)) {
  test(`ROLE_ACCESS.${role} has exactly the expected sections`, () => {
    assert.ok(ROLE_ACCESS[role], `role ${role} should exist in ROLE_ACCESS`);
    assert.deepEqual(
      [...ROLE_ACCESS[role]].sort(),
      [...sections].sort(),
      `${role} sections mismatch`
    );
  });
}

test('no unexpected roles exist in ROLE_ACCESS', () => {
  const knownRoles = new Set(Object.keys(EXPECTED));
  for (const role of Object.keys(ROLE_ACCESS)) {
    assert.ok(knownRoles.has(role), `unexpected role found: ${role}`);
  }
});
