/**
 * ResultsShared — shared presentational components for all results screens.
 *
 * Used by:
 *   - ParentPortalResults   (family overview)
 *   - ParentChildProfile    (Results tab)
 *   - MyResults             (student view)
 *   - LatestResultsWidget   (dashboard widget)
 *
 * Canonical terminology (Batch 7 glossary):
 *   cbcGrade   — PRIMARY grade badge (school-configured CBC band: EE/ME/AE/BE)
 *   percentage — supporting numeric detail (0–100)
 *   grade      — legacy 8-4-4 label; never computed or displayed here
 *
 * Accessibility notes:
 *   - All interactive elements are <button type="button"> with visible focus ring
 *   - Colour is never the sole indicator — grade pills carry text labels
 *   - Progress bars carry an aria-label with the percentage value
 *   - Minimum tap target 44×44px enforced on accordion toggles
 *
 * Batch 3 + Batch 7, Assessment UX Overhaul.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, GraduationCap, Loader2 } from 'lucide-react';
import { termLabel, scoreColor, barColor, cbcBandMeta } from './useLearnerResults';

// ─── ResultsLoadingState ───────────────────────────────────────────────────────
/** Spinner shown while analytics data is loading. */
export function ResultsLoadingState() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading results">
      <Loader2 size={22} className="animate-spin text-[#3B1FA3]" aria-hidden="true" />
    </div>
  );
}

// ─── ResultsErrorState ─────────────────────────────────────────────────────────
/** Error state — shown when the fetch fails. */
export function ResultsErrorState({ message }) {
  return (
    <div
      role="alert"
      className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center"
    >
      <GraduationCap size={28} className="mx-auto mb-2 text-gray-300 opacity-40" aria-hidden="true" />
      <p className="text-sm font-semibold text-gray-600 mb-1">Results unavailable</p>
      <p className="text-xs text-gray-400">{message || 'Please try again later.'}</p>
    </div>
  );
}

// ─── ResultsEmptyState ─────────────────────────────────────────────────────────
/** Empty state — shown when the learner has no recorded results for this year. */
export function ResultsEmptyState({ year }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
      <GraduationCap size={28} className="mx-auto mb-2 text-gray-300 opacity-40" aria-hidden="true" />
      <p className="text-sm font-semibold text-gray-600 mb-1">
        No subject results yet{year ? ` for ${year}` : ''}
      </p>
      <p className="text-xs text-gray-400">
        Results will appear once assessments are entered by the teacher.
      </p>
    </div>
  );
}

// ─── GradePill ─────────────────────────────────────────────────────────────────
/**
 * PRIMARY grade badge: cbcGrade code (EE/ME/AE/BE) with accessible tooltip title.
 * percentage is shown as secondary text alongside it by the caller.
 */
export function GradePill({ cbcGrade }) {
  if (!cbcGrade) return null;
  const band = cbcBandMeta(cbcGrade);
  const cls  = band?.cls || 'bg-blue-50 text-blue-700 border border-blue-200';
  const title = band?.label || cbcGrade;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cls}`}
      title={title}
      aria-label={`CBC grade: ${title}`}
    >
      {cbcGrade}
    </span>
  );
}

// ─── PercentageBar ─────────────────────────────────────────────────────────────
/** Progress bar for a percentage score. Colour-coded; accessible aria-label. */
export function PercentageBar({ percentage }) {
  const pct = Math.min(Math.max(Number(percentage || 0), 0), 100);
  return (
    <div
      className="h-1.5 bg-gray-100 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% score`}
    >
      <div
        className={`h-full ${barColor(pct)} rounded-full transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── SubjectRow ────────────────────────────────────────────────────────────────
/**
 * Single subject row: name | cbcGrade pill (primary) | percentage | progress bar
 * | teacher comment (if present).
 */
export function SubjectRow({ subject }) {
  const { name, percentage, cbcGrade, comment } = subject;
  const n = Math.round(Number(percentage || 0));

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-gray-900 truncate max-w-[170px]">{name}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* cbcGrade is PRIMARY — shown as badge */}
          <GradePill cbcGrade={cbcGrade} />
          {/* percentage is SECONDARY — plain text */}
          <span className={`text-sm font-bold ${scoreColor(n)}`}>{n}%</span>
        </div>
      </div>
      <PercentageBar percentage={n} />
      {comment && (
        <p className="mt-1.5 flex items-start gap-1 text-[10px] text-gray-500 italic">
          <MessageSquare size={10} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>"{comment}"</span>
        </p>
      )}
    </div>
  );
}

// ─── TermAccordion ─────────────────────────────────────────────────────────────
/**
 * Collapsible term card. Shows term label, subject count, and average.
 * Expands to show a SubjectRow for each subject.
 *
 * @param {object}  term       — { term, subjects[], avg }
 * @param {boolean} defaultOpen — open on mount (use for latest term)
 * @param {boolean} highlight  — adds a coloured border (use for latest term)
 */
export function TermAccordion({ term, defaultOpen = false, highlight = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white ${
        highlight ? 'border-[#3B1FA3]/30' : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left min-h-[44px] hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B1FA3] focus-visible:ring-inset"
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{termLabel(term.term)}</p>
            {highlight && (
              <span className="rounded-full bg-[#3B1FA3] px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wide">
                Latest
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {term.subjects.length} subject{term.subjects.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-sm font-bold ${scoreColor(term.avg)}`}>{term.avg}%</span>
          {open
            ? <ChevronUp  size={14} className="text-gray-400" aria-hidden="true" />
            : <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {term.subjects.map((s) => (
            <SubjectRow key={s.name} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── YearSelector ──────────────────────────────────────────────────────────────
/** Compact dropdown for selecting academic year. */
export function YearSelector({ value, onChange, accentColor = '#3B1FA3' }) {
  const cur   = new Date().getFullYear();
  const years = [cur, cur - 1, cur - 2].map(String);
  return (
    <div className="relative inline-block">
      <label htmlFor="results-year-selector" className="sr-only">Academic year</label>
      <select
        id="results-year-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 cursor-pointer"
        style={{ '--tw-ring-color': accentColor }}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
