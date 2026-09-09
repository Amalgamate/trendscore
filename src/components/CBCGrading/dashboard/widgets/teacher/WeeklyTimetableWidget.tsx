import React, { useEffect, useState } from 'react';
import { Clock, BookOpen, Loader2, AlertTriangle, CalendarOff } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import axiosInstance from '../../../../../services/api/axiosConfig';
import { timetableAPI } from '../../../../../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

// Derive today's weekday name — defaults to Monday if weekend
const getTodayName = (): string => {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return DAYS[day >= 1 && day <= 5 ? day - 1 : 0];
};

// Monday of the current calendar week, formatted as YYYY-MM-DD — same
// convention the admin TimetablePage uses for getEffectiveSchedule.
const getStartOfWeek = (date: Date): Date => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

interface ScheduleEntry {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  day: string;
  room?: string | null;
  learningArea?: { name: string; shortName?: string } | null;
}

interface MilestoneEvent {
  id: string;
  title?: string;
  type: string;
}

interface Milestones {
  isExamWeek: boolean;
  hasMidterm: boolean;
  dayMilestones: Record<string, MilestoneEvent[]>;
}

const EMPTY_MILESTONES: Milestones = {
  isExamWeek: false,
  hasMidterm: false,
  dayMilestones: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
};

const WeeklyTimetableWidget: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestones>(EMPTY_MILESTONES);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeDay, setActiveDay] = useState(getTodayName);

  useEffect(() => {
    if (!user?.id && !user?.userId) return;
    const teacherId = user.id ?? user.userId;
    setLoading(true);
    axiosInstance
      .get(`/classes/teacher/${teacherId}/schedules`)
      .then(res => {
        const data: ScheduleEntry[] = res.data?.data ?? res.data ?? [];
        setSchedules(data);
      })
      .catch(() => setError('Could not load your timetable.'))
      .finally(() => setLoading(false));
  }, [user?.id, user?.userId]);

  // Calendar milestones (holidays / exam weeks) for the current week — the
  // same effective-schedule endpoint the admin TimetablePage already uses.
  // Best-effort: a failure here never blocks the lesson list itself.
  useEffect(() => {
    const weekStart = getStartOfWeek(new Date());
    const yyyy = weekStart.getFullYear();
    const mm = String(weekStart.getMonth() + 1).padStart(2, '0');
    const dd = String(weekStart.getDate()).padStart(2, '0');

    timetableAPI
      .getEffectiveSchedule({ academicYear: yyyy, weekStartDate: `${yyyy}-${mm}-${dd}` })
      .then((res: any) => {
        const payload = res?.data || res;
        if (!payload) return;
        const dayMap = payload.dayMilestones || {};
        setMilestones({
          isExamWeek: !!payload.isExamWeek,
          hasMidterm: !!payload.hasMidterm,
          dayMilestones: {
            Monday: dayMap.Monday || [],
            Tuesday: dayMap.Tuesday || [],
            Wednesday: dayMap.Wednesday || [],
            Thursday: dayMap.Thursday || [],
            Friday: dayMap.Friday || [],
          },
        });
      })
      .catch(() => { /* milestones are a non-fatal enhancement */ });
  }, []);

  const daySchedule = schedules
    .filter(s => String(s.day || '').trim().toUpperCase() === activeDay.toUpperCase())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const activeDayMilestones = milestones.dayMilestones[activeDay] || [];
  const activeDayHoliday = activeDayMilestones.find(e => e.type === 'HOLIDAY');
  const activeDayHasExam = activeDayMilestones.some(e => e.type === 'EXAM' || e.type === 'EXAM_WEEK');

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Loading timetable…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-32 text-rose-500 text-sm">{error}</div>
  );

  return (
    <div className="space-y-3">
      {milestones.isExamWeek && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          <AlertTriangle size={13} />
          Exam week — some periods may be adjusted.
        </div>
      )}

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {DAYS.map(day => {
          const dayMilestoneList = milestones.dayMilestones[day] || [];
          const hasHoliday = dayMilestoneList.some(e => e.type === 'HOLIDAY');
          const hasExam = dayMilestoneList.some(e => e.type === 'EXAM' || e.type === 'EXAM_WEEK');
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                ${activeDay === day
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {DAY_SHORT[day]}
              {(hasHoliday || hasExam) && (
                <span
                  className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${hasHoliday ? 'bg-rose-500' : 'bg-amber-500'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Lessons for the selected day */}
      {activeDayHoliday ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <CalendarOff size={28} className="mb-2 opacity-40" />
          <p className="text-xs font-medium text-center">
            No school {activeDay} — {activeDayHoliday.title || 'Holiday'}
          </p>
        </div>
      ) : daySchedule.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <BookOpen size={28} className="mb-2 opacity-40" />
          <p className="text-xs font-medium">No lessons on {activeDay}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeDayHasExam && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600">
              <AlertTriangle size={11} /> Exam day — check for schedule changes
            </div>
          )}
          {daySchedule.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mt-0.5 shrink-0 w-20">
                <Clock size={11} />
                <span>{entry.startTime}–{entry.endTime}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {entry.learningArea?.shortName || entry.learningArea?.name || entry.subject}
                </p>
                {entry.room && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{entry.room}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklyTimetableWidget;
