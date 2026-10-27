'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAgentsStore } = require('../agents-store');
const { createBillingStore } = require('../billing-store');

test('Field Agent Mobile App & Billing Auto-Attribution Integration', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendscore-int-test-'));
  const agentsStore = createAgentsStore(tmpDir);
  const billingStore = createBillingStore(tmpDir);

  let agent = null;

  await t.test('1. Admin registers a new field agent with 15% commission and PIN', () => {
    agent = agentsStore.createAgent({
      full_name: 'Faith Mutua',
      phone: '0712345678',
      email: 'faith@trendscore.co.ke',
      county: 'Machakos',
      commission_type: 'percentage',
      commission_rate: 15.0,
      pin: '9876',
    });

    assert.ok(agent);
    assert.equal(agent.agent_code, 'AGT-1001');
    assert.equal(agent.has_pin, true);
    assert.equal(agent.status, 'active');
  });

  await t.test('2. Agent logs into Mobile App with Phone + PIN', () => {
    const authAgent = agentsStore.authenticateAgent('0712345678', '9876');
    assert.ok(authAgent);
    assert.equal(authAgent.id, agent.id);
    assert.equal(authAgent.financials.balanceDueKsh, 0);

    const badAuth = agentsStore.authenticateAgent('0712345678', '0000');
    assert.equal(badAuth, null);
  });

  await t.test('3. Agent registers a new school in the field', () => {
    const school = agentsStore.addSchool(agent.id, {
      school_name: 'Machakos Academy Senior School',
      contact_person: 'Principal David Musyoka',
      contact_phone: '0722998877',
      status: 'pitching',
      notes: 'County: Machakos · Looking for CBC assessment and fees management',
    });

    assert.ok(school);
    assert.equal(school.school_name, 'Machakos Academy Senior School');
    assert.equal(school.agent_id, agent.id);

    const profile = agentsStore.getAgent(agent.id);
    assert.equal(profile.schools.length, 1);
  });

  await t.test('4. School signs up and invoice payment is recorded -> Commission auto-attributed', () => {
    // 1. Create customer & quote & invoice in billingStore
    const customer = billingStore.createCustomer({
      id: 'cust_machakos_acad',
      name: 'Machakos Academy Senior School',
      legalName: 'Machakos Academy Ltd',
      tenantKey: 'machakos-academy',
      billingEmail: 'accounts@machakos.ac.ke',
      billingPhone: '0722998877',
      billingAddress: 'Machakos Town',
      taxIdentifier: 'P051234567Z',
      currency: 'KES',
      paymentTerms: 'net30',
      status: 'active',
    });

    const quote = billingStore.createQuote({
      id: 'quote_machakos_01',
      quoteNumber: 'Q-2026-901',
      customerId: customer.id,
      customerSnapshot: { name: customer.name, tenantKey: customer.tenantKey },
      quoteSnapshot: { subtotalKsh: 80000, enrollmentCount: 350 },
      enrollmentCount: 350,
      pricingModel: 'per_student',
      billingCadence: 'termly',
      subtotalKsh: 80000,
      expiresOn: '2026-11-30',
      notes: 'Standard CBC deployment',
      createdBy: 'admin@trendscore.co.ke',
    });

    const invoice = billingStore.createDraftInvoice({
      id: 'inv_machakos_01',
      invoiceNumber: 'DRAFT-INV-901',
      quoteId: quote.id,
      customerId: customer.id,
      invoiceSnapshot: {
        customerSnapshot: { name: customer.name, tenantKey: customer.tenantKey },
        quoteSnapshot: quote.quoteSnapshot,
      },
      amountKsh: 80000,
      createdBy: 'admin@trendscore.co.ke',
    });

    const issuedInvoice = billingStore.issueDraftInvoice(invoice.id, 'INV-2026-0901', '2026-10-26T10:00:00.000Z');

    // 2. Record payment of KES 80,000 against this invoice
    const payment = billingStore.recordPayment({
      id: 'pay_machakos_80k',
      invoiceId: issuedInvoice.id,
      amountKsh: 80000,
      paymentDate: '2026-10-26',
      method: 'bank_transfer',
      reference: 'FT2629988771',
      notes: 'Full payment for Term 1 CBC platform license',
      recordedBy: 'admin@trendscore.co.ke',
    });

    // 3. Trigger auto-attribution hook (same code as in server.js /api/billing/payments)
    const paidInvoice = billingStore.getInvoice(issuedInvoice.id);
    const invoiceCustomer = billingStore.getCustomer(paidInvoice.customerId);

    const autoEarning = agentsStore.attributePaymentCommission({
      payment,
      invoice: paidInvoice,
      customer: invoiceCustomer,
    });

    assert.ok(autoEarning);
    assert.equal(autoEarning.agent_id, agent.id);
    assert.equal(autoEarning.earned_amount_ksh, 12000); // 15% of 80,000 = 12,000 KES!
    assert.equal(autoEarning.status, 'approved');
    assert.equal(autoEarning.payment_id, payment.id);

    // 4. Verify agent's statement in Mobile App
    const updatedAgent = agentsStore.getAgent(agent.id);
    assert.equal(updatedAgent.financials.totalEarnedKsh, 12000);
    assert.equal(updatedAgent.financials.totalPaidKsh, 0);
    assert.equal(updatedAgent.financials.balanceDueKsh, 12000);
    assert.equal(updatedAgent.earnings.length, 1);
  });

  await t.test('5. Admin disburses M-Pesa commission payout to agent', () => {
    const payout = agentsStore.recordPayout(agent.id, {
      amount_ksh: 12000,
      payout_method: 'mpesa',
      reference: 'RKJ77881122',
      notes: 'Commission for Machakos Academy Term 1 payment',
    }, 'super_admin');

    assert.ok(payout);
    assert.equal(payout.amount_ksh, 12000);

    const afterPayout = agentsStore.getAgent(agent.id);
    assert.equal(afterPayout.financials.totalEarnedKsh, 12000);
    assert.equal(afterPayout.financials.totalPaidKsh, 12000);
    assert.equal(afterPayout.financials.balanceDueKsh, 0);
  });

  await t.test('6. Agent self-service M-Pesa withdrawal and notifications validation', () => {
    // 1. Credit new commission of KES 5,000
    agentsStore.recordEarning(agent.id, {
      gross_amount_ksh: 50000,
      earned_amount_ksh: 5000,
      school_name: 'Alliance Academy',
      description: 'Commission for Term 2',
      invoice_ref: 'INV-2026-902',
    });

    const refreshed = agentsStore.getAgent(agent.id);
    assert.equal(refreshed.financials.balanceDueKsh, 5000);

    // 2. PIN check
    const authOk = agentsStore.authenticateAgent(agent.phone, '9876');
    assert.ok(authOk);
    const authFail = agentsStore.authenticateAgent(agent.phone, '0000');
    assert.equal(authFail, null);

    // 3. Self-service payout of KES 2,500
    const mpesaPayout = agentsStore.recordPayout(agent.id, {
      amount_ksh: 2500,
      payout_method: 'mpesa',
      reference: 'MPESA992288',
      status: 'completed',
      notes: 'Agent self-service cash-out to M-Pesa',
    }, 'agent_app_self_service');

    assert.ok(mpesaPayout);
    assert.equal(mpesaPayout.amount_ksh, 2500);

    const postWithdraw = agentsStore.getAgent(agent.id);
    assert.equal(postWithdraw.financials.totalEarnedKsh, 17000);
    assert.equal(postWithdraw.financials.totalPaidKsh, 14500);
    assert.equal(postWithdraw.financials.balanceDueKsh, 2500); // 5000 - 2500 = 2500 remaining!
  });
});
