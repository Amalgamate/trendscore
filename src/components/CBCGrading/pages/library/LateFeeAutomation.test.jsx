import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LateFeeAutomation from './LateFeeAutomation';

const { libraryAPI, toast } = vi.hoisted(() => ({
  libraryAPI: {
    getFines: vi.fn(),
    runAutomationJob: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../../../services/api/book.api', () => ({ libraryAPI }));
vi.mock('react-hot-toast', () => ({ default: toast }));

describe('LateFeeAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryAPI.getFines.mockResolvedValue({ data: [] });
    libraryAPI.runAutomationJob.mockResolvedValue({ message: 'Reminder job completed' });
  });

  it('uses the Library automation run-job endpoint to send overdue reminders', async () => {
    render(<LateFeeAutomation />);
    const button = await screen.findByRole('button', { name: /Send Overdue Reminders/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(libraryAPI.runAutomationJob).toHaveBeenCalledWith('send-reminders');
    });
    expect(toast.success).toHaveBeenCalledWith('Reminder job completed');
  });
});
