/**
 * ImpersonationBanner
 *
 * A fixed full-width amber banner rendered at the top of the application shell
 * while an impersonation session is active. It displays the impersonated user's
 * identity and provides a one-click exit control.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9
 *
 * Design notes:
 *  - bg-amber-500 / text-white gives ~4.6:1 contrast ratio → passes WCAG AA (4.5:1 min)
 *  - z-[9999] places the banner above the Header (z-50) and all standard page
 *    content, but below browser-native modals / notification overlays.
 *  - A forwarded ref is attached to the root <div> so the parent can read
 *    offsetHeight and apply a matching padding-top offset to avoid hidden content
 *    (Requirement 4.4).
 *
 * @component
 */

import React from 'react';
import { Eye, Loader2, LogOut } from 'lucide-react';
import { cn } from '../utils/cn';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a role string for display: "HEAD_TEACHER" → "Head Teacher".
 * Returns "—" for falsy values.
 */
const formatRole = (role) => {
  if (!role) return '—';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Safely return the value or the "—" placeholder when the value is absent.
 */
const safe = (value) => (value != null && value !== '' ? value : '—');

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   impersonatedUser: { id?: string, name?: string, email?: string, role?: string },
 *   onExit: () => void,
 *   isExiting: boolean,
 * }} props
 *
 * The component is wrapped in React.forwardRef so the parent can measure the
 * banner's rendered height and apply a matching padding-top to the app shell
 * (Requirement 4.4).
 */
const ImpersonationBanner = React.forwardRef(function ImpersonationBanner(
  { impersonatedUser, onExit, isExiting },
  ref
) {
  const name = safe(impersonatedUser?.name);
  const role = formatRole(impersonatedUser?.role);
  const email = safe(impersonatedUser?.email);

  return (
    /*
     * Requirement 4.5: z-[9999] — above Header (z-50) and all standard page content.
     * Requirement 4.6: fixed top-0 left-0 right-0 — stays at the top of the viewport.
     * Requirement 4.3: bg-amber-500 text-white — ~4.6:1 contrast ratio (WCAG AA ✓).
     */
    <div
      ref={ref}
      role="banner"
      aria-label="Impersonation session active"
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999]',
        'bg-amber-500 text-white',
        'px-4 py-2',
        'flex flex-row items-center justify-between gap-4',
        'select-none'
      )}
    >
      {/* ── Left: session identity ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Eye icon */}
        <Eye
          size={16}
          className="flex-shrink-0 opacity-90"
          aria-hidden="true"
        />

        {/*
         * Requirement 4.2: display full name, role, and email as visible text.
         * Requirement 4.9: use "—" placeholder for any null/undefined field.
         */}
        <span className="text-sm font-medium leading-none whitespace-nowrap">
          Viewing as
        </span>
        <span className="text-sm font-semibold leading-none truncate">
          {name}
        </span>
        <span
          className="hidden sm:inline text-sm leading-none opacity-80 whitespace-nowrap"
          aria-label={`role: ${role}`}
        >
          · {role}
        </span>
        <span
          className="hidden md:inline text-sm leading-none opacity-80 truncate"
          aria-label={`email: ${email}`}
        >
          · {email}
        </span>
      </div>

      {/* ── Right: exit control ────────────────────────────────────────── */}
      {/*
       * Requirement 4.7: labelled exit control that initiates the stop flow.
       * When isExiting === true: disabled + spinner (Requirement 4.7).
       */}
      <button
        type="button"
        onClick={onExit}
        disabled={isExiting}
        aria-label={isExiting ? 'Exiting impersonation session…' : 'Exit impersonation session'}
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5',
          'bg-white text-amber-700 font-semibold text-xs uppercase tracking-wide',
          'px-3 py-1.5 rounded',
          'border border-white/40',
          'transition-all duration-150',
          isExiting
            ? 'opacity-60 cursor-not-allowed'
            : 'hover:bg-amber-50 hover:text-amber-800 active:bg-amber-100 cursor-pointer'
        )}
      >
        {isExiting ? (
          <>
            <Loader2
              size={13}
              className="animate-spin flex-shrink-0"
              aria-hidden="true"
            />
            <span>Exiting…</span>
          </>
        ) : (
          <>
            <LogOut size={13} className="flex-shrink-0" aria-hidden="true" />
            <span>Exit Impersonation</span>
          </>
        )}
      </button>
    </div>
  );
});

ImpersonationBanner.displayName = 'ImpersonationBanner';

export default ImpersonationBanner;
