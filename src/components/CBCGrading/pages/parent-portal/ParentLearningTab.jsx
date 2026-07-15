/**
 * ParentLearningTab — Parent Portal Learning Dashboard
 * Shows parent's children learning progress, assignments, and feedback
 *
 * Sections:
 * - Today's Homework (assignments due today)
 * - Pending (submitted but not marked)
 * - Completed (marked submissions)
 * - Teacher Feedback (recent feedback from teachers)
 * - Learning Progress (child's learning progress summary)
 * - Weak Subjects (Enterprise-only)
 *
 * Data scoped to: learner.parentId = authenticatedParent.id
 * Gated on: PARENT role + lms-professional app active
 *
 * Requirements: 2.6, 2.7, 14.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  Calendar,
  Award,
  Target,
  Users,
  ArrowRight,
} from 'lucide-react';
import { dashboardAPI, lmsAPI } from '../../../../services/api';
import { hasAppAccess } from '../utils/appAccess';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Skeleton } from '../../../ui';
import ParentChildProfile from '../parent/ParentChildProfile';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};

const fmtTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
};

const isToday = (d) => {
  if (!d) return false;
  const date = new Date(d);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

const scoreColor = (n) => {
  const v = Number(n || 0);
  if (v >= 70) return 'text-emerald-600';
  if (v >= 50) return 'text-amber-500';
  return 'text-rose-600';
};

const scoreBg = (n) => {
  const v = Number(n || 0);
  if (v >= 70) return 'bg-emerald-50 border-emerald-200';
  if (v >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
};

const statusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'SUBMITTED') return { label: 'Pending', color: 'bg-amber-100 text-amber-700' };
  if (s === 'MARKED') return { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' };
  if (s === 'DRAFT') return { label: 'Draft', color: 'bg-gray-100 text-gray-600' };
  if (s === 'LATE') return { label: 'Late', color: 'bg-rose-100 text-rose-700' };
  return { label: s, color: 'bg-gray-100 text-gray-600' };
};

// ─── Today's Homework Section ───────────────────────────────────────────────

function TodaysHomework({ assignments, loading, onSelectChild }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const todaysAssignments = (assignments || []).filter((a) => isToday(a.dueDate));

  if (todaysAssignments.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-700">No homework due today</p>
          <p className="text-xs text-emerald-600">All caught up for now!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todaysAssignments.map((a) => {
        const child = a.child || a.learner;
        const photoSrc = getChildPhoto(child);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelectChild(child)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={child?.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-blue-500"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-blue-700 font-bold text-sm">
                {child?.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{a.title}</p>
              <p className="text-[10px] text-gray-500">
                {child?.name?.split(' ')[0]} · {a.learningArea?.name || a.learningArea || a.subject}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-rose-600">Due Today</p>
              <p className="text-[10px] text-gray-400">{fmtTime(a.dueDate)}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ─── Pending Submissions Section ────────────────────────────────────────────

function PendingSubmissions({ submissions, loading, onSelectChild }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const pending = (submissions || []).filter((s) => s.status === 'SUBMITTED');

  if (pending.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <Clock size={18} className="mx-auto mb-1 text-gray-300" />
        <p className="text-xs text-gray-500">No pending submissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.slice(0, 5).map((s) => {
        const child = s.child || s.learner;
        const photoSrc = getChildPhoto(child);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectChild(child)}
            className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-left hover:border-amber-300 transition-all"
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={child?.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-amber-400"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-amber-700 font-bold text-xs">
                {child?.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{s.assignment?.title || s.title}</p>
              <p className="text-[10px] text-gray-500">{child?.name?.split(' ')[0]} · Awaiting marking</p>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(s.status).color}`}>
              {statusBadge(s.status).label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Completed Submissions Section ──────────────────────────────────────────

function CompletedSubmissions({ submissions, loading, onSelectChild }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const completed = (submissions || []).filter((s) => s.status === 'MARKED');

  if (completed.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <CheckCircle size={18} className="mx-auto mb-1 text-gray-300" />
        <p className="text-xs text-gray-500">No completed submissions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {completed.slice(0, 5).map((s) => {
        const child = s.child || s.learner;
        const photoSrc = getChildPhoto(child);
        const score = s.marks || s.score;
        const total = s.totalMarks || s.assignment?.totalMarks || 100;
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectChild(child)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 text-left hover:border-emerald-300 transition-all"
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={child?.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-emerald-400"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-700 font-bold text-xs">
                {child?.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{s.assignment?.title || s.title}</p>
              <p className="text-[10px] text-gray-500">{child?.name?.split(' ')[0]} · Marked</p>
            </div>
            <div className={`px-2 py-1 rounded-lg border ${scoreBg(pct)}`}>
              <p className={`text-sm font-bold ${scoreColor(pct)}`}>{pct}%</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Teacher Feedback Section ───────────────────────────────────────────────

function TeacherFeedback({ feedback, loading, onSelectChild }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!feedback || feedback.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <MessageSquare size={18} className="mx-auto mb-1 text-gray-300" />
        <p className="text-xs text-gray-500">No recent feedback from teachers</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feedback.slice(0, 4).map((f) => {
        const child = f.child || f.learner;
        const photoSrc = getChildPhoto(child);
        return (
          <div
            key={f.id}
            className="bg-white border border-gray-200 rounded-xl p-3"
          >
            <div className="flex items-start gap-2 mb-2">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={child?.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-[10px]">
                  {child?.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{f.assignment?.title || 'Assignment'}</p>
                <p className="text-[10px] text-gray-500">{child?.name?.split(' ')[0]} · {f.teacher?.name || 'Teacher'}</p>
              </div>
            </div>
            <p className="text-xs text-gray-700 line-clamp-2">{f.feedback || 'Great work on this assignment!'}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Learning Progress Section ──────────────────────────────────────────────

function LearningProgress({ children, progress, loading, onSelectChild }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!children || children.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <Users size={18} className="mx-auto mb-1 text-gray-300" />
        <p className="text-xs text-gray-500">No children linked</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {children.map((child) => {
        const photoSrc = getChildPhoto(child);
        const childProgress = progress?.find((p) => p.learnerId === child.id) || child.progress || {};
        const lessonsComplete = childProgress.lessonsCompleted || child.lessonsCompleted || 0;
        const lessonsTotal = childProgress.lessonsTotal || child.lessonsTotal || 0;
        const pct = lessonsTotal > 0 ? Math.round((lessonsComplete / lessonsTotal) * 100) : 0;

        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelectChild(child)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-blue-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={child.name}
                  className="w-9 h-9 rounded-full object-cover border-2 border-blue-500"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {child.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
                <p className="text-[10px] text-gray-500">{child.grade} · {child.className || 'Class'}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${scoreColor(pct)}`}>{pct}%</p>
                <p className="text-[9px] text-gray-400">progress</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{lessonsComplete}/{lessonsTotal}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Weak Subjects Section (Enterprise-only) ────────────────────────────────

function WeakSubjects({ children, loading, onSelectChild, hasEnterprise }) {
  if (!hasEnterprise) return null;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Identify weak subjects from children's data
  const weakSubjects = (children || []).flatMap((child) => {
    const subjects = child.subjects || child.weakSubjects || [];
    return subjects
      .filter((s) => Number(s.score || 0) < 50)
      .map((s) => ({
        ...s,
        child,
      }));
  }).sort((a, b) => Number(a.score || 0) - Number(b.score || 0)).slice(0, 5);

  if (weakSubjects.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <Target size={18} className="text-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-700">All subjects on track</p>
          <p className="text-xs text-emerald-600">No weak subjects identified</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {weakSubjects.map((s, i) => {
        const photoSrc = getChildPhoto(s.child);
        return (
          <button
            key={`${s.child?.id}-${s.name || s.learningArea}-${i}`}
            type="button"
            onClick={() => onSelectChild(s.child)}
            className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-3 text-left hover:border-rose-300 transition-all"
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={s.child?.name}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">
                {s.child?.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{s.name || s.learningArea}</p>
              <p className="text-[10px] text-gray-500">{s.child?.name?.split(' ')[0]} · Needs attention</p>
            </div>
            <div className="px-2 py-1 rounded-lg bg-rose-100 border border-rose-200">
              <p className="text-sm font-bold text-rose-600">{Math.round(Number(s.score || 0))}%</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Section Wrapper ────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, onSeeAll, seeAllLabel }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-[#3B1FA3]" />}
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs text-[#3B1FA3] font-semibold flex items-center gap-0.5 hover:underline"
          >
            {seeAllLabel || 'See all'} <ChevronRight size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentLearningTab = ({ user, onNavigate, brandingSettings }) => {
  const [metrics, setMetrics] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  const { isRole } = usePermissions();

  // Check app access
  const hasLmsProfessional = hasAppAccess(user, 'lms-professional');
  const hasLmsEnterprise = hasAppAccess(user, 'lms-enterprise');
  const isParent = isRole('PARENT');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch parent metrics (includes children)
      const metricsRes = await dashboardAPI.getParentMetrics();
      if (metricsRes?.success) {
        setMetrics(metricsRes.data);
      }

      // Fetch LMS data for children
      const children = metricsRes?.data?.children || [];
      const childrenIds = children.map((c) => c.id).filter(Boolean);

      if (childrenIds.length > 0) {
        // Fetch each child's assignments (with that child's submission status
        // already attached) via the parent-scoped endpoint. getAssignments +
        // getMySubmissions are self-scoped for STUDENT accounts and cannot
        // serve a multi-child parent view — getMySubmissions in particular
        // resolves the *authenticated user's own* learner record server-side,
        // which 404s for a PARENT account regardless of any learnerIds filter.
        const childResults = await Promise.all(
          children.map((child) =>
            lmsAPI.getChildAssignments(child.id)
              .then((res) => (res?.success ? (res.data || []).map((a) => ({ ...a, child })) : []))
              .catch(() => [])
          )
        );
        const combinedAssignments = childResults.flat();
        setAssignments(combinedAssignments);

        const withSubmission = combinedAssignments.filter((a) => a.mySubmission);
        setSubmissions(
          withSubmission.map((a) => ({
            id: a.mySubmission.id,
            status: a.mySubmission.status,
            marks: a.mySubmission.marks,
            feedback: a.mySubmission.feedback,
            submittedAt: a.mySubmission.submittedAt,
            assignment: { title: a.title, totalMarks: a.totalMarks },
            child: a.child,
          }))
        );
        setFeedback(
          withSubmission
            .filter((a) => a.mySubmission.feedback && a.mySubmission.status === 'MARKED')
            .map((a) => ({
              id: a.mySubmission.id,
              feedback: a.mySubmission.feedback,
              assignment: { title: a.title },
              child: a.child,
            }))
        );

        // Fetch progress for all children: sum content-level progress across
        // each learner's active course enrollments (there's no single
        // "aggregate" endpoint, so we combine per-course results).
        const progressResults = await Promise.all(
          childrenIds.map(async (learnerId) => {
            try {
              const enrollRes = await lmsAPI.getEnrollments({ learnerId, status: 'ACTIVE' });
              const enrollments = enrollRes?.data?.enrollments ?? [];
              if (enrollments.length === 0) {
                return { learnerId, lessonsCompleted: 0, lessonsTotal: 0 };
              }

              const perCourse = await Promise.all(
                enrollments.map((e) =>
                  lmsAPI.getLearnerProgress(learnerId, e.courseId).catch(() => null)
                )
              );

              const totals = perCourse.filter(Boolean).reduce(
                (acc, r) => {
                  const d = r?.data ?? r;
                  acc.completed += d?.completedContent || 0;
                  acc.total += d?.totalContent || 0;
                  return acc;
                },
                { completed: 0, total: 0 }
              );

              return { learnerId, lessonsCompleted: totals.completed, lessonsTotal: totals.total };
            } catch {
              return { learnerId, lessonsCompleted: 0, lessonsTotal: 0 };
            }
          })
        );
        setProgress(progressResults);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load learning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLmsProfessional && isParent) {
      loadData();
    }
  }, [loadData, hasLmsProfessional, isParent]);

  // Gate: PARENT role + lms-professional app active
  if (!isParent) {
    return (
      <div className="min-h-screen bg-[var(--app-page-bg)] flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-semibold text-gray-900 mb-1">Access Restricted</p>
          <p className="text-xs text-gray-500">This tab is only available for parent accounts.</p>
        </div>
      </div>
    );
  }

  if (!hasLmsProfessional) {
    return (
      <div className="min-h-screen bg-[var(--app-page-bg)] flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-sm">
          <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-900 mb-1">Learning Hub Not Active</p>
          <p className="text-xs text-gray-500">Your school has not activated the Learning Hub module.</p>
        </div>
      </div>
    );
  }

  const children = metrics?.children || [];

  // Child detail view
  if (selectedChild) {
    return (
      <ParentChildProfile
        child={selectedChild}
        onBack={() => setSelectedChild(null)}
        initialTab="learning"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="px-4 pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Learning Hub</h1>
            <p className="text-xs text-gray-500">Track your children's learning journey</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="text-xs text-[#3B1FA3] font-semibold hover:underline"
          >
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="text-[10px] text-rose-600 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Today's Homework */}
        <Section title="Today's Homework" icon={Calendar}>
          <TodaysHomework
            assignments={assignments}
            loading={loading}
            onSelectChild={setSelectedChild}
          />
        </Section>

        {/* Pending Submissions */}
        <Section title="Pending Review" icon={Clock}>
          <PendingSubmissions
            submissions={submissions}
            loading={loading}
            onSelectChild={setSelectedChild}
          />
        </Section>

        {/* Completed Submissions */}
        <Section title="Completed" icon={CheckCircle}>
          <CompletedSubmissions
            submissions={submissions}
            loading={loading}
            onSelectChild={setSelectedChild}
          />
        </Section>

        {/* Teacher Feedback */}
        <Section title="Teacher Feedback" icon={MessageSquare}>
          <TeacherFeedback
            feedback={feedback}
            loading={loading}
            onSelectChild={setSelectedChild}
          />
        </Section>

        {/* Learning Progress */}
        <Section title="Learning Progress" icon={TrendingUp}>
          <LearningProgress
            children={children}
            progress={progress}
            loading={loading}
            onSelectChild={setSelectedChild}
          />
        </Section>

        {/* Weak Subjects (Enterprise-only) */}
        <Section title="Weak Subjects" icon={Target}>
          <WeakSubjects
            children={children}
            loading={loading}
            onSelectChild={setSelectedChild}
            hasEnterprise={hasLmsEnterprise}
          />
        </Section>

        {/* Empty State */}
        {!loading && children.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <Users size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-900 mb-1">No Children Linked</p>
            <p className="text-xs text-gray-500">Add children to your account to see their learning progress.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentLearningTab;
