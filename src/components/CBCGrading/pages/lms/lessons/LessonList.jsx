/**
 * LessonList — LMS Lesson Manager
 *
 * Filterable list of lessons (class, subject/learning area, term, status).
 * Status badges: DRAFT (gray), PUBLISHED (green), ARCHIVED (orange).
 * Actions per lesson: Edit, Publish, Preview, Archive.
 * "Create Lesson" button routes to learning-lesson-builder.
 * Gated on LESSON_CREATE / LEARNING_MANAGE permissions.
 *
 * Requirements: 6.9
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SendHorizonal,
  XCircle,
} from 'lucide-react';

import EmptyState from '../../../shared/EmptyState';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { useNotifications } from '../../../hooks/useNotifications';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { configAPI } from '../../../../../services/api';
import { cn } from '../../../../../utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const LESSON_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const PAGE_SIZE = 15;

const TERM_OPTIONS = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Term 3' },
];

// ─── Status badge colours ─────────────────────────────────────────────────────

function statusColors(status) {
  switch (status) {
    case 'PUBLISHED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'DRAFT':     return 'bg-gray-100    text-gray-600   dark:bg-gray-700      dark:text-gray-300';
    case 'ARCHIVED':  return 'bg-orange-100  text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default:          return 'bg-gray-100    text-gray-600';
  }
}

function StatusPill({ status, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusColors(status), className)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" style={{ width: `${35 + i * 9}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Confirm-action modal (lightweight) ──────────────────────────────────────

function ConfirmModal({ open, title, message, confirmLabel, variant = 'primary', onConfirm, onCancel, loading }) {
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
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-60',
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-purple hover:bg-brand-purple/90',
            )}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function LessonList({ onNavigate }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { showSuccess, showError } = useNotifications();

  const canCreate  = can('LESSON_CREATE') || can('LEARNING_MANAGE');
  const canPublish = can('LESSON_PUBLISH') || can('LEARNING_MANAGE');
  const canArchive = can('LEARNING_MANAGE');

  // ── State ──────────────────────────────────────────────────────────────────
  const [lessons, setLessons]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

  // Filters
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterClass, setFilterClass]     = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTerm, setFilterTerm]       = useState('all');
  const [showFilters, setShowFilters]     = useState(false);

  // Filter options
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Confirm modal state
  const [confirm, setConfirm] = useState({ open: false, type: '', lesson: null });

  const searchTimer = useRef(null);

  // ── Load filter options once ───────────────────────────────────────────────
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [classRes, subjectRes] = await Promise.all([
          configAPI.getClasses().catch(() => null),
          configAPI.getLearningAreas().catch(() => null),
        ]);
        setClasses(classRes?.data ?? classRes ?? []);
        setSubjects(subjectRes?.data ?? subjectRes ?? []);
      } catch (_) { /* non-fatal */ }
    };
    loadOptions();
  }, []);

  // ── Fetch lessons ──────────────────────────────────────────────────────────
  const fetchLessons = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(search              && { search }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(filterClass  !== 'all' && { classId: filterClass }),
        ...(filterSubject !== 'all' && { learningAreaId: filterSubject }),
        ...(filterTerm   !== 'all' && { term: filterTerm }),
      };
      const res  = await lmsAPI.getLessons(params);
      const data = res?.data ?? res ?? {};
      // The LMS endpoint returns { lessons, pagination }.  Keep support for
      // legacy list responses, but prefer the current contract so persisted
      // lessons are not rendered as an empty list.
      setLessons(
        Array.isArray(data.lessons) ? data.lessons
          : Array.isArray(data.data) ? data.data
            : Array.isArray(data) ? data
              : [],
      );
      if (data.meta ?? data.pagination) {
        const m = data.meta ?? data.pagination;
        setPagination({ page: m.page ?? page, total: m.total ?? 0, pages: m.pages ?? m.totalPages ?? 1 });
      } else {
        setPagination(p => ({ ...p, page }));
      }
    } catch (err) {
      const msg = err?.message ?? 'Failed to load lessons.';
      setError(msg);
      showError(msg);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterClass, filterSubject, filterTerm, showError]);

  // Re-fetch when filters change (debounce search)
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchLessons(1), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [fetchLessons, search, filterStatus, filterClass, filterSubject, filterTerm]);

  const activeFilterCount =
    (filterStatus  !== 'all' ? 1 : 0) +
    (filterClass   !== 'all' ? 1 : 0) +
    (filterSubject !== 'all' ? 1 : 0) +
    (filterTerm    !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterClass('all');
    setFilterSubject('all');
    setFilterTerm('all');
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePublish = async (lesson) => {
    setActionLoading(true);
    try {
      await lmsAPI.publishLesson(lesson.id);
      showSuccess(`"${lesson.title}" published successfully.`);
      fetchLessons(pagination.page);
    } catch (err) {
      showError(err?.message ?? 'Failed to publish lesson.');
    } finally {
      setActionLoading(false);
      setConfirm({ open: false, type: '', lesson: null });
    }
  };

  const handleArchive = async (lesson) => {
    setActionLoading(true);
    try {
      await lmsAPI.archiveLesson(lesson.id);
      showSuccess(`"${lesson.title}" archived.`);
      fetchLessons(pagination.page);
    } catch (err) {
      showError(err?.message ?? 'Failed to archive lesson.');
    } finally {
      setActionLoading(false);
      setConfirm({ open: false, type: '', lesson: null });
    }
  };

  const handleConfirmAction = () => {
    if (!confirm.lesson) return;
    if (confirm.type === 'publish') handlePublish(confirm.lesson);
    if (confirm.type === 'archive') handleArchive(confirm.lesson);
  };

  const openConfirm = (type, lesson) => setConfirm({ open: true, type, lesson });

  const confirmProps = (() => {
    const l = confirm.lesson;
    if (confirm.type === 'publish') return {
      title: 'Publish Lesson',
      message: `Publish "${l?.title ?? ''}"? Students in the target class will be able to view this lesson.`,
      confirmLabel: 'Publish',
      variant: 'primary',
    };
    return {
      title: 'Archive Lesson',
      message: `Archive "${l?.title ?? ''}"? The lesson will be hidden from students but not deleted.`,
      confirmLabel: 'Archive',
      variant: 'danger',
    };
  })();

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = (lesson) => (
    <tr key={lesson.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      {/* Title + description snippet */}
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[240px]">{lesson.title}</p>
        {lesson.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[240px] mt-0.5">{lesson.description}</p>
        )}
      </td>
      {/* Subject / learning area */}
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {lesson.learningArea?.name ?? '—'}
      </td>
      {/* Class */}
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {lesson.class?.name ?? '—'}
      </td>
      {/* Term */}
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {lesson.term ? `Term ${lesson.term}` : '—'}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <StatusPill status={lesson.status} />
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {/* Edit (navigates to lesson builder with lessonId) */}
          {canCreate && (
            <button
              type="button"
              onClick={() => onNavigate?.('learning-lesson-builder', { lessonId: lesson.id })}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition"
              title="Edit lesson"
            >
              <Pencil size={15} />
            </button>
          )}
          {/* Preview */}
          <button
            type="button"
            onClick={() => onNavigate?.('learning-lesson-viewer', { lessonId: lesson.id, preview: true })}
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
            title="Preview lesson"
          >
            <Eye size={15} />
          </button>
          {/* Publish (DRAFT only) */}
          {canPublish && lesson.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => openConfirm('publish', lesson)}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition"
              title="Publish lesson"
            >
              <SendHorizonal size={15} />
            </button>
          )}
          {/* Archive (PUBLISHED only) */}
          {canArchive && lesson.status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => openConfirm('archive', lesson)}
              className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition"
              title="Archive lesson"
            >
              <Archive size={15} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-950 dark:text-gray-50">Lessons</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Create, publish and manage lessons for your classes.
              </p>
            </div>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => onNavigate?.('learning-lesson-builder')}
              className="inline-flex items-center gap-2 h-10 px-5 bg-brand-purple text-white text-sm font-semibold rounded-lg hover:bg-brand-purple/90 transition w-full sm:w-auto justify-center"
            >
              <Plus size={16} />
              Create Lesson
            </button>
          )}
        </div>

        {/* ── Search + filter toolbar ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-9 pr-4 h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'h-10 px-3.5 inline-flex items-center gap-2 rounded-lg border text-sm font-medium transition',
                activeFilterCount > 0
                  ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-purple',
              )}
            >
              <Filter size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => fetchLessons(pagination.page)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Statuses</option>
                {LESSON_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            {/* Class */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Class</label>
              <select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Classes</option>
                {(Array.isArray(classes) ? classes : []).map(c => (
                  <option key={c.id ?? c} value={c.id ?? c}>{c.name ?? c.label ?? c}</option>
                ))}
              </select>
            </div>
            {/* Subject / Learning Area */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Learning Area</label>
              <select
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Subjects</option>
                {(Array.isArray(subjects) ? subjects : []).map(s => (
                  <option key={s.id ?? s} value={s.id ?? s}>{s.name ?? s.label ?? s}</option>
                ))}
              </select>
            </div>
            {/* Term */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Term</label>
              <select
                value={filterTerm}
                onChange={e => setFilterTerm(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Terms</option>
                {TERM_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {/* Clear */}
            {activeFilterCount > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple hover:underline"
                >
                  <XCircle size={13} /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Error state ── */}
        {error && !loading && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-4 flex items-center gap-3">
            <XCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => fetchLessons(1)}
              className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Lessons table ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Learning Area</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Term</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : lessons.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <EmptyState
                          icon={BookOpen}
                          title="No Lessons Found"
                          message={
                            search || activeFilterCount > 0
                              ? 'No lessons match your current filters.'
                              : 'Create your first lesson to get started.'
                          }
                          actionText={!search && activeFilterCount === 0 && canCreate ? 'Create Lesson' : null}
                          onAction={() => onNavigate?.('learning-lesson-builder')}
                          className="shadow-none border-0 py-0"
                        />
                      </td>
                    </tr>
                  )
                  : lessons.map(renderRow)
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        {!loading && lessons.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page <span className="font-semibold text-gray-800 dark:text-gray-200">{pagination.page}</span> of{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{pagination.pages}</span>
              {pagination.total ? ` · ${pagination.total} total` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchLessons(pagination.page - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchLessons(pagination.page + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Confirm modal ── */}
      <ConfirmModal
        open={confirm.open}
        title={confirmProps.title}
        message={confirmProps.message}
        confirmLabel={confirmProps.confirmLabel}
        variant={confirmProps.variant}
        loading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirm({ open: false, type: '', lesson: null })}
      />
    </div>
  );
}
