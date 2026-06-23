import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ParentProfile from './ParentProfile';

const { getById, uploadPhoto, sendCredentials } = vi.hoisted(() => ({
  getById: vi.fn(),
  uploadPhoto: vi.fn(),
  sendCredentials: vi.fn()
}));

vi.mock('../../../../services/api', () => ({
  default: {
    users: {
      getById,
      uploadPhoto,
      sendCredentials
    }
  }
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}));

vi.mock('../../shared/ProfileLayout', () => ({
  default: ({ children }) => <div>{children}</div>
}));

vi.mock('../../shared/ProfileHeader', () => ({
  default: ({ name, tabs = [], onTabChange }) => (
    <div>
      <div data-testid="profile-header-name">{name}</div>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}));

vi.mock('../../shared/ProfilePhotoModal', () => ({
  default: () => null
}));

describe('ParentProfile', () => {
  beforeEach(() => {
    getById.mockResolvedValue({
      success: true,
      data: {
        id: 'parent-1',
        firstName: 'Rico',
        middleName: 'Mwangi',
        lastName: 'Ahmed',
        phone: '0729876301',
        email: 'parent.0729876301@edu.test',
        learners: [
          { id: 'l1', firstName: 'Amina', lastName: 'Ahmed', admissionNumber: 'ADM001', grade: 'GRADE_4' },
          { id: 'l2', firstName: 'Yusuf', lastName: 'Ahmed', admissionNumber: 'ADM002', grade: 'GRADE_2' }
        ]
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates the parent name and linked learners from the API', async () => {
    render(
      <ParentProfile
        parent={{ id: 'parent-1', firstName: 'Rico', lastName: 'Ahmed' }}
        onBack={() => {}}
      />
    );

    await waitFor(() => expect(getById).toHaveBeenCalledWith('parent-1'));
    await waitFor(() => expect(screen.getByTestId('profile-header-name').textContent).toContain('Rico Mwangi Ahmed'));

    fireEvent.click(screen.getByRole('button', { name: 'Linked Students' }));

    await waitFor(() => expect(screen.getByText('Amina Ahmed')).toBeTruthy());
    expect(screen.getByText('Yusuf Ahmed')).toBeTruthy();
    expect(screen.getByText(/ADM001/)).toBeTruthy();
    expect(screen.getByText(/ADM002/)).toBeTruthy();
  });
});
