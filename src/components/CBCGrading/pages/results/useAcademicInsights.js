/**
 * useAcademicInsights — Pure-function insights engine
 *
 * Takes the raw `data` and `summary` from `useLearnerResults` and produces
 * actionable, parent-friendly insights:
 *
 *   1. Per-subject trend detection (term-over-term deltas with attribution)
 *   2. Decline alerts (severity + teacher comments + test type attribution)
 *   3. Improvement celebrations (positive momentum signals)
 *   4. Trajectory projection (linear projection from term averages)
 *   5. Standards-aligned progress indicators (EE/ME/AE/BE bands)
 *
 * Every insight returned is backed by real data that the backend already
 * provides — no invented metrics, no placeholder copy.
 *
 * Batch 7, Parent Academic Analytics Tier 1.
 */

import { TERM_ORDER, termLabel, cbcBandMeta } from './useLearnerResults';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const DELTA = {
  CELEBRATE: 5,   // +5 pts or more → improvement celebration
  DECLINE:   -5,  // -5 pts or more → decline alert
  SEVERE:    -10, // -10 pts or more → severe decline
};

// ─── Types ────────────────────────────────────────────────────────────────────
//
// Insight = {
//   type:       'decline' | 'improvement' | 'celebration' | 'projection' | 'standard',
//   severity?:  'info' | 'warning' | 'critical',
//   subject?:   string,
//   delta?:     number,          // percentage-point change
//   message:    string,          // human-readable summary
//   detail?:    string,          // supporting detail (teacher comment, attribution)
//   attribution?: string,        // what caused this (e.g. "End of Term exam")
//   teacherComment?: string,     // raw teacher comment if available
//   recommendation?: string,    // actionable recommendation
//   milestone?: string,          // for celebrations (e.g. "Crossed 70% threshold")
//   projection?: { term: string, projectedScore: number },
//   band?: { code: string, label: string },
// }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the latest and previous percentage for a single subject
 * from the raw `subjectTrends` array.
 *
 * Returns { latest, previous, latestTerm, previousTerm, latestGrade, teacherComment, testType }
 * or null if insufficient data.
 */
function extractSubjectTrend(subjectTrend, orderedTerms) {
  if (!subjectTrend?.termResults?.length) return null;

  // Sort term results by TERM_ORDER
  const sorted = [...subjectTrend.termResults]
    .filter(tr => tr.percentage != null)
    .sort((a, b) => TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term));

  if (sorted.length === 0) return null;

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  return {
    latest: Number(latest.percentage),
    previous: previous ? Number(previous.percentage) : null,
    latestTerm: latest.term,
    previousTerm: previous?.term || null,
    latestGrade: latest.cbcGrade || null,
    teacherComment: latest.teacherComment || latest.remarks || null,
    testType: latest.testType || null,
    subjectName: subjectTrend.learningArea,
  };
}

/**
 * Human-readable label for a testType enum.
 */
function testTypeLabel(testType) {
  if (!testType) return null;
  const labels = {
    OPENER: 'opener assessment',
    WEEKLY: 'weekly test',
    MONTHLY: 'monthly assessment',
    CAT: 'continuous assessment',
    MID_TERM: 'mid-term exam',
    END_TERM: 'end-of-term exam',
    END_OF_TERM: 'end-of-term exam',
    PROJECT: 'project',
    ASSIGNMENT: 'assignment',
    PRACTICAL: 'practical',
    ORAL: 'oral assessment',
    PORTFOLIO: 'portfolio',
    REVISION: 'revision test',
  };
  return labels[testType] || testType.toLowerCase().replace(/_/g, ' ');
}

/**
 * Generate a context-aware recommendation based on the decline data.
 */
function generateRecommendation(subjectName, delta, teacherComment, band) {
  const parts = [];

  if (band === 'BE') {
    parts.push(`${subjectName} is currently below expectation`);
    parts.push('consider scheduling extra practice sessions or tutoring');
  } else if (band === 'AE') {
    parts.push(`${subjectName} is approaching but not yet meeting expectation`);
    parts.push('targeted revision of weak areas could help close the gap');
  } else if (delta <= DELTA.SEVERE) {
    parts.push(`the drop in ${subjectName} is significant`);
    parts.push('a conversation with the subject teacher is recommended');
  } else {
    parts.push(`${subjectName} has slipped slightly`);
    parts.push('consistent practice and review can help recover');
  }

  if (teacherComment) {
    parts.push(`Teacher notes: "${teacherComment}"`);
  }

  return parts.join(' — ');
}

/**
 * Detect if a student crossed a threshold (e.g. 50% → 70%).
 */
function detectMilestone(previous, latest) {
  if (previous == null || latest == null) return null;
  const milestones = [
    { threshold: 70, label: 'Crossed into Exceeds Expectation (70%+)' },
    { threshold: 50, label: 'Crossed into Meets Expectation (50%+)' },
  ];
  for (const m of milestones) {
    if (previous < m.threshold && latest >= m.threshold) return m.label;
  }
  return null;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Compute actionable insights from learner analytics data.
 *
 * @param {object|null} data    - Raw API response from getLearnerAnalytics
 * @param {object}      summary - Collapsed summary from summarizeAnalytics()
 * @returns {{ insights: Insight[], hasInsights: boolean, summary: object }}
 */
export function computeInsights(data, summary) {
  if (!summary?.hasData || !data) {
    return { insights: [], hasInsights: false };
  }

  const insights = [];
  const orderedTerms = summary.terms;

  // ── 1. Per-subject trend analysis ──────────────────────────────────────────

  const subjectTrends = data.subjectTrends || [];

  for (const st of subjectTrends) {
    const trend = extractSubjectTrend(st, orderedTerms);
    if (!trend) continue;

    const { subjectName, latest, previous, latestGrade, teacherComment, testType } = trend;

    // Skip if no previous term to compare against
    if (previous == null) continue;

    const delta = latest - previous;
    const bandCode = latestGrade ? latestGrade.replace(/\d/g, '').trim() : null;

    // ── Decline alerts ──────────────────────────────────────────────────────
    if (delta <= DELTA.DECLINE) {
      const severity = delta <= DELTA.SEVERE ? 'critical' : 'warning';
      const attribution = testType
        ? `Noted in the ${testTypeLabel(testType)} for ${termLabel(trend.latestTerm)}`
        : `Noted in ${termLabel(trend.latestTerm)}`;

      insights.push({
        type: 'decline',
        severity,
        subject: subjectName,
        delta,
        message: `${subjectName} dropped ${Math.abs(delta)} points from ${termLabel(trend.previousTerm)} to ${termLabel(trend.latestTerm)}`,
        detail: attribution,
        attribution,
        teacherComment: teacherComment || undefined,
        recommendation: generateRecommendation(subjectName, delta, teacherComment, bandCode),
        band: bandCode ? { code: bandCode, label: cbcBandMeta(bandCode)?.label || bandCode } : undefined,
      });
    }

    // ── Improvement celebrations ────────────────────────────────────────────
    if (delta >= DELTA.CELEBRATE) {
      const milestone = detectMilestone(previous, latest);
      insights.push({
        type: 'improvement',
        severity: 'info',
        subject: subjectName,
        delta,
        message: `${subjectName} improved by ${delta} points from ${termLabel(trend.previousTerm)} to ${termLabel(trend.latestTerm)}`,
        detail: teacherComment
          ? `Teacher notes: "${teacherComment}"`
          : `Now at ${latest}% — ${bandCode ? cbcBandMeta(bandCode)?.label || bandCode : 'no grade assigned'}`,
        milestone: milestone || undefined,
        band: bandCode ? { code: bandCode, label: cbcBandMeta(bandCode)?.label || bandCode } : undefined,
      });
    }
  }

  // ── 2. Overall trajectory projection ───────────────────────────────────────
  //
  // Linear projection: if we have 2+ terms of data, project the next term's
  // average using the rate of change between the two most recent terms.
  // This mirrors SAS EVAAS-style "if current trajectory continues" messaging.

  if (orderedTerms.length >= 2) {
    const latestTerm = orderedTerms[orderedTerms.length - 1];
    const prevTerm = orderedTerms[orderedTerms.length - 2];
    const rateOfChange = latestTerm.avg - prevTerm.avg;
    const projected = Math.round(latestTerm.avg + rateOfChange);
    const nextTermIndex = TERM_ORDER.indexOf(latestTerm.term) + 1;
    const nextTerm = TERM_ORDER[nextTermIndex];

    if (nextTerm) {
      const direction = rateOfChange > 0 ? 'up' : rateOfChange < 0 ? 'down' : 'steady';
      const directionText = direction === 'up'
        ? `trending upward — projected ${projected}% in ${termLabel(nextTerm)}`
        : direction === 'down'
        ? `trending downward — projected ${projected}% in ${termLabel(nextTerm)} if current pattern continues`
        : `holding steady — projected ${projected}% in ${termLabel(nextTerm)}`;

      insights.push({
        type: 'projection',
        severity: direction === 'down' && projected < 50 ? 'warning' : 'info',
        message: `Overall performance is ${directionText}`,
        detail: `Based on ${prevTerm.avg}% → ${latestTerm.avg}% between ${termLabel(prevTerm.term)} and ${termLabel(latestTerm.term)}`,
        projection: { term: nextTerm, projectedScore: Math.max(0, Math.min(100, projected)) },
      });
    }
  }

  // ── 3. Standards-aligned summary ───────────────────────────────────────────
  //
  // Summarize how many subjects are in each CBC band for the latest term.

  if (summary.latest?.subjects?.length) {
    const bandCounts = { EE: 0, ME: 0, AE: 0, BE: 0 };
    let graded = 0;

    for (const s of summary.latest.subjects) {
      // The summary stores cbcGrade on each subject entry
      if (s.cbcGrade) {
        const code = s.cbcGrade.replace(/\d/g, '').trim();
        if (bandCounts[code] != null) {
          bandCounts[code]++;
          graded++;
        }
      }
    }

    if (graded > 0) {
      const belowCount = bandCounts.AE + bandCounts.BE;
      const aboveCount = bandCounts.EE + bandCounts.ME;

      if (belowCount > 0 && belowCount >= aboveCount) {
        insights.push({
          type: 'standard',
          severity: 'warning',
          message: `${belowCount} of ${graded} subjects are below or approaching expectation`,
          detail: `${bandCounts.AE} approaching (AE), ${bandCounts.BE} below (BE), ${bandCounts.ME} meeting (ME), ${bandCounts.EE} exceeding (EE)`,
          band: { code: 'AE', label: 'Approaches / Below' },
        });
      } else if (bandCounts.EE >= graded / 2) {
        insights.push({
          type: 'standard',
          severity: 'info',
          message: `${bandCounts.EE} of ${graded} subjects exceed expectation`,
          detail: `Strong performance across most subjects this term`,
          band: { code: 'EE', label: 'Exceeds Expectation' },
        });
      }
    }
  }

  // ── 4. Sort insights by priority ───────────────────────────────────────────
  //
  // critical declines first, then warnings, then improvements/projections/info.

  const severityRank = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => {
    const ra = severityRank[a.severity || 'info'];
    const rb = severityRank[b.severity || 'info'];
    if (ra !== rb) return ra - rb;
    // Within same severity, declines before improvements
    const typeRank = { decline: 0, standard: 1, projection: 2, improvement: 3, celebration: 4 };
    return (typeRank[a.type] ?? 5) - (typeRank[b.type] ?? 5);
  });

  return { insights, hasInsights: insights.length > 0 };
}

// ─── Convenience hook ─────────────────────────────────────────────────────────
//
// Wraps computeInsights for use inside React components. Memoized so it only
// recomputes when the underlying data/summary changes.

import { useMemo } from 'react';

export function useAcademicInsights(data, summary) {
  return useMemo(() => computeInsights(data, summary), [data, summary]);
}

// ─── Quick badge extraction ───────────────────────────────────────────────────
//
// Returns a compact summary for use in family-view rows (ParentPortalResults).
// Only surfaces the most important flag so parents get a glanceable signal.

export function getTopInsightFlag(insights) {
  if (!insights?.length) return null;

  // Find the most critical insight
  const critical = insights.find(i => i.severity === 'critical');
  if (critical) {
    return {
      level: 'critical',
      icon: 'decline',
      text: critical.subject
        ? `${critical.subject} down ${Math.abs(critical.delta)} pts`
        : critical.message,
    };
  }

  // Then warnings
  const warning = insights.find(i => i.severity === 'warning' && i.type === 'decline');
  if (warning) {
    return {
      level: 'warning',
      icon: 'decline',
      text: warning.subject
        ? `${warning.subject} declining`
        : warning.message,
    };
  }

  // Then improvements
  const improvement = insights.find(i => i.type === 'improvement');
  if (improvement) {
    return {
      level: 'positive',
      icon: 'improvement',
      text: improvement.subject
        ? `${improvement.subject} up ${improvement.delta} pts`
        : improvement.message,
    };
  }

  // Then projection
  const projection = insights.find(i => i.type === 'projection');
  if (projection) {
    return {
      level: 'info',
      icon: 'projection',
      text: projection.message,
    };
  }

  return null;
}
