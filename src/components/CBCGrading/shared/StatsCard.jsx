/**
 * Stats Card Component
 * Display statistics in a card
 */

import React from 'react';
import AskAIButton from '../../help/AskAIButton';
import { KpiCard } from '../../../design-system/components';

const StatsCard = ({ 
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
  className = '',
  askAI = true,
  aiContext,
}) => {
  const tone = { blue: 'sky', green: 'emerald', purple: 'violet', orange: 'amber', red: 'rose', indigo: 'indigo' }[color] || 'sky';
  return <KpiCard label={title} value={value} subvalue={subtitle} icon={Icon ? <Icon size={20} /> : null} accessory={askAI ? <AskAIButton title={title} description={subtitle} context={aiContext || { value, trend }} /> : null} tone={tone} orbPosition="top-right" className={className} trend={typeof trend === 'object' ? trend : undefined} />;
};

export default StatsCard;
