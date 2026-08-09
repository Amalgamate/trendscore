/**
 * Stats Card Component
 * Display statistics in a card
 */

import React from 'react';
import AskAIButton from '../../help/AskAIButton';

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
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-brand-purple/10 text-brand-purple border-brand-purple/10',
    orange: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100'
  };

  const accentClass = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`surface-panel surface-panel-interactive p-5 ${className}`} data-ai-card="true" data-ai-title={title}>
      <div className="mb-4 flex items-start justify-between gap-4">
        {Icon && (
          <div className={`flex h-11 w-11 items-center justify-center border ${accentClass}`}>
            <Icon size={20} />
          </div>
        )}
        <div className="flex flex-col items-end gap-2">
          {askAI && <AskAIButton title={title} description={subtitle} context={aiContext || { value, trend }} />}
          <span className="text-3xl font-semibold text-slate-900">{value}</span>
        </div>
      </div>
      
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
        {trend && (
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
