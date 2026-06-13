/**
 * FinanceIntelligenceSection
 * Dashboard Sections › FinanceIntelligenceSection
 *
 * "FINANCE INTELLIGENCE" panel for the fee collection summary chart.
 */

import React from 'react';
import { BarChart2 } from 'lucide-react';
import FeeCollectionDonut from './FeeCollectionDonut';

/**
 * FinanceIntelligenceSection
 *
 * @param {Object}   props
 * @param {number}   [props.collected]
 * @param {number}   [props.outstanding]
 * @param {number}   [props.waived]
 * @param {boolean}  [props.loading]
 * @param {Function} [props.onNavigate]
 */
const FinanceIntelligenceSection = ({
  collected   = 0,
  outstanding = 0,
  waived      = 0,
  loading     = false,
  onNavigate,
}) => (
  <section aria-label="Finance Intelligence" className="h-full space-y-3">

    {/* ── Section heading ── */}
    <div className="flex items-center gap-2">
      <BarChart2 size={14} className="text-brand-purple shrink-0" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
        Finance Intelligence
      </p>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
        — Fee collection summary.
      </span>
    </div>

    <div className="h-[calc(100%-2rem)]">
      <FeeCollectionDonut
        collected={collected}
        outstanding={outstanding}
        waived={waived}
        loading={loading}
        onNavigate={onNavigate}
      />
    </div>
  </section>
);

export default FinanceIntelligenceSection;
