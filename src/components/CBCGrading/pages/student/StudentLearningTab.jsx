/**
 * StudentLearningTab — Student Learning Dashboard
 * Shows student's learning progress, assignments, lessons, and resources
 *
 * Sections:
 * - My Assignments (assignments due for student's class)
 * - Today's Lessons (from class schedule)
 * - Continue Learning (in-progress lessons)
 * - Downloads (recent resource downloads)
 * - Revision (link to revision library)
 * - Achievements (placeholder for Phase 5 gamification)
 *
 * Data scoped to: authenticated student
 * Gated on: STUDENT role + lms-professional app active
 *
 * Requirements: 2.4, 7.7, 7.8
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Award,
  ChevronRight,
  Download,
  Play,
  Bookmark,
  RefreshCw,
  Search,
  ClipboardList,
} from 'lucide-react';
import { dashboardAPI, lmsAPI } from '../../../../services/api';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Skeleton } from '../../../ui';

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

const isToday = (d) => {
  if (!d) return false;
  const date = new Date(d);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getTimeUntil = (dueDate) => {
  if (!dueDate) return '';
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return 'Due soon';
};

const assignmentStatusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'SUBMITTED') return { label: 'Submitted', bg: 'bg-amber-100', text: 'text-amber-700' };
  if (s === 'MARKED') return { label: 'Marked', bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (s === 'DRAFT') return { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600' };
  if (s === 'PENDING') return { label: 'Pending', bg: 'bg-blue-100', text: 'text-blue-700' };
  return { label: s, bg: 'bg-gray-100', text: 'text-gray-600' };
};

// ─── Loading Skeleton ───────────────────────────────────────────────────────

const SectionSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-20 w-full rounded-lg" />
    ))}
  </div>
);

// ─── My Assignments Section ────────────────────────────────────────────────

function AssignmentCard({ assignment, onSelect }) {
  const status = assignmentStatusBadge(assignment.status);
  const timeLeft = getTimeUntil(assignment.dueDate);

  return (
    <div
      onClick={onSelect}
      className="p-4 border border-slate-100 rounded-lg hover:shadow-md hover:border-[#ff7900]/40 transition-all cursor-pointer bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-slate-900">{assignment.title}</h4>
          <p className="text-xs text-slate-500 mt-1">{assignment.subject || 'Assignment'}</p>
          {assignment.dueDate && (
            <div className="flex items-center gap-2 mt-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-600">
                {fmtDate(assignment.dueDate)} • {timeLeft}
              </span>
            </div>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${status.bg} ${status.text}`}>
          {status.label}
        </div>
      </div>
    </div>
  );
}

function MyAssignmentsSection({ assignments, loading, onSelectAssignment }) {
  if (loading) return <SectionSkeleton />;
  if (!assignments || assignments.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
        <CheckCircle2 size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No assignments yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assignments.slice(0, 5).map((assignment) => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          onSelect={() => onSelectAssignment(assignment)}
        />
      ))}
      {assignments.length > 5 && (
        <button className="w-full py-2 text-sm font-medium text-[#ff7900] hover:text-[#ff7900]/80 transition">
          View all {assignments.length} assignments →
        </button>
      )}
    </div>
  );
}

// ─── Today's Lessons Section ───────────────────────────────────────────────

function LessonCard({ lesson, onSelect }) {
  const progress = lesson.progress || 0;

  return (
    <div
      onClick={onSelect}
      className="p-4 border border-slate-100 rounded-lg hover:shadow-md hover:border-[#ff7900]/40 transition-all cursor-pointer bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-slate-900">{lesson.title}</h4>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-500">{lesson.estimatedMinutes || 30} mins</span>
            {lesson.subject && <span className="text-xs text-slate-400">• {lesson.subject}</span>}
          </div>
          {progress > 0 && (
            <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-[#ff7900] h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="text-right">
          {progress === 0 ? (
            <Play size={20} className="text-slate-400" />
          ) : (
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-700">{progress}%</p>
              <p className="text-xs text-slate-500">done</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TodaysLessonsSection({ lessons, loading, onSelectLesson }) {
  if (loading) return <SectionSkeleton />;
  if (!lessons || lessons.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
        <BookOpen size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No lessons scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          onSelect={() => onSelectLesson(lesson)}
        />
      ))}
    </div>
  );
}

// ─── Continue Learning Section ─────────────────────────────────────────────

function ContinueLearningSection({ lessons, loading, onSelectLesson }) {
  if (loading) return <SectionSkeleton />;
  if (!lessons || lessons.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
        <Play size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Start your first lesson</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lessons.slice(0, 3).map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          onSelect={() => onSelectLesson(lesson)}
        />
      ))}
    </div>
  );
}

// ─── Downloads Section ─────────────────────────────────────────────────────

function ResourceCard({ resource, onDownload }) {
  return (
    <div className="p-4 border border-slate-100 rounded-lg hover:shadow-md hover:border-[#ff7900]/40 transition-all bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-slate-900">{resource.title}</h4>
          <p className="text-xs text-slate-500 mt-1">{resource.subject || resource.resourceType}</p>
          <div className="flex items-center gap-2 mt-2">
            <Download size={14} className="text-slate-400" />
            <span className="text-xs text-slate-600">{resource.downloadCount || 0} downloads</span>
          </div>
        </div>
        <button
          onClick={() => onDownload(resource)}
          className="px-3 py-1 text-xs font-medium bg-[#ff7900] text-white rounded hover:bg-[#ff7900]/90 transition"
        >
          Download
        </button>
      </div>
    </div>
  );
}

function DownloadsSection({ resources, loading, onDownloadResource }) {
  if (loading) return <SectionSkeleton />;
  if (!resources || resources.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
        <FileText size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No downloads yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {resources.slice(0, 3).map((resource) => (
        <ResourceCard
          key={resource.id}
          resource={resource}
          onDownload={onDownloadResource}
        />
      ))}
    </div>
  );
}

// ─── Achievements Section ──────────────────────────────────────────────────

const ACHIEVEMENT_ICON_BG = {
  FIRST_LESSON: 'bg-sky-100 text-sky-600',
  STREAK_7: 'bg-orange-100 text-orange-600',
  STREAK_30: 'bg-orange-100 text-orange-600',
  PERFECT_SCORE: 'bg-emerald-100 text-emerald-600',
  FAST_LEARNER: 'bg-purple-100 text-purple-600',
  TOP_CONTRIBUTOR: 'bg-amber-100 text-amber-600',
  EARLY_BIRD: 'bg-indigo-100 text-indigo-600',
  ASSIGNMENT_ACE: 'bg-rose-100 text-rose-600',
  RESOURCE_SHARER: 'bg-teal-100 text-teal-600',
};

function BadgeCard({ achievement }) {
  const colorClass = ACHIEVEMENT_ICON_BG[achievement.type] || 'bg-slate-100 text-slate-600';
  return (
    <div className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg bg-white">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Award size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{achievement.title}</p>
        {achievement.description && (
          <p className="text-xs text-slate-500 mt-0.5">{achievement.description}</p>
        )}
        <p className="text-xs font-medium text-[#ff7900] mt-1">+{achievement.xpEarned} XP</p>
      </div>
    </div>
  );
}

function AchievementsSection({ achievements, loading }) {
  if (loading) return <SectionSkeleton />;

  if (!achievements) {
    return (
      <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
        <Award size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No achievements yet</p>
        <p className="text-xs text-slate-400 mt-2">Complete lessons and assignments to earn badges</p>
      </div>
    );
  }

  const { xpTotal, level, xpThisLevel, xpToNextLevel, streakDays, achievements: badges } = achievements;
  const levelProgressPct = Math.min(100, Math.round((xpThisLevel / (xpThisLevel + xpToNextLevel)) * 100));

  return (
    <div className="space-y-4">
      {/* Level / XP / Streak summary */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-[#ff7900]/10 to-transparent border border-[#ff7900]/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Level</p>
            <p className="text-2xl font-bold text-slate-900">{level}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total XP</p>
            <p className="text-2xl font-bold text-slate-900">{xpTotal}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Streak</p>
            <p className="text-2xl font-bold text-slate-900">{streakDays}d</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{xpThisLevel} XP</span>
            <span>{xpToNextLevel} XP to level {level + 1}</span>
          </div>
          <div className="w-full bg-white/70 rounded-full h-2">
            <div className="bg-[#ff7900] h-2 rounded-full transition-all" style={{ width: `${levelProgressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Badges */}
      {(!badges || badges.length === 0) ? (
        <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
          <p className="text-sm text-slate-500">No badges yet</p>
          <p className="text-xs text-slate-400 mt-1">Complete lessons and assignments to earn badges</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {badges.map((a) => (
            <BadgeCard key={a.id} achievement={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-[#ff7900]" />}
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
      </div>
      {action}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function StudentLearningTab({ onNavigate }) {
  const { user } = usePermissions();
  
  // State
  const [assignments, setAssignments] = useState([]);
  const [todaysLessons, setTodaysLessons] = useState([]);
  const [continueLearning, setContinueLearning] = useState([]);
  const [resources, setResources] = useState([]);
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch assignments for the student
      const assignRes = await lmsAPI.getStudentAssignments?.();
      const assignmentsData = assignRes?.data || [];
      
      // Sort by due date
      const sortedAssignments = (assignmentsData || []).sort((a, b) => {
        const aDate = new Date(a.dueDate || '');
        const bDate = new Date(b.dueDate || '');
        return aDate - bDate;
      });
      setAssignments(sortedAssignments);

      // Fetch lessons (we'll simulate today's lessons and in-progress)
      // For now, fetch all and filter
      const lessonRes = await lmsAPI.getLessons?.({ limit: 20 });
      const lessonsData = lessonRes?.data || [];
      
      // Split into today's (from schedule) and in-progress
      const inProgress = lessonsData.filter((l) => l.progress && l.progress > 0 && l.progress < 100);
      setTodaysLessons(lessonsData.slice(0, 3)); // Placeholder: first 3 lessons
      setContinueLearning(inProgress);

      // Fetch recent resources
      const resourceRes = await lmsAPI.getResources?.({ limit: 10 });
      const resourcesData = resourceRes?.data || [];
      setResources(resourcesData);

      // Fetch achievements (XP, level, streak, badges) — best-effort, non-fatal
      try {
        const achievementsRes = await lmsAPI.getAchievements?.();
        setAchievements(achievementsRes?.data || null);
      } catch (achErr) {
        console.warn('Achievements unavailable:', achErr);
        setAchievements(null);
      }
    } catch (err) {
      console.error('Error loading learning data:', err);
      setError('Failed to load your learning data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSelectAssignment = (assignment) => {
    // Navigate to assignment detail or submission interface
    if (onNavigate) {
      onNavigate('learning-assignment-detail', { assignmentId: assignment.id });
    }
  };

  const handleSelectLesson = (lesson) => {
    // Navigate to lesson viewer
    if (onNavigate) {
      onNavigate('learning-lesson-viewer', { lessonId: lesson.id });
    }
  };

  const handleDownloadResource = async (resource) => {
    try {
      // Call download API
      const res = await lmsAPI.downloadResource?.(resource.id);
      if (res?.data?.downloadUrl) {
        // Open download link
        window.open(res.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleNavigateRevision = () => {
    if (onNavigate) {
      onNavigate('learning-revision');
    }
  };

  if (error) {
    return (
      <div className="p-8 border border-rose-200 rounded-lg bg-rose-50">
        <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
        <p className="text-sm text-rose-700">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded hover:bg-rose-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">My Learning</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* My Assignments */}
      <section>
        <SectionHeader
          title="My Assignments"
          icon={ClipboardList}
          action={
            assignments.length > 5 && (
              <button className="text-xs font-medium text-[#ff7900] hover:text-[#ff7900]/80">
                View All
              </button>
            )
          }
        />
        <MyAssignmentsSection
          assignments={assignments}
          loading={loading}
          onSelectAssignment={handleSelectAssignment}
        />
      </section>

      {/* Today's Lessons */}
      <section>
        <SectionHeader title="Today's Lessons" icon={Calendar} />
        <TodaysLessonsSection
          lessons={todaysLessons}
          loading={loading}
          onSelectLesson={handleSelectLesson}
        />
      </section>

      {/* Continue Learning */}
      <section>
        <SectionHeader
          title="Continue Learning"
          icon={Play}
          action={
            continueLearning.length > 0 && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#ff7900]/10 text-[#ff7900]">
                {continueLearning.length} in progress
              </span>
            )
          }
        />
        <ContinueLearningSection
          lessons={continueLearning}
          loading={loading}
          onSelectLesson={handleSelectLesson}
        />
      </section>

      {/* Downloads */}
      <section>
        <SectionHeader title="Downloads" icon={Download} />
        <DownloadsSection
          resources={resources}
          loading={loading}
          onDownloadResource={handleDownloadResource}
        />
      </section>

      {/* Revision Library Shortcut */}
      <section>
        <button
          onClick={handleNavigateRevision}
          className="w-full p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-[#ff7900]/40 hover:bg-[#ff7900]/5 transition bg-white"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h4 className="font-semibold text-slate-900">Revision Library</h4>
              <p className="text-sm text-slate-500 mt-1">Browse past papers and study materials</p>
            </div>
            <ChevronRight size={20} className="text-slate-400" />
          </div>
        </button>
      </section>

      {/* Achievements */}
      <section>
        <SectionHeader
          title="Achievements"
          icon={Award}
          action={
            <button
              onClick={() => onNavigate && onNavigate('learning-leaderboard')}
              className="text-xs font-medium text-[#ff7900] hover:text-[#ff7900]/80"
            >
              View Leaderboard
            </button>
          }
        />
        <AchievementsSection achievements={achievements} loading={loading} />
      </section>
    </div>
  );
}
