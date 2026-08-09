/**
 * SelectionStatusChip
 *
 * Single source of truth for LearnerPathwaySelection status chips.
 * Used across: PathwayPlanner (student), ParentPortalPathway, PathwayCounsellorWorkbench.
 *
 * Statuses: DRAFT | SUBMITTED | APPROVED | REJECTED | LOCKED | NONE
 *
 * Props:
 *   status   — the selection status string
 *   showIcon — whether to render the icon alongside the label (default true)
 *   size     — 'sm' (default) | 'xs'
 */

import React from 'react';
import { Clock, TrendingUp, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export const SELECTION_STATUS_CONFIG = {
  DRAFT:     { label: 'Draft',          cls: 'bg-gray-100 text-gray-600 border-gray-200',         icon: Clock },
  SUBMITTED: { label: 'Submitted',      cls: 'bg-blue-100 text-blue-700 border-blue-200',         icon: TrendingUp },
  APPROVED:  { label: 'Approved',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',icon: CheckCircle2 },
  REJECTED:  { label: 'Needs Revision', cls: 'bg-rose-100 text-rose-700 border-rose-200',         icon: AlertCircle },
  LOCKED:    { label: 'Locked',         cls: 'bg-violet-100 text-violet-700 border-violet-200',   icon: Lock },
  NONE:      { label: 'Not started',    cls: 'bg-gray-50 text-gray-400 border-gray-100',           icon: null },
};

export default function SelectionStatusChip({ status = 'NONE', showIcon = true, size = 'sm' }) {
  const cfg = SELECTION_STATUS_CONFIG[String(status).toUpperCase()] || SELECTION_STATUS_CONFIG.NONE;
  const Icon = cfg.icon;
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'xs' ? 9 : 11;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${textSize} ${cfg.cls}`}
      aria-label={`Selection status: ${cfg.label}`}
    >
      {showIcon && Icon && <Icon size={iconSize} aria-hidden="true" />}
      {cfg.label}
    </span>
  );
}
