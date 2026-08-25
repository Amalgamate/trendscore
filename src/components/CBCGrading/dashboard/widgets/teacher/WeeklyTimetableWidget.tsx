import React, { useEffect, useState } from 'react';
import { Clock, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import axiosInstance from '../../../../../services/api/axiosConfig';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

// Derive today's weekday name — defaults to Monday if weekend
const getTodayName = (): string => {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return DAYS[day >= 1 && day <= 5 ? day - 1 : 0];
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

const WeeklyTimetableWidget: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
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

  const daySchedule = schedules
    .filter(s => s.day === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
              ${activeDay === day
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {DAY_SHORT[day]}
          </button>
        ))}
      </div>

      {/* Lessons for the selected day */}
      {daySchedule.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <BookOpen size={28} className="mb-2 opacity-40" />
          <p className="text-xs font-medium">No lessons on {activeDay}</p>
        </div>
      ) : (
        <div className="space-y-2">
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
