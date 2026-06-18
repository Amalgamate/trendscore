/**
 * ApprovalRequestCard
 * List-row card for a single approval request.
 * Validates: R10.2, R10.4
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, User, Clock, Loader2, ChevronRight } from 'lucide-react';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a SNAKE_CASE request type string to "Title Case With Spaces".
 * e.g. "SCORE_UNLOCK" → "Score Unlock"
 */
function formatRequestType(type = '') {
  return String(type)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an ISO date string to a readable short date.
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Compute a human-readable age string ("2d ago", "3h ago", etc.)
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   request: {
 *     id: string,
 *     status: string,
 *     requestType: string,
 *     module: string,
 *     requestedBy: { id: string, name?: string, firstName?: string, lastName?: string },
 *     resolvedApproverIds: string[],
 *     currentStepNumber: number,
 *     metadata: object,
 *     createdAt: string,
 *     workflow?: { steps?: Array<{ stepNumber: number }> },
 *   },
 *   currentUserId: string,
 *   currentUserRoles: string[],
 *   onApprove: (id: string) => void,
 *   onReject: (id: string) => void,
 *   onViewDetail: (id: string) => void,
 * }} props
 */
export function ApprovalRequestCard({
  request,
  currentUserId,
  currentUserRoles = [],
  onApprove,
  onReject,
  onViewDetail,
}) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  // Inline reject comment box
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  if (!request) return null;

  const {
    id,
    status,
    requestType,
    module,
    requestedBy,
    resolvedApproverIds = [],
    currentStepNumber = 1,
    createdAt,
    workflow,
  } = request;

  // Requester display name
  const requesterName =
    requestedBy?.name ||
    [requestedBy?.firstName, requestedBy?.lastName].filter(Boolean).join(' ') ||
    'Unknown';

  // Step progress
  const totalSteps = workflow?.steps?.length ?? 1;
  const stepLabel = `Step ${currentStepNumber} of ${totalSteps}`;

  // Inline action visibility: user must be a resolved approver AND request must be PENDING
  const canAct =
    status === 'PENDING' &&
    Array.isArray(resolvedApproverIds) &&
    resolvedApproverIds.includes(currentUserId);

  const handleApprove = async () => {
    if (!onApprove || approving) return;
    setApproving(true);
    try {
      await onApprove(id);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClick = () => {
    // Toggle the inline reject comment panel
    setShowRejectInput((prev) => !prev);
    setRejectComment('');
  };

  const handleRejectConfirm = async () => {
    if (!onReject || rejecting) return;
    setRejecting(true);
    try {
      await onReject(id, rejectComment.trim());
      setShowRejectInput(false);
      setRejectComment('');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 hover:shadow-md transition-shadow">
        {/* Status badge — fixed width so rows align */}
        <div className="w-24 flex-shrink-0">
          <ApprovalStatusBadge status={status} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#002C60] truncate">
              {formatRequestType(requestType)}
            </span>
            {module && (
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                {module}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
            {/* Requester */}
            <span className="flex items-center gap-1">
              <User size={11} className="text-gray-400" />
              {requesterName}
            </span>

            {/* Step progress */}
            <span className="flex items-center gap-1">
              <ChevronRight size={11} className="text-gray-400" />
              {stepLabel}
            </span>

            {/* Date created */}
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-gray-400" />
              {formatDate(createdAt)}
              {createdAt && (
                <span className="text-gray-400 italic">· {timeAgo(createdAt)}</span>
              )}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View detail — always visible */}
          {onViewDetail && (
            <button
              onClick={() => onViewDetail(id)}
              className="p-2 text-gray-400 hover:text-[#002C60] hover:bg-gray-50 rounded-lg transition-all"
              title="View Details"
            >
              <Eye size={16} />
            </button>
          )}

          {/* Approve / Reject — only for assigned approvers on PENDING requests */}
          {canAct && (
            <>
              <button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-all disabled:opacity-50"
                title="Approve"
              >
                {approving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Approve
              </button>

              <button
                onClick={handleRejectClick}
                disabled={approving || rejecting}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-lg transition-all disabled:opacity-50 ${
                  showRejectInput
                    ? 'text-red-700 bg-red-100 border-red-300'
                    : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                }`}
                title={showRejectInput ? 'Cancel reject' : 'Reject'}
              >
                <XCircle size={14} />
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline reject comment panel — shown when reject button is clicked */}
      {showRejectInput && canAct && (
        <div className="bg-red-50 border-t border-red-100 px-4 py-3 flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-red-600 mb-1.5">
              Rejection comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              className="w-full text-sm border border-red-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Reason for rejection…"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRejectConfirm()}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={handleRejectConfirm}
              disabled={rejecting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50"
            >
              {rejecting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowRejectInput(false); setRejectComment(''); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalRequestCard;
