/**
 * Parent Portal Children Screen
 * Multi-child card list. Tapping a child card opens the full ParentChildProfile.
 * No MobileBottomNav here — MobileAppShell renders it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Users, TrendingUp, CreditCard, Calendar,
  ChevronRight, RefreshCw, AlertCircle,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, icon: Icon, colorClass }) {
  return (
    <div className={`${colorClass} rounded-xl p-2.5 flex flex-col items-center gap-0.5`}>
      <Icon size={13} className="mx-auto" />
      <p className="text-[10px] font-bold leading-none">{value}</p>
      <p className="text-[9px] opacity-70 leading-none">{label}</p>
    </div>
  );
}

// ─── Child Card ───────────────────────────────────────────────────────────────

function ChildCard({ child, onSelect }) {
  const bal            = Number(child.feeBalance || 0);
  const attendance     = Math.round(Number(child.attendanceRate || 0));
  const avgScore       = Math.round(Number(child.averageScore || 0));
  const attendanceColor = attendance >= 90 ? 'text-emerald-600' : attendance >= 75 ? 'text-amber-600' : 'text-rose-600';
  const balColor        = bal > 0 ? 'text-rose-600' : 'text-emerald-600';

  return (
    <button
      type="button"
      onClick={() => onSelect(child)}
      className="w-full bg-white border border-gray-200 rounded-2xl overflow-hidden text-left hover:border-[#3B1FA3]/40 active:scale-[0.99] transition-all"
    >
      {/* Hero strip */}
      <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #3B1FA3, #7c3aed)' }} />

      <div className="p-4">
        {/* Top row: avatar + name + chevron */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#3B1FA3]/10 text-[#3B1FA3] font-bold text-lg flex items-center justify-center flex-shrink-0">
            {child.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {child.grade}
              {child.className ? ` · ${child.className}` : ''}
            </p>
            {child.admissionNumber && (
              <p className="text-[10px] text-gray-400 mt-0.5">Adm #{child.admissionNumber}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill
            label="Attendance"
            value={`${attendance}%`}
            icon={Calendar}
            colorClass={`${attendance >= 90 ? 'bg-emerald-50 text-emerald-700' : attendance >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}
          />
          <StatPill
            label="Avg Score"
            value={avgScore > 0 ? `${avgScore}%` : '—'}
            icon={TrendingUp}
            colorClass="bg-blue-50 text-blue-700"
          />
          <StatPill
            label="Fee Bal"
            value={bal > 0 ? `KES ${bal >= 1000 ? Math.round(bal / 1000) + 'K' : bal}` : 'Cleared'}
            icon={CreditCard}
            colorClass={bal > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}
          />
        </div>

        {/* Class teacher */}
        {child.classTeacher && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {child.classTeacher?.[0]}
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Class Teacher</p>
              <p className="text-xs font-semibold text-gray-700">{child.classTeacher}</p>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ParentPortalChildren = ({ user, onNavigate }) => {
  const [children, setChildren]       = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics?.();
      if (res?.success) {
        setChildren(res.data?.children || []);
      } else {
        setError(res?.message || 'Failed to load children');
      }
    } catch (e) {
      setError(e?.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Full-screen child profile overlay (inside the shell scroll area)
  if (selectedChild) {
    return (
      <ParentChildProfile
        child={selectedChild}
        onBack={() => setSelectedChild(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-home')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">My Children</h1>
            {!loading && (
              <p className="text-[10px] text-gray-500">
                {children.length} child{children.length !== 1 ? 'ren' : ''} linked
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button type="button" onClick={load} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
          </div>
        )}

        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map(j => <Skeleton key={j} className="h-14 rounded-xl" />)}
              </div>
            </div>
          ))
        ) : children.length > 0 ? (
          children.map(child => (
            <ChildCard
              key={child.id}
              child={child}
              onSelect={setSelectedChild}
            />
          ))
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <Users size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 mb-1">No children linked</p>
            <p className="text-xs text-gray-400">Contact your school to link your children to this account.</p>
          </div>
        )}

        {/* Info note */}
        {!loading && children.length > 0 && (
          <div className="bg-[#3B1FA3]/5 border border-[#3B1FA3]/15 rounded-xl p-3 flex items-start gap-2">
            <Users size={14} className="text-[#3B1FA3] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#3B1FA3]">
              Tap any child card to see their full profile — attendance records, academic results, fee invoices, and more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalChildren;
