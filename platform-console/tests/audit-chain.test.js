'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');
const { appendAuditEvent, verifyChain } = require('../services/audit-chain');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  const db = new DatabaseSync(path.join(dir, 'test.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`CREATE TABLE billing_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT
  )`);
  runMigrations(db, { dataDir: dir, migrations: MIGRATIONS });
  return { dir, db };
}

function cleanup({ dir, db }) {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

test('normal chain of 5 events: verifyChain returns {ok: true, firstBadId: null}', () => {
  const env = setup();
  try {
    for (let i = 1; i <= 5; i++) {
      appendAuditEvent(env.db, {
        eventType: 'invoice.created',
        aggregateType: 'Invoice',
        aggregateId: `inv-00${i}`,
        actor: 'admin',
        payload: { seq: i },
      });
    }
    assert.deepEqual(verifyChain(env.db), { ok: true, firstBadId: null });
  } finally { cleanup(env); }
});

test('tampered row 3 payload: verifyChain returns {ok: false, firstBadId: 3}', () => {
  const env = setup();
  try {
    for (let i = 1; i <= 5; i++) {
      appendAuditEvent(env.db, {
        eventType: 'invoice.created',
        aggregateId: `inv-00${i}`,
        actor: 'admin',
        payload: { seq: i },
      });
    }

    // Tamper row 3's payload directly (simulates DB-level tampering).
    env.db.prepare("UPDATE audit_events SET payload = '{\"tampered\":true}' WHERE id = 3").run();

    const result = verifyChain(env.db);
    assert.equal(result.ok, false);
    assert.equal(result.firstBadId, 3);
  } finally { cleanup(env); }
});

test('empty table: verifyChain returns {ok: true, firstBadId: null}', () => {
  const env = setup();
  try {
    assert.deepEqual(verifyChain(env.db), { ok: true, firstBadId: null });
  } finally { cleanup(env); }
});
