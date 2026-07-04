/**
 * ResourceCard — Revision Library
 *
 * Displays a single learning resource with thumbnail (or type-icon fallback),
 * metadata badges, download count, a download action, and a bookmark toggle.
 *
 * Props:
 *   resource         {object}   – resource record from the API
 *   onBookmarkToggle {function} – (resourceId, currentBookmarked) => void
 *   onDownload       {function} – (resourceId) => void  (optional; used by parent)
 *   isBookmarked     {boolean}  – override; falls back to resource.bookmarked
 *
 * Requirements: 8.6, 8.7
 */

import React, { useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Download,
  FileAudio,
  FileCode,
  Presentation,
  FileQuestion,
  FileText,
  Film,
  Layers,
  Loader2,
  Zap,
} from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { cn } from '../../../../../utils/cn';

// ─── Resource type → display label + icon + colour ───────────────────────────

const TYPE_META = {
  NOTES:              { label: 'Notes',          Icon: FileText,         colour: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  PAST_PAPER:         { label: 'Past Paper',      Icon: FileQuestion,     colour: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  WORKSHEET:          { label: 'Worksheet',       Icon: Layers,           colour: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  VIDEO:              { label: 'Video',           Icon: Film,             colour: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  AUDIO:              { label: 'Audio',           Icon: FileAudio,        colour: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  PRESENTATION:       { label: 'Presentation',   Icon: Presentation,     colour: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  EBOOK:              { label: 'eBook',           Icon: BookOpen,         colour: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  FLASHCARD_SET:      { label: 'Flashcards',      Icon: Zap,              colour: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  PRACTICE_QUESTIONS: { label: 'Practice Qs',    Icon: FileCode,         colour: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  OTHER:              { label: 'Other',           Icon: FileText,         colour: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

// ─── Difficulty → colour ──────────────────────────────────────────────────────

const DIFFICULTY_COLOUR = {
  BEGINNER:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INTERMEDIATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  ADVANCED:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n) {
  if (!n || n === 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResourceCard({
  resource,
  onBookmarkToggle,
  onDownload,
  isBookmarked: isBookmarkedProp,
}) {
  const {
    id,
    title,
    subject,
    learningArea,
    resourceType,
    difficulty,
    thumbnailUrl,
    downloadCount = 0,
  } = resource ?? {};

  // Derive bookmark state — prefer explicit prop, fall back to resource field
  const bookmarked =
    typeof isBookmarkedProp === 'boolean' ? isBookmarkedProp : (resource?.bookmarked ?? false);

  // Local loading states for async actions
  const [downloading, setDownloading]       = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // ── Type metadata ──────────────────────────────────────────────────────────
  const typeMeta = TYPE_META[resourceType] ?? TYPE_META.OTHER;
  const TypeIcon = typeMeta.Icon;

  // Derive display name for subject / learning area
  const subjectLabel =
    (typeof learningArea === 'object' ? learningArea?.name : null) ??
    (typeof subject === 'object' ? subject?.name : null) ??
    learningArea ??
    subject ??
    null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Download: if a parent handler is provided (e.g. RevisionLibraryPage) delegate
   * to it (it handles optimistic count update and error toasts). Otherwise call
   * the API directly and open the signed URL.
   */
  const handleDownload = async () => {
    if (downloading) return;

    if (typeof onDownload === 'function') {
      onDownload(id);
      return;
    }

    // Standalone mode — call API directly
    setDownloading(true);
    try {
      const res = await lmsAPI.downloadResource(id);
      const url = res?.data?.url ?? res?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      // Silently fail in standalone mode; parent should provide onDownload with toast support
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Bookmark: delegate to parent callback if supplied, otherwise call API directly.
   * Parent is responsible for updating the resource state in the list.
   */
  const handleBookmark = async () => {
    if (bookmarkLoading) return;

    if (typeof onBookmarkToggle === 'function') {
      onBookmarkToggle(id, bookmarked);
      return;
    }

    // Standalone mode
    setBookmarkLoading(true);
    try {
      await lmsAPI.toggleBookmark(id);
    } catch (_) {
      // no-op
    } finally {
      setBookmarkLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border transition-shadow',
        'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
        'hover:shadow-md dark:hover:shadow-gray-900/50',
      )}
      aria-label={title}
    >
      {/* ── Thumbnail / type-icon fallback ── */}
      <div className="relative h-36 w-full flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => {
              // Hide broken image and show icon fallback instead
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}

        {/* Icon fallback — always rendered; hidden when thumbnail loads fine */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2',
            thumbnailUrl ? 'hidden' : '',
          )}
        >
          <TypeIcon
            size={36}
            className="text-gray-400 dark:text-gray-500"
            strokeWidth={1.5}
          />
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {typeMeta.label}
          </span>
        </div>

        {/* ── Bookmark toggle (top-right corner) ── */}
        <button
          type="button"
          onClick={handleBookmark}
          disabled={bookmarkLoading}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this resource'}
          aria-pressed={bookmarked}
          className={cn(
            'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition',
            'bg-white/80 backdrop-blur-sm dark:bg-gray-800/80',
            'hover:bg-white dark:hover:bg-gray-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple',
            bookmarkLoading && 'opacity-60 cursor-wait',
          )}
        >
          {bookmarkLoading ? (
            <Loader2 size={15} className="animate-spin text-brand-purple" />
          ) : (
            <Bookmark
              size={15}
              className={cn(
                'transition-colors',
                bookmarked
                  ? 'fill-brand-purple stroke-brand-purple'
                  : 'stroke-gray-500 dark:stroke-gray-400',
              )}
            />
          )}
        </button>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Title */}
        <h3
          className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-50"
          title={title}
        >
          {title}
        </h3>

        {/* Subject / learning area */}
        {subjectLabel && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={subjectLabel}>
            {subjectLabel}
          </p>
        )}

        {/* Badges row */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {/* Resource type badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              typeMeta.colour,
            )}
          >
            <TypeIcon size={11} />
            {typeMeta.label}
          </span>

          {/* Difficulty badge */}
          {difficulty && DIFFICULTY_COLOUR[difficulty] && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                DIFFICULTY_COLOUR[difficulty],
              )}
            >
              {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
            </span>
          )}
        </div>

        {/* Footer row: download count + download button */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-700">
          {/* Download count */}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Download size={12} />
            {formatCount(downloadCount)}
          </span>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={`Download ${title}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              'bg-brand-purple text-white hover:bg-brand-purple/90 focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-1 focus-visible:outline-none',
              downloading && 'opacity-70 cursor-wait',
            )}
          >
            {downloading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <Download size={12} />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
