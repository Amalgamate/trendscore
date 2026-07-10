/**
 * ParentPortalHome — Family Dashboard
 * Purple family overview card · child summary strip · quick actions
 * Header is now the shared MobilePortalAppBar (white, logo, real bell count, avatar dropdown).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, BarChart2, Users,
  ChevronRight, Eye,
  AlertCircle, FileText, Pencil,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import ParentChildProfile from '../parent/ParentChildProfile';
import MobilePortalAppBar from '../../layout/MobilePortalAppBar';
import EditStudentModal from '../parent/EditStudentModal';
import { Skeleton } from '../../../ui';

const fmt    = (n) => Number(n || 0).toLocaleString();
const fmtPct = (n) => `${Math.round(Number(n || 0))}%`;

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

// ─── Family Overview Card ──────────────────────────────────────────────────

function FamilyOverviewCard({ metrics, loading, onNavigate, showFees }) {
  const children     = metrics?.children || [];
  const stats        = metrics?.stats    || {};
  const messages     = metrics?.messages || [];
  const unread       = messages.filter((m) => m.unread || m.isUnread).length;
  const totalBalance = Number(stats.totalBalance || 0);
  const [balVisible, setBalVisible] = useState(true);

  return (
    <div className="bg-[#3B1FA3] rounded-2xl p-5 text-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
            {showFees ? 'Total Outstanding Balance' : 'Family Overview'}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-36 bg-white/20" />
          ) : !showFees ? (
            <p className="text-3xl font-bold tracking-tight">{children.length} Children</p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold tracking-tight">
                {balVisible ? `KES ${fmt(totalBalance)}` : 'KES ••••••'}
              </p>
              <button
                type="button"
                onClick={() => setBalVisible((v) => !v)}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <Eye size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">Children</p>
          {loading
            ? <Skeleton className="h-6 w-8 bg-white/20" />
            : <p className="text-2xl font-bold">{children.length}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Attendance (Avg)', value: loading ? null : fmtPct(stats.avgAttendance), delta: stats.attendanceDelta },
          { label: 'Unread Messages',  value: loading ? null : String(unread || messages.length), delta: null },
        ].map((s) => (
          <div key={s.label}>
            {loading
              ? <Skeleton className="h-5 w-12 bg-white/20 mb-1" />
              : (
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

      {showFees && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-fees')}
            className="flex items-center justify-center gap-2 py-2.5 bg-white text-[#3B1FA3] text-sm font-bold rounded-xl hover:bg-white/90 transition-colors"
          >
            <CreditCard size={15} /> Pay All Fees
          </button>
          <button
            type="button"
            onClick={() => onNavigate('fees-statements')}
            className="flex items-center justify-center gap-2 py-2.5 border border-white/40 text-white text-sm font-bold rounded-xl hover:bg-white/10 transition-colors"
          >
            <FileText size={15} /> View Statement
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Children Summary Strip ───────────────────────────────────────────────────

function ChildrenSummary({ children, loading, onSelectChild, onEditChild, showFees }) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {[1, 2, 3].map((i) => (
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
        const bal        = Number(child.feeBalance || 0);
        const attendance = Math.round(Number(child.attendanceRate || 0));
        const barColor   = attendance >= 90 ? 'bg-emerald-500' : attendance >= 75 ? 'bg-amber-400' : 'bg-rose-500';
        const photoSrc   = getChildPhoto(child);

        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelectChild(child)}
            className="flex-shrink-0 w-36 bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-[#3B1FA3]/40 hover:shadow-sm transition-all active:scale-95"
          >
            <div className="relative">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={child.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-sm mb-2"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div
                style={{ display: photoSrc ? 'none' : 'flex' }}
                className="w-10 h-10 rounded-full bg-[#3B1FA3]/10 border-2 border-blue-500 text-[#3B1FA3] font-bold text-sm items-center justify-center mb-2"
              >
                {child.name?.[0] || '?'}
              </div>
              {/* Edit button */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEditChild(child); }}
                className="absolute top-0 right-0 w-5 h-5 rounded-full bg-[#3B1FA3] flex items-center justify-center shadow"
                title="Edit student"
              >
                <Pencil size={10} className="text-white" />
              </button>
            </div>
            <p className="text-xs font-bold text-gray-900 truncate leading-tight">{child.name?.split(' ')[0]}</p>
            <p className="text-[10px] text-gray-500 truncate mb-2">{child.grade} · {child.className || 'Class'}</p>
            {showFees && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Balance</p>
                <p className={`text-xs font-bold mb-2 ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {bal > 0 ? `KES ${fmt(bal)}` : 'Cleared'}
                </p>
              </>
            )}
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

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({ onNavigate }) {
  const actions = [
    { label: 'Academic Reports', icon: BarChart2, path: 'parent-portal-results', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Attendance', icon: Users,         path: 'parent-portal-attendance', color: 'text-blue-600',     bg: 'bg-blue-50'      },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.path)}
              className="bg-white border border-gray-200 rounded-xl py-3.5 flex flex-col items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center`}>
                <Icon size={17} className={a.color} />
              </div>
              <span className="text-[10px] font-semibold text-gray-600">{a.label}</span>
              {a.beta && (
                <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${a.beta}`}>
                  Beta
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalHome = ({ user, onNavigate, brandingSettings }) => {
  const { activeSlugs } = useModuleAccess();
  const accessUser = { ...(user || {}), enabledApps: activeSlugs };
  const showFees = hasPageAccess(accessUser, 'parent-portal-fees');
  const [metrics, setMetrics]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [editingChild, setEditingChild]   = useState(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setMetrics(res.data);
      else setError(res?.message || 'Failed to load dashboard');
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const handleChildSaved = useCallback((updatedChild) => {
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

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const children = metrics?.children || [];

  if (selectedChild) {
    return (
      <ParentChildProfile
        child={selectedChild}
        onBack={() => setSelectedChild(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">

      {/* Edit Student Modal */}
      {editingChild && (
        <EditStudentModal
          child={editingChild}
          brandingSettings={brandingSettings}
          onClose={() => setEditingChild(null)}
          onSaved={handleChildSaved}
        />
      )}

      {/* Shared white app bar */}
      <MobilePortalAppBar
        user={user}
        onNavigate={onNavigate}
        onRefresh={loadMetrics}
        brandingSettings={brandingSettings}
        greeting={greeting}
        accentColor="#3B1FA3"
        bellTarget="parent-portal-messages"
      />

      <div className="px-4 pt-4 space-y-5">

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button type="button" onClick={loadMetrics} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
          </div>
        )}

        <FamilyOverviewCard metrics={metrics} loading={loading} onNavigate={onNavigate} showFees={showFees} />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Children Summary</h2>
            <button
              type="button"
              onClick={() => onNavigate('parent-portal-children')}
              className="text-xs text-[#3B1FA3] font-semibold flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <ChildrenSummary
            children={children}
            loading={loading}
            onSelectChild={setSelectedChild}
            onEditChild={setEditingChild}
            showFees={showFees}
          />
        </div>

        <QuickActions onNavigate={onNavigate} />

      </div>
    </div>
  );
};

export default ParentPortalHome;
