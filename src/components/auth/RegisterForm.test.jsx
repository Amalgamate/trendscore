import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterForm from './RegisterForm';

describe('registration entry point', () => {
  it('links to the school application and explains that account creation follows installation', () => {
    render(<RegisterForm />);

    expect(screen.getByRole('link', { name: /start school application/i })).toHaveAttribute('href', 'https://admin.trendscore.co.ke/apply');
    expect(screen.getByText(/does not create a school account or start an installation/i)).toBeInTheDocument();
    expect(screen.getByText(/one-time activation link/i)).toBeInTheDocument();
  });

  it('keeps the existing-account sign-in path available', () => {
    const onSwitchToLogin = vi.fn();
    render(<RegisterForm onSwitchToLogin={onSwitchToLogin} />);

    fireEvent.click(screen.getByRole('button', { name: /already have an account/i }));
    expect(onSwitchToLogin).toHaveBeenCalledOnce();
  });
});
