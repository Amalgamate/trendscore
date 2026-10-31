'use strict';

// L2C-1-16 — Background job runner with lease-lock, retry/backoff, graceful shutdown.
// Uses node:sqlite (synchronous DatabaseSync) and setInterval for polling.
// Each registered handler is called synchronously inside a BEGIN IMMEDIATE lease.
//
// Job lifecycle:  pending → running → done | failed
// Retry backoff: default (attempts^2) minutes, or a custom backoffFn(attempts) → ms
// (backoffFn is injectable so tests can use 0ms backoff without real waits).

const crypto = require('crypto');

const DEFAULT_BACKOFF_FN = (attempts) => attempts * attempts * 60 * 1000; // minutes

/**
 * @typedef {{
 *   id: string, type: string, payload: object,
 *   status: string, attempts: number, max_attempts: number,
 *   run_after: string, leased_until: string|null, leased_by: string|null,
 *   last_error: string|null, created_at: string, updated_at: string
 * }} Job
 */

class JobRunner {
  constructor() {
    this._handlers = new Map();
    this._timer = null;
    this._db = null;
    this._workerName = 'worker';
    this._backoffFn = DEFAULT_BACKOFF_FN;
    this._running = false;
  }

  /**
   * Register a handler for a job type.
   * @param {string} type
   * @param {(payload: object) => void} handler - synchronous; throw to signal failure
   */
  register(type, handler) {
    this._handlers.set(type, handler);
    return this;
  }

  /**
   * Start polling.
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {{ workerName?: string, pollIntervalMs?: number, backoffFn?: function }} opts
   */
  start(db, { workerName = 'worker', pollIntervalMs = 5000, backoffFn } = {}) {
    if (this._running) return;
    this._db = db;
    this._workerName = workerName;
    if (backoffFn) this._backoffFn = backoffFn;
    this._running = true;
    this._timer = setInterval(() => this._poll(), pollIntervalMs);
    // Unref so the interval doesn't keep the process alive on its own.
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._running = false;
  }

  /** Enqueue a job. Returns the new job id. */
  enqueue(db, type, payload = {}, { runAfter, maxAttempts = 5 } = {}) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const ra = runAfter instanceof Date ? runAfter.toISOString() : (runAfter || now);
    db.prepare(`INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, run_after, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?)`)
      .run(id, type, JSON.stringify(payload), maxAttempts, ra, now, now);
    return id;
  }

  /** Returns { pending, running, failed } counts. */
  counts(db) {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM jobs GROUP BY status`
    ).all();
    const m = { pending: 0, running: 0, failed: 0 };
    for (const r of rows) if (r.status in m) m[r.status] = r.n;
    return m;
  }

  _poll() {
    if (!this._db) return;
    let job = null;
    try {
      job = this._lease();
    } catch (e) {
      // Lease failed (contention is normal); try again next tick.
      return;
    }
    if (!job) return;
    this._run(job);
  }

  /** Atomically lease the next available job. Returns the job or null. */
  _lease() {
    const db = this._db;
    const now = new Date().toISOString();
    const leaseUntil = new Date(Date.now() + 60_000).toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      const job = db.prepare(
        `SELECT * FROM jobs
         WHERE status = 'pending'
           AND run_after <= ?
           AND (leased_until IS NULL OR leased_until < ?)
         ORDER BY run_after ASC
         LIMIT 1`
      ).get(now, now);

      if (!job) { db.exec('ROLLBACK'); return null; }

      db.prepare(
        `UPDATE jobs SET status = 'running', leased_until = ?, leased_by = ?, updated_at = ? WHERE id = ?`
      ).run(leaseUntil, this._workerName, now, job.id);

      db.exec('COMMIT');
      return { ...job, payload: JSON.parse(job.payload || '{}') };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  }

  _run(job) {
    const db = this._db;
    const handler = this._handlers.get(job.type);
    const now = new Date().toISOString();

    if (!handler) {
      // No handler registered — fail immediately.
      db.prepare(
        `UPDATE jobs SET status = 'failed', last_error = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?`
      ).run(`No handler registered for type '${job.type}'`, now, job.id);
      return;
    }

    try {
      handler(job.payload);
      db.prepare(
        `UPDATE jobs SET status = 'done', leased_until = NULL, leased_by = NULL, updated_at = ? WHERE id = ?`
      ).run(now, job.id);
    } catch (err) {
      const nextAttempts = job.attempts + 1;
      const backoffMs = this._backoffFn(nextAttempts);
      const runAfter = new Date(Date.now() + backoffMs).toISOString();
      const newStatus = nextAttempts >= job.max_attempts ? 'failed' : 'pending';

      db.prepare(
        `UPDATE jobs
         SET status = ?, attempts = ?, last_error = ?, run_after = ?,
             leased_until = NULL, leased_by = NULL, updated_at = ?
         WHERE id = ?`
      ).run(newStatus, nextAttempts, err.message, runAfter, now, job.id);
    }
  }
}

module.exports = { JobRunner };
