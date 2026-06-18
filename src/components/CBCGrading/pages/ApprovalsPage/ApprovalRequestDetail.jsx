/**
 * ApprovalRequestDetail
 * Full detail view for a single approval request.
 * Validates: R6.5, R6.6, R8.2, R9.1, R10.2, R10.4
 *
 * Props:
 *   requestId        {string}
 *   onBack           {() => void}
 *   currentUserId    {string}
 *   currentUserRoles {string[]}
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ShieldAlert,
  XOctagon,
  Loader2,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { approvalAPI } from '../../../../services/api/approval.api';
import { ApprovalStatusBadge } from './components/ApprovalStatusBadge';
import { ApproverStepVisualizer } from './components/ApproverStepVisualizer';
import { RequestMetadataPanel } from './components/RequestMetadataPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function actionLabel(action) {
  switch (String(action).toUpperCase()) {
    case 'APPROVE':  return { text: 'Approved',  color: 'text-green-700', bg: 'bg-green-50' };
    case 'REJECT':   return { text: 'Rejected',  color: 'text-red-700',   bg: 'bg-red-50' };
    case 'OVERRIDE': return { text: 'Overridden', color: 'text-purple-700', bg: 'bg-purple-50' };
    case 'CANCEL':   return { text: 'Cancelled', color: 'text-gray-600',   bg: 'bg-gray-50' };
    default:         return { text: action,       color: 'text-gray-600',   bg: 'bg-gray-50' };
  }
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      {title && (
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ── Action Timeline entry ─────────────────────────────────────────────────────

function ActionEntry({ action }) {
  const { text, color, bg } = actionLabel(action.action);
  const approverName =
    action.approver?.name ||
    [action.approver?.firstName, action.approver?.lastName].filter(Boolean).join(' ') ||
    action.approverId ||
    'Unknown';

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
        {action.action === 'APPROVE' || action.action === 'OVERRIDE' ? (
          <CheckCircle size={13} className={color} />
        ) : (
          <XCircle size={13} className={color} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${color}`}>{text}</span>
          <span className="text-xs text-gray-500">by</span>
          <span className="text-xs font-medium text-gray-700">{approverName}</span>
          {action.stepNumber && (
            <span className="text-[10px] text-gray-400">(Step {action.stepNumber})</span>
          )}
        </div>
        {action.comment && (
          <p className="mt-0.5 text-xs text-gray-500 italic">"{action.comment}"</p>
        )}
        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(action.actedAt)}</p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApprovalRequestDetail({
  requestId,
  onBack,
  currentUserId,
  currentUserRoles = [],
}) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Action state
  const [acting, setActing]             = useState(false);
  const [actionError, setActionError]   = useState('');

  // Inline reject
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  // Override
  const [showOverrideBox, setShowOverrideBox]     = useState(false);
  const [overrideAction, setOverrideAction]       = useState('APPROVE');
  const [overrideComment, setOverrideComment]     = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRequest = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError('');
    try {
      const res = await approvalAPI.get(requestId);
      setRequest(res?.data ?? null);
    } catch (err) {
      setError(err?.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleApprove = async () => {
    setActing(true);
    setActionError('');
    try {
      await approvalAPI.approve(requestId, {});
      await fetchRequest();
    } catch (err) {
      setActionError(err?.message || 'Approve failed');
    } finally {
      setActing(false);
    }
  };

  const handleRejectConfirm = async () => {
    setActing(true);
    setActionError('');
    try {
      await approvalAPI.reject(requestId, { comment: rejectComment.trim() });
      setShowRejectBox(false);
      setRejectComment('');
      await fetchRequest();
    } catch (err) {
      setActionError(err?.message || 'Reject failed');
    } finally {
      setActing(false);
    }
  };

  const handleOverrideConfirm = async () => {
    setActing(true);
    setActionError('');
    try {
      await approvalAPI.override(requestId, {
        action: overrideAction,
        comment: overrideComment.trim(),
      });
      setShowOverrideBox(false);
      setOverrideComment('');
      await fetchRequest();
    } catch (err) {
      setActionError(err?.message || 'Override failed');
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    setActing(true);
    setActionError('');
    try {
      await approvalAPI.cancel(requestId);
      await fetchRequest();
    } catch (err) {
      setActionError(err?.message || 'Cancel failed');
    } finally {
      setActing(false);
    }
  };

  // ── Derived visibility flags ───────────────────────────────────────────────
  const isSuperAdmin = currentUserRoles.includes('SUPER_ADMIN');
  const resolvedApproverIds = request?.resolvedApproverIds ?? [];
  const canActAsApprover =
    request?.status === 'PENDING' && resolvedApproverIds.includes(currentUserId);

  // Cancel: requester only, PENDING status
  const canCancel =
    request?.status === 'PENDING' && request?.requestedById === currentUserId;

  // Override: SUPER_ADMIN when request is still actionable (PENDING or no terminal state)
  const terminalStatuses = ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'];
  const canOverride =
    isSuperAdmin && request && !terminalStatuses.includes(request.status);
  const requesterFallbackName = [
    request?.requestedBy?.firstName,
    request?.requestedBy?.lastName,
  ].filter(Boolean).join(' ');
  const requesterDisplayName =
    request?.requestedBy?.name ?? (requesterFallbackName || 'Unknown');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#002C60] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 className="text-lg font-semibold text-[#002C60]">Request Detail</h2>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">Loading request…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && request && (
        <>
          {/* Status + summary */}
          <Section>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ApprovalStatusBadge status={request.status} />
                  {request.requestType && (
                    <span className="text-sm font-semibold text-[#002C60]">
                      {String(request.requestType).replace(/_/g, ' ')}
                    </span>
                  )}
                  {request.module && (
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                      {request.module}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap mt-1">
                  <span className="flex items-center gap-1">
                    <User size={11} className="text-gray-400" />
                    Requested by{' '}
                    <strong className="text-gray-700">
                      {requesterDisplayName}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-gray-400" />
                    {formatDate(request.createdAt)}
                  </span>
                  {request.expiresAt && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock size={11} />
                      Expires {formatDate(request.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Metadata */}
          <Section title="Request Details">
            <RequestMetadataPanel
              requestType={request.requestType}
              metadata={request.metadata}
            />
          </Section>

          {/* Workflow steps */}
          {request.workflow?.steps?.length > 0 && (
            <Section title="Approval Steps">
              <ApproverStepVisualizer
                steps={request.workflow.steps}
                currentStepNumber={request.currentStepNumber}
                actions={request.actions ?? []}
              />
            </Section>
          )}

          {/* Action timeline */}
          {request.actions?.length > 0 && (
            <Section title="Action Timeline">
              <div className="space-y-3">
                {[...request.actions]
                  .sort((a, b) => new Date(a.actedAt) - new Date(b.actedAt))
                  .map((action) => (
                    <ActionEntry key={action.id} action={action} />
                  ))}
              </div>
            </Section>
          )}

          {/* Action buttons */}
          {(canActAsApprover || canOverride || canCancel) && (
            <Section title="Actions">
              <div className="space-y-3">
                {actionError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {actionError}
                  </p>
                )}

                {/* Regular approver buttons */}
                {canActAsApprover && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleApprove}
                      disabled={acting}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all disabled:opacity-50"
                    >
                      {acting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Approve
                    </button>

                    <button
                      onClick={() => { setShowRejectBox((v) => !v); setShowOverrideBox(false); }}
                      disabled={acting}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg transition-all disabled:opacity-50 ${
                        showRejectBox
                          ? 'text-red-700 bg-red-100 border-red-300'
                          : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                      }`}
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                  </div>
                )}

                {/* Inline reject comment */}
                {showRejectBox && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                    <label className="text-[11px] font-medium text-red-600">
                      Rejection comment <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                      placeholder="Reason for rejection…"
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRejectConfirm()}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleRejectConfirm}
                        disabled={acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                      >
                        {acting ? <Loader2 size={13} className="animate-spin" /> : null}
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setShowRejectBox(false); setRejectComment(''); }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* SUPER_ADMIN override button — only when request is still actionable */}
                {canOverride && (
                  <div className={canActAsApprover ? 'border-t border-gray-100 pt-3' : ''}>
                    <button
                      onClick={() => { setShowOverrideBox((v) => !v); setShowRejectBox(false); }}
                      disabled={acting}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg transition-all disabled:opacity-50 ${
                        showOverrideBox
                          ? 'text-purple-700 bg-purple-100 border-purple-300'
                          : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200'
                      }`}
                    >
                      <ShieldAlert size={15} />
                      Override (Super Admin)
                    </button>
                  </div>
                )}

                {/* Inline override panel */}
                {showOverrideBox && canOverride && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                    <label className="text-[11px] font-medium text-purple-700">Override action</label>
                    <div className="flex gap-2">
                      <select
                        className="text-sm border border-purple-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                        value={overrideAction}
                        onChange={(e) => setOverrideAction(e.target.value)}
                      >
                        <option value="APPROVE">Force Approve</option>
                        <option value="REJECT">Force Reject</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                      placeholder="Override reason (optional)…"
                      value={overrideComment}
                      onChange={(e) => setOverrideComment(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleOverrideConfirm}
                        disabled={acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                      >
                        {acting ? <Loader2 size={13} className="animate-spin" /> : null}
                        Confirm Override
                      </button>
                      <button
                        onClick={() => { setShowOverrideBox(false); setOverrideComment(''); }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Cancel own request — requester only, PENDING status */}
                {canCancel && (
                  <div className={(canActAsApprover || canOverride) ? 'border-t border-gray-100 pt-3' : ''}>
                    <button
                      onClick={handleCancel}
                      disabled={acting}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all disabled:opacity-50"
                    >
                      {acting ? <Loader2 size={15} className="animate-spin" /> : <XOctagon size={15} />}
                      Cancel Request
                    </button>
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

export default ApprovalRequestDetail;
