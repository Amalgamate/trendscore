/**
 * StudentTimetable
 * A student's own weekly class timetable — mirrors the pattern used by
 * StudentAttendance.jsx (dashboardAPI.getStudentMetrics for the linked
 * learner) combined with the same class-scoped schedule endpoints already
 * used by the teacher dashboard widget and the parent portal's School
 * Today view (classAPI.getLearnerClass + classAPI.getSchedules).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock, RefreshCw } from 'lucide-react';
import { dashboardAPI, classAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };

// Derive today's weekday name — defaults to Monday on weekends, same
// approach as the teacher dashboard's WeeklyTimetableWidget.
const getTodayName = () => {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return DAYS[day >= 1 && day <= 5 ? day - 1 : 0];
};

const StudentTimetable = ({ user, onNavigate }) => {
  const [learnerId, setLearnerId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(getTodayName);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const metricsRes = await dashboardAPI.getStudentMetrics();
      const learner = metricsRes?.data?.learner;
      if (!learner?.id) {
        setLearnerId(null);
        setSchedules([]);
        return;
      }
      setLearnerId(learner.id);

      const enrollment = await classAPI.getLearnerClass(learner.id);
      const classId = enrollment?.data?.class?.id || enrollment?.data?.classId;
      if (!classId) {
        setSchedules([]);
        return;
      }

      const res = await classAPI.getSchedules(classId);
      const all = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSchedules(all);
    } catch (err) {
      setError(err?.message || 'Could not load your timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const daySchedule = schedules
    .filter((s) => String(s.day || '').trim().toUpperCase() === activeDay.toUpperCase())
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            aria-label="Back to dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={17} className="text-blue-700" />
              <h1 className="text-lg font-black text-[#06285a]">My Timetable</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Your class's weekly schedule.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#06285a] transition hover:border-blue-300 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : learnerId ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {/* Day tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeDay === day ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            ))}
          </div>

          {/* Lessons for the selected day */}
          <div className="mt-3 space-y-2">
            {daySchedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Clock size={26} className="mb-2 opacity-40" />
                <p className="text-xs font-medium">No lessons on {activeDay}</p>
              </div>
            ) : (
              daySchedule.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="mt-0.5 flex w-20 shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <Clock size={11} />
                    <span>{entry.startTime}–{entry.endTime}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#06285a]">
                      {entry.learningArea?.shortName || entry.learningArea?.name || entry.subject}
                    </p>
                    {entry.room && <p className="mt-0.5 text-[10px] text-slate-500">{entry.room}</p>}
                    {entry.teacher && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {[entry.teacher.firstName, entry.teacher.lastName].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : !error ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No learner record is linked to this account yet, so a timetable can't be shown.
        </div>
      ) : null}
    </div>
  );
};

export default StudentTimetable;
