/**
 * GitPopupAlert
 *
 * Reads the UserNotificationContext for any notification where
 *   showAsPopup === true  AND  isRead === false
 *
 * Shows the highest-priority one as a modal overlay. When the user
 * dismisses it, markAsRead() is called — this persists to the DB so the
 * notification is never isRead:false again, and the popup will never
 * reappear after a refresh.
 *
 * No localStorage needed. The backend already returns all records
 * (read + unread); the context's isRead field is the single source of truth.
 *
 * Priority order: ERROR (CRITICAL) → WARNING (IMPORTANT) → GIT_UPDATE (NORMAL)
 */

import React, { useMemo, useCallback, useState } from 'react';
import { X, GitBranch, GitCommit, User, Link2, Rocket, AlertTriangle, Zap, Bell, Check, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import { approvalAPI } from '../../../services/api/approval.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { ERROR: 0, WARNING: 1, GIT_UPDATE: 2, INFO: 3, SUCCESS: 4, WAIVER: 5 };

const TYPE_CONFIG = {
  ERROR: {
    icon: Zap,
    label: 'CRITICAL UPDATE',
    bar: 'bg-red-600',
    iconCls: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
  WARNING: {
    icon: AlertTriangle,
    label: 'IMPORTANT UPDATE',
    bar: 'bg-amber-500',
    iconCls: 'text-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  GIT_UPDATE: {
    icon: Rocket,
    label: 'PLATFORM UPDATE',
    bar: 'bg-[var(--brand-purple,#030b82)]',
    iconCls: 'text-[var(--brand-purple,#030b82)]',
    bg: 'bg-indigo-50 border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  SUCCESS: {
    icon: Bell,
    label: 'NOTICE',
    bar: 'bg-emerald-500',
    iconCls: 'text-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  INFO: {
    icon: Bell,
    label: 'INFO',
    bar: 'bg-blue-500',
    iconCls: 'text-blue-500',
    bg: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  },
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GitPopupAlert() {
  const { notifications, markAsRead } = useUserNotifications();
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  // Pick the first unread popup notification, sorted highest priority first
  const popup = useMemo(() => {
    const candidates = notifications.filter(
      (n) => n.showAsPopup && !n.isRead
    );
    candidates.sort(
      (a, b) =>
        (PRIORITY_ORDER[a.type] ?? 99) - (PRIORITY_ORDER[b.type] ?? 99)
    );
    return candidates[0] ?? null;
  }, [notifications]);

  const handleDismiss = useCallback(() => {
    if (popup) markAsRead(popup.id);
  }, [popup, markAsRead]);

  const handleApprove = useCallback(async () => {
    const requestId = popup?.metadata?.requestId;
    if (!popup || !requestId || approving) return;

    setApproving(true);
    setApprovalError('');
    try {
      await approvalAPI.approve(requestId, {});
      await markAsRead(popup.id);
    } catch (error) {
      setApprovalError(error?.message || 'Unable to approve this request. Open Approvals to review its current status.');
    } finally {
      setApproving(false);
    }
  }, [popup, approving, markAsRead]);

  if (!popup) return null;

  const cfg = TYPE_CONFIG[popup.type] || TYPE_CONFIG.INFO;
  const Icon = cfg.icon;
  const meta = popup.metadata || {};
  const isPendingApproval = meta.event === 'PENDING_APPROVAL' && Boolean(meta.requestId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="git-popup-title"
        className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-md mx-4
          bg-white shadow-2xl border border-gray-100 overflow-hidden
          animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Priority bar */}
        <div className={cn('h-1 w-full', cfg.bar)} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl border', cfg.bg)}>
              <Icon size={20} className={cfg.iconCls} />
            </div>
            <div>
              <p id="git-popup-title"
                className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5',
                  cfg.iconCls
                )}
              >
                {cfg.label}
              </p>
              <h2 className="text-sm font-bold text-gray-900 leading-snug">
                {popup.title}
              </h2>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {popup.message}
          </p>

          {/* Git metadata chips — only shown when present */}
          {(meta.branch || meta.pushedBy || meta.commitSummary || meta.commitUrl) && (
            <div className={cn('rounded-lg border p-3 space-y-2', cfg.bg)}>
              <div className="flex flex-wrap gap-3">
                {meta.branch && (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                    <GitBranch size={12} className={cfg.iconCls} />
                    {meta.branch}
                  </span>
                )}
                {meta.pushedBy && (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                    <User size={12} className={cfg.iconCls} />
                    {meta.pushedBy}
                  </span>
                )}
              </div>

              {meta.commitSummary && (
                <div className="flex items-start gap-1.5">
                  <GitCommit size={12} className={cn('mt-0.5 flex-shrink-0', cfg.iconCls)} />
                  <p className="text-[11px] text-gray-600 font-mono leading-relaxed">
                    {meta.commitSummary}
                  </p>
                </div>
              )}

              {meta.commitUrl && (
                <a
                  href={meta.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] font-semibold hover:underline',
                    cfg.iconCls
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link2 size={12} />
                  View commit / release
                </a>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-gray-400 font-medium">
            {fmtDate(popup.createdAt)}
          </p>

          {approvalError && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {approvalError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          {meta.commitUrl ? (
            <a
              href={meta.commitUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-colors',
                cfg.bg, cfg.iconCls, 'hover:opacity-80'
              )}
            >
              <Link2 size={13} />
              View Details
            </a>
          ) : (
            <div />
          )}
          <div className="ml-auto flex items-center gap-2">
            {isPendingApproval && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1.5 bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {approving ? 'Approving...' : 'Approve'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              disabled={approving}
              className="px-5 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors disabled:opacity-60"
              style={{ background: 'var(--brand-purple, #030b82)' }}
            >
              {isPendingApproval ? 'Later' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
