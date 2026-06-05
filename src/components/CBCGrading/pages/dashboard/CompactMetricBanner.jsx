/**
 * Compact Metric Banner Component
 * Display metrics in a horizontal gradient banner to save vertical space
 * Premium styling with hover effects and smooth animations
 */

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import DashboardSummary from './DashboardSummary';

const CompactMetricBanner = ({ metrics }) => {
  const tones = ['indigo', 'purple', 'teal', 'orange'];

  return (
    <DashboardSummary
      title="Executive Summary"
      description="Front desk operating snapshot."
      items={metrics.map((metric, index) => {
        const Icon = metric.icon;
        return {
          label: metric.title,
          value: metric.value,
          subvalue: metric.trendValue ? (
            <span className="inline-flex items-center gap-1">
              {metric.trend === 'up' ? <ArrowUp size={13} strokeWidth={3} /> : <ArrowDown size={13} strokeWidth={3} />}
              {metric.trendValue}
            </span>
          ) : metric.subtitle,
          icon: <Icon size={26} />,
          tone: tones[index] || 'indigo',
          onClick: metric.onClick,
        };
      })}
    />
  );
};

export default CompactMetricBanner;

