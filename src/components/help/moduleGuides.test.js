import { describe, expect, it } from 'vitest';
import { findModuleGuide } from './moduleGuides';

describe('module guide registry', () => {
  it('resolves the learner import guide for an administrator', () => {
    expect(findModuleGuide('system-maintenance', 'ADMIN')?.id).toBe('learner-import');
  });

  it('resolves teacher operational guides without exposing admin setup', () => {
    expect(findModuleGuide('attendance-daily', 'TEACHER')?.id).toBe('attendance');
    expect(findModuleGuide('settings-school', 'TEACHER')).toBeNull();
  });

  it('returns no launcher on an unrelated page', () => {
    expect(findModuleGuide('finance-dashboard', 'ADMIN')).toBeNull();
  });

  it('shows the biometric guide across every biometric tab route', () => {
    expect(findModuleGuide('biometric-dashboard', 'SUPER_ADMIN')?.id).toBe('biometric-attendance');
    expect(findModuleGuide('biometric-dashboard?tab=enrollment', 'ADMIN')?.id).toBe('biometric-attendance');
    expect(findModuleGuide('biometric-dashboard?tab=devices', 'ADMIN')?.id).toBe('biometric-attendance');
    expect(findModuleGuide('biometric-dashboard?tab=logs', 'SUPER_ADMIN')?.id).toBe('biometric-attendance');
    expect(findModuleGuide('biometric-dashboard?tab=config', 'SUPER_ADMIN')?.id).toBe('biometric-attendance');
  });

  it('keeps biometric administration instructions limited to biometric administrators', () => {
    expect(findModuleGuide('biometric-dashboard', 'HEAD_TEACHER')).toBeNull();
  });
});
