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
    activeSlugs: ['biometric', 'student-registry'],
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

  it('exposes the complete student management menu', () => {
    const { result } = renderHook(() => useNavigation());
    const studentsSection = result.current.schoolSections.find((section) => section.id === 'learners');
    const leafIds = studentsSection.items.flatMap((item) => item.type === 'group' ? item.items.map((child) => child.id) : [item.id]);

    expect(leafIds).toEqual(expect.arrayContaining([
      'learners-overview',
      'learners-list',
      'learners-admissions',
      'learners-reports',
      'learners-transfers-in',
      'learners-transfer-out',
      'learners-exited',
      'learners-documents',
    ]));
  });
});
