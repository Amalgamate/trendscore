/**
 * MobileStudentCourses — Mobile-native courses list for STUDENT role.
 * Wraps the existing /lms/my-courses API with a mobile-first card UI.
 * No MobileBottomNav — MobileAppShell provides it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, X, ChevronRight, CheckCircle2,
  Clock, AlertCircle, RefreshCw, ArrowLeft,
} from 'lucide-react';
import axiosInstance from '../../../../services/api/axiosConfig';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

const getProgressColor = (pct) => {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-amber-500';
};

const getProgressText = (pct) => {
  if (pct >= 80) return 'On track';
  if (pct >= 40) return 'In progress';
  if (pct > 0)   return 'Just started';
  return 'Not started';
};

function CourseCard({ course, onOpen }) {
  const pct = Math.round(course.progressPercent || 0);
  const barColor = getProgressColor(pct);
  const completed = course.completedItems || 0;
  const total     = course.totalItems || 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(course)}
      className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-purple-200 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{course.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {[course.subject, course.grade].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ChevronRight size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-gray-600 flex-shrink-0">{pct}%</span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          {completed} / {total} items
        </span>
        <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 40 ? 'text-blue-600' : 'text-amber-600'}`}>
          {getProgressText(pct)}
        </span>
      </div>
    </button>
  );
}

const MobileStudentCourses = ({ onNavigate }) => {
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await axiosInstance.get('/lms/my-courses');
      setCourses(r.data?.data || []);
    } catch (e) {
      setError(e?.message || 'Could not load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = courses.filter(c =>
    !search ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const inProgress  = filtered.filter(c => (c.progressPercent || 0) > 0 && (c.progressPercent || 0) < 100);
  const notStarted  = filtered.filter(c => (c.progressPercent || 0) === 0);
  const completed   = filtered.filter(c => (c.progressPercent || 0) >= 100);

  const handleOpen = (course) => {
    onNavigate?.('student-course-view', { courseId: course.courseId || course.id });
  };

  return (
    <div className="min-h-screen bg-[#eef3f8] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate?.('dashboard')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">My Courses</h1>
            {!loading && (
              <p className="text-[10px] text-gray-400">
                {courses.length} course{courses.length !== 1 ? 's' : ''} enrolled
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

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search courses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 border-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button type="button" onClick={load} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {search ? 'No courses match your search' : 'No courses enrolled'}
            </p>
            <p className="text-xs text-gray-400">
              {search ? 'Try a different keyword.' : 'Your teacher will assign courses to you.'}
            </p>
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} className="text-blue-500" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">In Progress ({inProgress.length})</p>
                </div>
                <div className="space-y-2">
                  {inProgress.map(c => <CourseCard key={c.courseId || c.id} course={c} onOpen={handleOpen} />)}
                </div>
              </section>
            )}

            {notStarted.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={13} className="text-amber-500" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Not Started ({notStarted.length})</p>
                </div>
                <div className="space-y-2">
                  {notStarted.map(c => <CourseCard key={c.courseId || c.id} course={c} onOpen={handleOpen} />)}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Completed ({completed.length})</p>
                </div>
                <div className="space-y-2">
                  {completed.map(c => <CourseCard key={c.courseId || c.id} course={c} onOpen={handleOpen} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MobileStudentCourses;
