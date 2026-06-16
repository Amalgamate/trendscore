import { describe, expect, it } from 'vitest';
import {
  getRequiredAppForPage,
  hasAppAccess,
  hasPageAccess,
  isParentPortalPage,
  resolveDashboardPage,
  userHasParentPortalAccess,
} from './appAccess';

describe('appAccess', () => {
  it('maps guarded pages to the correct app slug', () => {
    expect(getRequiredAppForPage('planner-calendar')).toBe('planner');
    expect(getRequiredAppForPage('planner-timetable')).toBe('timetable');
    expect(getRequiredAppForPage('assess-summative-report')).toBe('exams');
    expect(getRequiredAppForPage('inventory-items')).toBe('inventory');
  });

  it('treats unknown pages as unrestricted', () => {
    expect(getRequiredAppForPage('dashboard')).toBeNull();
    expect(hasPageAccess({ role: 'ADMIN' }, 'dashboard')).toBe(true);
  });

  it('keeps legacy app gates open for every user', () => {
    const user = { role: 'ADMIN' };
    expect(hasAppAccess(user, 'inventory')).toBe(true);
    expect(hasPageAccess(user, 'learners-list')).toBe(true);
    expect(hasPageAccess(user, 'attendance-daily')).toBe(true);
    expect(hasPageAccess(user, 'inventory-items')).toBe(true);
    expect(hasPageAccess(user, 'assess-summative-report')).toBe(true);
  });

  it('allows super admins through every app gate', () => {
    expect(hasAppAccess({ role: 'SUPER_ADMIN' }, 'inventory')).toBe(true);
    expect(hasPageAccess({ role: 'SUPER_ADMIN' }, 'inventory-items')).toBe(true);
  });

  it('isolates parent portal pages to parent users or explicit parent permissions', () => {
    expect(isParentPortalPage('parent-portal-home')).toBe(true);
    expect(hasPageAccess({ role: 'PARENT' }, 'parent-portal-home')).toBe(true);
    expect(hasPageAccess({ role: 'TEACHER' }, 'parent-portal-home')).toBe(false);
    expect(hasPageAccess({ role: 'ADMIN' }, 'parent-portal-fees')).toBe(false);
    expect(hasPageAccess({ role: 'ACCOUNTANT' }, 'parent-portal-results')).toBe(false);
    expect(hasPageAccess({ role: 'TEACHER', permissions: ['VIEW_OWN_CHILDREN'] }, 'parent-portal-home')).toBe(true);
  });

  it('resolves role landing pages without defaulting staff to the parent portal', () => {
    expect(resolveDashboardPage({ role: 'PARENT' })).toBe('parent-portal-home');
    expect(resolveDashboardPage({ role: 'ACCOUNTANT' })).toBe('finance-dashboard');
    expect(resolveDashboardPage({ role: 'STUDENT' })).toBe('dashboard');
    expect(resolveDashboardPage({ role: 'TEACHER' })).toBe('dashboard');
    expect(resolveDashboardPage({ role: 'ADMIN' })).toBe('dashboard');
    expect(userHasParentPortalAccess({ role: 'ADMIN' })).toBe(false);
  });
});
