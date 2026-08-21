const AUTH_KEYS = ['token', 'refreshToken', 'user', 'authToken', 'trendscore_impersonation_access_token'];
const PERSISTENCE_KEY = 'authPersistence';
const IMPERSONATION_ACCESS_TOKEN_KEY = 'trendscore_impersonation_access_token';
const IMPERSONATION_MARKER_KEY = 'trendscore_impersonation_original_token';
const IMPERSONATION_KEY_PREFIX = 'trendscore_impersonation_';

function safeGet(storage, key) {
  try { return storage?.getItem(key) || null; } catch { return null; }
}

function safeSet(storage, key, value) {
  try {
    if (value === null || value === undefined) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

export function isRememberedSession() {
  return safeGet(localStorage, PERSISTENCE_KEY) === 'remembered';
}

export function getAuthItem(key) {
  return safeGet(sessionStorage, key) ?? safeGet(localStorage, key);
}

export function getImpersonationAccessToken() {
  return safeGet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY);
}

// Impersonation is deliberately tab-scoped. The access token already lives in
// sessionStorage; keeping its marker in localStorage made unrelated admin tabs
// suppress their own bearer token and authenticate with the shared cookie.
// Migrate an active legacy session only in the tab that owns its access token.
export function migrateLegacyImpersonationSession() {
  if (!safeGet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY)) return false;
  if (safeGet(sessionStorage, IMPERSONATION_MARKER_KEY)) return true;
  if (!safeGet(localStorage, IMPERSONATION_MARKER_KEY)) return false;

  Object.keys(localStorage)
    .filter((key) => key.startsWith(IMPERSONATION_KEY_PREFIX))
    .forEach((key) => {
      safeSet(sessionStorage, key, safeGet(localStorage, key));
      safeSet(localStorage, key, null);
    });
  return Boolean(safeGet(sessionStorage, IMPERSONATION_MARKER_KEY));
}

export function setImpersonationAccessToken(token) {
  safeSet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY, token);
}

export function clearImpersonationAccessToken() {
  safeSet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY, null);
}

export function hasImpersonationSession() {
  const hasAccessToken = Boolean(safeGet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY));
  if (!hasAccessToken) return false;

  return Boolean(safeGet(sessionStorage, IMPERSONATION_MARKER_KEY))
    || migrateLegacyImpersonationSession();
}

export function setAuthItem(key, value) {
  const target = isRememberedSession() ? localStorage : sessionStorage;
  const other = target === localStorage ? sessionStorage : localStorage;
  safeSet(other, key, null);
  safeSet(target, key, value);
}

export function storeAuthSession({ token, refreshToken, user, rememberMe }) {
  const target = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  AUTH_KEYS.forEach(key => safeSet(other, key, null));
  safeSet(sessionStorage, PERSISTENCE_KEY, rememberMe ? null : 'session');
  safeSet(localStorage, PERSISTENCE_KEY, rememberMe ? 'remembered' : null);
  safeSet(target, 'token', token);
  safeSet(target, 'refreshToken', refreshToken || null);
  safeSet(target, 'user', JSON.stringify(user));
}

export function clearAuthStorage() {
  AUTH_KEYS.forEach(key => {
    safeSet(localStorage, key, null);
    safeSet(sessionStorage, key, null);
  });
  safeSet(localStorage, PERSISTENCE_KEY, null);
  safeSet(sessionStorage, PERSISTENCE_KEY, null);
}
