import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthStorage,
  getAuthItem,
  hasImpersonationSession,
  isRememberedSession,
  migrateLegacyImpersonationSession,
  setAuthItem,
  storeAuthSession,
} from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps an unchecked login in browser-session storage only', () => {
    storeAuthSession({
      token: 'session-access',
      refreshToken: 'session-refresh',
      user: { id: 'user-1' },
      rememberMe: false,
    });

    expect(sessionStorage.getItem('token')).toBe('session-access');
    expect(localStorage.getItem('token')).toBeNull();
    expect(getAuthItem('refreshToken')).toBe('session-refresh');
    expect(isRememberedSession()).toBe(false);
  });

  it('keeps a remembered login in persistent storage only', () => {
    storeAuthSession({
      token: 'remembered-access',
      refreshToken: 'remembered-refresh',
      user: { id: 'user-2' },
      rememberMe: true,
    });

    expect(localStorage.getItem('token')).toBe('remembered-access');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(getAuthItem('refreshToken')).toBe('remembered-refresh');
    expect(isRememberedSession()).toBe(true);
  });

  it('keeps rotated tokens in the current session scope and clears both stores', () => {
    storeAuthSession({ token: 'one', refreshToken: 'two', user: { id: 'user-3' }, rememberMe: false });
    setAuthItem('token', 'rotated');

    expect(sessionStorage.getItem('token')).toBe('rotated');
    expect(localStorage.getItem('token')).toBeNull();

    clearAuthStorage();
    expect(getAuthItem('token')).toBeNull();
    expect(getAuthItem('user')).toBeNull();
  });

  it('does not treat another tab legacy marker as this tab impersonating', () => {
    localStorage.setItem('trendscore_impersonation_original_token', 'other-tab-admin');

    expect(hasImpersonationSession()).toBe(false);
    expect(localStorage.getItem('trendscore_impersonation_original_token')).toBe('other-tab-admin');
  });

  it('does not suppress admin authentication while impersonation is only being prepared', () => {
    sessionStorage.setItem('trendscore_impersonation_original_token', 'saved-admin');

    expect(hasImpersonationSession()).toBe(false);
  });

  it('migrates a legacy impersonation session only when this tab owns its token', () => {
    localStorage.setItem('trendscore_impersonation_original_token', 'saved-admin');
    localStorage.setItem('trendscore_impersonation_original_user', '{"id":"admin-1"}');
    sessionStorage.setItem('trendscore_impersonation_access_token', 'impersonation-token');

    expect(migrateLegacyImpersonationSession()).toBe(true);
    expect(hasImpersonationSession()).toBe(true);
    expect(sessionStorage.getItem('trendscore_impersonation_original_token')).toBe('saved-admin');
    expect(sessionStorage.getItem('trendscore_impersonation_original_user')).toBe('{"id":"admin-1"}');
    expect(localStorage.getItem('trendscore_impersonation_original_token')).toBeNull();
  });
});
