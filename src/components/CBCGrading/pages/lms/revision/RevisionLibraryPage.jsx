/**
 * RevisionLibraryPage — LMS Revision Library
 *
 * Displays a searchable, filterable, paginated grid of learning resources.
 * Teachers / admins with LEARNING_MANAGE can upload new resources.
 *
 * Requirements: 8.4, 8.5
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

import EmptyState from '../../../shared/EmptyState';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { useNotifications } from '../../../hooks/useNotifications';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { configAPI } from '../../../../../services/api';
import { cn } from '../../../../../utils/cn';

// These sub-components may not exist yet — imported for when they are created.
import ResourceCard from './ResourceCard';
import ResourceUploadModal from './ResourceUploadModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

const RESOURCE_TYPES = [
  'NOTES',
  'PAST_PAPER',
  'WORKSHEET',
  'VIDEO',
  'AUDIO',
  'PRESENTATION',
  'EBOOK',
  'FLASHCARD_SET',
  'PRACTICE_QUESTIONS',
  'OTHER',
];

const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const LANGUAGES = ['English', 'Kiswahili', 'French', 'Arabic'];

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="h-36 animate-pulse bg-gray-200 dark:bg-gray-700" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function RevisionLibraryPage({ onNavigate }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { showError, showSuccess } = useNotifications();

  const canUpload = can('LEARNING_MANAGE');

  // ── State ──────────────────────────────────────────────────────────────────
  const [resources, setResources]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [pagination, setPagination]   = useState({ page: 1, total: 0, pages: 1 });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch]               = useState('');
  const [filterClass, setFilterClass]     = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTopic, setFilterTopic]     = useState('');
  const [filterType, setFilterType]       = useState('all');
  const [filterTerm, setFilterTerm]       = useState('all');
  const [filterYear, setFilterYear]       = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');

  // Filter option data loaded from API
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);

  const searchTimer = useRef(null);

  // Derive year options: current year ± 5
  const yearOptions = (() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => current - i);
  })();

  // ── Load filter option data ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [classRes, subjectRes] = await Promise.all([
          configAPI.getClasses().catch(() => null),
          configAPI.getLearningAreas().catch(() => null),
        ]);
        setClasses(classRes?.data ?? classRes ?? []);
        setSubjects(subjectRes?.data ?? subjectRes ?? []);
      } catch (_) { /* non-fatal */ }
    };
    load();
  }, []);

  // ── Active filter count ────────────────────────────────────────────────────
  const activeFilterCount = [
    filterClass !== 'all',
    filterSubject !== 'all',
    filterTopic.trim() !== '',
    filterType !== 'all',
    filterTerm !== 'all',
    filterYear !== 'all',
    filterDifficulty !== 'all',
    filterLanguage !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterClass('all');
    setFilterSubject('all');
    setFilterTopic('');
    setFilterType('all');
    setFilterTerm('all');
    setFilterYear('all');
    setFilterDifficulty('all');
    setFilterLanguage('all');
  };

  // ── Fetch resources ────────────────────────────────────────────────────────
  const fetchResources = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(search.trim()            && { search: search.trim() }),
        ...(filterClass !== 'all'    && { classId: filterClass }),
        ...(filterSubject !== 'all'  && { learningAreaId: filterSubject }),
        ...(filterTopic.trim()       && { topic: filterTopic.trim() }),
        ...(filterType !== 'all'     && { resourceType: filterType }),
        ...(filterTerm !== 'all'     && { term: filterTerm }),
        ...(filterYear !== 'all'     && { year: filterYear }),
        ...(filterDifficulty !== 'all' && { difficulty: filterDifficulty }),
        ...(filterLanguage !== 'all' && { language: filterLanguage }),
      };

      const res = await lmsAPI.getResources(params);
      const data = res?.data ?? res ?? {};

      setResources(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);

      const m = data.meta ?? data.pagination;
      if (m) {
        setPagination({ page: m.page ?? page, total: m.total ?? 0, pages: m.pages ?? m.totalPages ?? 1 });
      } else {
        setPagination(p => ({ ...p, page }));
      }
    } catch (err) {
      showError(err?.message ?? 'Failed to load revision resources.');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterClass, filterSubject, filterTopic, filterType, filterTerm, filterYear, filterDifficulty, filterLanguage, showError]);

  // Re-fetch when filters change (debounce text inputs)
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const hasText = search || filterTopic;
    searchTimer.current = setTimeout(() => fetchResources(1), hasText ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [fetchResources, search, filterTopic, filterClass, filterSubject, filterType, filterTerm, filterYear, filterDifficulty, filterLanguage]);

  // ── Upload success handler ─────────────────────────────────────────────────
  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    showSuccess('Resource uploaded successfully.');
    fetchResources(1);
  };

  // ── Bookmark toggle handler ────────────────────────────────────────────────
  const handleBookmarkToggle = async (resourceId, currentState) => {
    try {
      await lmsAPI.toggleBookmark(resourceId);
      setResources(prev =>
        prev.map(r => r.id === resourceId ? { ...r, bookmarked: !currentState } : r),
      );
    } catch (err) {
      showError(err?.message ?? 'Failed to update bookmark.');
    }
  };

  // ── Download handler ───────────────────────────────────────────────────────
  const handleDownload = async (resourceId) => {
    try {
      const res = await lmsAPI.downloadResource(resourceId);
      const url = res?.data?.url ?? res?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        showError('Download URL not available.');
      }
      // Optimistically update download count in local state
      setResources(prev =>
        prev.map(r => r.id === resourceId ? { ...r, downloadCount: (r.downloadCount ?? 0) + 1 } : r),
      );
    } catch (err) {
      showError(err?.message ?? 'Failed to download resource.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[var(--app-page-bg,#f8fafc)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <BookMarked size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-950 dark:text-gray-50">Revision Library</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Browse notes, past papers, worksheets and more for every subject.
              </p>
            </div>
          </div>

          {canUpload && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 h-10 px-5 bg-brand-purple text-white text-sm font-semibold rounded-lg hover:bg-brand-purple/90 transition w-full sm:w-auto justify-center"
            >
              <Plus size={16} />
              Upload Resource
            </button>
          )}
        </div>

        {/* ── Search + filter toolbar ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, topic or tags…"
              className="w-full pl-9 pr-4 h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none transition"
            />
          </div>

          {/* Filter toggle + refresh */}
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
              onClick={() => fetchResources(pagination.page)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Expanded filter panel ── */}
        {showFilters && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

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
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Subject / Learning Area</label>
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

            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Topic</label>
              <input
                type="text"
                value={filterTopic}
                onChange={e => setFilterTopic(e.target.value)}
                placeholder="e.g. Photosynthesis"
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              />
            </div>

            {/* Resource type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Resource Type</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Types</option>
                {RESOURCE_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
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
                {TERMS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Year</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Years</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Difficulty</label>
              <select
                value={filterDifficulty}
                onChange={e => setFilterDifficulty(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Difficulties</option>
                {DIFFICULTY_LEVELS.map(d => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Language</label>
              <select
                value={filterLanguage}
                onChange={e => setFilterLanguage(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 px-3 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple outline-none"
              >
                <option value="all">All Languages</option>
                {LANGUAGES.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
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

        {/* ── Resource grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No Resources Found"
            message={
              search || activeFilterCount > 0
                ? 'No resources match your current filters. Try adjusting them.'
                : 'No revision resources have been uploaded yet.'
            }
            actionText={canUpload && !search && activeFilterCount === 0 ? 'Upload Resource' : null}
            onAction={() => setShowUploadModal(true)}
            className="shadow-none border-0"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {resources.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDownload={handleDownload}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && resources.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{pagination.page}</span>
              {' '}of{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{pagination.pages}</span>
              {pagination.total ? ` · ${pagination.total} total` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchResources(pagination.page - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchResources(pagination.page + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Upload modal (teacher/admin only) ── */}
      {canUpload && showUploadModal && (
        <ResourceUploadModal
          isOpen={showUploadModal}
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
