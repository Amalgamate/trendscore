/**
 * StudentAssignmentView — Student-facing assignment submission view
 *
 * Features:
 * - Assignment header: title, category, subject, class, due date, total marks, status
 * - Instructions: render assignment instructions text
 * - Attached resources: list of assignment files (download links)
 * - Rubric: read-only table of criterion + marks (if assignment has rubric)
 * - Submission form: rich text answer + file uploads + Save Draft + Submit buttons
 * - Show marked submission with marks received + teacher feedback
 * - Resubmit button if allowed
 *
 * Requirements: 4.1, 4.8, 5.3
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Save,
  Send,
  Target,
  Trash2,
  Upload,
  X,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getDueDateCountdown(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Overdue', color: 'text-red-600 dark:text-red-400', isOverdue: true };
  if (diffDays === 0) return { label: 'Due Today', color: 'text-amber-600 dark:text-amber-400', isOverdue: false };
  if (diffDays === 1) return { label: 'Due Tomorrow', color: 'text-amber-600 dark:text-amber-400', isOverdue: false };
  return { label: `${diffDays} days left`, color: 'text-gray-600 dark:text-gray-400', isOverdue: false };
}

function statusColors(status) {
  switch (status) {
    case 'PUBLISHED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'DRAFT':     return 'bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-300';
    case 'CLOSED':    return 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-300';
    case 'SUBMITTED': return 'bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300';
    case 'MARKED':    return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300';
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

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SkeletonView() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentAssignmentView({ assignmentId, onNavigate, user, pageParams }) {
  const assignmentIdToUse = assignmentId ?? pageParams?.assignmentId ?? pageParams?.id;
  const { user: authUser } = useAuth();
  const userToUse = user ?? authUser;
  const { showSuccess, showError } = useNotifications();

  const fileInputRef = useRef(null);

  // State
  const [assignment, setAssignment] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Form state
  const [answer, setAnswer] = useState('');
  const [questionResponses, setQuestionResponses] = useState({});
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [errors, setErrors] = useState({});

  // ── Fetch assignment + my submission ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!assignmentIdToUse) {
      showError('No assignment ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [assignmentRes, submissionsRes] = await Promise.all([
        lmsAPI.getAssignment(assignmentIdToUse),
        lmsAPI.getMySubmissions({ assignmentId: assignmentIdToUse }).catch(() => null),
      ]);

      const assignmentData = assignmentRes?.data ?? assignmentRes;
      setAssignment(assignmentData);

      const submissionsData = submissionsRes?.data?.data ?? submissionsRes?.data ?? submissionsRes ?? [];
      const submissionsArray = Array.isArray(submissionsData) ? submissionsData : [];

      // Get the latest submission (highest attemptNumber)
      const latestSubmission = submissionsArray.sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))[0] ?? null;
      setMySubmission(latestSubmission);

      // Pre-fill form if draft exists
      if (latestSubmission && latestSubmission.status === 'DRAFT') {
        setAnswer(latestSubmission.content ?? '');
        setQuestionResponses(latestSubmission.questionResponses || {});
        // Note: existing file attachments from draft are read-only (we don't pre-populate attachedFiles)
      }
    } catch (err) {
      showError(err?.message ?? 'Failed to load assignment.');
      setAssignment(null);
      setMySubmission(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentIdToUse, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file count (up to 10 total)
    if (attachedFiles.length + files.length > 10) {
      showError('You can upload a maximum of 10 files.');
      return;
    }

    // Validate file sizes
    const maxSize = (assignment?.maxFileSize ?? 25) * 1024 * 1024; // MB to bytes
    const oversized = files.filter(f => f.size > maxSize);
    if (oversized.length > 0) {
      showError(`Some files exceed the ${assignment?.maxFileSize ?? 25}MB limit and were not added.`);
      const valid = files.filter(f => f.size <= maxSize);
      setAttachedFiles((prev) => [...prev, ...valid]);
      return;
    }

    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    const questions = Array.isArray(assignment?.questions) ? assignment.questions : [];
    if (questions.length === 0 && (!answer || answer.trim().length === 0)) {
      newErrors.answer = 'Answer is required';
    }
    const unanswered = questions.filter((question) => {
      const response = questionResponses[String(question.id)];
      return response === undefined || response === null || String(response).trim() === '';
    });
    if (unanswered.length > 0) newErrors.questions = `Answer all ${questions.length} questions before submitting.`;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const formData = new FormData();
      formData.append('content', answer);
      formData.append('questionResponses', JSON.stringify(questionResponses));
      formData.append('status', 'DRAFT');
      attachedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await lmsAPI.submitAssignment(assignmentIdToUse, formData);
      showSuccess('Draft saved successfully.');
      fetchData(); // Reload to get the created draft submission
    } catch (err) {
      showError(err?.response?.data?.message ?? err?.message ?? 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Submit assignment ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm()) {
      showError('Please answer every required question before submitting.');
      return;
    }

    // Check if overdue and late submission not allowed
    const countdown = getDueDateCountdown(assignment?.dueDate);
    if (countdown?.isOverdue && assignment?.allowLateSubmit === false) {
      showError('This assignment is overdue and late submissions are not allowed.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', answer);
      formData.append('questionResponses', JSON.stringify(questionResponses));
      formData.append('status', 'SUBMITTED');
      attachedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await lmsAPI.submitAssignment(assignmentIdToUse, formData);
      showSuccess('Assignment submitted successfully!');
      fetchData(); // Reload to get the submitted status
      setAnswer('');
      setQuestionResponses({});
      setAttachedFiles([]);
    } catch (err) {
      showError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resubmit ──────────────────────────────────────────────────────────────
  const handleResubmit = () => {
    // Clear form and allow new submission
    setMySubmission(null);
    setAnswer('');
    setQuestionResponses({});
    setAttachedFiles([]);
    showSuccess('You can now submit a new attempt.');
  };

  // ── Render loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SkeletonView />
        </div>
      </div>
    );
  }

  // ── Render error state ────────────────────────────────────────────────────
  if (!assignment) {
    return (
      <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => onNavigate?.('learning-assignments')}
            className="inline-flex items-center gap-2 mb-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-brand-purple dark:hover:text-brand-purple transition"
          >
            <ArrowLeft size={16} />
            Back to Assignments
          </button>
          <EmptyState
            icon={BookOpen}
            title="Assignment Not Found"
            message="The requested assignment could not be loaded."
            actionText="Back to Assignments"
            onAction={() => onNavigate?.('learning-assignments')}
          />
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  const countdown = getDueDateCountdown(assignment.dueDate);
  const canSubmit = assignment.status === 'PUBLISHED' && (!mySubmission || mySubmission.status === 'DRAFT');
  const isMarked = mySubmission && mySubmission.status === 'MARKED';
  const isReturned = mySubmission && mySubmission.status === 'RETURNED';
  const canResubmit = isReturned || (isMarked && assignment.allowResubmit === true);

  return (
    <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* ── Back button ── */}
        <button
          type="button"
          onClick={() => onNavigate?.('learning-assignments')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-brand-purple dark:hover:text-brand-purple transition"
        >
          <ArrowLeft size={16} />
          Back to Assignments
        </button>

        {/* ── Header Card ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col gap-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-gray-950 dark:text-gray-50">{assignment.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen size={14} />
                    {assignment.learningArea?.name ?? '—'}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span>{assignment.class?.name ?? '—'}</span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[assignment.category] ?? assignment.category}
                  </span>
                </div>
              </div>
              <StatusPill status={assignment.status} className="flex-shrink-0" />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
              {assignment.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Due: {formatDate(assignment.dueDate)}
                  </span>
                  {countdown && (
                    <span className={cn('font-semibold', countdown.color)}>
                      ({countdown.label})
                    </span>
                  )}
                </div>
              )}
              {assignment.totalMarks && (
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {assignment.totalMarks} marks
                  </span>
                </div>
              )}
              {assignment.estimatedMins && (
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    ~{assignment.estimatedMins} min
                  </span>
                </div>
              )}
              {mySubmission && (
                <div className="ml-auto">
                  <StatusPill status={mySubmission.status} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Instructions ── */}
        {assignment.instructions && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Instructions
            </h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: assignment.instructions }}
            />
          </div>
        )}

        {/* ── Attached Resources ── */}
        {assignment.files && Array.isArray(assignment.files) && assignment.files.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Paperclip size={14} />
              Attached Resources ({assignment.files.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignment.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText size={18} className="flex-shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name ?? file.filename ?? 'Untitled'}
                      </p>
                      {file.fileSize && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.fileSize)}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={file.url ?? file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition flex-shrink-0"
                  >
                    <Download size={14} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rubric (Read-only) ── */}
        {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target size={14} />
              Marking Rubric
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
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
                  {assignment.rubric.map((item, idx) => {
                    const criterionName = item.criterion ?? item.name ?? item.title ?? `Criterion ${idx + 1}`;
                    const marks = item.marks ?? item.maxMarks ?? 0;
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {criterionName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right font-semibold">
                          {marks}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Your Marked Submission (if exists and marked) ── */}
        {(isMarked || isReturned) && (
          <div className={cn(
            'rounded-xl border p-6',
            isReturned
              ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
              : 'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
          )}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <CheckCircle size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-1">
                  {isReturned ? 'Corrections Requested' : 'Your Submission — Marked'}
                </h2>
                <div className="flex items-center gap-4 mb-4 text-sm text-emerald-700 dark:text-emerald-300">
                  {isMarked && (
                    <span className="font-semibold">
                      Marks: {mySubmission.marks} / {assignment.totalMarks}
                    </span>
                  )}
                  {mySubmission.markedAt && (
                    <span>Marked on {formatDate(mySubmission.markedAt)}</span>
                  )}
                </div>
                {mySubmission.feedback && (
                  <div className="rounded-lg border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-emerald-900/40 p-4">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                      Teacher Feedback
                    </p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-emerald-900 dark:text-emerald-100"
                      dangerouslySetInnerHTML={{ __html: mySubmission.feedback }}
                    />
                  </div>
                )}
                {isMarked && Array.isArray(mySubmission.rubricScores) && mySubmission.rubricScores.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-emerald-900/40">
                    <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Rubric Results
                    </div>
                    <div className="divide-y divide-emerald-100 dark:divide-emerald-800">
                      {mySubmission.rubricScores.map((score, index) => (
                        <div key={`${score.criterion}-${index}`} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                          <span className="text-emerald-900 dark:text-emerald-100">{score.criterion}</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {score.marks} / {score.maxMarks}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {canResubmit && (
                  <button
                    type="button"
                    onClick={handleResubmit}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
                  >
                    <Upload size={16} />
                    {isReturned ? 'Correct and Resubmit' : 'Resubmit Assignment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Submission Form (show if no marked submission, or resubmit allowed) ── */}
        {(canSubmit || canResubmit) && !isMarked && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Your Submission
            </h2>

            {Array.isArray(assignment.questions) && assignment.questions.length > 0 && (
              <div className="mb-6 space-y-4">
                {assignment.questions.map((question, index) => {
                  const questionId = String(question.id);
                  const response = questionResponses[questionId] ?? '';
                  return (
                    <div key={questionId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <label className="font-semibold text-gray-950 dark:text-white">
                          {index + 1}. {question.prompt}
                        </label>
                        <span className="whitespace-nowrap text-xs font-bold text-brand-purple">{question.marks || 0} marks</span>
                      </div>
                      {question.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-2">
                          {(question.options || []).map((option, optionIndex) => (
                            <label key={optionIndex} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
                              <input type="radio" name={`response-${questionId}`} checked={Number(response) === optionIndex && response !== ''} onChange={() => setQuestionResponses((current) => ({ ...current, [questionId]: optionIndex }))} />
                              <span className="text-sm text-gray-800 dark:text-gray-200">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {question.type === 'TRUE_FALSE' && (
                        <div className="flex gap-3">
                          {['true', 'false'].map((value) => (
                            <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 capitalize dark:border-gray-600">
                              <input type="radio" name={`response-${questionId}`} checked={response === value} onChange={() => setQuestionResponses((current) => ({ ...current, [questionId]: value }))} />{value}
                            </label>
                          ))}
                        </div>
                      )}
                      {(question.type === 'SHORT_ANSWER' || question.type === 'ESSAY') && (
                        <textarea rows={question.type === 'ESSAY' ? 6 : 2} value={response} onChange={(event) => setQuestionResponses((current) => ({ ...current, [questionId]: event.target.value }))} placeholder="Type your answer…" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      )}
                    </div>
                  );
                })}
                {errors.questions && <p className="text-sm text-red-500">{errors.questions}</p>}
              </div>
            )}

            {/* Rich text answer */}
            {(!Array.isArray(assignment.questions) || assignment.questions.length === 0) && (
            <div className="mb-6">
              <label htmlFor="answer" className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                Answer <span className="text-red-500">*</span>
              </label>
              <textarea
                id="answer"
                rows={10}
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setErrors((prev) => ({ ...prev, answer: null }));
                }}
                placeholder="Type your answer here..."
                className={cn(
                  'w-full rounded-lg border px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple resize-y transition',
                  errors.answer
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                )}
              />
              {errors.answer && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.answer}
                </p>
              )}
            </div>
            )}

            {/* File upload zone */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-3">
                Attach Files (Optional)
              </label>

              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700',
                  'hover:border-brand-purple/50 hover:bg-brand-purple/5'
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dt = e.dataTransfer;
                  const files = Array.from(dt.files);
                  if (attachedFiles.length + files.length > 10) {
                    showError('You can upload a maximum of 10 files.');
                    return;
                  }
                  const maxSize = (assignment?.maxFileSize ?? 25) * 1024 * 1024;
                  const valid = files.filter((f) => f.size <= maxSize);
                  if (valid.length < files.length) {
                    showError(`Some files exceed the ${assignment?.maxFileSize ?? 25}MB limit.`);
                  }
                  setAttachedFiles((prev) => [...prev, ...valid]);
                }}
              >
                <Upload className="mx-auto text-gray-400 mb-3" size={28} />
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Drop files here or <span className="text-brand-purple">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Max {assignment?.maxFileSize ?? 25}MB per file · Up to 10 files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Attach submission files"
                />
              </div>

              {/* File list with remove buttons */}
              {attachedFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {attachedFiles.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText size={16} className="flex-shrink-0 text-gray-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="flex-shrink-0 p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Submission buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingDraft ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Draft...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save as Draft
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || savingDraft}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-purple hover:bg-brand-purple/90 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Already submitted (SUBMITTED status, not yet marked) ── */}
        {mySubmission && mySubmission.status === 'SUBMITTED' && !isMarked && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <CheckCircle size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">
                  Submission Received
                </h2>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  You submitted this assignment on {formatDate(mySubmission.submittedAt)}.
                  {mySubmission.isLate && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                      Late Submission
                    </span>
                  )}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Your teacher will mark this assignment soon. You will be notified when marks are available.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Assignment closed, no submission ── */}
        {assignment.status === 'CLOSED' && !mySubmission && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6">
            <EmptyState
              icon={XCircle}
              title="Assignment Closed"
              message="This assignment is now closed and no longer accepting submissions."
              className="shadow-none border-0 py-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
