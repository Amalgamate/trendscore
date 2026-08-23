import { resetMobileOnboardingForLogout } from './mobileOnboardingStorage';
import { clearAuthStorage, isRememberedSession } from './authStorage';

export const SESSION_POLL_INTERVAL_MS = 30_000;
export const INACTIVITY_LOGOUT_MS = 24 * 60 * 60 * 1000;
export const REMEMBERED_INACTIVITY_LOGOUT_MS = 30 * 24 * 60 * 60 * 1000;
// Browsers clamp setTimeout to a signed 32-bit integer. Scheduling 30 days in
// one call can overflow and fire immediately, so long waits must be chunked.
export const MAX_SAFE_TIMEOUT_MS = 2_147_000_000;

export function getInactivityLogoutMs() {
  return isRememberedSession()
    ? REMEMBERED_INACTIVITY_LOGOUT_MS
    : INACTIVITY_LOGOUT_MS;
}

export function getSafeTimeoutDelay(remainingMs) {
  return Math.max(0, Math.min(remainingMs, MAX_SAFE_TIMEOUT_MS));
}

export function clearAuthAndRedirect(reason = 'expired') {
  if (typeof window === 'undefined') return;

  clearAuthStorage();
  localStorage.removeItem('selectedInstitutionType');

  document.cookie = 'accessToken=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = 'refreshToken=; Max-Age=0; path=/; SameSite=Lax';

  resetMobileOnboardingForLogout();

  if (reason === 'forced') {
    sessionStorage.setItem('session_expired', 'forced_logout');
  } else if (reason === 'inactivity') {
    sessionStorage.setItem('session_expired', 'inactivity');
  } else {
    sessionStorage.setItem('session_expired', 'expired');
  }

  window.dispatchEvent(new CustomEvent('auth:session-ended', { detail: { reason } }));

  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/';
  }
}

export function getAuthErrorCode(error) {
  return (
    error?.response?.data?.code ||
    error?.response?.data?.error?.code ||
    error?.code ||
    ''
  );
}
