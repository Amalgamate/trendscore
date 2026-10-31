'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../billing-migrate');
const { MIGRATIONS } = require('../billing-migrations');
const { JobRunner } = require('../services/job-runner');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-test-'));
  const db = new DatabaseSync(path.join(dir, 'test.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`CREATE TABLE billing_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT)`);
  runMigrations(db, { dataDir: dir, migrations: MIGRATIONS });
  return { dir, db };
}

function cleanup({ dir, db }) {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

test('job runs exactly once with two runners on the same db', (t, done) => {
  const env = setup();
  let execCount = 0;
  const r1 = new JobRunner();
  const r2 = new JobRunner();

  r1.register('ping', () => { execCount++; });
  r2.register('ping', () => { execCount++; });

  r1.enqueue(env.db, 'ping', { msg: 'hello' });

  // Zero backoff so retries are instant in tests.
  r1.start(env.db, { workerName: 'w1', pollIntervalMs: 20, backoffFn: () => 0 });
  r2.start(env.db, { workerName: 'w2', pollIntervalMs: 20, backoffFn: () => 0 });

  setTimeout(() => {
    r1.stop(); r2.stop();
    try {
      assert.equal(execCount, 1, 'job should run exactly once despite two workers');
      const row = env.db.prepare('SELECT status FROM jobs').get();
      assert.equal(row.status, 'done');
    } finally { cleanup(env); }
    done();
  }, 200);
});

test('a failing handler retries and eventually reaches status=failed', (t, done) => {
  const env = setup();
  const runner = new JobRunner();
  let attempts = 0;

  runner.register('flaky', () => { attempts++; throw new Error('always fails'); });
  runner.enqueue(env.db, 'flaky', {}, { maxAttempts: 3 });
  runner.start(env.db, { workerName: 'w1', pollIntervalMs: 20, backoffFn: () => 0 });

  // Give it enough time to exhaust 3 attempts at 20ms poll intervals.
  setTimeout(() => {
    runner.stop();
    try {
      assert.equal(attempts, 3, 'handler should have been called 3 times');
      const row = env.db.prepare('SELECT status, attempts FROM jobs').get();
      assert.equal(row.status, 'failed');
      assert.equal(row.attempts, 3);
    } finally { cleanup(env); }
    done();
  }, 500);
});

test('counts() returns correct pending/running/failed numbers', () => {
  const env = setup();
  const runner = new JobRunner();
  try {
    runner.enqueue(env.db, 'a', {});
    runner.enqueue(env.db, 'b', {});
    const counts = runner.counts(env.db);
    assert.equal(counts.pending, 2);
    assert.equal(counts.running, 0);
    assert.equal(counts.failed, 0);
  } finally { cleanup(env); }
});

test('enqueue with runAfter in the future is not picked up immediately', (t, done) => {
  const env = setup();
  let ran = false;
  const runner = new JobRunner();
  runner.register('future', () => { ran = true; });

  const future = new Date(Date.now() + 60_000); // 60 seconds from now
  runner.enqueue(env.db, 'future', {}, { runAfter: future });
  runner.start(env.db, { workerName: 'w1', pollIntervalMs: 20, backoffFn: () => 0 });

  setTimeout(() => {
    runner.stop();
    try {
      assert.equal(ran, false, 'future job should not run yet');
      const row = env.db.prepare('SELECT status FROM jobs').get();
      assert.equal(row.status, 'pending');
    } finally { cleanup(env); }
    done();
  }, 150);
});
