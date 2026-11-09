/**
 * ParentChildProfile
 * Design ref: purple header card + avatar + name + grade/class + Present today badge
 * Tabs: Diary (teacher notes + history) · Fees · Attendance · Learning · More
 * Diary tab: grouped by teacher, with subject tags, priority badges, and 7-day history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, BookOpen, CalendarDays, ChevronRight, ClipboardList, CreditCard, FileText,
  GraduationCap, MessageCircle, MoreVertical, Bus, Headphones,
  CheckCircle2, Loader2, Clock,
  Receipt, Wallet,
} from 'lucide-react';
import api from '../../../../services/api';
import { cn } from '../../../../utils/cn';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import ParentReportCards from './ParentReportCards';
import { ParentChildDiaryWork } from '../parent-portal/ParentPortalHomework';

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

// ─── Teacher Avatar ──────────────────────────────────────────────────────────

function teacherInitials(firstName, lastName) {
  return ((firstName || '').charAt(0) + (lastName || '').charAt(0)).toUpperCase() || '?';
}

function teacherDisplayName(createdBy) {
  if (!createdBy) return 'School';
  const first = createdBy.firstName || '';
  const last  = createdBy.lastName || '';
  return [first, last].filter(Boolean).join(' ').trim() || 'Staff';
}

const SUBJECT_COLORS = [
  'bg-blue-600',    'bg-emerald-600',  'bg-violet-600',   'bg-amber-600',
  'bg-rose-600',    'bg-teal-600',     'bg-indigo-600',   'bg-orange-600',
];
function subjectColor(category) {
  if (!category) return 'bg-slate-600';
  const hash = category.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

const PRIORITY_TONE = {
  URGENT: { ring: 'ring-rose-200', badge: 'bg-rose-100 text-rose-700', label: 'Urgent' },
  HIGH:   { ring: 'ring-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Important' },
  NORMAL: { ring: 'ring-slate-100', badge: '', label: '' },
  LOW:    { ring: 'ring-slate-100', badge: '', label: '' },
};

// ─── Diary Notes Panel ───────────────────────────────────────────────────────

function DiaryNotesPanel({ diaryDate, child }) {
  const [allNotices, setAllNotices] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const dateKey = diaryDate.toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.notices?.getAll?.();
      setAllNotices(res?.data || res || []);
    } catch (e) {
      setError(e?.message || 'Could not load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Split notices into "today" and "history" ──
  const dayStart = new Date(diaryDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(diaryDate); dayEnd.setHours(23, 59, 59, 999);
  const now      = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const todayNotices = allNotices.filter((n) => {
    if (!n.publishedAt) return false;
    const published = new Date(n.publishedAt);
    return published >= dayStart && published <= dayEnd;
  });

  const historyNotices = allNotices.filter((n) => {
    if (!n.publishedAt) return false;
    const published = new Date(n.publishedAt);
    return published < dayStart && published >= sevenDaysAgo;
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // ── Group today's notices by teacher ──
  const teacherGroups = {};
  for (const notice of todayNotices) {
    const teacherId = notice.createdBy?.id || 'school';
    const teacherName = teacherDisplayName(notice.createdBy);
    if (!teacherGroups[teacherId]) {
      teacherGroups[teacherId] = { name: teacherName, initials: teacherInitials(notice.createdBy?.firstName, notice.createdBy?.lastName), notes: [] };
    }
    teacherGroups[teacherId].notes.push(notice);
  }
  const teacherEntries = Object.values(teacherGroups);

  // ── Group history by day ──
  const historyByDay = {};
  for (const notice of historyNotices) {
    const dayKey = new Date(notice.publishedAt).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!historyByDay[dayKey]) historyByDay[dayKey] = [];
    historyByDay[dayKey].push(notice);
  }
  const historyDays = Object.entries(historyByDay);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-slate-200" /><div className="flex-1 space-y-1.5"><div className="h-2.5 w-20 rounded bg-slate-200" /><div className="h-2 w-16 rounded bg-slate-100" /></div></div>
            <div className="mt-2 space-y-1"><div className="h-2 w-full rounded bg-slate-100" /><div className="h-2 w-3/4 rounded bg-slate-100" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5 text-xs text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Today's Notes ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-white text-[11px] font-black">
            {diaryDate.getDate()}
          </span>
          <h3 className="text-sm font-extrabold text-slate-950">Today&rsquo;s notes</h3>
          {todayNotices.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{todayNotices.length} note{todayNotices.length === 1 ? '' : 's'}</span>
          )}
        </div>

        {todayNotices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
            <BookOpen size={22} className="mx-auto text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-700">No notes shared yet today</p>
            <p className="mt-0.5 text-[11px] text-slate-500">When teachers post updates, you&rsquo;ll see them here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teacherEntries.map((group) => (
              <div key={group.name} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Teacher header */}
                <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-extrabold text-indigo-900">{group.initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-950 truncate">{group.name}</p>
                    <p className="text-[10px] text-slate-500">{group.notes.length} note{group.notes.length === 1 ? '' : 's'} shared</p>
                  </div>
                </div>
                {/* Teacher's notes */}
                <div className="divide-y divide-slate-50">
                  {group.notes.map((notice) => {
                    const tone = PRIORITY_TONE[String(notice.priority || 'NORMAL').toUpperCase()] || PRIORITY_TONE.NORMAL;
                    return (
                      <div key={notice.id} className={`px-3 py-2.5 ring-1 ring-inset ${tone.ring}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 flex-1">{notice.title}</p>
                          {tone.label && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tone.badge}`}>{tone.label}</span>}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{notice.content}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {notice.category && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${subjectColor(notice.category)}`}>{notice.category}</span>
                          )}
                          {notice.publishedAt && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(notice.publishedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent History ── */}
      {historyDays.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={15} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-950">Recent history</h3>
            <span className="text-[10px] text-slate-500">Last 7 days</span>
          </div>
          <div className="space-y-1.5">
            {historyDays.slice(0, 5).map(([dayLabel, dayNotices]) => (
              <details key={dayLabel} className="group rounded-lg border border-slate-200 bg-white overflow-hidden">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <span className="text-[11px] font-bold text-slate-700 flex-1">{dayLabel}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{dayNotices.length}</span>
                  <ChevronRight size={13} className="text-slate-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="divide-y divide-slate-50 border-t border-slate-100">
                  {dayNotices.map((notice) => {
                    const teacherName = teacherDisplayName(notice.createdBy);
                    const initials = teacherInitials(notice.createdBy?.firstName, notice.createdBy?.lastName);
                    return (
                      <div key={notice.id} className="flex items-start gap-2 px-3 py-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-extrabold text-indigo-900">{initials}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{notice.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{teacherName}{notice.category ? ` · ${notice.category}` : ''}</p>
                        </div>
                        <span className="shrink-0 text-[9px] text-slate-400">
                          {new Date(notice.publishedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'diary',       label: 'Diary',       icon: BookOpen,       color: 'bg-blue-700' },
  { id: 'fees',        label: 'Fees',        icon: Wallet,         color: 'bg-emerald-700' },
  { id: 'attendance',  label: 'Attendance',  icon: CalendarDays,   color: 'bg-violet-700' },
  { id: 'results',     label: 'Learning',    icon: GraduationCap,  color: 'bg-amber-600' },
  { id: 'more',        label: 'More',        icon: ClipboardList,  color: 'bg-slate-700' },
];

function resolveInitialTab(initialTab, showFees) {
  if (initialTab === 'overview' || initialTab === 'info') return 'diary';
  if (initialTab === 'homework') return 'diary';
  if (initialTab === 'fees' && !showFees) return 'diary';
  return initialTab;
}

const MORE_LINKS = [
  { id: 'parent-portal-school-today', label: 'Check today’s schedule', detail: 'School day and attendance updates', icon: CalendarDays, color: 'bg-blue-700' },
  { id: 'parent-portal-messages', label: 'Message the school', detail: 'Open your school inbox', icon: MessageCircle, color: 'bg-violet-700' },
  { id: 'parent-portal-transport', label: 'Check transport', detail: 'View available transport information', icon: Bus, color: 'bg-orange-600' },
  { id: 'parent-portal-documents', label: 'Open school documents', detail: 'View documents shared with your family', icon: FileText, color: 'bg-teal-700' },
  { id: 'parent-portal-support', label: 'Get help', detail: 'Contact school support', icon: Headphones, color: 'bg-slate-700' },
];

function MoreTab({ onNavigate, activeSlugs }) {
  const links = MORE_LINKS.filter(item => hasPageAccess({ enabledApps: activeSlugs }, item.id));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {links.map(({ id, label, detail, icon: Icon, color }) => (
        <button key={id} type="button" onClick={() => onNavigate?.(id)} className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${color}`}><Icon size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950">{label}</span><span className="block text-xs text-slate-600">{detail}</span></span>
          <ChevronRight size={17} className="shrink-0 text-slate-500" />
        </button>
      ))}
    </div>
  );
}

export default function ParentChildProfile({ child, siblings = [], onSelectChild, onNavigate, onBack, initialTab = 'diary' }) {
  const { activeSlugs } = useModuleAccess();
  const showFees = hasPageAccess({ enabledApps: activeSlugs }, 'parent-portal-fees');
  const visibleTabs = showFees ? TABS : TABS.filter((item) => item.id !== 'fees');
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab, showFees));
  const [diaryDate, setDiaryDate] = useState(() => new Date());
  useEffect(() => {
    if (!showFees && tab === 'fees') setTab('diary');
    if (tab === 'overview' || tab === 'info') setTab('diary');
  }, [showFees, tab]);
  if (!child) return null;

  const isPresent = child.todayStatus === 'PRESENT' || child.isPresent;
  const shiftDiaryDate = (amount) => setDiaryDate(current => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount));

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      <div className="mx-auto max-w-4xl px-3 pt-3 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to family overview" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"><ArrowLeft size={18} /></button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-900">{child.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}</div>
            <div className="min-w-0"><h1 className="truncate text-base font-extrabold text-slate-950">{child.name}</h1><p className="truncate text-xs font-medium text-slate-600">{child.grade} · {child.className || 'Class'}{isPresent ? ' · Present today' : ''}</p></div>
          </div>
          {siblings.length > 1 && <label className="sr-only" htmlFor="parent-child-switcher">Choose child</label>}
          {siblings.length > 1 && <select id="parent-child-switcher" value={child.id} onChange={e => onSelectChild?.(siblings.find(s => String(s.id) === e.target.value))} className="max-w-28 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800"><option value={child.id}>{child.name?.split(' ')[0]}</option>{siblings.filter(s => String(s.id) !== String(child.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        </div>

        {/* Compact horizontal tab pills — keeps nav minimal so content gets focus */}
        <nav aria-label="Child activities" className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-1.5">
          {visibleTabs.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors',
                tab === id
                  ? 'bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded text-white ${color}`}><Icon size={12} /></span>
              {label}
            </button>
          ))}
        </nav>

      {/* Tab content */}
      <div className="min-w-0">
        {tab === 'diary' && <div className="space-y-3">
          {/* Date picker — clean, direct */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Showing notes for</p><p className="text-xs font-extrabold text-slate-950">{diaryDate.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
            <div className="flex items-center gap-1"><button type="button" onClick={() => shiftDiaryDate(-1)} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} /></button><button type="button" onClick={() => setDiaryDate(new Date())} className="min-h-9 rounded-lg px-2 text-xs font-bold text-indigo-800 hover:bg-indigo-50">Today</button><button type="button" onClick={() => shiftDiaryDate(1)} aria-label="Next day" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"><ChevronRight size={16} /></button></div>
          </div>
          {/* Teacher notes + history */}
          <DiaryNotesPanel diaryDate={diaryDate} child={child} />
          {/* Homework */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-700 text-white"><ClipboardList size={17} /></span>
              <div><h2 className="text-sm font-extrabold text-slate-950">Homework</h2><p className="text-xs text-slate-600">Check work, due dates and teacher feedback.</p></div>
            </div>
            <ParentChildDiaryWork child={child} />
          </section>
        </div>}
        {tab === 'results'    && <ResultsTab    child={child} />}
        {tab === 'attendance' && <AttendanceTab learnerId={child.id} />}
        {showFees && tab === 'fees' && <FeesTab learnerId={child.id} />}
        {tab === 'more' && <MoreTab onNavigate={onNavigate} activeSlugs={activeSlugs} />}
      </div>

      </div>
    </div>
  );
}
