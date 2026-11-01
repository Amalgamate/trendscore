'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { DEFAULT_PRODUCTS } = require('./billing-pricing');
const { runMigrations } = require('./billing-migrate');
const { MIGRATIONS } = require('./billing-migrations');

function createBillingStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'platform-billing.sqlite'));
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS billing_customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT NOT NULL DEFAULT '',
      tenant_key TEXT NOT NULL DEFAULT '',
      billing_email TEXT NOT NULL DEFAULT '',
      billing_phone TEXT NOT NULL DEFAULT '',
      billing_address TEXT NOT NULL DEFAULT '',
      tax_identifier TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'KES',
      payment_terms TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS billing_customers_tenant_key_unique
      ON billing_customers(tenant_key) WHERE tenant_key <> '';
    CREATE TABLE IF NOT EXISTS billing_contracts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
      reference TEXT NOT NULL DEFAULT '',
      service_description TEXT NOT NULL DEFAULT '',
      cadence TEXT NOT NULL CHECK (cadence IN ('one_off', 'monthly', 'termly', 'annual', 'custom')),
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      renewal_date TEXT NOT NULL DEFAULT '',
      terms_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended', 'cancelled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS billing_contracts_customer_idx ON billing_contracts(customer_id);
    CREATE TABLE IF NOT EXISTS billing_quotes (
      id TEXT PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
      customer_snapshot TEXT NOT NULL,
      quote_snapshot TEXT NOT NULL,
      enrollment_count INTEGER NOT NULL,
      pricing_model TEXT NOT NULL,
      billing_cadence TEXT NOT NULL,
      subtotal_ksh INTEGER NOT NULL,
      expires_on TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT '',
      email_message_id TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS billing_quotes_customer_idx ON billing_quotes(customer_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS billing_quote_deliveries (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES billing_quotes(id) ON DELETE RESTRICT,
      recipient TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT '',
      provider_message_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS billing_quote_deliveries_quote_idx ON billing_quote_deliveries(quote_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      quote_id TEXT NOT NULL UNIQUE REFERENCES billing_quotes(id) ON DELETE RESTRICT,
      customer_id TEXT NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
      invoice_snapshot TEXT NOT NULL,
      amount_ksh INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'void')),
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS billing_invoices_customer_idx ON billing_invoices(customer_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS billing_invoice_deliveries (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
      recipient TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT '',
      provider_message_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS billing_invoice_deliveries_invoice_idx ON billing_invoice_deliveries(invoice_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS billing_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
      amount_ksh INTEGER NOT NULL CHECK (amount_ksh > 0),
      payment_date TEXT NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('mpesa', 'bank_transfer', 'cash', 'cheque', 'other')),
      reference TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS billing_payments_invoice_idx ON billing_payments(invoice_id, payment_date DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_reference_unique ON billing_payments(method, lower(reference)) WHERE reference <> '';
    CREATE TABLE IF NOT EXISTS billing_products (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('setup', 'term', 'module', 'sms')),
      school_type TEXT NOT NULL CHECK (school_type IN ('private', 'public_primary')),
      price_ksh INTEGER NOT NULL CHECK (price_ksh >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mpesa_c2b_events (
      transaction_id TEXT PRIMARY KEY,
      bill_reference TEXT NOT NULL DEFAULT '',
      amount_ksh INTEGER NOT NULL DEFAULT 0,
      sender_phone TEXT NOT NULL DEFAULT '',
      transaction_date TEXT NOT NULL DEFAULT '',
      invoice_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'needs_review',
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed the price list once; INSERT OR IGNORE keeps any edits made later in the admin UI.
  {
    const seedAt = new Date().toISOString();
    const seed = db.prepare(`INSERT OR IGNORE INTO billing_products (code,name,kind,school_type,price_ksh,active,sort_order,updated_by,updated_at)
      VALUES (@code,@name,@kind,@schoolType,@priceKsh,@active,@sortOrder,'system',@updatedAt)`);
    for (const product of DEFAULT_PRODUCTS) seed.run({ ...product, active: product.active ? 1 : 0, updatedAt: seedAt });
    // One-off: public primary add-on modules were seeded off before the business confirmed them. Only rows nobody has edited change.
    db.prepare("UPDATE billing_products SET active=1, updated_at=? WHERE code='module_public_primary' AND updated_by='system' AND active=0").run(seedAt);
  }

  runMigrations(db, { migrations: MIGRATIONS, dataDir, log: msg => console.log('[migrate]', msg) });

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  ensureColumn('billing_quotes', 'cancelled_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('billing_quotes', 'cancelled_by', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('billing_quotes', 'cancel_reason', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('billing_invoices', 'cancel_reason', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('billing_invoices', 'cancelled_by', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('billing_contract_lines', 'cadence', "TEXT NOT NULL DEFAULT 'termly'");

  const customerColumns = `id, name, paybill_account_name AS paybillAccountName, legal_name AS legalName, tenant_key AS tenantKey,
    billing_email AS billingEmail, billing_phone AS billingPhone,
    billing_address AS billingAddress, tax_identifier AS taxIdentifier, currency,
    payment_terms AS paymentTerms, status, created_at AS createdAt, updated_at AS updatedAt`;
  const contractColumns = `id, customer_id AS customerId, reference, service_description AS serviceDescription,
    cadence, start_date AS startDate, end_date AS endDate, renewal_date AS renewalDate,
    terms_note AS termsNote, status, created_at AS createdAt, updated_at AS updatedAt`;
  const todayNairobi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  const decodeJson = value => {
    try { return JSON.parse(value); } catch { return null; }
  };
  const quoteColumns = `id, quote_number AS quoteNumber, customer_id AS customerId,
    customer_snapshot AS customerSnapshotJson, quote_snapshot AS quoteSnapshotJson,
    enrollment_count AS enrollmentCount, pricing_model AS pricingModel,
    billing_cadence AS billingCadence, subtotal_ksh AS subtotalKsh, expires_on AS expiresOn,
    notes, status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt,
    sent_at AS sentAt, email_message_id AS emailMessageId, cancelled_at AS cancelledAt,
    cancelled_by AS cancelledBy, cancel_reason AS cancelReason`;
  const invoiceColumns = `id, invoice_number AS invoiceNumber, quote_id AS quoteId,
    contract_id AS contractId, invoice_type AS invoiceType, period_key AS periodKey,
    customer_id AS customerId, invoice_snapshot AS invoiceSnapshotJson, amount_ksh AS amountKsh,
    status, settlement_status AS settlementStatus, due_date AS dueDate, issued_at AS issuedAt,
    created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt,
    cancel_reason AS cancelReason, cancelled_by AS cancelledBy`;
  const decodeQuote = row => row && ({ ...row, status: row.cancelledAt ? 'cancelled' : (row.status === 'sent' && row.expiresOn && row.expiresOn < todayNairobi() ? 'expired' : row.status), customerSnapshot: decodeJson(row.customerSnapshotJson), quoteSnapshot: decodeJson(row.quoteSnapshotJson), customerSnapshotJson: undefined, quoteSnapshotJson: undefined });
  const decodeInvoice = row => row && ({ ...row, invoiceSnapshot: decodeJson(row.invoiceSnapshotJson), invoiceSnapshotJson: undefined });
  const invoicePaidAmount = invoiceId => Number(db.prepare('SELECT COALESCE(SUM(amount_ksh), 0) AS amount FROM billing_payments WHERE invoice_id=?').get(invoiceId)?.amount || 0);
  const withPaymentTotals = invoice => {
    if (!invoice) return null;
    const paidAmountKsh = invoicePaidAmount(invoice.id);
    const amountKsh = Number(invoice.amountKsh || 0);
    return { ...invoice, paidAmountKsh, balanceKsh: Math.max(0, amountKsh - paidAmountKsh), paymentStatus: paidAmountKsh >= amountKsh ? 'paid' : paidAmountKsh > 0 ? 'partially_paid' : invoice.status === 'draft' ? 'not_issued' : 'unpaid' };
  };

  const productColumns = `code, name, kind, school_type AS schoolType, price_ksh AS priceKsh, active,
    sort_order AS sortOrder, updated_by AS updatedBy, updated_at AS updatedAt`;
  const decodeProduct = row => row && ({ ...row, active: Number(row.active) === 1 });

  return {
    listProducts() {
      return db.prepare(`SELECT ${productColumns} FROM billing_products ORDER BY sort_order, code`).all().map(decodeProduct);
    },
    getProduct(code) {
      return decodeProduct(db.prepare(`SELECT ${productColumns} FROM billing_products WHERE code=?`).get(code) || null);
    },
    // Only name, price and active can change. Existing quotes keep their own price snapshot.
    updateProduct(code, product, actor) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_products SET name=@name, price_ksh=@priceKsh, active=@active, updated_by=@actor, updated_at=@updatedAt WHERE code=@code`)
        .run({ code, name: product.name, priceKsh: product.priceKsh, active: product.active ? 1 : 0, actor: actor || '', updatedAt: now });
      return result.changes ? this.getProduct(code) : null;
    },
    listCustomers() {
      return db.prepare(`SELECT ${customerColumns} FROM billing_customers ORDER BY name COLLATE NOCASE`).all();
    },
    getCustomer(id) {
      return db.prepare(`SELECT ${customerColumns} FROM billing_customers WHERE id = ?`).get(id) || null;
    },
    findCustomersByPaybillAccountName(name) {
      const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
      const target = normalize(name);
      if (!target) return [];
      return this.listCustomers().filter(customer => normalize(customer.paybillAccountName || customer.name) === target);
    },
    createCustomer(customer) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_customers
        (id,name,paybill_account_name,legal_name,tenant_key,billing_email,billing_phone,billing_address,tax_identifier,currency,payment_terms,status,created_at,updated_at)
        VALUES (@id,@name,@paybillAccountName,@legalName,@tenantKey,@billingEmail,@billingPhone,@billingAddress,@taxIdentifier,@currency,@paymentTerms,@status,@createdAt,@updatedAt)`)
        .run({ ...customer, paybillAccountName: customer.paybillAccountName || customer.name, createdAt: now, updatedAt: now });
      return this.getCustomer(customer.id);
    },
    updateCustomer(id, customer) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_customers SET name=@name, paybill_account_name=@paybillAccountName, legal_name=@legalName, tenant_key=@tenantKey,
        billing_email=@billingEmail, billing_phone=@billingPhone, billing_address=@billingAddress,
        tax_identifier=@taxIdentifier, currency=@currency, payment_terms=@paymentTerms,
        status=@status, updated_at=@updatedAt WHERE id=@id`).run({ ...customer, paybillAccountName: customer.paybillAccountName || customer.name, id, updatedAt: now });
      return result.changes ? this.getCustomer(id) : null;
    },
    listContracts(customerId = '') {
      const query = customerId
        ? db.prepare(`SELECT ${contractColumns} FROM billing_contracts WHERE customer_id = ? ORDER BY created_at DESC`)
        : db.prepare(`SELECT ${contractColumns} FROM billing_contracts ORDER BY created_at DESC`);
      return customerId ? query.all(customerId) : query.all();
    },
    createContract(contract) {
      const now = new Date().toISOString();
      const { lines = [], ...contractValues } = contract;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO billing_contracts
          (id,customer_id,reference,service_description,cadence,start_date,end_date,renewal_date,terms_note,status,created_at,updated_at)
          VALUES (@id,@customerId,@reference,@serviceDescription,@cadence,@startDate,@endDate,@renewalDate,@termsNote,@status,@createdAt,@updatedAt)`)
          .run({ ...contractValues, createdAt: now, updatedAt: now });
        const lineStmt = db.prepare(`INSERT INTO billing_contract_lines
          (id,contract_id,product_code,quantity,unit_price_ksh,description,cadence,created_at)
          VALUES (?,?,?,?,?,?,?,?)`);
        for (const line of Array.isArray(lines) ? lines : []) {
          lineStmt.run(crypto.randomUUID(), contract.id, String(line.productCode || 'custom'),
            Math.max(1, Number(line.quantity || 1)), Number(line.unitPriceKsh || 0), String(line.description || '').slice(0, 500),
            ['one_off', 'termly', 'monthly', 'annual'].includes(line.cadence) ? line.cadence : 'termly', now);
        }
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return db.prepare(`SELECT ${contractColumns} FROM billing_contracts WHERE id = ?`).get(contract.id);
    },
    updateContract(id, contract) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_contracts SET reference=@reference, service_description=@serviceDescription,
        cadence=@cadence, start_date=@startDate, end_date=@endDate, renewal_date=@renewalDate,
        terms_note=@termsNote, status=@status, updated_at=@updatedAt WHERE id=@id`).run({ ...contract, id, updatedAt: now });
      if (!result.changes) return null;
      return db.prepare(`SELECT ${contractColumns} FROM billing_contracts WHERE id = ?`).get(id);
    },
    linkContractOnboardingInvoice(contractId, invoiceId) {
      db.prepare(`UPDATE billing_contracts SET onboarding_invoice_id=?,updated_at=? WHERE id=?`)
        .run(invoiceId, new Date().toISOString(), contractId);
      return true;
    },
    listQuotes() {
      return db.prepare(`SELECT ${quoteColumns} FROM billing_quotes ORDER BY created_at DESC`).all().map(decodeQuote);
    },
    getQuote(id) {
      return decodeQuote(db.prepare(`SELECT ${quoteColumns} FROM billing_quotes WHERE id = ?`).get(id) || null);
    },
    createQuote(quote) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_quotes
        (id,quote_number,customer_id,customer_snapshot,quote_snapshot,enrollment_count,pricing_model,billing_cadence,subtotal_ksh,expires_on,notes,status,created_by,created_at,updated_at)
        VALUES (@id,@quoteNumber,@customerId,@customerSnapshot,@quoteSnapshot,@enrollmentCount,@pricingModel,@billingCadence,@subtotalKsh,@expiresOn,@notes,'draft',@createdBy,@createdAt,@updatedAt)`)
        .run({ ...quote, customerSnapshot: JSON.stringify(quote.customerSnapshot), quoteSnapshot: JSON.stringify(quote.quoteSnapshot), createdAt: now, updatedAt: now });
      return this.getQuote(quote.id);
    },
    updateQuote(id, quote) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_quotes SET customer_id=@customerId, customer_snapshot=@customerSnapshot,
        quote_snapshot=@quoteSnapshot, enrollment_count=@enrollmentCount, pricing_model=@pricingModel,
        billing_cadence=@billingCadence, subtotal_ksh=@subtotalKsh, expires_on=@expiresOn, notes=@notes,
        updated_at=@updatedAt WHERE id=@id AND status='draft' AND sent_at='' AND cancelled_at=''`)
        .run({ ...quote, id, customerSnapshot: JSON.stringify(quote.customerSnapshot), quoteSnapshot: JSON.stringify(quote.quoteSnapshot), updatedAt: now });
      return result.changes ? this.getQuote(id) : null;
    },
    deleteDraftQuote(id) {
      const result = db.prepare(`DELETE FROM billing_quotes WHERE id=? AND status='draft' AND sent_at='' AND cancelled_at=''
        AND NOT EXISTS (SELECT 1 FROM billing_quote_deliveries WHERE quote_id=?)
        AND NOT EXISTS (SELECT 1 FROM billing_invoices WHERE quote_id=?)`).run(id, id, id);
      return result.changes > 0;
    },
    cancelQuote(id, actor, reason) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_quotes SET cancelled_at=?,cancelled_by=?,cancel_reason=?,updated_at=?
        WHERE id=? AND status IN ('draft','sent','accepted') AND cancelled_at='' AND NOT EXISTS
        (SELECT 1 FROM billing_invoices WHERE quote_id=?)`).run(now, actor, reason, now, id, id);
      return result.changes ? this.getQuote(id) : null;
    },
    setQuoteStatus(id, status) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_quotes SET status=@status, updated_at=@updatedAt WHERE id=@id`).run({ id, status, updatedAt: now });
      return result.changes ? this.getQuote(id) : null;
    },
    recordQuoteAcceptance(id, acceptance) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare(`SELECT quote_snapshot AS snapshot,status FROM billing_quotes WHERE id=?`).get(id);
        if (!row || !['draft', 'sent'].includes(row.status)) throw new Error('This quote is no longer awaiting customer acceptance');
        const snapshot = decodeJson(row.snapshot) || {};
        snapshot.acceptance = { ...acceptance, acceptedAt: now };
        const result = db.prepare(`UPDATE billing_quotes SET status='accepted',quote_snapshot=?,updated_at=? WHERE id=? AND status IN ('draft','sent')`)
          .run(JSON.stringify(snapshot), now, id);
        if (!result.changes) throw new Error('This quote changed before acceptance could be saved');
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getQuote(id);
    },
    recordQuoteDelivery(delivery) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_quote_deliveries
        (id,quote_id,recipient,actor,provider_message_id,status,error,created_at)
        VALUES (@id,@quoteId,@recipient,@actor,@providerMessageId,@status,@error,@createdAt)`)
        .run({ ...delivery, createdAt: now });
      if (delivery.status === 'sent') {
        db.prepare(`UPDATE billing_quotes SET status='sent', sent_at=@sentAt, email_message_id=@messageId, updated_at=@sentAt WHERE id=@id`)
          .run({ id: delivery.quoteId, sentAt: now, messageId: delivery.providerMessageId || '' });
      }
      return now;
    },
    listQuoteDeliveries(quoteId) {
      return db.prepare(`SELECT recipient,actor,provider_message_id AS providerMessageId,status,error,created_at AS createdAt
        FROM billing_quote_deliveries WHERE quote_id=? ORDER BY created_at DESC`).all(quoteId);
    },
    listInvoices() {
      return db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices ORDER BY created_at DESC`).all().map(decodeInvoice).map(withPaymentTotals);
    },
    getInvoice(id) {
      return withPaymentTotals(decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE id=?`).get(id) || null));
    },
    getInvoiceByNumber(invoiceNumber) {
      return withPaymentTotals(decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE invoice_number=?`).get(String(invoiceNumber || '')) || null));
    },
    getInvoiceForQuote(quoteId) {
      return withPaymentTotals(decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE quote_id=?`).get(quoteId) || null));
    },
    getInvoiceForContractPeriod(contractId, periodKey) {
      return withPaymentTotals(decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE contract_id=? AND period_key=?`).get(contractId, periodKey) || null));
    },
    createTermRenewalInvoices(term, actor) {
      const periodKey = `${term.year}-T${term.term}`;
      const contracts = db.prepare(`SELECT c.*, cu.name AS customer_name, cu.legal_name AS customer_legal_name,
        cu.tenant_key, cu.billing_email, cu.billing_phone, cu.billing_address, cu.tax_identifier, cu.currency
        FROM billing_contracts c JOIN billing_customers cu ON cu.id=c.customer_id
        WHERE c.status='active' AND c.cadence='termly' AND cu.status='active'
        AND (c.start_date='' OR c.start_date<=?) AND (c.end_date='' OR c.end_date>=?)
        ORDER BY c.created_at`).all(term.endDate, term.startDate);
      const created = [];
      for (const contract of contracts) {
        const existing = this.getInvoiceForContractPeriod(contract.id, periodKey);
        if (existing) continue;
        const lines = db.prepare(`SELECT product_code AS productCode,quantity,unit_price_ksh AS unitPriceKsh,description
          FROM billing_contract_lines WHERE contract_id=? AND cadence='termly' AND description NOT LIKE 'Discount (%'`).all(contract.id);
        if (!lines.length) continue;
        const amountKsh = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPriceKsh), 0);
        if (!Number.isSafeInteger(amountKsh) || amountKsh <= 0) continue;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const onboarding = contract.onboarding_invoice_id
          ? db.prepare('SELECT invoice_snapshot FROM billing_invoices WHERE id=?').get(contract.onboarding_invoice_id)
          : null;
        const onboardingSnapshot = onboarding ? decodeJson(onboarding.invoice_snapshot) : null;
        const snapshot = {
          source: 'term_renewal', contractId: contract.id, periodKey,
          customerSnapshot: {
            name: contract.customer_name, legalName: contract.customer_legal_name, tenantKey: contract.tenant_key,
            billingEmail: contract.billing_email, billingPhone: contract.billing_phone,
            billingAddress: contract.billing_address, taxIdentifier: contract.tax_identifier, currency: contract.currency,
          },
          quoteSnapshot: {
            enrollmentCount: Number(onboardingSnapshot?.quoteSnapshot?.enrollmentCount || 0),
            lines: lines.map(line => ({ ...line, cadence: 'termly', amountKsh: Number(line.quantity) * Number(line.unitPriceKsh) })),
          },
          dueDate: term.dueDate, term: { year: term.year, term: term.term, startDate: term.startDate, endDate: term.endDate },
          taxNote: 'Tax treatment is not included; this commercial invoice is not an eTIMS tax invoice.',
        };
        try {
          db.exec('BEGIN IMMEDIATE');
          db.prepare(`INSERT INTO billing_invoices
            (id,invoice_number,quote_id,contract_id,invoice_type,period_key,customer_id,invoice_snapshot,amount_ksh,status,settlement_status,due_date,created_by,created_at,updated_at)
            VALUES (?, ?, NULL, ?, 'renewal', ?, ?, ?, ?, 'draft', 'unpaid', ?, ?, ?, ?)`)
            .run(id, `DRAFT-${periodKey}-${id.slice(0, 8)}`, contract.id, periodKey, contract.customer_id,
              JSON.stringify(snapshot), amountKsh, term.dueDate || '', actor || 'system', now, now);
          const insertLine = db.prepare(`INSERT INTO billing_invoice_lines
            (id,invoice_id,description,quantity,unit_price_ksh,amount_ksh,product_code,cadence,sort_order,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`);
          lines.forEach((line, index) => insertLine.run(crypto.randomUUID(), id, line.description,
            Number(line.quantity), Number(line.unitPriceKsh), Number(line.quantity) * Number(line.unitPriceKsh),
            line.productCode, 'termly', index, now));
          db.exec('COMMIT');
          created.push(this.getInvoice(id));
        } catch (error) {
          try { db.exec('ROLLBACK'); } catch {}
          if (String(error.message).includes('UNIQUE')) continue;
          throw error;
        }
      }
      return { periodKey, created };
    },
    createDraftInvoice(invoice) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_invoices
        (id,invoice_number,quote_id,contract_id,invoice_type,period_key,customer_id,invoice_snapshot,amount_ksh,status,due_date,created_by,created_at,updated_at)
        VALUES (@id,@invoiceNumber,@quoteId,@contractId,@invoiceType,@periodKey,@customerId,@invoiceSnapshot,@amountKsh,'draft',@dueDate,@createdBy,@createdAt,@updatedAt)`)
        .run({ ...invoice, contractId: invoice.contractId || null, invoiceType: invoice.invoiceType || 'onboarding',
          periodKey: invoice.periodKey || null, dueDate: invoice.dueDate || '',
          invoiceSnapshot: JSON.stringify(invoice.invoiceSnapshot), createdAt: now, updatedAt: now });
      return decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE id=?`).get(invoice.id));
    },
    updateDraftInvoice(id, details) {
      const invoice = this.getInvoice(id);
      if (!invoice || invoice.status !== 'draft') return null;
      const snapshot = { ...invoice.invoiceSnapshot, dueDate: details.dueDate, termsNote: details.termsNote };
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_invoices SET invoice_snapshot=?,updated_at=? WHERE id=? AND status='draft'`)
        .run(JSON.stringify(snapshot), now, id);
      return result.changes ? this.getInvoice(id) : null;
    },
    issueDraftInvoice(id, invoiceNumber, issuedAt) {
      const invoice = this.getInvoice(id);
      if (!invoice || invoice.status !== 'draft') return null;
      const snapshot = { ...invoice.invoiceSnapshot, issuedAt };
      const result = db.prepare(`UPDATE billing_invoices SET status='issued',invoice_number=?,invoice_snapshot=?,updated_at=? WHERE id=? AND status='draft'`)
        .run(invoiceNumber, JSON.stringify(snapshot), issuedAt, id);
      return result.changes ? this.getInvoice(id) : null;
    },
    cancelDraftInvoice(id, actor, reason) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_invoices SET status='void',cancelled_by=?,cancel_reason=?,updated_at=?
        WHERE id=? AND status='draft'`).run(actor, reason, now, id);
      return result.changes ? this.getInvoice(id) : null;
    },
    recordInvoiceDelivery(delivery) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_invoice_deliveries
        (id,invoice_id,recipient,actor,provider_message_id,status,error,created_at)
        VALUES (@id,@invoiceId,@recipient,@actor,@providerMessageId,@status,@error,@createdAt)`)
        .run({ ...delivery, createdAt: now });
      if (delivery.status === 'sent') db.prepare(`UPDATE billing_invoices SET status='sent',updated_at=? WHERE id=? AND status='issued'`).run(now, delivery.invoiceId);
      return now;
    },
    listInvoiceDeliveries(invoiceId) {
      return db.prepare(`SELECT recipient,actor,provider_message_id AS providerMessageId,status,error,created_at AS createdAt
        FROM billing_invoice_deliveries WHERE invoice_id=? ORDER BY created_at DESC`).all(invoiceId);
    },
    listPayments() {
      return db.prepare(`SELECT id,invoice_id AS invoiceId,amount_ksh AS amountKsh,payment_date AS paymentDate,
        method,reference,notes,recorded_by AS recordedBy,created_at AS createdAt FROM billing_payments ORDER BY payment_date DESC,created_at DESC`).all();
    },
    getPayment(id) {
      return db.prepare(`SELECT id,invoice_id AS invoiceId,amount_ksh AS amountKsh,payment_date AS paymentDate,
        method,reference,notes,recorded_by AS recordedBy,created_at AS createdAt FROM billing_payments WHERE id=?`).get(id) || null;
    },
    getPaymentByReference(method, reference) {
      return db.prepare(`SELECT id,invoice_id AS invoiceId,amount_ksh AS amountKsh,payment_date AS paymentDate,
        method,reference,notes,recorded_by AS recordedBy,created_at AS createdAt
        FROM billing_payments WHERE method=? AND lower(reference)=lower(?) LIMIT 1`).get(method, reference) || null;
    },
    recordMpesaC2BEvent(event) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO mpesa_c2b_events
        (transaction_id,bill_reference,amount_ksh,sender_phone,transaction_date,invoice_id,status,payload,created_at,updated_at)
        VALUES (@transactionId,@billReference,@amountKsh,@senderPhone,@transactionDate,@invoiceId,@status,@payload,@createdAt,@updatedAt)
        ON CONFLICT(transaction_id) DO NOTHING`).run({
          transactionId: event.transactionId, billReference: event.billReference || '',
          amountKsh: Number(event.amountKsh || 0), senderPhone: event.senderPhone || '',
          transactionDate: event.transactionDate || '', invoiceId: event.invoiceId || '',
          status: event.status || 'needs_review', payload: JSON.stringify(event.payload || {}),
          createdAt: now, updatedAt: now,
        });
      db.prepare(`UPDATE mpesa_c2b_events SET matched_customer_id=?,matched_customer_name=?,review_reason=?
        WHERE transaction_id=?`).run(event.matchedCustomerId || '', event.matchedCustomerName || '', event.reviewReason || '', event.transactionId);
      return db.prepare('SELECT * FROM mpesa_c2b_events WHERE transaction_id=?').get(event.transactionId);
    },
    listMpesaC2BEvents({ status = '' } = {}) {
      const rows = status
        ? db.prepare('SELECT * FROM mpesa_c2b_events WHERE status=? ORDER BY created_at DESC').all(status)
        : db.prepare('SELECT * FROM mpesa_c2b_events ORDER BY created_at DESC').all();
      return rows.map(row => ({ ...row, payload: decodeJson(row.payload) }));
    },
    resolveMpesaC2BEvent(transactionId, invoiceId, status = 'allocated') {
      const result = db.prepare(`UPDATE mpesa_c2b_events SET invoice_id=?,status=?,updated_at=? WHERE transaction_id=? AND status='needs_review'`)
        .run(invoiceId || '', status, new Date().toISOString(), transactionId);
      return result.changes > 0 ? db.prepare('SELECT * FROM mpesa_c2b_events WHERE transaction_id=?').get(transactionId) : null;
    },
    recordPayment(payment) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const invoice = this.getInvoice(payment.invoiceId);
        if (!invoice || !['issued', 'sent', 'paid'].includes(invoice.status)) throw new Error('Payments can only be recorded against an issued invoice');
        if (payment.reference && db.prepare('SELECT 1 FROM billing_payments WHERE method=? AND lower(reference)=lower(?)').get(payment.method, payment.reference)) throw new Error('This payment reference has already been recorded for this method');
        const balance = Math.max(0, Number(invoice.amountKsh) - Number(invoice.paidAmountKsh || 0));
        if (Number(payment.amountKsh) > balance) throw new Error(`Payment exceeds the outstanding balance of KSh ${balance.toLocaleString('en-KE')}`);
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO billing_payments (id,invoice_id,amount_ksh,payment_date,method,reference,notes,recorded_by,created_at)
          VALUES (@id,@invoiceId,@amountKsh,@paymentDate,@method,@reference,@notes,@recordedBy,@createdAt)`)
          .run({ ...payment, createdAt: now });
        const totalPaid = invoicePaidAmount(payment.invoiceId);
        if (totalPaid >= Number(invoice.amountKsh)) {
          db.prepare(`UPDATE billing_invoices SET status='paid',updated_at=? WHERE id=?`).run(now, payment.invoiceId);
        }
        db.exec('COMMIT');
        return db.prepare(`SELECT id,invoice_id AS invoiceId,amount_ksh AS amountKsh,payment_date AS paymentDate,
          method,reference,notes,recorded_by AS recordedBy,created_at AS createdAt FROM billing_payments WHERE id=?`).get(payment.id);
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },
    getCustomerByTenantKey(tenantKey) {
      const row = db.prepare('SELECT id FROM billing_customers WHERE tenant_key=?').get(tenantKey);
      return row ? this.getCustomer(row.id) : null;
    },
    counts() {
      const n = t => Number(db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c);
      return { customers: n('billing_customers'), contracts: n('billing_contracts'), quotes: n('billing_quotes'), invoices: n('billing_invoices'), payments: n('billing_payments') };
    },
    // Writes a consistent copy of the billing database into billing-backups/ and returns its path.
    backupNow(prefix = 'platform-billing') {
      const backupDir = path.join(dataDir, 'billing-backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
      db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
      return backupPath;
    },
    // Deletes the oldest backups with this prefix, keeping the newest `keep`. Returns how many were removed.
    pruneBackups(prefix, keep) {
      const backupDir = path.join(dataDir, 'billing-backups');
      if (!fs.existsSync(backupDir)) return 0;
      const files = fs.readdirSync(backupDir).filter(name => name.startsWith(`${prefix}-`) && name.endsWith('.sqlite')).sort().reverse();
      let removed = 0;
      for (const name of files.slice(Math.max(0, keep))) {
        try { fs.unlinkSync(path.join(backupDir, name)); removed += 1; } catch { /* retry on the next run */ }
      }
      return removed;
    },
    // Wipes every billing table after writing a consistent backup copy. Returns { backupPath, before }.
    resetAll() {
      const before = this.counts();
      const backupPath = this.backupNow();
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const t of ['billing_payments', 'billing_invoice_deliveries', 'billing_invoices', 'billing_quote_deliveries', 'billing_quotes', 'billing_contracts', 'billing_customers']) db.exec(`DELETE FROM ${t}`);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return { backupPath, before };
    },
    close() { db.close(); },
    // Exposed for the job runner — no other caller should use raw db access.
    _getDb() { return db; },
  };
}

module.exports = { createBillingStore };
