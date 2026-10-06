'use strict';

// Covers the F-04 login-hardening slice: V-04 (lockout after repeated failed
// logins, success path for other accounts unaffected) and a practical proxy
// for V-05 (the login response gives no distinguishable shape between an
// unknown email and a wrong password — true statistical timing-side-channel
// testing is out of scope for this harness; that part of V-05 was verified
// by code review: both paths hash-compare against a fixed-shape target).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createUsersStore } = require('../users-store');

const TEST_PORT = process.env.CONSOLE_TEST_PORT || '3198';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const ADMIN_EMAIL = 'test-admin@example.test';
const ADMIN_PASSWORD = 'test-password-only';
const OWNER_EMAIL = 'test-owner@example.test';
const OWNER_PASSWORD = 'test-owner-password-only';
const LEGACY_ADMIN_EMAIL = 'legacy-admin@example.test';
const LEGACY_ADMIN_PASSWORD = 'legacy-admin-password-only';

let serverProcess;
let tmpDataDir;
let startupOutput = '';

function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) return resolve();
      } catch {
        // server not up yet — keep polling
      }
      if (Date.now() > deadline) {
        return reject(new Error(`Console server did not become healthy in time.\n${startupOutput}`));
      }
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

function login(email, password) {
  return fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

before(async () => {
  tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-console-test-'));

  const legacySalt = 'abcdef0123456789abcdef0123456789';
  const legacyHash = `scrypt$${legacySalt}$${crypto.scryptSync(LEGACY_ADMIN_PASSWORD, legacySalt, 64).toString('hex')}`;
  fs.writeFileSync(path.join(tmpDataDir, 'console-users.store.json'), JSON.stringify([{
    id: 'legacy-admin-id', email: LEGACY_ADMIN_EMAIL, passwordHash: legacyHash,
    name: 'Legacy Admin', role: 'super_admin', active: true, sessionVersion: 2,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', lastLoginAt: '',
  }]));

  // ADMIN_EMAIL (super_admin) is seeded by server.js itself from
  // CONSOLE_SUPER_ADMIN_EMAIL/PASSWORD on first boot (Phase 1 bootstrap).
  // platform_owner accounts are no longer created from env vars
  // (auth-config.js, Stage 2) — seed OWNER_EMAIL directly into the same
  // DB file the spawned server will open, the way it'd really be created
  // (via the Users store, not .env).
  const seedStore = createUsersStore(tmpDataDir);
  seedStore.createUser({
    email: OWNER_EMAIL,
    passwordHash: bcrypt.hashSync(OWNER_PASSWORD, 10),
    name: 'Test Owner',
    role: 'platform_owner',
    active: true,
  });
  seedStore.close();

  serverProcess = spawn(process.execPath, ['--experimental-sqlite', 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
      CONSOLE_DATA_DIR: tmpDataDir,
      CONSOLE_JWT_SECRET: 'test-only-secret-not-for-production-0123456789',
      CONSOLE_JWT_EXPIRES_IN: '8h',
      CONSOLE_SUPER_ADMIN_EMAIL: ADMIN_EMAIL,
      CONSOLE_SUPER_ADMIN_PASSWORD: ADMIN_PASSWORD,
      CONSOLE_COOKIE_SECURE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let spawnFailed = null;
  serverProcess.on('error', err => {
    spawnFailed = err;
    startupOutput += `\n[spawn error] ${err.stack || err.message}`;
  });
  let exitedEarly = false;
  serverProcess.on('exit', (code, signal) => {
    if (!serverProcess.__expectedExit) {
      exitedEarly = true;
      startupOutput += `\n[server exited early] code=${code} signal=${signal}`;
    }
  });
  serverProcess.stdout.on('data', chunk => { startupOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { startupOutput += chunk; });

  await new Promise(r => setTimeout(r, 300));
  if (spawnFailed) throw spawnFailed;
  if (exitedEarly) throw new Error(`Console server exited before becoming healthy.\n${startupOutput}`);

  await waitForHealth();
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.__expectedExit = true;
    serverProcess.kill();
  }
  // On Windows, kill() force-terminates the child rather than delivering a
  // real SIGTERM, so the sqlite file handles it held open (users-store.js,
  // billing-store.js) aren't guaranteed released the instant kill() returns.
  // Give it a beat, then retry the delete — same fix as users-store.test.js.
  await new Promise(r => setTimeout(r, 150));
  if (tmpDataDir && fs.existsSync(tmpDataDir)) {
    fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('V-04: repeated failed logins lock the account out, other accounts unaffected', async () => {
  // 5 wrong-password attempts against the admin account.
  for (let i = 0; i < 5; i += 1) {
    const res = await login(ADMIN_EMAIL, 'definitely-wrong-password');
    assert.equal(res.status, 401, `attempt ${i + 1} should be a plain auth failure, got ${res.status}`);
  }

  // 6th attempt — even with the CORRECT password — must be blocked by lockout.
  const lockedRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.equal(lockedRes.status, 429, 'account should be locked out after 5 failures');

  // A different account must be completely unaffected by the admin's lockout.
  const ownerRes = await login(OWNER_EMAIL, OWNER_PASSWORD);
  assert.equal(ownerRes.status, 200, 'a different account must still be able to log in normally');
});

test('V-05 (proxy): unknown email and wrong password return the same response shape', async () => {
  const unknownRes = await login('nobody-like-this@example.test', 'whatever');
  const unknownBody = await unknownRes.json();

  const wrongPasswordRes = await login(OWNER_EMAIL, 'wrong-password-here');
  const wrongPasswordBody = await wrongPasswordRes.json();

  assert.equal(unknownRes.status, wrongPasswordRes.status);
  assert.equal(unknownBody.error, wrongPasswordBody.error);
});

test('V-06: legacy console accounts keep working and password changes revoke their sessions', async () => {
  const migratedLogin = await login(LEGACY_ADMIN_EMAIL, LEGACY_ADMIN_PASSWORD);
  assert.equal(migratedLogin.status, 200, 'existing scrypt account should authenticate after import');
  const migratedCookie = String(migratedLogin.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(migratedCookie, 'successful legacy login must receive a session cookie');

  const migratedStore = createUsersStore(tmpDataDir);
  const migratedAdmin = migratedStore.getUserByEmail(LEGACY_ADMIN_EMAIL);
  assert.match(migratedAdmin.passwordHash, /^\$2[aby]\$/, 'successful legacy login upgrades scrypt to bcrypt');
  assert.equal(migratedAdmin.sessionVersion, 3, 'password-hash upgrade invalidates older sessions');
  migratedStore.close();

  const usersResponse = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: migratedCookie } });
  assert.equal(usersResponse.status, 200);
  const usersBody = await usersResponse.json();
  const legacyAdmin = usersBody.users.find(user => user.email === LEGACY_ADMIN_EMAIL);
  assert.ok(legacyAdmin, 'the imported administrator remains in the user registry');

  const resetResponse = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(legacyAdmin.id)}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: migratedCookie },
    body: JSON.stringify({ password: 'legacy-admin-new-password' }),
  });
  assert.equal(resetResponse.status, 200);

  const revokedResponse = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: migratedCookie } });
  assert.equal(revokedResponse.status, 401, 'a password reset revokes already-issued sessions');
  const newLogin = await login(LEGACY_ADMIN_EMAIL, 'legacy-admin-new-password');
  assert.equal(newLogin.status, 200);
});
