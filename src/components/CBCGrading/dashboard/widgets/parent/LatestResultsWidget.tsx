/**
 * LatestResultsWidget
 *
 * Replaces the "Coming Soon" stub with a real summary of the parent's
 * children's latest-term academic results, sourced from the same
 * getLearnerAnalytics endpoint used by ParentPortalResults.
 *
 * Shows a compact per-child row: name · latest term · average · cbcGrade band.
 * Taps through to parent-portal-results for the full view.
 *
 * Batch 7, Assessment UX Overhaul.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, ChevronRight } from 'lucide-react';
import { dashboardAPI, reportAPI } from '../../../../../services/api';

interface WidgetProps {
  user?: any;
  config?: any;
  onNavigate?: (path: string) => void;
}

const TERM_LABELS: Record<string, string> = {
  TERM_1: 'Term 1',
  TERM_2: 'Term 2',
  TERM_3: 'Term 3',
};

function scoreColor(n: number): string {
  if (n >= 70) return '#10b981';
  if (n >= 50) return '#f59e0b';
  return '#ef4444';
}

/** Pull the latest-term average and cbcGrade band from raw analytics payload */
function latestSummary(data: any): { term: string; avg: number; topCbcGrade: string | null } | null {
  if (!data?.subjectTrends?.length) return null;

  const termOrder = ['TERM_1', 'TERM_2', 'TERM_3'];
  const termMap = new Map<string, { scores: number[]; cbcGrades: string[] }>();

  data.subjectTrends.forEach((trend: any) => {
    (trend.termResults || []).forEach((tr: any) => {
      if (tr.percentage == null) return;
      if (!termMap.has(tr.term)) termMap.set(tr.term, { scores: [], cbcGrades: [] });
      const entry = termMap.get(tr.term)!;
      entry.scores.push(Number(tr.percentage));
      if (tr.cbcGrade) entry.cbcGrades.push(tr.cbcGrade);
    });
  });

  const presentTerms = termOrder.filter((t) => termMap.has(t));
  if (!presentTerms.length) return null;

  const latestTerm = presentTerms[presentTerms.length - 1];
  const entry = termMap.get(latestTerm)!;
  const avg = Math.round(entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length);

  // Most common cbcGrade in the latest term (simple majority)
  const gradeCounts: Record<string, number> = {};
  entry.cbcGrades.forEach((g) => { gradeCounts[g] = (gradeCounts[g] || 0) + 1; });
  const topCbcGrade = entry.cbcGrades.length
    ? Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return { term: latestTerm, avg, topCbcGrade };
}

const LatestResultsWidget: React.FC<WidgetProps> = ({ onNavigate }) => {
  const [rows, setRows] = useState<Array<{
    id: string;
    name: string;
    term: string;
    avg: number;
    topCbcGrade: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const childrenRes = await dashboardAPI.getParentMetrics();
      const children: any[] = childrenRes?.data?.children || [];
      if (!children.length) { setLoading(false); return; }

      const year = String(new Date().getFullYear());
      const results = await Promise.allSettled(
        children.map((c: any) => reportAPI.getLearnerAnalytics(c.id, { academicYear: year })),
      );

      const built: typeof rows = [];
      children.forEach((child: any, i: number) => {
        const res = results[i];
        if (res.status !== 'fulfilled') return;
        const summary = latestSummary(res.value?.data);
        if (!summary) return;
        built.push({ id: child.id, name: child.name, ...summary });
      });
      setRows(built);
    } catch {
      // silently degrade — widget is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 6, marginBottom: 8, width: '60%' }} />
        <div style={{ height: 12, background: '#f3f4f6', borderRadius: 6, width: '80%' }} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>No results recorded yet.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <BarChart2 size={14} style={{ color: '#3b1fa3' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>Latest Results</span>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-results')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', fontSize: '0.6875rem', fontWeight: 700, color: '#3b1fa3', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View all <ChevronRight size={11} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid #f3f4f6' }}
          >
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', margin: 0 }}>{row.name.split(' ')[0]}</p>
              <p style={{ fontSize: '0.625rem', color: '#9ca3af', margin: 0 }}>{TERM_LABELS[row.term] || row.term}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
              {row.topCbcGrade && (
                <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '1px 6px' }}>
                  {row.topCbcGrade}
                </span>
              )}
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: scoreColor(row.avg) }}>{row.avg}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LatestResultsWidget;
