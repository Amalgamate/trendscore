/**
 * ParentChildProfile
 * Design ref: purple header card + avatar + name + grade/class + Present today badge
 * Tabs: Overview · Results · Attendance · Fees · Info
 * Overview: outstanding balance card, latest assessment subject grid,
 *           attendance donut + counts, recent announcements
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MoreVertical, CreditCard, TrendingUp,
  CheckCircle2, XCircle, Clock, Loader2, GraduationCap,
  ChevronRight, Receipt, FileText, Info, Bell,
} from 'lucide-react';
import api from '../../../../services/api';
import { cn } from '../../../../utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (n)  => Number(n || 0).toLocaleString();
const fmtDate = (d)  => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtPct  = (n)  => `${Math.round(Number(n || 0))}%`;
const INVOICE_COLORS = {
  PAID:          'bg-emerald-100 text-emerald-700',
  PARTIALLY_PAID:'bg-amber-100 text-amber-700',
  UNPAID:        'bg-red-100 text-red-700',
  CANCELLED:     'bg-gray-100 text-gray-500',
};

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

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

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ child, onNavigate }) {
  const bal         = Number(child.feeBalance || 0);
  const attendance  = Math.round(Number(child.attendanceRate || 0));
  const subjects    = child.subjects || child.recentSubjects || [];
  const notices     = child.notices || child.recentAnnouncements || [];

  const subjectColors = ['text-emerald-600', 'text-blue-600', 'text-[#3B1FA3]', 'text-amber-500'];

  return (
    <div className="space-y-4">

      {/* Outstanding Balance */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Outstanding Balance</p>
            <p className={`text-2xl font-bold ${bal > 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
              KES {fmt(bal)}
            </p>
            {child.nextPaymentDate && (
              <p className="text-xs text-gray-500 mt-1">Next Payment Date<br /><span className="font-semibold text-gray-700">{child.nextPaymentDate}</span></p>
            )}
          </div>
          {bal > 0 && (
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CreditCard size={16} className="text-amber-600" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2.5 bg-[#3B1FA3] text-white text-xs font-bold rounded-xl hover:bg-[#2d1680] transition flex items-center justify-center gap-1.5">
            <CreditCard size={13} /> Pay Now
          </button>
          <button className="py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition">
            Statement
          </button>
        </div>
      </div>

      {/* Latest Assessment */}
      {subjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-900">Latest Assessment</p>
            <button className="text-xs text-[#3B1FA3] font-semibold flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {subjects.slice(0, 4).map((s, i) => {
              const score = s.score ?? s.percentage ?? s.marks ?? s.averageScore;
              return (
                <div key={i} className="text-center">
                  <p className={`text-lg font-bold ${subjectColors[i % subjectColors.length]}`}>
                    {score != null ? `${Math.round(score)}%` : (s.grade || '—')}
                  </p>
                  <p className="text-[9px] text-gray-500 truncate">{s.name || s.subject || s.learningArea || `Subject ${i+1}`}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attendance */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-900">Attendance (This Term)</p>
        </div>
        <div className="flex items-center gap-4">
          <AttendanceDonut rate={attendance} size={80} />
          <div className="flex-1 space-y-1.5">
            {[
              { label: 'Present', value: child.attendanceSummary?.presentDays ?? child.presentDays ?? '—', color: 'text-emerald-600' },
              { label: 'Late',    value: child.attendanceSummary?.lateDays    ?? child.lateDays    ?? '—', color: 'text-amber-500'   },
              { label: 'Absent',  value: child.attendanceSummary?.absentDays  ?? child.absentDays  ?? '—', color: 'text-rose-600'    },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <button className="w-full mt-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition">
          View Attendance
        </button>
      </div>

      {/* Recent Announcements */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-900">Recent Announcements</p>
          <button className="text-xs text-[#3B1FA3] font-semibold">View all</button>
        </div>
        {notices.length > 0 ? (
          <div className="space-y-2">
            {notices.slice(0, 3).map((n, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-[#3B1FA3]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell size={12} className="text-[#3B1FA3]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{n.title || n.subject}</p>
                  <p className="text-[10px] text-gray-400">{n.timeLabel || (n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent')}</p>
                </div>
                {n.unread && <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">No recent announcements</p>
        )}
      </div>

    </div>
  );
}

// ─── Results Tab (child-level: subject rows with progress bars) ───────────────
// Uses child.subjects from dashboard payload first (no extra API call needed).
// Falls back to reportAPI.getLearnerAnalytics if subjects are empty.

function ResultsTab({ learnerId, subjects: dashboardSubjects }) {
  const [subjects, setSubjects]   = useState(dashboardSubjects || []);
  const [overall, setOverall]     = useState(null);
  const [classRank, setClassRank] = useState(null);
  const [classSize, setClassSize] = useState(null);
  const [loading, setLoading]     = useState(!dashboardSubjects?.length);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (dashboardSubjects?.length) return; // already have real data
    setLoading(true); setError(null);
    try {
      const r = await api.reports.getLearnerAnalytics(learnerId);
      const data = r?.data || r;
      const subs = data?.subjects || data?.learningAreas || data?.assessments || [];
      setSubjects(subs);
      setOverall(data?.overallGrade || data?.performanceLevel || null);
      setClassRank(data?.classRank || null);
      setClassSize(data?.classSize || null);
    } catch {
      setError('Assessment records unavailable.');
    } finally { setLoading(false); }
  }, [learnerId, dashboardSubjects]);

  useEffect(() => { load(); }, [load]);

  // Compute avg from real subject scores
  const avgNum = subjects.length > 0
    ? Math.round(subjects.reduce((s, sub) => s + Number(sub.score ?? sub.percentage ?? sub.marks ?? 0), 0) / subjects.length)
    : null;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-[#3B1FA3]" /></div>;

  if (error && subjects.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
        <GraduationCap size={28} className="mx-auto mb-2 text-gray-300 opacity-40" />
        <p className="text-sm font-semibold text-gray-600 mb-1">No results available</p>
        <p className="text-xs text-gray-400">{error}</p>
      </div>
    );
  }

  const BAR_COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-[#3B1FA3]', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];

  return (
    <div className="space-y-4">
      {/* Snapshot row */}
      {(overall || avgNum != null) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Overall Average</p>
              <p className="text-2xl font-bold text-emerald-600">{avgNum != null ? `${avgNum}%` : overall}</p>
              <p className="text-[10px] text-gray-500">{avgNum >= 70 ? 'Very Good' : avgNum >= 50 ? 'Average' : 'Needs Work'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 mb-0.5">Class Rank</p>
              <p className="text-2xl font-bold text-gray-900">
                {classRank && classSize ? `${classRank} / ${classSize}` : '—'}
              </p>
              {classRank && classSize && (
                <p className="text-[10px] text-gray-500">Top {Math.round((classRank / classSize) * 100)}%</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subject rows */}
      {subjects.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-sm font-bold text-gray-900">Subject Performance</p>
          </div>
          <div className="divide-y divide-gray-50">
            {subjects.map((s, i) => {
              const score = s.score ?? s.percentage ?? s.marks;
              const n     = score != null ? Math.round(Number(score)) : null;
              const color = n >= 70 ? 'text-emerald-600' : n >= 50 ? 'text-amber-500' : 'text-rose-600';
              const bar   = n >= 70 ? 'bg-emerald-500' : n >= 50 ? 'bg-amber-400' : 'bg-rose-500';
              return (
                <div key={s.id || i} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                      {s.name || s.subject || s.learningArea || s.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {n != null ? (
                        <span className={`text-sm font-bold ${color}`}>{n}%</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                  {n != null && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full`} style={{ width: `${Math.min(n, 100)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <GraduationCap size={28} className="mx-auto mb-2 text-gray-300 opacity-40" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No subject results yet</p>
          <p className="text-xs text-gray-400">Results will appear once assessments are entered by the teacher.</p>
        </div>
      )}
    </div>
  );
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

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({ child }) {
  const rows = [
    { label: 'Full Name',        value: child.name              },
    { label: 'Admission No.',    value: child.admissionNumber   },
    { label: 'Grade',            value: child.grade             },
    { label: 'Class',            value: child.className         },
    { label: 'Class Teacher',    value: child.classTeacher      },
    { label: 'Date of Birth',    value: child.dateOfBirth ? fmtDate(child.dateOfBirth) : null },
    { label: 'Gender',           value: child.gender            },
  ].filter(r => r.value);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
          <span className="text-xs text-gray-500">{r.label}</span>
          <span className="text-xs font-semibold text-gray-900">{r.value}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No information available</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: null          },
  { id: 'results',     label: 'Results',     icon: null          },
  { id: 'attendance',  label: 'Attendance',  icon: null          },
  { id: 'fees',        label: 'Fees',        icon: null          },
  { id: 'info',        label: 'Info',        icon: null          },
];

export default function ParentChildProfile({ child, onBack, initialTab = 'overview' }) {
  const [tab, setTab] = useState(initialTab);
  if (!child) return null;

  const isPresent = child.todayStatus === 'PRESENT' || child.isPresent;

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">

      {/* Purple header card */}
      <div className="bg-[#3B1FA3] px-4 pt-4 pb-0">
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
          {TABS.map(({ id, label }) => (
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
      <div className="px-4 py-4">
        {tab === 'overview'   && <OverviewTab   child={child} />}
        {tab === 'results'    && <ResultsTab    learnerId={child.id} subjects={child.subjects} />}
        {tab === 'attendance' && <AttendanceTab learnerId={child.id} />}
        {tab === 'fees'       && <FeesTab       learnerId={child.id} />}
        {tab === 'info'       && <InfoTab       child={child} />}
      </div>

    </div>
  );
}
