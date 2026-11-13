import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schoolAPI } from '../../../../services/api';
import ModuleSettingsPage from './ModuleSettingsPage';

const mocks = vi.hoisted(() => ({
  refreshModules: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../../../contexts/ModuleAccessContext', () => ({
  useModuleAccess: () => ({ refreshModules: mocks.refreshModules }),
}));

vi.mock('../../../../services/api', () => ({
  schoolAPI: {
    getModules: vi.fn(),
    updateModules: vi.fn(),
    applyModulePackage: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: mocks.toast,
}));

describe('ModuleSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolAPI.getModules.mockResolvedValue({
      success: true,
      data: {
        modules: [{
          slug: 'library',
          name: 'Library',
          category: 'Operations',
          description: 'Library services',
          isActive: true,
          isVisible: false,
          isMandatory: false,
        }],
        packages: {},
      },
    });
    schoolAPI.updateModules.mockResolvedValue({ success: true, data: { modules: [] } });
  });

  it('allows a hidden module to be made visible and saves the visibility change', async () => {
    render(<ModuleSettingsPage />);

    const showButton = await screen.findByRole('button', { name: 'Show Library in navigation' });
    fireEvent.click(showButton);
    expect(screen.getByRole('button', { name: 'Hide Library in navigation' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(schoolAPI.updateModules).toHaveBeenCalledWith({
      modules: [{
        slug: 'library',
        isActive: true,
        isVisible: true,
      }],
    }));
    expect(mocks.refreshModules).toHaveBeenCalled();
    expect(mocks.toast.success).toHaveBeenCalledWith('Module configuration saved');
  });
});
