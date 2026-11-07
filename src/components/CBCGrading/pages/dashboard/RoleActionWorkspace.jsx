import React from 'react';
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return ['Good morning', '☀️'];
  if (hour < 17) return ['Good afternoon', '🌤️'];
  return ['Good evening', '🌙'];
};

const displayName = (user) => String(user?.firstName || user?.first_name || user?.name || user?.email?.split('@')[0] || 'there').trim().split(/\s+/)[0];

export default function RoleActionWorkspace({
  title,
  user,
  onNavigate,
  icon: HeaderIcon,
  prompt = 'What would you like to do?',
  actions = [],
  snapshots = [],
  loading = false,
  error = '',
  onRetry,
  emptyMessage = 'No actions are available for this account.',
}) {
  const [salutation, emoji] = greeting();
  return <main className="min-h-[calc(100vh-80px)] bg-[#f6f8fc] px-3 py-4 pb-24 text-slate-950 sm:px-5 lg:px-8 lg:pb-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          {HeaderIcon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-white"><HeaderIcon size={21} /></span>}
          <div className="min-w-0 flex-1"><p className="text-xs font-bold text-indigo-800">{title}</p><h1 className="text-lg font-black tracking-tight">{emoji} {salutation}, {displayName(user)}</h1></div>
          {loading && <Loader2 size={17} className="animate-spin text-indigo-800" aria-label="Loading overview" />}
        </div>
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">{prompt}</p>
      </header>

      {snapshots.length > 0 && <section aria-label="Quick overview" className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {snapshots.slice(0, 3).map(({ label, value, icon: Icon, color }) => <div key={label} className="flex min-w-0 items-center gap-2 px-2.5 py-3 sm:gap-3 sm:px-4">
          {Icon && <Icon size={17} className={`shrink-0 ${color || 'text-indigo-700'}`} />}
          <div className="min-w-0"><p className="truncate text-[10px] font-semibold text-slate-600 sm:text-xs">{label}</p><p className={`truncate font-black text-slate-950 ${String(value).length > 9 ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>{value}</p></div>
        </div>)}
      </section>}

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-950" role="alert"><AlertCircle size={17} /><span className="flex-1">{error}</span>{onRetry && <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-2.5 font-bold text-rose-900"><RefreshCw size={14} /> Retry</button>}</div>}

      <nav aria-label={`${title} actions`} className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent">
        {actions.map(({ page, label, detail, icon: Icon, color }) => <button key={page} type="button" onClick={() => onNavigate?.(page)} className="flex min-h-[66px] w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-800 lg:min-h-[72px] lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:px-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${color}`}><Icon size={20} strokeWidth={2.2} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-950">{label}</span><span className="mt-0.5 block text-xs text-slate-600">{detail}</span></span>
          <ArrowRight size={18} className="shrink-0 text-slate-500" />
        </button>)}
        {!actions.length && <p className="p-4 text-sm text-slate-700">{emptyMessage}</p>}
      </nav>
    </div>
  </main>;
}
