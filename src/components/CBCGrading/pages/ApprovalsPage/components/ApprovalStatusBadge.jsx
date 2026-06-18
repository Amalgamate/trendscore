/**
 * ApprovalStatusBadge
 * Color-coded pill badge for approval request statuses.
 * Validates: R10.1
 */

import React from 'react';

const STATUS_CONFIG = {
  PENDING:   { label: 'Pending',   color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED:  { label: 'Approved',  color: '#10B981', bg: '#D1FAE5' },
  REJECTED:  { label: 'Rejected',  color: '#EF4444', bg: '#FEE2E2' },
  EXPIRED:   { label: 'Expired',   color: '#6B7280', bg: '#F3F4F6' },
  CANCELLED: { label: 'Cancelled', color: '#9CA3AF', bg: '#F9FAFB' },
  COMPLETED: { label: 'Completed', color: '#3B82F6', bg: '#DBEAFE' },
  DRAFT:     { label: 'Draft',     color: '#6B7280', bg: '#F3F4F6' },
};

/**
 * @param {{ status: string }} props
 */
export function ApprovalStatusBadge({ status }) {
  const config = STATUS_CONFIG[String(status).toUpperCase()] ?? {
    label: status ?? 'Unknown',
    color: '#6B7280',
    bg: '#F3F4F6',
  };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.color + '33', // 20% opacity border
      }}
    >
      {config.label}
    </span>
  );
}

export default ApprovalStatusBadge;
