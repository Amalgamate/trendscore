import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthStorage,
  getAuthItem,
  isRememberedSession,
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
});
