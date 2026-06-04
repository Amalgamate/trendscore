/**
 * BillingInsightsCard
 * Executive summary finance card with animated donut chart
 * Shows: Fully Paid, Partially Paid, Not Paid, Waived
 */

import React, { useEffect, useState, useRef } from 'react';
import { feeAPI } from '../../../services/api';
import { DollarSign, RefreshCw } from 'lucide-react';

// ─── Color palette ────────────────────────────────────────────────────────────
const SEGMENTS = [
  {
    key: 'fullyPaid',
    label: 'Fully Paid',
    color: '#10b981',       // emerald
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    amountColor: 'text-emerald-600',
  },
  {
    key: 'partiallyPaid',
    label: 'Partially Paid',
    color: '#f59e0b',       // amber
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    amountColor: 'text-amber-600',
  },
  {
    key: 'notPaid',
    label: 'Not Paid',
    color: '#f43f5e',       // rose
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-100',
    amountColor: 'text-rose-600',
  },
  {
    key: 'waived',
    label: 'Waived',
    color: '#8b5cf6',       // violet
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-100',
    amountColor: 'text-violet-600',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatKes = (amount = 0) => {
  const v = Number(amount) || 0;
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `KES ${Math.round(v / 1_000)}K`;
  return `KES ${v.toLocaleString()}`;
};

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────
const DonutChart = ({ data, total, animated }) => {
  const cx = 80;
  const cy = 80;
  const r = 60;
  const strokeW = 18;
  const circumference = 2 * Math.PI * r;
  const gap = 3; // gap between segments in degrees

  // Convert data to angle-based arcs
  let cumulativeAngle = -90; // start at top
  const arcs = data
    .filter(d => d.value > 0)
    .map(d => {
      const pct = total > 0 ? d.value / total : 0;
      const angleDeg = pct * 360 - gap;
      const startAngle = cumulativeAngle + gap / 2;
      const endAngle = startAngle + angleDeg;
      cumulativeAngle += pct * 360;

      // Convert to radians for path calculation
      const toRad = deg => (deg * Math.PI) / 180;
      const x1 = cx + r * Math.cos(toRad(startAngle));
      const y1 = cy + r * Math.sin(toRad(startAngle));
      const x2 = cx + r * Math.cos(toRad(endAngle));
      const y2 = cy + r * Math.sin(toRad(endAngle));
      const largeArc = angleDeg > 180 ? 1 : 0;

      return {
        ...d,
        path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        pct: Math.round(pct * 100),
        midAngle: startAngle + angleDeg / 2,
      };
    });

  // If total is 0, show empty ring
  if (total === 0 || arcs.length === 0) {
    return (
      <svg viewBox="0 0 160 160" className="w-full h-full">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">No data</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      <defs>
        {arcs.map(arc => (
          <filter key={`glow-${arc.key}`} id={`glow-${arc.key}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {/* Track ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />

      {/* Colored segments */}
      {arcs.map(arc => (
        <path
          key={arc.key}
          d={arc.path}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          filter={`url(#glow-${arc.key})`}
          style={{
            transition: animated ? 'stroke-dashoffset 1s ease-out' : 'none',
          }}
        />
      ))}

      {/* Percentage labels for large segments */}
      {arcs
        .filter(arc => arc.pct >= 10)
        .map(arc => {
          const toRad = deg => (deg * Math.PI) / 180;
          const labelR = r + strokeW / 2 + 10;
          const lx = cx + labelR * Math.cos(toRad(arc.midAngle));
          const ly = cy + labelR * Math.sin(toRad(arc.midAngle));
          return (
            <text
              key={`pct-${arc.key}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={arc.color}
              fontSize="8.5"
              fontWeight="800"
            >
              {arc.pct}%
            </text>
          );
        })}
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BillingInsightsCard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billing, setBilling] = useState(null);
  const [animated, setAnimated] = useState(false);
  const mountedRef = useRef(true);

  const fetchBillingStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await feeAPI.getPaymentStats();
      if (!mountedRef.current) return;

      if (res?.success && res?.data) {
        const d = res.data;
        setBilling({
          fullyPaid:     { count: d.fullyPaidCount    ?? d.fully_paid_count    ?? 0, amount: d.fullyPaidAmount    ?? d.fully_paid_amount    ?? 0 },
          partiallyPaid: { count: d.partiallyPaidCount ?? d.partially_paid_count ?? 0, amount: d.partiallyPaidAmount ?? d.partially_paid_amount ?? 0 },
          notPaid:       { count: d.notPaidCount       ?? d.not_paid_count       ?? 0, amount: d.notPaidAmount       ?? d.not_paid_amount       ?? 0 },
          waived:        { count: d.waivedCount        ?? d.waived_count         ?? 0, amount: d.waivedAmount        ?? d.waived_amount         ?? 0 },
          totalBilled:   d.totalBilled ?? d.total_billed ?? 0,
        });
        setTimeout(() => setAnimated(true), 100);
      } else {
        setError('Unable to load billing data');
      }
    } catch (err) {
      if (mountedRef.current) setError('Failed to fetch billing stats');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchBillingStats();
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build donut segments
  const chartData = SEGMENTS.map(s => ({
    key: s.key,
    color: s.color,
    value: billing?.[s.key]?.amount || 0,
  }));
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const totalBilled = billing?.totalBilled || total;

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="col-span-2 relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="flex gap-6 h-44">
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
          <div className="w-44 h-44 rounded-full bg-gray-100" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="col-span-2 relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]">
        <p className="text-xs text-gray-400 font-semibold">{error}</p>
        <button
          onClick={fetchBillingStats}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-purple hover:underline"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  // ── Card ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="col-span-2 relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onNavigate?.('fees-collection')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigate?.('fees-collection')}
    >
      <div className="flex flex-col sm:flex-row gap-0">

        {/* ── LEFT — Stats list ──────────────────────────────────────────── */}
        <div className="flex-1 p-5 flex flex-col justify-between min-h-[180px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 flex-shrink-0">
              <DollarSign size={14} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[11px] text-gray-500 tracking-widest uppercase">
              Billing Insights
            </span>
          </div>

          {/* 4 Data rows */}
          <div className="space-y-0 flex-1">
            {SEGMENTS.map((seg, idx) => {
              const data = billing?.[seg.key] || { count: 0, amount: 0 };
              return (
                <div
                  key={seg.key}
                  className={`flex items-center justify-between py-2.5 ${idx < SEGMENTS.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Color dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-gray-800 leading-tight">{seg.label}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{data.count.toLocaleString()} students</div>
                    </div>
                  </div>
                  <div className={`text-[13px] font-black ${seg.amountColor} flex-shrink-0 ml-3`}>
                    {formatKes(data.amount)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-gray-50">
            <span className="text-[10px] text-gray-400 font-medium">
              Total Billed: <span className="font-black text-gray-700">{formatKes(totalBilled)}</span>
              &nbsp;·&nbsp;Click to view details
            </span>
          </div>
        </div>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div className="hidden sm:block w-px bg-gray-50 self-stretch my-4" />

        {/* ── RIGHT — Donut chart ────────────────────────────────────────── */}
        <div className="flex items-center justify-center p-5 sm:w-52">
          <div className="relative w-40 h-40">
            <DonutChart data={chartData} total={total} animated={animated} />
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[15px] font-black text-gray-800 leading-tight">{formatKes(totalBilled)}</span>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Total Billed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingInsightsCard;
