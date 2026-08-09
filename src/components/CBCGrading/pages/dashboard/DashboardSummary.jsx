import React, { useState } from 'react';
import { ArrowUp, ArrowDown, CheckCircle2, Lightbulb, Sparkles, UserCircle, X } from 'lucide-react';
import AskAIButton from '../../../help/AskAIButton';

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

const formatRoleName = (role) => String(role || 'USER')
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');

const resolveProfileAssistant = (user) => {
  const checks = [
    {
      key: 'firstName',
      label: 'First name',
      missing: !user?.firstName && !user?.name,
      suggestion: 'Add your first name so greetings, approvals, and messages address you correctly.',
    },
    {
      key: 'lastName',
      label: 'Last name',
      missing: !user?.lastName && !String(user?.name || '').trim().includes(' '),
      suggestion: 'Add your surname so records and staff communication identify you clearly.',
    },
    {
      key: 'phone',
      label: 'Phone number',
      missing: !user?.phone,
      suggestion: 'Add a reachable phone number for urgent school follow-ups and account support.',
    },
    {
      key: 'profilePicture',
      label: 'Profile image',
      missing: !user?.profilePicture && !user?.profileImage,
      suggestion: 'Add a profile photo or image URL so other users can recognize the account faster.',
    },
  ];

  const missingItems = checks.filter((item) => item.missing);
  const completed = checks.length - missingItems.length;
  const score = Math.round((completed / checks.length) * 100);

  return { missingItems, score, completed, total: checks.length };
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
 *   onNavigate    — optional navigation callback for profile completion
 */
export const GreetingToast = ({
  user,
  fallbackName = 'SYSTEM',
  description,
  onNavigate,
}) => {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  // Version suffix forces the banner to re-show after a code update.
  // Bump this string whenever you want all users to see it again.
  const storageKey = `greeting_dismissed_v3_${new Date().toDateString()}`;
  const profileStorageKey = `profile_assistant_last_seen_v2_${user?.id || user?.email || 'user'}`;
  const profileAssistant = resolveProfileAssistant(user);

  // Read synchronously so there's no flash-of-hidden-banner on mount.
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(storageKey); }
    catch { return true; }
  });
  const [profilePromptOpen, setProfilePromptOpen] = useState(() => {
    if (!profileAssistant.missingItems.length) return false;
    try {
      const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
      const lastSeen = Number(localStorage.getItem(profileStorageKey) || 0);
      return isMobile && (!lastSeen || Date.now() - lastSeen >= oneWeekMs);
    }
    catch { return true; }
  });

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
  };

  const greeting = getGreeting();
  const name = getDisplayName(user, fallbackName);
  const subtitle = description ?? 'Here is your institutional summary for today.';
  const roleLabel = formatRoleName(user?.role);
  const completionLabel = `${profileAssistant.score}% profile`;

  const dismissProfilePrompt = () => {
    setProfilePromptOpen(false);
    try { localStorage.setItem(profileStorageKey, String(Date.now())); } catch { /* ignore */ }
  };

  const openProfile = () => {
    dismissProfilePrompt();
    if (typeof onNavigate === 'function') {
      onNavigate('settings-profile');
      return;
    }
    window.location.hash = '#settings-profile';
  };

  return (
    <>
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className="w-full border-b border-orange-200 bg-white px-4 py-4 shadow-sm sm:px-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <Sparkles size={16} />
                </span>
                <p className="text-lg font-black leading-tight tracking-tight text-slate-950 sm:text-xl">
                  {greeting}, {name}! <span className="text-sm font-semibold text-slate-500 ml-2">Today is {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span>
                </p>
              </div>
              <p className="mt-2 max-w-2xl text-xs font-semibold uppercase tracking-wider text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <UserCircle size={14} />
                {roleLabel}
              </span>
              {profileAssistant.missingItems.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setProfilePromptOpen(true)}
                  className="inline-flex items-center gap-2 border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-orange-700 hover:bg-orange-100"
                >
                  <Sparkles size={14} />
                  {completionLabel}
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 size={14} />
                  Complete profile
                </span>
              )}
              <button
                onClick={dismiss}
                aria-label="Dismiss greeting"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {profilePromptOpen && profileAssistant.missingItems.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/35 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-amber-100 bg-white shadow-2xl">
            <div className="flex items-start gap-3 px-4 pb-3 pt-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Lightbulb size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Did you know?</p>
                <h2 className="mt-1 text-base font-black text-slate-950">It helps us know you better.</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  A complete profile makes greetings, messages, approvals, and support feel more personal and accurate.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissProfilePrompt}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close profile assistant"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Profile completion</span>
                  <span className="text-amber-700">{profileAssistant.score}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${profileAssistant.score}%` }} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {profileAssistant.missingItems.map((item) => (
                  <span key={item.key} className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={dismissProfilePrompt}
                className="h-10 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Later
              </button>
              <button
                type="button"
                onClick={openProfile}
                className="h-10 flex-1 rounded-xl bg-amber-600 px-4 text-sm font-black text-white hover:bg-amber-700"
              >
                Complete profile
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
  askAI = true,
}) => {
  const bgColor = SOLID_COLORS[tone] ?? SOLID_COLORS.indigo;

  const content = (
    <>
      {/* ── Row 1: label full width ── */}
      <div className="relative z-10 mb-3 flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/75 leading-tight">
          {label}
        </p>
        {askAI && <AskAIButton title={label} context={{ value, subvalue, trend, trendValue, chips }} variant="light" />}
      </div>

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
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      data-ai-card="true"
      data-ai-title={label}
      className={`${base} text-left w-full`}
      style={{ backgroundColor: bgColor }}
    >
      {content}
    </div>
  ) : (
    <div className={base} style={{ backgroundColor: bgColor }} data-ai-card="true" data-ai-title={label}>
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
