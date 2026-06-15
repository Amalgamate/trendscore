import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AdmissionsPage from './AdmissionsPage';

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'SUPER_ADMIN' } }),
}));

vi.mock('../hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

vi.mock('./steps/ParentGuardianStep', () => ({
  default: function MockParentGuardianStep({ formData, onChange }) {
    return (
      <div>
        <input
          name="guardianName"
          value={formData.guardianName || ''}
          onChange={(e) => onChange({ ...formData, guardianName: e.target.value })}
        />
        <input
          name="guardianPhone"
          value={formData.guardianPhone || ''}
          onChange={(e) => onChange({ ...formData, guardianPhone: e.target.value })}
        />
      </div>
    );
  },
}));

const {
  getStreamConfigs,
  getGrades,
  getNextAdmissionNumber,
} = vi.hoisted(() => ({
  getStreamConfigs: vi.fn(async () => ({ data: [{ id: 's1', name: 'A', active: true }] })),
  getGrades: vi.fn(async () => ({ data: ['GRADE_1', 'GRADE_2'] })),
  getNextAdmissionNumber: vi.fn(async () => ({ data: { nextAdmissionNumber: 'ADM1001' } })),
}));

vi.mock('../../../services/api', () => ({
  configAPI: {
    getStreamConfigs,
    getGrades,
  },
  learnerAPI: {
    getNextAdmissionNumber,
  },
}));

describe('AdmissionsPage Step 3 flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/png;base64,PHOTO';
        if (this.onloadend) this.onloadend();
      }
    };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('allows Step 3 photo upload and saves only on final submit', async () => {
    const onSave = vi.fn(async () => ({ success: true, data: { id: 'l1' } }));

    const { container, unmount } = render(<AdmissionsPage onSave={onSave} />);

    expect(getNextAdmissionNumber).toHaveBeenCalled();

    fireEvent.change(container.querySelector('[name="firstName"]'), { target: { value: 'Test' } });
    fireEvent.change(container.querySelector('[name="lastName"]'), { target: { value: 'Learner' } });
    fireEvent.change(container.querySelector('[name="gender"]'), { target: { value: 'MALE' } });
    fireEvent.change(container.querySelector('[name="dateOfBirth"]'), { target: { value: '2014-01-01' } });
    fireEvent.change(container.querySelector('[name="grade"]'), { target: { value: 'GRADE_1' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(container.querySelector('[name="guardianName"]')).toBeTruthy());

    fireEvent.change(container.querySelector('[name="guardianName"]'), { target: { value: 'Jane Guardian' } });
    fireEvent.change(container.querySelector('[name="guardianPhone"]'), { target: { value: '0712345678' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeTruthy());

    const localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    localStorageSetSpy.mockClear();
    vi.advanceTimersByTime(2500);
    expect(localStorageSetSpy).not.toHaveBeenCalled();

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['photo-bytes'], 'photo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /complete admission/i }));

    await vi.runAllTimersAsync();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      firstName: 'Test',
      lastName: 'Learner',
      grade: 'GRADE_1',
      photo: 'data:image/png;base64,PHOTO',
    });

    unmount();
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
  }, 60000);
});
