'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBillingService } = require('../services/billing');
const { createLeadsService }   = require('../services/leads');
const { createNotifyService }  = require('../services/notify');

// ── Mock stores ─────────────────────────────────────────────────────────
function mockBillingStore(overrides = {}) {
  return {
    listCustomers: () => [{ id: '1', name: 'Acme School' }],
    createCustomer: (c) => ({ ...c, id: 'new-1' }),
    ...overrides,
  };
}

function mockLeadsStore(overrides = {}) {
  return {
    listLeads: () => [{ id: 'l1', name: 'Alice', school: 'St. Paul' }],
    createLead: (b) => ({ ...b, id: 'l2' }),
    ...overrides,
  };
}

function mockAgentsStore(overrides = {}) {
  return {
    getOverview: () => ({ totalAgents: 3, activeAgents: 2, pendingAgents: 1 }),
    ...overrides,
  };
}

// ── Billing service ──────────────────────────────────────────────────────
test('createBillingService.listCustomers delegates to store', () => {
  const svc = createBillingService(mockBillingStore());
  assert.deepEqual(svc.listCustomers(), [{ id: '1', name: 'Acme School' }]);
});

test('createBillingService.createCustomer delegates to store', () => {
  const svc = createBillingService(mockBillingStore());
  const c = svc.createCustomer({ name: 'New School', currency: 'KES' });
  assert.equal(c.id, 'new-1');
  assert.equal(c.name, 'New School');
});

// ── Leads service ────────────────────────────────────────────────────────
test('createLeadsService.listLeads delegates to leadsStore', () => {
  const svc = createLeadsService(mockLeadsStore(), mockAgentsStore());
  assert.equal(svc.listLeads().length, 1);
});

test('createLeadsService.createLead delegates to leadsStore', () => {
  const svc = createLeadsService(mockLeadsStore(), mockAgentsStore());
  const lead = svc.createLead({ name: 'Bob', school: 'Hillside' });
  assert.equal(lead.id, 'l2');
});

test('createLeadsService.getAgentsOverview delegates to agentsStore', () => {
  const svc = createLeadsService(mockLeadsStore(), mockAgentsStore());
  const ov = svc.getAgentsOverview();
  assert.equal(ov.totalAgents, 3);
});

// ── Notify service ───────────────────────────────────────────────────────
test('createNotifyService.emit logs with [SHADOW] prefix in shadow mode', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const svc = createNotifyService(null, { mode: 'shadow' });
    svc.emit('lead.created', { id: 'l1' });
    assert.ok(logs[0].startsWith('[SHADOW]'), `Expected [SHADOW] prefix, got: ${logs[0]}`);
  } finally {
    console.log = originalLog;
  }
});

test('createNotifyService.emit logs with [NOTIFY] prefix in live mode', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const svc = createNotifyService(null, { mode: 'live' });
    svc.emit('lead.created', { id: 'l1' });
    assert.ok(logs[0].startsWith('[NOTIFY]'), `Expected [NOTIFY] prefix, got: ${logs[0]}`);
  } finally {
    console.log = originalLog;
  }
});
