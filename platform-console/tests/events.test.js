'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');
const { appendEvent } = require('../services/events');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-test-'));
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

test('appendEvent writes a row with all provided fields', () => {
  const env = setup();
  try {
    const evt = appendEvent(env.db, {
      type: 'invoice.created',
      aggregateType: 'Invoice',
      aggregateId: 'inv-001',
      payload: { amount: 5000 },
      actor: 'user-1',
      idempotencyKey: 'ikey-001',
    });

    assert.ok(evt.id, 'should return an id');
    assert.equal(evt.type, 'invoice.created');
    assert.equal(evt.aggregateType, 'Invoice');
    assert.equal(evt.aggregateId, 'inv-001');
    assert.equal(evt.actor, 'user-1');
    assert.equal(evt.idempotencyKey, 'ikey-001');

    const row = env.db.prepare('SELECT * FROM domain_events WHERE id = ?').get(evt.id);
    assert.ok(row, 'row should exist in db');
    assert.equal(row.type, 'invoice.created');
    assert.equal(row.aggregate_id, 'inv-001');
    assert.equal(row.idempotency_key, 'ikey-001');
    assert.deepEqual(JSON.parse(row.payload), { amount: 5000 });
  } finally { cleanup(env); }
});

test('second event with same idempotency_key throws UNIQUE constraint error', () => {
  const env = setup();
  try {
    appendEvent(env.db, { type: 'invoice.created', idempotencyKey: 'dup-key' });
    assert.throws(
      () => appendEvent(env.db, { type: 'invoice.updated', idempotencyKey: 'dup-key' }),
      /UNIQUE constraint failed/i
    );
  } finally { cleanup(env); }
});

test('multiple events with null or undefined idempotencyKey all succeed (NULLs not UNIQUE-constrained)', () => {
  const env = setup();
  try {
    // undefined
    appendEvent(env.db, { type: 'a', idempotencyKey: undefined });
    // null
    appendEvent(env.db, { type: 'b', idempotencyKey: null });
    // omitted
    appendEvent(env.db, { type: 'c' });

    const count = env.db.prepare('SELECT COUNT(*) AS n FROM domain_events WHERE idempotency_key IS NULL').get();
    assert.equal(count.n, 3, 'all three NULL-key events should be stored');
  } finally { cleanup(env); }
});
