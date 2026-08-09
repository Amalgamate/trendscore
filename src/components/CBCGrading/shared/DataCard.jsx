import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';
import AskAIButton from '../../help/AskAIButton';

/**
 * DataCard Component
 * A premium, mobile-first card for displaying list items.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Leading icon or avatar
 * @param {string} props.title - Primary text
 * @param {string} props.subtitle - Secondary text
 * @param {React.ReactNode} props.badges - Array of badges or status components
 * @param {React.ReactNode} props.actions - Action buttons (circular icons)
 * @param {Object} props.stats - Key-value pairs for quick metrics
 * @param {Function} props.onClick - Card click handler
 * @param {string} props.className - Additional classes
 */
const DataCard = ({
  icon,
  title,
  subtitle,
  badges,
  actions,
  stats,
  onClick,
  className,
  askAI = true,
  aiContext,
}) => {
  return (
    <div
      onClick={onClick}
      data-ai-card="true"
      data-ai-title={title}
      className={cn(
        "surface-panel surface-panel-interactive p-5 cursor-pointer transition-transform active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Leading Icon/Avatar */}
          {icon && (
            <div className="flex-shrink-0">
              {icon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action Indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {askAI && <AskAIButton title={title} description={subtitle} context={aiContext || stats} />}
          {badges}
          {!actions && onClick && <ChevronRight size={18} className="text-gray-300" />}
        </div>
      </div>

      {/* Stats Row */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-2 gap-4">
          {Object.entries(stats).map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">{label}</span>
              <span className="truncate text-xs font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Actions Row */}
      {actions && (
        <div className="mt-5 flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default DataCard;
