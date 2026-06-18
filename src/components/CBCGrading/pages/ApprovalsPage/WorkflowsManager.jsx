/**
 * WorkflowsManager
 * Table listing all approval workflows with Edit and Toggle actions.
 * Visible only to ADMIN / SUPER_ADMIN (R1.2, R9.1).
 *
 * Props:
 *   currentUserId    {string}
 *   currentUserRoles {string[]}
 *
 * Validates: R1.2, R7.1–R7.5, R9.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Plus,
  RefreshCw,
  Loader2,
  InboxIcon,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { approvalAPI } from '../../../../services/api/approval.api';
import { WorkflowForm } from './WorkflowForm';

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const MODULE_LABELS = {
  ACADEMICS:  'Academics',
  FEES:       'Fees',
  ACCOUNTING: 'Accounting',
  HR:         'HR',
  INVENTORY:  'Inventory',
  USERS:      'Users',
  GENERAL:    'General',
};

const REQUEST_TYPE_LABELS = {
  SCORE_UNLOCK:      'Score Unlock',
  FEE_ADJUSTMENT:    'Fee Adjustment',
  FEE_WAIVER:        'Fee Waiver',
  EXPENSE_APPROVAL:  'Expense Approval',
  BUDGET_APPROVAL:   'Budget Approval',
  PAYMENT_REVERSAL:  'Payment Reversal',
  ROLE_CHANGE:       'Role Change',
  LEAVE_APPROVAL:    'Leave Approval',
  REPORT_PUBLISHING: 'Report Publishing',
  STOCK_ADJUSTMENT:  'Stock Adjustment',
};

const MODE_LABELS = {
  SINGLE:     'Single',
  SEQUENTIAL: 'Sequential',
  PARALLEL:   'Parallel',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ActiveBadge({ active }) {
  return active ? (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border"
      style={{ color: '#10B981', backgroundColor: '#D1FAE5', borderColor: '#10B98133' }}
    >
      Active
    </span>
  ) : (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border"
      style={{ color: '#6B7280', backgroundColor: '#F3F4F6', borderColor: '#6B728033' }}
    >
      Inactive
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorkflowsManager({ currentUserId, currentUserRoles = [] }) {
  // R9.1 — guard: only ADMIN / SUPER_ADMIN may access this view
  const isAdmin = currentUserRoles.some((r) => ADMIN_ROLES.includes(r));
  if (!isAdmin) return null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [workflows, setWorkflows]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [togglingId, setTogglingId] = useState(null); // id being toggled

  // Modal state
  const [formOpen, setFormOpen]           = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null); // null = new

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await approvalAPI.listWorkflows();
      const data = res?.data;
      setWorkflows(Array.isArray(data) ? data : Array.isArray(data?.workflows) ? data.workflows : []);
    } catch (err) {
      setError(err?.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (id) => {
      setTogglingId(id);
      try {
        await approvalAPI.toggleWorkflow(id);
        await fetchWorkflows();
      } catch (err) {
        // Surface error briefly but don't block the UI
        setError(err?.message || 'Failed to toggle workflow');
      } finally {
        setTogglingId(null);
      }
    },
    [fetchWorkflows]
  );

  // ── Open form (new or edit) ────────────────────────────────────────────────
  const openNew = () => {
    setEditingWorkflow(null);
    setFormOpen(true);
  };

  const openEdit = (workflow) => {
    setEditingWorkflow(workflow);
    setFormOpen(true);
  };

  // ── Form save / cancel ────────────────────────────────────────────────────
  const handleFormSave = async () => {
    setFormOpen(false);
    setEditingWorkflow(null);
    await fetchWorkflows();
  };

  const handleFormCancel = () => {
    setFormOpen(false);
    setEditingWorkflow(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#002C60]">
          <GitBranch size={18} />
          <h2 className="text-base font-semibold">Approval Workflows</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWorkflows}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw size={12} />
            Refresh
          </button>

          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all"
            style={{ backgroundColor: '#002C60' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#003a7a')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#002C60')}
          >
            <Plus size={13} />
            New Workflow
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Table / states */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">Loading workflows…</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <InboxIcon size={36} className="text-gray-200" />
          <p className="text-sm font-medium">No workflows configured</p>
          <p className="text-xs text-gray-400">
            Click "New Workflow" to create your first approval workflow.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Module
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Request Type
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Steps
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{wf.name}</span>
                      {wf.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[180px]">
                          {wf.description}
                        </p>
                      )}
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3 text-gray-600">
                      {MODULE_LABELS[wf.module] ?? wf.module}
                    </td>

                    {/* Request Type */}
                    <td className="px-4 py-3 text-gray-600">
                      {REQUEST_TYPE_LABELS[wf.requestType] ?? wf.requestType}
                    </td>

                    {/* Mode */}
                    <td className="px-4 py-3 text-gray-600">
                      {MODE_LABELS[wf.approvalMode] ?? wf.approvalMode}
                    </td>

                    {/* Active badge */}
                    <td className="px-4 py-3">
                      <ActiveBadge active={wf.active} />
                    </td>

                    {/* Step count */}
                    <td className="px-4 py-3 text-gray-600">
                      {wf._count?.steps ?? wf.steps?.length ?? '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(wf)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#002C60] bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-all"
                          title="Edit workflow"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(wf.id)}
                          disabled={togglingId === wf.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={
                            wf.active
                              ? { color: '#6B7280', backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }
                              : { color: '#10B981', backgroundColor: '#D1FAE5', borderColor: '#10B98133' }
                          }
                          title={wf.active ? 'Deactivate' : 'Activate'}
                        >
                          {togglingId === wf.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : wf.active ? (
                            <ToggleLeft size={13} />
                          ) : (
                            <ToggleRight size={13} />
                          )}
                          {wf.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Form Modal */}
      {formOpen && (
        <WorkflowFormModal
          workflow={editingWorkflow}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function WorkflowFormModal({ workflow, onSave, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkflowForm workflow={workflow} onSave={onSave} onCancel={onCancel} />
      </div>
    </div>
  );
}

export default WorkflowsManager;
