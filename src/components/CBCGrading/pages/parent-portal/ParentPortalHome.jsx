/**
 * ParentPortalHome — Family Dashboard
 * Matches design reference: purple family overview card, child summary strip,
 * 6-item quick actions, compact header with hamburger + greeting + bell badge.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu, Bell, CreditCard, BarChart2, Users, MessageSquare,
  MapPin, FolderOpen, ChevronRight, TrendingUp, Eye,
  AlertCircle, FileText, RefreshCw,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import MobileBottomNav from '../../dashboard/mobile/MobileBottomNav';
import ParentChildProfile from '../parent/ParentChildProfile';

const fmt    = (n) => Number(n || 0).toLocaleString();
const fmtPct = (n) => `${Math.round(Number(n || 0))}%`;

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

// ─── Family Overview Card (solid purple) ─────────────────────────────────────

function FamilyOverviewCard({ metrics, loading, onNavigate }) {
  const children       = metrics?.children || [];
  const stats          = metrics?.stats    || {};
  const messages       = metrics?.messages || [];
  const unread         = messages.filter(m => m.unread || m.isUnread).length;
  const totalBalance   = Number(stats.totalBalance || 0);
  const [balVisible, setBalVisible] = useState(true);

  return (
    <div className="bg-[#3B1FA3] rounded-2xl p-5 text-white">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
            Total Outstanding Balance
          </p>
          {loading ? (
            <Skeleton className="h-8 w-36 bg-white/20" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold tracking-tight">
                {balVisible ? `KES ${fmt(totalBalance)}` : 'KES ••••••'}
              </p>
              <button
                onClick={() => setBalVisible(v => !v)}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <Eye size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">Children</p>
          {loading ? <Skeleton className="h-6 w-8 bg-white/20" /> : (
            <p className="text-2xl font-bold">{children.length}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: 'Attendance (Avg)',
            value: loading ? null : fmtPct(stats.avgAttendance),
            good: Number(stats.avgAttendance) >= 90,
            delta: stats.attendanceDelta,
          },
          {
            label: 'Avg Performance',
            value: loading ? null : fmtPct(stats.avgPerformance || stats.avgScore),
            good: true,
            delta: stats.performanceDelta,
          },
          {
            label: 'Unread Messages',
            value: loading ? null : String(unread || messages.length),
            good: unread === 0,
            delta: null,
          },
        ].map((s) => (
          <div key={s.label}>
            {loading ? <Skeleton className="h-5 w-12 bg-white/20 mb-1" /> : (
              <p className="text-xl font-bold flex items-center gap-1">
                {s.value}
                {s.delta != null && (
                  <span className={`text-[10px] font-semibold ${s.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {s.delta >= 0 ? '↑' : '↓'}
                  </span>
                )}
              </p>
            )}
            <p className="text-[10px] text-white/60 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('parent-portal-fees')}
          className="flex items-center justify-center gap-2 py-2.5 bg-white text-[#3B1FA3] text-sm font-bold rounded-xl hover:bg-white/90 transition-colors"
        >
          <CreditCard size={15} /> Pay All Fees
        </button>
        <button
          onClick={() => onNavigate('parent-portal-fees')}
          className="flex items-center justify-center gap-2 py-2.5 border border-white/40 text-white text-sm font-bold rounded-xl hover:bg-white/10 transition-colors"
        >
          <FileText size={15} /> View Statement
        </button>
      </div>
    </div>
  );
}

// ─── Children Summary Strip ───────────────────────────────────────────────────

function ChildrenSummary({ children, loading, onSelectChild, onNavigate }) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-shrink-0 w-36 bg-white border border-gray-200 rounded-xl p-3">
            <Skeleton className="h-10 w-10 rounded-full mb-2" />
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-3 w-14 mb-2" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!children?.length) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
        <Users size={24} className="mx-auto mb-2 text-gray-300" />
        <p className="text-xs text-gray-400">No children linked to your account</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
      {children.map((child) => {
        const bal         = Number(child.feeBalance || 0);
        const attendance  = Math.round(Number(child.attendanceRate || 0));
        const barColor    = attendance >= 90 ? 'bg-emerald-500' : attendance >= 75 ? 'bg-amber-400' : 'bg-rose-500';

        return (
          <button
            key={child.id}
            onClick={() => onSelectChild(child)}
            className="flex-shrink-0 w-36 bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-[#3B1FA3]/40 hover:shadow-sm transition-all active:scale-95"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#3B1FA3]/10 text-[#3B1FA3] font-bold text-sm flex items-center justify-center mb-2">
              {child.name?.[0] || '?'}
            </div>

            {/* Name */}
            <p className="text-xs font-bold text-gray-900 truncate leading-tight">{child.name?.split(' ')[0]}</p>
            <p className="text-[10px] text-gray-500 truncate mb-2">{child.grade} · {child.className || 'Class'}</p>

            {/* Balance */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Balance</p>
            <p className={`text-xs font-bold mb-2 ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {bal > 0 ? `KES ${fmt(bal)}` : 'Cleared'}
            </p>

            {/* Attendance bar */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Attendance</p>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${attendance}%` }} />
              </div>
              <span className="text-[10px] font-bold text-gray-600">{attendance}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Quick Actions (6 items) ──────────────────────────────────────────────────

function QuickActions({ onNavigate }) {
  const actions = [
    { label: 'Fees',        icon: CreditCard,    path: 'parent-portal-fees',       color: 'text-[#3B1FA3]', bg: 'bg-[#3B1FA3]/10' },
    { label: 'Results',     icon: BarChart2,      path: 'parent-portal-results',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Attendance',  icon: Users,          path: 'parent-portal-attendance', color: 'text-blue-600',   bg: 'bg-blue-50'     },
    { label: 'Messages',    icon: MessageSquare,  path: 'parent-portal-messages',   color: 'text-amber-600',  bg: 'bg-amber-50'    },
    { label: 'Transport',   icon: MapPin,         path: 'parent-portal-transport',  color: 'text-rose-600',   bg: 'bg-rose-50'     },
    { label: 'Documents',   icon: FolderOpen,     path: 'parent-portal-documents',  color: 'text-violet-600', bg: 'bg-violet-50'   },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() => onNavigate(a.path)}
            className="bg-white border border-gray-200 rounded-xl py-3.5 flex flex-col items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center`}>
              <Icon size={17} className={a.color} />
            </div>
            <span className="text-[10px] font-semibold text-gray-600">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ParentPortalHome = ({ user, onNavigate }) => {
  const [metrics, setMetrics]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setMetrics(res.data);
      else setError(res?.message || 'Failed to load dashboard');
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Parent';

  const children = metrics?.children || [];
  const messages = metrics?.messages || [];
  const unread   = messages.filter(m => m.unread || m.isUnread).length;

  // Child profile overlay
  if (selectedChild) {
    return (
      <>
        <ParentChildProfile child={selectedChild} onBack={() => setSelectedChild(null)} />
        <MobileBottomNav role="PARENT" currentPath="parent-portal-home" onNavigate={onNavigate} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20">

      {/* ── Header ── */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-500 leading-none">{greeting},</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">{firstName} 👋</p>
          </div>
          <button
            onClick={() => onNavigate('parent-portal-messages')}
            className="w-8 h-8 flex items-center justify-center relative"
          >
            <Bell size={20} className="text-gray-600" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-4 space-y-5">

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button onClick={loadMetrics} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
          </div>
        )}

        {/* 1. Family Overview Card */}
        <FamilyOverviewCard metrics={metrics} loading={loading} onNavigate={onNavigate} />

        {/* 2. Children Summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Children Summary</h2>
            <button onClick={() => onNavigate('parent-portal-children')} className="text-xs text-[#3B1FA3] font-semibold flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <ChildrenSummary
            children={children}
            loading={loading}
            onSelectChild={setSelectedChild}
            onNavigate={onNavigate}
          />
        </div>

        {/* 3. Quick Actions */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h2>
          <QuickActions onNavigate={onNavigate} />
        </div>

      </div>

      <MobileBottomNav role="PARENT" currentPath="parent-portal-home" onNavigate={onNavigate} />
    </div>
  );
};

export default ParentPortalHome;
