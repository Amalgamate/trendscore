/**
 * ScoreUnlockPrompt
 *
 * Dialog shown when a teacher attempts to edit a score that is currently locked.
 * Presents a single "Request Unlock" button (R10.3 — no forms, no reason fields).
 *
 * State machine:
 *   IDLE  →  (click "Request Unlock")  →  SUBMITTING  →  PENDING  →  (approved via socket)  →  calls onUnlockGranted()
 *   IDLE  →  (click "Cancel")          →  calls onDismiss()
 *   PENDING  →  (click "Cancel request")  →  cancels in-flight request  →  IDLE
 *
 * Validates: Requirements R4.1, R4.2, R4.3, R4.4, R10.3
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Loader2, X } from 'lucide-react';
import { approvalAPI } from '../../services/api/approval.api';
import { useUserNotifications } from '../../contexts/UserNotificationContext';
import { ApprovalStatusBadge } from '../CBCGrading/pages/ApprovalsPage/components/ApprovalStatusBadge';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely parse notification.metadata whether it arrives as a plain object or a
 * JSON string (matches the same pattern used in FeeApprovalReminder).
 */
const parseNotificationMetadata = (notification) => {
  const raw = notification?.metadata;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   open: boolean,
 *   onDismiss: () => void,
 *   onUnlockGranted: () => void,
 *   context: {
 *     assessmentId: string,
 *     assessmentType: string,
 *     classId: string,
 *     subjectId: string,
 *     term: string,
 *     academicYear: string | number,
 *     teacherId: string,
 *   }
 * }} props
 */
export function ScoreUnlockPrompt({ open, onDismiss, onUnlockGranted, context }) {
  // 'idle' | 'submitting' | 'pending' | 'cancelling'
  const [phase, setPhase] = useState('idle');
  const [requestId, setRequestId] = useState(null);
  const [error, setError] = useState('');

  // Keep a ref so the socket effect closure always sees the current requestId
  // without needing it in the dependency array (avoids re-registering the effect
  // on every render).
  const requestIdRef = useRef(null);
  requestIdRef.current = requestId;

  const { notifications } = useUserNotifications();

  // ── Reset state when dialog is closed / reopened ──────────────────────────
  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setRequestId(null);
      setError('');
    }
  }, [open]);

  // ── Socket listener — watch for APPROVAL notification matching our request ─
  // Only active when the dialog is open AND a requestId has been stored.
  // Validates: R4.4
  useEffect(() => {
    if (!open || !requestId) return;

    for (const notification of notifications) {
      const meta = parseNotificationMetadata(notification);

      const isApprovalType =
        notification.type === 'APPROVAL' ||
        String(notification.type).toUpperCase() === 'APPROVAL';

      const matchesRequest = meta.requestId === requestId;

      const isApproved =
        meta.status === 'APPROVED' ||
        String(meta.status).toUpperCase() === 'APPROVED';

      if (isApprovalType && matchesRequest && isApproved) {
        onUnlockGranted();
        return;
      }
    }
  }, [notifications, open, requestId, onUnlockGranted]);

  // ── Submit unlock request ─────────────────────────────────────────────────
  // Validates: R4.1, R4.2, R4.3
  const handleRequestUnlock = useCallback(async () => {
    setPhase('submitting');
    setError('');

    try {
      const response = await approvalAPI.submit({
        module: 'ACADEMICS',
        requestType: 'SCORE_UNLOCK',
        metadata: context,
      });

      // Handle both `{ data: { id } }` and `{ id }` response shapes
      const id = response?.data?.id ?? response?.id;

      if (!id) {
        throw new Error('Invalid response from server — no request ID returned.');
      }

      setRequestId(id);
      setPhase('pending');
    } catch (err) {
      const message =
        err?.message || 'Could not submit unlock request. Please try again.';
      setError(message);
      setPhase('idle');
    }
  }, [context]);

  // ── Cancel in-flight request ──────────────────────────────────────────────
  const handleCancelRequest = useCallback(async () => {
    if (!requestId) return;
    setPhase('cancelling');
    setError('');

    try {
      await approvalAPI.cancel(requestId);
    } catch (err) {
      // Best-effort cancel — if it fails we still reset local state so the
      // teacher isn't stuck. The server-side request will time out naturally.
      console.warn('[ScoreUnlockPrompt] Cancel request failed:', err);
    } finally {
      setRequestId(null);
      setPhase('idle');
    }
  }, [requestId]);

  if (!open) return null;

  const isSubmitting = phase === 'submitting';
  const isPending    = phase === 'pending' || phase === 'cancelling';
  const isCancelling = phase === 'cancelling';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-unlock-title"
    >
      {/* Panel */}
      <div className="w-full max-w-sm border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-amber-100 text-amber-600">
              <Lock size={20} />
            </div>
            <div>
              <h2
                id="score-unlock-title"
                className="text-[15px] font-black uppercase tracking-[0.12em] text-slate-900"
              >
                Scores Locked
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isPending
                  ? 'Awaiting approval to edit scores.'
                  : 'This assessment is currently locked.'}
              </p>
            </div>
          </div>

          {/* Close button — only shown in idle/error state */}
          {!isPending && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {!isPending ? (
            /* ── IDLE / ERROR STATE ─────────────────────────────────────── */
            <>
              <p className="text-sm text-slate-700">
                Scores are locked. Request Unlock?
              </p>

              {error && (
                <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Primary action — single button click, no form (R10.3) */}
                <button
                  type="button"
                  onClick={handleRequestUnlock}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 bg-amber-500 px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-amber-600 disabled:cursor-wait disabled:opacity-60 sm:flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      Request Unlock
                    </>
                  )}
                </button>

                {/* Ghost cancel */}
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* ── PENDING STATE ──────────────────────────────────────────── */
            <>
              <div className="flex items-center gap-3">
                <ApprovalStatusBadge status="PENDING" />
                <p className="text-sm text-slate-700">
                  Unlock request sent. Waiting for approval…
                </p>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                You will be notified as soon as an admin or head teacher approves
                your request. This dialog will update automatically.
              </p>

              {/* Cancel request link */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={isCancelling}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    'Cancel request'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScoreUnlockPrompt;
