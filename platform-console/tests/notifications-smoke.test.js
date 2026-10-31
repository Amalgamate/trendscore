'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-smoke-test-'));
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

const EXPECTED_TABLES = [
  'notification_templates',
  'notification_routes',
  'notification_outbox',
  'notification_attempts',
  'suppressions',
];

for (const tableName of EXPECTED_TABLES) {
  test(`table ${tableName} exists after migrations`, () => {
    const env = setup();
    try {
      const row = env.db.prepare(
        "SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name=?"
      ).get(tableName);
      assert.ok(row, `table ${tableName} was not created by migration 008`);
    } finally { cleanup(env); }
  });
}
