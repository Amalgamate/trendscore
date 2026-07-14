/**
 * useLearnerResults(learnerId, academicYear)
 *
 * Shared data-fetching hook for all learner-results screens
 * (ParentPortalResults, ParentChildProfile ResultsTab, MyResults).
 *
 * Calls GET /api/reports/analytics/learner/:learnerId?academicYear=YYYY
 * (Batch 1 endpoint — server enforces ownership; STUDENT self-only,
 * PARENT own-children-only, staff unrestricted).
 *
 * Returns:
 *   { loading, error, data, summary, refetch }
 *
 * `summary` is the collapsed per-term view produced by summarizeAnalytics:
 *   { hasData, terms[], latest, previous, trend }
 *
 * Terminology (canonical — Batch 7 glossary):
 *   cbcGrade   — primary grade badge (school-configured CBC band: EE/ME/AE/BE)
 *   percentage — supporting numeric detail (0–100)
 *   grade      — legacy 8-4-4 label; never computed or displayed by this module
 *
 * Batch 3 + Batch 7, Assessment UX Overhaul.
 */

import { useState, useEffect, useCallback } from 'react';
import { reportAPI } from '../../../../services/api';

// ─── Canonical term ordering ───────────────────────────────────────────────────
export const TERM_ORDER  = ['TERM_1', 'TERM_2', 'TERM_3'];
export const TERM_LABELS = { TERM_1: 'Term 1', TERM_2: 'Term 2', TERM_3: 'Term 3' };
export const termLabel   = (t) => TERM_LABELS[t] || t;

// ─── Grading colour helpers ────────────────────────────────────────────────────
/** Tailwind text-colour class for a percentage score. */
export function scoreColor(n) {
  const v = Number(n || 0);
  if (v >= 70) return 'text-emerald-600';
  if (v >= 50) return 'text-amber-500';
  return 'text-rose-600';
}

/** Tailwind background-colour class for a progress bar. */
export function barColor(n) {
  const v = Number(n || 0);
  if (v >= 70) return 'bg-emerald-500';
  if (v >= 50) return 'bg-amber-400';
  return 'bg-rose-500';
}

/** Hex fill for recharts Cell / SVG. */
export function barFill(n) {
  const v = Number(n || 0);
  if (v >= 70) return '#10b981';
  if (v >= 50) return '#f59e0b';
  return '#ef4444';
}

/**
 * CBC band metadata for a cbcGrade code.
 * Returns { label, cls } where cls is Tailwind classes for a pill badge,
 * or null if the grade is unrecognised.
 */
export function cbcBandMeta(grade) {
  const map = {
    EE: { label: 'Exceeds Expectation',      cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
    ME: { label: 'Meets Expectation',         cls: 'bg-blue-100    text-blue-800    border border-blue-200'    },
    AE: { label: 'Approaches Expectation',    cls: 'bg-amber-100   text-amber-800   border border-amber-200'   },
    BE: { label: 'Below Expectation',         cls: 'bg-rose-100    text-rose-800    border border-rose-200'    },
  };
  return map[grade] || null;
}

// ─── Analytics summarizer ──────────────────────────────────────────────────────
/**
 * Collapse raw getLearnerAnalytics() payload into a compact per-term summary.
 * A subject/term only appears if a real SummativeResult exists for it.
 * Multiple tests for the same subject within a term are averaged together.
 *
 * Returns:
 *   { hasData: false, terms: [] }
 *   or
 *   { hasData: true, terms[], latest, previous, trend }
 */
export function summarizeAnalytics(data) {
  if (!data) return { hasData: false, terms: [] };

  const termMap = new Map(); // term → Map(subjectName → { scores, cbcGrades, comments })

  (data.subjectTrends || []).forEach((subjectTrend) => {
    (subjectTrend.termResults || []).forEach((tr) => {
      if (tr.percentage == null) return;
      if (!termMap.has(tr.term)) termMap.set(tr.term, new Map());
      const bySubject = termMap.get(tr.term);
      if (!bySubject.has(subjectTrend.learningArea)) {
        bySubject.set(subjectTrend.learningArea, { scores: [], cbcGrades: [], comments: [] });
      }
      const entry = bySubject.get(subjectTrend.learningArea);
      entry.scores.push(Number(tr.percentage));
      if (tr.cbcGrade)      entry.cbcGrades.push(tr.cbcGrade);
      if (tr.teacherComment) entry.comments.push(tr.teacherComment);
      else if (tr.remarks)   entry.comments.push(tr.remarks);
    });
  });

  const terms = TERM_ORDER.filter((t) => termMap.has(t)).map((t) => {
    const bySubject = termMap.get(t);
    const subjects  = Array.from(bySubject.entries()).map(([name, entry]) => ({
      name,
      percentage: Math.round(entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length),
      cbcGrade:   entry.cbcGrades[entry.cbcGrades.length - 1] || null,
      comment:    entry.comments[entry.comments.length - 1]   || null,
    }));
    const avg = subjects.length
      ? Math.round(subjects.reduce((s, r) => s + r.percentage, 0) / subjects.length)
      : 0;
    return { term: t, subjects, avg };
  });

  if (terms.length === 0) return { hasData: false, terms: [] };

  const latest   = terms[terms.length - 1];
  const previous = terms.length > 1 ? terms[terms.length - 2] : null;
  const trend    = previous ? latest.avg - previous.avg : null;

  return { hasData: true, terms, latest, previous, trend };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
/**
 * @param {string|null} learnerId
 * @param {string} academicYear  e.g. "2026"
 */
export function useLearnerResults(learnerId, academicYear) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!learnerId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await reportAPI.getLearnerAnalytics(learnerId, { academicYear });
      setData(res?.data || null);
    } catch (e) {
      setError(e?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [learnerId, academicYear]);

  useEffect(() => { fetch(); }, [fetch]);

  const summary = summarizeAnalytics(data);

  return { loading, error, data, summary, refetch: fetch };
}
