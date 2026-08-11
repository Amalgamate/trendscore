import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportHub from '../CBCGrading/pages/SupportHub';
import ModuleHelpAssistant from './ModuleHelpAssistant';

const biometricAdmin = {
  id: 'admin-1',
  role: 'SUPER_ADMIN',
  enabledApps: ['biometric'],
};

describe('biometric module help', () => {
  it('opens the module walkthrough from a biometric tab route', () => {
    const onNavigate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ModuleHelpAssistant
        currentPage="biometric-dashboard?tab=config"
        user={biometricAdmin}
        onNavigate={onNavigate}
        open
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByRole('heading', { name: 'Biometric Attendance' })).toBeInTheDocument();
    expect(screen.getByText('1. Confirm platform readiness')).toBeInTheDocument();
    expect(screen.getByText('7. Maintain access safely')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /detailed help/i }));

    expect(onNavigate).toHaveBeenCalledWith('help', {
      helpQuery: undefined,
      helpSection: 'biometrics',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens the complete biometric documentation section', () => {
    render(<SupportHub initialSection="biometrics" />);

    expect(screen.getByText('Module Overview and Readiness')).toBeInTheDocument();
    expect(screen.getByText('Registering and Activating a Phone Terminal')).toBeInTheDocument();
    expect(screen.getByText('Consent-Based Face Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Recording Face Attendance')).toBeInTheDocument();
    expect(screen.getByText('Manual Fallback and Offline Use')).toBeInTheDocument();
    expect(screen.getByText('Attendance Data Feed and Connection Testing')).toBeInTheDocument();
    expect(screen.getByText('Security and Terminal Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Rolling Out to Another School')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting Face Attendance')).toBeInTheDocument();
  });
});
