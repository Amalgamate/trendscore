/**
 * ApprovalDashboard
 * KPI cards + filterable approval request list.
 * Validates: R6.2, R6.3, R6.4, R6.5, R6.6
 *
 * Props:
 *   currentUserId    {string}
 *   currentUserRoles {string[]}
 *   onViewDetail     {(id: string) => void}
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Bell,
  CheckCircle,
  XCircle,
  Send,
  RefreshCw,
  Loader2,
  Filter,
  InboxIcon,
} from 'lucide-react';
import { approvalAPI } from '../../../../services/api/approval.api';
import { ApprovalRequestCard } from './components/ApprovalRequestCard';

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '1A' }} // 10% tint
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide truncate">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-6 w-10 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-[#002C60] leading-tight">
            {value ?? 0}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Module options ────────────────────────────────────────────────────────────

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'ACADEMICS', label: 'Academics' },
  { value: 'FEES', label: 'Fees' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'HR', label: 'HR' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'USERS', label: 'Users' },
  { value: 'GENERAL', label: 'General' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
];

// ── Default empty stats ───────────────────────────────────────────────────────

const EMPTY_STATS = {
  pending: 0,
  awaitingMyAction: 0,
  mySubmitted: 0,
  approvedToday: 0,
  rejectedToday: 0,
};

/** Roles that can see all requests school-wide (R6.4) */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'];

// ── Component ─────────────────────────────────────────────────────────────────

export function ApprovalDashboard({ currentUserId, currentUserRoles = [], onViewDetail }) {
  // R6.4 — teachers only see their own submitted requests
  const isPrivileged = currentUserRoles.some((r) => ADMIN_ROLES.includes(r));
  // ── KPI state ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // ── List state ─────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: '',
    module: '',
    dateFrom: '',
    dateTo: '',
  });

  // ── Fetch KPIs ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await approvalAPI.dashboard();
      if (res?.data) {
        setStats({ ...EMPTY_STATS, ...res.data });
      }
    } catch (err) {
      setStatsError(err?.message || 'Failed to load dashboard stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Fetch request list ────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      // Strip empty-string keys so they don't pollute the query string
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '')
      );
      // R6.4 — non-privileged users (teachers) only see their own requests
      const res = isPrivileged
        ? await approvalAPI.list(params)
        : await approvalAPI.myRequests(params);
      const data = res?.data;
      setRequests(Array.isArray(data) ? data : Array.isArray(data?.requests) ? data.requests : []);
    } catch (err) {
      setListError(err?.message || 'Failed to load approval requests');
    } finally {
      setListLoading(false);
    }
  }, [filters, isPrivileged]);

  // ── Combined refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchStats();
    fetchRequests();
  }, [fetchStats, fetchRequests]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback(
    async (id) => {
      await approvalAPI.approve(id, {});
      handleRefresh();
    },
    [handleRefresh]
  );

  const handleReject = useCallback(
    async (id, comment = '') => {
      await approvalAPI.reject(id, { comment });
      handleRefresh();
    },
    [handleRefresh]
  );

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          color="#F59E0B"
          loading={statsLoading}
        />
        <KpiCard
          icon={Bell}
          label="Awaiting My Action"
          value={stats.awaitingMyAction}
          color="#3B82F6"
          loading={statsLoading}
        />
        <KpiCard
          icon={Send}
          label="My Submitted"
          value={stats.mySubmitted}
          color="#8B5CF6"
          loading={statsLoading}
        />
        <KpiCard
          icon={CheckCircle}
          label="Approved Today"
          value={stats.approvedToday}
          color="#10B981"
          loading={statsLoading}
        />
        <KpiCard
          icon={XCircle}
          label="Rejected Today"
          value={stats.rejectedToday}
          color="#EF4444"
          loading={statsLoading}
        />
      </div>

      {statsError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {statsError}
        </p>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter size={14} />
          <span className="text-[11px] font-medium uppercase tracking-wide">Filters</span>
        </div>

        {/* Status */}
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Module */}
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
          value={filters.module}
          onChange={(e) => handleFilterChange('module', e.target.value)}
        >
          {MODULE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Date from */}
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-gray-400">From</label>
          <input
            type="date"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-gray-400">To</label>
          <input
            type="date"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#002C60]/20"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
          title="Refresh"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Request list */}
      <div className="space-y-2">
        {listLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Loading requests…</span>
          </div>
        ) : listError ? (
          <div className="text-center py-10 text-red-500 text-sm bg-red-50 rounded-xl border border-red-100">
            {listError}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
            <InboxIcon size={36} className="text-gray-200" />
            <p className="text-sm font-medium">No approval requests found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          requests.map((request) => (
            <ApprovalRequestCard
              key={request.id}
              request={request}
              currentUserId={currentUserId}
              currentUserRoles={currentUserRoles}
              onApprove={handleApprove}
              onReject={(id) => handleReject(id)}
              onViewDetail={onViewDetail}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ApprovalDashboard;
