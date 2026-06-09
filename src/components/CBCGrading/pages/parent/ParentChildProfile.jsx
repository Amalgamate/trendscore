/**
 * ParentChildProfile — Sophisticated child profile view for parents
 * Tabs: Overview · Fees · Attendance · Academics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, CreditCard, Calendar, BookOpen,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, Download, Loader2, RefreshCw, GraduationCap,
  ChevronRight, Receipt, FileText,
} from 'lucide-react';
import api from '../../../../services/api';
import { cn } from '../../../../utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtPct  = (n) => `${Math.round(Number(n || 0))}%`;

const STATUS_COLORS = {
  PRESENT:  'bg-emerald-100 text-emerald-700',
  ABSENT:   'bg-red-100    text-red-700',
  LATE:     'bg-amber-100  text-amber-700',
  EXCUSED:  'bg-blue-100   text-blue-700',
};

const INVOICE_COLORS = {
  PAID:         'bg-emerald-100 text-emerald-700',
  PARTIALLY_PAID:'bg-amber-100 text-amber-700',
  UNPAID:       'bg-red-100    text-red-700',
  CANCELLED:    'bg-gray-100   text-gray-500',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, tone = 'purple' }) {
  const tones = {
    purple:  'bg-brand-purple/10 text-brand-purple',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
    blue:    'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-base font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      {action}
    </div>
  );
}

function EmptyCard({ icon: Icon, message }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-gray-400 gap-2">
      <Icon size={28} className="opacity-30" />
      <p className="text-xs font-medium text-center">{message}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ child }) {
  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-brand-purple to-purple-700" />
        <div className="px-4 pb-4 -mt-8">
          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center text-brand-purple font-bold text-xl mb-3">
            {child.name?.[0] || '?'}
          </div>
          <p className="font-bold text-gray-900 text-lg leading-tight">{child.name}</p>
          <p className="text-sm text-gray-500">{child.grade} · {child.className}</p>
          {child.admissionNumber && (
            <span className="inline-block mt-1 text-[10px] font-semibold bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full">
              Adm #{child.admissionNumber}
            </span>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Attendance" value={fmtPct(child.attendanceRate)} sub="this term" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Fee Balance" value={`KES ${fmt(child.feeBalance)}`} sub={child.feeBalance > 0 ? 'outstanding' : 'cleared'} icon={CreditCard} tone={child.feeBalance > 0 ? 'rose' : 'emerald'} />
        <StatCard label="Performance" value={child.performanceLevel || 'N/A'} sub="CBC level" icon={TrendingUp} tone="purple" />
        <StatCard label="Today" value={child.todayStatus?.replace('_', ' ') || 'Not marked'} sub="attendance" icon={Calendar} tone={child.todayStatus === 'PRESENT' ? 'emerald' : child.todayStatus === 'ABSENT' ? 'rose' : 'amber'} />
      </div>

      {/* Recent assessments */}
      {child.recentAssessments?.length > 0 && (
        <div>
          <SectionHeader title="Recent Assessments" />
          <div className="space-y-2">
            {child.recentAssessments.slice(0, 3).map((a, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.subject || a.learningArea}</p>
                  <p className="text-xs text-gray-400">{fmtDate(a.date)}</p>
                </div>
                <span className={cn('px-2 py-1 rounded-lg text-xs font-bold', a.grade === 'EE' || a.grade === 'ME' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                  {a.grade || `${a.score}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fees Tab ────────────────────────────────────────────────────────────────

function FeesTab({ learnerId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.fees.getLearnerInvoices(learnerId);
      setInvoices(r.data || r.invoices || []);
    } catch (e) {
      setError(e.message || 'Failed to load fee statements');
    } finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  const totalAmount  = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const totalPaid    = invoices.reduce((s, i) => s + Number(i.paidAmount  || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + Number(i.balance     || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-purple" /></div>;
  if (error)   return <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-semibold">Billed</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">KES {fmt(totalAmount)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-600 uppercase font-semibold">Paid</p>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">KES {fmt(totalPaid)}</p>
        </div>
        <div className={cn('rounded-xl p-3 text-center', totalBalance > 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
          <p className={cn('text-[10px] uppercase font-semibold', totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600')}>Balance</p>
          <p className={cn('text-sm font-bold mt-0.5', totalBalance > 0 ? 'text-rose-700' : 'text-emerald-700')}>KES {fmt(totalBalance)}</p>
        </div>
      </div>

      {invoices.length === 0
        ? <EmptyCard icon={Receipt} message="No fee invoices found for this student." />
        : (
          <div className="space-y-2">
            <SectionHeader title={`${invoices.length} Invoice${invoices.length !== 1 ? 's' : ''}`} />
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {inv.feeStructure?.name || `Invoice #${inv.invoiceNumber}`}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(inv.dueDate)} · {inv.term?.replace('_', ' ')} {inv.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', INVOICE_COLORS[inv.status] || 'bg-gray-100 text-gray-600')}>
                      {inv.status?.replace('_', ' ')}
                    </span>
                    <ChevronRight size={14} className={cn('text-gray-400 transition-transform', expandedId === inv.id && 'rotate-90')} />
                  </div>
                </button>

                {expandedId === inv.id && (
                  <div className="border-t border-gray-50 px-4 py-3 space-y-2 bg-gray-50/50">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-gray-500">Total</p>
                        <p className="text-xs font-bold text-gray-900">KES {fmt(inv.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Paid</p>
                        <p className="text-xs font-bold text-emerald-600">KES {fmt(inv.paidAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Balance</p>
                        <p className={cn('text-xs font-bold', Number(inv.balance) > 0 ? 'text-rose-600' : 'text-emerald-600')}>KES {fmt(inv.balance)}</p>
                      </div>
                    </div>
                    {inv.payments?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Payment History</p>
                        {inv.payments.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                            <span className="text-gray-600">{fmtDate(p.paymentDate)} · {p.paymentMethod?.replace('_', ' ')}</span>
                            <span className="font-semibold text-emerald-600">KES {fmt(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ learnerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.attendance.getLearnerSummary(learnerId);
      setData(r.data || r);
    } catch (e) {
      setError(e.message || 'Failed to load attendance');
    } finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-purple" /></div>;
  if (error)   return <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>;
  if (!data)   return <EmptyCard icon={Calendar} message="No attendance records found." />;

  const summary = data.summary || data;
  const records = data.records || data.attendance || [];
  const total   = (summary.presentDays || 0) + (summary.absentDays || 0) + (summary.lateDays || 0) + (summary.excusedDays || 0);
  const rate    = total > 0 ? Math.round(((summary.presentDays || 0) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Attendance Rate" value={`${rate}%`} sub={`${summary.presentDays || 0} / ${total} days`} icon={CheckCircle2} tone={rate >= 90 ? 'emerald' : rate >= 75 ? 'amber' : 'rose'} />
        <StatCard label="Absent Days"    value={summary.absentDays  || 0} sub="days missed"   icon={XCircle}  tone="rose"   />
        <StatCard label="Late Arrivals"  value={summary.lateDays    || 0} sub="late days"     icon={Clock}    tone="amber"  />
        <StatCard label="Excused"        value={summary.excusedDays || 0} sub="excused days"  icon={FileText} tone="blue"   />
      </div>

      {/* Record log */}
      {records.length > 0 ? (
        <div>
          <SectionHeader title={`${records.length} Records`} />
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {records.slice().reverse().map((r, i) => (
              <div key={r.id || i} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{fmtDate(r.date)}</p>
                  {r.remarks && <p className="text-xs text-gray-400">{r.remarks}</p>}
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600')}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyCard icon={Calendar} message="No individual attendance records yet." />
      )}
    </div>
  );
}

// ─── Academics Tab ────────────────────────────────────────────────────────────

function AcademicsTab({ learnerId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.reports.getFormativeReport(learnerId);
      setReport(r.data || r);
    } catch (e) {
      // Try analytics fallback
      try {
        const r2 = await api.reports.getLearnerAnalytics(learnerId);
        setReport(r2.data || r2);
      } catch {
        setError('Academic records unavailable for this student.');
      }
    } finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-purple" /></div>;
  if (error)   return <EmptyCard icon={BookOpen} message={error} />;
  if (!report) return <EmptyCard icon={BookOpen} message="No academic records yet." />;

  const subjects = report.subjects || report.learningAreas || report.assessments || [];
  const overall  = report.overallGrade || report.performanceLevel || report.average;

  return (
    <div className="space-y-4">
      {/* Overall */}
      {overall && (
        <div className="bg-gradient-to-r from-brand-purple to-purple-700 rounded-2xl p-4 text-white">
          <p className="text-xs opacity-70 uppercase font-semibold">Overall Performance</p>
          <p className="text-3xl font-bold mt-1">{overall}</p>
          {report.term && <p className="text-xs opacity-70 mt-1">{report.term?.replace('_', ' ')} · {report.academicYear}</p>}
        </div>
      )}

      {/* Subject breakdown */}
      {subjects.length > 0 ? (
        <div>
          <SectionHeader title="Subject Results" />
          <div className="space-y-2">
            {subjects.map((s, i) => {
              const grade = s.grade || s.level || s.performanceLevel;
              const score = s.score ?? s.percentage ?? s.marks;
              const isGood = ['EE', 'ME', 'A', 'B'].includes(String(grade).toUpperCase());
              return (
                <div key={s.id || i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.name || s.subject || s.learningArea || s.title}</p>
                    {s.teacher && <p className="text-xs text-gray-400">{s.teacher}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {score != null && (
                      <span className="text-xs text-gray-500">{Math.round(score)}%</span>
                    )}
                    {grade && (
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg', isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                        {grade}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyCard icon={GraduationCap} message="No subject results available yet. Results will appear once assessments are entered." />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: User       },
  { id: 'fees',       label: 'Fees',       icon: CreditCard },
  { id: 'attendance', label: 'Attendance', icon: Calendar   },
  { id: 'academics',  label: 'Academics',  icon: BookOpen   },
];

export default function ParentChildProfile({ child, onBack }) {
  const [tab, setTab] = useState('overview');

  if (!child) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{child.name}</p>
            <p className="text-xs text-gray-400">{child.grade} · {child.className || child.admissionNumber}</p>
          </div>
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold', 'bg-brand-purple')}>
            {child.name?.[0] || '?'}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-100 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 min-w-0',
                tab === id
                  ? 'text-brand-purple border-brand-purple'
                  : 'text-gray-400 border-transparent hover:text-gray-600',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {tab === 'overview'   && <OverviewTab   child={child} />}
        {tab === 'fees'       && <FeesTab       learnerId={child.id} />}
        {tab === 'attendance' && <AttendanceTab learnerId={child.id} />}
        {tab === 'academics'  && <AcademicsTab  learnerId={child.id} />}
      </div>
    </div>
  );
}
