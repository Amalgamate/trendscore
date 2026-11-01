'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function commissionPercent(value, fallback, label) {
  const rate = value === undefined || value === null || value === '' ? Number(fallback) : Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(`${label} must be between 0 and 100 percent`);
  return rate;
}

function createAgentsStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'platform-billing.sqlite'));

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      agent_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      national_id TEXT NOT NULL DEFAULT '',
      county TEXT NOT NULL DEFAULT '',
      base_location TEXT NOT NULL DEFAULT '',
      mpesa_number TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      bank_account TEXT NOT NULL DEFAULT '',
      commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed_per_school', 'fixed_per_student')),
      commission_rate REAL NOT NULL DEFAULT 10.0,
      first_payment_commission_rate REAL NOT NULL DEFAULT 25.0,
      recurring_payment_commission_rate REAL NOT NULL DEFAULT 10.0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
      pin_hash TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agents_status_idx ON agents(status);
    CREATE INDEX IF NOT EXISTS agents_phone_idx ON agents(phone);

    CREATE TABLE IF NOT EXISTS agent_schools (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      school_name TEXT NOT NULL,
      tenant_key TEXT NOT NULL DEFAULT '',
      lead_id TEXT NOT NULL DEFAULT '',
      contact_person TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pitching' CHECK (status IN ('pitching', 'onboarded', 'active', 'churned')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_schools_agent_idx ON agent_schools(agent_id);

    CREATE TABLE IF NOT EXISTS agent_earnings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      school_name TEXT NOT NULL DEFAULT '',
      invoice_ref TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      gross_amount_ksh REAL NOT NULL DEFAULT 0,
      commission_rate REAL NOT NULL DEFAULT 0,
      commission_type TEXT NOT NULL DEFAULT 'percentage',
      earned_amount_ksh REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
      earned_date TEXT NOT NULL,
      payout_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_earnings_agent_idx ON agent_earnings(agent_id, status);

    CREATE TABLE IF NOT EXISTS agent_payouts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      amount_ksh REAL NOT NULL CHECK (amount_ksh > 0),
      payout_method TEXT NOT NULL DEFAULT 'mpesa' CHECK (payout_method IN ('mpesa', 'bank_transfer', 'cash', 'other')),
      reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
      payout_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      processed_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_payouts_agent_idx ON agent_payouts(agent_id, payout_date DESC);
    CREATE TABLE IF NOT EXISTS agent_payout_allocations (
      id TEXT PRIMARY KEY,
      payout_id TEXT NOT NULL REFERENCES agent_payouts(id) ON DELETE RESTRICT,
      earning_id TEXT NOT NULL REFERENCES agent_earnings(id) ON DELETE RESTRICT,
      amount_ksh REAL NOT NULL CHECK (amount_ksh > 0),
      created_at TEXT NOT NULL,
      UNIQUE (payout_id, earning_id)
    );
    CREATE INDEX IF NOT EXISTS agent_payout_allocations_earning_idx ON agent_payout_allocations(earning_id);
  `);
  db.exec(`CREATE TABLE IF NOT EXISTS agent_payout_callbacks (
    callback_key TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL DEFAULT '',
    payout_id TEXT NOT NULL DEFAULT '',
    result_code INTEGER NOT NULL DEFAULT -1,
    transaction_id TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL DEFAULT '{}',
    handled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS agent_school_commission_state (
    agent_school_id TEXT PRIMARY KEY,
    first_payment_invoice_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some(item => item.name === column)) return false;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  };
  ensureColumn('agent_earnings', 'payment_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agent_earnings', 'tenant_key', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'auth_token_version', "INTEGER NOT NULL DEFAULT 1");
  ensureColumn('agents', 'pin_must_change', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('agents', 'pin_failed_attempts', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('agents', 'pin_locked_until', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'pin_temp_expires_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'pin_changed_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'pin_reset_requested_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'first_payment_commission_rate', 'REAL NOT NULL DEFAULT 25.0');
  const recurringCommissionColumnAdded = ensureColumn('agents', 'recurring_payment_commission_rate', 'REAL NOT NULL DEFAULT 10.0');
  if (recurringCommissionColumnAdded) {
    // Preserve existing percentage agreements as recurring rates. Legacy fixed plans
    // retain their original fields and receive the new schedule defaults until reviewed.
    db.exec(`UPDATE agents SET recurring_payment_commission_rate=commission_rate
      WHERE commission_type='percentage' AND commission_rate BETWEEN 0 AND 100`);
  }
  const existingSchoolEarnings = db.prepare(`SELECT id,agent_id,school_name,tenant_key
    FROM agent_schools`).all();
  const earliestPaymentEarning = db.prepare(`SELECT invoice_ref FROM agent_earnings
    WHERE agent_id=? AND payment_id<>'' AND invoice_ref<>''
      AND ((?<>'' AND lower(tenant_key)=lower(?)) OR lower(trim(school_name))=lower(trim(?)))
    ORDER BY earned_date,created_at LIMIT 1`);
  const hasBillingInvoices = Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='billing_invoices'`).get());
  const invoiceIdByNumber = hasBillingInvoices ? db.prepare('SELECT id FROM billing_invoices WHERE invoice_number=?') : null;
  const seedCommissionState = db.prepare(`INSERT OR IGNORE INTO agent_school_commission_state
    (agent_school_id,first_payment_invoice_id,created_at) VALUES (?,?,?)`);
  for (const school of existingSchoolEarnings) {
    const firstEarning = earliestPaymentEarning.get(school.agent_id, school.tenant_key, school.tenant_key, school.school_name);
    if (!firstEarning) continue;
    const invoice = invoiceIdByNumber?.get(firstEarning.invoice_ref);
    seedCommissionState.run(school.id, invoice?.id || firstEarning.invoice_ref, new Date().toISOString());
  }
  ensureColumn('agent_payouts', 'provider_conversation_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agent_payouts', 'provider_transaction_id', "TEXT NOT NULL DEFAULT ''");

  // Reconstruct legacy completed payouts once. Older versions attached a whole earning
  // to one payout even when only part of it was paid. Replay completed payouts FIFO so
  // the new allocation ledger preserves the actual aggregate cash movement.
  if (Number(db.prepare('SELECT COUNT(*) AS count FROM agent_payout_allocations').get().count || 0) === 0) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const payouts = db.prepare(`SELECT * FROM agent_payouts WHERE status='completed' ORDER BY created_at,payout_date,id`).all();
      const allocatedByEarning = new Map();
      const insertAllocation = db.prepare(`INSERT OR IGNORE INTO agent_payout_allocations
        (id,payout_id,earning_id,amount_ksh,created_at) VALUES (?,?,?,?,?)`);
      for (const payout of payouts) {
        let remaining = Number(payout.amount_ksh || 0);
        const earnings = db.prepare(`SELECT * FROM agent_earnings WHERE agent_id=? AND status<>'cancelled'
          AND created_at<=? ORDER BY earned_date,created_at,id`).all(payout.agent_id, payout.created_at);
        for (const earning of earnings) {
          if (remaining <= 0) break;
          const alreadyAllocated = Number(allocatedByEarning.get(earning.id) || 0);
          const available = Math.max(0, Number(earning.earned_amount_ksh || 0) - alreadyAllocated);
          if (!available) continue;
          const allocation = Math.min(remaining, available);
          insertAllocation.run(crypto.randomUUID(), payout.id, earning.id, allocation, payout.created_at);
          allocatedByEarning.set(earning.id, alreadyAllocated + allocation);
          remaining -= allocation;
        }
      }
      const allEarnings = db.prepare(`SELECT id,earned_amount_ksh,status FROM agent_earnings WHERE status<>'cancelled'`).all();
      const setStatus = db.prepare(`UPDATE agent_earnings SET status=?,updated_at=? WHERE id=?`);
      for (const earning of allEarnings) {
        const allocated = Number(allocatedByEarning.get(earning.id) || 0);
        if (allocated > 0 && allocated + 0.000001 < Number(earning.earned_amount_ksh || 0) && earning.status === 'paid') {
          setStatus.run('approved', new Date().toISOString(), earning.id);
        } else if (allocated + 0.000001 >= Number(earning.earned_amount_ksh || 0) && allocated > 0 && earning.status !== 'paid') {
          setStatus.run('paid', new Date().toISOString(), earning.id);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function allocateCompletedPayout(payout, now = new Date().toISOString()) {
    let remaining = Number(payout.amount_ksh || 0);
    const earnings = db.prepare(`SELECT e.*,
      COALESCE((SELECT SUM(pa.amount_ksh) FROM agent_payout_allocations pa WHERE pa.earning_id=e.id),0) AS allocated_ksh
      FROM agent_earnings e WHERE e.agent_id=? AND e.status<>'cancelled'
      ORDER BY e.earned_date,e.created_at,e.id`).all(payout.agent_id);
    for (const earning of earnings) {
      if (remaining <= 0) break;
      const earned = Number(earning.earned_amount_ksh || 0);
      const alreadyAllocated = Number(earning.allocated_ksh || 0);
      const available = Math.max(0, earned - alreadyAllocated);
      if (!available) continue;
      const allocation = Math.min(remaining, available);
      db.prepare(`INSERT INTO agent_payout_allocations (id,payout_id,earning_id,amount_ksh,created_at)
        VALUES (?,?,?,?,?)`).run(crypto.randomUUID(), payout.id, earning.id, allocation, now);
      const totalAllocated = alreadyAllocated + allocation;
      const nextStatus = totalAllocated + 0.000001 >= earned ? 'paid' : earning.status === 'pending' ? 'pending' : 'approved';
      db.prepare(`UPDATE agent_earnings SET status=?,payout_id=?,updated_at=? WHERE id=?`)
        .run(nextStatus, payout.id, now, earning.id);
      remaining -= allocation;
    }
    if (remaining > 0) throw new Error(`Could not allocate KES ${remaining.toLocaleString('en-KE')} of this payout to commission entries`);
  }

  // PIN policy: exactly 6 digits, not trivially guessable, stored salted with scrypt. Five wrong attempts lock the
  // account for 15 minutes. A PIN issued by an admin is temporary (24 hours) and must be changed at first sign-in.
  const PIN_SEPARATOR = String.fromCharCode(36);
  const PIN_PREFIX = 'scrypt' + PIN_SEPARATOR;
  const MAX_PIN_ATTEMPTS = 5;
  const PIN_LOCK_MS = 15 * 60 * 1000;
  const TEMP_PIN_TTL_MS = 24 * 60 * 60 * 1000;
  const EASY_PINS = new Set(['123123', '121212', '112233', '101010', '202020', '696969', '159753', '147258']);

  function assertValidPin(pin) {
    const value = String(pin === undefined || pin === null ? '' : pin).trim();
    if (!/^\d{6}$/.test(value)) throw new Error('PIN must be exactly 6 digits');
    const digits = value.split('').map(Number);
    const step = digits[1] - digits[0];
    const isRun = (step === 1 || step === -1) && digits.every((d, i) => i === 0 || d - digits[i - 1] === step);
    if (/^(\d)\1{5}$/.test(value) || isRun || EASY_PINS.has(value)) {
      throw new Error('That PIN is too easy to guess. Avoid repeated digits, runs like 123456 and simple patterns.');
    }
    return value;
  }

  function hashPin(pin) {
    if (!pin) return '';
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(pin), salt, 32);
    return PIN_PREFIX + salt.toString('hex') + PIN_SEPARATOR + hash.toString('hex');
  }

  function verifyPin(storedHash, pin) {
    if (!storedHash || !pin) return false;
    const stored = String(storedHash);
    if (stored.startsWith(PIN_PREFIX)) {
      const parts = stored.slice(PIN_PREFIX.length).split(PIN_SEPARATOR);
      if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
      const expected = Buffer.from(parts[1], 'hex');
      const actual = crypto.scryptSync(String(pin), Buffer.from(parts[0], 'hex'), expected.length);
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }
    // Legacy format: unsalted SHA-256 of the PIN (only ever created before the 6-digit policy)
    const legacy = Buffer.from(crypto.createHash('sha256').update(String(pin)).digest('hex'), 'hex');
    const expectedLegacy = Buffer.from(stored, 'hex');
    return legacy.length === expectedLegacy.length && crypto.timingSafeEqual(legacy, expectedLegacy);
  }

  function generateTempPin() {
    for (;;) {
      const candidate = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      try { return assertValidPin(candidate); } catch { /* too easy, draw again */ }
    }
  }

  const DUMMY_PIN_HASH = hashPin('000000');

  // Agents who still hold an old unsalted 4-digit PIN must choose a new 6-digit PIN at their next sign-in.
  db.prepare("UPDATE agents SET pin_must_change = 1 WHERE pin_hash <> '' AND pin_hash NOT LIKE ?").run(PIN_PREFIX + '%');

  function nextAgentCode() {
    const rows = db.prepare(`SELECT agent_code FROM agents ORDER BY rowid DESC LIMIT 50`).all();
    let maxNum = 1000;
    for (const row of rows) {
      const match = String(row.agent_code).match(/^AGT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `AGT-${maxNum + 1}`;
  }

  return {
    listAgents({ search = '', status = '' } = {}) {
      let query = `
        SELECT
          a.id, a.agent_code, a.full_name, a.email, a.phone, a.national_id,
          a.county, a.base_location, a.mpesa_number, a.bank_name, a.bank_account,
          a.commission_type, a.commission_rate, a.first_payment_commission_rate,
          a.recurring_payment_commission_rate, a.status, a.notes,
          a.created_at, a.updated_at, a.pin_must_change, a.pin_reset_requested_at,
          (SELECT COUNT(*) FROM agent_schools s WHERE s.agent_id=a.id) AS total_schools,
          (SELECT COALESCE(SUM(e.earned_amount_ksh),0) FROM agent_earnings e WHERE e.agent_id=a.id AND e.status IN ('pending','approved','paid')) AS total_earned_ksh,
          (SELECT COALESCE(SUM(p.amount_ksh),0) FROM agent_payouts p WHERE p.agent_id=a.id AND p.status='completed') AS total_paid_ksh,
          MAX(0,
            (SELECT COALESCE(SUM(e.earned_amount_ksh),0) FROM agent_earnings e WHERE e.agent_id=a.id AND e.status IN ('pending','approved','paid'))
            - (SELECT COALESCE(SUM(p.amount_ksh),0) FROM agent_payouts p WHERE p.agent_id=a.id AND p.status='completed')
            - (SELECT COALESCE(SUM(p.amount_ksh),0) FROM agent_payouts p WHERE p.agent_id=a.id AND p.status='pending')
          ) AS balance_due_ksh
        FROM agents a
        WHERE 1=1
      `;
      const params = {};
      if (status && status !== 'all') {
        query += ` AND a.status = @status`;
        params.status = status;
      }
      if (search) {
        query += ` AND (
          a.full_name LIKE @likeSearch OR
          a.agent_code LIKE @likeSearch OR
          a.phone LIKE @likeSearch OR
          a.email LIKE @likeSearch OR
          a.county LIKE @likeSearch
        )`;
        params.likeSearch = `%${search}%`;
      }
      query += ` ORDER BY a.created_at DESC`;
      return db.prepare(query).all(params);
    },

    getOverview() {
      const counts = db.prepare(`SELECT COUNT(*) AS total_agents,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_agents,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_agents FROM agents`).get() || {};
      const schoolCount = Number(db.prepare('SELECT COUNT(*) AS count FROM agent_schools').get()?.count || 0);
      const earningTotal = Number(db.prepare(`SELECT COALESCE(SUM(earned_amount_ksh),0) AS amount FROM agent_earnings WHERE status IN ('pending','approved','paid')`).get()?.amount || 0);
      const completedPayouts = Number(db.prepare(`SELECT COALESCE(SUM(amount_ksh),0) AS amount FROM agent_payouts WHERE status='completed'`).get()?.amount || 0);
      const pendingPayouts = Number(db.prepare(`SELECT COALESCE(SUM(amount_ksh),0) AS amount FROM agent_payouts WHERE status='pending'`).get()?.amount || 0);
      return {
        totalAgents: Number(counts.total_agents || 0),
        activeAgents: Number(counts.active_agents || 0),
        pendingAgents: Number(counts.pending_agents || 0),
        totalAssignedSchools: schoolCount,
        totalEarnedAll: earningTotal,
        totalBalanceDue: Math.max(0, earningTotal - completedPayouts - pendingPayouts),
        totalPayoutsDisbursed: completedPayouts,
        latestSchool: db.prepare(`
          SELECT s.school_name, s.created_at, a.full_name, a.agent_code
          FROM agent_schools s
          JOIN agents a ON a.id = s.agent_id
          ORDER BY s.created_at DESC
          LIMIT 1
        `).get() || null,
        latestAgent: db.prepare(`
          SELECT id, full_name, agent_code, status, created_at
          FROM agents
          ORDER BY created_at DESC
          LIMIT 1
        `).get() || null,
        latestPayout: db.prepare(`
          SELECT p.amount_ksh, p.created_at, p.status, a.full_name, a.agent_code
          FROM agent_payouts p
          JOIN agents a ON a.id = p.agent_id
          ORDER BY p.created_at DESC
          LIMIT 1
        `).get() || null,
      };
    },

    getAgent(id) {
      const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id);
      if (!agent) return null;

      const schools = db.prepare(`SELECT * FROM agent_schools WHERE agent_id = ? ORDER BY created_at DESC`).all(id);
      const earnings = db.prepare(`SELECT e.*,
        COALESCE((SELECT SUM(pa.amount_ksh) FROM agent_payout_allocations pa WHERE pa.earning_id=e.id),0) AS paid_amount_ksh
        FROM agent_earnings e WHERE e.agent_id = ? ORDER BY e.earned_date DESC, e.created_at DESC`).all(id).map(earning => {
          const paidAmount = Number(earning.paid_amount_ksh || 0);
          const remaining = Math.max(0, Number(earning.earned_amount_ksh || 0) - paidAmount);
          const displayStatus = remaining <= 0 && paidAmount > 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : earning.status;
          return { ...earning, paid_amount_ksh: paidAmount, balance_due_ksh: remaining, display_status: displayStatus };
        });
      const payouts = db.prepare(`SELECT * FROM agent_payouts WHERE agent_id = ? ORDER BY payout_date DESC, created_at DESC`).all(id).map(payout => ({
        ...payout,
        allocations: db.prepare(`SELECT pa.amount_ksh,e.id AS earning_id,e.school_name,e.invoice_ref,e.description
          FROM agent_payout_allocations pa JOIN agent_earnings e ON e.id=pa.earning_id
          WHERE pa.payout_id=? ORDER BY e.earned_date,e.created_at,e.id`).all(payout.id),
      }));

      const totalEarned = earnings
        .filter(e => ['pending', 'approved', 'paid'].includes(e.status))
        .reduce((sum, e) => sum + Number(e.earned_amount_ksh || 0), 0);
      const totalPaid = payouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount_ksh || 0), 0);
      const pendingPayouts = payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount_ksh || 0), 0);
      const balanceDue = Math.max(0, totalEarned - totalPaid - pendingPayouts);

      return {
        ...agent,
        pin_hash: undefined,
        has_pin: Boolean(agent.pin_hash),
        pin_must_change: Boolean(agent.pin_must_change),
        schools,
        earnings,
        payouts,
        financials: {
          totalEarnedKsh: totalEarned,
          totalPaidKsh: totalPaid,
          pendingPayoutsKsh: pendingPayouts,
          balanceDueKsh: balanceDue,
        },
      };
    },

    getAgentByPhone(phone) {
      if (!phone) return null;
      const clean = String(phone).trim();
      const match = db.prepare(`SELECT id FROM agents WHERE phone = ? OR mpesa_number = ? LIMIT 1`).get(clean, clean);
      return match ? this.getAgent(match.id) : null;
    },

    createAgent(data) {
      const now = new Date().toISOString();
      const id = 'agt_' + crypto.randomBytes(8).toString('hex');
      const agentCode = (data.agent_code || '').trim() || nextAgentCode();
      const fullName = (data.full_name || '').trim();
      const phone = (data.phone || '').trim();
      if (!fullName) throw new Error('Full name is required');
      if (!phone) throw new Error('Phone number is required');

      const pinHash = data.pin ? hashPin(assertValidPin(data.pin)) : '';
      const legacyType = ['percentage', 'fixed_per_school', 'fixed_per_student'].includes(data.commission_type) ? data.commission_type : 'percentage';
      const legacyRate = Number.isFinite(Number(data.commission_rate)) ? Number(data.commission_rate) : 10.0;
      const firstCommissionRate = commissionPercent(data.first_payment_commission_rate, 25, 'First-payment commission');
      const recurringCommissionRate = commissionPercent(data.recurring_payment_commission_rate,
        legacyType === 'percentage' && data.commission_rate !== undefined ? legacyRate : 10, 'Recurring commission');

      db.prepare(`
        INSERT INTO agents (
          id, agent_code, full_name, email, phone, national_id,
          county, base_location, mpesa_number, bank_name, bank_account,
          commission_type, commission_rate, first_payment_commission_rate, recurring_payment_commission_rate,
          status, pin_hash, notes,
          created_at, updated_at
        ) VALUES (
          @id, @agent_code, @full_name, @email, @phone, @national_id,
          @county, @base_location, @mpesa_number, @bank_name, @bank_account,
          @commission_type, @commission_rate, @first_payment_commission_rate, @recurring_payment_commission_rate,
          @status, @pin_hash, @notes,
          @created_at, @updated_at
        )
      `).run({
        id,
        agent_code: agentCode,
        full_name: fullName,
        email: (data.email || '').trim().toLowerCase(),
        phone,
        national_id: (data.national_id || '').trim(),
        county: (data.county || '').trim(),
        base_location: (data.base_location || '').trim(),
        mpesa_number: (data.mpesa_number || phone).trim(),
        bank_name: (data.bank_name || '').trim(),
        bank_account: (data.bank_account || '').trim(),
        commission_type: legacyType,
        commission_rate: legacyType === 'percentage' ? recurringCommissionRate : legacyRate,
        first_payment_commission_rate: firstCommissionRate,
        recurring_payment_commission_rate: recurringCommissionRate,
        status: ['active', 'pending', 'inactive'].includes(data.status) ? data.status : 'active',
        pin_hash: pinHash,
        notes: (data.notes || '').trim(),
        created_at: now,
        updated_at: now,
      });

      return this.getAgent(id);
    },

    updateAgent(id, data) {
      const existing = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const pinHash = existing.pin_hash; // PINs change only through setPin() or issueTempPin()
      const firstCommissionRate = commissionPercent(data.first_payment_commission_rate,
        existing.first_payment_commission_rate ?? 25, 'First-payment commission');
      const recurringFallback = data.commission_type === 'percentage' && data.commission_rate !== undefined
        ? data.commission_rate
        : existing.recurring_payment_commission_rate ?? 10;
      const recurringCommissionRate = commissionPercent(data.recurring_payment_commission_rate,
        recurringFallback, 'Recurring commission');

      db.prepare(`
        UPDATE agents SET
          full_name = @full_name,
          email = @email,
          phone = @phone,
          national_id = @national_id,
          county = @county,
          base_location = @base_location,
          mpesa_number = @mpesa_number,
          bank_name = @bank_name,
          bank_account = @bank_account,
          commission_type = @commission_type,
          commission_rate = @commission_rate,
          first_payment_commission_rate = @first_payment_commission_rate,
          recurring_payment_commission_rate = @recurring_payment_commission_rate,
          status = @status,
          pin_hash = @pin_hash,
          notes = @notes,
          updated_at = @updated_at
        WHERE id = @id
      `).run({
        id,
        full_name: data.full_name !== undefined ? String(data.full_name).trim() : existing.full_name,
        email: data.email !== undefined ? String(data.email).trim().toLowerCase() : existing.email,
        phone: data.phone !== undefined ? String(data.phone).trim() : existing.phone,
        national_id: data.national_id !== undefined ? String(data.national_id).trim() : existing.national_id,
        county: data.county !== undefined ? String(data.county).trim() : existing.county,
        base_location: data.base_location !== undefined ? String(data.base_location).trim() : existing.base_location,
        mpesa_number: data.mpesa_number !== undefined ? String(data.mpesa_number).trim() : existing.mpesa_number,
        bank_name: data.bank_name !== undefined ? String(data.bank_name).trim() : existing.bank_name,
        bank_account: data.bank_account !== undefined ? String(data.bank_account).trim() : existing.bank_account,
        commission_type: ['percentage', 'fixed_per_school', 'fixed_per_student'].includes(data.commission_type) ? data.commission_type : existing.commission_type,
        commission_rate: data.recurring_payment_commission_rate === undefined && data.commission_rate !== undefined && !isNaN(Number(data.commission_rate))
          ? Number(data.commission_rate) : existing.commission_rate,
        first_payment_commission_rate: firstCommissionRate,
        recurring_payment_commission_rate: recurringCommissionRate,
        status: ['active', 'pending', 'inactive'].includes(data.status) ? data.status : existing.status,
        pin_hash: pinHash,
        notes: data.notes !== undefined ? String(data.notes).trim() : existing.notes,
        updated_at: now,
      });

      return this.getAgent(id);
    },

    deleteAgent(id) {
      const existing = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(id);
      if (!existing) return false;
      db.prepare(`DELETE FROM agent_schools WHERE agent_id = ?`).run(id);
      db.prepare(`DELETE FROM agent_payout_allocations WHERE payout_id IN (SELECT id FROM agent_payouts WHERE agent_id = ?)`).run(id);
      db.prepare(`DELETE FROM agent_earnings WHERE agent_id = ?`).run(id);
      db.prepare(`DELETE FROM agent_payouts WHERE agent_id = ?`).run(id);
      db.prepare(`DELETE FROM agents WHERE id = ?`).run(id);
      return true;
    },

    // ── School Assignments ───────────────────────────────────────────────
    addSchool(agentId, data) {
      const agent = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agentId);
      if (!agent) throw new Error('Agent not found');
      const schoolName = (data.school_name || '').trim();
      if (!schoolName) throw new Error('School name is required');

      const now = new Date().toISOString();
      const id = 'ags_' + crypto.randomBytes(8).toString('hex');

      db.prepare(`
        INSERT INTO agent_schools (
          id, agent_id, school_name, tenant_key, lead_id,
          contact_person, contact_phone, status, notes,
          created_at, updated_at
        ) VALUES (
          @id, @agent_id, @school_name, @tenant_key, @lead_id,
          @contact_person, @contact_phone, @status, @notes,
          @created_at, @updated_at
        )
      `).run({
        id,
        agent_id: agentId,
        school_name: schoolName,
        tenant_key: (data.tenant_key || '').trim().toLowerCase(),
        lead_id: (data.lead_id || '').trim(),
        contact_person: (data.contact_person || '').trim(),
        contact_phone: (data.contact_phone || '').trim(),
        status: ['pitching', 'onboarded', 'active', 'churned'].includes(data.status) ? data.status : 'pitching',
        notes: (data.notes || '').trim(),
        created_at: now,
        updated_at: now,
      });

      return db.prepare(`SELECT * FROM agent_schools WHERE id = ?`).get(id);
    },

    updateSchool(schoolId, data) {
      const existing = db.prepare(`SELECT * FROM agent_schools WHERE id = ?`).get(schoolId);
      if (!existing) return null;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE agent_schools SET
          school_name = @school_name,
          tenant_key = @tenant_key,
          contact_person = @contact_person,
          contact_phone = @contact_phone,
          status = @status,
          notes = @notes,
          updated_at = @updated_at
        WHERE id = @id
      `).run({
        id: schoolId,
        school_name: data.school_name !== undefined ? String(data.school_name).trim() : existing.school_name,
        tenant_key: data.tenant_key !== undefined ? String(data.tenant_key).trim().toLowerCase() : existing.tenant_key,
        contact_person: data.contact_person !== undefined ? String(data.contact_person).trim() : existing.contact_person,
        contact_phone: data.contact_phone !== undefined ? String(data.contact_phone).trim() : existing.contact_phone,
        status: ['pitching', 'onboarded', 'active', 'churned'].includes(data.status) ? data.status : existing.status,
        notes: data.notes !== undefined ? String(data.notes).trim() : existing.notes,
        updated_at: now,
      });

      return db.prepare(`SELECT * FROM agent_schools WHERE id = ?`).get(schoolId);
    },

    deleteSchool(schoolId) {
      const res = db.prepare(`DELETE FROM agent_schools WHERE id = ?`).run(schoolId);
      return res.changes > 0;
    },

    // ── Earnings / Commissions Ledger ────────────────────────────────────
    recordEarning(agentId, data) {
      const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId);
      if (!agent) throw new Error('Agent not found');

      const earnedAmount = Number(data.earned_amount_ksh);
      if (isNaN(earnedAmount) || earnedAmount <= 0) throw new Error('Earned commission amount must be greater than 0');

      const now = new Date().toISOString();
      const id = 'ern_' + crypto.randomBytes(8).toString('hex');
      const earnedDate = data.earned_date ? String(data.earned_date).slice(0, 10) : now.slice(0, 10);

      db.prepare(`
        INSERT INTO agent_earnings (
          id, agent_id, school_name, invoice_ref, description,
          gross_amount_ksh, commission_rate, commission_type,
          earned_amount_ksh, status, earned_date, payout_id,
          created_at, updated_at
        ) VALUES (
          @id, @agent_id, @school_name, @invoice_ref, @description,
          @gross_amount_ksh, @commission_rate, @commission_type,
          @earned_amount_ksh, @status, @earned_date, '',
          @created_at, @updated_at
        )
      `).run({
        id,
        agent_id: agentId,
        school_name: (data.school_name || '').trim(),
        invoice_ref: (data.invoice_ref || '').trim(),
        description: (data.description || 'Commission on school subscription').trim(),
        gross_amount_ksh: Number(data.gross_amount_ksh || 0),
        commission_rate: Number(data.commission_rate ?? agent.commission_rate),
        commission_type: data.commission_type || agent.commission_type,
        earned_amount_ksh: earnedAmount,
        status: ['pending', 'approved'].includes(data.status) ? data.status : 'approved',
        earned_date: earnedDate,
        created_at: now,
        updated_at: now,
      });

      return db.prepare(`SELECT * FROM agent_earnings WHERE id = ?`).get(id);
    },

    updateEarningStatus(earningId, status) {
      if (!['pending', 'approved', 'paid', 'cancelled'].includes(status)) {
        throw new Error('Invalid earning status');
      }
      if (status === 'paid') throw new Error('Earnings are marked paid only when an actual payout is allocated');
      if (status === 'cancelled' && Number(db.prepare('SELECT COALESCE(SUM(amount_ksh),0) AS amount FROM agent_payout_allocations WHERE earning_id=?').get(earningId)?.amount || 0) > 0) {
        throw new Error('An earning with a recorded payout allocation cannot be cancelled');
      }
      const now = new Date().toISOString();
      const res = db.prepare(`UPDATE agent_earnings SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, earningId);
      return res.changes > 0 ? db.prepare(`SELECT * FROM agent_earnings WHERE id = ?`).get(earningId) : null;
    },

    // ── Payouts ──────────────────────────────────────────────────────────
    recordPayout(agentId, data, actor = 'admin') {
      const amount = Number(data.amount_ksh);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Payout amount must be a positive whole number of KES');

      const now = new Date().toISOString();
      const id = 'pay_' + crypto.randomBytes(8).toString('hex');
      const payoutDate = data.payout_date ? String(data.payout_date).slice(0, 10) : now.slice(0, 10);

      db.exec('BEGIN IMMEDIATE');
      try {
      const agent = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agentId);
      if (!agent) throw new Error('Agent not found');
      const totalEarned = Number(db.prepare(`SELECT COALESCE(SUM(earned_amount_ksh),0) AS amount FROM agent_earnings
        WHERE agent_id=? AND status IN ('pending','approved','paid')`).get(agentId).amount || 0);
      const alreadyPaid = Number(db.prepare(`SELECT COALESCE(SUM(amount_ksh),0) AS amount FROM agent_payouts
        WHERE agent_id=? AND status IN ('completed','pending')`).get(agentId).amount || 0);
      const available = Math.max(0, totalEarned - alreadyPaid);
      if (amount > available) throw new Error(`Payout exceeds available commission balance of KES ${available.toLocaleString()}`);

      db.prepare(`
        INSERT INTO agent_payouts (
          id, agent_id, amount_ksh, payout_method, reference,
          status, payout_date, notes, processed_by, created_at
        ) VALUES (
          @id, @agent_id, @amount_ksh, @payout_method, @reference,
          @status, @payout_date, @notes, @processed_by, @created_at
        )
      `).run({
        id,
        agent_id: agentId,
        amount_ksh: amount,
        payout_method: ['mpesa', 'bank_transfer', 'cash', 'other'].includes(data.payout_method) ? data.payout_method : 'mpesa',
        reference: (data.reference || '').trim(),
        status: ['pending', 'completed', 'failed'].includes(data.status) ? data.status : 'completed',
        payout_date: payoutDate,
        notes: (data.notes || '').trim(),
        processed_by: String(actor || 'admin'),
        created_at: now,
      });

      const payout = db.prepare(`SELECT * FROM agent_payouts WHERE id=?`).get(id);
      // Completed payouts allocate only the paid portion of each earning, FIFO.
      if (data.status !== 'pending' && data.status !== 'failed') {
        allocateCompletedPayout(payout, now);
      }
      db.exec('COMMIT');
      return db.prepare(`SELECT * FROM agent_payouts WHERE id = ?`).get(id);
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    linkPayoutToProvider(payoutId, conversationId) {
      const result = db.prepare(`UPDATE agent_payouts SET provider_conversation_id=? WHERE id=? AND status='pending'`)
        .run(String(conversationId || ''), payoutId);
      return result.changes ? db.prepare('SELECT * FROM agent_payouts WHERE id=?').get(payoutId) : null;
    },

    getPayoutByProviderConversation(conversationId) {
      return db.prepare('SELECT * FROM agent_payouts WHERE provider_conversation_id=?').get(String(conversationId || '')) || null;
    },

    getPayout(payoutId) {
      return db.prepare('SELECT * FROM agent_payouts WHERE id=?').get(String(payoutId || '')) || null;
    },

    saveProviderPayoutCallback({ conversationId, payoutId, resultCode, transactionId, payload }) {
      const now = new Date().toISOString();
      const callbackKey = String(conversationId || payoutId || `unknown-${Date.now()}`);
      db.prepare(`INSERT OR IGNORE INTO agent_payout_callbacks
        (callback_key,conversation_id,payout_id,result_code,transaction_id,payload,handled,created_at)
        VALUES (?,?,?,?,?,?,0,?)`).run(callbackKey, String(conversationId || ''), String(payoutId || ''),
          Number.isInteger(Number(resultCode)) ? Number(resultCode) : -1, String(transactionId || ''), JSON.stringify(payload || {}), now);
      const row = db.prepare('SELECT * FROM agent_payout_callbacks WHERE callback_key=?').get(callbackKey);
      return row ? { ...row, payload: JSON.parse(row.payload || '{}') } : null;
    },

    getPendingProviderPayoutCallback(conversationId) {
      const row = db.prepare(`SELECT * FROM agent_payout_callbacks WHERE conversation_id=? AND handled=0`).get(String(conversationId || ''));
      return row ? { ...row, payload: JSON.parse(row.payload || '{}') } : null;
    },

    markProviderPayoutCallbackHandled(conversationId) {
      db.prepare('UPDATE agent_payout_callbacks SET handled=1 WHERE conversation_id=?').run(String(conversationId || ''));
    },

    updateProviderPayout(payoutId, status, transactionId = '') {
      if (!['completed', 'failed'].includes(status)) throw new Error('Provider payout status must be completed or failed');
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const payout = db.prepare(`SELECT * FROM agent_payouts WHERE id=?`).get(payoutId);
        if (!payout) throw new Error('Payout not found');
        if (payout.status !== 'pending') {
          db.exec('COMMIT');
          return payout;
        }
        db.prepare(`UPDATE agent_payouts SET status=?, provider_transaction_id=?,
          reference=CASE WHEN ? <> '' THEN ? ELSE reference END, payout_date=?, notes=notes || ? WHERE id=?`)
          .run(status, String(transactionId || ''), String(transactionId || ''), String(transactionId || ''), now.slice(0, 10),
            status === 'failed' ? ' · Daraja reported transfer failure' : ' · Daraja confirmed transfer', payoutId);
        if (status === 'completed') allocateCompletedPayout({ ...payout, amount_ksh: Number(payout.amount_ksh) }, now);
        db.exec('COMMIT');
        return db.prepare('SELECT * FROM agent_payouts WHERE id=?').get(payoutId);
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    // ── Authentication for Agent App ─────────────────────────────────────
    authenticateAgent(phone, pin) {
      if (!phone || !pin) return null;
      const cleanPhone = String(phone).trim();
      const agent = db.prepare(`SELECT * FROM agents WHERE phone = ? OR mpesa_number = ? ORDER BY (phone = ?) DESC LIMIT 1`).get(cleanPhone, cleanPhone, cleanPhone);
      if (!agent) {
        verifyPin(DUMMY_PIN_HASH, pin); // do the same work as for a real account
        return null;
      }

      const now = Date.now();
      const lockedUntil = Date.parse(agent.pin_locked_until || '');
      if (Number.isFinite(lockedUntil) && now < lockedUntil) {
        const lockError = new Error('Too many wrong PIN attempts. Try again in 15 minutes.');
        lockError.code = 'PIN_LOCKED';
        throw lockError;
      }

      if (!verifyPin(agent.pin_hash, pin)) {
        const attempts = Number(agent.pin_failed_attempts || 0) + 1;
        if (attempts >= MAX_PIN_ATTEMPTS) {
          db.prepare(`UPDATE agents SET pin_failed_attempts = 0, pin_locked_until = ? WHERE id = ?`).run(new Date(now + PIN_LOCK_MS).toISOString(), agent.id);
        } else {
          db.prepare(`UPDATE agents SET pin_failed_attempts = ? WHERE id = ?`).run(attempts, agent.id);
        }
        return null;
      }

      const tempExpiry = Date.parse(agent.pin_temp_expires_at || '');
      if (Number.isFinite(tempExpiry) && now > tempExpiry) return null; // temporary PIN expired: an admin must issue a new one

      if (agent.pin_failed_attempts || agent.pin_locked_until) {
        db.prepare(`UPDATE agents SET pin_failed_attempts = 0, pin_locked_until = '' WHERE id = ?`).run(agent.id);
      }
      if (!String(agent.pin_hash).startsWith(PIN_PREFIX)) {
        db.prepare(`UPDATE agents SET pin_hash = ? WHERE id = ?`).run(hashPin(pin), agent.id); // re-store an old PIN salted until it is changed
      }
      if (agent.status !== 'active') throw new Error('Agent account is inactive or pending approval');
      return this.getAgent(agent.id);
    },

    // Sets a new PIN (6 digits, not trivially guessable). Bumps the token version so every older session signs out.
    setPin(agentId, newPin, { mustChange = false, ttlMs = 0 } = {}) {
      const pin = assertValidPin(newPin);
      const now = new Date();
      const expiresAt = ttlMs > 0 ? new Date(now.getTime() + ttlMs).toISOString() : '';
      const result = db.prepare(`
        UPDATE agents SET
          pin_hash = ?, pin_must_change = ?, pin_failed_attempts = 0, pin_locked_until = '',
          pin_temp_expires_at = ?, pin_changed_at = ?, pin_reset_requested_at = '',
          auth_token_version = auth_token_version + 1, updated_at = ?
        WHERE id = ?
      `).run(hashPin(pin), mustChange ? 1 : 0, expiresAt, now.toISOString(), now.toISOString(), agentId);
      return result.changes > 0 ? { expiresAt } : null;
    },

    // Admin reset: a random temporary PIN that works for 24 hours and must be replaced at first sign-in.
    // The PIN is returned once and never stored in readable form.
    issueTempPin(agentId) {
      const exists = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agentId);
      if (!exists) return null;
      const tempPin = generateTempPin();
      const result = this.setPin(agentId, tempPin, { mustChange: true, ttlMs: TEMP_PIN_TTL_MS });
      return { tempPin, expiresAt: result.expiresAt };
    },

    // "Forgot PIN": records the request for an admin to act on. Returns whether a matching agent exists
    // (the API must not tell the caller).
    requestPinReset(phone) {
      const cleanPhone = String(phone || '').trim();
      if (!cleanPhone) return false;
      const result = db.prepare(`UPDATE agents SET pin_reset_requested_at = ? WHERE phone = ?`).run(new Date().toISOString(), cleanPhone);
      return result.changes > 0;
    },

    // ── School Auto-Attribution & Commission Automation ───────────────────
    findAgentForSchool({ leadId = '', tenantKey = '', schoolName = '' } = {}) {
      const cleanTenant = String(tenantKey || '').trim().toLowerCase();
      const cleanName = String(schoolName || '').trim();

      let match = null;
      if (leadId) {
        const leadMatches = db.prepare(`SELECT a.*,s.id AS matched_school_id FROM leads l
          JOIN agent_schools s ON (s.id=l.agent_school_id OR s.lead_id=l.id)
          JOIN agents a ON a.id=s.agent_id
          WHERE l.id=? AND a.status='active'`).all(String(leadId));
        if (leadMatches.length > 1) return null;
        match = leadMatches[0] || null;
      }
      if (cleanTenant) {
        match = match || (() => {
          const rows = db.prepare(`
          SELECT a.*,s.id AS matched_school_id FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE lower(s.tenant_key) = ? AND a.status = 'active'
        `).all(cleanTenant);
          return rows.length === 1 ? rows[0] : null;
        })();
      }
      if (!match && cleanName) {
        const rows = db.prepare(`
          SELECT a.*,s.id AS matched_school_id FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE lower(trim(s.school_name)) = lower(trim(?)) AND a.status = 'active'
        `).all(cleanName);
        match = rows.length === 1 ? rows[0] : null;
      }
      return match || null;
    },

    attributePaymentCommission({ payment, invoice, customer }) {
      if (!payment || !invoice) return null;

      // Idempotency: verify this payment has not already been attributed
      const existing = db.prepare(`SELECT id FROM agent_earnings WHERE payment_id = ?`).get(payment.id);
      if (existing) return null;

      let invoiceSnapshot = invoice.invoiceSnapshot;
      if (typeof invoiceSnapshot === 'string') {
        try { invoiceSnapshot = JSON.parse(invoiceSnapshot); } catch {}
      }

      const schoolName = customer?.name || customer?.legalName || invoiceSnapshot?.customerSnapshot?.name || '';
      const tenantKey = customer?.tenantKey || invoiceSnapshot?.customerSnapshot?.tenantKey || '';

      const leadId = String(invoiceSnapshot?.leadId || invoiceSnapshot?.quoteSnapshot?.leadId || '');
      const agent = this.findAgentForSchool({ leadId, tenantKey, schoolName });
      if (!agent) return null;

      const paymentAmount = Number(payment.amountKsh || payment.amount_ksh || 0);
      if (paymentAmount <= 0) return null;
      const now = new Date().toISOString();
      const id = 'ern_' + crypto.randomBytes(8).toString('hex');
      const earnedDate = payment.paymentDate || now.slice(0, 10);
      const invoiceNumber = invoice.invoiceNumber || invoice.id || '';
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT id FROM agent_earnings WHERE payment_id=?').get(payment.id)) {
          db.exec('COMMIT');
          return null;
        }
        const schoolId = agent.matched_school_id;
        let state = db.prepare(`SELECT first_payment_invoice_id FROM agent_school_commission_state WHERE agent_school_id=?`).get(schoolId);
        if (!state) {
          db.prepare(`INSERT INTO agent_school_commission_state (agent_school_id,first_payment_invoice_id,created_at) VALUES (?,?,?)`)
            .run(schoolId, String(invoice.id || invoiceNumber), now);
          state = { first_payment_invoice_id: String(invoice.id || invoiceNumber) };
        }
        const isFirstInvoice = state.first_payment_invoice_id === String(invoice.id || invoiceNumber);
        const commissionRate = Number(isFirstInvoice ? agent.first_payment_commission_rate : agent.recurring_payment_commission_rate);
        const earnedKsh = Math.round((paymentAmount * commissionRate) / 100);
        if (earnedKsh <= 0) {
          db.exec('COMMIT');
          return null;
        }
        const description = isFirstInvoice
          ? `First school invoice commission (${commissionRate}%) on payment for ${invoiceNumber}`
          : `Recurring term commission (${commissionRate}%) on payment for ${invoiceNumber}`;
        db.prepare(`INSERT INTO agent_earnings (
          id,agent_id,school_name,tenant_key,invoice_ref,payment_id,description,gross_amount_ksh,
          commission_rate,commission_type,earned_amount_ksh,status,earned_date,payout_id,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,'percentage',?,'approved',?,?,?,?)`)
          .run(id, agent.id, schoolName, tenantKey, invoiceNumber, payment.id, description, paymentAmount,
            commissionRate, earnedKsh, earnedDate, '', now, now);
        db.exec('COMMIT');
        return { ...db.prepare('SELECT * FROM agent_earnings WHERE id=?').get(id), agent_code: agent.agent_code, agent_name: agent.full_name };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    getSchool(schoolId) {
      if (!schoolId) return null;
      return db.prepare(`SELECT * FROM agent_schools WHERE id = ?`).get(schoolId) || null;
    },

    close() {
      try { db.close(); } catch (_) {}
    },
  };
}

module.exports = { createAgentsStore };
