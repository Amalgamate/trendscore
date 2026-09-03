/**
 * TransportFeeManager.jsx
 * Transport-specific fee collection view.
 *
 * Shows every learner with isTransportStudent=true, their open invoice's
 * transport portion (transportBilled / transportPaid / transportBalance),
 * and lets admins record a transport payment, send SMS/WhatsApp reminders,
 * and filter by route or payment status.
 *
 * Data sources:
 *   GET /transport/summary           — overall KPIs
 *   GET /transport/routes            — for route filter
 *   GET /fees/invoices?transportOnly=true  — transport invoices
 *   POST /fees/payments              — record payment (reuses existing fee endpoint)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, Send, FileText, Clock, AlertCircle,
  FileCheck2, ShieldCheck, TrendingUp, Download,
  X, Loader2, RefreshCw, CreditCard, Bus,
  Search, Filter, Phone, User, Pencil
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import usePageNavigation from '../../../../hooks/usePageNavigation';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt  = (n) => `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
const pct  = (paid, billed) => (billed > 0 ? Math.round((paid / billed) * 100) : 0);

function StatusBadge({ status }) {
  const map = {
    PAID:    'bg-emerald-100 text-emerald-700',
    PARTIAL: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-amber-100 text-amber-700',
    OVERDUE: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || map.PENDING}`}>
      {status}
    </span>
  );
}

function MiniBar({ paid, billed }) {
  const p = pct(paid, billed);
  const color = p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

// ─── Record Payment modal ─────────────────────────────────────────────────────

function PaymentModal({ invoice, learner, onClose, onSaved }) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState('MPESA');
  const [ref, setRef]           = useState('');
  const [saving, setSaving]     = useState(false);
  const { showSuccess, showError } = useNotifications();

  const balance = Number(invoice?.transportBalance ?? invoice?.balance ?? 0);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await api.fees.recordPayment({
        invoiceId:       invoice.id,
        amount:          Number(amount),
        transportAmount: Math.min(Number(amount), balance),
        paymentMethod:   method,
        referenceNumber: ref || undefined,
        notes:           'Transport fee payment'
      });
      showSuccess('Payment recorded');
      onSaved();
      onClose();
    } catch (err) {
      showError(err?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-base">{learner?.firstName} {learner?.lastName}</p>
              <p className="text-blue-100 text-xs mt-0.5">{learner?.admissionNumber} · Transport Payment</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Balance info */}
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div>
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Transport Balance</p>
              <p className="text-xl font-semibold text-amber-700 mt-0.5">{fmt(balance)}</p>
            </div>
            <AlertCircle size={20} className="text-amber-400" />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Amount (KES) <span className="text-red-400">*</span></label>
            <input className={inputCls} type="number" min="1" step="0.01" max={balance}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max ${Number(balance).toLocaleString()}`} />
            <button onClick={() => setAmount(String(balance))}
              className="mt-1.5 text-[11px] text-blue-600 font-medium hover:underline">
              Pay full balance ({fmt(balance)})
            </button>
          </div>

          {/* Method */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Payment Method</label>
            <select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}>
              {['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE'].map(m => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Reference / Transaction ID</label>
            <input className={inputCls} value={ref} onChange={e => setRef(e.target.value)}
              placeholder="Optional — M-Pesa code, cheque number…" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const TransportFeeManager = ({ onEditLearner, onViewLearner }) => {
  const [invoices, setInvoices]       = useState([]);
  const [routes, setRoutes]           = useState([]);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [payModal, setPayModal]       = useState(null); // { invoice, learner }
  const [exporting, setExporting]     = useState(false);
  const { showSuccess, showError }    = useNotifications();
  const navigateTo                    = usePageNavigation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, routeRes, sumRes] = await Promise.all([
        api.fees.getAllInvoices({ isTransport: 'true', limit: 500 }),
        api.transport.getRoutes(),
        api.transport.getSummary(),
      ]);
      setInvoices(invRes.data || []);
      if (routeRes.success) setRoutes(routeRes.data);
      if (sumRes.success)   setSummary(sumRes.data);
    } catch {
      showError('Failed to load transport fee data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtering
  const filtered = React.useMemo(() => {
    return invoices.filter(inv => {
      const name = `${inv.learner?.firstName || ''} ${inv.learner?.lastName || ''}`.toLowerCase();
      const adm  = (inv.learner?.admissionNumber || '').toLowerCase();
      const q    = query.toLowerCase();
      const matchQ = !q || name.includes(q) || adm.includes(q);

      // route filter: check learner's transport assignment
      const matchRoute = filterRoute === 'all' ||
        (inv.learner?.transportAssignments || []).some(a => a.routeId === filterRoute);

      const transportStatus = Number(inv.transportBalance) <= 0 ? 'PAID'
        : Number(inv.transportPaid) > 0 ? 'PARTIAL'
        : inv.dueDate && new Date(inv.dueDate) < new Date() ? 'OVERDUE'
        : 'PENDING';

      const matchStatus = filterStatus === 'all' || transportStatus === filterStatus;
      return matchQ && matchRoute && matchStatus;
    });
  }, [invoices, query, filterRoute, filterStatus]);

  // KPIs from summary or computed
  const { totalBilled, totalCollected, totalOutstanding, collectionRate } = React.useMemo(() => {
    const billed      = invoices.reduce((s, i) => s + Number(i.transportBilled  || 0), 0);
    const collected   = invoices.reduce((s, i) => s + Number(i.transportPaid    || 0), 0);
    const outstanding = invoices.reduce((s, i) => s + Number(i.transportBalance || 0), 0);
    const rate        = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    
    return {
      totalBilled: billed,
      totalCollected: collected,
      totalOutstanding: outstanding,
      collectionRate: rate
    };
  }, [invoices]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [
        ['Student', 'Adm No', 'Grade', 'Route', 'Billed', 'Paid', 'Balance', 'Status'],
        ...filtered.map(inv => {
          const ts = Number(inv.transportBalance) <= 0 ? 'PAID'
            : Number(inv.transportPaid) > 0 ? 'PARTIAL' : 'PENDING';
          return [
            `${inv.learner?.firstName} ${inv.learner?.lastName}`,
            inv.learner?.admissionNumber || '',
            inv.learner?.grade?.replace(/_/g, ' ') || '',
            '',
            Number(inv.transportBilled).toFixed(2),
            Number(inv.transportPaid).toFixed(2),
            Number(inv.transportBalance).toFixed(2),
            ts
          ];
        })
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `transport_fees_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
      showSuccess('Exported');
    } catch {
      showError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Transport</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <CreditCard className="text-blue-600" size={28} />
            Transport Fee Manager
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Track and collect transport fees for all enrolled bus students
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
          <button
            onClick={() => navigateTo('transport-routes')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
            <Bus size={15} />
            Transport Manager
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Total Billed — Indigo */}
        <div className="relative overflow-hidden rounded-2xl bg-indigo-600 p-5 shadow-lg shadow-indigo-500/20 text-white transition-all duration-200 hover:scale-[1.03]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-indigo-200 mb-1">Expected Income</p>
              <p className="text-2xl font-medium">{fmt(totalBilled)}</p>
              <p className="text-sm font-semibold text-indigo-300 mt-1">{summary?.transportStudentCount ?? invoices.length} Students</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <FileText size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Outstanding — Red */}
        <div className="relative overflow-hidden rounded-2xl bg-red-600 p-5 shadow-lg shadow-red-500/20 text-white transition-all duration-200 hover:scale-[1.03]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-red-100 mb-1">Total Outstanding</p>
              <p className="text-2xl font-medium">{fmt(totalOutstanding)}</p>
              <p className="text-sm font-semibold text-red-200 mt-1">Pending Collection</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <Clock size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Total Collected — Emerald */}
        <div className="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 shadow-lg shadow-emerald-500/20 text-white transition-all duration-200 hover:scale-[1.03]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-100 mb-1">Total Collected</p>
              <p className="text-2xl font-medium">{fmt(totalCollected)}</p>
              <p className="text-sm font-semibold text-emerald-200 mt-1">Payments Received</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <FileCheck2 size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Efficiency — Purple */}
        <div className="relative overflow-hidden rounded-2xl bg-purple-600 p-5 shadow-lg shadow-purple-500/20 text-white transition-all duration-200 hover:scale-[1.03]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-purple-100 mb-1">Collection Progress</p>
              <p className="text-2xl font-medium">{collectionRate}%</p>
              <p className="text-sm font-semibold text-purple-200 mt-1">Efficiency Rate</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <ShieldCheck size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>
      </div>

      {/* Collection rate bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between text-sm font-semibold text-gray-600 mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-500" />
            Collection Rate
          </div>
          <span className={collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 50 ? 'text-amber-600' : 'text-red-500'}>
            {collectionRate}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all ${collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${collectionRate}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-1.5">
          <span>Collected: {fmt(totalCollected)}</span>
          <span>Target: {fmt(totalBilled)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search student name or admission number…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
        </div>

        {/* Route filter */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Filter size={12} />
          <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="all">All Routes</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {[['all', 'All'], ['PAID', 'Paid'], ['PARTIAL', 'Partial'], ['PENDING', 'Pending'], ['OVERDUE', 'Overdue']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${filterStatus === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 size={28} className="animate-spin text-blue-400 mx-auto mb-3" />
            <p className="text-gray-400 font-medium text-sm">Loading transport fee data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Bus size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-500 text-base">
              {query || filterStatus !== 'all' || filterRoute !== 'all'
                ? 'No students match your filters'
                : 'No transport invoices found'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {query || filterStatus !== 'all' || filterRoute !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Assign students to transport routes in Transport Manager first — invoices will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase font-semibold tracking-widest text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left">Student</th>
                  <th className="px-5 py-3 text-left">Route & Pickup</th>
                  <th className="px-5 py-3 text-left">Grade</th>
                  <th className="px-5 py-3 text-left">Term / Year</th>
                  <th className="px-5 py-3 text-right">Billed</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3 text-center min-w-[100px]">Progress</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inv => {
                  const billed  = Number(inv.transportBilled  || 0);
                  const paid    = Number(inv.transportPaid    || 0);
                  const balance = Number(inv.transportBalance || 0);
                  const ts = balance <= 0 ? 'PAID'
                    : paid > 0 ? 'PARTIAL'
                    : inv.dueDate && new Date(inv.dueDate) < new Date() ? 'OVERDUE'
                    : 'PENDING';
                  const learner = inv.learner;

                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-blue-50/10 transition cursor-pointer group"
                      onClick={(e) => {
                        // Don't navigate if clicking an action button
                        if (e.target.closest('button') || e.target.closest('a')) return;
                        onEditLearner?.(learner);
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0">
                            {learner?.firstName?.[0]}{learner?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{learner?.firstName} {learner?.lastName}</p>
                            <p className="text-[11px] text-gray-400 font-medium">{learner?.admissionNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {learner?.transportAssignments?.[0] ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-indigo-600">{learner.transportAssignments[0].route?.name || 'Assigned'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{learner.transportAssignments[0].pickupPoint?.name || 'N/A'}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-gray-600">
                        {learner?.grade?.replace(/_/g, ' ')} {learner?.stream || ''}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">
                        {inv.term?.replace(/_/g, ' ')} {inv.academicYear}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-gray-700 text-xs">{fmt(billed)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 text-xs">{fmt(paid)}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold text-xs ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {fmt(balance)}
                      </td>
                      <td className="px-5 py-3.5 min-w-[100px]">
                        <div className="text-[10px] text-center text-gray-500 font-medium mb-0.5">{pct(paid, billed)}%</div>
                        <MiniBar paid={paid} billed={billed} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={ts} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {balance > 0 && (
                            <button
                              onClick={() => setPayModal({ invoice: inv, learner })}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                              title="Record Payment">
                              <CreditCard size={14} />
                            </button>
                          )}
                          {learner?.primaryContactPhone && (
                            <a href={`tel:${learner.primaryContactPhone}`}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                              title="Call">
                              <Phone size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => onEditLearner?.(learner)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                            title="Edit Scholar Record">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onViewLearner?.(learner)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                            title="View Profile">
                            <User size={14} />
                          </button>
                          <button
                            onClick={() => navigateTo('fees-collection', { learnerId: learner?.id })}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                            title="View Full Invoice">
                            <Send size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    {filtered.length} students
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-gray-700">{fmt(filtered.reduce((s, i) => s + Number(i.transportBilled || 0), 0))}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-emerald-700">{fmt(filtered.reduce((s, i) => s + Number(i.transportPaid   || 0), 0))}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-red-600">{fmt(filtered.reduce((s, i) => s + Number(i.transportBalance || 0), 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          invoice={payModal.invoice}
          learner={payModal.learner}
          onClose={() => setPayModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default TransportFeeManager;
