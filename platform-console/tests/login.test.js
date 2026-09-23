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

const TEST_PORT = process.env.CONSOLE_TEST_PORT || '3198';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const ADMIN_EMAIL = 'test-admin@example.test';
const ADMIN_PASSWORD = 'test-password-only';
const OWNER_EMAIL = 'test-owner@example.test';
const OWNER_PASSWORD = 'test-owner-password-only';

let serverProcess;
let tmpDataDir;
let startupOutput = '';

function waitForHealth(timeoutMs = 10000) {
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
      CONSOLE_PLATFORM_OWNER_EMAIL: OWNER_EMAIL,
      CONSOLE_PLATFORM_OWNER_PASSWORD: OWNER_PASSWORD,
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

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.__expectedExit = true;
    serverProcess.kill();
  }
  if (tmpDataDir && fs.existsSync(tmpDataDir)) {
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
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
