/**
 * ParentDashboard — Responsive parent portal dashboard
 * Inspired by Notion / Linear / Stripe Dashboard
 * Sections with no live endpoint are clearly marked with ⚠️ NO_ENDPOINT
 * so the backend team can prioritise API work.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import EditStudentModal from '../parent/EditStudentModal';
import MobilePortalAppBar from '../../layout/MobilePortalAppBar';
import {
  Wallet, BarChart3, ClipboardCheck, FileText as FileTextIcon,
  MessageSquare, Bus, HeartHandshake, Heart, Gift,
  Users, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown,
  MessageCircle, User, AlertTriangle, RefreshCw, Bell,
  Utensils, Dumbbell, TreePine,
  School, FlaskConical, BookOpen, Monitor, Music,
  Megaphone, GraduationCap,
  ArrowRight, HelpCircle, BookMarked, Flag,
  Clock, Pencil,
} from 'lucide-react';
import { Skeleton } from '../../../ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return { title: 'Still up?', sensation: 'A quiet night to check in gently.' };
  if (hour < 12) return { title: 'Good morning', sensation: 'A fresh school day is starting.' };
  if (hour < 17) return { title: 'Good afternoon', sensation: 'The school day is in motion.' };
  if (hour < 21) return { title: 'Good evening', sensation: 'A calm moment to review the day.' };
  return { title: 'Good night', sensation: 'Tomorrow is nearly here.' };
};

const getUpcomingNotice = (notices = []) => {
  const now = Date.now();
  return notices
    .map((notice) => {
      const value = notice.publishedAt || notice.date || notice.startDate;
      const time = value ? new Date(value).getTime() : NaN;
      return { ...notice, _time: time };
    })
    .filter((notice) => Number.isFinite(notice._time) && notice._time > now)
    .sort((a, b) => a._time - b._time)[0] || null;
};

function MobileGreeting({ user, metrics, onNavigate }) {
  const greeting = getTimeGreeting();
  const upcoming = getUpcomingNotice(metrics?.notices || metrics?.upcomingEvents || []);
  const firstName = user?.firstName || user?.name?.split(' ')?.[0] || 'there';

  return (
    <div className="md:hidden space-y-3">
      <div>
        <p className="text-xl font-bold text-gray-900">{greeting.title}, {firstName}</p>
        <p className="text-sm text-gray-500 mt-0.5">{greeting.sensation}</p>
      </div>
      {upcoming && (
        <button
          type="button"
          onClick={() => onNavigate('comm-notices')}
          className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-left"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#4F46E5]">Upcoming</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{upcoming.title}</p>
          {upcoming.timeLabel && <p className="text-xs text-gray-500 mt-0.5">{upcoming.timeLabel}</p>}
        </button>
      )}
    </div>
  );
}

// ─── Hero Summary Card ────────────────────────────────────────────────────────
function HeroCard({ metrics, loading, onNavigate }) {
  const stats = metrics?.stats || {};
  const children = metrics?.children || [];
  const messages = metrics?.messages || [];
  const totalBalance = Number(stats.totalBalance || 0);
  const [balVisible, setBalVisible] = useState(true);
  const unread = messages.filter(m => m.unread || m.isUnread).length;

  const miniStats = [
    { label: 'Children', value: children.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Avg. Attendance', value: `${Math.round(stats.avgAttendance || 0)}%`, icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Avg. Performance', value: stats.avgPerformance ? `${Math.round(stats.avgPerformance)}%` : '—', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unread Messages', value: unread, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white shadow-sm">
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-sky-300/20" />
      <div className="relative flex flex-col xl:flex-row xl:items-stretch xl:divide-x divide-white/15">
        {/* Balance side */}
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-1">Total Outstanding Balance</p>
              <p className="text-xs text-blue-100/90">
                Across {children.length} child{children.length !== 1 ? 'ren' : ''}
              </p>
            </div>
            <button
              onClick={() => setBalVisible(v => !v)}
              className="h-9 w-9 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors flex items-center justify-center flex-shrink-0"
              aria-label={balVisible ? 'Hide balance' : 'Show balance'}
            >
              {balVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {loading ? <Skeleton className="h-10 w-48 mb-3" /> : (
            <div className="mt-3 mb-4">
              <p className="text-3xl sm:text-4xl font-black tracking-tight">
                {balVisible ? `KES ${fmt(totalBalance)}` : 'KES ••••••'}
              </p>
              <p className="text-xs text-blue-100 mt-1">
                {totalBalance > 0 ? 'Tap Pay Fees to clear the balance.' : 'All balances are cleared.'}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:flex sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('parent-portal-fees')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors"
            >
              <Wallet size={14} /> Pay Fees
            </button>
            <button
              onClick={() => onNavigate('fees-statements')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/12 text-white text-sm font-bold rounded-xl ring-1 ring-white/20 hover:bg-white/20 transition-colors"
            >
              <FileTextIcon size={14} /> View Statement
            </button>
          </div>
        </div>
        {/* Mini stats */}
        <div className="hidden sm:grid sm:grid-cols-4 xl:flex sm:divide-x divide-white/15 border-t xl:border-t-0 border-white/15 bg-white/8 backdrop-blur-sm">
          {miniStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex flex-col items-center justify-center px-3 sm:px-6 py-4 min-w-0 xl:min-w-[110px]">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mb-2">
                  <Icon size={16} className="text-white" />
                </div>
                {loading ? <Skeleton className="h-6 w-10 mb-1" /> : (
                  <p className="text-xl font-bold text-white">{s.value}</p>
                )}
                <p className="text-xs text-blue-100 text-center leading-tight mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Student Card Carousel ────────────────────────────────────────────────────
function StudentCard({ child, brandingSettings, onNavigate, onEdit }) {
  const balance = Number(child.feeBalance || 0);
  const attendance = Math.round(Number(child.attendanceRate || 0));

  const photoSrc = child.photoUrl || child.profilePicture || child.photo || brandingSettings?.logoUrl || null;
  const initials = (child.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const statusLabel = child.status === 'ACTIVE' ? 'Active' : child.status === 'ON_LEAVE' ? 'On Leave' : 'Present';
  const statusColor = child.status === 'ON_LEAVE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="w-full bg-[#4F46E5] rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden select-none">
      {/* Status badge + Edit button */}
      <span className={`absolute top-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
        {statusLabel}
      </span>
      <button
        onClick={onEdit}
        title="Edit student profile"
        className="absolute top-4 right-[90px] w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
      >
        <Pencil size={13} className="text-white" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-[100px] h-[100px] rounded-full object-cover border-4 border-white shadow-lg"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-[100px] h-[100px] rounded-full bg-white/20 border-4 border-white shadow-lg items-center justify-center text-2xl font-bold text-white"
          >
            {initials}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-1">
          <h2 className="text-xl sm:text-2xl font-bold break-words">{child.name}</h2>
          <p className="text-indigo-200 text-sm mt-0.5">{child.grade} · {child.className || 'Class'}</p>

          <div className="grid grid-cols-2 gap-4 mt-5 max-w-sm">
            <div>
              <p className="text-indigo-200 text-xs uppercase tracking-wider mb-0.5">Balance</p>
              <p className={`text-base font-bold ${balance > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {balance > 0 ? `KES ${fmt(balance)}` : '✓ Cleared'}
              </p>
            </div>
            <div>
              <p className="text-indigo-200 text-xs uppercase tracking-wider mb-0.5">Attendance</p>
              <p className="text-base font-bold text-white">{attendance}%</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              onClick={() => onNavigate('comm-messages')}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-[#4F46E5] text-sm font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <MessageCircle size={14} /> Contact Class Teacher
            </button>
            <button
              onClick={() => onNavigate('learner-profile', { learner: child })}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 text-white text-sm font-semibold rounded-lg hover:bg-white/25 transition-colors border border-white/20"
            >
              <User size={14} /> View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStudentTile({ child, brandingSettings, onSelect }) {
  const photoSrc = child.photoUrl || child.profilePicture || child.photo || brandingSettings?.logoUrl || null;
  const initials = (child.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      className="min-h-[138px] rounded-2xl bg-[#4F46E5] p-3 text-left shadow-sm active:scale-[0.99] transition text-white relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-sm font-bold leading-tight break-words">
            {child.name}
          </p>
          <p className="text-xs font-semibold text-indigo-100 mt-2 truncate">
            {child.grade} {child.className || ''}
          </p>
          <p className="text-[11px] text-indigo-200 mt-1 truncate">
            Adm. {child.admissionNumber || 'N/A'}
          </p>
        </div>

        <div className="relative flex-shrink-0">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-14 h-14 rounded-full bg-white/20 border-2 border-white shadow items-center justify-center text-sm font-bold"
          >
            {initials}
          </div>
          <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white text-[#4F46E5] border-2 border-[#4F46E5] flex items-center justify-center shadow-sm">
            <Bell size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

function StudentSection({ children, brandingSettings, loading, onNavigate, onEditChild }) {
  const [active, setActive] = useState(0);
  const [selectedMobileChild, setSelectedMobileChild] = useState(null);
  const timerRef = useRef(null);
  const paused = useRef(false);

  const next = useCallback(() => setActive(i => (i + 1) % children.length), [children.length]);
  const prev = useCallback(() => setActive(i => (i - 1 + children.length) % children.length), [children.length]);

  useEffect(() => {
    if (children.length <= 1) return;
    timerRef.current = setInterval(() => { if (!paused.current) next(); }, 8000);
    return () => clearInterval(timerRef.current);
  }, [children.length, next]);

  if (loading) return <Skeleton className="h-52 w-full" />;
  if (!children.length) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
        <User size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500 font-medium">No linked students</p>
        <p className="text-xs text-gray-400 mt-1">Children linked to your account will appear here.</p>
      </div>
    );
  }

  const mobileChild = selectedMobileChild
    ? children.find(child => child.id === selectedMobileChild.id) || selectedMobileChild
    : null;

  return (
    <div>
      <div className="md:hidden">
        {mobileChild ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedMobileChild(null)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600"
            >
              <ChevronLeft size={16} /> Students
            </button>
            <StudentCard
              child={mobileChild}
              brandingSettings={brandingSettings}
              onNavigate={onNavigate}
              onEdit={() => onEditChild(mobileChild)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {children.map(child => (
              <MobileStudentTile
                key={child.id}
                child={child}
                brandingSettings={brandingSettings}
                onSelect={() => setSelectedMobileChild(child)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="relative hidden md:block"
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
      >
        <StudentCard
          child={children[active]}
          brandingSettings={brandingSettings}
          onNavigate={onNavigate}
          onEdit={() => onEditChild(children[active])}
        />
        {children.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 sm:left-[-18px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <button onClick={next} className="absolute right-2 sm:right-[-18px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
            <div className="flex justify-center gap-1.5 mt-3">
              {children.map((_, i) => (
                <button key={i} onClick={() => setActive(i)} className={`w-2 h-2 rounded-full transition-all ${i === active ? 'bg-[#4F46E5] w-4' : 'bg-gray-300'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActions({ onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const actions = [
    { label: 'Academic Reports', sub: 'View performance', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', path: 'parent-portal-results' },
    { label: 'Fees', sub: 'Make payments', icon: Wallet, color: 'text-[#4F46E5]', bg: 'bg-indigo-50', border: 'border-indigo-200', path: 'parent-portal-fees' },
    { label: 'Attendance', sub: 'View records', icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', path: 'parent-portal-attendance' },
    { label: 'Trips', sub: 'View & book', icon: Bus, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', beta: 'bg-rose-100 text-rose-700 border-rose-200', path: 'parent-portal-transport' },
    { label: 'Apply for Scholarship', sub: 'View & apply', icon: HeartHandshake, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', beta: 'bg-purple-100 text-purple-700 border-purple-200', path: 'comm-notices' },
    { label: 'Refer a Student', sub: 'Points for cash or fees', icon: Gift, color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200', beta: 'bg-lime-100 text-lime-800 border-lime-200', path: 'comm-notices' },
    { label: 'Needy Children', sub: 'Support a child', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', beta: 'bg-pink-100 text-pink-700 border-pink-200', path: 'comm-notices' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Quick Actions</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {actions.length} shortcuts · Academic reports, fees, attendance and more
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => onNavigate(a.path)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 border border-gray-100 transition-all text-left group min-h-[74px]"
              >
                <div className={`w-11 h-11 rounded-lg ${a.bg} ${a.border} border flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={a.color} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{a.label}</p>
                    {a.beta && (
                      <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${a.beta}`}>
                        Beta
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── School Pulse ─────────────────────────────────────────────────────────────
// ⚠️ NO_ENDPOINT: School Pulse requires a dedicated timetable/schedule API.
// Currently uses deterministic time-of-day logic as a placeholder.
// TODO: Backend to expose GET /api/school-pulse?studentId=X returning
// { current, next, later: [], tomorrow: [] }

const PULSE_SUBJECTS = [
  { time: '7:00–7:45', label: 'Mathematics', teacher: 'Mr. Otieno', form: 'Form 1A', icon: FlaskConical, color: 'bg-blue-500' },
  { time: '7:50–8:35', label: 'Kiswahili', teacher: 'Ms. Njeri', form: 'Form 1A', icon: BookOpen, color: 'bg-purple-500' },
  { time: '8:40–9:25', label: 'ICT', teacher: 'Mr. Otieno', form: 'Form 1A', icon: Monitor, color: 'bg-indigo-500' },
  { time: '9:25–10:00', label: 'Lunch & Rest', teacher: 'All Students', form: null, icon: Utensils, color: 'bg-orange-400', isBreak: true },
  { time: '10:05–10:50', label: 'Physical Education', teacher: 'Coach Brian', form: 'All Forms', icon: Dumbbell, color: 'bg-rose-500' },
];

function getTimeSlot() {
  const h = new Date().getHours();
  if (h < 7) return { idx: -1, label: 'School not started', icon: School, isBreak: true };
  if (h >= 16) return { idx: -1, label: 'School day ended', icon: School, isBreak: true };
  if (h >= 9 && h < 10) return { idx: 3 }; // lunch
  const slotMap = [[7, 8, 0], [8, 8.5, 1], [8.5, 9, 2], [10, 11, 4]];
  for (const [start, end, idx] of slotMap) {
    if (h >= start && h < end) return { idx };
  }
  return { idx: 0 };
}

function SchoolPulse({ metrics, children = [] }) {
  const [, setMinuteTick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setMinuteTick(tick => tick + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ⚠️ NO_ENDPOINT: using placeholder schedule data
  const slot = getTimeSlot();
  const currentIdx = slot.idx ?? 0;
  const slots = PULSE_SUBJECTS;
  const current = slots[currentIdx] || slots[0];
  const nextItems = slots.slice(currentIdx + 1, currentIdx + 4);
  const nextLesson = nextItems[0] || slots[0];
  const contextChild = children[0];
  const contextLabel = children.length > 1 && contextChild
    ? `${contextChild.name?.split(' ')?.[0] || 'Student'} · ${contextChild.grade} ${contextChild.className || ''}`.trim()
    : null;

  const laterToday = [
    { time: '2:10 PM', label: 'Debate Club', room: 'Rm 12' },
    { time: '4:00 PM', label: 'Music Club', room: 'Hall' },
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#4F46E5] via-sky-400 to-emerald-300 p-[1.5px] shadow-sm">
      <div className="bg-white rounded-2xl p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">School Pulse</h3>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {contextLabel ? `Showing pulse for ${contextLabel}` : 'Real-time school day snapshot'}
            </p>
            <p className="text-xs font-semibold text-gray-700 mt-2 truncate">
              Now: {current.label} · Next: {nextLesson.label}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              Auto-refreshes <RefreshCw size={12} className="ml-1" />
            </span>
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {expanded && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-3 mt-4">
              <div className="rounded-xl border border-[#4F46E5]/30 bg-[#4F46E5]/5 p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${current.color} flex items-center justify-center flex-shrink-0`}>
                    <current.icon size={18} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-[#4F46E5] uppercase tracking-wider">In Progress</p>
                    <p className="text-xs text-gray-500 mt-1">{current.time}</p>
                    <p className="text-base sm:text-sm font-bold text-gray-900 leading-tight">{current.label}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {[current.teacher, current.form || contextLabel].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${nextLesson.color} flex items-center justify-center flex-shrink-0`}>
                    <nextLesson.icon size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Next Lesson</p>
                    <p className="text-xs text-gray-500 mt-1">{nextLesson.time}</p>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{nextLesson.label}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {[nextLesson.teacher, nextLesson.form].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Later Today</p>
                {laterToday.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1.5 last:mb-0">
                    <Clock size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 leading-tight">{e.time} · {e.label}</p>
                      <p className="text-[10px] text-gray-400">{e.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] text-gray-400 leading-tight">
                Pulse adapts to lessons, breaks, clubs, and exam-day schedules.
              </p>
              <button className="text-xs font-semibold text-[#4F46E5] flex items-center gap-1 hover:underline flex-shrink-0">
                View Full <ArrowRight size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Alumni & Clubs ───────────────────────────────────────────────────────────
// ⚠️ NO_ENDPOINT: Alumni & Clubs module does not exist yet.
// TODO: Create /api/clubs route returning { name, icon, memberCount }[]
// and /api/alumni with community links.
const PLACEHOLDER_CLUBS = [
  { name: 'Robotics Club', icon: Monitor, color: 'bg-blue-100 text-blue-600' },
  { name: 'Debate Club', icon: MessageSquare, color: 'bg-purple-100 text-purple-600' },
  { name: 'Environment Club', icon: TreePine, color: 'bg-emerald-100 text-emerald-600' },
  { name: 'Music Club', icon: Music, color: 'bg-amber-100 text-amber-600' },
];

function AlumniClubsCard({ onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#312E81] rounded-2xl p-4 text-white h-full flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Alumni & Clubs</h3>
          <p className="text-xs text-indigo-200 mt-1 truncate">
            {PLACEHOLDER_CLUBS.length} active clubs · alumni network
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`text-indigo-200 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <button onClick={() => onNavigate('comm-notices')} className="text-xs text-indigo-300 hover:text-white transition-colors">View all</button>
          </div>
          <p className="text-indigo-200 text-xs mb-1">Stay connected.</p>
          <p className="text-indigo-200 text-xs mb-3">Inspire. Support. Grow.</p>
          <button
            onClick={() => onNavigate('comm-notices')}
            className="mb-4 px-4 py-2 bg-white text-[#312E81] text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors self-start"
          >
            Join Alumni Network
          </button>
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-3">Active Clubs</p>
          <div className="grid grid-cols-2 gap-2 flex-1">
            {PLACEHOLDER_CLUBS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.name} className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-2">
                  <div className={`w-6 h-6 rounded-full ${c.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={12} />
                  </div>
                  <span className="text-[10px] font-semibold text-white truncate">{c.name}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-indigo-400 mt-3">⚠️ Module coming soon — no live endpoint yet</p>
        </div>
      )}
    </div>
  );
}

// ─── School Gallery ───────────────────────────────────────────────────────────
// ⚠️ NO_ENDPOINT: School Gallery module does not exist yet.
// TODO: Create /api/gallery returning { id, url, caption, date }[]
// and a gallery management page in the admin section.
const PLACEHOLDER_GALLERY = [
  'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=200&q=80',
  'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&q=80',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=200&q=80',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=200&q=80',
];

function SchoolGalleryCard({ onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 h-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">School Gallery</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {PLACEHOLDER_GALLERY.length} recent school moments
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <button onClick={() => onNavigate('comm-notices')} className="text-xs text-[#4F46E5] font-semibold hover:underline">View all</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PLACEHOLDER_GALLERY.map((src, i) => (
              i < 3 ? (
                <img key={i} src={src} alt="School gallery" className="w-full h-24 object-cover rounded-lg" />
              ) : (
                <div key={i} className="relative">
                  <img src={src} alt="Gallery" className="w-full h-24 object-cover rounded-lg opacity-60" />
                  <div className="absolute inset-0 bg-gray-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">+32 More</span>
                  </div>
                </div>
              )
            ))}
          </div>
          <p className="text-[9px] text-gray-400 mt-3">⚠️ No gallery endpoint yet — showing placeholder images</p>
        </div>
      )}
    </div>
  );
}

// ─── Latest Newsletter ────────────────────────────────────────────────────────
// ⚠️ NO_ENDPOINT: Newsletter module does not exist yet.
// TODO: Create /api/newsletters returning { id, title, date, excerpt, url }[]
const PLACEHOLDER_NEWSLETTERS = [
  { month: 'MAY', day: '10', title: 'May Newsletter 2024', excerpt: 'Highlights, achievements and important updates.', year: 2024 },
  { month: 'APR', day: '05', title: 'April Newsletter 2024', excerpt: 'School activities and student spotlight.', year: 2024 },
];

function LatestNewsletterCard({ onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const latest = PLACEHOLDER_NEWSLETTERS[0];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 h-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Latest Newsletter</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {latest ? `${latest.month} ${latest.day} - ${latest.title}` : 'No newsletter available'}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <button onClick={() => onNavigate('comm-notices')} className="text-xs text-[#4F46E5] font-semibold hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {PLACEHOLDER_NEWSLETTERS.map((n, i) => (
              <div key={i} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-[10px] font-bold text-[#4F46E5] uppercase">{n.month}</p>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{n.day}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.excerpt}</p>
                  <button onClick={() => onNavigate('comm-notices')} className="text-xs text-[#4F46E5] font-semibold mt-1 flex items-center gap-1 hover:underline">
                    Read more <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-gray-400 mt-3">⚠️ No newsletter endpoint yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────
function AnnouncementsCard({ metrics, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const notices = (metrics?.notices || []).slice(0, 3);
  const placeholders = [
    { id: 'p1', title: 'Uniform Update', date: '2 hours ago', tag: 'New', icon: School, color: 'bg-blue-50 text-blue-600', tagColor: 'bg-blue-100 text-blue-700' },
    { id: 'p2', title: "Parents' Day 2024", date: '1 day ago', tag: null, icon: GraduationCap, color: 'bg-purple-50 text-purple-600', tagColor: null },
    { id: 'p3', title: 'Fee Reminder', date: '2 days ago', tag: null, icon: Wallet, color: 'bg-amber-50 text-amber-600', tagColor: null },
  ];
  const items = notices.length > 0 ? notices.map((n, i) => ({
    id: n.id, title: n.title, date: n.timeLabel || 'Published', tag: null,
    icon: placeholders[i % 3]?.icon || Megaphone,
    color: placeholders[i % 3]?.color || 'bg-gray-50 text-gray-600',
    tagColor: null,
  })) : placeholders;
  const firstItem = items[0];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 h-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Announcements</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {firstItem ? `${items.length} updates - ${firstItem.title}` : 'No announcements yet'}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <button onClick={() => onNavigate('comm-notices')} className="text-xs text-[#4F46E5] font-semibold hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                      {item.tag && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.tagColor}`}>{item.tag}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{item.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Footer Utility ───────────────────────────────────────────────────────────
function FooterUtility({ onNavigate }) {
  const links = [
    { label: 'School Trips', sub: 'View upcoming trips', icon: Bus, path: 'parent-portal-transport' },
    { label: 'Parent Handbook', sub: 'Read school policies', icon: BookMarked, path: 'comm-notices' },
    { label: 'Report an Issue', sub: "Let us know if something's wrong", icon: Flag, path: 'comm-messages' },
    { label: 'Visit Help Center', sub: 'Find answers to common questions', icon: HelpCircle, path: 'comm-notices' },
  ];
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.label}
              onClick={() => onNavigate(l.path)}
              className="flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-colors text-left"
            >
              <Icon size={18} className="text-[#4F46E5] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-800">{l.label}</p>
                <p className="text-[10px] text-gray-400">{l.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-gray-200 pt-3 text-center">
        <p className="text-[10px] font-semibold tracking-wide text-gray-400">
          © {new Date().getFullYear()} Trends CORE™. Crafted for connected school communities. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ─── Main ParentDashboard ─────────────────────────────────────────────────────
const ParentDashboard = ({ user, onNavigate, onLogout, brandingSettings }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [editingChild, setEditingChild] = useState(null);
  const userId = user?.id || user?.userId;

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load parent metrics:', error);
      if (rolePreview?.isPreviewingRole) { setMetrics({}); return; }
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [rolePreview?.isPreviewingRole]);

  useEffect(() => { loadMetrics(); }, [userId, loadMetrics]);

  const handleChildSaved = useCallback((updatedChild) => {
    // Optimistically update the metrics in local state so the card reflects
    // the new name/photo immediately without a full reload
    setMetrics(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        children: (prev.children || []).map(c => {
          if (c.id !== updatedChild.id) return c;
          const nextPhoto = updatedChild.photoUrl || updatedChild.profilePicture || updatedChild.photo;
          return {
            ...c,
            name: updatedChild.name,
            photo: nextPhoto || c.photo,
            photoUrl: nextPhoto || c.photoUrl,
            profilePicture: nextPhoto || c.profilePicture,
          };
        }),
      };
    });
  }, []);

  if (apiError && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-sm font-semibold text-gray-700">Dashboard unavailable</p>
        <p className="text-xs text-gray-400">{apiError}</p>
        <button onClick={loadMetrics} className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-semibold rounded-lg hover:bg-[#4338ca] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const children = metrics?.children || [];

  return (
    <div className="space-y-5 pb-10 px-4 md:px-0">
      <div className="block md:hidden -mx-4 -mt-4 mb-4">
        <MobilePortalAppBar
          user={user}
          onNavigate={onNavigate}
          onLogout={onLogout}
          brandingSettings={brandingSettings}
          accentColor="#4F46E5"
          bellTarget="parent-portal-messages"
        />
      </div>
      <MobileGreeting user={user} metrics={metrics} onNavigate={onNavigate} />

      {/* Edit Student Modal */}
      {editingChild && (
        <EditStudentModal
          child={editingChild}
          brandingSettings={brandingSettings}
          onClose={() => setEditingChild(null)}
          onSaved={handleChildSaved}
        />
      )}

      {/* Hero */}
      <HeroCard metrics={metrics} loading={loading} onNavigate={onNavigate} />

      {/* Student + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudentSection
          children={children}
          brandingSettings={brandingSettings}
          loading={loading}
          onNavigate={onNavigate}
          onEditChild={setEditingChild}
        />
        <QuickActions onNavigate={onNavigate} />
      </div>

      {/* School Pulse */}
      <SchoolPulse metrics={metrics} children={children} />

      {/* Bottom 4-col section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlumniClubsCard onNavigate={onNavigate} />
        <SchoolGalleryCard onNavigate={onNavigate} />
        <LatestNewsletterCard onNavigate={onNavigate} />
        <AnnouncementsCard metrics={metrics} onNavigate={onNavigate} />
      </div>

      {/* Footer utility */}
      <FooterUtility onNavigate={onNavigate} />
    </div>
  );
};

export default ParentDashboard;
