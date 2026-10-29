'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAgentsStore } = require('../agents-store');
const { createLeadsStore, normalizeSchoolName, normalizePhone } = require('../leads-store');

test('Leads Store & Two-Way Attribution Pipeline', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-leads-test-'));
  const agentsStore = createAgentsStore(tmpDir);
  const leadsStore = createLeadsStore(tmpDir);

  // Setup an agent
  const agent = agentsStore.createAgent({
    full_name: 'David Kiprono',
    phone: '0712345678',
    email: 'david@field.test',
    county: 'Nakuru',
    commission_type: 'percentage',
    commission_rate: 12.0,
  });

  await t.test('1. Normalization helpers sanitize names and Kenyan phone numbers', () => {
    assert.equal(normalizeSchoolName('St. Patrick High School Mixed'), 'st patrick');
    assert.equal(normalizeSchoolName('Alliance Secondary School (Boarding)'), 'alliance');
    assert.equal(normalizePhone('+254 712 345 678'), '0712345678');
    assert.equal(normalizePhone('0712-345-678'), '0712345678');
    assert.equal(normalizePhone('254712345678'), '0712345678');
  });

  await t.test('2. Direct lead creation & query filtering', () => {
    const lead = leadsStore.createLead({
      name: 'John Doe',
      school: 'Sunrise Academy',
      phone: '0722000111',
      stage: 'new',
      priority: '2',
      students: 450,
      tags: ['direct', 'web'],
      notes: 'Direct website inquiry',
    });

    assert.ok(lead.id);
    assert.equal(lead.school, 'Sunrise Academy');
    assert.equal(lead.stage, 'new');
    assert.equal(lead.source, 'direct');
    assert.equal(lead.agentId, null);

    const list = leadsStore.listLeads({ search: 'Sunrise' });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, lead.id);

    const byStage = leadsStore.listLeads({ stage: 'converted' });
    assert.equal(byStage.length, 0);
  });

  let fieldSchool = null;
  let fieldLead = null;

  await t.test('3. Atomic registration: creates agent school and lead atomically with full attribution', () => {
    const result = leadsStore.registerSchoolLead({
      agentId: agent.id,
      schoolName: 'Moi High School Kabarak',
      contactPerson: 'Principal Mutai',
      contactPhone: '0711223344',
      estimatedStudents: 1200,
      county: 'Nakuru',
      notes: 'Initial meeting scheduled for Friday',
      source: 'field_agent',
    });

    fieldSchool = result.school;
    fieldLead = result.lead;

    assert.ok(fieldSchool.id);
    assert.ok(fieldLead.id);
    assert.equal(fieldSchool.agent_id, agent.id);
    assert.equal(fieldSchool.lead_id, fieldLead.id);
    assert.equal(fieldSchool.school_name, 'Moi High School Kabarak');
    assert.equal(fieldSchool.status, 'pitching');

    assert.equal(fieldLead.school, 'Moi High School Kabarak');
    assert.equal(fieldLead.name, 'Principal Mutai');
    assert.equal(fieldLead.phone, '0711223344');
    assert.equal(fieldLead.students, 1200);
    assert.equal(fieldLead.agentId, agent.id);
    assert.equal(fieldLead.agentCode, agent.agent_code);
    assert.equal(fieldLead.agentSchoolId, fieldSchool.id);
    assert.equal(fieldLead.agentName, 'David Kiprono');
    assert.equal(fieldLead.source, 'field_agent');
  });

  await t.test('4. Duplicate collision protection prevents claiming the same school by another agent', () => {
    // Create another agent
    const agent2 = agentsStore.createAgent({
      full_name: 'Sarah Njeri',
      phone: '0799887766',
      county: 'Nairobi',
    });

    // Attempt to register the exact same school name
    assert.throws(() => {
      leadsStore.registerSchoolLead({
        agentId: agent2.id,
        schoolName: 'Moi High School Kabarak',
        contactPerson: 'Deputy Principal',
        contactPhone: '0755443322',
      });
    }, (err) => {
      return err.message.includes('already claimed by David Kiprono (AGT-1001)');
    });

    // Attempt to register normalized variation
    assert.throws(() => {
      leadsStore.registerSchoolLead({
        agentId: agent2.id,
        schoolName: 'Moi Kabarak Secondary School',
        contactPerson: 'Bursar',
      });
    }, (err) => {
      return err.message.includes('already claimed');
    });

    // Attempt to register with the same contact phone number
    assert.throws(() => {
      leadsStore.registerSchoolLead({
        agentId: agent2.id,
        schoolName: 'Completely Different Name',
        contactPerson: 'Principal Mutai',
        contactPhone: '0711-223-344',
      });
    }, (err) => {
      return err.message.includes('already claimed') && err.message.includes('matching phone number');
    });
  });

  await t.test('5. Attribution immutability: CRM PUT/update cannot strip or hijack agent attribution', () => {
    const updated = leadsStore.updateLead(fieldLead.id, {
      name: 'Updated Contact Person',
      notes: 'Admin updated notes from call',
      // Malicious or accidental overwrite attempts:
      agentId: 'fake-agent-id',
      agent_id: 'fake-agent-id',
      agentCode: 'AGT-9999',
      agent_code: 'AGT-9999',
      source: 'direct',
      agentSchoolId: 'fake-school-id',
      agent_school_id: 'fake-school-id',
    });

    assert.equal(updated.name, 'Updated Contact Person');
    assert.equal(updated.notes, 'Admin updated notes from call');
    // Attribution MUST remain intact
    assert.equal(updated.agentId, agent.id);
    assert.equal(updated.agentCode, agent.agent_code);
    assert.equal(updated.agentSchoolId, fieldSchool.id);
    assert.equal(updated.source, 'field_agent');
    assert.equal(updated.agentName, 'David Kiprono');
  });

  await t.test('6. Two-way status sync: Moving lead stage updates agent school status', () => {
    // 6a. Move to "interested" -> status remains "pitching"
    leadsStore.updateLead(fieldLead.id, { stage: 'interested' });
    let school = agentsStore.getSchool(fieldSchool.id);
    assert.equal(school.status, 'pitching');

    // 6b. Move to "converted" -> status becomes "onboarded"
    leadsStore.updateLead(fieldLead.id, { stage: 'converted' });
    school = agentsStore.getSchool(fieldSchool.id);
    assert.equal(school.status, 'onboarded');

    // 6c. Move to "lost" -> status becomes "churned"
    leadsStore.updateLead(fieldLead.id, { stage: 'lost' });
    school = agentsStore.getSchool(fieldSchool.id);
    assert.equal(school.status, 'churned');
  });

  await t.test('7. Instance Provisioning sync: syncProvisionedTenant sets tenant_key and converts lead', () => {
    leadsStore.syncProvisionedTenant({
      schoolName: 'Moi High School Kabarak',
      tenantKey: 'moi-kabarak-prod',
    });

    const school = agentsStore.getSchool(fieldSchool.id);
    assert.equal(school.tenant_key, 'moi-kabarak-prod');
    assert.equal(school.status, 'onboarded');

    const lead = leadsStore.getLead(fieldLead.id);
    assert.equal(lead.stage, 'converted');
    assert.equal(lead.nextActivity, 'Instance provisioned');
  });

  await t.test('8. Delete lead cleans up agent_schools lead_id link', () => {
    assert.ok(leadsStore.deleteLead(fieldLead.id));
    assert.equal(leadsStore.getLead(fieldLead.id), null);

    const school = agentsStore.getSchool(fieldSchool.id);
    assert.equal(school.lead_id, '');
  });

  await t.test('9. Backfill missing agent leads finds orphaned agent schools and creates CRM leads', () => {
    // Create an orphaned school directly in agentsStore without a lead
    const orphanedSchool = agentsStore.addSchool(agent.id, {
      school_name: 'Nakuru Elite Academy',
      contact_person: 'Director Kamau',
      contact_phone: '0722334455',
      status: 'pitching',
      notes: 'Orphaned school before migration',
    });
    assert.equal(orphanedSchool.lead_id, '');

    // Re-initialize leadsStore on the same DB to trigger backfill
    leadsStore.close();
    const leadsStore2 = createLeadsStore(tmpDir);

    const updatedSchool = agentsStore.getSchool(orphanedSchool.id);
    assert.ok(updatedSchool.lead_id, 'Lead ID should have been populated by backfill');

    const backfilledLead = leadsStore2.getLead(updatedSchool.lead_id);
    assert.ok(backfilledLead);
    assert.equal(backfilledLead.school, 'Nakuru Elite Academy');
    assert.equal(backfilledLead.agentId, agent.id);
    assert.equal(backfilledLead.agentCode, agent.agent_code);
    assert.equal(backfilledLead.stage, 'new');

    leadsStore2.close();
  });

  await t.test('10. One-time JSON migration imports existing leads.store.json', () => {
    const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-leads-migration-'));
    const freshAgents = createAgentsStore(freshDir);
    const agt = freshAgents.createAgent({
      full_name: 'Legacy Agent',
      phone: '0700112233',
    });

    // Write a mock legacy leads.store.json file
    const mockJson = {
      leads: [
        {
          id: 'L1000000001',
          name: 'Sister Mary',
          school: 'Loreto Convent',
          phone: '0711000111',
          stage: 'interested',
          priority: '2',
          students: 800,
          tags: ['field_agent', agt.agent_code],
          systems: { assessment: 'Excel', fees: 'None', lms: 'None' },
          notes: 'Migrated lead',
          created: '2026-01-15',
        },
        {
          id: 'L1000000002',
          name: 'Direct Contact',
          school: 'Kilimani Academy',
          phone: '0722999000',
          stage: 'new',
          priority: '1',
          students: 350,
          tags: ['direct'],
          systems: { assessment: 'None', fees: 'None', lms: 'None' },
          notes: 'Direct inquiry',
          created: '2026-02-01',
        }
      ]
    };
    fs.writeFileSync(path.join(freshDir, 'leads.store.json'), JSON.stringify(mockJson, null, 2), 'utf8');

    const freshLeads = createLeadsStore(freshDir);
    const all = freshLeads.listLeads();
    assert.equal(all.length, 2);

    const loreto = freshLeads.getLead('L1000000001');
    assert.equal(loreto.school, 'Loreto Convent');
    assert.equal(loreto.agentId, agt.id);
    assert.equal(loreto.agentCode, agt.agent_code);
    assert.equal(loreto.source, 'field_agent');

    const kilimani = freshLeads.getLead('L1000000002');
    assert.equal(kilimani.school, 'Kilimani Academy');
    assert.equal(kilimani.source, 'direct');
    assert.equal(kilimani.agentId, null);

    freshAgents.close();
    freshLeads.close();
    fs.rmSync(freshDir, { recursive: true, force: true });
  });

  agentsStore.close();
  leadsStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
