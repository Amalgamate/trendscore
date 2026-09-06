/**
 * TransportFeeManager.jsx
 * Transport-specific fee collection view.
 *
 * Shows every learner with isTransportStudent=true (and/or route assignments),
 * their active term invoice's transport portion (transportBilled / transportPaid / transportBalance),
 * billing status (PAID, PARTIAL, PENDING, OVERDUE, UNBILLED), and lets admins:
 *   - Bill a single student (+ Bill Student / inline row Bill)
 *   - Bulk bill all transport students (⚡ Bulk Bill Transport)
 *   - Record transport payments into the dedicated transport collection account
 *   - Filter by route, payment status, and search by student name / admission number.
 *
 * Data sources:
 *   GET  /transport/fee-roster          — all transport students + billing status + summary KPIs
 *   GET  /transport/routes              — active bus routes
 *   POST /transport/fee-roster/bill     — bill single student
 *   POST /transport/fee-roster/bulk-bill— bulk bill transport students
 *   POST /fees/payments                 — record transport payment
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown, Send, FileText, Clock, AlertCircle,
  FileCheck2, ShieldCheck, TrendingUp, Download,
  X, Loader2, RefreshCw, CreditCard, Bus,
  Search, Filter, Phone, User, Pencil, Plus, Zap, CheckCircle2,
  Calendar, Layers, Sparkles
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import usePageNavigation from '../../../../hooks/usePageNavigation';
import { getCurrentAcademicYear, getDynamicAcademicYears } from '../../utils/academicYear';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
const pct = (paid, billed) => (billed > 0 ? Math.round((paid / billed) * 100) : 0);

function StatusBadge({ status }) {
  const map = {
    PAID:     'bg-emerald-100 text-emerald-700',
    PARTIAL:  'bg-blue-100 text-blue-700',
    PENDING:  'bg-amber-100 text-amber-700',
    OVERDUE:  'bg-red-100 text-red-700',
    UNBILLED: 'bg-slate-100 text-slate-600 border border-slate-200',
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

function PaymentModal({ invoice, learner, balance: passedBalance, onClose, onSaved }) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState('MPESA');
  const [ref, setRef]           = useState('');
  const [saving, setSaving]     = useState(false);
  const { showSuccess, showError } = useNotifications();

  const balance = Number(passedBalance ?? invoice?.transportBalance ?? invoice?.balance ?? 0);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showError('Enter a valid amount');
      return;
    }
    const payAmt = Number(amount);
    setSaving(true);
    try {
      await api.fees.recordPayment({
        invoiceId:          invoice.id,
        amount:             payAmt,
        allocatedTransport: payAmt,
        allocatedTuition:   0,
        transportAmount:    payAmt,
        paymentMethod:      method,
        referenceNumber:    ref || undefined,
        notes:              'Transport fee payment'
      });
      showSuccess('Transport payment recorded successfully');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

// ─── Bill Student Modal (Single) ──────────────────────────────────────────────

function BillStudentModal({ initialItem, roster, routes, currentTerm, currentYear, onClose, onSaved }) {
  const [learnerId, setLearnerId]     = useState(initialItem?.learner?.id || (roster[0]?.learner?.id || ''));
  const [routeId, setRouteId]         = useState(initialItem?.route?.id || '');
  const [pickupPoint, setPickupPoint] = useState(initialItem?.pickupPoint || '');
  const [term, setTerm]               = useState(currentTerm);
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [amount, setAmount]           = useState(() => {
    if (initialItem?.billed > 0) return String(initialItem.billed);
    if (initialItem?.expectedFee > 0) return String(initialItem.expectedFee);
    if (initialItem?.route?.amount > 0) return String(initialItem.route.amount);
    return '';
  });
  const [dueDate, setDueDate]         = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving]           = useState(false);
  const { showSuccess, showError }    = useNotifications();

  // Find selected learner details
  const selectedStudent = useMemo(() => {
    return roster.find(r => r.learner.id === learnerId);
  }, [roster, learnerId]);

  // When learner selection changes, auto-populate route & amount
  const handleLearnerChange = (id) => {
    setLearnerId(id);
    const item = roster.find(r => r.learner.id === id);
    if (item) {
      if (item.route?.id) setRouteId(item.route.id);
      if (item.pickupPoint) setPickupPoint(item.pickupPoint);
      const defaultAmt = item.billed > 0 ? item.billed : (item.expectedFee || item.route?.amount || '');
      if (defaultAmt) setAmount(String(defaultAmt));
    }
  };

  // When route changes, auto-fill route's amount
  const handleRouteChange = (rId) => {
    setRouteId(rId);
    const selRoute = routes.find(r => r.id === rId);
    if (selRoute && Number(selRoute.amount) > 0) {
      setAmount(String(selRoute.amount));
    }
  };

  const handleSave = async () => {
    if (!learnerId) {
      showError('Please select a student');
      return;
    }
    if (amount === '' || isNaN(Number(amount)) || Number(amount) < 0) {
      showError('Please enter a valid transport fee amount');
      return;
    }
    setSaving(true);
    try {
      const res = await api.transport.billStudent({
        learnerId,
        term,
        academicYear: Number(academicYear),
        amount: Number(amount),
        dueDate,
        routeId: routeId || undefined,
        pickupPoint: pickupPoint || undefined
      });
      showSuccess(res?.message || 'Transport invoice generated successfully');
      onSaved();
      onClose();
    } catch (err) {
      showError(err?.message || 'Failed to generate transport invoice');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <CreditCard size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-base">Bill Transport Fee</p>
                <p className="text-blue-100 text-xs mt-0.5">Generate standalone transport invoice</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Student selection */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Select Transport Student <span className="text-red-400">*</span>
            </label>
            <select
              className={inputCls}
              value={learnerId}
              onChange={e => handleLearnerChange(e.target.value)}
              disabled={!!initialItem}
            >
              {roster.map(r => (
                <option key={r.learner.id} value={r.learner.id}>
                  {r.learner.firstName} {r.learner.lastName} ({r.learner.admissionNumber}) · {r.learner.grade?.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {selectedStudent && (
              <p className="text-[11px] text-gray-500 mt-1 font-medium">
                Current Status: <span className="font-semibold text-gray-700">{selectedStudent.status}</span>
                {selectedStudent.billed > 0 && ` · Currently billed: ${fmt(selectedStudent.billed)}`}
              </p>
            )}
          </div>

          {/* Route & Pickup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Bus Route
              </label>
              <select className={inputCls} value={routeId} onChange={e => handleRouteChange(e.target.value)}>
                <option value="">-- Select Route (Optional) --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({fmt(r.amount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Pickup Point
              </label>
              <input
                className={inputCls}
                value={pickupPoint}
                onChange={e => setPickupPoint(e.target.value)}
                placeholder="e.g. Stage 2, Total Junction…"
              />
            </div>
          </div>

          {/* Term & Academic Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Term <span className="text-red-400">*</span>
              </label>
              <select className={inputCls} value={term} onChange={e => setTerm(e.target.value)}>
                <option value="TERM_1">Term 1</option>
                <option value="TERM_2">Term 2</option>
                <option value="TERM_3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Academic Year <span className="text-red-400">*</span>
              </label>
              <input
                className={inputCls}
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              />
            </div>
          </div>

          {/* Amount & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Transport Fee (KES) <span className="text-red-400">*</span>
              </label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 6000"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Invoice Due Date
              </label>
              <input
                className={inputCls}
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Accounting Ledger Info */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed font-medium">
              Billed fee will automatically post to <strong>Account 4100 (Transport Fees Income)</strong> in the General Ledger.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Generate Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Bill Modal ──────────────────────────────────────────────────────────

function BulkBillModal({ currentTerm, currentYear, unbilledCount, totalCount, onClose, onSaved }) {
  const [term, setTerm]                 = useState(currentTerm);
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [billingMode, setBillingMode]   = useState('ROUTE_FEE'); // ROUTE_FEE | FLAT_RATE
  const [flatAmount, setFlatAmount]     = useState('6000');
  const [onlyUnbilled, setOnlyUnbilled] = useState(true);
  const [dueDate, setDueDate]           = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving]             = useState(false);
  const { showSuccess, showError }      = useNotifications();

  const handleSave = async () => {
    if (billingMode === 'FLAT_RATE' && (!flatAmount || isNaN(Number(flatAmount)) || Number(flatAmount) <= 0)) {
      showError('Please enter a valid flat fee amount');
      return;
    }
    setSaving(true);
    try {
      const res = await api.transport.bulkBillStudents({
        term,
        academicYear: Number(academicYear),
        dueDate,
        billingMode,
        flatAmount: Number(flatAmount || 0),
        onlyUnbilled
      });
      showSuccess(res?.message || 'Bulk transport billing complete');
      onSaved();
      onClose();
    } catch (err) {
      showError(err?.message || 'Failed to bulk bill transport fees');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-base">Bulk Bill Transport Fees</p>
                <p className="text-indigo-100 text-xs mt-0.5">Generate invoices for all transport scholars</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Target Term & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Target Term
              </label>
              <select className={inputCls} value={term} onChange={e => setTerm(e.target.value)}>
                <option value="TERM_1">Term 1</option>
                <option value="TERM_2">Term 2</option>
                <option value="TERM_3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Academic Year
              </label>
              <input
                className={inputCls}
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing Strategy */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Pricing Strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${billingMode === 'ROUTE_FEE' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="billingMode"
                  value="ROUTE_FEE"
                  checked={billingMode === 'ROUTE_FEE'}
                  onChange={() => setBillingMode('ROUTE_FEE')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-900">By Route Pricing</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Bills each student their assigned route's fee</p>
                </div>
              </label>

              <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${billingMode === 'FLAT_RATE' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="billingMode"
                  value="FLAT_RATE"
                  checked={billingMode === 'FLAT_RATE'}
                  onChange={() => setBillingMode('FLAT_RATE')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-900">Uniform Flat Fee</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Bills the same amount to all transport students</p>
                </div>
              </label>
            </div>
          </div>

          {/* Flat fee input if flat rate */}
          {billingMode === 'FLAT_RATE' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Flat Fee Per Student (KES) <span className="text-red-400">*</span>
              </label>
              <input
                className={inputCls}
                type="number"
                min="1"
                step="100"
                value={flatAmount}
                onChange={e => setFlatAmount(e.target.value)}
                placeholder="e.g. 6000"
              />
            </div>
          )}

          {/* Due date */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Invoice Due Date
            </label>
            <input
              className={inputCls}
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          {/* Only unbilled toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="onlyUnbilled"
              checked={onlyUnbilled}
              onChange={e => setOnlyUnbilled(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="onlyUnbilled" className="text-xs text-gray-700 font-medium cursor-pointer">
              Only bill students who have not been billed for this term yet ({unbilledCount} students)
            </label>
          </div>

          {/* Summary Preview Box */}
          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-700">Scope Preview</p>
              <p className="text-sm font-semibold text-purple-900 mt-0.5">
                {onlyUnbilled ? `${unbilledCount} unbilled students` : `All ${totalCount} transport students`}
              </p>
            </div>
            <span className="text-xs font-medium text-purple-700 bg-white px-2.5 py-1 rounded-lg border border-purple-200">
              {term.replace('_', ' ')} · {academicYear}
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Generate All Invoices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TransportFeeManager = ({ onEditLearner, onViewLearner }) => {
  const [roster, setRoster]           = useState([]);
  const [routes, setRoutes]           = useState([]);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('TERM_1');
  const [selectedYear, setSelectedYear] = useState(() => getCurrentAcademicYear());

  const availableYears = useMemo(() => {
    return getDynamicAcademicYears({
      minPast: 4,
      minFuture: 6,
      extraYears: [selectedYear],
      order: 'desc'
    });
  }, [selectedYear]);

  const [payModal, setPayModal]       = useState(null); // { invoice, learner }
  const [billModal, setBillModal]     = useState(null); // initialItem or {}
  const [bulkBillModal, setBulkBillModal] = useState(false);
  const [exporting, setExporting]     = useState(false);

  const { showSuccess, showError }    = useNotifications();
  const navigateTo                    = usePageNavigation();

  // Load fee roster and routes
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterRes, routeRes] = await Promise.all([
        api.transport.getFeeRoster({ term: selectedTerm, academicYear: selectedYear }),
        api.transport.getRoutes(),
      ]);

      if (rosterRes.success) {
        setRoster(rosterRes.data.roster || []);
        setSummary(rosterRes.data.summary || null);
      }
      if (routeRes.success) {
        setRoutes(routeRes.data || []);
      }
    } catch {
      showError('Failed to load transport fee roster');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtering
  const filtered = useMemo(() => {
    return roster.filter(item => {
      const name = `${item.learner?.firstName || ''} ${item.learner?.lastName || ''}`.toLowerCase();
      const adm  = (item.learner?.admissionNumber || '').toLowerCase();
      const q    = query.toLowerCase();
      const matchQ = !q || name.includes(q) || adm.includes(q);

      const matchRoute = filterRoute === 'all' || item.route?.id === filterRoute;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;

      return matchQ && matchRoute && matchStatus;
    });
  }, [roster, query, filterRoute, filterStatus]);

  // KPIs from summary or computed
  const { totalBilled, totalCollected, totalOutstanding, collectionRate, totalStudents, unbilledCount } = useMemo(() => {
    if (summary) {
      return {
        totalBilled: summary.totalBilled || 0,
        totalCollected: summary.totalCollected || 0,
        totalOutstanding: summary.totalOutstanding || 0,
        collectionRate: summary.collectionRate || 0,
        totalStudents: summary.totalStudents || roster.length,
        unbilledCount: summary.unbilledStudents || 0
      };
    }
    const billed      = roster.reduce((s, r) => s + r.billed, 0);
    const collected   = roster.reduce((s, r) => s + r.paid, 0);
    const outstanding = roster.reduce((s, r) => s + r.balance, 0);
    const rate        = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    const unbilled    = roster.filter(r => !r.isBilled).length;

    return {
      totalBilled: billed,
      totalCollected: collected,
      totalOutstanding: outstanding,
      collectionRate: rate,
      totalStudents: roster.length,
      unbilledCount: unbilled
    };
  }, [summary, roster]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [
        ['Student', 'Adm No', 'Grade', 'Route', 'Pickup', 'Term / Year', 'Billed', 'Paid', 'Balance', 'Status'],
        ...filtered.map(r => [
          `${r.learner?.firstName} ${r.learner?.lastName}`,
          r.learner?.admissionNumber || '',
          r.learner?.grade?.replace(/_/g, ' ') || '',
          r.route?.name || 'Not Assigned',
          r.pickupPoint || 'N/A',
          `${selectedTerm.replace(/_/g, ' ')} ${selectedYear}`,
          Number(r.billed).toFixed(2),
          Number(r.paid).toFixed(2),
          Number(r.balance).toFixed(2),
          r.status
        ])
      ];
      const csv = rows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `transport_fees_${selectedTerm}_${selectedYear}.csv`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
      showSuccess('Transport fees exported successfully');
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
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Transport Accounts</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <CreditCard className="text-blue-600" size={28} />
            Transport Fee Manager
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Manage transport fee invoices, collections, and bus student billing
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Term & Year selector */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-700 px-2 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="TERM_1">Term 1</option>
              <option value="TERM_2">Term 2</option>
              <option value="TERM_3">Term 3</option>
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-gray-700 px-2 py-1.5 border-l border-gray-200 focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>

          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export
          </button>

          {/* Bulk Invoicing Button */}
          <button
            onClick={() => setBulkBillModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
          >
            <Zap size={14} />
            Bulk Bill
          </button>

          {/* Single Bill Button */}
          <button
            onClick={() => setBillModal({})}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
          >
            <Plus size={15} />
            Bill Student
          </button>

          <button
            onClick={() => navigateTo('transport-routes')}
            className="flex items-center gap-2 px-3.5 py-2 text-gray-700 border border-gray-200 bg-white rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
          >
            <Bus size={15} />
            Routes & Roster
          </button>
        </div>
      </div>

      {/* Notice for unbilled students if any */}
      {unbilledCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {unbilledCount} Transport Student{unbilledCount > 1 ? 's' : ''} Pending Billing
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                These students are enrolled in transport for {selectedTerm.replace('_', ' ')} {selectedYear} but have not had their transport invoices generated yet.
              </p>
            </div>
          </div>
          <button
            onClick={() => setBulkBillModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Zap size={13} />
            Bill All {unbilledCount} Now
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Total Billed — Indigo */}
        <div className="relative overflow-hidden rounded-2xl bg-indigo-600 p-5 shadow-lg shadow-indigo-500/20 text-white transition-all duration-200 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-indigo-200 mb-1">Expected Income</p>
              <p className="text-2xl font-semibold">{fmt(totalBilled)}</p>
              <p className="text-sm font-medium text-indigo-200 mt-1">
                {totalStudents} Student{totalStudents !== 1 ? 's' : ''} ({unbilledCount} unbilled)
              </p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <FileText size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Outstanding — Red */}
        <div className="relative overflow-hidden rounded-2xl bg-red-600 p-5 shadow-lg shadow-red-500/20 text-white transition-all duration-200 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-red-100 mb-1">Total Outstanding</p>
              <p className="text-2xl font-semibold">{fmt(totalOutstanding)}</p>
              <p className="text-sm font-medium text-red-200 mt-1">Pending Collection</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <Clock size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Total Collected — Emerald */}
        <div className="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 shadow-lg shadow-emerald-500/20 text-white transition-all duration-200 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-100 mb-1">Total Collected</p>
              <p className="text-2xl font-semibold">{fmt(totalCollected)}</p>
              <p className="text-sm font-medium text-emerald-200 mt-1">Payments Received</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl">
              <FileCheck2 size={22} className="text-white" />
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Efficiency — Purple */}
        <div className="relative overflow-hidden rounded-2xl bg-purple-600 p-5 shadow-lg shadow-purple-500/20 text-white transition-all duration-200 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-purple-100 mb-1">Collection Progress</p>
              <p className="text-2xl font-semibold">{collectionRate}%</p>
              <p className="text-sm font-medium text-purple-200 mt-1">Efficiency Rate</p>
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
            Collection Rate ({selectedTerm.replace('_', ' ')} · {selectedYear})
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
          <span>Target Billed: {fmt(totalBilled)}</span>
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
        <div className="flex gap-1.5 flex-wrap">
          {[
            ['all', 'All'],
            ['UNBILLED', 'Unbilled'],
            ['PENDING', 'Pending'],
            ['PARTIAL', 'Partial'],
            ['PAID', 'Paid'],
            ['OVERDUE', 'Overdue']
          ].map(([v, l]) => (
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
            <p className="text-gray-400 font-medium text-sm">Loading transport fee roster…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Bus size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-600 text-base">
              {query || filterStatus !== 'all' || filterRoute !== 'all'
                ? 'No transport students match your filters'
                : 'No transport students found'}
            </p>
            <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
              {query || filterStatus !== 'all' || filterRoute !== 'all'
                ? 'Try adjusting your search query or route/status filters.'
                : 'Mark students as transport students in Scholar Profiles or Admissions, or assign them to a bus route to manage their transport billing.'}
            </p>
            {roster.length === 0 && (
              <button
                onClick={() => navigateTo('transport-routes')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
              >
                Go to Bus Routes & Roster
              </button>
            )}
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
                {filtered.map(item => {
                  const learner = item.learner;
                  const billed  = Number(item.billed || 0);
                  const paid    = Number(item.paid || 0);
                  const balance = Number(item.balance || 0);
                  const status  = item.status;
                  const isUnbilled = status === 'UNBILLED';

                  return (
                    <tr
                      key={learner.id}
                      className="hover:bg-blue-50/10 transition cursor-pointer group"
                      onClick={(e) => {
                        if (e.target.closest('button') || e.target.closest('a')) return;
                        onEditLearner?.(learner);
                      }}
                    >
                      {/* Student */}
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

                      {/* Route & Pickup */}
                      <td className="px-5 py-3.5">
                        {item.route ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-indigo-600">{item.route.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">
                              {item.pickupPoint ? `Pickup: ${item.pickupPoint}` : 'No pickup set'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">Route unassigned</span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="px-5 py-3.5 text-xs font-medium text-gray-600">
                        {learner?.grade?.replace(/_/g, ' ')} {learner?.stream || ''}
                      </td>

                      {/* Term / Year */}
                      <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">
                        {selectedTerm.replace(/_/g, ' ')} {selectedYear}
                      </td>

                      {/* Billed */}
                      <td className="px-5 py-3.5 text-right font-medium text-gray-700 text-xs">
                        {isUnbilled ? (
                          <span className="text-gray-300 italic">Unbilled</span>
                        ) : (
                          fmt(billed)
                        )}
                      </td>

                      {/* Paid */}
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 text-xs">
                        {fmt(paid)}
                      </td>

                      {/* Balance */}
                      <td className={`px-5 py-3.5 text-right font-semibold text-xs ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isUnbilled ? '-' : fmt(balance)}
                      </td>

                      {/* Progress */}
                      <td className="px-5 py-3.5 min-w-[100px]">
                        {isUnbilled ? (
                          <div className="text-[10px] text-center text-gray-300 italic">Pending invoice</div>
                        ) : (
                          <>
                            <div className="text-[10px] text-center text-gray-500 font-medium mb-0.5">{pct(paid, billed)}%</div>
                            <MiniBar paid={paid} billed={billed} />
                          </>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* If unbilled, show direct Bill Now button */}
                          {isUnbilled ? (
                            <button
                              onClick={() => setBillModal(item)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              title="Bill Transport Fee"
                            >
                              <Plus size={12} />
                              Bill
                            </button>
                          ) : (
                            /* If billed and has balance, show Record Payment */
                            balance > 0 && (
                              <button
                                onClick={() => setPayModal({ invoice: item.invoice, learner, balance: item.balance })}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                                title="Record Payment"
                              >
                                <CreditCard size={12} />
                                Pay
                              </button>
                            )
                          )}

                          {/* Action icons */}
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {learner?.primaryContactPhone && (
                              <a href={`tel:${learner.primaryContactPhone}`}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Call Parent">
                                <Phone size={13} />
                              </a>
                            )}
                            <button
                              onClick={() => setBillModal(item)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit / Re-bill Transport">
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => onViewLearner?.(learner)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View Scholar Profile">
                              <User size={13} />
                            </button>
                            {item.invoice && (
                              <button
                                onClick={() => navigateTo('fees-collection', { learnerId: learner?.id })}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="View Full Invoice in Fees">
                                <Send size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Total ({filtered.length} students)
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-gray-700">
                    {fmt(filtered.reduce((s, r) => s + r.billed, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-emerald-700">
                    {fmt(filtered.reduce((s, r) => s + r.paid, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-red-600">
                    {fmt(filtered.reduce((s, r) => s + r.balance, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {payModal && (
        <PaymentModal
          invoice={payModal.invoice}
          learner={payModal.learner}
          balance={payModal.balance}
          onClose={() => setPayModal(null)}
          onSaved={load}
        />
      )}

      {/* Bill Student Modal */}
      {billModal && (
        <BillStudentModal
          initialItem={billModal.learner ? billModal : null}
          roster={roster}
          routes={routes}
          currentTerm={selectedTerm}
          currentYear={selectedYear}
          onClose={() => setBillModal(null)}
          onSaved={load}
        />
      )}

      {/* Bulk Bill Modal */}
      {bulkBillModal && (
        <BulkBillModal
          routes={routes}
          currentTerm={selectedTerm}
          currentYear={selectedYear}
          unbilledCount={unbilledCount}
          totalCount={totalStudents}
          onClose={() => setBulkBillModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default TransportFeeManager;
