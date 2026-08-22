/**
 * ParentDashboard — Redesigned parent portal home
 *
 * Architecture: dashboard = family overview. Sidebar / nav = module entry points.
 *
 * Sections:
 *   Header        — greeting + date
 *   My Children   — scannable child cards (Present · Attendance · Balance · Term avg)
 *   My Balance    — total outstanding with per-child breakdown + pay/statement CTAs
 *   Communication — unified message preview (school msgs + chats merged)
 *   School Today  — child-aware timetable snapshot
 *
 * Removed: QuickActions, SchoolPulse, LatestNewsletterCard, AnnouncementsCard,
 *          FooterUtility, HeroCard
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BarChart3, Bell,
  BookOpen, Calendar, CheckCircle2, ChevronRight,
  ClipboardCheck, Eye, EyeOff, FileText, GraduationCap,
  HelpCircle, Loader2, MessageSquare, Pencil,
  Users, Wallet,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import MobilePortalAppBar from '../../layout/MobilePortalAppBar';
import EditStudentModal from '../parent/EditStudentModal';
import { Skeleton } from '../../../ui';
import { useUserNotifications } from '../../../../contexts/UserNotificationContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

const getTimeGreeting = () => {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
};

const attendanceColor = (rate) => {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 75) return 'text-amber-500';
  return 'text-rose-500';
};

const balanceColor = (bal) => bal > 0 ? 'text-rose-600' : 'text-emerald-600';

const getChildPhoto = (child) =>
  child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

// ─── ChildCard ────────────────────────────────────────────────────────────────
// Answers: who is my child, how are they doing, do I need to act?

function ChildCard({ child, showFees, onViewChild, onEditChild }) {
  const balance    = Number(child.feeBalance || 0);
  const attendance = Math.round(Number(child.attendanceRate || 0));
  const termAvg    = child.termAverage != null ? Math.round(Number(child.termAverage)) : null;
  const isPresent  = child.todayStatus === 'PRESENT' || child.isPresent;
  const photoSrc   = getChildPhoto(child);
  const initials   = (child.name || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Child identity row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="relative flex-shrink-0">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#3B1FA3]/30"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-12 h-12 rounded-full bg-[#3B1FA3]/10 border-2 border-[#3B1FA3]/20 text-[#3B1FA3] font-black text-base items-center justify-center flex-shrink-0"
          >
            {initials}
          </div>
          {/* Presence dot */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isPresent ? 'bg-emerald-500' : 'bg-gray-300'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
          <p className="text-xs text-gray-500">{child.grade} · {child.className || 'Class'}</p>
          <p className={`text-[10px] font-semibold mt-0.5 ${isPresent ? 'text-emerald-600' : 'text-gray-400'}`}>
            {isPresent ? '● Present today' : '○ Absent today'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEditChild(child)}
          className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 flex-shrink-0"
        >
          <Pencil size={12} />
        </button>
      </div>

      {/* Stats row */}
      <div className={`grid gap-0 border-t border-gray-100 divide-x divide-gray-100 ${showFees ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Attendance</p>
          <p className={`text-base font-black mt-0.5 ${attendanceColor(attendance)}`}>{attendance}%</p>
          <p className="text-[9px] text-gray-400">This term</p>
        </div>
        {showFees && (
          <div className="px-3 py-2.5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Balance</p>
            <p className={`text-base font-black mt-0.5 ${balanceColor(balance)}`}>
              {balance > 0 ? `KES ${fmt(balance)}` : 'Cleared'}
            </p>
            <p className="text-[9px] text-gray-400">{balance > 0 ? 'Due' : 'Settled'}</p>
          </div>
        )}
        <div className="px-3 py-2.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">This term</p>
          <p className={`text-base font-black mt-0.5 ${termAvg != null ? attendanceColor(termAvg) : 'text-gray-400'}`}>
            {termAvg != null ? `${termAvg}%` : '—'}
          </p>
          <p className="text-[9px] text-gray-400">Avg score</p>
        </div>
      </div>

      {/* View dashboard CTA */}
      <button
        type="button"
        onClick={() => onViewChild(child)}
        className="w-full flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs font-semibold text-[#3B1FA3] hover:bg-[#3B1FA3]/5 transition-colors"
      >
        View child dashboard
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── MyChildren ───────────────────────────────────────────────────────────────

function MyChildren({ children, loading, showFees, onViewChild, onEditChild, onNavigate }) {
  if (loading) {
    return (
      <section>
        <SectionHeader title="My Children" action="View all" onAction={() => onNavigate('parent-portal-children')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </section>
    );
  }

  if (!children.length) {
    return (
      <section>
        <SectionHeader title="My Children" />
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <Users size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No children linked to your account</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="My Children"
        subtitle={`${children.length} enrolled`}
        action="View all"
        onAction={() => onNavigate('parent-portal-children')}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children.map(child => (
          <ChildCard
            key={child.id}
            child={child}
            showFees={showFees}
            onViewChild={onViewChild}
            onEditChild={onEditChild}
          />
        ))}
      </div>
    </section>
  );
}

// ─── MyBalance ────────────────────────────────────────────────────────────────

function MyBalance({ metrics, loading, onNavigate }) {
  const [visible, setVisible] = useState(true);
  const stats = metrics?.stats || {};
  const children = metrics?.children || [];
  const total = Number(stats.totalBalance || 0);

  if (loading) return <Skeleton className="h-36 rounded-2xl" />;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">My Balance</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-black ${balanceColor(total)}`}>
              {visible ? `KES ${fmt(total)}` : 'KES ••••'}
            </p>
            <button
              type="button"
              onClick={() => setVisible(v => !v)}
              className="text-gray-400 hover:text-gray-600"
            >
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Total outstanding</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#3B1FA3]/10 flex items-center justify-center">
          <Wallet size={20} className="text-[#3B1FA3]" />
        </div>
      </div>

      {/* Per-child breakdown */}
      {children.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {children.map(child => {
            const bal = Number(child.feeBalance || 0);
            return (
              <div key={child.id} className="flex items-center justify-between">
                <p className="text-xs text-gray-600 font-medium truncate flex-1 mr-2">{child.name?.split(' ')[0]} {child.name?.split(' ')[1] || ''}</p>
                <p className={`text-xs font-bold flex-shrink-0 ${balanceColor(bal)}`}>
                  {bal > 0 ? `KES ${fmt(bal)}` : 'Cleared'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => onNavigate('parent-portal-fees')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#3B1FA3] text-white text-xs font-bold rounded-xl hover:bg-[#2d1680] transition-colors"
        >
          <Wallet size={13} /> Pay fees
        </button>
        <button
          type="button"
          onClick={() => onNavigate('fees-statements')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors"
        >
          <FileText size={13} /> Statement
        </button>
      </div>
    </section>
  );
}

// ─── CommunicationPreview ─────────────────────────────────────────────────────

function CommunicationPreview({ metrics, loading, onNavigate }) {
  const { unreadCount = 0 } = useUserNotifications?.() || {};
  const messages = (metrics?.messages || []).slice(0, 3);

  const SENDER_COLORS = {
    teacher: 'bg-violet-500',
    admin: 'bg-blue-500',
    school: 'bg-indigo-500',
  };

  const colorForSender = (msg) => {
    const role = String(msg.senderRole || '').toLowerCase();
    if (role.includes('teacher')) return SENDER_COLORS.teacher;
    if (role.includes('admin')) return SENDER_COLORS.admin;
    return SENDER_COLORS.school;
  };

  const dotColor = (msg) => {
    const role = String(msg.senderRole || '').toLowerCase();
    if (role.includes('teacher')) return 'bg-violet-500';
    if (role.includes('admin')) return 'bg-blue-500';
    return 'bg-indigo-500';
  };

  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.round(diff / 60000)} min ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-900">Communication</p>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3B1FA3] text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onNavigate('parent-portal-communication')}
          className="text-xs font-semibold text-[#3B1FA3] flex items-center gap-0.5 hover:underline"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <button
              key={msg.id || i}
              type="button"
              onClick={() => onNavigate('parent-portal-communication')}
              className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${colorForSender(msg)}`}>
                {(msg.senderName || 'S').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900 truncate">{msg.senderName || 'School'}</p>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(msg.createdAt || msg.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{msg.subject || msg.preview || msg.body || '—'}</p>
              </div>
              {(msg.unread || msg.isUnread) && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dotColor(msg)}`} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate('parent-portal-communication')}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-500">
            <MessageSquare size={16} />
            <p className="text-xs font-medium">Go to messages</p>
          </div>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      )}
    </section>
  );
}

// ─── SchoolToday ──────────────────────────────────────────────────────────────
// Child-aware timetable snapshot. No real endpoint yet — displays placeholder
// with honest "No live timetable yet" state. TODO: GET /api/school-pulse?studentId=X

function SchoolToday({ children, loading, onNavigate }) {
  const [activeChild, setActiveChild] = useState(0);

  // Placeholder slots — replaced when real API is available
  const PLACEHOLDER = [
    { label: 'Physical Education', time: '08:30–09:30' },
    { label: 'Mathematics', time: '09:30–10:30' },
  ];

  const child = children[activeChild];

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-900">School Today</p>
        <button
          type="button"
          onClick={() => onNavigate('parent-portal-school-today')}
          className="text-xs font-semibold text-[#3B1FA3] flex items-center gap-0.5 hover:underline"
        >
          View full schedule <ArrowRight size={12} />
        </button>
      </div>

      {/* Child selector tabs — only when multiple children */}
      {children.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveChild(-1)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${activeChild === -1 ? 'bg-[#3B1FA3] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            All
          </button>
          {children.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChild(i)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${activeChild === i ? 'bg-[#3B1FA3] text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {c.name?.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : activeChild === -1 ? (
        // All-children condensed view
        <div className="space-y-2">
          {children.map(c => {
            const isPresent = c.todayStatus === 'PRESENT' || c.isPresent;
            return (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isPresent ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900">{c.name?.split(' ')[0]}</p>
                  <p className="text-[10px] text-gray-500">{isPresent ? 'At school' : 'Not present'} · {PLACEHOLDER[0].label} → {PLACEHOLDER[1].label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('parent-portal-school-today')}
                  className="text-[10px] text-[#3B1FA3] font-semibold flex-shrink-0"
                >
                  Schedule →
                </button>
              </div>
            );
          })}
        </div>
      ) : child ? (
        // Single child detail
        <div className="space-y-2">
          {/* Present badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${(child.todayStatus === 'PRESENT' || child.isPresent) ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${(child.todayStatus === 'PRESENT' || child.isPresent) ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {child.name?.split(' ')[0]} {(child.todayStatus === 'PRESENT' || child.isPresent) ? 'is at school' : 'is not present'}
            </span>
          </div>
          {/* Current + next lesson */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#3B1FA3]/5 border border-[#3B1FA3]/15 p-3">
              <p className="text-[9px] font-bold uppercase text-[#3B1FA3] tracking-wider">Now</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{PLACEHOLDER[0].label}</p>
              <p className="text-[10px] text-gray-500">{PLACEHOLDER[0].time}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Next</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{PLACEHOLDER[1].label}</p>
              <p className="text-[10px] text-gray-500">{PLACEHOLDER[1].time}</p>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 text-center pt-1">⚠ Live timetable coming soon</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">No children linked</p>
      )}
    </section>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-[#3B1FA3] hover:underline flex items-center gap-0.5"
        >
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentDashboard = ({ user, onNavigate, onLogout, brandingSettings }) => {
  const { activeSlugs } = useModuleAccess();
  const showFees = hasPageAccess({ ...(user || {}), enabledApps: activeSlugs }, 'parent-portal-fees');
  const rolePreview = useRolePreview();

  const [loading, setLoading]     = useState(true);
  const [metrics, setMetrics]     = useState(null);
  const [apiError, setApiError]   = useState(null);
  const [editingChild, setEditingChild] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const userId = user?.id || user?.userId;

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
      if (res.success) setMetrics(res.data);
      else setApiError(res.message || 'Failed to load dashboard data');
    } catch (err) {
      if (rolePreview?.isPreviewingRole) { setMetrics({}); return; }
      setApiError(err.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [rolePreview?.isPreviewingRole]);

  useEffect(() => { loadMetrics(); }, [userId, loadMetrics]);

  const handleChildSaved = useCallback((updated) => {
    setMetrics(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        children: (prev.children || []).map(c => {
          if (c.id !== updated.id) return c;
          const photo = updated.photoUrl || updated.profilePicture || updated.photo;
          return { ...c, name: updated.name, photo: photo || c.photo, photoUrl: photo || c.photoUrl, profilePicture: photo || c.profilePicture };
        }),
      };
    });
  }, []);

  // If a child was selected, show their profile inline
  if (selectedChild) {
    const ParentChildProfile = React.lazy(() => import('../parent/ParentChildProfile'));
    return (
      <React.Suspense fallback={<div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-[#3B1FA3]" /></div>}>
        <ParentChildProfile child={selectedChild} onBack={() => setSelectedChild(null)} initialTab="overview" />
      </React.Suspense>
    );
  }

  if (apiError && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 px-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-sm font-semibold text-gray-700">Dashboard unavailable</p>
        <p className="text-xs text-gray-400 text-center">{apiError}</p>
        <button onClick={loadMetrics} className="px-4 py-2 bg-[#3B1FA3] text-white text-sm font-semibold rounded-lg hover:bg-[#2d1680] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const children = metrics?.children || [];
  const firstName = user?.firstName || user?.name?.split(' ')?.[0] || 'there';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="pb-24">
      {/* Mobile app bar */}
      <div className="block md:hidden -mx-4 -mt-4 mb-4">
        <MobilePortalAppBar
          user={user}
          onNavigate={onNavigate}
          onLogout={onLogout}
          brandingSettings={brandingSettings}
          accentColor="#3B1FA3"
          bellTarget="parent-portal-communication"
        />
      </div>

      {/* Edit modal */}
      {editingChild && (
        <EditStudentModal
          child={editingChild}
          brandingSettings={brandingSettings}
          onClose={() => setEditingChild(null)}
          onSaved={handleChildSaved}
        />
      )}

      <div className="px-4 md:px-0 space-y-6 pt-4">
        {/* ── Greeting ── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {getTimeGreeting()}, {firstName}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what's happening with your children today.
          </p>
        </div>

        {/* ── My Children ── */}
        <MyChildren
          children={children}
          loading={loading}
          showFees={showFees}
          onViewChild={setSelectedChild}
          onEditChild={setEditingChild}
          onNavigate={onNavigate}
        />

        {/* ── My Balance (conditional on module access) ── */}
        {showFees && (
          <MyBalance metrics={metrics} loading={loading} onNavigate={onNavigate} />
        )}

        {/* ── Communication preview ── */}
        <CommunicationPreview metrics={metrics} loading={loading} onNavigate={onNavigate} />

        {/* ── School Today ── */}
        {children.length > 0 && (
          <SchoolToday children={children} loading={loading} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
