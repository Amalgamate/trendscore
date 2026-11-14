'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentsStore } = require('../agents-store');
const { createLeadsStore } = require('../leads-store');
const { publicPackageOptions } = require('../application-catalog');

function applicationData(overrides = {}) {
  return {
    name: 'Amina Example',
    email: 'amina@example.test',
    phone: '0712345678',
    school: 'Example Primary School',
    schoolType: 'PUBLIC_PRIMARY',
    accommodationType: 'DAY',
    transportNeeded: false,
    address: 'Example Road',
    county: 'Nakuru',
    packageId: 'starter',
    ...overrides,
  };
}

test('school application package and lifecycle rules', async t => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-applications-test-'));
  const agentsStore = createAgentsStore(tmpDir);
  const store = createLeadsStore(tmpDir);
  t.after(() => {
    store.close();
    agentsStore.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('requires an allowed package for Primary and rejects Enterprise', () => {
    assert.throws(
      () => store.submitApplication(applicationData({ packageId: '' })),
      /Primary applications require Starter, Standard, or Professional/,
    );
    assert.throws(
      () => store.submitApplication(applicationData({ packageId: 'enterprise' })),
      /Primary applications require Starter, Standard, or Professional/,
    );
    const application = store.submitApplication(applicationData()).application;
    assert.equal(application.requestedPackageId, 'starter');
    assert.equal(application.applicationStatus, 'submitted');
  });

  test('public package catalog exposes only allowed Primary bundles with correct Starter fees', () => {
    const publicPrimary = publicPackageOptions('PUBLIC_PRIMARY');
    const privatePrimary = publicPackageOptions('PRIVATE_PRIMARY');
    assert.deepEqual(publicPrimary.map(pack => pack.id), ['starter', 'standard', 'professional']);
    assert.deepEqual(privatePrimary.map(pack => pack.id), ['starter', 'standard', 'professional']);
    assert.equal(publicPrimary[0].modules.some(module => module.slug === 'fee-management'), false);
    assert.equal(privatePrimary[0].modules.some(module => module.slug === 'fee-management'), true);
    assert.equal(publicPrimary.slice(1).every(pack => pack.modules.every(module => module.slug !== 'transport')), true);
    assert.equal(privatePrimary.slice(1).every(pack => pack.modules.every(module => module.slug !== 'transport')), true);
    assert.deepEqual(publicPackageOptions('PUBLIC_SECONDARY'), []);
    assert.equal(publicPrimary.some(pack => Object.hasOwn(pack, 'price')), false);
  });

  await t.test('accepts Secondary without a package and rejects any Primary package', () => {
    const application = store.submitApplication(applicationData({
      school: 'Example Secondary School',
      schoolType: 'PRIVATE_SECONDARY',
      packageId: '',
    })).application;
    assert.equal(application.educationLevel, 'SECONDARY');
    assert.equal(application.requestedPackageId, '');
    assert.throws(
      () => store.submitApplication(applicationData({
        school: 'Other Secondary School',
        schoolType: 'PUBLIC_SECONDARY',
        packageId: 'starter',
      })),
      /Secondary applications cannot select a Primary package/,
    );
  });

  await t.test('stores transport as a recommendation until staff explicitly confirms it', () => {
    const application = store.submitApplication(applicationData({
      school: 'Transport Primary School',
      transportNeeded: true,
    })).application;
    assert.equal(application.transportNeeded, true);
    assert.deepEqual(application.requestedModuleSlugs, []);
    assert.deepEqual(application.approvedModuleSlugs, []);
    const reviewed = store.reviewApplication(application.id, {
      packageId: 'starter',
      agentId: '',
      moduleSlugs: [],
    }, 'reviewer@example.test');
    assert.deepEqual(reviewed.approvedModuleSlugs, []);
    const confirmedApplication = store.submitApplication(applicationData({
      school: 'Confirmed Transport Primary School',
      transportNeeded: true,
    })).application;
    const confirmed = store.reviewApplication(confirmedApplication.id, {
      packageId: 'starter',
      agentId: '',
      moduleSlugs: ['transport'],
    }, 'reviewer@example.test');
    assert.deepEqual(confirmed.approvedModuleSlugs, ['transport']);
  });

  await t.test('reassigned agent attribution is linked to the provisioned school', () => {
    const requestedAgent = agentsStore.createAgent({
      full_name: 'Requested Agent',
      phone: '0722111222',
      email: 'requested@sales.test',
      commission_type: 'percentage',
      commission_rate: 10,
    });
    const assignedAgent = agentsStore.createAgent({
      full_name: 'Assigned Agent',
      phone: '0733444555',
      email: 'assigned@sales.test',
      commission_type: 'percentage',
      commission_rate: 10,
    });
    const application = store.submitApplication(applicationData({
      school: 'Agent Linked Primary School',
      agentId: requestedAgent.id,
    })).application;
    store.reviewApplication(application.id, {
      packageId: 'starter',
      agentId: assignedAgent.id,
      moduleSlugs: [],
    }, 'reviewer@example.test');
    store.approveApplication(application.id, 'approver@example.test');
    store.startApplicationProvisioning(application.id, 'admin@example.test');
    store.markApplicationReady(application.id, {
      tenantKey: 'agent-linked-primary',
      domain: 'agent-linked-primary.trendscore.co.ke',
      schoolId: 'school-agent-linked',
      customerId: 'customer-agent-linked',
      contractId: 'contract-agent-linked',
      encryptedActivationToken: 'encrypted-token',
      readyAt: '2026-03-15T10:00:00.000Z',
    }, 'admin@example.test');

    assert.equal(store.syncProvisionedTenant({ leadId: application.id, tenantKey: 'agent-linked-primary' }), true);
    const lead = store.getLead(application.id);
    assert.ok(lead.agentSchoolId);
    assert.equal(lead.agentId, assignedAgent.id);
    const linkedSchool = agentsStore.getSchool(lead.agentSchoolId);
    assert.equal(linkedSchool.agent_id, assignedAgent.id);
    assert.equal(linkedSchool.tenant_key, 'agent-linked-primary');
    assert.equal(linkedSchool.status, 'onboarded');
    const linkedSchoolId = linkedSchool.id;
    assert.equal(store.syncProvisionedTenant({ leadId: application.id, tenantKey: 'agent-linked-primary' }), true);
    assert.equal(store.getLead(application.id).agentSchoolId, linkedSchoolId);
    assert.equal(agentsStore.getSchool(linkedSchoolId).agent_id, assignedAgent.id);
  });

  await t.test('requires review and approval before install, and records ready/subscription date', () => {
    const application = store.submitApplication(applicationData({
      school: 'Lifecycle Primary School',
      packageId: 'professional',
    })).application;
    assert.throws(() => store.startApplicationProvisioning(application.id, 'admin@example.test'), /approved application/);
    store.reviewApplication(application.id, {
      packageId: 'professional',
      agentId: '',
      moduleSlugs: [],
      reviewNotes: 'Package confirmed',
    }, 'reviewer@example.test');
    assert.equal(store.approveApplication(application.id, 'approver@example.test').applicationStatus, 'approved');
    const provisioning = store.startApplicationProvisioning(application.id, 'admin@example.test');
    assert.equal(provisioning.application.applicationStatus, 'provisioning');

    const readyAt = '2026-03-15T10:00:00.000Z';
    const ready = store.markApplicationReady(application.id, {
      tenantKey: 'lifecycle-primary',
      domain: 'lifecycle-primary.trendscore.co.ke',
      schoolId: 'school-123',
      customerId: 'customer-123',
      contractId: 'contract-123',
      encryptedActivationToken: 'encrypted-token',
      readyAt,
    }, 'admin@example.test');
    assert.equal(ready.applicationStatus, 'ready');
    assert.equal(ready.readyAt, readyAt);
    assert.equal(ready.activationEmailStatus, 'pending');
    assert.equal(store.getApplicationSecret(application.id), 'encrypted-token');
    assert.equal(Object.hasOwn(ready, 'activationTokenEncrypted'), false);

    assert.equal(store.recordActivationEmail(application.id, { status: 'sent' }, 'admin@example.test').activationEmailStatus, 'sent');
    const events = store.listApplicationEvents(application.id);
    assert.deepEqual(
      events.filter(event => event.eventType !== 'activation_email').map(event => event.toStatus).filter(Boolean),
      ['submitted', 'under_review', 'approved', 'provisioning', 'ready'],
    );
  });
});
