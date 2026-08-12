import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnrollmentDashboard from './EnrollmentDashboard';
import { learnerAPI } from '../../../../services/api/learner.api';
import { userAPI } from '../../../../services/api/user.api';

vi.mock('../../../../services/api/learner.api', () => ({
  learnerAPI: { getAll: vi.fn() },
}));

vi.mock('../../../../services/api/user.api', () => ({
  userAPI: { getAll: vi.fn() },
}));

vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { institutionType: 'PRIMARY_CBC' } }),
}));

vi.mock('../../../../services/schoolContext', () => ({
  getSelectedInstitutionType: () => 'PRIMARY_CBC',
}));

describe('biometric enrollment directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    learnerAPI.getAll.mockResolvedValue({
      data: [{ id: 'learner-1', firstName: 'Habiba', lastName: 'Wario', admissionNumber: 'ADM-1', grade: 'GRADE_9_A' }],
    });
    userAPI.getAll.mockResolvedValue({ data: [] });
  });

  it('loads the first learner page when the enrollment tab opens', async () => {
    render(<EnrollmentDashboard />);

    expect(await screen.findByText('Habiba Wario')).toBeInTheDocument();
    expect(learnerAPI.getAll).toHaveBeenCalledWith({ limit: 50 });
  });

  it('normalizes the staff response envelope when switching directories', async () => {
    userAPI.getAll.mockResolvedValue({
      data: [{ id: 'staff-1', firstName: 'Amina', lastName: 'Ali', staffId: 'STAFF-1', role: 'TEACHER' }],
    });
    render(<EnrollmentDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /staff/i }));

    await waitFor(() => expect(screen.getByText('Amina Ali')).toBeInTheDocument());
    expect(userAPI.getAll).toHaveBeenCalledWith({ limit: 50 });
  });
});
