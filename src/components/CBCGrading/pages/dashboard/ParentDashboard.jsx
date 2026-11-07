/**
 * ParentDashboard — Redesigned parent portal home
 *
 * Architecture: dashboard = family overview. Sidebar / nav = module entry points.
 *
 * Sections: greeting, child summaries, fees, recent inbox item, and a link to
 * the live attendance/schedule page.
 *
 * Removed: QuickActions, SchoolPulse, LatestNewsletterCard, AnnouncementsCard,
 *          FooterUtility, HeroCard
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BookOpen, Bus, Calendar, ChevronDown, ChevronRight,
  Eye, EyeOff, FileText, Headphones, Loader2, MessageSquare, Pencil,
  Settings, Users, Wallet,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import MobilePortalAppBar from '../../layout/MobilePortalAppBar';
import EditStudentModal from '../parent/EditStudentModal';
import { Skeleton } from '../../../ui';

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
  if (rate >= 90) return 'text-emerald-800';
  if (rate >= 75) return 'text-amber-800';
  return 'text-rose-700';
};

const balanceColor = (bal) => bal > 0 ? 'text-rose-700' : 'text-emerald-800';

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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button type="button" onClick={() => onViewChild(child)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700">
        <div className="relative flex-shrink-0">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-10 h-10 rounded-full object-cover border border-[#3B1FA3]/30"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-10 h-10 rounded-full bg-[#3B1FA3]/10 border border-[#3B1FA3]/20 text-[#3B1FA3] font-black text-sm items-center justify-center flex-shrink-0"
          >
            {initials}
          </div>
          {/* Presence dot */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isPresent ? 'bg-emerald-500' : 'bg-gray-300'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
          <p className="text-xs text-slate-600">{child.grade} · {child.className || 'Class'}</p>
          <p className={`mt-0.5 text-[10px] font-semibold ${isPresent ? 'text-emerald-800' : 'text-slate-600'}`}>
            {isPresent ? 'Present today' : 'Not marked present'}
          </p>
        </div>
        <ChevronRight size={17} className="shrink-0 text-slate-600" />
        </button>

        <button
          type="button"
          onClick={() => onEditChild(child)}
          aria-label={`Edit ${child.name}`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className={`grid border-t border-slate-100 divide-x divide-slate-100 ${showFees ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="px-2 py-2 text-center">
          <p className="text-[9px] font-bold text-slate-600">Attendance</p>
          <p className={`mt-0.5 text-sm font-extrabold ${attendanceColor(attendance)}`}>{attendance}%</p>
        </div>
        {showFees && (
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-bold text-slate-600">Balance</p>
            <p className={`mt-0.5 text-sm font-extrabold ${balanceColor(balance)}`}>
              {balance > 0 ? `KES ${fmt(balance)}` : 'Cleared'}
            </p>
          </div>
        )}
        <div className="px-2 py-2 text-center">
          <p className="text-[9px] font-bold text-slate-600">Term average</p>
          <p className={`mt-0.5 text-sm font-extrabold ${termAvg != null ? attendanceColor(termAvg) : 'text-slate-600'}`}>
            {termAvg != null ? `${termAvg}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MyChildren ───────────────────────────────────────────────────────────────

function MyChildren({ children, loading, showFees, onViewChild, onEditChild, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  if (loading) {
    return (
      <section>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200" /><div className="flex gap-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-10 rounded-full" />)}</div></div>
      </section>
    );
  }

  if (!children.length) {
    return (
      <section>
        <SectionHeader title="My Children" />
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <Users size={24} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">No children are linked to your account yet.</p>
          <p className="mt-1 text-xs text-slate-600">Ask the school to link your parent account.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-white"><Users size={19} /></span>
        <span className="flex-1"><span className="block text-sm font-extrabold text-slate-950">My Children</span><span className="block text-xs font-semibold text-blue-800">{children.length} {children.length === 1 ? 'child' : 'children'}</span></span>
        {children.slice(0, 3).map((child, index) => {
          const photo = getChildPhoto(child);
          const initials = (child.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
          return photo
            ? <img key={child.id} src={photo} alt="" className="-ml-1 h-8 w-8 rounded-full border-2 border-white object-cover ring-2 ring-white" style={{ zIndex: 3 - index }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <span key={child.id} aria-hidden="true" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-extrabold text-indigo-900 ring-2 ring-white" style={{ zIndex: 3 - index }}>{initials}</span>;
        })}
        {children.length > 3 && <span className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">+{children.length - 3}</span>}
        <ChevronDown size={18} className={`shrink-0 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/60 p-2 sm:grid-cols-2">
        {children.map(child => <ChildCard key={child.id} child={child} showFees={showFees} onViewChild={onViewChild} onEditChild={onEditChild} />)}
        <button type="button" onClick={() => onNavigate('parent-portal-children')} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-bold text-indigo-800 hover:bg-indigo-50">View all children <ChevronRight size={14} /></button>
      </div>}
    </section>
  );
}

// ─── MyBalance ────────────────────────────────────────────────────────────────

function MyBalance({ metrics, loading, onNavigate }) {
  const [visible, setVisible] = useState(true);
  const stats = metrics?.stats || {};
  const total = Number(stats.totalBalance || 0);

  if (loading) return <Skeleton className="h-16 rounded-xl" />;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50"><Wallet size={18} className="text-indigo-800" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700">Fees balance</p>
            <div className="flex items-center gap-1.5">
            <p className={`truncate text-base font-extrabold ${balanceColor(total)}`}>
              {visible ? `KES ${fmt(total)}` : 'KES ••••'}
            </p>
            <button
              type="button"
              onClick={() => setVisible(v => !v)}
              aria-label={visible ? 'Hide fees balance' : 'Show fees balance'}
              className="text-slate-600 hover:text-slate-950"
            >
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate('parent-portal-fees')} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#3B1FA3] px-3 py-2 text-xs font-bold text-white hover:bg-[#2d1680]">View fees <ChevronRight size={14} /></button>
      </div>
    </section>
  );
}

// ─── SchoolToday ──────────────────────────────────────────────────────────────
// Child-aware timetable snapshot. No real endpoint yet — displays placeholder
// with honest "No live timetable yet" state. TODO: GET /api/school-pulse?studentId=X

function SchoolToday({ onNavigate }) {
  return (
    <button type="button" onClick={() => onNavigate('parent-portal-school-today')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Calendar size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950">Check today’s attendance and schedule</span><span className="block text-xs text-slate-700">See the latest update for each child.</span></span>
      <ChevronRight size={17} className="shrink-0 text-slate-600" />
    </button>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-600">{subtitle}</p>}
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
        <ParentChildProfile
          child={selectedChild}
          siblings={metrics?.children || []}
          onSelectChild={setSelectedChild}
          onNavigate={onNavigate}
          onBack={() => setSelectedChild(null)}
          initialTab="diary"
        />
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

  return (
    <div>
      {/* Mobile app bar */}
      <div className="block md:hidden -mt-4 mb-4">
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

      <div className="px-3 md:px-0 space-y-4 pt-2 md:pt-0">
        {/* ── Greeting ── */}
        <div>
          <h1 className="text-lg font-extrabold text-slate-950">
            {getTimeGreeting()}, {firstName}! 👋
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-700">Choose a child to read the diary, check fees or view attendance.</p>
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

        {children.length > 0 && <section aria-label="Parent actions" className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          <button type="button" onClick={() => setSelectedChild(children[0])} className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white"><BookOpen size={19} /></span><span className="flex-1 text-sm font-bold text-slate-950">Read the diary</span><ChevronRight size={17} className="text-slate-500" />
          </button>
          {showFees && <button type="button" onClick={() => onNavigate('parent-portal-fees')} className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white"><Wallet size={19} /></span><span className="flex-1 text-sm font-bold text-slate-950">Pay or check school fees</span><ChevronRight size={17} className="text-slate-500" />
          </button>}
          <button type="button" onClick={() => onNavigate('parent-portal-school-today')} className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-700 text-white"><Calendar size={19} /></span><span className="flex-1 text-sm font-bold text-slate-950">Check today’s attendance</span><ChevronRight size={17} className="text-slate-500" />
          </button>
          <button type="button" onClick={() => onNavigate('parent-portal-communication')} className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white"><MessageSquare size={19} /></span><span className="flex-1 text-sm font-bold text-slate-950">Message the school</span><ChevronRight size={17} className="text-slate-500" />
          </button>
        </section>}

        {/* ── My Balance (conditional on module access) ── */}
        {showFees && (
          <MyBalance metrics={metrics} loading={loading} onNavigate={onNavigate} />
        )}

        {/* ── School Today ── */}
        {children.length > 0 && <section className="grid grid-cols-2 gap-2">
          {[
            { id: 'parent-portal-transport', label: 'Check transport', icon: Bus, color: 'bg-amber-600' },
            { id: 'parent-portal-documents', label: 'School documents', icon: FileText, color: 'bg-teal-700' },
            { id: 'parent-portal-support', label: 'Get help', icon: Headphones, color: 'bg-slate-700' },
            { id: 'parent-portal-more', label: 'Settings', icon: Settings, color: 'bg-indigo-700' },
          ].filter(item => hasPageAccess({ ...(user || {}), enabledApps: activeSlugs }, item.id)).map(({ id, label, icon: Icon, color }) => (
            <button key={id} type="button" onClick={() => onNavigate(id)} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-bold text-slate-900 hover:bg-slate-50"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${color}`}><Icon size={17} /></span><span className="flex-1">{label}</span><ChevronRight size={14} className="text-slate-500" /></button>
          ))}
        </section>}
      </div>
    </div>
  );
};

export default ParentDashboard;
