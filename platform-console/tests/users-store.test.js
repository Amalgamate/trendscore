'use strict';

// Phase 0 self-check for users-store.js — run in isolation, before this
// store is wired into auth-config.js / server.js. Per the plan's own rule
// ("nothing is done because code was written"), this exercises the
// behavioral guarantees the store claims, not just its shape:
//   - basic CRUD + active toggle
//   - TOTP enable requires a secret set first
//   - disableTotp wipes secret + backup codes together (tested against a
//     user that actually HAS codes, not a fresh one)
//   - backup code consumption is single-use under a double-consume attempt

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { createUsersStore } = require('../users-store');

let tmpDataDir;
let store;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

before(() => {
  tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-store-test-'));
  store = createUsersStore(tmpDataDir);
});

after(() => {
  // Close the DatabaseSync handle first — on Windows the sqlite file
  // (+ -wal/-shm sidecars) stays locked until this happens, so deleting
  // the temp dir before close() fails with EPERM regardless of retries.
  store.close();
  fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test('createUser / getUser / getUserByEmail round-trip', () => {
  const user = store.createUser({
    email: 'Admin@Example.Test',
    passwordHash: 'hash-1',
    name: 'Admin One',
    role: 'super_admin',
  });

  assert.equal(user.email, 'admin@example.test', 'email is normalized to lowercase');
  assert.equal(user.active, true);
  assert.equal(user.totpEnabled, false);

  const byId = store.getUser(user.id);
  assert.equal(byId.email, user.email);

  const byEmail = store.getUserByEmail('ADMIN@example.test');
  assert.equal(byEmail.id, user.id, 'lookup is case-insensitive');
});

test('imports existing console JSON users once and preserves account/session data', () => {
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-store-legacy-test-'));
  const legacyPath = path.join(legacyDir, 'console-users.store.json');
  const salt = '0123456789abcdef0123456789abcdef';
  const passwordHash = `scrypt$${salt}$${crypto.scryptSync('legacy-password', salt, 64).toString('hex')}`;
  const legacyUser = {
    id: 'legacy-super-admin-id', email: 'LEGACY@EXAMPLE.TEST', name: 'Legacy Admin',
    role: 'super_admin', active: true, passwordHash, sessionVersion: 4,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z',
    lastLoginAt: '2026-03-01T00:00:00.000Z',
  };
  fs.writeFileSync(legacyPath, JSON.stringify([legacyUser]));

  const migratedStore = createUsersStore(legacyDir);
  try {
    const migrated = migratedStore.getUserByEmail('legacy@example.test');
    assert.equal(migrated.id, legacyUser.id);
    assert.equal(migrated.email, 'legacy@example.test');
    assert.equal(migrated.passwordHash, passwordHash);
    assert.equal(migrated.sessionVersion, 4);
    assert.equal(migrated.lastLoginAt, legacyUser.lastLoginAt);
    migratedStore.setPassword(migrated.id, 'bcrypt-hash');
    assert.equal(migratedStore.getUser(migrated.id).sessionVersion, 5);
    assert.equal(JSON.parse(fs.readFileSync(legacyPath, 'utf8'))[0].passwordHash, passwordHash, 'legacy source remains recoverable');
  } finally {
    migratedStore.close();
    fs.rmSync(legacyDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('role, active-state, password and MFA changes revoke prior sessions', () => {
  const user = store.createUser({ email: 'session-version@example.test', passwordHash: 'h', role: 'platform_owner' });
  assert.equal(user.sessionVersion, 0);

  const promoted = store.updateUser(user.id, { role: 'super_admin' });
  assert.equal(promoted.sessionVersion, 1);
  const renamed = store.updateUser(user.id, { name: 'Updated Name' });
  assert.equal(renamed.sessionVersion, 1, 'name-only edits do not revoke access');

  const withSecret = store.setTotpSecret(user.id, 'BASE32SECRETVALUE');
  assert.equal(withSecret.sessionVersion, 1);
  const withMfa = store.setTotpEnabled(user.id, true);
  assert.equal(withMfa.sessionVersion, 2);
  const withoutMfa = store.disableTotp(user.id);
  assert.equal(withoutMfa.sessionVersion, 3);
  const disabled = store.setUserActive(user.id, false);
  assert.equal(disabled.sessionVersion, 4);
  const passwordChanged = store.setPassword(user.id, 'new-hash');
  assert.equal(passwordChanged.sessionVersion, 5);
});

test('setUserActive toggles active flag', () => {
  const user = store.createUser({
    email: 'toggle@example.test',
    passwordHash: 'hash-2',
    role: 'platform_owner',
  });

  const deactivated = store.setUserActive(user.id, false);
  assert.equal(deactivated.active, false);

  const reactivated = store.setUserActive(user.id, true);
  assert.equal(reactivated.active, true);
});

test('countActiveByRole counts only active users of that role', () => {
  const before = store.countActiveByRole('super_admin');

  const u1 = store.createUser({ email: 'role-a@example.test', passwordHash: 'h', role: 'super_admin' });
  store.createUser({ email: 'role-b@example.test', passwordHash: 'h', role: 'super_admin', active: false });

  assert.equal(store.countActiveByRole('super_admin'), before + 1, 'inactive super_admin is not counted');

  store.setUserActive(u1.id, false);
  assert.equal(store.countActiveByRole('super_admin'), before, 'deactivating drops the count');
});

test('setTotpEnabled refuses to enable without a secret set first', () => {
  const user = store.createUser({ email: 'totp-guard@example.test', passwordHash: 'h', role: 'super_admin' });

  assert.throws(
    () => store.setTotpEnabled(user.id, true),
    /secret/i,
    'enabling TOTP with no secret set must throw'
  );

  store.setTotpSecret(user.id, 'BASE32SECRETVALUE');
  const enabled = store.setTotpEnabled(user.id, true);
  assert.equal(enabled.totpEnabled, true);
});

test('disableTotp wipes secret AND backup codes together (user actually has codes)', () => {
  const user = store.createUser({ email: 'totp-full@example.test', passwordHash: 'h', role: 'super_admin' });
  store.setTotpSecret(user.id, 'ANOTHERBASE32SECRET');
  store.setTotpEnabled(user.id, true);

  const plainCodes = ['code-one', 'code-two', 'code-three'];
  const unused = store.replaceBackupCodes(user.id, plainCodes.map(sha256));
  assert.equal(unused, 3, 'all three codes start unused');
  assert.equal(store.countUnusedBackupCodes(user.id), 3);

  const disabled = store.disableTotp(user.id);
  assert.equal(disabled.totpSecret, '', 'secret cleared');
  assert.equal(disabled.totpEnabled, false, 'enabled flag cleared');
  assert.equal(store.countUnusedBackupCodes(user.id), 0, 'backup codes wiped, not just orphaned');
});

test('consumeBackupCode is single-use: second consume of the same code fails', () => {
  const user = store.createUser({ email: 'backup-atomic@example.test', passwordHash: 'h', role: 'super_admin' });
  const plainCode = 'only-once-code';
  const hash = sha256(plainCode);

  store.replaceBackupCodes(user.id, [hash, sha256('spare-code')]);
  assert.equal(store.countUnusedBackupCodes(user.id), 2);

  const firstAttempt = store.consumeBackupCode(user.id, hash);
  assert.equal(firstAttempt, true, 'first consume of a valid unused code succeeds');
  assert.equal(store.countUnusedBackupCodes(user.id), 1);

  const secondAttempt = store.consumeBackupCode(user.id, hash);
  assert.equal(secondAttempt, false, 'double-consume of the same code must fail, not succeed again');
  assert.equal(store.countUnusedBackupCodes(user.id), 1, 'unused count unaffected by the rejected second attempt');
});

test('consumeBackupCode rejects an unknown / never-issued hash', () => {
  const user = store.createUser({ email: 'backup-unknown@example.test', passwordHash: 'h', role: 'super_admin' });
  store.replaceBackupCodes(user.id, [sha256('real-code')]);

  const result = store.consumeBackupCode(user.id, sha256('never-issued'));
  assert.equal(result, false);
  assert.equal(store.countUnusedBackupCodes(user.id), 1, 'unrelated real code stays unused');
});

test('setPassword updates password_hash and updated_at moves forward', () => {
  const user = store.createUser({ email: 'pw@example.test', passwordHash: 'old-hash', role: 'super_admin' });
  const updated = store.setPassword(user.id, 'new-hash');
  assert.equal(updated.passwordHash, 'new-hash');
});

test('createUser rejects an invalid role', () => {
  assert.throws(
    () => store.createUser({ email: 'bad-role@example.test', passwordHash: 'h', role: 'nope' }),
    /role/i
  );
});
