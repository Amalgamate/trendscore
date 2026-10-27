'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAgentsStore } = require('../agents-store');

test('Agents Store Lifecycle & Financials', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-agents-test-'));
  const store = createAgentsStore(tmpDir);

  await t.test('Registers agents with auto-incrementing codes', () => {
    const a1 = store.createAgent({
      full_name: 'Grace Wambui',
      phone: '0722111222',
      email: 'grace@sales.test',
      county: 'Kiambu',
      commission_type: 'percentage',
      commission_rate: 10.0,
      pin: '4321',
    });
    assert.equal(a1.agent_code, 'AGT-1001');
    assert.equal(a1.full_name, 'Grace Wambui');
    assert.equal(a1.status, 'active');
    assert.equal(a1.has_pin, true);

    const a2 = store.createAgent({
      full_name: 'Peter Omondi',
      phone: '0733444555',
      county: 'Kisumu',
      commission_type: 'fixed_per_school',
      commission_rate: 5000,
    });
    assert.equal(a2.agent_code, 'AGT-1002');
  });

  await t.test('Lists agents and filters by search query and status', () => {
    const all = store.listAgents();
    assert.equal(all.length, 2);

    const filtered = store.listAgents({ search: 'Grace' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].full_name, 'Grace Wambui');

    const byCounty = store.listAgents({ search: 'Kisumu' });
    assert.equal(byCounty.length, 1);
    assert.equal(byCounty[0].full_name, 'Peter Omondi');
  });

  await t.test('Assigns schools and records earnings and payouts', () => {
    const agents = store.listAgents();
    const grace = agents.find(a => a.agent_code === 'AGT-1001');

    // Assign school
    const school = store.addSchool(grace.id, {
      school_name: 'St. Marys Girls High School',
      contact_person: 'Principal Sister Jane',
      contact_phone: '0711999888',
      status: 'pitching',
    });
    assert.equal(school.school_name, 'St. Marys Girls High School');
    assert.equal(school.agent_id, grace.id);

    // Record commission
    const earning = store.recordEarning(grace.id, {
      school_name: school.school_name,
      gross_amount_ksh: 60000,
      earned_amount_ksh: 6000,
      description: '10% on Term 1 ERP license',
      status: 'approved',
    });
    assert.equal(earning.earned_amount_ksh, 6000);

    // Check financial balance
    let detail = store.getAgent(grace.id);
    assert.equal(detail.financials.totalEarnedKsh, 6000);
    assert.equal(detail.financials.totalPaidKsh, 0);
    assert.equal(detail.financials.balanceDueKsh, 6000);

    // Record payout
    const payout = store.recordPayout(grace.id, {
      amount_ksh: 6000,
      payout_method: 'mpesa',
      reference: 'RKJ901238',
    }, 'super_admin');
    assert.equal(payout.amount_ksh, 6000);

    // Check balance after payout
    detail = store.getAgent(grace.id);
    assert.equal(detail.financials.totalPaidKsh, 6000);
    assert.equal(detail.financials.balanceDueKsh, 0);

    // Verify overview
    const overview = store.getOverview();
    assert.equal(overview.totalAgents, 2);
    assert.equal(overview.totalAssignedSchools, 1);
    assert.equal(overview.totalEarnedAll, 6000);
    assert.equal(overview.totalPayoutsDisbursed, 6000);
  });

  await t.test('Authenticates agent PIN for mobile app', () => {
    const grace = store.authenticateAgent('0722111222', '4321');
    assert.ok(grace);
    assert.equal(grace.agent_code, 'AGT-1001');

    const wrongPin = store.authenticateAgent('0722111222', '0000');
    assert.equal(wrongPin, null);
  });

  await t.test('Auto-attributes commission when invoice payment occurs', () => {
    const agents = store.listAgents();
    const grace = agents.find(a => a.agent_code === 'AGT-1001');

    // Matching agent for school
    const matched = store.findAgentForSchool({ schoolName: 'St. Marys Girls High School' });
    assert.ok(matched);
    assert.equal(matched.id, grace.id);

    // Mock payment, invoice, customer
    const mockPayment = {
      id: 'pay_test_998',
      amountKsh: 50000,
      paymentDate: '2026-10-26',
    };
    const mockInvoice = {
      id: 'inv_test_123',
      invoiceNumber: 'INV-2026-0042',
      invoiceSnapshot: {
        customerSnapshot: {
          name: 'St. Marys Girls High School',
          tenantKey: 'stmarys',
        },
      },
    };
    const mockCustomer = {
      name: 'St. Marys Girls High School',
      tenantKey: 'stmarys',
    };

    const earning = store.attributePaymentCommission({
      payment: mockPayment,
      invoice: mockInvoice,
      customer: mockCustomer,
    });

    assert.ok(earning);
    assert.equal(earning.agent_id, grace.id);
    assert.equal(earning.earned_amount_ksh, 5000); // 10% of 50,000
    assert.equal(earning.status, 'approved');
    assert.equal(earning.payment_id, 'pay_test_998');

    // Idempotency: second call should be ignored
    const duplicate = store.attributePaymentCommission({
      payment: mockPayment,
      invoice: mockInvoice,
      customer: mockCustomer,
    });
    assert.equal(duplicate, null);
  });

  await t.test('Updates and deletes agent', () => {
    const agents = store.listAgents();
    const peter = agents.find(a => a.agent_code === 'AGT-1002');
    const updated = store.updateAgent(peter.id, { base_location: 'Milimani, Kisumu' });
    assert.equal(updated.base_location, 'Milimani, Kisumu');

    const deleted = store.deleteAgent(peter.id);
    assert.equal(deleted, true);
    assert.equal(store.getAgent(peter.id), null);
  });
});

