/**
 * CompactMetricBanner
 * Wraps DashboardSummary with a 4-card layout.
 * Passes chips, trend, and subvalue through from the metric definition.
 */

import React from 'react';
import DashboardSummary from './DashboardSummary';

const TONES = ['navy', 'teal', 'red', 'green'];

const CompactMetricBanner = ({ metrics }) => (
  <DashboardSummary
    title="Executive Summary"
    description="Front desk operating snapshot."
    items={metrics.map((metric, index) => {
      const Icon = metric.icon;
      return {
        label:      metric.title,
        value:      metric.value,
        subvalue:   metric.subvalue ?? metric.subtitle,
        chips:      metric.chips,
        trend:      metric.trend,
        trendValue: metric.trendValue,
        icon:       <Icon size={26} />,
        tone:       metric.tone ?? TONES[index] ?? 'navy',
        onClick:    metric.onClick,
      };
    })}
  />
);

export default CompactMetricBanner;
