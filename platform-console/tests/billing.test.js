'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const TEST_PORT = process.env.CONSOLE_BILLING_TEST_PORT || '3187';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const ADMIN_EMAIL = 'billing-admin@example.test';
const ADMIN_PASSWORD = 'billing-test-password-only';

let serverProcess;
let tmpDataDir;
let startupOutput = '';
let cookie = '';

function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() > deadline) return reject(new Error(`Console server did not become healthy.\n${startupOutput}`));
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

async function api(method, route, body, { auth = true } = {}) {
  const res = await fetch(`${BASE_URL}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function newCustomer(name, tenantKey) {
  const res = await api('POST', '/api/billing/customers', { name, tenantKey, billingEmail: 'bursar@school.test', currency: 'KES' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.customer;
}

before(async () => {
  tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-billing-test-'));
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
      CONSOLE_PLATFORM_OWNER_EMAIL: '',
      CONSOLE_PLATFORM_OWNER_PASSWORD: '',
      CONSOLE_COOKIE_SECURE: 'false',
      BILLING_ALLOW_RESET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let exitedEarly = false;
  serverProcess.on('exit', (code, signal) => {
    if (!serverProcess.__expectedExit) { exitedEarly = true; startupOutput += `\n[server exited early] code=${code} signal=${signal}`; }
  });
  serverProcess.stdout.on('data', chunk => { startupOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { startupOutput += chunk; });
  await new Promise(r => setTimeout(r, 300));
  if (exitedEarly) throw new Error(`Console server exited before becoming healthy.\n${startupOutput}`);
  await waitForHealth();

  const login = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200, 'test admin should be able to log in');
  cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
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

test('billing endpoints refuse unauthenticated requests', async () => {
  for (const route of ['/api/billing/products', '/api/billing/quotes', '/api/billing/invoices', '/api/billing/payments']) {
    const res = await api('GET', route, undefined, { auth: false });
    assert.equal(res.status, 401, route);
  }
  const put = await api('PUT', '/api/billing/products/core_private', { name: 'x', priceKsh: 1, active: true }, { auth: false });
  assert.equal(put.status, 401);
});

test('the price list is seeded with the roadmap prices', async () => {
  const res = await api('GET', '/api/billing/products');
  assert.equal(res.status, 200);
  const byCode = Object.fromEntries(res.body.products.map(p => [p.code, p]));
  assert.equal(res.body.products.length, 8);
  assert.equal(byCode.setup_private.priceKsh, 15000);
  assert.equal(byCode.core_private.priceKsh, 10000);
  assert.equal(byCode.module_private.priceKsh, 5000);
  assert.equal(byCode.comms_private.priceKsh, 10000);
  assert.equal(byCode.setup_public_primary.priceKsh, 10000);
  assert.equal(byCode.core_public_primary.priceKsh, 5000);
  assert.equal(byCode.module_public_primary.active, true, 'public primary add-ons were confirmed in October 2026');
  assert.equal(res.body.schoolTypes.private, 'Private school');
});

test('price list edits are validated and audited', async () => {
  const missing = await api('PUT', '/api/billing/products/nope', { name: 'x', priceKsh: 1, active: true });
  assert.equal(missing.status, 404);
  const negative = await api('PUT', '/api/billing/products/core_private', { name: 'CORE', priceKsh: -5, active: true });
  assert.equal(negative.status, 400);
  const badActive = await api('PUT', '/api/billing/products/core_private', { name: 'CORE', priceKsh: 100, active: 'yes' });
  assert.equal(badActive.status, 400);
  const unchanged = await api('GET', '/api/billing/products');
  assert.equal(unchanged.body.products.find(p => p.code === 'core_private').priceKsh, 10000);

  const audit = await api('GET', '/api/audit-logs?limit=50');
  assert.equal(audit.status, 200);
});

test('quote preview prices a private school from the price list', async () => {
  const res = await api('POST', '/api/billing/quotes/preview', { schoolType: 'private' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.subtotalKsh, 25000);
  assert.equal(res.body.discount, null);

  const noType = await api('POST', '/api/billing/quotes/preview', { enrollmentCount: '' });
  assert.equal(noType.status, 400);
  const badType = await api('POST', '/api/billing/quotes/preview', { schoolType: 'university' });
  assert.equal(badType.status, 400);
});

test('public primary add-on modules are priced like private ones, and rejected while that price is switched off', async () => {
  const ok = await api('POST', '/api/billing/quotes/preview', { schoolType: 'public_primary', extraModules: ['Library'] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.subtotalKsh, 20000); // setup 10,000 + CORE 5,000 + one module 5,000

  const off = await api('PUT', '/api/billing/products/module_public_primary', { name: 'Add-on module (per term)', priceKsh: 5000, active: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  try {
    const res = await api('POST', '/api/billing/quotes/preview', { schoolType: 'public_primary', extraModules: ['Library'] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not offered/);
  } finally {
    const on = await api('PUT', '/api/billing/products/module_public_primary', { name: 'Add-on module (per term)', priceKsh: 5000, active: true });
    assert.equal(on.status, 200, JSON.stringify(on.body));
  }
});

test('a discount needs a reason and is carried on the quote', async () => {
  const noReason = await api('POST', '/api/billing/quotes/preview', { schoolType: 'private', discount: { amountKsh: 5000 } });
  assert.equal(noReason.status, 400);
  const ok = await api('POST', '/api/billing/quotes/preview', {
    schoolType: 'private', communicationsIncluded: true, extraModules: ['Library'],
    discount: { amountKsh: 5000, reason: 'Founding school', requiresApproval: true },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.grossKsh, 40000);
  assert.equal(ok.body.subtotalKsh, 35000);
  assert.equal(ok.body.discount.requiresApproval, true);
});

test('saved quotes keep their price snapshot when the price list changes', async () => {
  const customer = await newCustomer('Snapshot School', 'snapshot-school');
  const first = await api('POST', '/api/billing/quotes', { customerId: customer.id, schoolType: 'private' });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.quote.subtotalKsh, 25000);

  const edit = await api('PUT', '/api/billing/products/core_private', { name: 'TrendSCORE CORE (per term)', priceKsh: 12000, active: true });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(edit.body.product.priceKsh, 12000);

  const second = await api('POST', '/api/billing/quotes', { customerId: customer.id, schoolType: 'private' });
  assert.equal(second.status, 201);
  assert.equal(second.body.quote.subtotalKsh, 27000);

  const list = await api('GET', '/api/billing/quotes');
  const stillFirst = list.body.quotes.find(q => q.id === first.body.quote.id);
  assert.equal(stillFirst.subtotalKsh, 25000, 'the earlier quote must not be re-priced');

  const restore = await api('PUT', '/api/billing/products/core_private', { name: 'TrendSCORE CORE (per term)', priceKsh: 10000, active: true });
  assert.equal(restore.status, 200);
});

test('an unsent draft quote can be re-priced by changing school type', async () => {
  const customer = await newCustomer('Draft School', 'draft-school');
  const created = await api('POST', '/api/billing/quotes', { customerId: customer.id, schoolType: 'private' });
  assert.equal(created.status, 201);
  const updated = await api('PUT', `/api/billing/quotes/${created.body.quote.id}`, { customerId: customer.id, schoolType: 'public_primary' });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.quote.subtotalKsh, 15000);
});

test('legacy per-student quotes (no school type) still price the old way', async () => {
  const customer = await newCustomer('Legacy School', 'legacy-school');
  const res = await api('POST', '/api/billing/quotes', { customerId: customer.id, enrollmentCount: 100, setupFeeKsh: 5000 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.quote.subtotalKsh, 10000); // 100 students x KSh 50 + 5,000 setup
});

test('reset needs the exact phrase', async () => {
  const res = await api('POST', '/api/billing/reset', { confirm: 'reset billing' });
  assert.equal(res.status, 400);
});

test('reset is allowed while only drafts exist, and keeps the price list', async () => {
  const before = await api('GET', '/api/billing/quotes');
  assert.ok(before.body.quotes.length > 0, 'earlier tests should have left draft quotes');
  const reset = await api('POST', '/api/billing/reset', { confirm: 'RESET BILLING' });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.ok(reset.body.cleared.quotes > 0);

  const quotes = await api('GET', '/api/billing/quotes');
  assert.equal(quotes.body.quotes.length, 0);
  const customers = await api('GET', '/api/billing/customers');
  assert.equal(customers.body.customers.length, 0);
  const products = await api('GET', '/api/billing/products');
  assert.equal(products.body.products.length, 8, 'the price list must survive a billing reset');
});

test('reset is refused once an invoice has been issued', async () => {
  const customer = await newCustomer('Invoiced School', 'invoiced-school');
  const quote = await api('POST', '/api/billing/quotes', { customerId: customer.id, schoolType: 'private' });
  assert.equal(quote.status, 201);
  const accepted = await api('POST', `/api/billing/quotes/${quote.body.quote.id}/accept`, {});
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const converted = await api('POST', `/api/billing/quotes/${quote.body.quote.id}/convert`, {});
  assert.equal(converted.status, 201, JSON.stringify(converted.body));
  assert.equal(converted.body.invoice.amountKsh, 25000);

  const draftOnly = await api('POST', '/api/billing/reset', { confirm: 'RESET BILLING' });
  assert.equal(draftOnly.status, 200, 'a draft invoice alone should not block the reset');

  const customer2 = await newCustomer('Issued School', 'issued-school');
  const quote2 = await api('POST', '/api/billing/quotes', { customerId: customer2.id, schoolType: 'private' });
  await api('POST', `/api/billing/quotes/${quote2.body.quote.id}/accept`, {});
  const converted2 = await api('POST', `/api/billing/quotes/${quote2.body.quote.id}/convert`, {});
  const dated = await api('PUT', `/api/billing/invoices/${converted2.body.invoice.id}`, { dueDate: '2099-01-31', termsNote: '' });
  assert.equal(dated.status, 200, JSON.stringify(dated.body));
  const issued = await api('POST', `/api/billing/invoices/${converted2.body.invoice.id}/issue`, {});
  assert.equal(issued.status, 200, JSON.stringify(issued.body));

  const blocked = await api('POST', '/api/billing/reset', { confirm: 'RESET BILLING' });
  assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
  assert.match(blocked.body.error, /cannot be reset/);

  const stillThere = await api('GET', '/api/billing/invoices');
  assert.equal(stillThere.body.invoices.length, 1, 'nothing may be deleted when the reset is refused');
});
