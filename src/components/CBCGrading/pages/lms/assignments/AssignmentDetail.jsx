/**
 * AssignmentDetail — Teacher-facing assignment detail view
 *
 * Displays:
 * 1. Header card: title, category badge, subject, class, due date, total marks,
 *    status badge, "Close Assignment" button (if PUBLISHED), "Back" link
 * 2. Stats row: 3 cards showing Total Students / Submitted / Marked counts + progress bar
 * 3. Rubric display: if assignment has rubric, show table of criterion + marks
 * 4. Attachments: list of downloadable files
 * 5. Submissions table: Student Name | Submitted At | Late badge | Status badge |
 *    Marks (if marked) | "Mark" button
 *
 * Requirements: 5.8
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

import EmptyState from '../../../shared/EmptyState';
import { useAuth } from '../../../../../hooks/useAuth';
import { useNotifications } from '../../../hooks/useNotifications';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { cn } from '../../../../../utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  HOMEWORK: 'Homework',
  PROJECT: 'Project',
  REVISION: 'Revision',
  HOLIDAY_WORK: 'Holiday Work',
  RESEARCH: 'Research',
  READING: 'Reading',
  PRACTICAL: 'Practical',
  GROUP_WORK: 'Group Work',
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function statusColors(status) {
  switch (status) {
    case 'PUBLISHED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'DRAFT':     return 'bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-300';
    case 'CLOSED':    return 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-300';
    case 'SUBMITTED': return 'bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300';
    case 'MARKED':    return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300';
    case 'OVERDUE':   return 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300';
    default:          return 'bg-gray-100   text-gray-600';
  }
}

function StatusPill({ status, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusColors(status), className)}>
      {status}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-KE', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SkeletonHeader() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
      <div className="h-8 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="flex gap-4">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" style={{ width: `${40 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssignmentDetail({ assignmentId, onNavigate, user, pageParams = {} }) {
  const idToFetch = assignmentId ?? pageParams?.id ?? pageParams?.assignmentId;

  const { showSuccess, showError } = useNotifications();

  // State
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // ── Fetch assignment detail ────────────────────────────────────────────────
  const fetchAssignmentDetail = useCallback(async () => {
    if (!idToFetch) {
      showError('No assignment ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [assignmentRes, submissionsRes] = await Promise.all([
        lmsAPI.getAssignment(idToFetch),
        lmsAPI.getSubmissions(idToFetch),
      ]);

      const assignmentData = assignmentRes?.data ?? assignmentRes;
      setAssignment(assignmentData);

      const submissionsData = submissionsRes?.data?.data ?? submissionsRes?.data ?? submissionsRes ?? [];
      setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
    } catch (err) {
      showError(err?.message ?? 'Failed to load assignment details.');
      setAssignment(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [idToFetch, showError]);

  useEffect(() => {
    fetchAssignmentDetail();
  }, [fetchAssignmentDetail]);

  // ── Close assignment ───────────────────────────────────────────────────────
  const handleCloseAssignment = async () => {
    if (!assignment) return;
    setActionLoading(true);
    try {
      await lmsAPI.closeAssignment(assignment.id);
      showSuccess(`"${assignment.title}" closed successfully.`);
      setConfirmClose(false);
      fetchAssignmentDetail();
    } catch (err) {
      showError(err?.message ?? 'Failed to close assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Calculate stats ────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const totalStudents = assignment?.class?.studentCount ?? 0;
    const submittedCount = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'MARKED').length;
    const markedCount = submissions.filter(s => s.status === 'MARKED').length;
    const submissionPercent = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

    return { totalStudents, submittedCount, markedCount, submissionPercent };
  }, [assignment, submissions]);

  // ── Navigate to marking interface ─────────────────────────────────────────
  const handleMarkSubmission = (submission) => {
    onNavigate?.('learning-marking-interface', { 
      assignmentId: assignment.id, 
      submissionId: submission.id,
    });
  };

  // ── Render loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <SkeletonHeader />
          <SkeletonStats />
        </div>
      </div>
    );
  }

  // ── Render error state ─────────────────────────────────────────────────────
  if (!assignment) {
    return (
      <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <EmptyState
            icon={XCircle}
            title="Assignment Not Found"
            message="The requested assignment could not be found or you do not have permission to view it."
            actionText="Back to Assignments"
            onAction={() => onNavigate?.('learning-assignments')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* ── Header card ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <button
              type="button"
              onClick={() => onNavigate?.('learning-assignments')}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-brand-purple dark:hover:text-brand-purple transition"
            >
              <ArrowLeft size={16} />
              Back to Assignments
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('learning-assignment-edit', { assignmentId: assignment.id })}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-4 py-2 text-sm font-semibold text-brand-purple hover:bg-brand-purple/10"
              >
                <Pencil size={16} />
                Edit Assignment & Questions
              </button>
            {assignment.status === 'PUBLISHED' && (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
              >
                <Lock size={16} />
                Close Assignment
              </button>
            )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-950 dark:text-gray-50">{assignment.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <StatusPill status={assignment.status} />
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold">
                  {CATEGORY_LABELS[assignment.category] ?? assignment.category}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={14} />
                  {assignment.learningArea?.name ?? '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {assignment.class?.name ?? '—'}
                </span>
                {assignment.dueDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    Due: {formatDate(assignment.dueDate)}
                  </span>
                )}
                {assignment.totalMarks && (
                  <span className="flex items-center gap-1.5">
                    <Target size={14} />
                    {assignment.totalMarks} marks
                  </span>
                )}
                {assignment.estimatedMins && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    ~{assignment.estimatedMins} min
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Students */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Students</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalStudents}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <Users size={18} />
              </div>
            </div>
          </div>

          {/* Submitted */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.submittedCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <FileText size={18} />
              </div>
            </div>
            {/* Progress bar */}
            {stats.totalStudents > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Submission Progress</span>
                  <span className="font-semibold">{stats.submissionPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${stats.submissionPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Marked */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marked</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.markedCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                <CheckCircle2 size={18} />
              </div>
            </div>
          </div>
        </div>

        {Array.isArray(assignment.questions) && assignment.questions.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Questions ({assignment.questions.length})
            </h2>
            <div className="space-y-3">
              {assignment.questions.map((question, index) => (
                <div key={question.id || index} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{index + 1}. {question.prompt}</p>
                    <span className="whitespace-nowrap text-sm font-bold text-brand-purple">{question.marks || 0} marks</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {String(question.type || '').replaceAll('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rubric display ── */}
        {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-purple" />
              Marking Rubric
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Criterion
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Marks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {assignment.rubric.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item.criterion ?? item.name ?? item.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-semibold">
                        {item.marks ?? item.maxMarks ?? 0}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/40 font-bold">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">Total</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {assignment.totalMarks ?? assignment.rubric.reduce((sum, r) => sum + (r.marks ?? r.maxMarks ?? 0), 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Attachments ── */}
        {assignment.files && Array.isArray(assignment.files) && assignment.files.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Paperclip size={18} className="text-brand-purple" />
              Attachments ({assignment.files.length})
            </h2>
            <div className="space-y-2">
              {assignment.files.map((file, idx) => (
                <a
                  key={idx}
                  href={file.url ?? file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-purple dark:hover:border-brand-purple hover:bg-gray-50 dark:hover:bg-gray-700/40 transition group"
                >
                  <FileText size={18} className="flex-shrink-0 text-gray-400 group-hover:text-brand-purple" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.filename ?? file.fileName ?? file.name ?? 'Untitled'}
                    </p>
                    {file.fileSize && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <Download size={16} className="flex-shrink-0 text-gray-400 group-hover:text-brand-purple" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Submissions table ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Submissions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Marks
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <EmptyState
                        icon={FileText}
                        title="No Submissions Yet"
                        message="Students have not submitted any work for this assignment."
                        className="shadow-none border-0 py-0"
                      />
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      {/* Student Name */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {sub.learner?.firstName ?? ''} {sub.learner?.lastName ?? ''}
                        </p>
                        {sub.learner?.admissionNumber && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sub.learner.admissionNumber}
                          </p>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {formatDateTime(sub.submittedAt)}
                        </p>
                        {sub.isLate && (
                          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300 mt-1">
                            Late
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill status={sub.status} />
                      </td>

                      {/* Marks */}
                      <td className="px-4 py-3">
                        {sub.status === 'MARKED' ? (
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {sub.marks} / {assignment.totalMarks}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleMarkSubmission(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition"
                        >
                          {sub.status === 'MARKED' ? 'Review' : 'Mark'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Confirm close modal ── */}
      <ConfirmModal
        open={confirmClose}
        title="Close Assignment"
        message={`Close "${assignment?.title ?? ''}"? Students will no longer be able to submit.`}
        confirmLabel="Close Assignment"
        onConfirm={handleCloseAssignment}
        onCancel={() => setConfirmClose(false)}
        loading={actionLoading}
      />
    </div>
  );
}
