/**
 * FeeCollectionDonut
 * Finance Intelligence › FeeCollectionDonut
 *
 * Shows collected / outstanding / waived fee breakdown as a donut chart.
 * Colors strictly from TrendSCORE design system:
 *   Collected   — Success-500  #22C55E
 *   Outstanding — Warning-500  #F59E0B
 *   Waived      — Info-500     #3B82F6
 *   Text/Labels — Neutral-700  #374151
 */

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowRight, Loader2 } from 'lucide-react';

// ─── Design-system colour tokens ─────────────────────────────────────────────
const COLORS = {
  collected:   '#22C55E', // Success-500
  outstanding: '#F59E0B', // Warning-500
  waived:      '#3B82F6', // Info-500
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v = 0) => {
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `KES ${(v / 1_000).toFixed(0)}K`;
  return `KES ${v.toLocaleString()}`;
};

const pct = (part, total) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

// ─── Legend row ───────────────────────────────────────────────────────────────
const LegendRow = ({ dot, label, amount, percent }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
      />
      <span className="text-xs font-semibold text-gray-600 truncate">{label}</span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-black text-gray-900">{fmt(amount)}</span>
      <span className="text-[10px] font-bold text-gray-400 w-9 text-right">({percent}%)</span>
    </div>
  </div>
);

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-lg px-3 py-2">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{name}</p>
      <p className="text-sm font-black text-gray-900">{fmt(value)}</p>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * FeeCollectionDonut
 *
 * @param {Object}   props
 * @param {number}   [props.collected]    — KES collected
 * @param {number}   [props.outstanding]  — KES outstanding
 * @param {number}   [props.waived]       — KES waived / discounted
 * @param {boolean}  [props.loading]
 * @param {Function} [props.onNavigate]   — (route) => void
 * @param {Function} [props.onSegmentClick] — called with segment name
 */
const FeeCollectionDonut = ({
  collected   = 0,
  outstanding = 0,
  waived      = 0,
  loading     = false,
  onNavigate,
  onSegmentClick,
}) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const total = collected + outstanding + waived;

  const data = [
    { name: 'Collected',          value: collected,   color: COLORS.collected   },
    { name: 'Outstanding',        value: outstanding, color: COLORS.outstanding },
    { name: 'Waived / Discounted',value: waived,      color: COLORS.waived      },
  ].filter(d => d.value > 0);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 animate-pulse">
        <div className="h-4 w-48 bg-gray-100 rounded" />
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-3 w-full bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">No fee data available</p>
        <p className="text-xs text-gray-400">Fee records will appear once payments are recorded.</p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('finance-fees')}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            View Fee Dashboard <ArrowRight size={13} />
          </button>
        )}
      </div>
    );
  }

  const collectedPct   = pct(collected,   total);
  const outstandingPct = pct(outstanding, total);
  const waivedPct      = pct(waived,      total);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200">

      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-900">
          Fee Collection Summary
        </h3>
        <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
          Donut
        </p>
      </div>

      {/* ── Donut + legend ── */}
      <div className="px-5 py-5 flex flex-col gap-5 flex-1">

        {/* Donut */}
        <div className="relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(entry) => {
                  onSegmentClick?.(entry.name);
                  onNavigate?.('finance-fees');
                }}
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === idx ? 1 : 0.45}
                    stroke={activeIndex === idx ? '#fff' : 'none'}
                    strokeWidth={activeIndex === idx ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-black text-gray-900 leading-none">{fmt(total)}</span>
            <span className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">
              Total Expected
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col">
          <LegendRow dot={COLORS.collected}   label="Collected"          amount={collected}   percent={collectedPct}   />
          <LegendRow dot={COLORS.outstanding} label="Outstanding"        amount={outstanding} percent={outstandingPct} />
          <LegendRow dot={COLORS.waived}      label="Waived / Discounted" amount={waived}      percent={waivedPct}      />
        </div>
      </div>

      {/* ── Footer action ── */}
      <div className="px-5 pb-5">
        <button
          onClick={() => onNavigate?.('finance-fees')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors group"
        >
          View Fee Dashboard
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default FeeCollectionDonut;
