'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_PRODUCTS, calculateCatalogueQuote, normalizeProductInput } = require('../billing-pricing');

const quote = body => calculateCatalogueQuote(body, DEFAULT_PRODUCTS);

test('private school: setup 15,000 once + CORE 10,000 per term', () => {
  const q = quote({ schoolType: 'private' });
  assert.equal(q.subtotalKsh, 25000);
  assert.equal(q.termlyKsh, 10000);
  assert.equal(q.setupFeeKsh, 15000);
  assert.equal(q.pricingModel, 'catalogue');
  assert.equal(q.billingCadence, 'termly');
  assert.deepEqual(q.lines.map(l => l.productCode), ['setup_private', 'core_private']);
});

test('public primary school: setup 10,000 once + CORE 5,000 per term', () => {
  const q = quote({ schoolType: 'public_primary' });
  assert.equal(q.subtotalKsh, 15000);
  assert.equal(q.termlyKsh, 5000);
});

test('student count is optional metadata and does not change the price', () => {
  assert.equal(quote({ schoolType: 'private' }).enrollmentCount, 0);
  assert.equal(quote({ schoolType: 'private', enrollmentCount: '' }).enrollmentCount, 0);
  const withCount = quote({ schoolType: 'private', enrollmentCount: 850 });
  assert.equal(withCount.enrollmentCount, 850);
  assert.equal(withCount.subtotalKsh, 25000);
  assert.throws(() => quote({ schoolType: 'private', enrollmentCount: -5 }), /Student count/);
  assert.throws(() => quote({ schoolType: 'private', enrollmentCount: 1.5 }), /Student count/);
});

test('unknown or missing school type is rejected', () => {
  assert.throws(() => quote({}), /school type/i);
  assert.throws(() => quote({ schoolType: 'university' }), /school type/i);
});

test('private add-on modules are 5,000 each per term', () => {
  const q = quote({ schoolType: 'private', extraModules: ['Library', 'Transport'] });
  assert.equal(q.termlyKsh, 20000);
  assert.equal(q.subtotalKsh, 35000);
  assert.throws(() => quote({ schoolType: 'private', extraModules: ['Library', 'library'] }), /duplicate/i);
});

test('public primary add-on modules cost the same as private ones (confirmed October 2026) and are rejected while that price is inactive', () => {
  const q = quote({ schoolType: 'public_primary', extraModules: ['Library'] });
  assert.equal(q.subtotalKsh, 20000);
  const deactivated = DEFAULT_PRODUCTS.map(p => (p.code === 'module_public_primary' ? { ...p, active: false } : p));
  assert.throws(() => calculateCatalogueQuote({ schoolType: 'public_primary', extraModules: ['Library'] }, deactivated), /not offered/);
});

test('Communication adds 10,000 per term, or is free with the school\'s own SMS provider', () => {
  const paid = quote({ schoolType: 'private', communicationsIncluded: true });
  assert.equal(paid.subtotalKsh, 35000);
  assert.equal(paid.communicationsSmsPerTerm, 1000);
  const own = quote({ schoolType: 'private', communicationsIncluded: true, ownSmsProvider: true });
  assert.equal(own.subtotalKsh, 25000);
  assert.equal(own.communicationsSmsPerTerm, 0);
  assert.ok(own.lines.some(l => l.amountKsh === 0 && /own SMS provider/.test(l.description)));
  const none = quote({ schoolType: 'private', ownSmsProvider: true });
  assert.equal(none.subtotalKsh, 25000);
  assert.equal(none.lines.length, 2);
});

test('discount needs a reason and cannot exceed the total', () => {
  assert.throws(() => quote({ schoolType: 'private', discount: { amountKsh: 5000 } }), /reason/i);
  assert.throws(() => quote({ schoolType: 'private', discount: { amountKsh: 5000, reason: 'x' } }), /reason/i);
  assert.throws(() => quote({ schoolType: 'private', discount: { amountKsh: 30000, reason: 'Founding school' } }), /exceed/i);
  assert.throws(() => quote({ schoolType: 'private', discount: { amountKsh: -1, reason: 'Founding school' } }), /greater than zero/);
  const q = quote({ schoolType: 'private', discount: { amountKsh: 10000, reason: 'Old CORE price was 20,000', requiresApproval: true } });
  assert.equal(q.grossKsh, 25000);
  assert.equal(q.subtotalKsh, 15000);
  assert.equal(q.discount.requiresApproval, true);
  assert.equal(q.lines.at(-1).amountKsh, -10000);
});

test('zero or blank discount adds no line', () => {
  assert.equal(quote({ schoolType: 'private', discount: { amountKsh: 0 } }).lines.length, 2);
  assert.equal(quote({ schoolType: 'private', discount: { amountKsh: '', reason: '' } }).discount, null);
});

test('the quote carries a price snapshot of the products it used', () => {
  const q = quote({ schoolType: 'private', communicationsIncluded: true, extraModules: ['Library'] });
  assert.deepEqual(q.priceSnapshot.map(p => p.code).sort(), ['comms_private', 'core_private', 'module_private', 'setup_private']);
  const edited = DEFAULT_PRODUCTS.map(p => (p.code === 'core_private' ? { ...p, priceKsh: 12000 } : p));
  const later = calculateCatalogueQuote({ schoolType: 'private' }, edited);
  assert.equal(later.subtotalKsh, 27000);
  assert.equal(q.subtotalKsh, 40000, 'an earlier quote is unaffected by later price edits');
});

test('missing active setup or CORE price blocks quoting', () => {
  const noCore = DEFAULT_PRODUCTS.map(p => (p.code === 'core_private' ? { ...p, active: false } : p));
  assert.throws(() => calculateCatalogueQuote({ schoolType: 'private' }, noCore), /no active/);
});

test('expiry date is validated', () => {
  assert.equal(quote({ schoolType: 'private', expiresOn: '2026-12-31' }).expiresOn, '2026-12-31');
  assert.throws(() => quote({ schoolType: 'private', expiresOn: '2026-02-31' }), /expiresOn/);
});

test('price list edits are validated', () => {
  assert.deepEqual(normalizeProductInput({ name: ' CORE ', priceKsh: 12000, active: true }), { name: 'CORE', priceKsh: 12000, active: true });
  assert.throws(() => normalizeProductInput({ name: '', priceKsh: 1, active: true }), /name/i);
  assert.throws(() => normalizeProductInput({ name: 'x', priceKsh: -1, active: true }), /Price/);
  assert.throws(() => normalizeProductInput({ name: 'x', priceKsh: 10.5, active: true }), /Price/);
  assert.throws(() => normalizeProductInput({ name: 'x', priceKsh: 100, active: 'yes' }), /active/);
});
