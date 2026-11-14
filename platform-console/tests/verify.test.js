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
      CONSOLE_PLATFORM_OWNER_EMAIL: '',
      CONSOLE_PLATFORM_OWNER_PASSWORD: '',
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
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.__expectedExit = true;
    const exited = new Promise(resolve => serverProcess.once('exit', resolve));
    serverProcess.kill();
    await exited; // Windows keeps SQLite files locked until the process has really exited
  }
  if (tmpDataDir && fs.existsSync(tmpDataDir)) {
    try { fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (err) { console.warn(`Could not remove temp dir ${tmpDataDir}: ${err.code}`); }
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

// ── Sanity check: the fix must not have broken the real app ───────────────
test('sanity: the login page itself still loads', async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Sign in to control panel/);
});

test('public school application displays supported packages and ownership-specific Starter modules', async () => {
  const publicPackages = await fetch(`${BASE_URL}/api/public/application-catalog?schoolType=PUBLIC_PRIMARY`).then(res => res.json());
  const privatePackages = await fetch(`${BASE_URL}/api/public/application-catalog?schoolType=PRIVATE_PRIMARY`).then(res => res.json());
  const secondaryPackages = await fetch(`${BASE_URL}/api/public/application-catalog?schoolType=PUBLIC_SECONDARY`).then(res => res.json());

  assert.deepEqual(publicPackages.packages.map(pack => pack.id), ['starter', 'standard', 'professional']);
  assert.equal(publicPackages.packages[0].modules.some(module => module.slug === 'fee-management'), false);
  assert.equal(privatePackages.packages[0].modules.some(module => module.slug === 'fee-management'), true);
  assert.deepEqual(secondaryPackages.packages, []);
  assert.equal(publicPackages.packages.some(pack => Object.hasOwn(pack, 'price')), false);
});

test('public applications require Primary packages and accept Secondary without a package or account', async () => {
  const missingPackage = await fetch(`${BASE_URL}/api/public/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Amina Example',
      email: 'amina@example.test',
      phone: '0712345678',
      school: 'Primary Without Package',
      schoolType: 'PUBLIC_PRIMARY',
      accommodationType: 'DAY',
      transportNeeded: false,
      address: 'Example Road',
      county: 'Nakuru',
      packageId: '',
    }),
  });
  assert.equal(missingPackage.status, 400);

  const response = await fetch(`${BASE_URL}/api/public/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Amina Example',
      email: 'amina@example.test',
      phone: '0712345678',
      school: 'Secondary Without Package',
      schoolType: 'PUBLIC_SECONDARY',
      accommodationType: 'BOARDING',
      transportNeeded: true,
      address: 'Example Road',
      county: 'Nakuru',
      packageId: '',
      agentId: '',
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.ok, true);
  assert.match(payload.reference, /^A/);
  assert.match(payload.message, /No school account is created until approval and installation/);

  const appResponse = await fetch(`${BASE_URL}/api/public/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Amina Example',
      email: 'amina@example.test',
      phone: '0712345678',
      school: 'Starter Enterprise Primary',
      schoolType: 'PRIVATE_PRIMARY',
      accommodationType: 'DAY_AND_BOARDING',
      transportNeeded: false,
      address: 'Example Road',
      county: 'Nakuru',
      packageId: 'enterprise',
    }),
  });
  assert.equal(appResponse.status, 400);
});
