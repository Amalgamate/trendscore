import { describe, expect, it } from 'vitest';
import {
  getActiveModuleSlugs,
  isStarterPackageApps,
  isStarterPackageModules,
} from './packageAccess';

describe('packageAccess', () => {
  it('recognizes starter active slugs even when fee management is present', () => {
    expect(isStarterPackageApps([
      'student-registry',
      'attendance',
      'gradebook',
      'school-settings',
      'fee-management',
    ])).toBe(true);
  });

  it('does not treat standard-or-higher module sets as starter', () => {
    expect(isStarterPackageApps([
      'student-registry',
      'attendance',
      'gradebook',
      'school-settings',
      'fee-management',
      'transport',
    ])).toBe(false);
  });

  it('recognizes starter package module rows directly', () => {
    const modules = [
      { slug: 'student-registry', isActive: true, isVisible: true },
      { slug: 'attendance', isActive: true, isVisible: true },
      { slug: 'gradebook', isActive: true, isVisible: true },
      { slug: 'school-settings', isActive: true, isVisible: true },
      { slug: 'transport', isActive: false, isVisible: true },
    ];

    expect(getActiveModuleSlugs(modules)).toEqual([
      'student-registry',
      'attendance',
      'gradebook',
      'school-settings',
    ]);
    expect(isStarterPackageModules(modules)).toBe(true);
  });
});
