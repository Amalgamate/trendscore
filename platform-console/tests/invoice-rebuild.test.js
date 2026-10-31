'use strict';

// Tests for migrations v9 (invoice_lines) and v10 (billing_invoices rebuild).
// These use the full billing schema (billing_customers, billing_invoices, etc.)
// so data-preservation and FK integrity can be verified properly.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');

// Create a realistic billing schema matching billing-store.js's CREATE TABLE IF NOT EXISTS.
function setupFullSchema(db) {
  db.exec(`
    CREATE TABLE billing_customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', legal_name TEXT NOT NULL DEFAULT '',
      tenant_key TEXT NOT NULL DEFAULT '', billing_email TEXT NOT NULL DEFAULT '',
      billing_phone TEXT NOT NULL DEFAULT '', billing_address TEXT NOT NULL DEFAULT '',
      tax_identifier TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'KES',
      payment_terms TEXT NOT NULL DEFAULT 'net30', status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE billing_quotes (
      id TEXT PRIMARY KEY, quote_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES billing_customers(id),
      customer_snapshot TEXT NOT NULL DEFAULT '{}', quote_snapshot TEXT NOT NULL DEFAULT '{}',
      subtotal_ksh INTEGER NOT NULL DEFAULT 0, enrollment_count INTEGER,
      status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      expires_on TEXT NOT NULL DEFAULT '', sent_at TEXT NOT NULL DEFAULT '',
      email_message_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE billing_invoices (
      id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE,
      quote_id TEXT NOT NULL UNIQUE REFERENCES billing_quotes(id) ON DELETE RESTRICT,
      customer_id TEXT NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
      invoice_snapshot TEXT NOT NULL DEFAULT '{}', amount_ksh INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','sent','paid','void')),
      created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-rebuild-test-'));
  const db = new DatabaseSync(path.join(dir, 'test.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  setupFullSchema(db);
  return { dir, db };
}

function cleanup({ dir, db }) {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

test('invoice_lines table exists after migration v9', () => {
  const env = setup();
  try {
    runMigrations(env.db, { dataDir: env.dir, migrations: MIGRATIONS });
    const row = env.db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_invoice_lines'"
    ).get();
    assert.ok(row, 'billing_invoice_lines table should exist');
  } finally { cleanup(env); }
});

test('v10 preserves row count and all columns from existing invoices', () => {
  const env = setup();
  try {
    // Seed before migrations (migrations v1-8 don't touch billing_invoices data).
    env.db.prepare(
      `INSERT INTO billing_customers (id, name, created_at, updated_at) VALUES ('c1', 'Acme', datetime('now'), datetime('now'))`
    ).run();
    env.db.prepare(
      `INSERT INTO billing_quotes (id, quote_number, customer_id, created_at, updated_at)
       VALUES ('q1', 'QTE-2026-000001', 'c1', datetime('now'), datetime('now'))`
    ).run();
    env.db.prepare(
      `INSERT INTO billing_invoices (id, invoice_number, quote_id, customer_id, amount_ksh, status, created_by, created_at, updated_at)
       VALUES ('inv1', 'INV-2026-000001', 'q1', 'c1', 60500, 'issued', 'admin@test', datetime('now'), datetime('now'))`
    ).run();

    runMigrations(env.db, { dataDir: env.dir, migrations: MIGRATIONS });

    // Row count preserved.
    const count = env.db.prepare('SELECT COUNT(*) AS n FROM billing_invoices').get().n;
    assert.equal(count, 1, 'row count should be unchanged');

    // Data preserved.
    const row = env.db.prepare('SELECT * FROM billing_invoices WHERE id=?').get('inv1');
    assert.equal(row.invoice_number, 'INV-2026-000001');
    assert.equal(row.quote_id, 'q1');
    assert.equal(row.customer_id, 'c1');
    assert.equal(row.amount_ksh, 60500);
    assert.equal(row.status, 'issued');
    assert.equal(row.created_by, 'admin@test');

    // New columns present with defaults.
    assert.ok('contract_id' in row, 'contract_id column should exist');
    assert.ok('invoice_type' in row, 'invoice_type column should exist');
    assert.equal(row.invoice_type, 'onboarding');
    assert.ok('issued_at' in row, 'issued_at should exist');
    assert.ok('due_date' in row, 'due_date should exist');
    assert.ok('settlement_status' in row, 'settlement_status should exist');
    assert.equal(row.settlement_status, 'unpaid');
  } finally { cleanup(env); }
});

test('v10 allows quote_id to be NULL (new invoices without a quote)', () => {
  const env = setup();
  try {
    runMigrations(env.db, { dataDir: env.dir, migrations: MIGRATIONS });
    env.db.prepare(
      `INSERT INTO billing_customers (id, name, created_at, updated_at) VALUES ('c2', 'Beta', datetime('now'), datetime('now'))`
    ).run();
    // Insert without quote_id — should succeed after the rebuild.
    env.db.prepare(
      `INSERT INTO billing_invoices (id, invoice_number, quote_id, customer_id, amount_ksh, created_at, updated_at)
       VALUES ('inv2', 'INV-2026-000002', NULL, 'c2', 55000, datetime('now'), datetime('now'))`
    ).run();
    const row = env.db.prepare('SELECT quote_id FROM billing_invoices WHERE id=?').get('inv2');
    assert.equal(row.quote_id, null, 'quote_id should be nullable after rebuild');
  } finally { cleanup(env); }
});

test('v10 partial unique index prevents duplicate (contract_id, period_key)', () => {
  const env = setup();
  try {
    runMigrations(env.db, { dataDir: env.dir, migrations: MIGRATIONS });
    env.db.prepare(
      `INSERT INTO billing_customers (id, name, created_at, updated_at) VALUES ('c3', 'Gamma', datetime('now'), datetime('now'))`
    ).run();
    env.db.prepare(
      `INSERT INTO billing_invoices (id, invoice_number, contract_id, period_key, customer_id, created_at, updated_at)
       VALUES ('i1', 'INV-2026-000010', 'ct1', '2026-T1', 'c3', datetime('now'), datetime('now'))`
    ).run();
    // Duplicate (contract_id, period_key) should throw.
    assert.throws(() => {
      env.db.prepare(
        `INSERT INTO billing_invoices (id, invoice_number, contract_id, period_key, customer_id, created_at, updated_at)
         VALUES ('i2', 'INV-2026-000011', 'ct1', '2026-T1', 'c3', datetime('now'), datetime('now'))`
      ).run();
    }, /UNIQUE constraint failed/i);
    // NULL period_key is allowed multiple times (partial index excludes NULLs).
    env.db.prepare(
      `INSERT INTO billing_invoices (id, invoice_number, contract_id, period_key, customer_id, created_at, updated_at)
       VALUES ('i3', 'INV-2026-000012', 'ct1', NULL, 'c3', datetime('now'), datetime('now'))`
    ).run();
    env.db.prepare(
      `INSERT INTO billing_invoices (id, invoice_number, contract_id, period_key, customer_id, created_at, updated_at)
       VALUES ('i4', 'INV-2026-000013', 'ct1', NULL, 'c3', datetime('now'), datetime('now'))`
    ).run();
    const count = env.db.prepare('SELECT COUNT(*) AS n FROM billing_invoices WHERE period_key IS NULL').get().n;
    assert.equal(count, 2, 'two NULL-period_key rows should coexist');
  } finally { cleanup(env); }
});

test('invoice_lines FK to billing_invoices is enforced', () => {
  const env = setup();
  try {
    runMigrations(env.db, { dataDir: env.dir, migrations: MIGRATIONS });
    assert.throws(() => {
      env.db.prepare(
        `INSERT INTO billing_invoice_lines (id, invoice_id, description, unit_price_ksh, amount_ksh, created_at)
         VALUES ('l1', 'nonexistent-id', 'Setup', 10000, 10000, datetime('now'))`
      ).run();
    }, /FOREIGN KEY constraint failed/i);
  } finally { cleanup(env); }
});
