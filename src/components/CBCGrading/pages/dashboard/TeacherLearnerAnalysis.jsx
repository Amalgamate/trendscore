import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { EmptyState } from '@/design-system/components';

const formatMinutes = (minutes) => {
  const total = Number(minutes || 0);
  if (!total) return 'No scheduled minutes';
  if (total < 60) return `${total} min/week`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours}h ${remainder}m/week` : `${hours}h/week`;
};

const formatNextLesson = (lesson) => (
  lesson ? [lesson.day, lesson.time].filter(Boolean).join(' at ') || 'Scheduled' : 'No timetable slot'
);

const TeacherLearnerAnalysis = ({ user, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await dashboardAPI.getTeacherMetrics('today');
        if (!active) return;
        setMetrics(response?.data || response || {});
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load learner analysis.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const analysis = metrics?.learnerAnalysis || {};
  const classes = useMemo(() => (
    Array.isArray(analysis.classes) ? analysis.classes : []
  ), [analysis.classes]);
  const subjectRows = useMemo(() => (
    classes.flatMap((classItem) => (
      (classItem.subjects || []).map((subject) => ({
        ...subject,
        classId: classItem.classId,
        className: classItem.className,
        classLearners: classItem.learnerCount,
        attendanceMarked: classItem.attendanceMarked,
      }))
    ))
  ), [classes]);

  if (loading) {
    return (
      <div className="min-h-[360px] bg-white px-4 py-12 text-center md:min-h-[420px] md:border md:border-slate-200 md:p-10">
        <Loader2 className="mx-auto mb-3 animate-spin text-orange-600" size={28} />
        <p className="text-sm font-semibold text-slate-600">Loading your learner analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle size={44} />}
        title="Learner analysis unavailable"
        description={error}
        action={{ label: 'Back to Dashboard', onClick: () => onNavigate('dashboard') }}
      />
    );
  }

  return (
    <div className="space-y-4 px-3 pb-24 pt-3 md:space-y-5 md:px-0 md:pb-0 md:pt-0">
      <div className="border-b border-slate-200 pb-3 md:pb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Teacher Learner Analysis</p>
        <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">My Learners</h1>
        <p className="mt-1 text-xs leading-5 text-slate-600 md:text-sm">
          Scoped to classes and subjects assigned to {user?.firstName || user?.name || 'this teacher'}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="border border-slate-200 bg-white p-3 md:p-4">
          <Users className="mb-2 text-emerald-700 md:mb-3" size={20} />
          <p className="text-xl font-black text-slate-950 md:text-2xl">{analysis.totalLearners || 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-xs">Learners</p>
        </div>
        <div className="border border-slate-200 bg-white p-3 md:p-4">
          <GraduationCap className="mb-2 text-blue-700 md:mb-3" size={20} />
          <p className="text-xl font-black text-slate-950 md:text-2xl">{analysis.totalClasses || 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-xs">Classes</p>
        </div>
        <div className="border border-slate-200 bg-white p-3 md:p-4">
          <BookOpen className="mb-2 text-orange-700 md:mb-3" size={20} />
          <p className="text-xl font-black text-slate-950 md:text-2xl">{analysis.totalSubjects || 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-xs">Subjects</p>
        </div>
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3 md:p-4">
          <h2 className="text-sm font-black text-slate-950 md:text-base">Class and Subject Breakdown</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">Limited to the teacher's assigned class and subject scope.</p>
        </div>

        {subjectRows.length > 0 ? (
          <>
          <div className="block divide-y divide-slate-100 md:hidden">
            {subjectRows.map((row) => (
              <div key={`${row.classId}-${row.subject}`} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{row.className}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{row.subject}</p>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                    {row.learnerCount || 0}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2">
                    <p className="font-bold uppercase tracking-wider text-slate-400">Lessons</p>
                    <p className="mt-1 font-black text-slate-900">{row.lessonCount || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2">
                    <p className="font-bold uppercase tracking-wider text-slate-400">Weekly</p>
                    <p className="mt-1 font-black text-slate-900">{formatMinutes(row.weeklyMinutes)}</p>
                  </div>
                  <div className="bg-slate-50 p-2">
                    <p className="font-bold uppercase tracking-wider text-slate-400">Attendance</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-black text-emerald-700">
                      <CheckCircle2 size={13} />
                      {row.attendanceMarked || 0}/{row.classLearners || row.learnerCount || 0}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-2">
                    <p className="font-bold uppercase tracking-wider text-amber-500">Pending</p>
                    <p className="mt-1 font-black text-amber-700">{row.pendingAssessments || 0}</p>
                  </div>
                </div>
                <p className="mt-3 inline-flex max-w-full items-center gap-2 text-xs font-semibold text-slate-600">
                  <CalendarDays size={14} className="shrink-0" />
                  <span className="truncate">{formatNextLesson(row.nextLesson)}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Learners</th>
                  <th className="px-4 py-3">Lessons</th>
                  <th className="px-4 py-3">Weekly Load</th>
                  <th className="px-4 py-3">Next Lesson</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {subjectRows.map((row) => (
                  <tr key={`${row.classId}-${row.subject}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-950">{row.className}</p>
                      <p className="text-xs text-slate-500">{row.classLearners} learners in class</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.subject}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.learnerCount}</td>
                    <td className="px-4 py-3">{row.lessonCount || 0}</td>
                    <td className="px-4 py-3">{formatMinutes(row.weeklyMinutes)}</td>
                    <td className="px-4 py-3">
                      {row.nextLesson ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <CalendarDays size={14} />
                          {formatNextLesson(row.nextLesson)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No timetable slot</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={14} />
                        {row.attendanceMarked || 0}/{row.classLearners || row.learnerCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                        {row.pendingAssessments || 0} assessments
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-6 md:p-10">
            <EmptyState
              icon={<Users size={44} />}
              title="No assigned learners found"
              description="Learners appear here after the teacher is assigned as a class teacher or subject teacher on the timetable."
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {classes.map((classItem) => (
          <div key={classItem.classId} className="border border-slate-200 bg-white p-3 md:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-slate-950 md:text-base">{classItem.className}</h3>
                <p className="text-xs font-semibold text-slate-500">{classItem.learnerCount} learners - {classItem.subjectCount} subjects</p>
              </div>
              {classItem.room && (
                <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{classItem.room}</span>
              )}
            </div>
            <div className="mt-3 space-y-2 md:mt-4">
              {(classItem.subjects || []).map((subject) => (
                <div key={subject.subject} className="border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-900">{subject.subject}</p>
                    <p className="text-xs font-bold text-slate-500">{subject.learnerCount} learners</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {(subject.days || []).join(', ') || 'No scheduled days'} • {formatMinutes(subject.weeklyMinutes)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherLearnerAnalysis;
