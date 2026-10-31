'use strict';

// Ordered list of schema migrations for the platform billing database.
// RULES (see docs/lead-to-cash/phase1-notes.md):
//   - never edit or reorder a migration after it has been applied anywhere; add a new one
//   - versions are consecutive from 1; every migration needs rollback notes
//   - table rebuilds (SQLite cannot drop NOT NULL or change a CHECK in place) set foreignKeys: false
//     and follow the create-copy-drop-rename recipe; the runner takes a backup first and checks foreign keys after

const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline',
    notes: 'Marks the schema as it was before the migration runner existed (tables created inline in billing-store.js). It changes nothing, so there is nothing to undo.',
    up() {},
  },
  {
    version: 2,
    name: 'number-sequences',
    notes: 'Drop the number_sequences table to undo.',
    up(db) {
      db.exec(`CREATE TABLE number_sequences (
        prefix   TEXT PRIMARY KEY,
        year     INTEGER NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0
      )`);
      // Seed INV from existing max invoice number (extract trailing digits of INV-YYYY-NNNNNN pattern).
      // Extract trailing 6-digit sequence from INV-YYYY-NNNNNN format.
      // SQLite INSTR() only takes 2 args; use SUBSTR+LENGTH to find the last segment.
      const row = db.prepare(
        `SELECT MAX(CAST(SUBSTR(invoice_number, LENGTH(invoice_number) - 5) AS INTEGER)) AS max_seq
         FROM billing_invoices WHERE invoice_number LIKE 'INV-____-______'`
      ).get();
      const maxSeq = (row && row.max_seq) ? row.max_seq : 0;
      const year = new Date().getUTCFullYear();
      db.prepare('INSERT OR IGNORE INTO number_sequences (prefix, year, last_seq) VALUES (?,?,?)').run('INV', year, maxSeq);
      for (const p of ['CN', 'RCT', 'QTE']) {
        db.prepare('INSERT OR IGNORE INTO number_sequences (prefix, year, last_seq) VALUES (?,?,0)').run(p, year);
      }
    },
  },
  {
    version: 3,
    name: 'domain-events',
    notes: 'DROP TABLE domain_events to undo.',
    up(db) {
      db.exec(`CREATE TABLE domain_events (
        id               TEXT PRIMARY KEY,
        type             TEXT NOT NULL,
        aggregate_type   TEXT NOT NULL DEFAULT '',
        aggregate_id     TEXT NOT NULL DEFAULT '',
        payload          TEXT NOT NULL DEFAULT '{}',
        actor            TEXT NOT NULL DEFAULT '',
        created_at       TEXT NOT NULL,
        idempotency_key  TEXT UNIQUE
      )`);
    },
  },
  {
    version: 4,
    name: 'audit-events',
    notes: 'DROP TABLE audit_events to undo.',
    up(db) {
      db.exec(`CREATE TABLE audit_events (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type     TEXT NOT NULL,
        aggregate_type TEXT NOT NULL DEFAULT '',
        aggregate_id   TEXT NOT NULL DEFAULT '',
        actor          TEXT NOT NULL DEFAULT '',
        payload        TEXT NOT NULL DEFAULT '{}',
        created_at     TEXT NOT NULL,
        prev_hash      TEXT NOT NULL DEFAULT '',
        row_hash       TEXT NOT NULL
      )`);
    },
  },
  {
    version: 5,
    name: 'jobs',
    notes: 'DROP TABLE jobs to undo.',
    up(db) {
      db.exec(`CREATE TABLE jobs (
        id           TEXT PRIMARY KEY,
        type         TEXT NOT NULL,
        payload      TEXT NOT NULL DEFAULT '{}',
        status       TEXT NOT NULL DEFAULT 'pending',
        attempts     INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        run_after    TEXT NOT NULL,
        leased_until TEXT,
        leased_by    TEXT,
        last_error   TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      )`);
      db.exec(`CREATE INDEX idx_jobs_poll ON jobs (status, run_after, leased_until)`);
    },
  },
];

module.exports = { MIGRATIONS };
