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
  {
    version: 9,
    name: 'invoice-lines',
    notes: 'DROP TABLE billing_invoice_lines to undo.',
    up(db) {
      db.exec(`
        CREATE TABLE billing_invoice_lines (
          id           TEXT PRIMARY KEY,
          invoice_id   TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
          description  TEXT NOT NULL,
          quantity     INTEGER NOT NULL DEFAULT 1,
          unit_price_ksh INTEGER NOT NULL,
          amount_ksh   INTEGER NOT NULL,
          tax_code     TEXT NOT NULL DEFAULT '',
          product_code TEXT NOT NULL DEFAULT '',
          cadence      TEXT NOT NULL DEFAULT '',
          sort_order   INTEGER NOT NULL DEFAULT 0,
          created_at   TEXT NOT NULL
        );
        CREATE INDEX idx_invoice_lines_invoice ON billing_invoice_lines (invoice_id);
      `);
    },
  },
  {
    version: 10,
    name: 'billing-invoices-rebuild',
    notes: 'Rollback: ALTER TABLE billing_invoices RENAME TO billing_invoices_v10; recreate original (quote_id TEXT NOT NULL UNIQUE, no new columns); INSERT id/invoice_number/quote_id/customer_id/invoice_snapshot/amount_ksh/status/created_by/created_at/updated_at/cancel_reason/cancelled_by SELECT from _v10; DROP billing_invoices_v10.',
    foreignKeys: false,
    up(db) {
      const cols = db.prepare('PRAGMA table_info(billing_invoices)').all().map(r => r.name);
      // Check whether billing_customers exists — test dbs may not have it.
      const hasCustomersTable = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_customers'"
      ).get();
      const customerFk = hasCustomersTable
        ? 'REFERENCES billing_customers(id) ON DELETE RESTRICT'
        : '';

      db.exec(`
        CREATE TABLE billing_invoices_new (
          id                TEXT PRIMARY KEY,
          invoice_number    TEXT NOT NULL UNIQUE,
          quote_id          TEXT,
          contract_id       TEXT,
          invoice_type      TEXT NOT NULL DEFAULT 'onboarding',
          period_key        TEXT,
          customer_id       TEXT NOT NULL ${customerFk},
          invoice_snapshot  TEXT NOT NULL DEFAULT '{}',
          amount_ksh        INTEGER NOT NULL DEFAULT 0,
          status            TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','issued','sent','paid','void','credited')),
          settlement_status TEXT NOT NULL DEFAULT 'unpaid'
                              CHECK (settlement_status IN ('unpaid','partial','paid','credited')),
          issued_at         TEXT NOT NULL DEFAULT '',
          due_date          TEXT NOT NULL DEFAULT '',
          cancel_reason     TEXT NOT NULL DEFAULT '',
          cancelled_by      TEXT NOT NULL DEFAULT '',
          created_by        TEXT NOT NULL DEFAULT '',
          created_at        TEXT NOT NULL,
          updated_at        TEXT NOT NULL
        )
      `);

      // 3. Copy all existing rows — read columns dynamically because test setups
      //    may create a minimal billing_invoices with only a subset of columns.
      const hasCancelReason  = cols.includes('cancel_reason');
      const hasCancelledBy   = cols.includes('cancelled_by');
      const hasQuoteId       = cols.includes('quote_id');
      const hasCustomerId    = cols.includes('customer_id');
      const hasInvSnapshot   = cols.includes('invoice_snapshot');
      const hasAmountKsh     = cols.includes('amount_ksh');
      const hasStatus        = cols.includes('status');
      const hasCreatedBy     = cols.includes('created_by');
      const hasCreatedAt     = cols.includes('created_at');
      const hasUpdatedAt     = cols.includes('updated_at');

      db.prepare(`
        INSERT INTO billing_invoices_new
          (id, invoice_number, quote_id, customer_id, invoice_snapshot,
           amount_ksh, status, cancel_reason, cancelled_by,
           created_by, created_at, updated_at)
        SELECT
          id,
          ${cols.includes('invoice_number') ? 'invoice_number' : "''"},
          ${hasQuoteId      ? 'quote_id'       : 'NULL'},
          ${hasCustomerId   ? 'customer_id'    : "'unknown'"},
          ${hasInvSnapshot  ? 'invoice_snapshot' : "'{}'"},
          ${hasAmountKsh    ? 'amount_ksh'     : '0'},
          ${hasStatus       ? 'status'         : "'draft'"},
          ${hasCancelReason ? 'cancel_reason'  : "''"},
          ${hasCancelledBy  ? 'cancelled_by'   : "''"},
          ${hasCreatedBy    ? 'created_by'     : "''"},
          ${hasCreatedAt    ? 'created_at'     : "datetime('now')"},
          ${hasUpdatedAt    ? 'updated_at'     : "datetime('now')"}
        FROM billing_invoices
      `).run();

      db.exec(`
        DROP TABLE billing_invoices;
        ALTER TABLE billing_invoices_new RENAME TO billing_invoices;
        CREATE INDEX billing_invoices_customer_idx
          ON billing_invoices (customer_id, created_at DESC);
        CREATE UNIQUE INDEX idx_invoices_contract_period
          ON billing_invoices (contract_id, period_key)
          WHERE period_key IS NOT NULL AND contract_id IS NOT NULL;
      `);
    },
  },
  {
    version: 11,
    name: 'payments-rebuild',
    notes: 'Rollback: ALTER TABLE billing_payments RENAME TO billing_payments_v11; recreate original (invoice_id NOT NULL, method CHECK(mpesa|bank_transfer|cash|cheque|other), no new columns); INSERT id/invoice_id/amount_ksh/payment_date/method/reference/notes/recorded_by/created_at SELECT FROM billing_payments_v11; DROP billing_payments_v11; DROP payment_allocations; DROP customer_credits.',
    foreignKeys: false,
    up(db) {
      const hasCustomersTable = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_customers'"
      ).get();
      const hasInvoicesTable = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_invoices'"
      ).get();
      const invoiceFk  = hasInvoicesTable  ? 'REFERENCES billing_invoices(id) ON DELETE RESTRICT'  : '';
      const customerFk = hasCustomersTable ? 'REFERENCES billing_customers(id) ON DELETE RESTRICT' : '';

      // Rebuild billing_payments only if it exists (minimal test dbs may not have it).
      const paymentsExists = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_payments'"
      ).get();

      if (paymentsExists) {
        const cols = db.prepare('PRAGMA table_info(billing_payments)').all().map(r => r.name);
        const hasInvoiceId   = cols.includes('invoice_id');
        const hasPaymentDate = cols.includes('payment_date');
        const hasMethod      = cols.includes('method');
        const hasReference   = cols.includes('reference');
        const hasNotes       = cols.includes('notes');
        const hasRecordedBy  = cols.includes('recorded_by');
        const hasCreatedAt   = cols.includes('created_at');

        db.exec(`
          CREATE TABLE billing_payments_new (
            id             TEXT PRIMARY KEY,
            invoice_id     TEXT ${invoiceFk},
            customer_id    TEXT NOT NULL DEFAULT '',
            amount_ksh     INTEGER NOT NULL CHECK (amount_ksh > 0),
            payment_date   TEXT NOT NULL DEFAULT '',
            method         TEXT NOT NULL DEFAULT 'manual',
            reference      TEXT NOT NULL DEFAULT '',
            notes          TEXT NOT NULL DEFAULT '',
            recorded_by    TEXT NOT NULL DEFAULT '',
            status         TEXT NOT NULL DEFAULT 'confirmed',
            source         TEXT NOT NULL DEFAULT 'manual',
            provider_tx_id TEXT,
            payer_phone    TEXT,
            bill_ref_raw   TEXT,
            raw_payload    TEXT NOT NULL DEFAULT '{}',
            created_at     TEXT NOT NULL,
            updated_at     TEXT NOT NULL DEFAULT ''
          )
        `);

        db.prepare(`
          INSERT INTO billing_payments_new
            (id, invoice_id, amount_ksh, payment_date, method, reference,
             notes, recorded_by, created_at)
          SELECT
            id,
            ${hasInvoiceId   ? 'invoice_id'   : 'NULL'},
            amount_ksh,
            ${hasPaymentDate ? 'payment_date' : "''"},
            ${hasMethod      ? 'method'       : "'manual'"},
            ${hasReference   ? 'reference'    : "''"},
            ${hasNotes       ? 'notes'        : "''"},
            ${hasRecordedBy  ? 'recorded_by'  : "''"},
            ${hasCreatedAt   ? 'created_at'   : "datetime('now')"}
          FROM billing_payments
        `).run();

        db.exec(`
          DROP TABLE billing_payments;
          ALTER TABLE billing_payments_new RENAME TO billing_payments;
          CREATE INDEX billing_payments_invoice_idx
            ON billing_payments (invoice_id, payment_date DESC);
          CREATE UNIQUE INDEX billing_payments_reference_unique
            ON billing_payments (method, lower(reference))
            WHERE reference <> '';
          CREATE UNIQUE INDEX idx_payments_provider_tx
            ON billing_payments (source, provider_tx_id)
            WHERE provider_tx_id IS NOT NULL;
        `);
      }

      // payment_allocations and customer_credits are always created.
      db.exec(`
        CREATE TABLE payment_allocations (
          id          TEXT PRIMARY KEY,
          payment_id  TEXT NOT NULL,
          invoice_id  TEXT NOT NULL,
          amount_ksh  INTEGER NOT NULL,
          created_at  TEXT NOT NULL,
          UNIQUE (payment_id, invoice_id)
        );
        CREATE INDEX idx_allocations_payment ON payment_allocations (payment_id);
        CREATE INDEX idx_allocations_invoice ON payment_allocations (invoice_id);

        CREATE TABLE customer_credits (
          id           TEXT PRIMARY KEY,
          customer_id  TEXT NOT NULL DEFAULT '',
          amount_ksh   INTEGER NOT NULL,
          reason       TEXT NOT NULL,
          reference_id TEXT,
          created_by   TEXT NOT NULL DEFAULT 'system',
          created_at   TEXT NOT NULL
        );
        CREATE INDEX idx_credits_customer ON customer_credits (customer_id);
      `);
    },
  },
  {
    version: 12,
    name: 'contract-additions',
    notes: 'ALTER TABLE billing_contracts DROP COLUMN is not supported in old SQLite; to undo, rebuild the table dropping school_type/own_sms_provider/agent_id/go_live_date/billing_anchor_term/onboarding_invoice_id. DROP TABLE billing_contract_lines.',
    up(db) {
      const contractsExists = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_contracts'"
      ).get();

      if (contractsExists) {
        const existing = db.prepare('PRAGMA table_info(billing_contracts)').all().map(r => r.name);
        const newCols = [
          ['school_type',            'TEXT'],
          ['own_sms_provider',       'INTEGER NOT NULL DEFAULT 0'],
          ['agent_id',               'TEXT'],
          ['go_live_date',           'TEXT'],
          ['billing_anchor_term',    'TEXT'],
          ['onboarding_invoice_id',  'TEXT'],
        ];
        for (const [name, def] of newCols) {
          if (!existing.includes(name)) {
            db.exec(`ALTER TABLE billing_contracts ADD COLUMN ${name} ${def}`);
          }
        }
      }

      // billing_contract_lines is always created.
      const linesFkClause = contractsExists
        ? 'REFERENCES billing_contracts(id) ON DELETE RESTRICT'
        : '';
      db.exec(`
        CREATE TABLE billing_contract_lines (
          id             TEXT PRIMARY KEY,
          contract_id    TEXT NOT NULL ${linesFkClause},
          product_code   TEXT NOT NULL,
          quantity       INTEGER NOT NULL DEFAULT 1,
          unit_price_ksh INTEGER NOT NULL,
          description    TEXT NOT NULL DEFAULT '',
          created_at     TEXT NOT NULL
        );
        CREATE INDEX idx_contract_lines_contract ON billing_contract_lines (contract_id);
      `);
    },
  },
  {
    version: 13,
    name: 'billing-contacts',
    notes: 'DROP TABLE billing_contacts to undo.',
    up(db) {
      const hasCustomersTable = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_customers'"
      ).get();
      db.exec(`
        CREATE TABLE billing_contacts (
          id               TEXT PRIMARY KEY,
          customer_id      TEXT NOT NULL DEFAULT '' ${hasCustomersTable ? 'REFERENCES billing_customers(id) ON DELETE RESTRICT' : ''},
          role             TEXT NOT NULL DEFAULT 'billing',
          name             TEXT NOT NULL DEFAULT '',
          email            TEXT,
          phone            TEXT,
          language         TEXT NOT NULL DEFAULT 'en',
          email_verified   INTEGER NOT NULL DEFAULT 0,
          phone_verified   INTEGER NOT NULL DEFAULT 0,
          suppressed_email INTEGER NOT NULL DEFAULT 0,
          suppressed_sms   INTEGER NOT NULL DEFAULT 0,
          created_at       TEXT NOT NULL,
          updated_at       TEXT NOT NULL
        );
        CREATE INDEX idx_contacts_customer ON billing_contacts (customer_id);
      `);
    },
  },
  {
    version: 14,
    name: 'lead-additions',
    notes: 'ALTER TABLE leads DROP COLUMN not supported in old SQLite; to undo, rebuild the leads table dropping all added columns. DROP TABLE lead_stage_history.',
    up(db) {
      const leadsExists = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='leads'"
      ).get();
      if (!leadsExists) return; // leads table created by leads-store.js at runtime

      const existing = db.prepare('PRAGMA table_info(leads)').all().map(r => r.name);
      const cols = [
        ['school_type',              'TEXT'],
        ['county',                   'TEXT'],
        ['billing_email',            'TEXT'],
        ['billing_phone',            'TEXT'],
        ['principal_name',           'TEXT'],
        ['modules',                  'TEXT'],
        ['own_sms_provider',         'INTEGER NOT NULL DEFAULT 0'],
        ['acceptance_method',        'TEXT'],
        ['acceptance_evidence_file', 'TEXT'],
        ['accepted_at',              'TEXT'],
        ['accepted_by',              'TEXT'],
        ['converted_at',             'TEXT'],
        ['converted_customer_id',    'TEXT'],
        ['converted_contract_id',    'TEXT'],
        ['converted_invoice_id',     'TEXT'],
      ];
      for (const [name, def] of cols) {
        if (!existing.includes(name)) {
          db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${def}`);
        }
      }

      // lead_stage_history: audit trail of stage transitions.
      const histExists = !!db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='lead_stage_history'"
      ).get();
      if (!histExists) {
        db.exec(`
          CREATE TABLE lead_stage_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id    TEXT NOT NULL,
            from_stage TEXT,
            to_stage   TEXT NOT NULL,
            actor      TEXT NOT NULL,
            reason     TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX idx_lead_stage_history_lead ON lead_stage_history (lead_id);
        `);
      }
    },
  },
  {
    version: 15,
    name: 'entitlements-and-provisioning',
    notes: 'DROP TABLE onboarding_tasks; DROP TABLE provisioning_jobs; DROP TABLE tenant_subscriptions; DROP TABLE entitlements to undo.',
    up(db) {
      db.exec(`
        CREATE TABLE entitlements (
          id                      TEXT PRIMARY KEY,
          tenant_key              TEXT NOT NULL,
          module_slug             TEXT NOT NULL,
          source_contract_line_id TEXT,
          active_from             TEXT NOT NULL,
          active_to               TEXT,
          status                  TEXT NOT NULL DEFAULT 'active',
          created_at              TEXT NOT NULL,
          UNIQUE (tenant_key, module_slug)
        );
        CREATE INDEX idx_entitlements_tenant ON entitlements (tenant_key);

        CREATE TABLE tenant_subscriptions (
          tenant_key TEXT PRIMARY KEY,
          state      TEXT NOT NULL DEFAULT 'prospect',
          since      TEXT NOT NULL,
          reason     TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE provisioning_jobs (
          id               TEXT PRIMARY KEY,
          contract_id      TEXT,
          tenant_key       TEXT NOT NULL,
          status           TEXT NOT NULL DEFAULT 'pending',
          packet           TEXT NOT NULL DEFAULT '{}',
          workflow_run_url TEXT,
          started_at       TEXT,
          completed_at     TEXT,
          failed_at        TEXT,
          error            TEXT,
          created_at       TEXT NOT NULL,
          updated_at       TEXT NOT NULL
        );

        CREATE TABLE onboarding_tasks (
          id           TEXT PRIMARY KEY,
          job_id       TEXT NOT NULL REFERENCES provisioning_jobs(id) ON DELETE RESTRICT,
          template     TEXT NOT NULL,
          owner        TEXT,
          due_date     TEXT,
          status       TEXT NOT NULL DEFAULT 'pending',
          completed_by TEXT,
          completed_at TEXT,
          created_at   TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 16,
    name: 'automatic-term-renewal-flag',
    notes: 'Delete AUTO_TERM_RENEWAL_INVOICES from feature_flags to undo.',
    up(db) {
      db.prepare(`INSERT OR IGNORE INTO feature_flags (name,enabled,description,updated_at,updated_by)
        VALUES ('AUTO_TERM_RENEWAL_INVOICES',0,'Create draft invoices for active termly contracts on configured billing dates.',?,'system')`)
        .run(new Date().toISOString());
    },
  },
  {
    version: 17,
    name: 'canonical-paybill-school-account',
    notes: 'Remove paybill_account_name and C2B match metadata columns to undo.',
    up(db) {
      const tableExists = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
      const ensureColumn = (table, column, definition) => {
        if (tableExists(table) && !db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
      };
      ensureColumn('billing_customers', 'paybill_account_name', "TEXT NOT NULL DEFAULT ''");
      if (tableExists('billing_customers')) db.exec("UPDATE billing_customers SET paybill_account_name=name WHERE TRIM(paybill_account_name)=''");
      ensureColumn('mpesa_c2b_events', 'matched_customer_id', "TEXT NOT NULL DEFAULT ''");
      ensureColumn('mpesa_c2b_events', 'matched_customer_name', "TEXT NOT NULL DEFAULT ''");
      ensureColumn('mpesa_c2b_events', 'review_reason', "TEXT NOT NULL DEFAULT ''");
    },
  },
];

module.exports = { MIGRATIONS };
