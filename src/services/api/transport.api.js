import { fetchWithAuth } from './core';

export const transportAPI = {

    // ── Summary & Fee Roster ──────────────────────────────────────────────────
    getSummary: () =>
        fetchWithAuth('/transport/summary'),

    getReports: () =>
        fetchWithAuth('/transport/reports'),

    getFeeRoster: (params = {}) => {
        const q = new URLSearchParams();
        if (params.term) q.append('term', params.term);
        if (params.academicYear) q.append('academicYear', params.academicYear);
        return fetchWithAuth(`/transport/fee-roster?${q.toString()}`);
    },

    billStudent: (data) =>
        fetchWithAuth('/transport/fee-roster/bill', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    bulkBillStudents: (data) =>
        fetchWithAuth('/transport/fee-roster/bulk-bill', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // ── Vehicles ─────────────────────────────────────────────────────────────
    getVehicles: () =>
        fetchWithAuth('/transport/vehicles'),

    createVehicle: (data) =>
        fetchWithAuth('/transport/vehicles', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateVehicle: (id, data) =>
        fetchWithAuth(`/transport/vehicles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),

    deleteVehicle: (id) =>
        fetchWithAuth(`/transport/vehicles/${id}`, { method: 'DELETE' }),

    // ── Routes ───────────────────────────────────────────────────────────────
    getRoutes: () =>
        fetchWithAuth('/transport/routes'),

    createRoute: (data) =>
        fetchWithAuth('/transport/routes', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateRoute: (id, data) =>
        fetchWithAuth(`/transport/routes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),

    deleteRoute: (id) =>
        fetchWithAuth(`/transport/routes/${id}`, { method: 'DELETE' }),

    // ── Assignments ──────────────────────────────────────────────────────────
    getAssignments: (routeId) =>
        fetchWithAuth(`/transport/assignments/${routeId}`),

    getLearnerAssignments: (learnerId) =>
        fetchWithAuth(`/transport/assignments/learner/${learnerId}`),

    createAssignment: (data) =>
        fetchWithAuth('/transport/assignments', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateAssignment: (id, data) =>
        fetchWithAuth(`/transport/assignments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),

    deleteAssignment: (id) =>
        fetchWithAuth(`/transport/assignments/${id}`, { method: 'DELETE' })
};
