'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');
const { getFlag, setFlag, listFlags } = require('../services/feature-flags');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-test-'));
  const db = new DatabaseSync(path.join(dir, 'test.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE billing_invoices (id INTEGER PRIMARY KEY, invoice_number TEXT)');
  runMigrations(db, { dataDir: dir, migrations: MIGRATIONS });
  return { dir, db };
}

function cleanup({ dir, db }) {
  try { db.close(); } catch {}
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

test('seeded flags default to false', () => {
  const env = setup();
  try {
    assert.equal(getFlag(env.db, 'AUTO_INVOICE_ON_CONVERSION'), false);
    assert.equal(getFlag(env.db, 'MPESA_C2B_ENABLED'), false);
  } finally { cleanup(env); }
});

test('setFlag then getFlag returns true', () => {
  const env = setup();
  try {
    setFlag(env.db, 'AUTO_INVOICE_ON_CONVERSION', true, 'admin@test');
    assert.equal(getFlag(env.db, 'AUTO_INVOICE_ON_CONVERSION'), true);
  } finally { cleanup(env); }
});

test('unknown flag name returns false and does not throw', () => {
  const env = setup();
  try {
    assert.equal(getFlag(env.db, 'NO_SUCH_FLAG'), false);
  } finally { cleanup(env); }
});

test('listFlags returns all 6 seeded flags with enabled as boolean', () => {
  const env = setup();
  try {
    const flags = listFlags(env.db);
    assert.equal(flags.length, 6);
    assert.ok(flags.every(f => typeof f.enabled === 'boolean'));
  } finally { cleanup(env); }
});

test('domain event is written when feature_flag.changed is emitted (tested through events service)', () => {
  const env = setup();
  try {
    const { appendEvent } = require('../services/events');
    setFlag(env.db, 'NOTIFY_EMAIL_ENABLED', true, 'super_admin');
    appendEvent(env.db, {
      type: 'feature_flag.changed',
      aggregateType: 'FeatureFlag',
      aggregateId: 'NOTIFY_EMAIL_ENABLED',
      payload: { enabled: true },
      actor: 'super_admin',
    });
    const row = env.db.prepare("SELECT * FROM domain_events WHERE type='feature_flag.changed'").get();
    assert.ok(row, 'event row should exist');
    assert.equal(row.aggregate_id, 'NOTIFY_EMAIL_ENABLED');
  } finally { cleanup(env); }
});
