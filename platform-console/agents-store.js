'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

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
  `);

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  ensureColumn('agent_earnings', 'payment_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agent_earnings', 'tenant_key', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('agents', 'auth_token_version', "INTEGER NOT NULL DEFAULT 1");

  function hashPin(pin) {
    if (!pin) return '';
    return crypto.createHash('sha256').update(String(pin)).digest('hex');
  }

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
          a.commission_type, a.commission_rate, a.status, a.notes,
          a.created_at, a.updated_at,
          COUNT(DISTINCT s.id) AS total_schools,
          COALESCE(SUM(CASE WHEN e.status IN ('pending', 'approved', 'paid') THEN e.earned_amount_ksh ELSE 0 END), 0) AS total_earned_ksh,
          COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.earned_amount_ksh ELSE 0 END), 0) AS total_paid_ksh,
          COALESCE(SUM(CASE WHEN e.status IN ('pending', 'approved') THEN e.earned_amount_ksh ELSE 0 END), 0) AS balance_due_ksh
        FROM agents a
        LEFT JOIN agent_schools s ON s.agent_id = a.id
        LEFT JOIN agent_earnings e ON e.agent_id = a.id
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
      query += ` GROUP BY a.id ORDER BY a.created_at DESC`;
      return db.prepare(query).all(params);
    },

    getOverview() {
      const counts = db.prepare(`
        SELECT
          COUNT(DISTINCT a.id) AS total_agents,
          COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END) AS active_agents,
          COUNT(DISTINCT CASE WHEN a.status = 'pending' THEN a.id END) AS pending_agents,
          COUNT(DISTINCT s.id) AS total_assigned_schools,
          COALESCE(SUM(CASE WHEN e.status IN ('pending', 'approved', 'paid') THEN e.earned_amount_ksh ELSE 0 END), 0) AS total_earned_all,
          COALESCE(SUM(CASE WHEN e.status IN ('pending', 'approved') THEN e.earned_amount_ksh ELSE 0 END), 0) AS total_balance_due,
          COALESCE(SUM(p.amount_ksh), 0) AS total_payouts_disbursed
        FROM agents a
        LEFT JOIN agent_schools s ON s.agent_id = a.id
        LEFT JOIN agent_earnings e ON e.agent_id = a.id
        LEFT JOIN agent_payouts p ON p.agent_id = a.id
      `).get() || {};
      return {
        totalAgents: Number(counts.total_agents || 0),
        activeAgents: Number(counts.active_agents || 0),
        pendingAgents: Number(counts.pending_agents || 0),
        totalAssignedSchools: Number(counts.total_assigned_schools || 0),
        totalEarnedAll: Number(counts.total_earned_all || 0),
        totalBalanceDue: Number(counts.total_balance_due || 0),
        totalPayoutsDisbursed: Number(counts.total_payouts_disbursed || 0),
      };
    },

    getAgent(id) {
      const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id);
      if (!agent) return null;

      const schools = db.prepare(`SELECT * FROM agent_schools WHERE agent_id = ? ORDER BY created_at DESC`).all(id);
      const earnings = db.prepare(`SELECT * FROM agent_earnings WHERE agent_id = ? ORDER BY earned_date DESC, created_at DESC`).all(id);
      const payouts = db.prepare(`SELECT * FROM agent_payouts WHERE agent_id = ? ORDER BY payout_date DESC, created_at DESC`).all(id);

      const totalEarned = earnings
        .filter(e => ['pending', 'approved', 'paid'].includes(e.status))
        .reduce((sum, e) => sum + Number(e.earned_amount_ksh || 0), 0);
      const totalPaid = payouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount_ksh || 0), 0);
      const balanceDue = Math.max(0, totalEarned - totalPaid);

      return {
        ...agent,
        pin_hash: undefined,
        has_pin: Boolean(agent.pin_hash),
        schools,
        earnings,
        payouts,
        financials: {
          totalEarnedKsh: totalEarned,
          totalPaidKsh: totalPaid,
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

      const pinHash = data.pin ? hashPin(data.pin) : '';

      db.prepare(`
        INSERT INTO agents (
          id, agent_code, full_name, email, phone, national_id,
          county, base_location, mpesa_number, bank_name, bank_account,
          commission_type, commission_rate, status, pin_hash, notes,
          created_at, updated_at
        ) VALUES (
          @id, @agent_code, @full_name, @email, @phone, @national_id,
          @county, @base_location, @mpesa_number, @bank_name, @bank_account,
          @commission_type, @commission_rate, @status, @pin_hash, @notes,
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
        commission_type: ['percentage', 'fixed_per_school', 'fixed_per_student'].includes(data.commission_type) ? data.commission_type : 'percentage',
        commission_rate: Number(data.commission_rate >= 0 ? data.commission_rate : 10.0),
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
      const pinHash = data.pin ? hashPin(data.pin) : existing.pin_hash;

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
        commission_rate: data.commission_rate !== undefined && !isNaN(Number(data.commission_rate)) ? Number(data.commission_rate) : existing.commission_rate,
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
        status: ['pending', 'approved', 'paid'].includes(data.status) ? data.status : 'approved',
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
      const now = new Date().toISOString();
      const res = db.prepare(`UPDATE agent_earnings SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, earningId);
      return res.changes > 0 ? db.prepare(`SELECT * FROM agent_earnings WHERE id = ?`).get(earningId) : null;
    },

    // ── Payouts ──────────────────────────────────────────────────────────
    recordPayout(agentId, data, actor = 'admin') {
      const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId);
      if (!agent) throw new Error('Agent not found');

      const amount = Number(data.amount_ksh);
      if (isNaN(amount) || amount <= 0) throw new Error('Payout amount must be greater than 0');

      const now = new Date().toISOString();
      const id = 'pay_' + crypto.randomBytes(8).toString('hex');
      const payoutDate = data.payout_date ? String(data.payout_date).slice(0, 10) : now.slice(0, 10);

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

      // If completed payout, mark oldest approved earnings as paid up to this amount
      if (data.status !== 'pending' && data.status !== 'failed') {
        const approvedEarnings = db.prepare(`
          SELECT id, earned_amount_ksh FROM agent_earnings
          WHERE agent_id = ? AND status IN ('pending', 'approved')
          ORDER BY earned_date ASC, created_at ASC
        `).all(agentId);

        let remaining = amount;
        for (const earning of approvedEarnings) {
          if (remaining <= 0) break;
          db.prepare(`UPDATE agent_earnings SET status = 'paid', payout_id = ?, updated_at = ? WHERE id = ?`).run(id, now, earning.id);
          remaining -= Number(earning.earned_amount_ksh);
        }
      }

      return db.prepare(`SELECT * FROM agent_payouts WHERE id = ?`).get(id);
    },

    // ── Authentication for Agent App ─────────────────────────────────────
    authenticateAgent(phone, pin) {
      if (!phone || !pin) return null;
      const cleanPhone = String(phone).trim();
      const pinHash = hashPin(pin);
      const agent = db.prepare(`SELECT * FROM agents WHERE phone = ? OR mpesa_number = ?`).get(cleanPhone, cleanPhone);
      if (!agent) return null;
      if (!agent.pin_hash || agent.pin_hash !== pinHash) return null;
      if (agent.status !== 'active') throw new Error('Agent account is inactive or pending approval');
      return this.getAgent(agent.id);
    },

    // ── School Auto-Attribution & Commission Automation ───────────────────
    findAgentForSchool({ tenantKey = '', schoolName = '' } = {}) {
      const cleanTenant = String(tenantKey || '').trim().toLowerCase();
      const cleanName = String(schoolName || '').trim();

      let match = null;
      if (cleanTenant) {
        match = db.prepare(`
          SELECT a.* FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE lower(s.tenant_key) = ? AND a.status = 'active'
          LIMIT 1
        `).get(cleanTenant);
      }
      if (!match && cleanName) {
        match = db.prepare(`
          SELECT a.* FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE lower(s.school_name) = lower(?) AND a.status = 'active'
          LIMIT 1
        `).get(cleanName);
      }
      if (!match && cleanName) {
        match = db.prepare(`
          SELECT a.* FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE lower(s.school_name) LIKE lower(?) AND a.status = 'active'
          LIMIT 1
        `).get(`%${cleanName}%`);
      }
      if (!match && cleanName) {
        match = db.prepare(`
          SELECT a.* FROM agents a
          JOIN agent_schools s ON s.agent_id = a.id
          WHERE ? LIKE '%' || lower(s.school_name) || '%' AND a.status = 'active'
          LIMIT 1
        `).get(cleanName.toLowerCase());
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

      const agent = this.findAgentForSchool({ tenantKey, schoolName });
      if (!agent) return null;

      const paymentAmount = Number(payment.amountKsh || payment.amount_ksh || 0);
      if (paymentAmount <= 0) return null;

      let earnedKsh = 0;
      if (agent.commission_type === 'percentage') {
        earnedKsh = Math.round((paymentAmount * Number(agent.commission_rate)) / 100);
      } else if (agent.commission_type === 'fixed_per_school') {
        // Attribute fixed amount only on the first payment for this school
        const pastEarnings = db.prepare(`
          SELECT id FROM agent_earnings
          WHERE agent_id = ? AND (lower(school_name) = lower(?) OR (tenant_key <> '' AND lower(tenant_key) = lower(?)))
        `).get(agent.id, schoolName, tenantKey);
        if (!pastEarnings) {
          earnedKsh = Number(agent.commission_rate);
        }
      } else if (agent.commission_type === 'fixed_per_student') {
        const enrollment = Number(invoice.invoiceSnapshot?.quoteSnapshot?.enrollmentCount || 0);
        earnedKsh = Math.round(enrollment * Number(agent.commission_rate));
      }

      if (earnedKsh <= 0) return null;

      const now = new Date().toISOString();
      const id = 'ern_' + crypto.randomBytes(8).toString('hex');
      const earnedDate = payment.paymentDate || now.slice(0, 10);
      const invoiceNumber = invoice.invoiceNumber || invoice.id || '';

      db.prepare(`
        INSERT INTO agent_earnings (
          id, agent_id, school_name, tenant_key, invoice_ref, payment_id,
          description, gross_amount_ksh, commission_rate, commission_type,
          earned_amount_ksh, status, earned_date, payout_id, created_at, updated_at
        ) VALUES (
          @id, @agent_id, @school_name, @tenant_key, @invoice_ref, @payment_id,
          @description, @gross_amount_ksh, @commission_rate, @commission_type,
          @earned_amount_ksh, 'approved', @earned_date, '', @created_at, @updated_at
        )
      `).run({
        id,
        agent_id: agent.id,
        school_name: schoolName,
        tenant_key: tenantKey,
        invoice_ref: invoiceNumber,
        payment_id: payment.id,
        description: `Auto commission (${agent.commission_rate}${agent.commission_type === 'percentage' ? '%' : ' KES'}) on payment for ${invoiceNumber}`,
        gross_amount_ksh: paymentAmount,
        commission_rate: Number(agent.commission_rate),
        commission_type: agent.commission_type,
        earned_amount_ksh: earnedKsh,
        earned_date: earnedDate,
        created_at: now,
        updated_at: now,
      });

      return {
        ...db.prepare(`SELECT * FROM agent_earnings WHERE id = ?`).get(id),
        agent_code: agent.agent_code,
        agent_name: agent.full_name,
      };
    },
  };
}

module.exports = { createAgentsStore };
