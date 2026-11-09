/**
 * SubjectGrowthChart — Multi-subject line chart showing score progression
 * across terms, with trend lines and an overall average overlay.
 *
 * Uses recharts LineChart (already in the project — HeadTeacherDashboard,
 * AttendanceAnomalies use the same component).
 *
 * Data source: `summary.terms` from `summarizeAnalytics()` — each term has
 * `{ term, subjects: [{ name, percentage, cbcGrade, comment }], avg }`.
 *
 * Batch 7, Parent Academic Analytics Tier 1.
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { TERM_ORDER, termLabel, scoreColor, barFill } from '../results/useLearnerResults';

// ─── Color palette for subject lines ──────────────────────────────────────────
//
// Distinct colors per subject so parents can visually trace each subject's
// trajectory. Ordered for maximum visual distinction.

const SUBJECT_COLORS = [
  '#3B1FA3', // brand purple
  '#0ea5e9', // sky blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

const AVG_LINE_COLOR = '#6b7280'; // gray-500 — overall average overlay

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[11px] font-semibold text-gray-700">{entry.name}</span>
            <span className="text-[11px] font-black text-gray-900 ml-auto">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubjectGrowthChart({ summary, maxSubjects = 6 }) {
  // Build chart data: one row per term, each subject as a keyed column
  const { chartData, subjects, hasData } = useMemo(() => {
    if (!summary?.hasData || !summary.terms?.length) {
      return { chartData: [], subjects: [], hasData: false };
    }

    // Collect all subject names across all terms, preserving first-appearance order
    const seen = new Set();
    const allSubjects = [];
    summary.terms.forEach(term => {
      (term.subjects || []).forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); allSubjects.push(s.name); }
      });
    });

    // Limit to top N subjects by year average to avoid chart clutter
    const subjectAvgs = allSubjects.map(name => {
      const scores = summary.terms
        .map(t => t.subjects.find(s => s.name === name)?.percentage)
        .filter(v => v != null);
      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return { name, avg };
    }).sort((a, b) => b.avg - a.avg);

    const limitedSubjects = subjectAvgs.slice(0, maxSubjects).map(s => s.name);

    // Build one row per term
    const data = summary.terms.map(term => {
      const row = { termLabel: termLabel(term.term) };
      limitedSubjects.forEach(name => {
        const subj = term.subjects.find(s => s.name === name);
        row[name] = subj ? Math.round(subj.percentage) : null;
      });
      row['Overall Avg'] = term.avg;
      return row;
    });

    return { chartData: data, subjects: limitedSubjects, hasData: true };
  }, [summary, maxSubjects]);

  if (!hasData) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Growth Over Time</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">Subject performance across terms</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="termLabel"
            tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 70, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<GrowthTooltip />} />

          {/* Reference lines at CBC thresholds */}
          <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />

          {/* Overall average line — always rendered first (behind subject lines) */}
          <Line
            type="monotone"
            dataKey="Overall Avg"
            stroke={AVG_LINE_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: AVG_LINE_COLOR }}
            activeDot={{ r: 5 }}
          />

          {/* Subject lines */}
          {subjects.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend with CBC threshold reference */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {subjects.map((name, i) => (
            <div key={name} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
              />
              <span className="text-[9px] font-medium text-gray-600 truncate max-w-[80px]">{name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AVG_LINE_COLOR }} />
            <span className="text-[9px] font-medium text-gray-600">Overall Avg</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-amber-500" /> 50% (ME)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-emerald-500" /> 70% (EE)
          </span>
        </div>
      </div>
    </div>
  );
}
