/**
 * ParentPortalSchoolToday
 * Child-aware school day view — today's schedule per child.
 * No live timetable endpoint yet. Shows placeholder slots with honest state.
 * TODO: GET /api/school-pulse?studentId=X returning { current, next, later[], tomorrow[] }
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, Calendar, ChevronDown, Clock,
  Dumbbell, FlaskConical, Loader2, Monitor, Music, Utensils,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

// ─── Placeholder schedule ──────────────────────────────────────────────────────
// Replaced when real API is wired up.
const PLACEHOLDER_SCHEDULE = [
  { time: '07:00–07:45', label: 'Mathematics',       icon: FlaskConical, color: 'bg-blue-500',   status: 'done'    },
  { time: '07:50–08:35', label: 'Kiswahili',          icon: BookOpen,    color: 'bg-purple-500', status: 'done'    },
  { time: '08:40–09:25', label: 'ICT',                icon: Monitor,     color: 'bg-indigo-500', status: 'current' },
  { time: '09:25–10:00', label: 'Lunch & Rest',        icon: Utensils,    color: 'bg-orange-400', status: 'break',  isBreak: true },
  { time: '10:05–10:50', label: 'Physical Education', icon: Dumbbell,    color: 'bg-rose-500',   status: 'next'    },
  { time: '10:55–11:40', label: 'Music',               icon: Music,       color: 'bg-teal-500',   status: 'later'   },
];

const STATUS_STYLES = {
  done:    'opacity-50',
  current: 'ring-2 ring-[#3B1FA3] ring-offset-1',
  next:    '',
  break:   'opacity-60',
  later:   '',
};

const STATUS_LABEL = {
  current: { text: 'In progress', cls: 'bg-emerald-100 text-emerald-700' },
  next:    { text: 'Up next',     cls: 'bg-amber-100 text-amber-700'    },
};

// ─── ChildSelector ────────────────────────────────────────────────────────────
function ChildTab({ child, active, onClick }) {
  const isPresent = child.todayStatus === 'PRESENT' || child.isPresent;
  const photoSrc = child.photoUrl || child.profilePicture || child.photo || null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
        active ? 'bg-[#3B1FA3] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700'
      }`}
    >
      {photoSrc ? (
        <img src={photoSrc} alt="" className="w-6 h-6 rounded-full object-cover" />
      ) : (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-[#3B1FA3]/10 text-[#3B1FA3]'}`}>
          {(child.name || '?')[0]}
        </div>
      )}
      <span className="truncate max-w-[80px]">{child.name?.split(' ')[0]}</span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isPresent ? 'bg-emerald-400' : 'bg-gray-300'}`} />
    </button>
  );
}

// ─── ScheduleItem ─────────────────────────────────────────────────────────────
function ScheduleItem({ slot }) {
  const Icon = slot.icon;
  const statusStyle = STATUS_STYLES[slot.status] || '';
  const badge = STATUS_LABEL[slot.status];

  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 transition-all ${statusStyle}`}>
      <div className={`w-10 h-10 rounded-xl ${slot.color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{slot.label}</p>
        <p className="text-[10px] text-gray-400">{slot.time}</p>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
          {badge.text}
        </span>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ParentPortalSchoolToday({ onNavigate }) {
  const [children, setChildren]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeIdx, setActiveIdx]   = useState(0);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getParentMetrics();
      setChildren(res?.data?.children || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const child = children[activeIdx];

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      <div className="px-4 py-4 space-y-4">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#3B1FA3]">School</p>
          <h1 className="text-xl font-black text-gray-900 mt-0.5">School Today</h1>
          <p className="text-xs text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Child tabs */}
        {loading ? (
          <Skeleton className="h-10 rounded-xl" />
        ) : children.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {children.map((c, i) => (
              <ChildTab key={c.id} child={c} active={activeIdx === i} onClick={() => setActiveIdx(i)} />
            ))}
          </div>
        ) : null}

        {/* Presence status */}
        {child && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${(child.todayStatus === 'PRESENT' || child.isPresent) ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${(child.todayStatus === 'PRESENT' || child.isPresent) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <p className={`text-sm font-bold ${(child.todayStatus === 'PRESENT' || child.isPresent) ? 'text-emerald-700' : 'text-gray-500'}`}>
              {child.name?.split(' ')[0]} {(child.todayStatus === 'PRESENT' || child.isPresent) ? 'is at school' : 'is not recorded present today'}
            </p>
          </div>
        )}

        {/* Schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">Today's Schedule</p>
            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              ⚠ Live timetable coming soon
            </span>
          </div>
          <div className="space-y-2">
            {PLACEHOLDER_SCHEDULE.map((slot, i) => (
              <ScheduleItem key={i} slot={slot} />
            ))}
          </div>
        </div>

        {/* Calendar CTA */}
        <button
          type="button"
          onClick={() => onNavigate('events-calendar')}
          className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">School Calendar</p>
              <p className="text-[10px] text-gray-400">Events, holidays, exam dates</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#3B1FA3]">View →</span>
        </button>
      </div>
    </div>
  );
}
