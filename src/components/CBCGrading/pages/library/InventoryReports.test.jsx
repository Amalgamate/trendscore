import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryReports from './InventoryReports';

const { libraryAPI } = vi.hoisted(() => ({
  libraryAPI: {
    getDashboardSummary: vi.fn(),
    getInventoryReport: vi.fn(),
    getCategoryReport: vi.fn(),
    getCopyAuditReport: vi.fn(),
    getCirculationReport: vi.fn(),
    getMemberActivityReport: vi.fn(),
    getOverdueFinesReport: vi.fn(),
    getPopularBooks: vi.fn(),
    getOverdueLoans: vi.fn(),
  },
}));

vi.mock('../../../../services/api/book.api', () => ({ libraryAPI }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

describe('InventoryReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryAPI.getDashboardSummary.mockResolvedValue({
      data: {
        books: { total: 42, totalCopies: 80, availableCopies: 60 },
        loans: { active: 12, overdue: 3 },
        members: { total: 30, active: 27 },
        fines: { totalPaidThisMonth: 1500, totalUnpaidAmount: 425 },
      },
    });
    libraryAPI.getInventoryReport.mockResolvedValue({
      data: [{
        id: 'book-1',
        title: 'The River Between',
        author: 'Ngũgĩ wa Thiong’o',
        status: 'AVAILABLE',
        totalCopies: 5,
        availableCopies: 4,
        borrowedCopies: 1,
        damagedCopies: 0,
        lostCopies: 0,
        allTimeLoanCount: 20,
      }],
    });
    libraryAPI.getCirculationReport.mockResolvedValue({
      data: [{ date: '2026-01-05', newLoans: 4, returns: 2, renewals: 1, overdueMarked: 0 }],
    });
    libraryAPI.getMemberActivityReport.mockRejectedValue(new Error('Permission denied'));
  });

  it('adapts the nested dashboard response to the existing overview cards', async () => {
    render(<InventoryReports />);

    await waitFor(() => expect(screen.getAllByText('42').length).toBeGreaterThan(0));
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Summary/ }));
    expect(screen.getByText('Fines Collected This Month')).toBeInTheDocument();
    expect(screen.getByText('KES 1,500.00')).toBeInTheDocument();
  });

  it('renders report rows using the new report response contracts', async () => {
    render(<InventoryReports />);

    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(await screen.findByText('The River Between')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(libraryAPI.getInventoryReport).toHaveBeenCalledWith();

    fireEvent.click(screen.getByRole('button', { name: 'Circulation' }));
    expect(await screen.findByText('2026-01-05')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(libraryAPI.getCirculationReport).toHaveBeenCalledWith();
  });

  it('surfaces report request failures instead of treating them as empty data', async () => {
    render(<InventoryReports />);
    fireEvent.click(screen.getByRole('button', { name: 'Members' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
  });
});
