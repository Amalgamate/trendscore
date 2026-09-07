import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, BookOpen, MapPin, RefreshCw, Users,
  ChevronLeft, ChevronRight, Sun, AlertCircle,
  GraduationCap, Calendar
} from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';
import { fmt12, minutesFromMidnight, durationLabel, todayDayName } from '../../../../utils/timeFormat';
import { SCHOOL_DAYS_UPPER, SCHOOL_DAYS_SHORT, SCHOOL_DAYS_FULL, SCHOOL_DAY_ORDER } from '../../../../constants/timetable';

// Colour palette — one colour per learning area, cycling deterministically
const PALETTE = [
  { bg: '#EDE9FE', border: '#7C3AED', text: '#4C1D95' }, // purple
  { bg: '#D1FAE5', border: '#059669', text: '#064E3B' }, // emerald
  { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' }, // blue
  { bg: '#FEF3C7', border: '#D97706', text: '#78350F' }, // amber
  { bg: '#FCE7F3', border: '#DB2777', text: '#831843' }, // pink
  { bg: '#CFFAFE', border: '#0891B2', text: '#164E63' }, // cyan
  { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' }, // red
  { bg: '#E0F2FE', border: '#0284C7', text: '#0C4A6E' }, // sky
];

// Standard school periods (fallback grid when no schedules loaded)
const DEFAULT_PERIODS = [
  '07:30', '08:20', '09:10', '10:00', '10:45',
  '11:35', '12:25', '13:15', '14:05', '14:55',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCurrentPeriod(schedule) {
  const now = new Date();
  const todayDay = todayDayName();
  if (schedule.day !== todayDay) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= minutesFromMidnight(schedule.startTime) && cur < minutesFromMidnight(schedule.endTime);
}

// ─── Colour assignment ────────────────────────────────────────────────────────

function buildColorMap(schedules) {
  const map = {};
  let idx = 0;
  schedules.forEach((s) => {
    const key = s.learningArea?.name || s.subject || 'Unknown';
    if (!map[key]) {
      map[key] = PALETTE[idx % PALETTE.length];
      idx++;
    }
  });
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatPill = ({ icon: Icon, value, label, color = '#7C3AED' }) => (
  <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
    <div className="p-1.5 rounded-lg" style={{ background: color + '18' }}>
      <Icon size={14} style={{ color }} />
    </div>
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none">{label}</p>
      <p className="text-sm font-semibold text-gray-800 leading-tight">{value}</p>
    </div>
  </div>
);

const EmptyDay = () => (
  <div className="flex flex-col items-center justify-center py-8 text-gray-300">
    <Sun size={22} className="mb-1 opacity-50" />
    <p className="text-[10px] font-medium uppercase tracking-widest">Free</p>
  </div>
);

const PeriodCard = ({ schedule, colorMap, compact = false }) => {
  const colorKey = schedule.learningArea?.name || schedule.subject || 'Unknown';
  const color = colorMap[colorKey] || PALETTE[0];
  const active = isCurrentPeriod(schedule);

  return (
    <div
      className="rounded-xl border-l-4 px-3 py-2 transition-all duration-200 hover:shadow-md cursor-default select-none"
      style={{
        background: active ? color.bg : '#FAFAFA',
        borderLeftColor: color.border,
        borderTop: `0.5px solid ${color.border}30`,
        borderRight: `0.5px solid ${color.border}30`,
        borderBottom: `0.5px solid ${color.border}30`,
        boxShadow: active ? `0 2px 8px ${color.border}30` : undefined,
      }}
    >
      {/* Subject */}
      <p
        className="font-semibold text-xs leading-snug line-clamp-1"
        style={{ color: color.text }}
      >
        {active && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 mb-0.5 animate-pulse" />
        )}
        {schedule.learningArea?.name || schedule.subject || 'Lesson'}
      </p>

      {/* Class */}
      <p className="text-[10px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
        <GraduationCap size={10} />
        {schedule.class?.name || `${schedule.class?.grade || ''} ${schedule.class?.stream || ''}`.trim() || 'Class'}
      </p>

      {!compact && (
        <>
          {/* Time */}
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Clock size={10} />
            {fmt12(schedule.startTime)} – {fmt12(schedule.endTime)}
            <span className="text-gray-300 ml-1">{durationLabel(schedule.startTime, schedule.endTime)}</span>
          </p>

          {/* Room */}
          {schedule.room && (
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <MapPin size={10} /> {schedule.room}
            </p>
          )}
        </>
      )}
    </div>
  );
};

// ─── Grid View ────────────────────────────────────────────────────────────────

const GridView = ({ schedulesByDay, colorMap, activeDayIndex, setActiveDayIndex }) => {
  const today = todayDayName();

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr>
            <th className="w-16 py-3 px-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50/60">
              Day
            </th>
            {['07:30','08:20','09:10','10:00','Break','11:35','12:25','13:15','Lunch','14:05','14:55'].map((p, i) => (
              <th
                key={i}
                className="py-3 px-2 text-center text-[9px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50/60 min-w-[80px]"
              >
                {p.includes(':') ? fmt12(p) : (
                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-bold">{p}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SCHOOL_DAYS_UPPER.map((day, di) => {
            const daySlots = schedulesByDay[day] || [];
            const isToday = day === today;
            return (
              <tr
                key={day}
                className={`transition-colors ${isToday ? 'bg-brand-purple/[0.03]' : di % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
              >
                <td className="py-2 px-3 border-b border-gray-50 align-middle">
                  <div className="flex flex-col items-start">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-brand-purple' : 'text-gray-500'}`}>
                      {SCHOOL_DAYS_SHORT[day]}
                    </span>
                    {isToday && (
                      <span className="mt-0.5 text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-px rounded-full">TODAY</span>
                    )}
                  </div>
                </td>
                {/* Render 10 period columns, skip break/lunch */}
                {[0,1,2,3,'break',4,5,6,'lunch',7,8].map((slot, ci) => {
                  if (slot === 'break' || slot === 'lunch') {
                    return (
                      <td key={ci} className="py-2 px-1 border-b border-gray-50 border-l border-dashed border-amber-100">
                        <div className="text-center text-[8px] text-amber-400 font-semibold uppercase tracking-widest py-1">
                          {slot === 'break' ? '☕' : '🍽️'}
                        </div>
                      </td>
                    );
                  }
                  // Find a schedule that roughly aligns with this period slot
                  const periodTimes = ['07:30','08:20','09:10','10:00','11:35','12:25','13:15','14:05','14:55'];
                  const periodStart = periodTimes[slot];
                  const match = daySlots.find(s =>
                    Math.abs(minutesFromMidnight(s.startTime) - minutesFromMidnight(periodStart)) < 20
                  );
                  return (
                    <td key={ci} className="py-2 px-1 border-b border-gray-50 align-top min-h-[60px]">
                      {match ? (
                        <PeriodCard schedule={match} colorMap={colorMap} compact />
                      ) : (
                        <div className="h-8" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── List View ────────────────────────────────────────────────────────────────

const ListView = ({ schedulesByDay, colorMap, activeDayIndex, setActiveDayIndex }) => {
  const today = todayDayName();
  const activeDay = SCHOOL_DAYS_UPPER[activeDayIndex];
  const daySlots = schedulesByDay[activeDay] || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {SCHOOL_DAYS_UPPER.map((day, di) => {
          const isToday = day === today;
          const active = di === activeDayIndex;
          const count = (schedulesByDay[day] || []).length;
          return (
            <button
              key={day}
              onClick={() => setActiveDayIndex(di)}
              className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-all text-xs font-semibold ${
                active
                  ? 'bg-brand-purple text-white border-brand-purple shadow-lg shadow-brand-purple/20'
                  : isToday
                  ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-purple/40'
              }`}
            >
              <span className="uppercase tracking-widest text-[10px]">{SCHOOL_DAYS_SHORT[day]}</span>
              <span className={`text-[9px] mt-0.5 font-normal ${active ? 'text-white/70' : 'text-gray-400'}`}>
                {count} {count === 1 ? 'lesson' : 'lessons'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day heading */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-widest">
          {SCHOOL_DAYS_FULL[activeDay]}
        </h3>
        {activeDay === today && (
          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-widest">
            Today
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">{daySlots.length} period{daySlots.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Period cards */}
      {daySlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Sun size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No lessons scheduled</p>
          <p className="text-xs text-gray-400 mt-1">Enjoy your free day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {daySlots.map((s, i) => (
            <div key={s.id || i} className="flex items-stretch gap-3">
              {/* Time column */}
              <div className="w-16 flex-shrink-0 flex flex-col items-end pt-2">
                <span className="text-[10px] font-semibold text-gray-500">{fmt12(s.startTime)}</span>
                <div className="flex-1 w-px bg-gray-200 my-1 mx-auto" />
                <span className="text-[10px] text-gray-400">{fmt12(s.endTime)}</span>
              </div>
              {/* Card */}
              <div className="flex-1">
                <PeriodCard schedule={s} colorMap={colorMap} compact={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TimetableView = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
  const [activeDayIndex, setActiveDayIndex] = useState(() => {
    // Default to today's index (0=Mon … 4=Fri), fallback to 0
    const todayIdx = SCHOOL_DAYS_UPPER.indexOf(todayDayName());
    return todayIdx >= 0 ? todayIdx : 0;
  });

  const teacherId = user?.id || user?.userId;
  const teacherName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'My';

  const fetchSchedules = useCallback(async () => {
    if (!teacherId) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await api.classes.getTeacherSchedules(teacherId);
      const data = resp?.data || resp || [];
      // Sort by day order then by start time
      const sorted = [...data].sort((a, b) => {
        const dd = (SCHOOL_DAY_ORDER[a.day] ?? 9) - (SCHOOL_DAY_ORDER[b.day] ?? 9);
        if (dd !== 0) return dd;
        return minutesFromMidnight(a.startTime) - minutesFromMidnight(b.startTime);
      });
      setSchedules(sorted);
    } catch (err) {
      console.error('[TimetableView] fetch error', err);
      setError(err?.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Group by day
  const schedulesByDay = useMemo(() => {
    const map = {};
    SCHOOL_DAYS_UPPER.forEach((d) => (map[d] = []));
    schedules.forEach((s) => {
      const day = s.day?.toUpperCase();
      if (map[day]) map[day].push(s);
    });
    return map;
  }, [schedules]);

  // Stats
  const colorMap = useMemo(() => buildColorMap(schedules), [schedules]);
  const totalPeriods = schedules.length;
  const uniqueSubjects = useMemo(() => new Set(schedules.map(s => s.learningArea?.name || s.subject || '')).size, [schedules]);
  const uniqueClasses = useMemo(() => new Set(schedules.map(s => s.class?.id)).size, [schedules]);
  const activeNow = schedules.find(isCurrentPeriod);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
        <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Loading timetable…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-sm">
          <AlertCircle size={28} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-rose-800">Failed to load timetable</p>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            onClick={fetchSchedules}
            className="mt-4 px-5 py-2 bg-rose-600 text-white text-xs font-semibold uppercase tracking-widest rounded-lg hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-h-0">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{teacherName}'s Timetable</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Weekly schedule · current term</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
            {[
              { id: 'list', label: 'List' },
              { id: 'grid', label: 'Grid' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-md transition-all ${
                  viewMode === v.id
                    ? 'bg-white text-brand-purple shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchSchedules}
            className="p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <StatPill icon={Clock}       value={totalPeriods}    label="Periods/week"  color="#7C3AED" />
        <StatPill icon={BookOpen}    value={uniqueSubjects}  label="Subjects"      color="#059669" />
        <StatPill icon={Users}       value={uniqueClasses}   label="Classes"       color="#2563EB" />
        <StatPill icon={Calendar}    value={SCHOOL_DAYS_UPPER.filter(d => (schedulesByDay[d] || []).length > 0).length} label="Active days" color="#D97706" />
      </div>

      {/* ── Now teaching banner ────────────────────────────────────────────── */}
      {activeNow && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border-l-4"
          style={{ background: '#EDE9FE', borderLeftColor: '#7C3AED' }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-brand-purple uppercase tracking-widest">Now teaching</p>
            <p className="text-sm font-semibold text-gray-800">
              {activeNow.learningArea?.name || activeNow.subject} · {activeNow.class?.name || 'Class'}
            </p>
            <p className="text-[10px] text-gray-500">
              {fmt12(activeNow.startTime)} – {fmt12(activeNow.endTime)}
              {activeNow.room ? ` · Room ${activeNow.room}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 flex items-center justify-center mb-4">
            <Clock size={28} className="text-brand-purple/50" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No timetable set up yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Ask your admin to assign class schedules. They appear here once configured.
          </p>
        </div>
      )}

      {/* ── View content ───────────────────────────────────────────────────── */}
      {schedules.length > 0 && (
        viewMode === 'grid' ? (
          <GridView
            schedulesByDay={schedulesByDay}
            colorMap={colorMap}
            activeDayIndex={activeDayIndex}
            setActiveDayIndex={setActiveDayIndex}
          />
        ) : (
          <ListView
            schedulesByDay={schedulesByDay}
            colorMap={colorMap}
            activeDayIndex={activeDayIndex}
            setActiveDayIndex={setActiveDayIndex}
          />
        )
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      {schedules.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {Object.entries(colorMap).map(([subject, color]) => (
            <div
              key={subject}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium"
              style={{ background: color.bg, borderColor: color.border + '60', color: color.text }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.border }} />
              {subject}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimetableView;
