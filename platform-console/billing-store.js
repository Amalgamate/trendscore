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
  `);

  const customerColumns = `id, name, legal_name AS legalName, tenant_key AS tenantKey,
    billing_email AS billingEmail, billing_phone AS billingPhone,
    billing_address AS billingAddress, tax_identifier AS taxIdentifier, currency,
    payment_terms AS paymentTerms, status, created_at AS createdAt, updated_at AS updatedAt`;
  const contractColumns = `id, customer_id AS customerId, reference, service_description AS serviceDescription,
    cadence, start_date AS startDate, end_date AS endDate, renewal_date AS renewalDate,
    terms_note AS termsNote, status, created_at AS createdAt, updated_at AS updatedAt`;

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
    close() { db.close(); },
  };
}

module.exports = { createBillingStore };
