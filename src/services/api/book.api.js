// Vite Cache Buster
import { fetchWithAuth } from './core';

const qs = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const str = new URLSearchParams(clean).toString();
  return str ? `?${str}` : '';
};

export const libraryAPI = {
  // ── Books ─────────────────────────────────────────────────────────────────
  getBooks: (params = {}) => fetchWithAuth(`/library/books${qs(params)}`),
  getBook:  (id)          => fetchWithAuth(`/library/books/${id}`),
  createBook: (data)      => fetchWithAuth('/library/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id, data)  => fetchWithAuth(`/library/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBook: (id)        => fetchWithAuth(`/library/books/${id}`, { method: 'DELETE' }),

  // ── Book copies ──────────────────────────────────────────────────────────
  getBookCopies:  (bookId, params = {}) => fetchWithAuth(`/library/books/${bookId}/copies${qs(params)}`),
  createBookCopy: (bookId, data)        => fetchWithAuth(`/library/books/${bookId}/copies`, { method: 'POST', body: JSON.stringify(data) }),
  updateBookCopy: (id, data)            => fetchWithAuth(`/library/copies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBookCopy: (id)                  => fetchWithAuth(`/library/copies/${id}`, { method: 'DELETE' }),
  reserveBookCopy:(id)                  => fetchWithAuth(`/library/copies/${id}/reserve`, { method: 'POST' }),

  // ── Members ──────────────────────────────────────────────────────────────
  getMembers:         (params = {})    => fetchWithAuth(`/library/members${qs(params)}`),
  getMember:          (userId)         => fetchWithAuth(`/library/members/${userId}`),
  getMemberHistory:   (userId, params) => fetchWithAuth(`/library/members/${userId}/history${qs(params)}`),
  createMember:       (userId, data)   => fetchWithAuth(`/library/members/${userId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateMember:       (userId, data)   => fetchWithAuth(`/library/members/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── Loans ────────────────────────────────────────────────────────────────
  getLoans:        (params = {})  => fetchWithAuth(`/library/loans${qs(params)}`),
  borrowBook:      (data)         => fetchWithAuth('/library/loans/borrow', { method: 'POST', body: JSON.stringify(data) }),
  borrowForMember: (data)         => fetchWithAuth('/library/loans/borrow-for-member', { method: 'POST', body: JSON.stringify(data) }),
  borrowByScan:    (data)         => fetchWithAuth('/library/loans/borrow/scan', { method: 'POST', body: JSON.stringify(data) }),
  returnBook:      (loanId, data) => fetchWithAuth(`/library/loans/${loanId}/return`, { method: 'POST', body: JSON.stringify(data) }),
  renewLoan:       (loanId, data) => fetchWithAuth(`/library/loans/${loanId}/renew`, { method: 'POST', body: JSON.stringify(data) }),

  // ── Fines ────────────────────────────────────────────────────────────────
  getFines:           (params = {})  => fetchWithAuth(`/library/fines${qs(params)}`),
  createManualFine:   (data)         => fetchWithAuth('/library/fines/manual', { method: 'POST', body: JSON.stringify(data) }),
  payFine:            (id)           => fetchWithAuth(`/library/fines/${id}/pay`, { method: 'POST' }),
  waiveFine:          (id, notes)    => fetchWithAuth(`/library/fines/${id}/waive`, { method: 'POST', body: JSON.stringify({ notes }) }),
  sendOverdueReminders: ()           => fetchWithAuth('/library/reports/send-overdue-reminders', { method: 'POST' }),

  // ── Reports ──────────────────────────────────────────────────────────────
  getStats:        ()              => fetchWithAuth('/library/reports/stats'),
  getPopularBooks: (limit = 10)   => fetchWithAuth(`/library/reports/popular?limit=${limit}`),
  getOverdueLoans: ()             => fetchWithAuth('/library/reports/overdue'),

  // ── Library automation & detailed reports ───────────────────────────────
  runAutomationJob: (job) => fetchWithAuth(`/library/automation/run/${encodeURIComponent(job)}`, { method: 'POST' }),
  getInventoryReport: (params = {}) => fetchWithAuth(`/library/reports/inventory${qs(params)}`),
  getCategoryReport: () => fetchWithAuth('/library/reports/categories'),
  getCopyAuditReport: () => fetchWithAuth('/library/reports/copy-audit'),
  getCirculationReport: (params = {}) => fetchWithAuth(`/library/reports/circulation${qs(params)}`),
  getMemberActivityReport: (params = {}) => fetchWithAuth(`/library/reports/members${qs(params)}`),
  getOverdueFinesReport: () => fetchWithAuth('/library/reports/fines'),
  getDashboardSummary: () => fetchWithAuth('/library/reports/dashboard'),
};

// Keep legacy bookAPI alias so existing index.js reference doesn't break
export const bookAPI = libraryAPI;
