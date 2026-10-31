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
  {
    version: 6,
    name: 'feature-flags',
    notes: 'DROP TABLE feature_flags to undo.',
    up(db) {
      db.exec(`CREATE TABLE feature_flags (
        name        TEXT PRIMARY KEY,
        enabled     INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        updated_at  TEXT NOT NULL,
        updated_by  TEXT NOT NULL DEFAULT 'system'
      )`);
      const now = new Date().toISOString();
      const flags = [
        'AUTO_INVOICE_ON_CONVERSION',
        'AUTO_ISSUE_ENABLED',
        'NOTIFY_EMAIL_ENABLED',
        'NOTIFY_SMS_ENABLED',
        'MPESA_C2B_ENABLED',
        'AGENT_COMMISSIONS_ENABLED',
      ];
      for (const name of flags) {
        db.prepare(
          `INSERT INTO feature_flags (name, enabled, description, updated_at, updated_by)
           VALUES (?, 0, '', ?, 'system')`
        ).run(name, now);
      }
    },
  },
  {
    version: 7,
    name: 'term-calendar',
    notes: 'DROP TABLE term_calendar to undo.',
    up(db) {
      db.exec(`CREATE TABLE term_calendar (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        year         INTEGER NOT NULL,
        term         INTEGER NOT NULL,
        start_date   TEXT NOT NULL,
        end_date     TEXT NOT NULL,
        billing_date TEXT NOT NULL,
        due_date     TEXT NOT NULL,
        UNIQUE (year, term)
      )`);
      // Seed Kenya MoE 2026-2027 calendar rows
      // billing_date = start_date minus 14 days; due_date = start_date plus 14 days
      const rows = [
        [2026, 1, '2026-01-05', '2026-04-03'],
        [2026, 2, '2026-04-27', '2026-07-17'],
        [2026, 3, '2026-09-07', '2026-11-06'],
        [2027, 1, '2027-01-04', '2027-04-02'],
        [2027, 2, '2027-04-26', '2027-07-16'],
        [2027, 3, '2027-09-06', '2027-11-05'],
      ];
      const ins = db.prepare(
        `INSERT INTO term_calendar
           (year, term, start_date, end_date, billing_date, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const [year, term, start, end] of rows) {
        const startMs = new Date(start + 'T00:00:00Z').getTime();
        const billingDate = new Date(startMs - 14 * 86400000).toISOString().slice(0, 10);
        const dueDate    = new Date(startMs + 14 * 86400000).toISOString().slice(0, 10);
        ins.run(year, term, start, end, billingDate, dueDate);
      }
    },
  },
  {
    version: 8,
    name: 'notification-tables',
    notes: 'DROP TABLE notification_attempts; DROP TABLE suppressions; DROP TABLE notification_outbox; DROP TABLE notification_routes; DROP TABLE notification_templates to undo (in that order).',
    up(db) {
      db.exec(`
        CREATE TABLE notification_templates (
          id TEXT PRIMARY KEY, channel TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en',
          subject TEXT, body_text TEXT NOT NULL, body_html TEXT, version INTEGER NOT NULL DEFAULT 1,
          active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
        );
        CREATE TABLE notification_routes (
          id TEXT PRIMARY KEY, event_type TEXT NOT NULL, recipient_role TEXT NOT NULL,
          channel TEXT NOT NULL, template_id TEXT NOT NULL, send_type TEXT NOT NULL DEFAULT 'T',
          severity TEXT NOT NULL DEFAULT 'info', batch INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE notification_outbox (
          id TEXT PRIMARY KEY, event_id TEXT, channel TEXT NOT NULL,
          recipient_address TEXT NOT NULL, recipient_role TEXT, template_id TEXT, template_version INTEGER,
          payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, provider_id TEXT,
          error TEXT, cost_units INTEGER, dedupe_key TEXT UNIQUE,
          created_at TEXT NOT NULL, sent_at TEXT, delivered_at TEXT
        );
        CREATE TABLE notification_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT, outbox_id TEXT NOT NULL,
          attempted_at TEXT NOT NULL, outcome TEXT NOT NULL, provider_id TEXT, error TEXT
        );
        CREATE TABLE suppressions (
          address TEXT NOT NULL, channel TEXT NOT NULL, reason TEXT NOT NULL,
          suppressed_at TEXT NOT NULL, PRIMARY KEY (address, channel)
        )
      `);
    },
  },
];

module.exports = { MIGRATIONS };
