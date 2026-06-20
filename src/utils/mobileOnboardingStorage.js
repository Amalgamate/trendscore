export const MOBILE_ONBOARDING_POLICY_VERSION = 'v1.0';
export const MOBILE_ONBOARDING_STORAGE_KEY = 'trendscore_mobile_onboarding_v1';
export const MOBILE_CONSENT_STORAGE_KEY = 'trendscore_mobile_policy_consent';

export function resetMobileOnboardingForLogout() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(MOBILE_ONBOARDING_STORAGE_KEY);
  window.localStorage.removeItem(MOBILE_CONSENT_STORAGE_KEY);
  window.sessionStorage.setItem('force_mobile_onboarding', '1');
}

export const resetMobileOnboardingForForcedLogout = resetMobileOnboardingForLogout;
