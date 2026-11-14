import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithAuth } from './core';
import { libraryAPI } from './book.api';

vi.mock('./core', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('Library reporting API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls dashboard, inventory, and category reports', async () => {
    await libraryAPI.getDashboardSummary();
    await libraryAPI.getInventoryReport({ category: 'History & Culture', status: 'AVAILABLE', search: '' });
    await libraryAPI.getCategoryReport();

    expect(fetchWithAuth).toHaveBeenNthCalledWith(1, '/library/reports/dashboard');
    expect(fetchWithAuth).toHaveBeenNthCalledWith(
      2,
      '/library/reports/inventory?category=History+%26+Culture&status=AVAILABLE'
    );
    expect(fetchWithAuth).toHaveBeenNthCalledWith(3, '/library/reports/categories');
  });

  it('calls copy audit, circulation, member, and overdue fine reports with supported filters', async () => {
    await libraryAPI.getCopyAuditReport();
    await libraryAPI.getCirculationReport({ from: '2026-01-01', to: '2026-01-31' });
    await libraryAPI.getMemberActivityReport({ status: 'ACTIVE', search: 'Amina', page: 2, limit: 25 });
    await libraryAPI.getOverdueFinesReport();

    expect(fetchWithAuth).toHaveBeenNthCalledWith(1, '/library/reports/copy-audit');
    expect(fetchWithAuth).toHaveBeenNthCalledWith(2, '/library/reports/circulation?from=2026-01-01&to=2026-01-31');
    expect(fetchWithAuth).toHaveBeenNthCalledWith(
      3,
      '/library/reports/members?status=ACTIVE&search=Amina&page=2&limit=25'
    );
    expect(fetchWithAuth).toHaveBeenNthCalledWith(4, '/library/reports/fines');
  });

  it('triggers an automation job with POST', async () => {
    await libraryAPI.runAutomationJob('send-reminders');

    expect(fetchWithAuth).toHaveBeenCalledWith('/library/automation/run/send-reminders', { method: 'POST' });
  });
});
