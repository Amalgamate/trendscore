'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

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
  `);

  const customerColumns = `id, name, legal_name AS legalName, tenant_key AS tenantKey,
    billing_email AS billingEmail, billing_phone AS billingPhone,
    billing_address AS billingAddress, tax_identifier AS taxIdentifier, currency,
    payment_terms AS paymentTerms, status, created_at AS createdAt, updated_at AS updatedAt`;
  const contractColumns = `id, customer_id AS customerId, reference, service_description AS serviceDescription,
    cadence, start_date AS startDate, end_date AS endDate, renewal_date AS renewalDate,
    terms_note AS termsNote, status, created_at AS createdAt, updated_at AS updatedAt`;
  const decodeJson = value => {
    try { return JSON.parse(value); } catch { return null; }
  };
  const quoteColumns = `id, quote_number AS quoteNumber, customer_id AS customerId,
    customer_snapshot AS customerSnapshotJson, quote_snapshot AS quoteSnapshotJson,
    enrollment_count AS enrollmentCount, pricing_model AS pricingModel,
    billing_cadence AS billingCadence, subtotal_ksh AS subtotalKsh, expires_on AS expiresOn,
    notes, status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt,
    sent_at AS sentAt, email_message_id AS emailMessageId`;
  const invoiceColumns = `id, invoice_number AS invoiceNumber, quote_id AS quoteId,
    customer_id AS customerId, invoice_snapshot AS invoiceSnapshotJson, amount_ksh AS amountKsh,
    status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt`;
  const decodeQuote = row => row && ({ ...row, customerSnapshot: decodeJson(row.customerSnapshotJson), quoteSnapshot: decodeJson(row.quoteSnapshotJson), customerSnapshotJson: undefined, quoteSnapshotJson: undefined });
  const decodeInvoice = row => row && ({ ...row, invoiceSnapshot: decodeJson(row.invoiceSnapshotJson), invoiceSnapshotJson: undefined });

  return {
    listCustomers() {
      return db.prepare(`SELECT ${customerColumns} FROM billing_customers ORDER BY name COLLATE NOCASE`).all();
    },
    getCustomer(id) {
      return db.prepare(`SELECT ${customerColumns} FROM billing_customers WHERE id = ?`).get(id) || null;
    },
    createCustomer(customer) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_customers
        (id,name,legal_name,tenant_key,billing_email,billing_phone,billing_address,tax_identifier,currency,payment_terms,status,created_at,updated_at)
        VALUES (@id,@name,@legalName,@tenantKey,@billingEmail,@billingPhone,@billingAddress,@taxIdentifier,@currency,@paymentTerms,@status,@createdAt,@updatedAt)`)
        .run({ ...customer, createdAt: now, updatedAt: now });
      return this.getCustomer(customer.id);
    },
    updateCustomer(id, customer) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_customers SET name=@name, legal_name=@legalName, tenant_key=@tenantKey,
        billing_email=@billingEmail, billing_phone=@billingPhone, billing_address=@billingAddress,
        tax_identifier=@taxIdentifier, currency=@currency, payment_terms=@paymentTerms,
        status=@status, updated_at=@updatedAt WHERE id=@id`).run({ ...customer, id, updatedAt: now });
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
      db.prepare(`INSERT INTO billing_contracts
        (id,customer_id,reference,service_description,cadence,start_date,end_date,renewal_date,terms_note,status,created_at,updated_at)
        VALUES (@id,@customerId,@reference,@serviceDescription,@cadence,@startDate,@endDate,@renewalDate,@termsNote,@status,@createdAt,@updatedAt)`)
        .run({ ...contract, createdAt: now, updatedAt: now });
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
    setQuoteStatus(id, status) {
      const now = new Date().toISOString();
      const result = db.prepare(`UPDATE billing_quotes SET status=@status, updated_at=@updatedAt WHERE id=@id`).run({ id, status, updatedAt: now });
      return result.changes ? this.getQuote(id) : null;
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
      return db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices ORDER BY created_at DESC`).all().map(decodeInvoice);
    },
    getInvoice(id) {
      return decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE id=?`).get(id) || null);
    },
    getInvoiceForQuote(quoteId) {
      return decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE quote_id=?`).get(quoteId) || null);
    },
    createDraftInvoice(invoice) {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO billing_invoices
        (id,invoice_number,quote_id,customer_id,invoice_snapshot,amount_ksh,status,created_by,created_at,updated_at)
        VALUES (@id,@invoiceNumber,@quoteId,@customerId,@invoiceSnapshot,@amountKsh,'draft',@createdBy,@createdAt,@updatedAt)`)
        .run({ ...invoice, invoiceSnapshot: JSON.stringify(invoice.invoiceSnapshot), createdAt: now, updatedAt: now });
      return decodeInvoice(db.prepare(`SELECT ${invoiceColumns} FROM billing_invoices WHERE id=?`).get(invoice.id));
    },
    close() { db.close(); },
  };
}

module.exports = { createBillingStore };
