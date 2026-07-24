import { describe, expect, it } from 'vitest';
import { findRoleOnboarding } from './roleOnboardingJourneys';

describe('role onboarding journeys', () => {
  it('resolves administrator variants on the dashboard', () => {
    expect(findRoleOnboarding('SUPER_ADMIN', 'dashboard')?.id).toBe('administrator-start');
    expect(findRoleOnboarding('ADMIN', 'dashboard')?.id).toBe('administrator-start');
    expect(findRoleOnboarding('HEAD_TEACHER', 'dashboard')?.id).toBe('administrator-start');
  });
  it('resolves teacher and accountant landing journeys', () => {
    expect(findRoleOnboarding('TEACHER', 'dashboard')?.id).toBe('teacher-start');
    expect(findRoleOnboarding('ACCOUNTANT', 'finance-dashboard')?.id).toBe('accountant-start');
  });
  it('does not display a role journey away from its landing page', () => {
    expect(findRoleOnboarding('ADMIN', 'learners-list')).toBeNull();
  });
});
