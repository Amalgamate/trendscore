import { fetchWithAuth } from './core';
import { axiosInstance } from './axiosConfig';

const normalizeAttendanceError = (error, fallbackMessage) => {
    const response = error?.response?.data;
    return {
        success: false,
        message: response?.message || response?.error?.message || error?.message || fallbackMessage,
        reasonCode: response?.reasonCode || response?.error?.code || null,
        geofenceDecision: response?.geofenceDecision || response?.error?.geofenceDecision || null
    };
};

export const hrAPI = {
    // ── Attendance ────────────────────────────────────────────────────────────
    clockInStaff: async (data = {}) => {
        try {
            const response = await axiosInstance.post('/hr/attendance/clock-in', data);
            return response.data;
        } catch (error) {
            return normalizeAttendanceError(error, 'Failed to clock in');
        }
    },
    clockOutStaff: async (data = {}) => {
        try {
            const response = await axiosInstance.post('/hr/attendance/clock-out', data);
            return response.data;
        } catch (error) {
            return normalizeAttendanceError(error, 'Failed to clock out');
        }
    },
    getTodayClockIn: async () => fetchWithAuth('/hr/attendance/today'),
    getAttendanceReport: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return fetchWithAuth(`/hr/attendance/report${qs ? '?' + qs : ''}`);
    },
    markStaffAttendance: async (data) =>
        fetchWithAuth('/hr/attendance/mark', { method: 'POST', body: JSON.stringify(data) }),

    // ── Staff Directory ───────────────────────────────────────────────────────
    getStaffDirectory: async () => fetchWithAuth('/hr/staff'),
    updateStaffHR: async (id, data) =>
        fetchWithAuth(`/hr/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // ── Allowances ────────────────────────────────────────────────────────────
    getStaffAllowances: async (userId) => fetchWithAuth(`/hr/allowances/${userId}`),
    upsertAllowance: async (userId, data) =>
        fetchWithAuth(`/hr/allowances/${userId}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteAllowance: async (userId, id) =>
        fetchWithAuth(`/hr/allowances/${userId}/${id}`, { method: 'DELETE' }),

    // ── Custom Deductions ─────────────────────────────────────────────────────
    getStaffDeductions: async (userId) => fetchWithAuth(`/hr/deductions/${userId}`),
    upsertDeduction: async (userId, data) =>
        fetchWithAuth(`/hr/deductions/${userId}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteDeduction: async (userId, id) =>
        fetchWithAuth(`/hr/deductions/${userId}/${id}`, { method: 'DELETE' }),

    // ── Leave ─────────────────────────────────────────────────────────────────
    getLeaveTypes: async () => fetchWithAuth('/hr/leave/types'),
    createLeaveType: async (data) =>
        fetchWithAuth('/hr/leave/types', { method: 'POST', body: JSON.stringify(data) }),
    updateLeaveType: async (id, data) =>
        fetchWithAuth(`/hr/leave/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLeaveType: async (id) =>
        fetchWithAuth(`/hr/leave/types/${id}`, { method: 'DELETE' }),
    submitLeaveRequest: async (data) =>
        fetchWithAuth('/hr/leave/apply', { method: 'POST', body: JSON.stringify(data) }),
    getLeaveRequests: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return fetchWithAuth(`/hr/leave/requests${queryString ? '?' + queryString : ''}`);
    },
    approveLeaveRequest: async (requestId, data) =>
        fetchWithAuth(`/hr/leave/approve/${requestId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getLeaveBalance: async (userId, year) =>
        fetchWithAuth(`/hr/leave/balance/${userId}?year=${year || new Date().getFullYear()}`),

    // ── Payroll ───────────────────────────────────────────────────────────────
    generatePayroll: async (data) =>
        fetchWithAuth('/hr/payroll/generate', { method: 'POST', body: JSON.stringify(data) }),
    getPayrollRecords: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return fetchWithAuth(`/hr/payroll${queryString ? '?' + queryString : ''}`);
    },
    getPayslip: async (id) => fetchWithAuth(`/hr/payroll/${id}`),
    confirmPayroll: async (id) =>
        fetchWithAuth(`/hr/payroll/confirm/${id}`, { method: 'PUT' }),
    bulkConfirmPayroll: async (month, year) =>
        fetchWithAuth('/hr/payroll/bulk-confirm', { method: 'POST', body: JSON.stringify({ month, year }) }),
    markPayrollPaid: async (id, paymentReference) =>
        fetchWithAuth(`/hr/payroll/pay/${id}`, { method: 'PUT', body: JSON.stringify({ paymentReference }) }),
    bulkMarkPaid: async (month, year, paymentReference) =>
        fetchWithAuth('/hr/payroll/bulk-pay', { method: 'POST', body: JSON.stringify({ month, year, paymentReference }) }),
    voidPayroll: async (id, reason) =>
        fetchWithAuth(`/hr/payroll/void/${id}`, { method: 'PUT', body: JSON.stringify({ reason }) }),

    // ── M-Pesa Payouts ────────────────────────────────────────────────────────
    bulkDisburseMpesa: async (payrollRecordIds) =>
        fetchWithAuth('/mpesa/payout/bulk', { method: 'POST', body: JSON.stringify({ payrollRecordIds }) }),

    // ── Performance ───────────────────────────────────────────────────────────
    getPerformanceReviews: async (userId) => {
        const url = userId ? `/hr/performance?userId=${userId}` : '/hr/performance';
        return fetchWithAuth(url);
    },
    createPerformanceReview: async (data) =>
        fetchWithAuth('/hr/performance', { method: 'POST', body: JSON.stringify(data) }),
    updatePerformanceReview: async (id, data) =>
        fetchWithAuth(`/hr/performance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // ── Dashboard ─────────────────────────────────────────────────────────────
    getDashboardStats: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return fetchWithAuth(`/hr/dashboard?${queryString}`);
    },
};
