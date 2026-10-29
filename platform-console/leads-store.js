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

    updateLead(id, data) {
      const existing = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(String(id));
      if (!existing) return null;

      const now = new Date().toISOString();
      const validStages = ['new', 'contacted', 'interested', 'converted', 'lost'];
      const nextStage = data.stage && validStages.includes(data.stage) ? data.stage : existing.stage;

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

    syncProvisionedTenant({ schoolName, tenantKey }) {
      if (!tenantKey) return;
      const cleanSchool = normalizeSchoolName(schoolName);
      const now = new Date().toISOString();

      // Find all agent_schools matching school_name
      const schools = db.prepare(`SELECT id, lead_id, school_name FROM agent_schools`).all();
      for (const s of schools) {
        const norm = normalizeSchoolName(s.school_name);
        if (norm === cleanSchool || (cleanSchool && (norm.includes(cleanSchool) || cleanSchool.includes(norm)))) {
          db.prepare(`UPDATE agent_schools SET tenant_key = ?, status = 'onboarded', updated_at = ? WHERE id = ?`).run(tenantKey, now, s.id);
          if (s.lead_id) {
            db.prepare(`UPDATE leads SET stage = 'converted', next_activity = 'Instance provisioned', updated_at = ? WHERE id = ?`).run(now, s.lead_id);
          }
        }
      }
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

