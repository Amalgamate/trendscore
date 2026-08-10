import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigation } from './useNavigation';

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    role: 'SUPER_ADMIN',
    isRole: (role) => role === 'SUPER_ADMIN',
  }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { role: 'SUPER_ADMIN', institutionType: 'PRIMARY_CBC' },
    institutionType: 'PRIMARY_CBC',
  }),
}));

vi.mock('../../../hooks/useInstitutionLabels', () => ({
  useInstitutionLabels: () => ({ students: 'Scholars', teachers: 'Tutors' }),
}));

vi.mock('../../../contexts/ModuleAccessContext', () => ({
  useModuleAccess: () => ({
    activeSlugs: ['biometric'],
    isModuleEnabled: () => true,
  }),
}));

describe('useNavigation biometric access', () => {
  it('shows the enabled biometric section to a primary-school super admin', () => {
    const { result } = renderHook(() => useNavigation());
    const biometricSection = result.current.backOfficeSections.find(
      (section) => section.id === 'biometric',
    );

    expect(biometricSection).toBeDefined();
    expect(biometricSection.items.map((item) => item.id)).toEqual(expect.arrayContaining([
      'biometric-dashboard',
      'biometric-devices',
      'biometric-logs',
      'biometric-api',
    ]));
  });
});
