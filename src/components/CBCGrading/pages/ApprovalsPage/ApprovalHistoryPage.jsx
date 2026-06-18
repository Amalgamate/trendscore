/**
 * ApprovalHistoryPage
 * Full audit-trail view of all historical approval requests.
 *
 * Validates: R8.1, R8.2, R8.3, R8.4
 *
 * Props:
 *   currentUserId    {string}
 *   currentUserRoles {string[]}
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Filter,
  RefreshCw,
  Loader2,
  InboxIcon,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { approvalAPI }        from '../../../../services/api/approval.api';
import { ApprovalStatusBadge } from './components/ApprovalStatusBadge';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Terminal statuses only — history shows resolved requests (R8.2). */
const STATUS_OPTIONS = [
  { value: '',          label: 'All Statuses'  },
  { value: 'APPROVED',  label: 'Approved'      },
  { value: 'REJECTED',  label: 'Rejected'      },
  { value: 'EXPIRED',   label: 'Expired'       },
  { value: 'CANCELLED', label: 'Cancelled'     },
  { value: 'COMPLETED', label: 'Completed'     },
];

const MODULE_OPTIONS = [
  { value: '',           label: 'All Modules'  },
  { value: 'ACADEMICS',  label: 'Academics'    },
  { value: 'FEES',       label: 'Fees'         },
  { value: 'ACCOUNTING', label: 'Accounting'   },
  { value: 'HR',         label: 'HR'           },
  { value: 'INVENTORY',  label: 'Inventory'    },
  { value: 'USERS',      label: 'Users'        },
  { value: 'GENERAL',    label: 'General'      },
];

const EMPTY_FILTERS = {
  module:   '',
  status:   '',
  dateFrom: '',
  dateTo:   '',
  search:   '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
 * Convert a SNAKE_CASE module name to a display label.
 * Falls back to the MODULE_OPTIONS map, then Title Case.
 */
function formatModule(module = '') {
  const found = MODULE_OPTIONS.find((o) => o.value === String(module).toUpperCase());
  if (found && found.value !== '') return found.label;
  return String(module)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an ISO date string to a short readable date.
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Derive the requester display name from a `requestedBy` object.
 * Supports `name`, `firstName`+`lastName`, and plain string fallback.
 */
function getRequesterName(requestedBy) {
  if (!requestedBy) return '—';
  if (requestedBy.name) return requestedBy.name;
  const full = [requestedBy.firstName, requestedBy.lastName]
    .filter(Boolean)
    .join(' ');
  return full || requestedBy.id || '—';
}

/**
 * Derive the resolved date from an approval request.
 * Uses the `actedAt` of the last action, falling back to `updatedAt`.
 */
function getResolvedDate(request) {
  const actions = Array.isArray(request?.actions) ? request.actions : [];
  if (actions.length > 0) {
    // Sort descending and take the most recent actedAt
    const sorted = [...actions].sort(
      (a, b) => new Date(b.actedAt ?? 0) - new Date(a.actedAt ?? 0)
    );
    if (sorted[0]?.actedAt) return formatDate(sorted[0].actedAt);
  }
  return formatDate(request?.updatedAt);
}

/**
 * Derive the list of approver display names from the `actions` array.
 * Only includes actors who performed APPROVE / REJECT / OVERRIDE.
 * De-duplicates by user ID.
 */
function getApproverNames(actions = []) {
  if (!Array.isArray(actions) || actions.length === 0) return '—';

  const seen = new Set();
  const names = [];

  for (const action of actions) {
    const actorId = action?.approver?.id ?? action?.approverId;
    if (!actorId || seen.has(actorId)) continue;
    seen.add(actorId);

    const actor = action?.approver;
    const name = actor?.name
      || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ')
      || actor?.id
      || actorId;

    names.push(name);
  }

  return names.length > 0 ? names.join(', ') : '—';
}

// ── Select helper ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, label, className = '' }) {
  return (
    <select
      aria-label={label}
      className={`text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#002C60]/20 ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Table header ──────────────────────────────────────────────────────────────

const TH_CLASS =
  'px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100';

const TD_CLASS = 'px-3 py-3 text-sm text-gray-700 align-middle';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ApprovalHistoryPage
 *
 * @param {{ currentUserId: string, currentUserRoles: string[] }} props
 */
export function ApprovalHistoryPage({ currentUserId, currentUserRoles }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [filters,  setFilters]  = useState(EMPTY_FILTERS);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Strip empty-string keys so they don't pollute the query string
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '')
      );
      const res = await approvalAPI.history(params);
      const data = res?.data;
      setHistory(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.history)
          ? data.history
          : Array.isArray(data?.requests)
          ? data.requests
          : []
      );
    } catch (err) {
      setError(err?.message || 'Failed to load approval history');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ── Mount + filter change ──────────────────────────────────────────────────
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={18} className="text-[#002C60]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Approval History</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Full audit trail of all resolved approval requests.
            </p>
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {/* Filter icon + label */}
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter size={14} />
          <span className="text-[11px] font-medium uppercase tracking-wide">Filters</span>
        </div>

        {/* Module */}
        <FilterSelect
          label="Module"
          value={filters.module}
          onChange={(v) => setFilter('module', v)}
          options={MODULE_OPTIONS}
        />

        {/* Status — terminal statuses only */}
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUS_OPTIONS}
        />

        {/* Date from */}
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-gray-400">From</label>
          <input
            type="date"
            aria-label="Date from"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
            value={filters.dateFrom}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-gray-400">To</label>
          <input
            type="date"
            aria-label="Date to"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
            value={filters.dateTo}
            onChange={(e) => setFilter('dateTo', e.target.value)}
          />
        </div>

        {/* Free-text search (requester name / ID) */}
        <div className="relative flex items-center">
          <Search
            size={13}
            className="absolute left-2.5 text-gray-400 pointer-events-none"
          />
          <input
            type="search"
            aria-label="Search requester"
            placeholder="Requester name or ID…"
            className="text-sm border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#002C60]/20 w-48"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear all filters"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          /* Loading state */
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Loading history…</span>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-red-500">
            <AlertCircle size={32} className="text-red-300" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-1 px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
            >
              Try again
            </button>
          </div>
        ) : history.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <InboxIcon size={36} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No history records found</p>
            {hasActiveFilters && (
              <p className="text-xs text-gray-400">
                Try adjusting your filters or{' '}
                <button
                  onClick={clearFilters}
                  className="underline text-[#002C60] hover:text-[#003d80]"
                >
                  clearing them
                </button>
                .
              </p>
            )}
          </div>
        ) : (
          /* Data table */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" role="table">
              <thead>
                <tr>
                  <th className={TH_CLASS} scope="col">Request Type</th>
                  <th className={TH_CLASS} scope="col">Module</th>
                  <th className={TH_CLASS} scope="col">Requester</th>
                  <th className={TH_CLASS} scope="col">Status</th>
                  <th className={TH_CLASS} scope="col">Approver(s)</th>
                  <th className={TH_CLASS} scope="col">Created</th>
                  <th className={TH_CLASS} scope="col">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, idx) => (
                  <HistoryRow
                    key={record.id ?? idx}
                    record={record}
                    isEven={idx % 2 === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record count */}
      {!loading && !error && history.length > 0 && (
        <p className="text-[11px] text-gray-400 text-right">
          {history.length} record{history.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────

/**
 * A single table row for one history record.
 *
 * Columns (task 13.2):
 *   1. Request Type  — formatRequestType(requestType)
 *   2. Module        — formatModule(module)
 *   3. Requester     — requestedBy.name or firstName+lastName
 *   4. Status        — ApprovalStatusBadge
 *   5. Approver(s)   — names from actions array
 *   6. Created       — formatDate(createdAt)
 *   7. Resolved      — actedAt of last action, else updatedAt
 *
 * @param {{ record: object, isEven: boolean }} props
 */
function HistoryRow({ record, isEven }) {
  const rowBg = isEven ? 'bg-white' : 'bg-gray-50/40';

  return (
    <tr
      className={`${rowBg} border-b border-gray-50 hover:bg-blue-50/30 transition-colors`}
    >
      {/* 1 — Request Type */}
      <td className={TD_CLASS}>
        <span className="font-medium text-[#002C60]">
          {formatRequestType(record.requestType)}
        </span>
      </td>

      {/* 2 — Module */}
      <td className={TD_CLASS}>
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">
          {formatModule(record.module)}
        </span>
      </td>

      {/* 3 — Requester */}
      <td className={`${TD_CLASS} text-gray-800`}>
        {getRequesterName(record.requestedBy)}
      </td>

      {/* 4 — Final Status */}
      <td className={TD_CLASS}>
        <ApprovalStatusBadge status={record.status} />
      </td>

      {/* 5 — Approver(s) */}
      <td className={`${TD_CLASS} text-gray-600 max-w-[200px]`}>
        <span className="truncate block" title={getApproverNames(record.actions)}>
          {getApproverNames(record.actions)}
        </span>
      </td>

      {/* 6 — Created */}
      <td className={`${TD_CLASS} whitespace-nowrap text-gray-500`}>
        {formatDate(record.createdAt)}
      </td>

      {/* 7 — Resolved */}
      <td className={`${TD_CLASS} whitespace-nowrap text-gray-500`}>
        {getResolvedDate(record)}
      </td>
    </tr>
  );
}

export default ApprovalHistoryPage;
