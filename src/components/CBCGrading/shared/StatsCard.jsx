/**
 * StatsCard — Global Shared Component
 *
 * A clean, rounded stat card used across the entire app.
 * Replaces the old flat solid-color block cards.
 *
 * Props:
 *   label        {string}         — Small caps label above the value
 *   value        {string|number}  — Primary large metric value
 *   sub          {string}         — Smaller detail text below the value
 *   icon         {LucideIcon}     — Icon component (from lucide-react)
 *   accent       {string}         — Tailwind bg class, e.g. 'bg-slate-900'
 *   progress     {number}         — Optional 0–100 progress bar value
 *   progressColor{string}         — Optional CSS color for the progress fill
 *   onClick      {function}       — Optional click handler (renders as <button>)
 *   className    {string}         — Optional extra Tailwind classes
 */

import React from 'react';

export const CARD_ACCENTS = {
  navy:    { bg: 'bg-blue-700',   icon: 'text-white' },
  violet:  { bg: 'bg-violet-900',  icon: 'text-white' },
  emerald: { bg: 'bg-emerald-800', icon: 'text-white' },
  amber:   { bg: 'bg-rose-600',   icon: 'text-white' },
};

const StatsCard = ({
  label,
  value,
  sub,
  // legacy aliases used in older callers
  detail,
  helper,
  icon: Icon,
  accent = 'bg-blue-700',
  progress,
  progressColor,
  onClick,
  className = '',
}) => {
  const subText = sub ?? detail ?? helper;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-sm select-none ${accent} ${onClick ? 'transition-opacity active:opacity-80 focus:outline-none' : ''} ${className}`}
    >
      {/* Watermark icon */}
      {Icon && (
        <div className="pointer-events-none absolute -bottom-3 -right-3 opacity-[0.12]">
          <Icon size={72} />
        </div>
      )}

      {/* Header row: label + icon badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 leading-none">
          {label}
        </p>
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Icon size={14} className="text-white" />
          </div>
        )}
      </div>

      {/* Primary value */}
      <p className="mt-2 text-3xl font-black tracking-tight leading-none">
        {value ?? '—'}
      </p>

      {/* Sub text */}
      {subText && (
        <p className="mt-1.5 text-[11px] font-medium text-white/65 leading-snug">
          {subText}
        </p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: progressColor || 'rgba(255,255,255,0.85)',
            }}
          />
        </div>
      )}
    </Tag>
  );
};

export { StatsCard, StatsCard as StatCard };
export default StatsCard;
