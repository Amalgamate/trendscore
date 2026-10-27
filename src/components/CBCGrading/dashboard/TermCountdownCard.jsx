/**
 * TermCountdownCard
 *
 * Compact, role-aware strip showing term progress, the next key dates, and a
 * fee deadline where the role is allowed to see one. Mounted once in
 * RoleDashboard so every role, institution type and the mobile shell get it.
 *
 * Data: GET /api/dashboard/key-dates (server computes day counts in school time).
 * Live: refetches on the `keydates:changed` socket event (planner events or term
 * config changed), when the tab regains focus, when the school-local day rolls
 * over, and every 5 minutes as a safety net.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AlertCircle, CalendarDays, Coffee, Flag, Pencil, Wallet } from 'lucide-react';
import { dashboardAPI } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthItem } from '../../../utils/authStorage';

const KEY_DATES_CHANGED_EVENT = 'keydates:changed';
const POLL_MS = 5 * 60 * 1000;
const DAY_TICK_MS = 60 * 1000;
const REFETCH_DEBOUNCE_MS = 400;

const KIND_ICON = {
  TERM_OPENING: CalendarDays,
  TERM_CLOSING: Flag,
  EXAM_WEEK: Pencil,
  EXAM: Pencil,
  MIDTERM_BREAK: Coffee,
  HOLIDAY: Coffee,
};

const KIND_TONE = {
  TERM_OPENING: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  TERM_CLOSING: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  EXAM_WEEK: 'bg-amber-50 text-amber-700 border-amber-100',
  EXAM: 'bg-amber-50 text-amber-700 border-amber-100',
  MIDTERM_BREAK: 'bg-sky-50 text-sky-700 border-sky-100',
  HOLIDAY: 'bg-sky-50 text-sky-700 border-sky-100',
};

const schoolDayKey = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const whenText = (days) => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${plural(days, 'day')}`;
};

const itemWhen = (item) => {
  if (item.state === 'ongoing') {
    if (item.daysUntilEnd === 0) return 'ends today';
    return `ends in ${plural(item.daysUntilEnd, 'day')}`;
  }
  return whenText(item.daysUntil);
};

const formatKsh = (value) => `KES ${Math.round(Number(value) || 0).toLocaleString('en-KE')}`;

function Chip({ Icon, tone, label, when, title }) {
  return (
    <span
      title={title}
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      <Icon size={13} aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
      <span className="whitespace-nowrap font-bold">{when}</span>
    </span>
  );
}

function TermBlock({ term }) {
  if (term.state === 'in_term') {
    return (
      <div className="min-w-[150px]">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-extrabold text-slate-900">{term.label}</span>
          <span className="text-xs font-medium text-slate-500">
            Day {term.dayNumber} of {term.totalDays}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={term.progressPct}
          aria-label={`${term.label} progress`}
        >
          <div className="h-full rounded-full bg-brand-purple" style={{ width: `${term.progressPct}%` }} />
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{plural(term.daysLeft, 'day')} left</p>
      </div>
    );
  }
  if (term.state === 'break') {
    return (
      <div className="min-w-[150px]">
        <span className="text-sm font-extrabold text-slate-900">{term.label}</span>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          {term.daysToOpen === 0 ? 'Opens today' : `Opens ${whenText(term.daysToOpen)}`}
        </p>
      </div>
    );
  }
  return null;
}

function FeeChip({ fee }) {
  if (!fee) return null;
  const overdue = fee.daysUntilDue !== null && fee.daysUntilDue < 0;
  const scopeText = fee.scope === 'family' ? 'Fees' : 'Fees due';
  const when = fee.nextDueDate === null
    ? formatKsh(fee.outstandingKsh)
    : overdue
      ? `overdue ${plural(Math.abs(fee.daysUntilDue), 'day')}`
      : whenText(fee.daysUntilDue);
  const tone = overdue
    ? 'bg-rose-50 text-rose-700 border-rose-100'
    : 'bg-violet-50 text-violet-700 border-violet-100';
  const title = [
    `${formatKsh(fee.outstandingKsh)} outstanding across ${plural(fee.invoiceCount, 'invoice')}`,
    fee.overdueCount ? `${fee.overdueCount} overdue` : null,
  ].filter(Boolean).join(' · ');
  return <Chip Icon={overdue ? AlertCircle : Wallet} tone={tone} label={scopeText} when={when} title={title} />;
}

export default function TermCountdownCard({ className = '' }) {
  const { isAuthenticated, user } = useAuth();
  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await dashboardAPI.getKeyDates();
      if (res?.success && res.data) {
        dataRef.current = res.data;
        setData(res.data);
      }
    } catch {
      // Keep whatever we last showed; the card is informational.
    }
  }, []);

  const scheduleLoad = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, REFETCH_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    load();

    const socket = io(window.location.origin, {
      withCredentials: true,
      auth: { token: getAuthItem('token') },
    });
    socket.on(KEY_DATES_CHANGED_EVENT, scheduleLoad);

    const poll = setInterval(load, POLL_MS);
    const dayTick = setInterval(() => {
      const current = dataRef.current;
      if (current?.timeZone && schoolDayKey(current.timeZone) !== current.today) load();
    }, DAY_TICK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(debounceRef.current);
      clearInterval(poll);
      clearInterval(dayTick);
      document.removeEventListener('visibilitychange', onVisible);
      socket.off(KEY_DATES_CHANGED_EVENT, scheduleLoad);
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id, load, scheduleLoad]);

  if (!data) return null;
  const { term, items = [], fee } = data;
  if (term?.state === 'none' && !items.length && !fee) return null;

  return (
    <section
      aria-label="Term countdown"
      className={`mb-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm sm:flex-row sm:items-center ${className}`}
    >
      {term && <TermBlock term={term} />}
      <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:justify-end">
        {items.slice(0, 3).map((item) => {
          const Icon = KIND_ICON[item.kind] || CalendarDays;
          return (
            <Chip
              key={item.key}
              Icon={Icon}
              tone={KIND_TONE[item.kind] || 'bg-slate-50 text-slate-700 border-slate-100'}
              label={item.label}
              when={itemWhen(item)}
              title={item.date === item.endDate ? item.date : `${item.date} → ${item.endDate}`}
            />
          );
        })}
        <FeeChip fee={fee} />
      </div>
    </section>
  );
}
