/**
 * OwnerRecommendationCard
 *
 * Solid-color background card for the Personal Advisor carousel.
 * Color is driven by severity/priority:
 *   critical → deep red     (#B91C1C)
 *   high     → strong red   (#C62828)
 *   warning  → amber/orange (#B45309)
 *   positive → forest green (#1B5E20)
 *   info     → navy blue    (#1E3A5F)
 *   default  → slate        (#1E293B)
 */

import React from 'react';
import AskAIButton from '../../../../help/AskAIButton';

const BG_COLORS = {
  // severity-based
  critical: '#7F1D1D',   // deep red
  high:     '#C62828',   // strong red
  warning:  '#92400E',   // amber
  positive: '#14532D',   // forest green
  info:     '#1E3A5F',   // navy
  // priority aliases
  medium:   '#92400E',
  low:      '#1E3A5F',
};

const getBg = (rec) => {
  if (rec.severity) return BG_COLORS[rec.severity] ?? BG_COLORS.info;
  if (rec.priority === 'high')   return BG_COLORS.high;
  if (rec.priority === 'medium') return BG_COLORS.warning;
  return BG_COLORS.low;
};

const OwnerRecommendationCard = ({ recommendation, onAction, loading = false }) => {
  const {
    title,
    description,
    actionLabel,
    actionRoute,
    icon: Icon,
  } = recommendation;

  const bg = getBg(recommendation);

  if (loading) {
    return (
      <div className="flex-shrink-0 w-72 flex flex-col gap-3 rounded-xl bg-gray-200 p-4 animate-pulse h-full">
        <div className="h-4 w-3/4 rounded bg-gray-300" />
        <div className="h-3 w-full rounded bg-gray-300" />
        <div className="h-3 w-2/3 rounded bg-gray-300" />
        <div className="h-8 w-28 rounded-lg bg-gray-300 mt-auto" />
      </div>
    );
  }

  return (
    <article
      data-ai-card="true"
      data-ai-title={title}
      className="flex-shrink-0 w-72 flex flex-col gap-3 rounded-xl p-4 text-white
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl select-none"
      style={{ backgroundColor: bg }}
    >
      {/* icon + title */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 border border-white/30">
          {Icon && <Icon size={17} strokeWidth={2} className="text-white" />}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-bold text-white leading-snug">{title}</h3>
        <AskAIButton title={title} description={description} context={recommendation} variant="light" />
      </div>

      {/* description */}
      <p className="text-xs text-white/80 leading-relaxed flex-1">{description}</p>

      {/* action button */}
      <button
        type="button"
        onClick={() => onAction?.(actionRoute)}
        className="mt-auto self-start rounded-lg border border-white/40 bg-white/15
          px-3 py-1.5 text-xs font-semibold text-white
          hover:bg-white/25 active:bg-white/30 transition-colors
          focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label={`${actionLabel} — ${title}`}
      >
        {actionLabel}
      </button>
    </article>
  );
};

export default OwnerRecommendationCard;
