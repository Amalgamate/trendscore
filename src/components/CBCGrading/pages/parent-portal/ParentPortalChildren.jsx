/**
 * Parent Portal Children Screen
 * Multi-child card list. Tapping a child card opens the full ParentChildProfile.
 * Bottom navigation is provided globally by CBCGradingSystem's parent portal shell.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, CreditCard, Calendar,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';
import { Skeleton } from '../../../ui';

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, icon: Icon, colorClass, borderClass }) {
  return (
    <div className={`${colorClass} ${borderClass} border rounded-xl p-2.5 flex flex-col items-center gap-0.5`}>
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
  const photoSrc        = getChildPhoto(child);
  const statusLabel     = child.status === 'ACTIVE' ? 'Active' : child.status || 'Enrolled';

  return (
    <button
      type="button"
      onClick={() => onSelect(child)}
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-[1px] text-left active:scale-[0.99] transition-all"
    >
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/12" />
      <div className="absolute -left-8 bottom-10 h-20 w-20 rounded-full bg-sky-300/20" />

      <div className="relative rounded-2xl bg-white/96 p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={child.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              style={{ display: photoSrc ? 'none' : 'flex' }}
              className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 font-black text-xl items-center justify-center border-2 border-blue-500 shadow-sm"
            >
              {child.name?.[0] || '?'}
            </div>
            <span className="absolute -right-1 -bottom-1 h-5 w-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
              <Users size={10} className="text-white" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-black text-gray-950 truncate">{child.name}</p>
                <p className="text-xs font-semibold text-blue-700 truncate">
                  {child.grade}{child.className ? ` · ${child.className}` : ''}
                </p>
              </div>
              <ChevronRight size={17} className="text-blue-500 flex-shrink-0 mt-1" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {statusLabel}
              </span>
              {child.admissionNumber && (
                <span className="rounded-full bg-gray-50 border border-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                  Adm {child.admissionNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatPill
            label="Attendance"
            value={`${attendance}%`}
            icon={Calendar}
            colorClass={attendance >= 90 ? 'bg-emerald-50 text-emerald-700' : attendance >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}
            borderClass={attendance >= 90 ? 'border-emerald-200' : attendance >= 75 ? 'border-amber-200' : 'border-rose-200'}
          />
          <StatPill
            label="Avg Score"
            value={avgScore > 0 ? `${avgScore}%` : '—'}
            icon={TrendingUp}
            colorClass="bg-blue-50 text-blue-700"
            borderClass="border-blue-200"
          />
          <StatPill
            label="Fee Bal"
            value={bal > 0 ? `KES ${bal >= 1000 ? Math.round(bal / 1000) + 'K' : bal}` : 'Cleared'}
            icon={CreditCard}
            colorClass={bal > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}
            borderClass={bal > 0 ? 'border-rose-200' : 'border-emerald-200'}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-3 py-2">
          <p className="text-[10px] font-semibold text-blue-800">
            Tap to open profile, attendance, results, invoices and more.
          </p>
          <span className="text-[10px] font-black text-blue-700 flex-shrink-0">Open</span>
        </div>

        {child.classTeacher && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-500 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
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
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Content */}
      <div className="py-1 space-y-3">

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
