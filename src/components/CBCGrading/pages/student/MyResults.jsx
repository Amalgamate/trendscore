/**
 * MyResults — Student's own academic results
 *
 * Shows per-term, per-subject results from the real getLearnerAnalytics
 * endpoint (GET /api/reports/analytics/learner/:learnerId), scoped to the
 * authenticated student's own learner record via the STUDENT self-only
 * ownership check added in Batch 1.
 *
 * Primary grade displayed: cbcGrade (CBC band e.g. EE/ME/AE/BE).
 * Percentage is secondary/supporting detail.
 * Teacher comments / remarks shown where present.
 * No fabricated data — honest empty state when no results exist.
 *
 * Uses shared hook + components from results/useLearnerResults +
 * results/ResultsShared (Batch 3 / Batch 7 refactor).
 *
 * Batch 6, Assessment UX Overhaul.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import {
  useLearnerResults,
  scoreColor,
  termLabel,
} from '../results/useLearnerResults';
import {
  ResultsLoadingState,
  ResultsErrorState,
  ResultsEmptyState,
  TermAccordion,
  YearSelector,
} from '../results/ResultsShared';

// ─── Trend Badge ───────────────────────────────────────────────────────────────

function TrendBadge({ trend }) {
  if (trend === null) return null;
  if (trend > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-300">
      <TrendingUp size={11} aria-hidden="true" /> +{trend} pts
    </span>
  );
  if (trend < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-300">
      <TrendingDown size={11} aria-hidden="true" /> {trend} pts
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-white/50">
      <Minus size={11} aria-hidden="true" /> No change
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const MyResults = ({ user, onNavigate }) => {
  const [year, setYear]           = useState(String(new Date().getFullYear()));
  const [learnerId, setLearnerId] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState(null);

  // Resolve the learner id from the student's own dashboard metrics
  const resolveId = useCallback(async () => {
    setResolving(true); setResolveError(null);
    try {
      const res = await dashboardAPI.getStudentMetrics();
      const id  = res?.data?.learnerId || res?.data?.learner?.id || null;
      setLearnerId(id);
      if (!id) setResolveError('Could not identify your learner record.');
    } catch {
      setResolveError('Could not load your student profile.');
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => { resolveId(); }, [resolveId]);

  const { loading, error, summary } = useLearnerResults(
    resolving ? null : learnerId,
    year,
  );

  const isLoading = resolving || loading;
  const displayError = resolveError || error;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Page header */}
      <div className="bg-[#030b82] px-4 pt-6 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Academic Results</p>
            <p className="text-white text-xl font-black mt-0.5">My Results</p>
          </div>
          <YearSelector value={year} onChange={setYear} accentColor="#030b82" />
        </div>

        {/* Quick summary for latest term */}
        {!isLoading && !displayError && summary.hasData && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl px-3 py-2.5">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide">Latest Term Avg</p>
              <p className={`text-xl font-black mt-0.5 ${scoreColor(summary.latest.avg)}`}>
                {summary.latest.avg}%
              </p>
              <p className="text-white/60 text-[10px] mt-0.5">{termLabel(summary.latest.term)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2.5">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide">Vs Previous</p>
              <div className="mt-1">
                {summary.trend !== null
                  ? <TrendBadge trend={summary.trend} />
                  : <p className="text-white/60 text-[10px]">First term on record</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-3">
        {isLoading && <ResultsLoadingState />}

        {!isLoading && displayError && (
          <ResultsErrorState message={displayError} />
        )}

        {!isLoading && !displayError && !summary.hasData && (
          <ResultsEmptyState year={year} />
        )}

        {!isLoading && !displayError && summary.hasData && (
          <>
            {[...summary.terms].reverse().map((term, i) => (
              <TermAccordion
                key={term.term}
                term={term}
                defaultOpen={i === 0}
                highlight={i === 0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default MyResults;
