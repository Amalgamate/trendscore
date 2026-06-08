/**
 * FinanceIntelligenceSection
 * Dashboard Sections › FinanceIntelligenceSection
 *
 * "FINANCE INTELLIGENCE" panel — placed directly below the Personal Advisor section.
 *
 * Layout:
 *   Desktop  → 35% / 65% two-column (FeeCollectionDonut | FeeCollectionTrend)
 *   Tablet   → stacked vertically
 *   Mobile   → stacked vertically
 */

import React from 'react';
import { BarChart2 } from 'lucide-react';
import FeeCollectionDonut from './FeeCollectionDonut';
import FeeCollectionTrend from './FeeCollectionTrend';

/**
 * FinanceIntelligenceSection
 *
 * @param {Object}   props
 * @param {number}   [props.collected]
 * @param {number}   [props.outstanding]
 * @param {number}   [props.waived]
 * @param {Array}    [props.trendData]    — [{month, collected, outstanding, expected}]
 * @param {boolean}  [props.loading]
 * @param {Function} [props.onNavigate]
 */
const FinanceIntelligenceSection = ({
  collected   = 0,
  outstanding = 0,
  waived      = 0,
  trendData,
  loading     = false,
  onNavigate,
}) => (
  <section aria-label="Finance Intelligence" className="space-y-3">

    {/* ── Section heading ── */}
    <div className="flex items-center gap-2">
      <BarChart2 size={14} className="text-brand-purple shrink-0" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
        Finance Intelligence
      </p>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
        — Revenue performance and collection trends.
      </span>
    </div>

    {/* ── Two-column grid ── */}
    {/*
      Desktop: 35% left (donut) / 65% right (trend)
      Using CSS grid with custom column sizes via inline style so we don't
      need to add a new Tailwind arbitrary value.
    */}
    <div
      className="grid grid-cols-1 lg:grid-cols-[35fr_65fr] gap-4 items-start"
    >
      {/* Left — Donut */}
      <FeeCollectionDonut
        collected={collected}
        outstanding={outstanding}
        waived={waived}
        loading={loading}
        onNavigate={onNavigate}
      />

      {/* Right — Trend */}
      <FeeCollectionTrend
        trendData={trendData}
        loading={loading}
        onNavigate={onNavigate}
      />
    </div>
  </section>
);

export default FinanceIntelligenceSection;
