/**
 * ParentPortalSchoolToday
 * Child-aware school day view — today's real published schedule per child,
 * pulled from the same ClassSchedule data the admin timetable and teacher
 * dashboard widget read from (via GET /api/classes/learner/:id and
 * GET /api/classes/:id/schedules).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, Calculator, Calendar, ChevronDown, Clock,
  Dumbbell, Globe2, Loader2, Monitor, Music, Palette,
} from 'lucide-react';
import { dashboardAPI, classAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const getTodayName = () => DAY_NAMES[new Date().getDay()];

// ─── Subject → icon/colour mapping ─────────────────────────────────────────
// Keyword match against the subject/learning-area name so any school's real
// curriculum gets a sensible icon without needing a lookup table per subject.
const SUBJECT_VISUALS = [
  { keywords: ['math'], icon: Calculator, color: 'bg-blue-500' },
  { keywords: ['science', 'integrated'], icon: Globe2, color: 'bg-emerald-500' },
  { keywords: ['ict', 'computer', 'digital'], icon: Monitor, color: 'bg-indigo-500' },
  { keywords: ['music'], icon: Music, color: 'bg-teal-500' },
  { keywords: ['physical', 'sport', 'pe '], icon: Dumbbell, color: 'bg-rose-500' },
  { keywords: ['art', 'creative'], icon: Palette, color: 'bg-amber-500' },
];
const DEFAULT_VISUAL = { icon: BookOpen, color: 'bg-purple-500' };

const getSubjectVisual = (label) => {
  const value = String(label || '').toLowerCase();
  return SUBJECT_VISUALS.find((entry) => entry.keywords.some((word) => value.includes(word))) || DEFAULT_VISUAL;
};

// Derives done/current/next/later purely from the current clock time against
// each lesson's start/end — same approach the teacher dashboard uses server-side.
const toMinutes = (time) => {
  const [h, m] = String(time || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const deriveStatuses = (lessons) => {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  let nextAssigned = false;
  return lessons.map((lesson) => {
    const start = toMinutes(lesson.startTime);
    const end = toMinutes(lesson.endTime);
    let status = 'later';
    if (nowMinutes >= end) status = 'done';
    else if (nowMinutes >= start && nowMinutes < end) status = 'current';
    else if (!nextAssigned) { status = 'next'; nextAssigned = true; }
    return { ...lesson, status };
  });
};

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
  const { icon: Icon, color } = getSubjectVisual(slot.subject);
  const statusStyle = STATUS_STYLES[slot.status] || '';
  const badge = STATUS_LABEL[slot.status];

  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 transition-all ${statusStyle}`}>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{slot.subject}</p>
        <p className="text-[10px] text-gray-400">
          {slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ''}
        </p>
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
  const [children, setChildren]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [activeIdx, setActiveIdx]             = useState(0);
  const [todaySchedule, setTodaySchedule]     = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError]     = useState(null);

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

  // Real schedule: same class-scoped endpoint the teacher dashboard widget
  // uses (GET /classes/:id/schedules), resolved via the learner's active
  // class enrollment (GET /classes/learner/:id).
  const loadSchedule = useCallback(async (learnerId) => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const enrollment = await classAPI.getLearnerClass(learnerId);
      const classId = enrollment?.data?.class?.id || enrollment?.data?.classId;
      if (!classId) { setTodaySchedule([]); return; }

      const res = await classAPI.getSchedules(classId);
      const all = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const today = getTodayName();

      setTodaySchedule(
        all
          .filter((s) => s.day === today)
          .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
          .map((s) => ({
            id: s.id,
            subject: s.learningArea?.shortName || s.learningArea?.name || s.subject,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
          }))
      );
    } catch (_) {
      setScheduleError("Couldn't load today's schedule");
      setTodaySchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (child?.id) loadSchedule(child.id);
    else { setTodaySchedule([]); setScheduleLoading(false); }
  }, [child?.id, loadSchedule]);

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
          </div>
          {scheduleLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : scheduleError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-xs text-rose-700">{scheduleError}</p>
            </div>
          ) : todaySchedule.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-xs text-gray-500">No lessons scheduled today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deriveStatuses(todaySchedule).map((slot) => (
                <ScheduleItem key={slot.id} slot={slot} />
              ))}
            </div>
          )}
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
