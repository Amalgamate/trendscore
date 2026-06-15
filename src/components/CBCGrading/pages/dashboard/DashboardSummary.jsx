import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Clock, Loader2, Wifi, WifiOff, X } from 'lucide-react';
import { hrAPI } from '../../../../services/api';
import { syncCurrentUserClockInStatus } from '../../../../utils/teacherClockIn';

/**
 * Flat solid-color palette — exact colors from the receptionist dashboard screenshot.
 *
 *  navy   #1a2e4a  — deep navy   (Enrollment / Total Students)
 *  teal   #00796B  — rich teal   (Faculty / Teaching Staff)
 *  red    #C62828  — strong red  (Units / Un-Assessed)
 *  green  #1B5E20  — forest grn  (Performance / Assessed Classes)
 *
 * No gradients. Every card is a single solid hex.
 */
const SOLID_COLORS = {
  navy:    '#172554',
  teal:    '#0F766E',
  red:     '#C62828',
  green:   '#1B5E20',
  // aliases so any legacy tone name still resolves
  blue:    '#172554',
  indigo:  '#172554',
  purple:  '#172554',
  violet:  '#172554',
  emerald: '#1B5E20',
  amber:   '#B45309',
  orange:  '#C2410C',
  rose:    '#9F1239',
  slate:   '#1E293B',
  cyan:    '#006064',
};

/* ─── Section title ──────────────────────────────────────────────────────── */

export const DashboardSectionTitle = ({ title, description }) => (
  <div className="border-b border-slate-200 pb-4">
    <h2 className="text-base font-extrabold tracking-tight text-brand-purple">{title}</h2>
    {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
  </div>
);

/* ─── Greeting banner ─────────────────────────────────────────────────────── */

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const getDisplayName = (user, fallback = 'SYSTEM') => {
  const raw = user?.name || user?.firstName || user?.email?.split('@')[0] || fallback;
  return String(raw).trim().split(' ')[0] || fallback;
};

const CLOCK_IN_EXCLUDED_ROLES = new Set(['PARENT', 'STUDENT']);

const canUseClockIn = (user) => {
  const role = String(user?.role || '').toUpperCase();
  return !!user && !!role && !CLOCK_IN_EXCLUDED_ROLES.has(role);
};

const DesktopClockInButton = ({ user }) => {
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const nextStatus = await syncCurrentUserClockInStatus(user);
      if (active) {
        setStatus(nextStatus);
        setStatusLoaded(true);
      }
    };
    refresh();
    const handleClockChange = () => refresh();
    window.addEventListener('teacherClockInChanged', handleClockChange);
    window.addEventListener('storage', handleClockChange);
    return () => {
      active = false;
      window.removeEventListener('teacherClockInChanged', handleClockChange);
      window.removeEventListener('storage', handleClockChange);
    };
  }, [user]);

  const handleClockAction = async () => {
    if (submitting || !statusLoaded) return;
    setSubmitting(true);
    setError(null);

    const clockedIn = !!status?.clockedIn;
    const payload = {
      timestamp: new Date().toISOString(),
      source: 'desktop-dashboard',
      metadata: { role: user?.role }
    };
    const response = clockedIn
      ? await hrAPI.clockOutStaff(payload)
      : await hrAPI.clockInStaff(payload);

    if (!response?.success) {
      setError({
        message: response?.message || (clockedIn ? 'Failed to clock out.' : 'Failed to clock in.'),
        reasonCode: response?.reasonCode,
        ipCheckResult: response?.ipCheckResult
      });
      setSubmitting(false);
      return;
    }

    const nextStatus = await syncCurrentUserClockInStatus(user);
    setStatus(nextStatus);
    window.dispatchEvent(new CustomEvent('teacherClockInChanged', { detail: nextStatus?.record || null }));
    setSubmitting(false);
  };

  const clockedIn = !!status?.clockedIn;
  const ipDenied = error?.reasonCode === 'IP_DENIED' || error?.message?.toLowerCase?.().includes('wi-fi');
  const statusMessage = !statusLoaded
    ? 'Checking attendance status'
    : ipDenied
      ? error?.message || 'Not on school Wi-Fi'
      : error
        ? error.message
        : clockedIn
          ? 'Clocked in successfully'
          : 'Network verified when you clock in';

  return (
    <div className="flex max-w-72 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClockAction}
        disabled={submitting || !statusLoaded}
        className={`h-9 px-4 border text-[11px] font-black uppercase tracking-wider transition flex items-center gap-2 ${
          submitting || !statusLoaded
            ? 'bg-white/20 border-white/20 text-white/60 cursor-not-allowed'
            : clockedIn
              ? 'bg-white text-rose-700 border-white hover:bg-white/90'
              : 'bg-white text-orange-700 border-white hover:bg-white/90'
        }`}
      >
        {submitting || !statusLoaded ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
        {submitting ? 'Saving' : !statusLoaded ? 'Checking' : clockedIn ? 'Clock Out' : 'Clock In'}
      </button>
      <span
        title={statusMessage}
        className={`max-w-full truncate text-[10px] font-semibold flex items-center gap-1 ${
          ipDenied || error ? 'text-red-200' : clockedIn ? 'text-emerald-100' : 'text-white/70'
        }`}
      >
        {ipDenied ? <WifiOff size={10} /> : <Wifi size={10} />}
        {statusMessage}
      </span>
    </div>
  );
};

/**
 * GreetingToast / DashboardGreetingBanner
 *
 * Orange banner shown at the top of every dashboard — desktop and mobile.
 * Greeting-only banners remember dismissal per calendar-day in sessionStorage.
 * Banners with a clock-in action remain visible so attendance is always accessible.
 *
 * Props:
 *   user          — user object
 *   fallbackName  — name to show if user has no name
 *   description   — optional subtitle text
 *   clockInSlot   — optional ReactNode rendered on the right side (clock-in button)
 */
export const GreetingToast = ({
  user,
  fallbackName = 'SYSTEM',
  description,
  clockInSlot,
  showClockIn,
}) => {
  const clockInEnabled = showClockIn ?? canUseClockIn(user);
  const hasClockInAction = Boolean(clockInSlot) || clockInEnabled;

  // Version suffix forces the banner to re-show after a code update.
  // Bump this string whenever you want all users to see it again.
  const storageKey = `greeting_dismissed_v2_${new Date().toDateString()}`;

  // Read synchronously so there's no flash-of-hidden-banner on mount.
  const [visible, setVisible] = useState(() => {
    if (hasClockInAction) return true;
    try { return !sessionStorage.getItem(storageKey); }
    catch { return true; }
  });

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
  };

  if (!visible) return null;

  const greeting = getGreeting();
  const name = getDisplayName(user, fallbackName);
  const subtitle = description ?? 'Here is your institutional summary for today.';
  const resolvedClockInSlot = clockInSlot || (clockInEnabled ? <DesktopClockInButton user={user} /> : null);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ backgroundColor: '#ea580c' }}
      className="w-full flex items-center gap-3 px-5 py-4 shadow-sm"
    >
      {/* ── Greeting text ── */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-black text-white leading-tight tracking-tight">
          {greeting}, {name}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/75 leading-snug uppercase tracking-wider">
          {subtitle}
        </p>
      </div>

      {/* ── Optional clock-in slot ── */}
      {resolvedClockInSlot && (
        <div className="shrink-0">
          {resolvedClockInSlot}
        </div>
      )}

      {/* Clock-in controls must remain available throughout the session. */}
      {!hasClockInAction && (
        <button
          onClick={dismiss}
          aria-label="Dismiss greeting"
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

/** Alias — all existing usages keep working */
export const DashboardGreetingBanner = GreetingToast;

/* ─── Chip row ────────────────────────────────────────────────────────────
   Each chip: { label, value, dot?, onClick? }
   Rendered as  ● value label  pills separated by a hairline divider.
   When a chip has an `onClick`, it renders as an interactive button with a
   subtle hover ring so users can tell it's clickable.
────────────────────────────────────────────────────────────────────────── */

function ChipRow({ chips }) {
  if (!chips?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-0 gap-y-1">
      {chips.map((chip, i) => {
        const inner = (
          <>
            {chip.dot && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                style={{ backgroundColor: chip.dot }}
              />
            )}
            <span className="text-white font-bold text-sm leading-none whitespace-nowrap">
              {chip.value}
            </span>
            <span className="text-white/70 font-semibold text-xs leading-none whitespace-nowrap">
              {chip.label}
            </span>
          </>
        );

        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="w-px h-3.5 bg-white/25 mx-2.5 shrink-0" />}
            {chip.onClick ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); chip.onClick(); }}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
                title={`View ${chip.label} details`}
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                {inner}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Trend badge ─────────────────────────────────────────────────────────── */

function TrendBadge({ trend, trendValue }) {
  if (!trendValue) return null;
  const up = trend === 'up';
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/70">
      {up ? <ArrowUp size={9} strokeWidth={3} /> : <ArrowDown size={9} strokeWidth={3} />}
      {trendValue}
    </span>
  );
}

/* ─── DashboardSummaryCard ───────────────────────────────────────────────────
   Props:
     label      string               — card title (ALL CAPS)
     value      string | number      — big number / text
     subvalue   string | ReactNode   — small line below the number (optional)
     chips      Array<{              — breakdown pills in the card footer (optional)
                  label: string,
                  value: string | number,
                  dot?: string,      — CSS color for the dot indicator
                }>
     trend      'up' | 'down'        — direction arrow (optional)
     trendValue string               — e.g. "+100%" (optional)
     icon       ReactNode
     tone       string               — key into SOLID_COLORS
     onClick    () => void
────────────────────────────────────────────────────────────────────────── */

export const DashboardSummaryCard = ({
  label,
  value,
  subvalue,
  chips,
  trend,
  trendValue,
  icon,
  tone = 'indigo',
  onClick,
}) => {
  const bgColor = SOLID_COLORS[tone] ?? SOLID_COLORS.indigo;

  const content = (
    <>
      {/* ── Row 1: label full width ── */}
      <p className="relative z-10 text-xs font-bold uppercase tracking-[0.15em] text-white/75 leading-tight mb-3">
        {label}
      </p>

      {/* ── Row 2: big number (left) + icon (right) ── */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Left: number + subvalue */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black tracking-tight leading-none text-white">
              {value}
            </p>
            <TrendBadge trend={trend} trendValue={trendValue} />
          </div>
          {subvalue && (
            <p className="mt-1.5 text-sm font-semibold text-white/75 leading-snug">
              {subvalue}
            </p>
          )}
        </div>

        {/* Right: icon box */}
        <span className="flex-shrink-0 flex h-10 w-10 items-center justify-center bg-white/20 border border-white/30 text-white/90">
          {React.isValidElement(icon)
            ? React.cloneElement(icon, { size: 18, strokeWidth: 2.2 })
            : icon}
        </span>
      </div>

      {/* ── Row 3: chips — full width, never truncated ── */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/20">
        <ChipRow chips={chips} />
      </div>

      {/* ── Watermark icon ── */}
      <div className="pointer-events-none absolute -bottom-4 -right-4 text-white/10">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, { size: 90, strokeWidth: 1 })
          : icon}
      </div>
    </>
  );

  const base = 'relative overflow-hidden p-5 text-white transition-transform hover:-translate-y-0.5 select-none';

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${base} text-left w-full`}
      style={{ backgroundColor: bgColor }}
    >
      {content}
    </button>
  ) : (
    <div className={base} style={{ backgroundColor: bgColor }}>
      {content}
    </div>
  );
};

/* ─── DashboardSummary (grid wrapper) ────────────────────────────────────── */

const DashboardSummary = ({
  title = 'Executive Summary',
  description,
  items = [],
  showHeader = true,
}) => (
  <section className="space-y-5">
    {showHeader && <DashboardSectionTitle title={title} description={description} />}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardSummaryCard key={item.label} {...item} />
      ))}
    </div>
  </section>
);

export default DashboardSummary;
