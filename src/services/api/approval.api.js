import { fetchWithAuth } from './core';

export const approvalAPI = {
  // ── Requests ─────────────────────────────────────────────────────────

  /**
   * Submit a new approval request.
   * POST /approvals
   */
  submit: async (payload) =>
    fetchWithAuth('/approvals', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * List approval requests (admin/head-teacher view) with optional filters.
   * GET /approvals?{params}
   */
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/approvals${query ? `?${query}` : ''}`);
  },

  /**
   * List the current user's own submitted requests.
   * GET /approvals/my-requests?{params}
   */
  myRequests: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/approvals/my-requests${query ? `?${query}` : ''}`);
  },

  /**
   * Get KPI dashboard stats for the current user.
   * GET /approvals/dashboard
   */
  dashboard: async () =>
    fetchWithAuth('/approvals/dashboard'),

  /**
   * Get a single approval request by ID (with full relations).
   * GET /approvals/{id}
   */
  get: async (id) =>
    fetchWithAuth(`/approvals/${id}`),

  /**
   * Approve a pending request.
   * POST /approvals/{id}/approve
   */
  approve: async (id, payload = {}) =>
    fetchWithAuth(`/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Reject a pending request.
   * POST /approvals/{id}/reject
   */
  reject: async (id, payload = {}) =>
    fetchWithAuth(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * SUPER_ADMIN override on a request.
   * POST /approvals/{id}/override
   */
  override: async (id, payload = {}) =>
    fetchWithAuth(`/approvals/${id}/override`, { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Cancel the current user's own pending request.
   * POST /approvals/{id}/cancel
   */
  cancel: async (id) =>
    fetchWithAuth(`/approvals/${id}/cancel`, { method: 'POST' }),

  /**
   * Get the full approval history (audit log view) with optional filters.
   * GET /approvals/history?{params}
   */
  history: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/approvals/history${query ? `?${query}` : ''}`);
  },

  // ── Workflows ─────────────────────────────────────────────────────────

  /**
   * List all approval workflows (admin view).
   * GET /approval-workflows?{params}
   */
  listWorkflows: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/approval-workflows${query ? `?${query}` : ''}`);
  },

  /**
   * Create a new approval workflow.
   * POST /approval-workflows
   */
  createWorkflow: async (payload) =>
    fetchWithAuth('/approval-workflows', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Update an existing approval workflow's metadata.
   * PUT /approval-workflows/{id}
   */
  updateWorkflow: async (id, payload) =>
    fetchWithAuth(`/approval-workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  /**
   * Toggle a workflow's active state (activate / deactivate).
   * PATCH /approval-workflows/{id}/toggle
   */
  toggleWorkflow: async (id) =>
    fetchWithAuth(`/approval-workflows/${id}/toggle`, { method: 'PATCH' }),

  /**
   * Get all approver steps for a workflow.
   * GET /approval-workflows/{id}/steps
   */
  getWorkflowSteps: async (id) =>
    fetchWithAuth(`/approval-workflows/${id}/steps`),

  /**
   * Replace all steps for a workflow (full replace semantics).
   * PUT /approval-workflows/{id}/steps
   */
  updateWorkflowSteps: async (id, steps) =>
    fetchWithAuth(`/approval-workflows/${id}/steps`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    }),
};

export default approvalAPI;
