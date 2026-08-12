const AUTH_KEYS = ['token', 'refreshToken', 'user', 'authToken', 'trendscore_impersonation_access_token'];
const PERSISTENCE_KEY = 'authPersistence';
const IMPERSONATION_ACCESS_TOKEN_KEY = 'trendscore_impersonation_access_token';
const IMPERSONATION_MARKER_KEY = 'trendscore_impersonation_original_token';

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

export function setImpersonationAccessToken(token) {
  safeSet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY, token);
}

export function clearImpersonationAccessToken() {
  safeSet(sessionStorage, IMPERSONATION_ACCESS_TOKEN_KEY, null);
}

export function hasImpersonationSession() {
  return Boolean(safeGet(localStorage, IMPERSONATION_MARKER_KEY));
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
