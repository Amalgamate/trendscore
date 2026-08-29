/**
 * ParentChildProfile
 * Design ref: purple header card + avatar + name + grade/class + Present today badge
 * Tabs: Results · Attendance · Fees
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MoreVertical,
  CheckCircle2, Loader2,
  ChevronRight, Receipt,
} from 'lucide-react';
import api from '../../../../services/api';
import { cn } from '../../../../utils/cn';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import ParentReportCards from './ParentReportCards';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (n)  => Number(n || 0).toLocaleString();
const fmtDate = (d)  => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const INVOICE_COLORS = {
  PAID:          'bg-emerald-100 text-emerald-700',
  PARTIALLY_PAID:'bg-amber-100 text-amber-700',
  UNPAID:        'bg-red-100 text-red-700',
  CANCELLED:     'bg-gray-100 text-gray-500',
};

function EmptyCard({ icon: Icon, message }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 flex flex-col items-center text-gray-400 gap-2">
      <Icon size={28} className="opacity-30" />
      <p className="text-xs font-medium text-center">{message}</p>
    </div>
  );
}

// ─── Attendance Donut ─────────────────────────────────────────────────────────

function AttendanceDonut({ rate = 0, size = 80 }) {
  const r        = (size / 2) - 8;
  const circ     = 2 * Math.PI * r;
  const filled   = (rate / 100) * circ;
  const color    = rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle" className="text-sm font-bold" style={{ fontSize: 13, fontWeight: 700, fill: '#111827' }}>
        {rate}%
      </text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 8, fill: '#6b7280' }}>
        Overall
      </text>
    </svg>
  );
}

// ─── Results Tab — uses shared hook + components from results/ResultsShared ────

function ResultsTab({ child }) {
  return <ParentReportCards learner={child} />;
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ learnerId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.attendance.getLearnerSummary(learnerId);
      setData(r?.data || r);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-[#3B1FA3]" /></div>;
  if (error)   return <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">{error}</div>;
  if (!data)   return <EmptyCard icon={CheckCircle2} message="No attendance records." />;

  const summary  = data.summary || data;
  const records  = (data.records || data.attendance || []).slice().reverse();
  const total    = (summary.presentDays || 0) + (summary.absentDays || 0) + (summary.lateDays || 0) + (summary.excusedDays || 0);
  const rate     = total > 0 ? Math.round((summary.presentDays || 0) / total * 100) : 0;
  const STATUS   = { PRESENT: 'bg-emerald-100 text-emerald-700', ABSENT: 'bg-red-100 text-red-700', LATE: 'bg-amber-100 text-amber-700', EXCUSED: 'bg-blue-100 text-blue-700' };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-5">
        <AttendanceDonut rate={rate} size={88} />
        <div className="flex-1 space-y-2">
          {[
            { label: 'Present', value: summary.presentDays || 0, color: 'text-emerald-600' },
            { label: 'Late',    value: summary.lateDays    || 0, color: 'text-amber-500'   },
            { label: 'Absent',  value: summary.absentDays  || 0, color: 'text-rose-600'    },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      {records.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <div className="divide-y divide-gray-50">
            {records.slice(0, 15).map((r, i) => (
              <div key={r.id || i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-600">{fmtDate(r.date)}</span>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS[r.status] || 'bg-gray-100 text-gray-600')}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fees Tab ─────────────────────────────────────────────────────────────────

function FeesTab({ learnerId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.fees.getLearnerInvoices(learnerId);
      setInvoices(r?.data || r?.invoices || []);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  const totalBilled  = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const totalPaid    = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + Number(i.balance || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-[#3B1FA3]" /></div>;
  if (error)   return <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 font-semibold">Billed</p>
          <p className="text-xs font-bold text-gray-900 mt-0.5">KES {fmt(totalBilled)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-600 font-semibold">Paid</p>
          <p className="text-xs font-bold text-emerald-700 mt-0.5">KES {fmt(totalPaid)}</p>
        </div>
        <div className={cn('rounded-xl p-3 text-center', totalBalance > 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
          <p className={cn('text-[10px] font-semibold', totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600')}>Balance</p>
          <p className={cn('text-xs font-bold mt-0.5', totalBalance > 0 ? 'text-rose-700' : 'text-emerald-700')}>KES {fmt(totalBalance)}</p>
        </div>
      </div>
      {invoices.length === 0
        ? <EmptyCard icon={Receipt} message="No invoices found." />
        : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inv.feeStructure?.name || `Invoice #${inv.invoiceNumber}`}</p>
                    <p className="text-xs text-gray-400">{fmtDate(inv.dueDate)} · {inv.term?.replace('_', ' ')} {inv.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', INVOICE_COLORS[inv.status] || 'bg-gray-100 text-gray-600')}>
                      {inv.status?.replace('_', ' ')}
                    </span>
                    <ChevronRight size={14} className={cn('text-gray-300 transition-transform', expandedId === inv.id && 'rotate-90')} />
                  </div>
                </button>
                {expandedId === inv.id && (
                  <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-gray-500">Total</p><p className="text-xs font-bold text-gray-900">KES {fmt(inv.totalAmount)}</p></div>
                    <div><p className="text-[10px] text-gray-500">Paid</p><p className="text-xs font-bold text-emerald-600">KES {fmt(inv.paidAmount)}</p></div>
                    <div><p className="text-[10px] text-gray-500">Balance</p><p className={cn('text-xs font-bold', Number(inv.balance) > 0 ? 'text-rose-600' : 'text-emerald-600')}>KES {fmt(inv.balance)}</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'results',     label: 'Results',     icon: null          },
  { id: 'attendance',  label: 'Attendance',  icon: null          },
  { id: 'fees',        label: 'Fees',        icon: null          },
];

function resolveInitialTab(initialTab, showFees) {
  if (initialTab === 'overview' || initialTab === 'info' || (initialTab === 'fees' && !showFees)) return 'results';
  return initialTab;
}

export default function ParentChildProfile({ child, onBack, initialTab = 'results' }) {
  const { activeSlugs } = useModuleAccess();
  const showFees = hasPageAccess({ enabledApps: activeSlugs }, 'parent-portal-fees');
  const visibleTabs = showFees ? TABS : TABS.filter((item) => item.id !== 'fees');
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab, showFees));
  useEffect(() => {
    if (!showFees && tab === 'fees') setTab('results');
    if (tab === 'overview' || tab === 'info') setTab('results');
  }, [showFees, tab]);
  if (!child) return null;

  const isPresent = child.todayStatus === 'PRESENT' || child.isPresent;

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      <div className="px-4 pt-4 space-y-4">

      {/* Purple header card */}
      <div className="bg-[#3B1FA3] rounded-2xl px-4 pt-4 pb-0 overflow-hidden">
        {/* Back + menu row */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-bold text-white">Results</h1>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Child identity */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {child.name?.[0] || '?'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{child.name}</h2>
            <p className="text-white/70 text-xs mt-0.5">{child.grade} · {child.className || 'Class'}</p>
            <span className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${isPresent ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/20 text-white/70'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-emerald-400' : 'bg-gray-400'}`} />
              {isPresent ? 'Present today' : 'Current Term'}
            </span>
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex overflow-x-auto scrollbar-none">
            {visibleTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors',
                tab === id
                  ? 'text-white border-white'
                  : 'text-white/50 border-transparent hover:text-white/80',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'results'    && <ResultsTab    child={child} />}
        {tab === 'attendance' && <AttendanceTab learnerId={child.id} />}
        {showFees && tab === 'fees' && <FeesTab learnerId={child.id} />}
      </div>

      </div>
    </div>
  );
}
