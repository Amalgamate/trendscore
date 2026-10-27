'use strict';

// Catalogue-based pricing for TrendSCORE school billing (KES, flat per school, billed per term).
// Pure functions only: no database or server imports, so they can be unit-tested directly.

const SCHOOL_TYPES = {
  private: 'Private school',
  public_primary: 'Public primary school',
};
const PRODUCT_KINDS = ['setup', 'term', 'module', 'sms'];
const MAX_PRICE_KSH = 10000000;

// Seed values come from docs/PLATFORM_BILLING_COMPLETION_ROADMAP.md section 1.
// Public primary schools may also buy add-on modules (confirmed by the business, October 2026), at the same price as private schools.
const DEFAULT_PRODUCTS = [
  { code: 'setup_private', name: 'School setup (one-off)', kind: 'setup', schoolType: 'private', priceKsh: 15000, active: true, sortOrder: 10 },
  { code: 'setup_public_primary', name: 'School setup (one-off)', kind: 'setup', schoolType: 'public_primary', priceKsh: 10000, active: true, sortOrder: 11 },
  { code: 'core_private', name: 'TrendSCORE CORE (per term)', kind: 'term', schoolType: 'private', priceKsh: 10000, active: true, sortOrder: 20 },
  { code: 'core_public_primary', name: 'TrendSCORE CORE (per term)', kind: 'term', schoolType: 'public_primary', priceKsh: 5000, active: true, sortOrder: 21 },
  { code: 'module_private', name: 'Add-on module (per term)', kind: 'module', schoolType: 'private', priceKsh: 5000, active: true, sortOrder: 30 },
  { code: 'module_public_primary', name: 'Add-on module (per term)', kind: 'module', schoolType: 'public_primary', priceKsh: 5000, active: true, sortOrder: 31 },
  { code: 'comms_private', name: 'Communication (per term; 1,000 SMS included)', kind: 'sms', schoolType: 'private', priceKsh: 10000, active: true, sortOrder: 40 },
  { code: 'comms_public_primary', name: 'Communication (per term; 1,000 SMS included)', kind: 'sms', schoolType: 'public_primary', priceKsh: 10000, active: true, sortOrder: 41 },
];
const SMS_INCLUDED_PER_TERM = 1000;

function text(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function money(value) {
  return `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
}

function findProduct(products, kind, schoolType) {
  return (products || []).find(p => p.kind === kind && p.schoolType === schoolType && p.active) || null;
}

// Validates an admin edit to one price-list row. Code, kind and school type are fixed.
function normalizeProductInput(body = {}) {
  const name = text(body.name, 160);
  if (!name) throw new Error('Product name is required');
  const priceKsh = Number(body.priceKsh);
  if (!Number.isSafeInteger(priceKsh) || priceKsh < 0 || priceKsh > MAX_PRICE_KSH) {
    throw new Error(`Price must be a whole KSh amount between 0 and ${MAX_PRICE_KSH.toLocaleString('en-KE')}`);
  }
  if (typeof body.active !== 'boolean') throw new Error('active must be true or false');
  return { name, priceKsh, active: body.active };
}

function calculateCatalogueQuote(body = {}, products = []) {
  const schoolType = text(body.schoolType, 30);
  if (!SCHOOL_TYPES[schoolType]) throw new Error('Choose the school type: private or public primary');

  const setup = findProduct(products, 'setup', schoolType);
  const core = findProduct(products, 'term', schoolType);
  if (!setup || !core) throw new Error(`The price list has no active setup and CORE price for ${SCHOOL_TYPES[schoolType].toLowerCase()}s`);

  let enrollmentCount = 0;
  if (body.enrollmentCount !== undefined && body.enrollmentCount !== null && body.enrollmentCount !== '') {
    enrollmentCount = Number(body.enrollmentCount);
    if (!Number.isInteger(enrollmentCount) || enrollmentCount < 0 || enrollmentCount > 100000) {
      throw new Error('Student count is optional, but must be a whole number between 0 and 100,000 when entered');
    }
  }

  const extraModules = (Array.isArray(body.extraModules) ? body.extraModules : []).map(v => text(v, 100)).filter(Boolean);
  if (extraModules.length > 20) throw new Error('A quote can include up to 20 add-on modules');
  if (new Set(extraModules.map(v => v.toLowerCase())).size !== extraModules.length) throw new Error('Remove duplicate add-on module names');
  const moduleProduct = findProduct(products, 'module', schoolType);
  if (extraModules.length && !moduleProduct) throw new Error(`Add-on modules are not offered for ${SCHOOL_TYPES[schoolType].toLowerCase()}s`);

  const communicationsIncluded = body.communicationsIncluded === true;
  const ownSmsProvider = body.ownSmsProvider === true;
  const commsProduct = communicationsIncluded ? findProduct(products, 'sms', schoolType) : null;
  if (communicationsIncluded && !commsProduct) throw new Error(`Communication is not offered for ${SCHOOL_TYPES[schoolType].toLowerCase()}s`);

  const lines = [];
  const used = [];
  const addLine = (description, quantity, unitPriceKsh, cadence, product) => {
    lines.push({ description, quantity, unitPriceKsh, amountKsh: quantity * unitPriceKsh, cadence, productCode: product ? product.code : '' });
    if (product && !used.some(item => item.code === product.code)) {
      used.push({ code: product.code, name: product.name, kind: product.kind, schoolType: product.schoolType, priceKsh: product.priceKsh });
    }
  };

  addLine(setup.name, 1, setup.priceKsh, 'one_off', setup);
  addLine(core.name, 1, core.priceKsh, 'termly', core);
  for (const moduleName of extraModules) addLine(`Add-on module: ${moduleName} (per term)`, 1, moduleProduct.priceKsh, 'termly', moduleProduct);
  if (commsProduct) {
    if (ownSmsProvider) addLine('Communication (per term) - no charge, school uses its own SMS provider', 1, 0, 'termly', commsProduct);
    else addLine(commsProduct.name, 1, commsProduct.priceKsh, 'termly', commsProduct);
  }

  const grossKsh = lines.reduce((sum, item) => sum + item.amountKsh, 0);

  let discount = null;
  const discountInput = body.discount && typeof body.discount === 'object' ? body.discount : null;
  if (discountInput && discountInput.amountKsh !== undefined && discountInput.amountKsh !== null && discountInput.amountKsh !== '' && Number(discountInput.amountKsh) !== 0) {
    const amountKsh = Number(discountInput.amountKsh);
    if (!Number.isSafeInteger(amountKsh) || amountKsh <= 0) throw new Error('Discount must be a whole KSh amount greater than zero');
    if (amountKsh > grossKsh) throw new Error(`Discount cannot exceed the quote total of ${money(grossKsh)}`);
    const reason = text(discountInput.reason, 300);
    if (reason.length < 3) throw new Error('A discount needs a reason (for example, the old CORE price or a negotiated deal)');
    discount = { amountKsh, reason, requiresApproval: discountInput.requiresApproval === true };
    addLine(`Discount (one-off): ${reason}`, 1, -amountKsh, 'one_off', null);
  }

  const subtotalKsh = lines.reduce((sum, item) => sum + item.amountKsh, 0);
  if (!Number.isSafeInteger(subtotalKsh) || subtotalKsh < 0 || subtotalKsh > 1000000000) throw new Error('Quoted total is outside the supported range');

  const expiresOn = text(body.expiresOn, 10);
  if (expiresOn && !isValidDate(expiresOn)) throw new Error('expiresOn must be a valid date in YYYY-MM-DD format');

  const termlyKsh = lines.filter(item => item.cadence === 'termly').reduce((sum, item) => sum + item.amountKsh, 0);
  const pricingDescription = `${SCHOOL_TYPES[schoolType]}: setup ${money(setup.priceKsh)} once, then ${money(termlyKsh)} per term`
    + `${extraModules.length ? ` (CORE + ${extraModules.length} add-on module${extraModules.length > 1 ? 's' : ''}${commsProduct ? ' + Communication' : ''})` : commsProduct ? ' (CORE + Communication)' : ' (CORE)'}`;

  return {
    pricingModel: 'catalogue',
    schoolType,
    schoolTypeLabel: SCHOOL_TYPES[schoolType],
    enrollmentCount,
    pricingDescription,
    billingCadence: 'termly',
    billingCadenceLabel: 'Termly',
    setupFeeKsh: setup.priceKsh,
    communicationsIncluded,
    ownSmsProvider: communicationsIncluded && ownSmsProvider,
    communicationsSmsPerTerm: commsProduct && !ownSmsProvider ? SMS_INCLUDED_PER_TERM : 0,
    extraCadence: 'termly',
    extraModules,
    discount,
    grossKsh,
    termlyKsh,
    lines,
    priceSnapshot: used,
    subtotalKsh,
    expiresOn,
    notes: text(body.notes, 3000),
    taxNote: 'Tax treatment is not included in this quotation and must be reviewed before issuing a tax invoice.',
  };
}

module.exports = {
  SCHOOL_TYPES, PRODUCT_KINDS, DEFAULT_PRODUCTS, SMS_INCLUDED_PER_TERM,
  calculateCatalogueQuote, normalizeProductInput,
};
