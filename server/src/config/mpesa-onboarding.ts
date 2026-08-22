export const MPESA_ONBOARDING_REQUIREMENT_IDS = [
  'registration', 'ownership', 'tax_identity', 'permits', 'authorization', 'provider_forms',
  'school_paybill', 'bank_account', 'bank_proof', 'contacts', 'charges',
  'calendar_fees', 'allocation', 'credit_scope', 'refunds', 'accounting', 'roles',
  'learner_ids', 'guardian_links', 'payer_phones', 'opening_balances', 'unmatched_owner',
  'provider_account', 'credentials', 'callback', 'sandbox_test', 'production_test', 'rotation'
] as const;

export const isMpesaOnboardingComplete = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const checklist = value as Record<string, unknown>;
  return MPESA_ONBOARDING_REQUIREMENT_IDS.every((id) => checklist[id] === true);
};
