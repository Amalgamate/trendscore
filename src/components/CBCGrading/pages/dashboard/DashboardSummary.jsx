import React from 'react';

const PALETTES = {
  blue: 'from-blue-500 to-blue-700',
  indigo: 'from-indigo-600 to-indigo-800',
  purple: 'from-purple-500 to-violet-700',
  emerald: 'from-emerald-500 to-emerald-700',
  teal: 'from-teal-500 to-emerald-700',
  amber: 'from-amber-400 to-orange-600',
  orange: 'from-orange-400 to-orange-600',
  rose: 'from-rose-500 to-rose-700',
  slate: 'from-slate-600 to-slate-800',
};

const ICON_COLORS = {
  blue: 'text-blue-600',
  indigo: 'text-indigo-600',
  purple: 'text-violet-600',
  emerald: 'text-emerald-600',
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  orange: 'text-orange-600',
  rose: 'text-rose-600',
  slate: 'text-slate-600',
};

export const DashboardSectionTitle = ({ title, description }) => (
  <div className="border-b border-slate-200 pb-4">
    <h2 className="text-base font-extrabold tracking-tight text-brand-purple">{title}</h2>
    {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
  </div>
);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getDisplayName = (user, fallback = 'SYSTEM') => {
  const rawName = user?.name || user?.firstName || user?.email?.split('@')[0] || fallback;
  return String(rawName).trim().split(' ')[0] || fallback;
};

export const DashboardGreetingBanner = ({
  user,
  fallbackName = 'SYSTEM',
  description = 'Welcome back to the Trends command center. Here is your institutional summary overview for today.',
}) => (
  <section className="border-b border-slate-200 bg-transparent px-1 py-3">
    <h1 className="text-xl font-black leading-tight tracking-tight text-slate-950 md:text-2xl">
      {getGreeting()}, <span>{getDisplayName(user, fallbackName)}</span>
    </h1>
    <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-slate-500 md:text-sm">
      {description}
    </p>
  </section>
);

export const DashboardSummaryCard = ({
  label,
  value,
  subvalue,
  icon,
  tone = 'blue',
  onClick,
}) => {
  const content = (
    <>
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-white/70">{label}</p>
            <p className="mt-5 text-4xl font-black leading-none tracking-tight text-slate-950">{value}</p>
          </div>
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-sm ring-1 ring-white/40 ${ICON_COLORS[tone] || ICON_COLORS.blue}`}>
            {React.isValidElement(icon) ? React.cloneElement(icon, { size: 21, strokeWidth: 2.4 }) : icon}
          </span>
        </div>

        {subvalue && (
          <p className="mt-4 truncate text-sm font-extrabold text-white/85">
            {subvalue}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute -right-7 top-1/2 -translate-y-1/2 text-white/20 mix-blend-soft-light">
        {React.isValidElement(icon) && React.cloneElement(icon, { size: 92, strokeWidth: 1.4 })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/10" />
    </>
  );

  const className = `relative min-h-[96px] overflow-hidden rounded-2xl bg-gradient-to-br ${PALETTES[tone] || PALETTES.blue} p-5 text-white shadow-sm ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-lg`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

const DashboardSummary = ({ title = 'Executive Summary', description, items = [], showHeader = true }) => (
  <section className="space-y-6">
    {showHeader && <DashboardSectionTitle title={title} description={description} />}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardSummaryCard key={item.label} {...item} />
      ))}
    </div>
  </section>
);

export default DashboardSummary;
