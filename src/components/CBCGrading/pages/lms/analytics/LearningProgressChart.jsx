/**
 * LearningProgressChart
 *
 * Reusable Recharts wrapper for the LMS Analytics section.
 * Supports four chart types mapped to specific LMS data dimensions:
 *   'line'  — daily active learners         (XAxis=date, YAxis=count)
 *   'bar'   — submission rate per assignment (XAxis=name, YAxis=rate %)
 *   'pie'   — resource downloads by type    (name, value)
 *   'area'  — learning time trend           (XAxis=date, YAxis=minutes)
 *
 * Requirements: 13.1, 25.1
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '../../../../../utils/cn';

// ─── Consistent colour palette (dark-mode friendly) ─────────────────────────
// Using hex values that render well on both white and dark-gray backgrounds.
const PALETTE = [
  '#6d28d9', // violet-700  (brand-purple)
  '#0891b2', // cyan-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-400
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-400
  '#34d399', // emerald-400
];

// Chart-specific accent colours
const LINE_COLOR  = PALETTE[0];
const BAR_COLOR   = PALETTE[1];
const AREA_COLOR  = PALETTE[2];

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      {label !== undefined && (
        <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color ?? entry.fill }}>
          {entry.name}: {entry.value}
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  );
};

// ─── Skeleton loading state ──────────────────────────────────────────────────
const ChartSkeleton = ({ height, title }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    {title && (
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    )}
    <div
      className="animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
      style={{ height: height - (title ? 44 : 0) }}
    />
  </div>
);

// ─── Empty state ─────────────────────────────────────────────────────────────
const EmptyChart = ({ height, title }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    {title && (
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
    )}
    <div
      className="flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900/30"
      style={{ height: height - (title ? 44 : 0) }}
    >
      <p className="text-sm text-gray-400 dark:text-gray-500">No data available</p>
    </div>
  </div>
);

// ─── Individual chart renderers ──────────────────────────────────────────────

/** 'line' — daily active learners */
const ActiveLearnersLine = ({ data, height }) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
        label={{
          value: 'Learners',
          angle: -90,
          position: 'insideLeft',
          offset: 10,
          style: { fontSize: 11, fill: '#9ca3af' },
        }}
      />
      <Tooltip content={<CustomTooltip unit="learners" />} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Line
        type="monotone"
        dataKey="count"
        name="Active Learners"
        stroke={LINE_COLOR}
        strokeWidth={2}
        dot={{ r: 3, fill: LINE_COLOR }}
        activeDot={{ r: 5 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

/** 'bar' — submission rate per assignment */
const SubmissionRateBar = ({ data, height }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
        interval={0}
        angle={data.length > 5 ? -25 : 0}
        textAnchor={data.length > 5 ? 'end' : 'middle'}
        height={data.length > 5 ? 48 : 28}
      />
      <YAxis
        domain={[0, 100]}
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => `${v}%`}
      />
      <Tooltip content={<CustomTooltip unit="%" />} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="rate" name="Submission Rate" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
    </BarChart>
  </ResponsiveContainer>
);

/** 'pie' — resource downloads by type */
const DownloadsByTypePie = ({ data, height }) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        outerRadius={Math.min(height / 2 - 24, 100)}
        innerRadius={Math.min(height / 2 - 24, 100) * 0.55}
        dataKey="value"
        nameKey="name"
        paddingAngle={2}
      >
        {data.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={entry.color ?? PALETTE[index % PALETTE.length]}
          />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip />} />
      <Legend
        iconType="circle"
        iconSize={8}
        wrapperStyle={{ fontSize: 12 }}
        formatter={(value) => (
          <span className="text-gray-600 dark:text-gray-300">{value}</span>
        )}
      />
    </PieChart>
  </ResponsiveContainer>
);

/** 'area' — learning time trend */
const LearningTimeArea = ({ data, height }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="lpc-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={AREA_COLOR} stopOpacity={0.25} />
          <stop offset="95%" stopColor={AREA_COLOR} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#6b7280' }}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
        label={{
          value: 'Minutes',
          angle: -90,
          position: 'insideLeft',
          offset: 10,
          style: { fontSize: 11, fill: '#9ca3af' },
        }}
      />
      <Tooltip content={<CustomTooltip unit="min" />} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Area
        type="monotone"
        dataKey="minutes"
        name="Learning Time"
        stroke={AREA_COLOR}
        strokeWidth={2}
        fill="url(#lpc-area-gradient)"
        dot={false}
        activeDot={{ r: 4, fill: AREA_COLOR }}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * @param {'line'|'bar'|'pie'|'area'} type   - Chart variant
 * @param {Array}                     data    - Data array for the chart
 * @param {string}                    [title] - Optional card title
 * @param {number}                    [height=300] - Chart height in px
 * @param {boolean}                   [isLoading=false] - Show skeleton while loading
 * @param {string}                    [className] - Extra Tailwind classes for the card wrapper
 */
const LearningProgressChart = ({
  type = 'line',
  data = [],
  title,
  height = 300,
  isLoading = false,
  className,
}) => {
  // ── Loading skeleton ──
  if (isLoading) {
    return <ChartSkeleton height={height} title={title} />;
  }

  // ── Empty state ──
  if (!data || data.length === 0) {
    return <EmptyChart height={height} title={title} />;
  }

  // ── Resolve chart component ──
  // Chart body height = card height minus title row (if present) and padding
  const TITLE_ROW_H = title ? 40 : 0;
  const PADDING_H   = 16; // top + bottom padding inside card
  const chartH      = Math.max(height - TITLE_ROW_H - PADDING_H, 120);

  let ChartBody;
  switch (type) {
    case 'bar':
      ChartBody = <SubmissionRateBar data={data} height={chartH} />;
      break;
    case 'pie':
      ChartBody = <DownloadsByTypePie data={data} height={chartH} />;
      break;
    case 'area':
      ChartBody = <LearningTimeArea data={data} height={chartH} />;
      break;
    case 'line':
    default:
      ChartBody = <ActiveLearnersLine data={data} height={chartH} />;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4',
        'dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
    >
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {title}
        </h3>
      )}
      {ChartBody}
    </div>
  );
};

export default LearningProgressChart;
