import { resetMobileOnboardingForLogout } from './mobileOnboardingStorage';

export const SESSION_POLL_INTERVAL_MS = 30_000;
export const INACTIVITY_LOGOUT_MS = 24 * 60 * 60 * 1000;

export function clearAuthAndRedirect(reason = 'expired') {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('authToken');
  localStorage.removeItem('selectedInstitutionType');

  document.cookie = 'accessToken=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = 'refreshToken=; Max-Age=0; path=/; SameSite=Lax';

  resetMobileOnboardingForLogout();

  if (reason === 'forced') {
    sessionStorage.setItem('session_expired', 'forced_logout');
  } else if (reason === 'inactivity') {
    sessionStorage.setItem('session_expired', 'inactivity');
  } else {
    sessionStorage.setItem('session_expired', '1');
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
