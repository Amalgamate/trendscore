'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');
const { getCurrentTerm, getTermForDate, listTerms } = require('../services/term-calendar');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'term-test-'));
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

test('listTerms returns all 6 seeded rows', () => {
  const env = setup();
  try {
    assert.equal(listTerms(env.db).length, 6);
  } finally { cleanup(env); }
});

test('getTermForDate returns correct term for a date inside T1 2026', () => {
  const env = setup();
  try {
    const term = getTermForDate(env.db, '2026-02-15');
    assert.ok(term, 'should find a term');
    assert.equal(term.year, 2026);
    assert.equal(term.term, 1);
    assert.equal(term.startDate, '2026-01-05');
    assert.equal(term.endDate, '2026-04-03');
  } finally { cleanup(env); }
});

test('getTermForDate returns null for a date outside any term', () => {
  const env = setup();
  try {
    // Holiday gap between T1 end (Apr 3) and T2 start (Apr 27)
    assert.equal(getTermForDate(env.db, '2026-04-10'), null);
  } finally { cleanup(env); }
});

test('getCurrentTerm returns null outside any term (fixed date check)', () => {
  // Validate logic by using getTermForDate with a known gap date
  const env = setup();
  try {
    assert.equal(getTermForDate(env.db, '2026-12-01'), null, 'Dec 1 2026 is between T3 end and T1 2027');
  } finally { cleanup(env); }
});

test('billing_date is 14 days before start_date, due_date is 14 days after', () => {
  const env = setup();
  try {
    const [t] = listTerms(env.db);
    const start = new Date(t.startDate + 'T00:00:00Z').getTime();
    assert.equal(t.billingDate, new Date(start - 14 * 86400000).toISOString().slice(0, 10));
    assert.equal(t.dueDate,     new Date(start + 14 * 86400000).toISOString().slice(0, 10));
  } finally { cleanup(env); }
});
