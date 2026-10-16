'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const TEST_PORT = process.env.CONSOLE_TEST_PORT || '3199';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

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
      CONSOLE_SUPER_ADMIN_EMAIL: 'test-admin@example.test',
      CONSOLE_SUPER_ADMIN_PASSWORD: 'test-password-only',
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

  // Give the process a beat to fail fast (bad require, thrown error, etc.)
  // before we start polling — no point polling for 10s if it already died.
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

// ── V-01 ── Unauthenticated data-store requests must never succeed ────────
test('V-01: unauthenticated store files are not served', async () => {
  const paths = [
    '/data/leads.store.json',
    '/data/audit.store.json',
    '/data/deployments.store.json',
    '/leads.store.json',
    '/audit.store.json',
    '/deployments.store.json',
  ];

  for (const p of paths) {
    const res = await fetch(`${BASE_URL}${p}`);
    assert.ok(
      res.status === 404 || res.status === 401,
      `expected 404/401 for ${p}, got ${res.status}`,
    );
  }
});

// ── V-02 ── Unauthenticated source/config files are not served ────────────
test('V-02: unauthenticated source and config files are not served', async () => {
  const paths = [
    '/server.js',
    '/auth-config.js',
    '/package.json',
    '/.env',
    '/deploy/instances.manifest.json',
  ];

  for (const p of paths) {
    const res = await fetch(`${BASE_URL}${p}`);
    assert.ok(
      res.status === 404 || res.status === 401,
      `expected 404/401 for ${p}, got ${res.status}`,
    );
  }
});

// ── V-08 ── imageTag is validated before it reaches the deploy scripts ────
// F-13: imageTag was accepted verbatim from the request body and flowed
// into env vars consumed by deploy-release.sh (sed -i on env files, docker
// image refs). Restricted server-side to Docker's own tag charset.
test('V-08: imageTag outside the allowed charset is rejected with 400', async () => {
  const loginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-admin@example.test',
      password: 'test-password-only',
    }),
  });
  assert.equal(loginRes.status, 200, 'seeded super_admin should log in');
  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie, 'login must set a session cookie');

  const badTags = [
    'latest; rm -rf /',
    '$(whoami)',
    '`id`',
    'tag with spaces',
    '../../etc/passwd',
    'a'.repeat(200),
  ];

  for (const imageTag of badTags) {
    const res = await fetch(`${BASE_URL}/api/deploy/console`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ imageTag }),
    });
    assert.equal(res.status, 400, `expected 400 for imageTag ${JSON.stringify(imageTag)}, got ${res.status}`);
  }

  // A well-formed tag must still pass the format check itself (it will go on
  // to fail later for an unrelated reason in this test env — no deploy
  // script/manifest is present — but must NOT be rejected as 400 here).
  const okRes = await fetch(`${BASE_URL}/api/deploy/console`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ imageTag: 'v1.2.3-rc.1' }),
  });
  assert.notEqual(okRes.status, 400, 'a well-formed imageTag must not be rejected by format validation');
});

// ── Sanity check: the fix must not have broken the real app ───────────────
test('sanity: the login page itself still loads', async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Sign in to control panel/);
});
