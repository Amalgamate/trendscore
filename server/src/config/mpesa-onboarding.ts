export const MPESA_ONBOARDING_REQUIREMENT_IDS = [
  'registration', 'ownership', 'tax_identity', 'permits', 'authorization', 'provider_forms',
  'school_paybill', 'bank_account', 'bank_proof', 'contacts', 'charges',
  'calendar_fees', 'allocation', 'credit_scope', 'refunds', 'accounting', 'roles',
  'learner_ids', 'guardian_links', 'payer_phones', 'opening_balances', 'unmatched_owner',
  'provider_account', 'credentials', 'callback', 'sandbox_test', 'production_test', 'rotation'
] as const;

export const isMpesaOnboardingComplete = (value: unknown, sandbox = false) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const checklist = value as Record<string, unknown>;
  // Sandbox is a test environment. Requiring school KYC, a production payment,
  // and a rotation plan before allowing a sandbox request makes safe testing
  // impossible. Keep the production gate intact, but require the callback to
  // be configured before enabling sandbox callbacks.
  const requirements = sandbox ? ['credentials', 'callback'] : MPESA_ONBOARDING_REQUIREMENT_IDS;
  return requirements.every((id) => checklist[id] === true);
};
