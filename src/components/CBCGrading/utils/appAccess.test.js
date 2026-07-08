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
    expect(getRequiredAppForPage('assess-summary-report')).toBe('gradebook');
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
    expect(hasPageAccess(user, 'attendance-configuration')).toBe(true);
    expect(hasPageAccess(user, 'inventory-items')).toBe(true);
    expect(hasPageAccess(user, 'assess-summative-report')).toBe(true);
  });

  it('allows super admins through every app gate', () => {
    expect(hasAppAccess({ role: 'SUPER_ADMIN' }, 'inventory')).toBe(true);
    expect(hasPageAccess({ role: 'SUPER_ADMIN' }, 'inventory-items')).toBe(true);
  });

  it('keeps the new LMS pages open for schools with the legacy LMS entitlement', () => {
    const user = { role: 'SUPER_ADMIN', enabledApps: ['lms'] };

    expect(hasAppAccess(user, 'lms-professional')).toBe(true);
    expect(hasPageAccess(user, 'learning-dashboard')).toBe(true);
    expect(hasPageAccess(user, 'learning-lessons')).toBe(true);
  });

  it('lets super admins open every settings page regardless of package modules', () => {
    const superAdmin = { role: 'SUPER_ADMIN', enabledApps: ['school-settings'] };
    const schoolAdmin = { role: 'ADMIN', enabledApps: ['school-settings'] };

    expect(hasPageAccess(superAdmin, 'settings-payment')).toBe(true);
    expect(hasPageAccess(superAdmin, 'settings-academic')).toBe(true);
    expect(hasPageAccess(superAdmin, 'settings-system-control')).toBe(true);
    expect(hasPageAccess(schoolAdmin, 'settings-payment')).toBe(false);
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
