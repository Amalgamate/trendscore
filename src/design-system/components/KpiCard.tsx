import React from 'react';

export type KpiTone = 'indigo' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';
export type KpiOrbPosition = 'top-right' | 'bottom-right' | 'top-center' | 'bottom-left' | 'bottom-center' | 'top-left';

interface KpiCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: React.ReactNode;
  accessory?: React.ReactNode;
  trend?: { value: number; isPositive: boolean; label?: string };
  /** Legacy semantic variants. Prefer tone in new screens. */
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  tone?: KpiTone;
  orbPosition?: KpiOrbPosition;
  onClick?: () => void;
  className?: string;
  layout?: 'horizontal' | 'vertical';
}

const PALETTES: Record<KpiTone, { background: string; border: string }> = {
  indigo: { background: '#4f46e5', border: '#6366f1' },
  sky: { background: '#078bc4', border: '#0ea5e9' },
  violet: { background: '#7c36e7', border: '#8b5cf6' },
  emerald: { background: '#079b72', border: '#10b981' },
  amber: { background: '#f59e0b', border: '#fbbf24' },
  rose: { background: '#e91e50', border: '#f43f5e' },
};

const LEGACY_TONES: Record<NonNullable<KpiCardProps['variant']>, KpiTone> = {
  primary: 'indigo', success: 'emerald', warning: 'amber', error: 'rose', neutral: 'sky',
};

const ORB_POSITIONS: Record<KpiOrbPosition, React.CSSProperties> = {
  'top-right': { right: '-2.5rem', top: '-3rem' },
  'bottom-right': { right: '-2.75rem', bottom: '-3.5rem' },
  'top-center': { left: '50%', top: '-3.25rem', transform: 'translateX(-50%)' },
  'bottom-left': { bottom: '-3.25rem', left: '-2.5rem' },
  'bottom-center': { bottom: '-4rem', left: '36%' },
  'top-left': { top: '-2.75rem', left: '-2.75rem' },
};

/** The shared source of truth for all dashboard metrics and KPI summaries. */
export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, subvalue, icon, accessory, trend, variant = 'primary', tone, orbPosition = 'top-right', onClick, className = '', layout = 'vertical',
}) => {
  const palette = PALETTES[tone || LEGACY_TONES[variant]];
  const content = (
    <>
      <span aria-hidden="true" style={{ ...ORB_POSITIONS[orbPosition], backgroundColor: 'rgba(255,255,255,0.16)' }} className="pointer-events-none absolute h-36 w-36 rounded-full" />
      <div className={`relative flex gap-3 ${layout === 'horizontal' ? 'items-center' : 'items-start'} justify-between`}>
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.12em] text-white/80">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <strong className="text-3xl font-black leading-none tracking-tight text-white">{value}</strong>
            {subvalue && <span className="text-xs font-semibold text-white/80">{subvalue}</span>}
          </div>
        </div>
        {(icon || accessory) && <div className="flex shrink-0 flex-col items-end gap-2">{icon && <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/25 bg-white/15 text-white shadow-lg">{icon}</span>}{accessory}</div>}
      </div>
      {trend && <span className="relative mt-4 inline-flex text-[10px] font-black uppercase tracking-wider text-white/85">{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%{trend.label ? ` · ${trend.label}` : ''}</span>}
    </>
  );

  const classes = `relative block min-h-[8.25rem] overflow-hidden rounded-xl border p-5 text-left transition duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2' : ''} ${className}`;
  const style: React.CSSProperties = { backgroundColor: palette.background, borderColor: palette.border, color: '#fff' };
  return onClick ? <button type="button" title={`Open ${label}`} onClick={onClick} className={classes} style={style}>{content}</button> : <div className={classes} style={style}>{content}</div>;
};
