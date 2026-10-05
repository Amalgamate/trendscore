import { fetchWithAuth } from './core';

export const transportAPI = {

    // ── Driver run planning / daily trip instances ───────────────────────────
    createRunPlan: (data) => fetchWithAuth('/v1/transport/trips/plan', {
        method: 'POST', body: JSON.stringify(data)
    }),

    listRunTrips: (params = {}) => {
        const q = new URLSearchParams();
        if (params.fromDate) q.append('fromDate', params.fromDate);
        if (params.toDate) q.append('toDate', params.toDate);
        if (params.routeId) q.append('routeId', params.routeId);
        return fetchWithAuth(`/v1/transport/trips/runs?${q.toString()}`);
    },

    reassignRuns: (data) => fetchWithAuth('/v1/transport/trips/runs/assignment', {
        method: 'PATCH', body: JSON.stringify(data)
    }),

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

    /**
     * Assign the staff account that drives this vehicle.
     * Pass null to unassign. The server re-syncs driverName/driverPhone from the
     * linked user and rejects a driver already assigned to another live vehicle.
     */
    assignVehicleDriver: (id, driverId) =>
        fetchWithAuth(`/transport/vehicles/${id}/driver`, {
            method: 'PATCH',
            body: JSON.stringify({ driverId })
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
        fetchWithAuth(`/transport/assignments/${id}`, { method: 'DELETE' }),

    // ── Driver app devices (universal APK onboarding) ────────────────────────
    // A phone running the one universal driver APK identifies its school by
    // CODE, never by URL. Until an administrator approves it here, the app is
    // refused at /api/auth/login with 403 DEVICE_NOT_APPROVED — so this list is
    // the only thing standing between a guessed school code and a real school's
    // routes and learner list.

    listDriverDevices: (status) =>
        fetchWithAuth(`/driver-devices${status ? `?status=${encodeURIComponent(status)}` : ''}`),

    approveDriverDevice: (id) =>
        fetchWithAuth(`/driver-devices/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({})
        }),

    revokeDriverDevice: (id) =>
        fetchWithAuth(`/driver-devices/${id}/revoke`, {
            method: 'POST',
            body: JSON.stringify({})
        }),

    deleteRevokedDriverDevice: (id) =>
        fetchWithAuth(`/driver-devices/${id}`, { method: 'DELETE' }),

    deleteRevokedDriverDevices: (ids) =>
        fetchWithAuth('/driver-devices', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        }),

};
