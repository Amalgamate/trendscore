/**
 * FeeCollectionTrend
 * Finance Intelligence › FeeCollectionTrend
 *
 * Line chart showing collected / outstanding / expected fee trends over time.
 * Colors strictly from TrendSCORE design system:
 *   Collected   — Success-500  #22C55E  (solid)
 *   Outstanding — Warning-500  #F59E0B  (solid)
 *   Expected    — Info-500     #3B82F6  (dashed)
 *   Text/Labels — Neutral-700  #374151
 */

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';

// ─── Design-system colour tokens ─────────────────────────────────────────────
const C = {
  collected:   '#22C55E',
  outstanding: '#F59E0B',
  expected:    '#3B82F6',
  grid:        '#F1F5F9',
  axis:        '#94A3B8',
};

// ─── Mock trend data (replaced by API when available) ─────────────────────────
const buildMockData = () => [
  { month: 'Jan', collected: 1_050_000, outstanding: 950_000, expected: 2_000_000 },
  { month: 'Feb', collected: 1_250_000, outstanding: 850_000, expected: 2_100_000 },
  { month: 'Mar', collected: 1_500_000, outstanding: 750_000, expected: 2_200_000 },
  { month: 'Apr', collected: 1_700_000, outstanding: 600_000, expected: 2_300_000 },
  { month: 'May', collected: 1_850_000, outstanding: 480_000, expected: 2_350_000 },
  { month: 'Jun', collected: 1_980_000, outstanding: 380_000, expected: 2_400_000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAxis = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

const fmtKes = (v = 0) => {
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `KES ${(v / 1_000).toFixed(0)}K`;
  return `KES ${v.toLocaleString()}`;
};

// ─── Time filter pill ─────────────────────────────────────────────────────────
const FILTERS = ['This Month', 'This Term', 'This Year', 'Custom'];

const TimeFilter = ({ active, onChange }) => (
  <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg">
    {FILTERS.map(f => (
      <button
        key={f}
        onClick={() => onChange(f)}
        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${
          active === f
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {f}
      </button>
    ))}
    <button
      title="Pick date range"
      className="px-2 py-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
    >
      <Calendar size={12} />
    </button>
  </div>
);

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2.5 min-w-[160px]">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] font-semibold text-gray-600">{p.name}</span>
          </div>
          <span className="text-[11px] font-black text-gray-900">{fmtKes(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Custom legend ────────────────────────────────────────────────────────────
const CustomLegend = () => (
  <div className="flex items-center gap-4 mt-1">
    <div className="flex items-center gap-1.5">
      <span className="w-5 h-0.5 rounded-full bg-[#22C55E] inline-block" />
      <span className="text-[10px] font-bold text-gray-500">Collected</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-5 h-0.5 rounded-full bg-[#F59E0B] inline-block" />
      <span className="text-[10px] font-bold text-gray-500">Outstanding</span>
    </div>
    <div className="flex items-center gap-1.5">
      {/* Dashed line indicator */}
      <span className="inline-block w-5 h-0" style={{
        borderTop: '2px dashed #3B82F6',
        position: 'relative',
        top: '1px',
      }} />
      <span className="text-[10px] font-bold text-gray-500">Expected</span>
    </div>
  </div>
);

// ─── Trend summary badge ──────────────────────────────────────────────────────
const TrendSummary = ({ data }) => {
  if (!data?.length || data.length < 2) return null;
  const first = data[0]?.collected ?? 0;
  const last  = data[data.length - 1]?.collected ?? 0;
  if (first === 0) return null;
  const change = Math.round(((last - first) / first) * 100);
  const up = change >= 0;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
    }`}>
      {up
        ? <TrendingUp size={13} strokeWidth={2.5} />
        : <TrendingDown size={13} strokeWidth={2.5} />}
      Collections {up ? 'increased' : 'decreased'} {Math.abs(change)}% this term.
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * FeeCollectionTrend
 *
 * @param {Object}   props
 * @param {Array}    [props.trendData]   — [{month, collected, outstanding, expected}]
 * @param {boolean}  [props.loading]
 * @param {Function} [props.onNavigate] — (route) => void
 */
const FeeCollectionTrend = ({
  trendData,
  loading = false,
  onNavigate,
}) => {
  const [activeFilter, setActiveFilter] = useState('This Term');
  const [apiData, setApiData]   = useState(null);
  const [fetching, setFetching] = useState(false);

  // Fetch from API when filter changes (if no trendData prop provided)
  useEffect(() => {
    if (trendData) return; // parent-supplied data wins
    const filterMap = {
      'This Month': 'month',
      'This Term':  'term',
      'This Year':  'year',
      'Custom':     'term',
    };
    setFetching(true);
    dashboardAPI.getAdminMetrics(filterMap[activeFilter] ?? 'term')
      .then(res => {
        if (res?.success) {
          setApiData(res.data?.financials?.trendData ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [activeFilter, trendData]);

  const chartData = trendData ?? apiData ?? buildMockData();
  const isLoading = loading || fetching;

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 animate-pulse h-full">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-gray-100 rounded" />
          <div className="h-7 w-64 bg-gray-100 rounded-lg" />
        </div>
        <div className="flex-1 min-h-[220px] bg-gray-50 rounded-xl" />
        <div className="h-6 w-48 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!chartData.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">No trend data available</p>
        <p className="text-xs text-gray-400">Trend data will appear once fee records are available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200 h-full">

      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-900">
            Fee Collection Trend
          </h3>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
            Line
          </p>
        </div>
        <TimeFilter active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* ── Chart ── */}
      <div className="px-5 pt-4 pb-2 flex-1 min-h-[220px]">
        <CustomLegend />
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
              onClick={() => onNavigate?.('finance-fees')}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: C.axis, fontWeight: 600 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: C.axis, fontWeight: 600 }}
                tickFormatter={fmtAxis}
                dx={-4}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Collected — solid green */}
              <Line
                type="monotone"
                dataKey="collected"
                name="Collected"
                stroke={C.collected}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: C.collected, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C.collected, strokeWidth: 2, stroke: '#fff' }}
              />

              {/* Outstanding — solid orange */}
              <Line
                type="monotone"
                dataKey="outstanding"
                name="Outstanding"
                stroke={C.outstanding}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: C.outstanding, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C.outstanding, strokeWidth: 2, stroke: '#fff' }}
              />

              {/* Expected — blue dashed */}
              <Line
                type="monotone"
                dataKey="expected"
                name="Expected"
                stroke={C.expected}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4, fill: C.expected, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Trend summary ── */}
      <div className="px-5 pb-5 pt-2">
        <TrendSummary data={chartData} />
      </div>
    </div>
  );
};

export default FeeCollectionTrend;
