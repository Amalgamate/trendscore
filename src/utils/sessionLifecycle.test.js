import { beforeEach, describe, expect, it } from 'vitest';
import {
  getInactivityLogoutMs,
  INACTIVITY_LOGOUT_MS,
  REMEMBERED_INACTIVITY_LOGOUT_MS,
} from './sessionLifecycle';

describe('session lifecycle duration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('uses the standard 24-hour inactivity limit for an unchecked login', () => {
    sessionStorage.setItem('authPersistence', 'session');
    expect(getInactivityLogoutMs()).toBe(INACTIVITY_LOGOUT_MS);
  });

  it('uses the full 30-day inactivity limit for a remembered login', () => {
    localStorage.setItem('authPersistence', 'remembered');
    expect(getInactivityLogoutMs()).toBe(REMEMBERED_INACTIVITY_LOGOUT_MS);
  });
});
