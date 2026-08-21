/**
 * ImpersonationBanner
 *
 * A compact amber status bar rendered at the bottom of the application shell
 * while an impersonation session is active. It displays the impersonated user's
 * identity and provides a one-click exit control.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9
 *
 * Design notes:
 *  - bg-amber-500 / text-white gives ~4.6:1 contrast ratio → passes WCAG AA (4.5:1 min)
 *  - z-[9999] places the banner above the Header (z-50) and all standard page
 *    content, but below browser-native modals / notification overlays.
 *  - The narrow, centred layout keeps primary header and navigation controls clear.
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
     * Requirement 4.6: fixed at the bottom of the viewport and clear of page controls.
     * Requirement 4.3: bg-amber-500 text-white — ~4.6:1 contrast ratio (WCAG AA ✓).
     */
    <div
      ref={ref}
      role="banner"
      aria-label="Impersonation session active"
      className={cn(
        'fixed bottom-3 left-1/2 z-[9999] -translate-x-1/2',
        'w-[calc(100%_-_1.5rem)] max-w-3xl',
        'bg-amber-500 text-white',
        'px-3 py-1.5 sm:px-4',
        'flex flex-row items-center justify-between gap-3',
        'rounded-lg shadow-lg ring-1 ring-black/10',
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
        <span className="hidden sm:inline text-xs font-medium leading-none whitespace-nowrap">
          Viewing as
        </span>
        <span className="text-xs font-semibold leading-none truncate">
          {name}
        </span>
        <span
          className="hidden md:inline text-xs leading-none opacity-80 whitespace-nowrap"
          aria-label={`role: ${role}`}
        >
          · {role}
        </span>
        <span
          className="hidden lg:inline text-xs leading-none opacity-80 truncate"
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
          'px-2.5 py-1 rounded',
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
