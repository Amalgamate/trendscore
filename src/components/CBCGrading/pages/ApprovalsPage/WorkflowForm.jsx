/**
 * WorkflowForm
 * Create / edit an approval workflow, including its step builder.
 *
 * Props:
 *   workflow  {object|null}  — null for new, existing record for edit
 *   onSave    {() => void}   — called after successful save
 *   onCancel  {() => void}   — called when the user closes without saving
 *
 * Validates: R1.2, R7.2, R7.3, R7.5, R9.1
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { approvalAPI } from '../../../../services/api/approval.api';

// ── Option sets ───────────────────────────────────────────────────────────────

const MODULE_OPTIONS = [
  { value: 'ACADEMICS',  label: 'Academics' },
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'FEES',       label: 'Fees' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'HR',         label: 'HR' },
  { value: 'INVENTORY',  label: 'Inventory' },
  { value: 'USERS',      label: 'Users' },
  { value: 'GENERAL',    label: 'General' },
];

const REQUEST_TYPE_OPTIONS = [
  { value: 'SCORE_UNLOCK',      label: 'Score Unlock' },
  { value: 'ATTENDANCE_UNLOCK', label: 'Attendance Unlock' },
  { value: 'FEE_ADJUSTMENT',    label: 'Fee Adjustment' },
  { value: 'FEE_WAIVER',        label: 'Fee Waiver' },
  { value: 'EXPENSE_APPROVAL',  label: 'Expense Approval' },
  { value: 'BUDGET_APPROVAL',   label: 'Budget Approval' },
  { value: 'PAYMENT_REVERSAL',  label: 'Payment Reversal' },
  { value: 'ROLE_CHANGE',       label: 'Role Change' },
  { value: 'LEAVE_APPROVAL',    label: 'Leave Approval' },
  { value: 'REPORT_PUBLISHING', label: 'Report Publishing' },
  { value: 'STOCK_ADJUSTMENT',  label: 'Stock Adjustment' },
];

const APPROVAL_MODES = [
  { value: 'SINGLE',     label: 'Single',     description: 'One approver, one step' },
  { value: 'SEQUENTIAL', label: 'Sequential', description: 'Steps must be approved in order' },
  { value: 'PARALLEL',   label: 'Parallel',   description: 'All steps run simultaneously' },
];

const ROLE_OPTIONS = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'LIBRARIAN',
  'NURSE',
  'PARENT',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBlankStep(stepNumber) {
  return {
    _key: `step-${Date.now()}-${stepNumber}`, // local key for React list
    stepNumber,
    approverType: 'ROLE',
    approverRoles: [],
    approverUserIds: '',   // raw text input (comma-separated)
    minApprovals: 1,
  };
}

/** Parse comma-separated user ID string → cleaned array */
function parseUserIds(raw) {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert an existing step record to the local form shape */
function stepToForm(step, idx) {
  return {
    _key: step.id ?? `step-${Date.now()}-${idx}`,
    stepNumber: step.stepNumber ?? idx + 1,
    approverType: step.approverType ?? 'ROLE',
    approverRoles: Array.isArray(step.approverRoles) ? step.approverRoles : [],
    approverUserIds: Array.isArray(step.approverUserIds)
      ? step.approverUserIds.join(', ')
      : (step.approverUserIds ?? ''),
    minApprovals: step.minApprovals ?? 1,
  };
}

// ── Field styles ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#002C60]/25 transition-shadow';

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkflowForm({ workflow, onSave, onCancel }) {
  const isEditing = Boolean(workflow?.id);

  // ── Form field state ──────────────────────────────────────────────────────
  const [name, setName]                     = useState(workflow?.name ?? '');
  const [module, setModule]                 = useState(workflow?.module ?? 'ACADEMICS');
  const [requestType, setRequestType]       = useState(workflow?.requestType ?? 'SCORE_UNLOCK');
  const [description, setDescription]       = useState(workflow?.description ?? '');
  const [approvalMode, setApprovalMode]     = useState(workflow?.approvalMode ?? 'SINGLE');
  const [minApprovals, setMinApprovals]     = useState(workflow?.minApprovals ?? 1);
  const [relockMinutes, setRelockMinutes]   = useState(workflow?.relockAfterMinutes ?? '');
  const [active, setActive]                 = useState(workflow?.active ?? true);

  // ── Step builder state ────────────────────────────────────────────────────
  const [steps, setSteps] = useState([makeBlankStep(1)]);
  const [stepsLoading, setStepsLoading] = useState(false);

  // If editing, fetch existing steps
  useEffect(() => {
    if (!isEditing) return;
    setStepsLoading(true);
    approvalAPI
      .getWorkflowSteps(workflow.id)
      .then((res) => {
        const data = res?.data;
        const raw = Array.isArray(data) ? data : Array.isArray(data?.steps) ? data.steps : [];
        if (raw.length > 0) {
          setSteps(raw.map((s, i) => stepToForm(s, i)));
        }
      })
      .catch(() => {
        // Non-fatal — leave default blank step
      })
      .finally(() => setStepsLoading(false));
  }, [isEditing, workflow?.id]);

  // ── Submission state ──────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // ── Step actions ──────────────────────────────────────────────────────────
  const addStep = () => {
    setSteps((prev) => [...prev, makeBlankStep(prev.length + 1)]);
  };

  const removeStep = (key) => {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s._key !== key);
      // Re-number
      return filtered.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const updateStep = (key, field, value) => {
    setSteps((prev) =>
      prev.map((s) => (s._key === key ? { ...s, [field]: value } : s))
    );
  };

  const toggleStepRole = (key, role) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s._key !== key) return s;
        const roles = s.approverRoles.includes(role)
          ? s.approverRoles.filter((r) => r !== role)
          : [...s.approverRoles, role];
        return { ...s, approverRoles: roles };
      })
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Workflow name is required.');
      return;
    }
    if (steps.length === 0) {
      setError('At least one approval step is required.');
      return;
    }

    const stepsPayload = steps.map((s) => ({
      stepNumber: s.stepNumber,
      approverType: s.approverType,
      approverRoles: s.approverType === 'ROLE' ? s.approverRoles : [],
      approverUserIds: s.approverType === 'USER' ? parseUserIds(s.approverUserIds) : [],
      minApprovals: Number(s.minApprovals) || 1,
    }));

    const workflowPayload = {
      name: name.trim(),
      module,
      requestType,
      description: description.trim() || null,
      approvalMode,
      minApprovals: Number(minApprovals) || 1,
      relockAfterMinutes: relockMinutes !== '' ? Number(relockMinutes) : null,
      active,
      steps: stepsPayload,
    };

    setSaving(true);
    try {
      if (!isEditing) {
        // Create workflow (steps included in payload)
        await approvalAPI.createWorkflow(workflowPayload);
      } else {
        // Update metadata, then replace steps separately
        const { steps: _steps, ...metaPayload } = workflowPayload;
        await approvalAPI.updateWorkflow(workflow.id, metaPayload);
        await approvalAPI.updateWorkflowSteps(workflow.id, stepsPayload);
      }
      onSave();
    } catch (err) {
      setError(
        err?.message ||
          (isEditing ? 'Failed to update workflow.' : 'Failed to create workflow.')
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
        style={{ background: 'linear-gradient(135deg, #002C60 0%, #004080 100%)' }}
      >
        <h2 className="text-base font-semibold text-white">
          {isEditing ? `Edit Workflow — ${workflow.name}` : 'New Workflow'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-white/70 hover:text-white transition-colors p-1 rounded"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
        {/* Error banner */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {/* ── Basic fields ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Score Unlock"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Module */}
          <div>
            <label className={labelCls}>Module</label>
            <select
              className={inputCls}
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              {MODULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Request Type */}
          <div>
            <label className={labelCls}>Request Type</label>
            <select
              className={inputCls}
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              {REQUEST_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Description (optional)</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Brief description of when this workflow is used…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* ── Approval settings ── */}
        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Approval Mode */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Approval Mode</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {APPROVAL_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-start gap-2.5 cursor-pointer rounded-xl border px-4 py-3 flex-1 min-w-[140px] transition-all ${
                    approvalMode === m.value
                      ? 'border-[#002C60] bg-blue-50/50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalMode"
                    value={m.value}
                    checked={approvalMode === m.value}
                    onChange={() => setApprovalMode(m.value)}
                    className="mt-0.5 accent-[#002C60]"
                  />
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        approvalMode === m.value ? 'text-[#002C60]' : 'text-gray-700'
                      }`}
                    >
                      {m.label}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Min Approvals */}
          <div>
            <label className={labelCls}>Min Approvals</label>
            <input
              type="number"
              className={inputCls}
              min={1}
              value={minApprovals}
              onChange={(e) => setMinApprovals(e.target.value)}
            />
          </div>

          {/* Relock Duration */}
          <div>
            <label className={labelCls}>Auto-expire after (minutes)</label>
            <input
              type="number"
              className={inputCls}
              min={1}
              placeholder="Leave blank for no expiry"
              value={relockMinutes}
              onChange={(e) => setRelockMinutes(e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              e.g. 60 = 1 hour. Used for time-bounded unlocks.
            </p>
          </div>

          {/* Active toggle */}
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#002C60]/30 ${
                active ? 'bg-[#002C60]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              {active ? 'Active — this workflow will accept requests' : 'Inactive — no new requests will be created'}
            </span>
          </div>
        </div>

        {/* ── Step builder ── */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls + ' mb-0'}>Approval Steps</label>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#002C60] bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-all"
            >
              <Plus size={12} />
              Add Step
            </button>
          </div>

          {stepsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">Loading steps…</span>
            </div>
          ) : steps.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              No steps added yet. Click "Add Step" to define who approves.
            </p>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <StepRow
                  key={step._key}
                  step={step}
                  onUpdate={updateStep}
                  onToggleRole={toggleStepRole}
                  onRemove={removeStep}
                  canRemove={steps.length > 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer buttons ── */}
        <div className="border-t border-gray-100 pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#002C60' }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#003a7a'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#002C60'; }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : isEditing ? 'Update Workflow' : 'Create Workflow'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── StepRow ───────────────────────────────────────────────────────────────────

function StepRow({ step, onUpdate, onToggleRole, onRemove, canRemove }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Step header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#002C60] uppercase tracking-wide">
          Step {step.stepNumber}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(step._key)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-all"
          >
            <Trash2 size={11} />
            Remove
          </button>
        )}
      </div>

      {/* Approver type toggle */}
      <div>
        <label className={labelCls}>Approver Type</label>
        <div className="flex gap-2">
          {['ROLE', 'USER'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate(step._key, 'approverType', type)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                step.approverType === type
                  ? 'bg-[#002C60] text-white border-[#002C60]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {type === 'ROLE' ? 'By Role' : 'By User'}
            </button>
          ))}
        </div>
      </div>

      {/* Approver selection */}
      {step.approverType === 'ROLE' ? (
        <div>
          <label className={labelCls}>Approver Roles</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onToggleRole(step._key, role)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                  step.approverRoles.includes(role)
                    ? 'bg-[#002C60] text-white border-[#002C60]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          {step.approverRoles.length === 0 && (
            <p className="text-[11px] text-amber-500 mt-1.5">
              Select at least one role for this step.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls}>Approver User IDs</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Comma-separated user IDs, e.g. abc123, def456"
            value={step.approverUserIds}
            onChange={(e) => onUpdate(step._key, 'approverUserIds', e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Enter the user IDs of specific approvers, separated by commas.
          </p>
        </div>
      )}

      {/* Min approvals */}
      <div className="max-w-[140px]">
        <label className={labelCls}>Min Approvals</label>
        <input
          type="number"
          className={inputCls}
          min={1}
          value={step.minApprovals}
          onChange={(e) => onUpdate(step._key, 'minApprovals', e.target.value)}
        />
      </div>
    </div>
  );
}

export default WorkflowForm;
