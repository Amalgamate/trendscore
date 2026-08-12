/**
 * AssessmentStatsCard Component
 * Reusable statistics display card for assessment metrics
 */

import React from 'react';
import { KpiCard } from '../../../design-system/components';

/**
 * Stats card for displaying assessment metrics
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - Card label/title
 * @param {string|number} props.value - Main value to display
 * @param {string} props.subtitle - Optional subtitle
 * @param {string} props.color - Color theme (green, blue, yellow, red, purple)
 * @param {string} props.icon - Optional icon component or emoji
 * @param {boolean} props.highlight - Highlight the card
 * @returns {JSX.Element}
 */
export const AssessmentStatsCard = ({
  label,
  value,
  subtitle,
  color = 'blue',
  icon = null,
  highlight = false
}) => {
  const tone = { green: 'emerald', blue: 'sky', yellow: 'amber', red: 'rose', purple: 'violet', gray: 'indigo' }[color] || 'sky';
  return <KpiCard label={label} value={value} subvalue={subtitle} icon={icon} tone={tone} orbPosition="bottom-right" className={highlight ? 'ring-2 ring-offset-2 ring-blue-500' : ''} />;
};

export default AssessmentStatsCard;
