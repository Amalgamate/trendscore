import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schoolAPI } from '../services/api';
import { ModuleAccessProvider, useModuleAccess } from './ModuleAccessContext';

vi.mock('../services/api', () => ({
  schoolAPI: {
    getModules: vi.fn(),
  },
}));

describe('ModuleAccessProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }) => (
    <ModuleAccessProvider user={{ role: 'ADMIN' }}>{children}</ModuleAccessProvider>
  );

  it('denies module access when the loaded configuration has no active apps', async () => {
    schoolAPI.getModules.mockResolvedValue({
      success: true,
      data: { modules: [], activeSlugs: [] },
    });
    const { result } = renderHook(() => useModuleAccess(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isModuleEnabled('library')).toBe(false);
  });

  it('denies module access when loading the configuration fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    schoolAPI.getModules.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useModuleAccess(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isModuleEnabled('library')).toBe(false);
    expect(warning).toHaveBeenCalledWith(
      '[ModuleAccess] Failed to load module config; module access is disabled.',
      expect.any(Error),
    );
    warning.mockRestore();
  });

  it('retains the legacy LMS alias when the legacy module is active', async () => {
    schoolAPI.getModules.mockResolvedValue({
      success: true,
      data: { modules: [{ slug: 'lms' }], activeSlugs: ['lms'] },
    });
    const { result } = renderHook(() => useModuleAccess(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isModuleEnabled('lms-professional')).toBe(true);
  });
});
