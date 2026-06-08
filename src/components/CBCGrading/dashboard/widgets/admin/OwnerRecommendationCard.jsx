/**
 * OwnerRecommendationCard
 * Dashboard Components › OwnerRecommendationCard
 *
 * Reusable AI-advisor recommendation card used across:
 *   - School Owner Dashboard
 *   - Head Teacher Dashboard
 *   - Accountant Dashboard
 *   - Super Admin Dashboard
 *
 * @typedef {Object} OwnerRecommendation
 * @property {string}  id
 * @property {string}  type
 * @property {string}  title
 * @property {string}  description
 * @property {string}  actionLabel
 * @property {string}  actionRoute
 * @property {'high'|'medium'|'low'} priority
 * @property {React.ComponentType} icon   — Lucide icon component
 * @property {'red'|'orange'|'blue'|'green'} color
 */

import React from 'react';

/** Map colour key → Tailwind classes using only existing palette tokens */
const COLOR_MAP = {
  red: {
    iconBg:    'bg-rose-100',
    iconText:  'text-rose-600',
    border:    'border-rose-200',
    btnBorder: 'border-rose-500',
    btnText:   'text-rose-600',
    btnHover:  'hover:bg-rose-50',
  },
  orange: {
    iconBg:    'bg-orange-100',
    iconText:  'text-orange-600',
    border:    'border-orange-200',
    btnBorder: 'border-orange-500',
    btnText:   'text-orange-600',
    btnHover:  'hover:bg-orange-50',
  },
  blue: {
    iconBg:    'bg-blue-100',
    iconText:  'text-blue-600',
    border:    'border-blue-200',
    btnBorder: 'border-blue-500',
    btnText:   'text-blue-600',
    btnHover:  'hover:bg-blue-50',
  },
  green: {
    iconBg:    'bg-emerald-100',
    iconText:  'text-emerald-600',
    border:    'border-emerald-200',
    btnBorder: 'border-emerald-500',
    btnText:   'text-emerald-600',
    btnHover:  'hover:bg-emerald-50',
  },
};

/**
 * OwnerRecommendationCard
 *
 * @param {Object}  props
 * @param {OwnerRecommendation} props.recommendation
 * @param {Function} [props.onAction]   — called with (actionRoute) on button click
 * @param {boolean}  [props.loading]
 */
const OwnerRecommendationCard = ({ recommendation, onAction, loading = false }) => {
  const {
    title,
    description,
    actionLabel,
    actionRoute,
    icon: Icon,
    color = 'blue',
  } = recommendation;

  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-8 w-32 rounded-lg bg-gray-100 mt-auto" />
      </div>
    );
  }

  return (
    <article
      className={`group flex flex-col gap-3 rounded-xl border ${c.border} bg-white p-4 shadow-sm
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-400`}
    >
      {/* ── Top: icon + title ── */}
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.iconBg} ${c.iconText}`}>
          {Icon && <Icon size={18} strokeWidth={2} />}
        </span>
        <h3 className="text-sm font-bold text-gray-900 leading-snug">{title}</h3>
      </div>

      {/* ── Middle: description ── */}
      <p className="text-xs text-gray-500 leading-relaxed flex-1">{description}</p>

      {/* ── Bottom: action button ── */}
      <button
        type="button"
        onClick={() => onAction?.(actionRoute)}
        className={`mt-auto self-start rounded-lg border ${c.btnBorder} ${c.btnText} ${c.btnHover}
          px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current`}
        aria-label={`${actionLabel} — ${title}`}
      >
        {actionLabel}
      </button>
    </article>
  );
};

export default OwnerRecommendationCard;
