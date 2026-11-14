/**
 * LateFeeAutomation.jsx — Library Phase 3 Frontend
 *
 * Manages library overdue fines:
 *   - List all fines with status filters
 *   - Pay / waive individual fines
 *   - Create manual fines
 *   - Send bulk overdue reminders
 *
 * API: libraryAPI (book.api.js)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Send, Plus, X, Loader2, Search,
  CheckCircle2, XCircle, User,
} from 'lucide-react';
import { libraryAPI } from '../../../../services/api/book.api';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const FineStatusBadge = ({ status }) => {
  const map = {
    PENDING:  'bg-amber-100 text-amber-700',
    PAID:     'bg-emerald-100 text-emerald-700',
    WAIVED:   'bg-slate-100 text-slate-500',
    PARTIAL:  'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${map[status] || map.PENDING}`}>
      {status}
    </span>
  );
};

// ─── Waive Modal ──────────────────────────────────────────────────────────────
const WaiveModal = ({ fine, onClose, onSaved }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await libraryAPI.waiveFine(fine.id, notes);
      toast.success('Fine waived');
      onSaved();
    } catch (err) {
      toast.error(err?.message || 'Failed to waive fine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-medium text-slate-900">Waive Fine</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-slate-800">{fine.loan?.book?.title || fine.loan?.copy?.book?.title || 'Book fine'}</p>
            <p className="text-slate-500 text-xs">Member: {fine.member?.name || fine.memberId || '—'}</p>
            <p className="text-amber-700 font-medium">{KES(fine.amount)}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for waiving</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Enter reason…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Confirm Waive
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Manual Fine Modal ────────────────────────────────────────────────────────
const ManualFineModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ memberId: '', amount: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.memberId.trim() || !form.amount) return toast.error('Member ID and amount are required');
    setLoading(true);
    try {
      await libraryAPI.createManualFine({
        memberId: form.memberId.trim(),
        amount: parseFloat(form.amount),
        reason: form.reason.trim(),
      });
      toast.success('Fine created');
      onSaved();
    } catch (err) {
      toast.error(err?.message || 'Failed to create fine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-medium text-slate-900">Create Manual Fine</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Member ID / User ID</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={form.memberId} onChange={e => set('memberId', e.target.value)}
                placeholder="e.g. usr_abc123"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (KES)</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
              placeholder="e.g. Lost book penalty"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Fine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const LateFeeAutomation = () => {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [waiveFine, setWaiveFine] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [paying, setPaying] = useState(null);
  const searchTimeout = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await libraryAPI.getFines(params);
      setFines(res?.data || res || []);
    } catch {
      toast.error('Failed to load fines');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(load, 350);
    return () => clearTimeout(searchTimeout.current);
  }, [load]);

  const handlePay = async (fine) => {
    setPaying(fine.id);
    try {
      await libraryAPI.payFine(fine.id);
      toast.success('Fine marked as paid');
      load();
    } catch (err) {
      toast.error(err?.message || 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await libraryAPI.runAutomationJob('send-reminders');
      toast.success(res?.message || 'Overdue reminders sent');
    } catch (err) {
      toast.error(err?.message || 'Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSaved = () => {
    setWaiveFine(null);
    setShowManual(false);
    load();
  };

  const totalPending = fines
    .filter(f => f.status === 'PENDING')
    .reduce((s, f) => s + Number(f.amount || 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-slate-900">Late Fee Automation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {fines.filter(f => f.status === 'PENDING').length} pending fine{fines.filter(f => f.status === 'PENDING').length !== 1 ? 's' : ''} · {KES(totalPending)} outstanding
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSendReminders} disabled={sendingReminders}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
            {sendingReminders ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send Overdue Reminders
          </button>
          <button onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200">
            <Plus size={16} /> Manual Fine
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search by member or book…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
          {['PENDING', 'PAID', 'WAIVED', 'ALL'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 transition-colors ${statusFilter === s ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
      ) : fines.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <DollarSign size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No fines found</p>
          <p className="text-slate-400 text-sm mt-1">All clear! No outstanding fines matching your filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Book / Reason</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fines.map(fine => (
                <tr key={fine.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{fine.member?.name || fine.memberId || '—'}</p>
                    <p className="text-xs text-slate-400">{fine.member?.role || ''}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-700">{fine.loan?.book?.title || fine.loan?.copy?.book?.title || fine.reason || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${fine.status === 'PENDING' ? 'text-amber-600' : 'text-slate-600'}`}>
                      {KES(fine.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><FineStatusBadge status={fine.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">{fmt(fine.createdAt)}</td>
                  <td className="px-4 py-3">
                    {fine.status === 'PENDING' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handlePay(fine)} disabled={paying === fine.id}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Mark as Paid">
                          {paying === fine.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        </button>
                        <button onClick={() => setWaiveFine(fine)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Waive">
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {waiveFine && <WaiveModal fine={waiveFine} onClose={() => setWaiveFine(null)} onSaved={handleSaved} />}
      {showManual && <ManualFineModal onClose={() => setShowManual(false)} onSaved={handleSaved} />}
    </div>
  );
};

export default LateFeeAutomation;
