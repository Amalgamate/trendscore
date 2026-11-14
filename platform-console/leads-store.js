'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function normalizeSchoolName(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\b(high\s*school|secondary\s*school|primary\s*school|junior\s*secondary|academy|school|mixed|day|boarding)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

const APPLICATION_STATUSES = new Set([
  'submitted', 'under_review', 'approved', 'provisioning', 'ready', 'rejected', 'withdrawn',
]);
const APPLICATION_PACKAGE_IDS = new Set(['starter', 'standard', 'professional']);
const APPLICATION_OPTIONAL_MODULES = new Set(['transport']);

function parseStringArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function createLeadsStore(dataDir, options = {}) {
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

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      school TEXT NOT NULL,
      phone TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'interested', 'converted', 'lost')),
      priority TEXT NOT NULL DEFAULT '1',
      students INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      systems TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      next_activity TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'direct',
      agent_id TEXT DEFAULT NULL REFERENCES agents(id) ON DELETE SET NULL,
      agent_code TEXT NOT NULL DEFAULT '',
      agent_school_id TEXT DEFAULT NULL REFERENCES agent_schools(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage);
    CREATE INDEX IF NOT EXISTS leads_agent_idx ON leads(agent_id);
    CREATE INDEX IF NOT EXISTS leads_school_idx ON leads(school);
  `);

  const ensureLeadColumn = (name, definition) => {
    const columns = db.prepare('PRAGMA table_info(leads)').all();
    if (!columns.some(column => column.name === name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${definition}`);
  };
  for (const [name, definition] of [
    ['school_type', 'TEXT'], ['county', 'TEXT'], ['billing_email', 'TEXT'], ['billing_phone', 'TEXT'],
    ['principal_name', 'TEXT'], ['modules', 'TEXT'], ['own_sms_provider', 'INTEGER NOT NULL DEFAULT 0'],
    ['acceptance_method', 'TEXT'], ['acceptance_evidence_file', 'TEXT'], ['accepted_at', 'TEXT'],
    ['accepted_by', 'TEXT'], ['converted_at', 'TEXT'], ['converted_customer_id', 'TEXT'],
    ['converted_contract_id', 'TEXT'], ['converted_invoice_id', 'TEXT'],
    ['application_status', 'TEXT'], ['application_email', "TEXT NOT NULL DEFAULT ''"],
    ['school_address', "TEXT NOT NULL DEFAULT ''"], ['sub_county', "TEXT NOT NULL DEFAULT ''"],
    ['ward', "TEXT NOT NULL DEFAULT ''"], ['education_level', "TEXT NOT NULL DEFAULT ''"],
    ['accommodation_type', "TEXT NOT NULL DEFAULT ''"], ['transport_needed', 'INTEGER NOT NULL DEFAULT 0'],
    ['requested_package_id', "TEXT NOT NULL DEFAULT ''"], ['requested_module_slugs', "TEXT NOT NULL DEFAULT '[]'"],
    ['approved_package_id', "TEXT NOT NULL DEFAULT ''"], ['approved_module_slugs', "TEXT NOT NULL DEFAULT '[]'"],
    ['requested_agent_id', "TEXT NOT NULL DEFAULT ''"], ['potential_duplicate', 'INTEGER NOT NULL DEFAULT 0'],
    ['application_submitted_at', "TEXT NOT NULL DEFAULT ''"], ['reviewed_at', "TEXT NOT NULL DEFAULT ''"],
    ['reviewed_by', "TEXT NOT NULL DEFAULT ''"], ['review_notes', "TEXT NOT NULL DEFAULT ''"],
    ['approved_at', "TEXT NOT NULL DEFAULT ''"], ['approved_by', "TEXT NOT NULL DEFAULT ''"],
    ['rejected_at', "TEXT NOT NULL DEFAULT ''"], ['rejected_by', "TEXT NOT NULL DEFAULT ''"],
    ['rejection_reason', "TEXT NOT NULL DEFAULT ''"], ['provisioning_started_at', "TEXT NOT NULL DEFAULT ''"],
    ['provisioning_tenant_key', "TEXT NOT NULL DEFAULT ''"], ['provisioning_domain', "TEXT NOT NULL DEFAULT ''"],
    ['provisioned_school_id', "TEXT NOT NULL DEFAULT ''"], ['billing_customer_id', "TEXT NOT NULL DEFAULT ''"],
    ['billing_contract_id', "TEXT NOT NULL DEFAULT ''"], ['ready_at', "TEXT NOT NULL DEFAULT ''"],
    ['activation_token_encrypted', "TEXT NOT NULL DEFAULT ''"], ['activation_email_status', "TEXT NOT NULL DEFAULT ''"],
    ['activation_email_sent_at', "TEXT NOT NULL DEFAULT ''"], ['activation_email_error', "TEXT NOT NULL DEFAULT ''"],
    ['activation_email_attempts', 'INTEGER NOT NULL DEFAULT 0'], ['last_provision_error', "TEXT NOT NULL DEFAULT ''"],
  ]) ensureLeadColumn(name, definition);
  db.exec(`
    CREATE INDEX IF NOT EXISTS leads_application_status_idx ON leads(application_status, application_submitted_at);
    CREATE INDEX IF NOT EXISTS leads_application_email_idx ON leads(application_email);
    CREATE TABLE IF NOT EXISTS application_events (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      from_status TEXT NOT NULL DEFAULT '',
      to_status TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS application_events_application_idx ON application_events(application_id, created_at);
  `);

  function formatLeadRow(row) {
    if (!row) return null;
    let tags = [];
    try { tags = JSON.parse(row.tags || '[]'); } catch (_) { tags = []; }
    let systems = { assessment: 'None', fees: 'None', lms: 'None' };
    try { systems = JSON.parse(row.systems || '{}'); } catch (_) {}

    return {
      id: row.id,
      name: row.name,
      school: row.school,
      phone: row.phone,
      stage: row.stage,
      priority: row.priority,
      students: Number(row.students || 0),
      tags: Array.isArray(tags) ? tags : [],
      systems: systems && typeof systems === 'object' ? systems : { assessment: 'None', fees: 'None', lms: 'None' },
      notes: row.notes || '',
      nextActivity: row.next_activity || '',
      next_activity: row.next_activity || '',
      source: row.source || 'direct',
      agentId: row.agent_id || null,
      agent_id: row.agent_id || null,
      agentCode: row.agent_code || '',
      agent_code: row.agent_code || '',
      agentSchoolId: row.agent_school_id || null,
      agent_school_id: row.agent_school_id || null,
      agentName: row.agent_name || null,
      schoolType: row.school_type || '',
      applicationStatus: row.application_status || '',
      applicationEmail: row.application_email || '',
      schoolAddress: row.school_address || '',
      county: row.county || '',
      subCounty: row.sub_county || '',
      ward: row.ward || '',
      educationLevel: row.education_level || '',
      accommodationType: row.accommodation_type || '',
      transportNeeded: Boolean(row.transport_needed),
      requestedPackageId: row.requested_package_id || '',
      requestedModuleSlugs: parseStringArray(row.requested_module_slugs),
      approvedPackageId: row.approved_package_id || '',
      approvedModuleSlugs: parseStringArray(row.approved_module_slugs),
      requestedAgentId: row.requested_agent_id || '',
      potentialDuplicate: Boolean(row.potential_duplicate),
      applicationSubmittedAt: row.application_submitted_at || '',
      reviewedAt: row.reviewed_at || '',
      reviewedBy: row.reviewed_by || '',
      reviewNotes: row.review_notes || '',
      approvedAt: row.approved_at || '',
      approvedBy: row.approved_by || '',
      rejectedAt: row.rejected_at || '',
      rejectedBy: row.rejected_by || '',
      rejectionReason: row.rejection_reason || '',
      provisioningStartedAt: row.provisioning_started_at || '',
      provisioningTenantKey: row.provisioning_tenant_key || '',
      provisioningDomain: row.provisioning_domain || '',
      provisionedSchoolId: row.provisioned_school_id || '',
      billingCustomerId: row.billing_customer_id || '',
      billingContractId: row.billing_contract_id || '',
      readyAt: row.ready_at || '',
      activationEmailStatus: row.activation_email_status || '',
      activationEmailSentAt: row.activation_email_sent_at || '',
      activationEmailError: row.activation_email_error || '',
      activationEmailAttempts: Number(row.activation_email_attempts || 0),
      lastProvisionError: row.last_provision_error || '',
      billingEmail: row.billing_email || '',
      billingPhone: row.billing_phone || '',
      acceptanceMethod: row.acceptance_method || '',
      acceptanceEvidence: row.acceptance_evidence_file || '',
      acceptedAt: row.accepted_at || '',
      acceptedBy: row.accepted_by || '',
      convertedAt: row.converted_at || '',
      convertedCustomerId: row.converted_customer_id || '',
      convertedContractId: row.converted_contract_id || '',
      convertedInvoiceId: row.converted_invoice_id || '',
      created: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ── One-time migration from leads.store.json ────────────────────────────────
  function migrateFromJsonFile() {
    const jsonPath = path.join(dataDir, 'leads.store.json');
    if (!fs.existsSync(jsonPath)) return;

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM leads`).get();
    if (countRow && countRow.total > 0) return; // Already populated

    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      const leads = Array.isArray(parsed?.leads) ? parsed.leads : [];
      if (leads.length === 0) return;

      const insertStmt = db.prepare(`
        INSERT INTO leads (
          id, name, school, phone, stage, priority, students, tags, systems, notes,
          next_activity, source, agent_id, agent_code, agent_school_id, created_at, updated_at
        ) VALUES (
          @id, @name, @school, @phone, @stage, @priority, @students, @tags, @systems, @notes,
          @next_activity, @source, @agent_id, @agent_code, @agent_school_id, @created_at, @updated_at
        )
      `);

      for (const lead of leads) {
        const leadId = String(lead.id || `L${Date.now()}`);
        const tags = Array.isArray(lead.tags) ? lead.tags : [];
        let agentCode = '';
        const codeTag = tags.find(t => /^AGT-\d+$/i.test(String(t).trim()));
        if (codeTag) agentCode = codeTag.trim().toUpperCase();

        let agentId = null;
        if (agentCode) {
          const agentRow = db.prepare(`SELECT id FROM agents WHERE agent_code = ? LIMIT 1`).get(agentCode);
          if (agentRow) agentId = agentRow.id;
        }

        // Link with existing agent_schools if matched
        let agentSchoolId = null;
        if (leadId) {
          const matchSchool = db.prepare(`SELECT id FROM agent_schools WHERE lead_id = ? LIMIT 1`).get(leadId);
          if (matchSchool) agentSchoolId = matchSchool.id;
        }
        if (!agentSchoolId && agentId) {
          const matchByName = db.prepare(`SELECT id FROM agent_schools WHERE agent_id = ? AND school_name = ? LIMIT 1`).get(agentId, lead.school || '');
          if (matchByName) {
            agentSchoolId = matchByName.id;
            db.prepare(`UPDATE agent_schools SET lead_id = ? WHERE id = ?`).run(leadId, agentSchoolId);
          }
        }

        const validStages = ['new', 'contacted', 'interested', 'converted', 'lost'];
        const stage = validStages.includes(lead.stage) ? lead.stage : 'new';
        const now = new Date().toISOString();
        const createdDate = lead.created ? `${lead.created}T00:00:00.000Z` : now;

        insertStmt.run({
          id: leadId,
          name: String(lead.name || 'Contact Person').trim(),
          school: String(lead.school || 'Prospective School').trim(),
          phone: String(lead.phone || '').trim(),
          stage,
          priority: String(lead.priority || '1'),
          students: Number(lead.students || 0),
          tags: JSON.stringify(tags),
          systems: JSON.stringify(lead.systems || {}),
          notes: String(lead.notes || '').trim(),
          next_activity: String(lead.nextActivity || lead.next_activity || 'New lead added').trim(),
          source: agentCode ? 'field_agent' : 'direct',
          agent_id: agentId,
          agent_code: agentCode,
          agent_school_id: agentSchoolId,
          created_at: createdDate,
          updated_at: now,
        });
      }
      console.log(`[Leads Store] Successfully migrated ${leads.length} leads from JSON store to SQLite.`);
    } catch (err) {
      console.warn('[Leads Store] Failed to migrate leads from JSON:', err.message || err);
    }
  }

  // ── Backfill agent_schools that have no lead ────────────────────────────────
  function backfillMissingAgentLeads() {
    try {
      const schoolsWithoutLeads = db.prepare(`
        SELECT s.*, a.agent_code, a.full_name AS agent_name, a.phone AS agent_phone, a.county AS agent_county
        FROM agent_schools s
        JOIN agents a ON a.id = s.agent_id
        WHERE s.lead_id = '' OR s.lead_id IS NULL OR NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = s.lead_id)
      `).all();

      if (schoolsWithoutLeads.length === 0) return;

      const now = new Date().toISOString();
      const insertLeadStmt = db.prepare(`
        INSERT INTO leads (
          id, name, school, phone, stage, priority, students, tags, systems, notes,
          next_activity, source, agent_id, agent_code, agent_school_id, created_at, updated_at
        ) VALUES (
          @id, @name, @school, @phone, @stage, @priority, @students, @tags, @systems, @notes,
          @next_activity, @source, @agent_id, @agent_code, @agent_school_id, @created_at, @updated_at
        )
      `);
      const updateSchoolStmt = db.prepare(`UPDATE agent_schools SET lead_id = ? WHERE id = ?`);

      let backfilledCount = 0;
      for (const row of schoolsWithoutLeads) {
        const leadId = `L${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const stage = row.status === 'onboarded' || row.status === 'active'
          ? 'converted'
          : row.status === 'churned'
          ? 'lost'
          : 'new';

        insertLeadStmt.run({
          id: leadId,
          name: row.contact_person || 'Principal / Administrator',
          school: row.school_name,
          phone: row.contact_phone || row.agent_phone,
          stage,
          priority: '1',
          students: 0,
          tags: JSON.stringify(['field_agent', row.agent_code, row.agent_county].filter(Boolean)),
          systems: JSON.stringify({ assessment: 'None', fees: 'None', lms: 'None' }),
          notes: `Attributed to ${row.agent_name} (${row.agent_code}). ${row.notes || ''}`.trim(),
          next_activity: stage === 'converted' ? 'Onboarding complete' : 'Introductory follow up',
          source: 'field_agent',
          agent_id: row.agent_id,
          agent_code: row.agent_code,
          agent_school_id: row.id,
          created_at: row.created_at || now,
          updated_at: now,
        });

        updateSchoolStmt.run(leadId, row.id);
        backfilledCount++;
      }

      console.log(`[Leads Store] Backfilled ${backfilledCount} missing CRM leads for agent schools.`);
    } catch (err) {
      console.warn('[Leads Store] Backfill check notice:', err.message || err);
    }
  }

  migrateFromJsonFile();
  backfillMissingAgentLeads();

  const store = {
    listPublicAgents() {
      return db.prepare(`
        SELECT id, full_name AS name, county, base_location AS serviceArea
        FROM agents WHERE status='active' ORDER BY full_name COLLATE NOCASE
      `).all();
    },

    submitApplication(data) {
      const schoolType = String(data.schoolType || '').trim().toUpperCase();
      const primary = schoolType.endsWith('PRIMARY');
      const packageId = String(data.packageId || '').trim().toLowerCase();
      if (!['PUBLIC_PRIMARY', 'PRIVATE_PRIMARY', 'PUBLIC_SECONDARY', 'PRIVATE_SECONDARY'].includes(schoolType)) {
        throw new Error('Choose a valid school type');
      }
      if (primary && !APPLICATION_PACKAGE_IDS.has(packageId)) {
        throw new Error('Primary applications require Starter, Standard, or Professional');
      }
      if (!primary && packageId) throw new Error('Secondary applications cannot select a Primary package');
      if (!['DAY', 'BOARDING', 'DAY_AND_BOARDING'].includes(data.accommodationType)) {
        throw new Error('Choose a valid accommodation profile');
      }
      const requestedAgentId = String(data.agentId || '').trim();
      const requestedAgent = requestedAgentId
        ? db.prepare("SELECT id, agent_code FROM agents WHERE id=? AND status='active'").get(requestedAgentId)
        : null;
      if (requestedAgentId && !requestedAgent) throw new Error('Choose an active agent or leave the application unassigned');

      const now = new Date().toISOString();
      const id = `A${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const schoolName = String(data.school || '').trim();
      const phone = String(data.phone || '').trim();
      const comparableSchool = normalizeSchoolName(schoolName);
      const comparablePhone = normalizePhone(phone);
      const possibleDuplicate = db.prepare('SELECT school, phone FROM leads').all().some(row =>
        (comparableSchool && normalizeSchoolName(row.school) === comparableSchool)
        || (comparablePhone && normalizePhone(row.phone) === comparablePhone));

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`
          INSERT INTO leads (
            id,name,school,phone,stage,priority,students,tags,systems,notes,next_activity,source,
            agent_id,agent_code,created_at,updated_at,school_type,county,billing_email,billing_phone,
            principal_name,application_status,application_email,school_address,sub_county,ward,education_level,
            accommodation_type,transport_needed,requested_package_id,requested_module_slugs,requested_agent_id,
            potential_duplicate,application_submitted_at
          ) VALUES (
            @id,@name,@school,@phone,'new','1',0,'[\"application\"]','{}','',
            'Review school application','public_application',@agentId,@agentCode,@now,@now,@schoolType,
            @county,@email,@phone,@name,'submitted',@email,@address,@subCounty,@ward,@educationLevel,
            @accommodationType,@transportNeeded,@packageId,'[]',@requestedAgentId,@potentialDuplicate,@now
          )
        `).run({
          id, name: String(data.name).trim(), school: schoolName, phone, now, agentId: requestedAgent?.id || null,
          agentCode: requestedAgent?.agent_code || '', schoolType, county: String(data.county || '').trim(),
          email: String(data.email).trim().toLowerCase(), address: String(data.address || '').trim(),
          subCounty: String(data.subCounty || '').trim(), ward: String(data.ward || '').trim(),
          educationLevel: schoolType.endsWith('PRIMARY') ? 'PRIMARY' : 'SECONDARY',
          accommodationType: data.accommodationType, transportNeeded: data.transportNeeded ? 1 : 0,
          packageId, requestedAgentId, potentialDuplicate: possibleDuplicate ? 1 : 0,
        });
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,to_status,actor,details_json,created_at)
          VALUES (?,?, 'submitted','submitted','applicant',?,?)`)
          .run(crypto.randomUUID(), id, JSON.stringify({ source: 'public' }), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return { application: this.getApplication(id), possibleDuplicate };
    },

    listApplications({ status = '' } = {}) {
      let sql = `SELECT l.*, a.full_name AS agent_name FROM leads l
        LEFT JOIN agents a ON a.id=l.agent_id WHERE l.application_status IS NOT NULL`;
      const params = {};
      if (status && APPLICATION_STATUSES.has(status)) {
        sql += ' AND l.application_status=@status';
        params.status = status;
      }
      sql += ' ORDER BY CASE l.application_status WHEN \'submitted\' THEN 0 WHEN \'under_review\' THEN 1 WHEN \'approved\' THEN 2 WHEN \'provisioning\' THEN 3 ELSE 4 END, l.application_submitted_at';
      return db.prepare(sql).all(params).map(formatLeadRow);
    },

    getApplication(id) {
      const row = db.prepare(`SELECT l.*, a.full_name AS agent_name FROM leads l
        LEFT JOIN agents a ON a.id=l.agent_id
        WHERE l.id=? AND l.application_status IS NOT NULL`).get(String(id));
      return formatLeadRow(row);
    },

    listApplicationEvents(id) {
      return db.prepare(`SELECT id,event_type AS eventType,from_status AS fromStatus,to_status AS toStatus,
        actor,details_json AS detailsJson,created_at AS createdAt
        FROM application_events WHERE application_id=? ORDER BY created_at,rowid`).all(String(id))
        .map(event => ({ ...event, details: JSON.parse(event.detailsJson || '{}') }));
    },

    reviewApplication(id, data, actor) {
      const app = db.prepare('SELECT * FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
      if (!app) throw new Error('Application not found');
      if (!['submitted', 'under_review'].includes(app.application_status)) throw new Error('Application is not open for review');

      const agentId = String(data.agentId || '').trim();
      if (agentId && !db.prepare("SELECT id FROM agents WHERE id=? AND status='active'").get(agentId)) {
        throw new Error('Choose an active agent or leave the application unassigned');
      }
      const approvedPackageId = String(data.packageId ?? app.requested_package_id ?? '').trim().toLowerCase();
      const primary = String(app.school_type || '').endsWith('PRIMARY');
      if (primary && !APPLICATION_PACKAGE_IDS.has(approvedPackageId)) {
        throw new Error('Primary applications require Starter, Standard, or Professional');
      }
      if (!primary && approvedPackageId) throw new Error('Secondary applications cannot use a Primary package');
      const modules = Array.isArray(data.moduleSlugs) ? [...new Set(data.moduleSlugs.map(String))] : [];
      if (modules.some(slug => !APPLICATION_OPTIONAL_MODULES.has(slug))) throw new Error('Only Transport can be confirmed as an optional module');
      if (modules.length && !app.transport_needed) throw new Error('Transport can only be confirmed when the applicant requested transport');

      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const fromStatus = app.application_status;
        const update = db.prepare(`UPDATE leads SET application_status='under_review',agent_id=?,agent_code=?,
          approved_package_id=?,approved_module_slugs=?,reviewed_at=?,reviewed_by=?,review_notes=?,updated_at=?
          WHERE id=? AND application_status IN ('submitted','under_review')`)
          .run(agentId || null,
            agentId ? db.prepare('SELECT agent_code FROM agents WHERE id=?').get(agentId).agent_code : '',
            approvedPackageId, JSON.stringify(modules), now, String(actor || ''), String(data.reviewNotes || '').trim(), now, String(id));
        if (!update.changes) throw new Error('Application changed during review; reload and try again');
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,details_json,created_at)
          VALUES (?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), String(id), 'review_updated',
            fromStatus, 'under_review', String(actor || ''), JSON.stringify({ packageId: approvedPackageId, moduleSlugs: modules, agentId }), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getApplication(id);
    },

    approveApplication(id, actor) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const app = db.prepare('SELECT * FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
        if (!app) throw new Error('Application not found');
        if (app.application_status === 'approved') {
          db.exec('COMMIT');
          return this.getApplication(id);
        }
        if (app.application_status !== 'under_review') throw new Error('Review the application before approval');
        const update = db.prepare(`UPDATE leads SET application_status='approved',approved_at=?,approved_by=?,updated_at=?
          WHERE id=? AND application_status='under_review'`).run(now, String(actor || ''), now, String(id));
        if (!update.changes) throw new Error('Application changed before approval');
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,created_at)
          VALUES (?,?, 'approved','under_review','approved',?,?)`)
          .run(crypto.randomUUID(), String(id), String(actor || ''), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getApplication(id);
    },

    rejectApplication(id, reason, actor) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const app = db.prepare('SELECT application_status FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
        if (!app) throw new Error('Application not found');
        if (!['submitted', 'under_review'].includes(app.application_status)) throw new Error('Only an open application can be rejected');
        db.prepare(`UPDATE leads SET application_status='rejected',rejected_at=?,rejected_by=?,rejection_reason=?,updated_at=?
          WHERE id=? AND application_status IN ('submitted','under_review')`)
          .run(now, String(actor || ''), String(reason || '').trim(), now, String(id));
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,details_json,created_at)
          VALUES (?,?, 'rejected',?,'rejected',?,?,?)`)
          .run(crypto.randomUUID(), String(id), app.application_status, String(actor || ''), JSON.stringify({ reason: String(reason || '').trim() }), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getApplication(id);
    },

    startApplicationProvisioning(id, actor) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const app = db.prepare('SELECT * FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
        if (!app) throw new Error('Application not found');
        if (app.application_status === 'provisioning') {
          db.exec('COMMIT');
          return { application: this.getApplication(id), alreadyProvisioning: true };
        }
        if (app.application_status !== 'approved') throw new Error('Only an approved application can be provisioned');
        db.prepare(`UPDATE leads SET application_status='provisioning',provisioning_started_at=?,last_provision_error='',updated_at=?
          WHERE id=? AND application_status='approved'`).run(now, now, String(id));
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,created_at)
          VALUES (?,?, 'provisioning_started','approved','provisioning',?,?)`)
          .run(crypto.randomUUID(), String(id), String(actor || ''), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return { application: this.getApplication(id), alreadyProvisioning: false };
    },

    failApplicationProvisioning(id, message, actor) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const app = db.prepare('SELECT application_status FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
        if (!app || app.application_status !== 'provisioning') throw new Error('Application is not provisioning');
        db.prepare(`UPDATE leads SET application_status='approved',last_provision_error=?,updated_at=? WHERE id=? AND application_status='provisioning'`)
          .run(String(message || 'Provisioning failed').slice(0, 1000), now, String(id));
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,details_json,created_at)
          VALUES (?,?, 'provisioning_failed','provisioning','approved',?,?,?)`)
          .run(crypto.randomUUID(), String(id), String(actor || ''), JSON.stringify({ message: String(message || '').slice(0, 1000) }), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getApplication(id);
    },

    markApplicationReady(id, { tenantKey, domain, schoolId, customerId, contractId, encryptedActivationToken, readyAt }, actor) {
      const now = new Date().toISOString();
      const credentialsReadyAt = String(readyAt || now);
      db.exec('BEGIN IMMEDIATE');
      try {
        const app = db.prepare('SELECT application_status FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
        if (!app) throw new Error('Application not found');
        if (app.application_status === 'ready') {
          db.exec('COMMIT');
          return this.getApplication(id);
        }
        if (app.application_status !== 'provisioning') throw new Error('Application is not provisioning');
        db.prepare(`UPDATE leads SET application_status='ready',provisioning_tenant_key=?,provisioning_domain=?,
          provisioned_school_id=?,billing_customer_id=?,billing_contract_id=?,ready_at=?,
          activation_token_encrypted=?,activation_email_status='pending',activation_email_error='',updated_at=?
          WHERE id=? AND application_status='provisioning'`)
          .run(String(tenantKey || ''), String(domain || ''), String(schoolId || ''), String(customerId || ''),
            String(contractId || ''), credentialsReadyAt, String(encryptedActivationToken || ''), now, String(id));
        db.prepare(`INSERT INTO application_events
          (id,application_id,event_type,from_status,to_status,actor,details_json,created_at)
          VALUES (?,?, 'ready','provisioning','ready',?,?,?)`)
          .run(crypto.randomUUID(), String(id), String(actor || ''), JSON.stringify({ tenantKey, domain, schoolId, customerId, contractId, readyAt: credentialsReadyAt }), now);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getApplication(id);
    },

    getApplicationSecret(id) {
      return db.prepare('SELECT activation_token_encrypted FROM leads WHERE id=? AND application_status=\'ready\'')
        .get(String(id))?.activation_token_encrypted || '';
    },

    recordActivationEmail(id, { status, error = '' }, actor) {
      const app = db.prepare('SELECT application_status,activation_email_attempts FROM leads WHERE id=? AND application_status IS NOT NULL').get(String(id));
      if (!app) throw new Error('Application not found');
      if (app.application_status !== 'ready') throw new Error('Activation is available only when an application is ready');
      const now = new Date().toISOString();
      db.prepare(`UPDATE leads SET activation_email_status=?,activation_email_sent_at=?,activation_email_error=?,
        activation_email_attempts=activation_email_attempts+1,updated_at=? WHERE id=?`)
        .run(status, status === 'sent' ? now : '', String(error).slice(0, 1000), now, String(id));
      db.prepare(`INSERT INTO application_events
        (id,application_id,event_type,from_status,to_status,actor,details_json,created_at)
        VALUES (?,?, 'activation_email', 'ready','ready',?,?,?)`)
        .run(crypto.randomUUID(), String(id), String(actor || ''), JSON.stringify({ status, error: String(error).slice(0, 1000) }), now);
      return this.getApplication(id);
    },

    normalizeSchoolName,
    normalizePhone,

    checkDuplicate({ schoolName, phone = '', excludeAgentId = null } = {}) {
      const cleanSchool = normalizeSchoolName(schoolName);
      const cleanPhone = normalizePhone(phone);
      if (!cleanSchool && !cleanPhone) return null;

      // Check active agent_schools
      const activeSchools = db.prepare(`
        SELECT s.id, s.school_name, s.contact_phone, s.agent_id, s.status, a.agent_code, a.full_name AS agent_name
        FROM agent_schools s
        JOIN agents a ON a.id = s.agent_id
        WHERE s.status IN ('pitching', 'onboarded', 'active')
      `).all();

      for (const s of activeSchools) {
        if (excludeAgentId && s.agent_id === excludeAgentId) continue;
        const normExisting = normalizeSchoolName(s.school_name);
        const normExistingPhone = normalizePhone(s.contact_phone);

        const schoolNameMatch = cleanSchool && (cleanSchool === normExisting || cleanSchool.includes(normExisting) || normExisting.includes(cleanSchool));
        const phoneMatch = cleanPhone && normExistingPhone && cleanPhone === normExistingPhone;

        if (schoolNameMatch || phoneMatch) {
          return {
            reason: phoneMatch && schoolNameMatch
              ? 'matching school name and contact phone'
              : schoolNameMatch
              ? 'matching school name'
              : 'matching phone number',
            claimedByAgentName: s.agent_name,
            claimedByAgentCode: s.agent_code,
            schoolName: s.school_name,
          };
        }
      }
      return null;
    },

    registerSchoolLead({
      agentId,
      schoolName,
      contactPerson = '',
      contactPhone = '',
      estimatedStudents = 0,
      county = '',
      notes = '',
      source = 'field_agent',
    }) {
      const cleanSchoolName = String(schoolName || '').trim();
      if (!cleanSchoolName) throw new Error('School name is required');
      if (!agentId) throw new Error('Agent ID is required');

      const agent = db.prepare(`SELECT id, agent_code, full_name, phone, county FROM agents WHERE id = ?`).get(agentId);
      if (!agent) throw new Error('Agent not found');

      // Check duplicate
      const duplicate = store.checkDuplicate({ schoolName: cleanSchoolName, phone: contactPhone, excludeAgentId: agentId });
      if (duplicate) {
        throw new Error(`School "${cleanSchoolName}" is already claimed by ${duplicate.claimedByAgentName} (${duplicate.claimedByAgentCode}) based on ${duplicate.reason}.`);
      }

      const now = new Date().toISOString();
      const schoolId = 'ags_' + crypto.randomBytes(8).toString('hex');
      const leadId = `L${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const finalCounty = county || agent.county || '';
      const finalPhone = contactPhone || agent.phone || '';
      const finalContact = contactPerson || 'Principal / Administrator';

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`
          INSERT INTO agent_schools (
            id, agent_id, school_name, tenant_key, lead_id,
            contact_person, contact_phone, status, notes,
            created_at, updated_at
          ) VALUES (
            @id, @agent_id, @school_name, '', @lead_id,
            @contact_person, @contact_phone, 'pitching', @notes,
            @created_at, @updated_at
          )
        `).run({
          id: schoolId,
          agent_id: agentId,
          school_name: cleanSchoolName,
          lead_id: leadId,
          contact_person: finalContact,
          contact_phone: finalPhone,
          notes: notes ? `${notes} · County: ${finalCounty}` : (finalCounty ? `County: ${finalCounty}` : ''),
          created_at: now,
          updated_at: now,
        });

        db.prepare(`
          INSERT INTO leads (
            id, name, school, phone, stage, priority, students,
            tags, systems, notes, next_activity, source,
            agent_id, agent_code, agent_school_id, created_at, updated_at
          ) VALUES (
            @id, @name, @school, @phone, 'new', '1', @students,
            @tags, @systems, @notes, @next_activity, @source,
            @agent_id, @agent_code, @agent_school_id, @created_at, @updated_at
          )
        `).run({
          id: leadId,
          name: finalContact,
          school: cleanSchoolName,
          phone: finalPhone,
          students: Number(estimatedStudents) || 0,
          tags: JSON.stringify(['field_agent', agent.agent_code, finalCounty].filter(Boolean)),
          systems: JSON.stringify({ assessment: 'None', fees: 'None', lms: 'None' }),
          notes: `Registered via Field Agent ${source === 'admin' ? 'Assignment' : 'App'} by ${agent.full_name} (${agent.agent_code}). ${notes}`.trim(),
          next_activity: 'Introductory demo / pitch presentation',
          source: source || 'field_agent',
          agent_id: agent.id,
          agent_code: agent.agent_code,
          agent_school_id: schoolId,
          created_at: now,
          updated_at: now,
        });

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      const school = db.prepare(`SELECT * FROM agent_schools WHERE id = ?`).get(schoolId);
      const lead = store.getLead(leadId);
      return { school, lead, agent };
    },

    listLeads({ search = '', stage = '', agentId = '' } = {}) {
      let query = `
        SELECT l.*, a.full_name AS agent_name
        FROM leads l
        LEFT JOIN agents a ON a.id = l.agent_id
        WHERE 1=1
      `;
      const params = {};
      if (stage && stage !== 'all') {
        query += ` AND l.stage = @stage`;
        params.stage = stage;
      }
      if (agentId) {
        query += ` AND l.agent_id = @agentId`;
        params.agentId = agentId;
      }
      if (search) {
        query += ` AND (
          l.name LIKE @likeSearch OR
          l.school LIKE @likeSearch OR
          l.phone LIKE @likeSearch OR
          l.agent_code LIKE @likeSearch OR
          l.notes LIKE @likeSearch
        )`;
        params.likeSearch = `%${search}%`;
      }
      query += ` ORDER BY l.created_at DESC`;
      const rows = db.prepare(query).all(params);
      return rows.map(formatLeadRow);
    },

    getLead(id) {
      if (!id) return null;
      const row = db.prepare(`
        SELECT l.*, a.full_name AS agent_name
        FROM leads l
        LEFT JOIN agents a ON a.id = l.agent_id
        WHERE l.id = ?
        LIMIT 1
      `).get(String(id));
      return formatLeadRow(row);
    },

    recordLeadConversion(id, conversion) {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id, agent_school_id FROM leads WHERE id=?').get(String(id));
      if (!existing) return null;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`UPDATE leads SET stage='converted', accepted_at=?, accepted_by=?, acceptance_method=?,
          acceptance_evidence_file=?, converted_at=?, converted_customer_id=?, converted_contract_id=?,
          converted_invoice_id=?, next_activity='Onboarding invoice ready', updated_at=? WHERE id=?`)
          .run(now, conversion.acceptedBy, conversion.acceptanceMethod, conversion.acceptanceEvidence,
            now, conversion.customerId, conversion.contractId, conversion.invoiceId, now, String(id));
        if (existing.agent_school_id) {
          db.prepare(`UPDATE agent_schools SET status='onboarded', updated_at=? WHERE id=?`).run(now, existing.agent_school_id);
        } else {
          db.prepare(`UPDATE agent_schools SET status='onboarded', updated_at=? WHERE lead_id=?`).run(now, String(id));
        }
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return this.getLead(id);
    },

    createLead(data) {
      const now = new Date().toISOString();
      const id = data.id || `L${Date.now()}`;
      const validStages = ['new', 'contacted', 'interested', 'converted', 'lost'];
      const stage = validStages.includes(data.stage) ? data.stage : 'new';

      let tags = data.tags || [];
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (_) { tags = [tags]; }
      }
      let systems = data.systems || { assessment: 'None', fees: 'None', lms: 'None' };
      if (typeof systems === 'string') {
        try { systems = JSON.parse(systems); } catch (_) { systems = {}; }
      }

      db.prepare(`
        INSERT INTO leads (
          id, name, school, phone, stage, priority, students, tags, systems, notes,
          next_activity, source, agent_id, agent_code, agent_school_id, created_at, updated_at
        ) VALUES (
          @id, @name, @school, @phone, @stage, @priority, @students, @tags, @systems, @notes,
          @next_activity, @source, @agent_id, @agent_code, @agent_school_id, @created_at, @updated_at
        )
      `).run({
        id,
        name: String(data.name || 'Contact Person').trim(),
        school: String(data.school || '').trim(),
        phone: String(data.phone || '').trim(),
        stage,
        priority: String(data.priority || '1'),
        students: Number(data.students || 0),
        tags: JSON.stringify(tags),
        systems: JSON.stringify(systems),
        notes: String(data.notes || '').trim(),
        next_activity: String(data.nextActivity || data.next_activity || 'New lead added').trim(),
        source: data.source || 'direct',
        agent_id: data.agentId || data.agent_id || null,
        agent_code: data.agentCode || data.agent_code || '',
        agent_school_id: data.agentSchoolId || data.agent_school_id || null,
        created_at: data.created_at || now,
        updated_at: now,
      });

      return store.getLead(id);
    },

    assignLeadToAgent(leadId, agentId, actor = '') {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(String(leadId));
        if (!lead) throw new Error('Lead not found');
        const agent = db.prepare(`SELECT id,agent_code,full_name,county,status FROM agents WHERE id=?`).get(String(agentId));
        if (!agent) throw new Error('Agent not found');
        if (agent.status !== 'active') throw new Error('Assign leads only to active agents');
        if (['converted', 'lost'].includes(lead.stage)) throw new Error('Converted or lost leads cannot be assigned to an agent');

        if (lead.agent_school_id) {
          const existingSchool = db.prepare('SELECT * FROM agent_schools WHERE id=?').get(lead.agent_school_id);
          if (existingSchool?.agent_id === agent.id) {
            db.exec('COMMIT');
            return { lead: store.getLead(leadId), school: existingSchool, agent, alreadyAssigned: true };
          }
          throw new Error('This lead is already linked to another agent school');
        }
        if (lead.agent_id && lead.agent_id !== agent.id) throw new Error('This lead is already attributed to another agent');

        const duplicate = store.checkDuplicate({ schoolName: lead.school, phone: lead.phone, excludeAgentId: agent.id });
        if (duplicate) throw new Error(`School is already claimed by ${duplicate.claimedByAgentName} (${duplicate.claimedByAgentCode}) based on ${duplicate.reason}.`);

        const schoolId = 'ags_' + crypto.randomBytes(8).toString('hex');
        const finalStatus = lead.stage === 'lost' ? 'churned' : 'pitching';
        db.prepare(`INSERT INTO agent_schools
          (id,agent_id,school_name,tenant_key,lead_id,contact_person,contact_phone,status,notes,created_at,updated_at)
          VALUES (?,?,?, '', ?,?,?,?, ?,?,?)`)
          .run(schoolId, agent.id, String(lead.school || '').trim(), String(leadId),
            String(lead.name || 'Principal / Administrator').trim(), String(lead.phone || '').trim(),
            finalStatus, `Assigned from CRM by ${actor || 'admin'}`, now, now);

        let tags = [];
        try { tags = JSON.parse(lead.tags || '[]'); } catch {}
        if (!Array.isArray(tags)) tags = [];
        if (agent.agent_code && !tags.includes(agent.agent_code)) tags.push(agent.agent_code);
        if (!tags.includes('field_agent')) tags.push('field_agent');
        db.prepare(`UPDATE leads SET agent_id=?,agent_code=?,agent_school_id=?,tags=?,updated_at=? WHERE id=?`)
          .run(agent.id, agent.agent_code, schoolId, JSON.stringify(tags), now, String(leadId));
        db.exec('COMMIT');
        return { lead: store.getLead(leadId), school: db.prepare('SELECT * FROM agent_schools WHERE id=?').get(schoolId), agent };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    updateLead(id, data) {
      const existing = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(String(id));
      if (!existing) return null;

      const now = new Date().toISOString();
      const validStages = ['new', 'contacted', 'interested', 'converted', 'lost'];
      const nextStage = data.stage && validStages.includes(data.stage) ? data.stage : existing.stage;
      if (nextStage === 'converted' && existing.stage !== 'converted') {
        throw new Error('Convert the lead through the acceptance workflow so customer, contract, and invoice records are created together.');
      }

      // Two-way sync: Sync stage changes to agent_schools
      if (nextStage !== existing.stage) {
        let newSchoolStatus = null;
        if (nextStage === 'converted') newSchoolStatus = 'onboarded';
        else if (nextStage === 'lost') newSchoolStatus = 'churned';
        else if (['new', 'contacted', 'interested'].includes(nextStage)) newSchoolStatus = 'pitching';

        if (newSchoolStatus) {
          if (existing.agent_school_id) {
            db.prepare(`UPDATE agent_schools SET status = ?, updated_at = ? WHERE id = ?`).run(newSchoolStatus, now, existing.agent_school_id);
          } else {
            db.prepare(`UPDATE agent_schools SET status = ?, updated_at = ? WHERE lead_id = ?`).run(newSchoolStatus, now, id);
          }
        }
      }

      let tags = data.tags !== undefined ? data.tags : existing.tags;
      if (Array.isArray(tags)) tags = JSON.stringify(tags);
      else if (typeof tags !== 'string') tags = '[]';

      let systems = data.systems !== undefined ? data.systems : existing.systems;
      if (typeof systems === 'object') systems = JSON.stringify(systems);
      else if (typeof systems !== 'string') systems = '{}';

      // Keep attribution fields IMMUTABLE: agent_id, agent_code, agent_school_id, source
      db.prepare(`
        UPDATE leads SET
          name = @name,
          school = @school,
          phone = @phone,
          stage = @stage,
          priority = @priority,
          students = @students,
          tags = @tags,
          systems = @systems,
          notes = @notes,
          next_activity = @next_activity,
          updated_at = @updated_at
        WHERE id = @id
      `).run({
        id: String(id),
        name: data.name !== undefined ? String(data.name).trim() : existing.name,
        school: data.school !== undefined ? String(data.school).trim() : existing.school,
        phone: data.phone !== undefined ? String(data.phone).trim() : existing.phone,
        stage: nextStage,
        priority: data.priority !== undefined ? String(data.priority) : existing.priority,
        students: data.students !== undefined ? Number(data.students || 0) : existing.students,
        tags,
        systems,
        notes: data.notes !== undefined ? String(data.notes).trim() : existing.notes,
        next_activity: data.nextActivity !== undefined
          ? String(data.nextActivity).trim()
          : data.next_activity !== undefined
          ? String(data.next_activity).trim()
          : existing.next_activity,
        updated_at: now,
      });

      return store.getLead(id);
    },

    deleteLead(id) {
      const existing = db.prepare(`SELECT id, agent_school_id FROM leads WHERE id = ?`).get(String(id));
      if (!existing) return false;

      // Clear lead_id link in agent_schools to prevent dangling reference
      db.prepare(`UPDATE agent_schools SET lead_id = '' WHERE lead_id = ? OR id = ?`).run(String(id), existing.agent_school_id || '');
      db.prepare(`DELETE FROM leads WHERE id = ?`).run(String(id));
      return true;
    },

    syncProvisionedTenant({ leadId, tenantKey }) {
      if (!tenantKey || !leadId) return false;
      const now = new Date().toISOString();
      const lead = db.prepare(`SELECT id, agent_id, agent_school_id, name, school, phone FROM leads WHERE id=?`).get(String(leadId));
      if (!lead) return false;
      let schoolId = lead.agent_school_id;
      if (schoolId) {
        db.prepare(`UPDATE agent_schools SET tenant_key=?,status='onboarded',updated_at=? WHERE id=?`)
          .run(tenantKey, now, schoolId);
      } else {
        const linkedSchool = db.prepare(`SELECT id FROM agent_schools WHERE lead_id=? LIMIT 1`).get(String(leadId));
        if (linkedSchool) {
          schoolId = linkedSchool.id;
          db.prepare(`UPDATE agent_schools SET tenant_key=?,status='onboarded',updated_at=? WHERE id=?`)
            .run(tenantKey, now, schoolId);
        } else if (lead.agent_id) {
          schoolId = `ags_${crypto.randomBytes(8).toString('hex')}`;
          db.prepare(`INSERT INTO agent_schools (
            id,agent_id,school_name,tenant_key,lead_id,contact_person,contact_phone,status,notes,created_at,updated_at
          ) VALUES (?,?,?,?,?,?,?,'onboarded','Provisioned from school application',?,?)`)
            .run(schoolId, lead.agent_id, lead.school, tenantKey, String(leadId), lead.name, lead.phone, now, now);
        }
      }
      db.prepare(`UPDATE leads SET agent_school_id=COALESCE(agent_school_id,?),next_activity='Instance provisioned',updated_at=? WHERE id=?`)
        .run(schoolId, now, String(leadId));
      return true;
    },

    close() {
      try { db.close(); } catch (_) {}
    },
  };

  return store;
}

module.exports = {
  createLeadsStore,
  normalizeSchoolName,
  normalizePhone,
};
