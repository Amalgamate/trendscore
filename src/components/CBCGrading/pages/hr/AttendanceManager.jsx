import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    RefreshCw,
    Search,
    UserCheck,
    UserX
} from 'lucide-react';
import { hrAPI } from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';

const MARKING_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'OFF_DUTY', 'HOLIDAY', 'PARTIAL'];
const PRESENT_STATUSES = new Set(['PRESENT', 'LATE', 'PARTIAL']);

const todayISO = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const formatName = (person = {}) => {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    return name || person.name || person.email || 'Unnamed staff';
};

const toTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDataArray = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.staff)) return response.data.staff;
    if (Array.isArray(response?.staff)) return response.staff;
    return [];
};

const StatusPill = ({ status }) => {
    const styles = {
        PRESENT: 'bg-emerald-50 text-emerald-700',
        LATE: 'bg-amber-50 text-amber-700',
        PARTIAL: 'bg-orange-50 text-orange-700',
        ABSENT: 'bg-rose-50 text-rose-700',
        ON_LEAVE: 'bg-blue-50 text-blue-700',
        OFF_DUTY: 'bg-gray-100 text-gray-700',
        HOLIDAY: 'bg-violet-50 text-violet-700',
        NOT_DUE: 'bg-slate-50 text-slate-500'
    };
    const label = String(status || 'ABSENT').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] || styles.ABSENT}`}>
            {PRESENT_STATUSES.has(status) ? <CheckCircle2 size={13} /> : <UserX size={13} />}
            {label}
        </span>
    );
};

const AttendanceManager = () => {
    const { user } = useAuth();
    const [startDate, setStartDate] = useState(todayISO());
    const [endDate, setEndDate] = useState(todayISO());
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [staff, setStaff] = useState([]);
    const [reportRows, setReportRows] = useState([]);
    const [reportSummary, setReportSummary] = useState([]);
    const [reportTotals, setReportTotals] = useState(null);
    const [reportPolicy, setReportPolicy] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [markingId, setMarkingId] = useState('');

    const canMark = MARKING_ROLES.has(String(user?.role || '').toUpperCase());
    const isSingleDay = startDate && endDate && startDate === endDate;

    const loadRegister = useCallback(async () => {
        if (!startDate || !endDate) {
            setError('Select both start and end dates.');
            return;
        }

        try {
            setLoading(true);
            setError('');

            const [reportRes, staffRes] = await Promise.all([
                hrAPI.getAttendanceReport({ startDate, endDate }),
                hrAPI.getStaffDirectory()
            ]);

            const reportData = reportRes?.data || reportRes;
            setReportRows(Array.isArray(reportData?.rows) ? reportData.rows : getDataArray(reportRes));
            setReportSummary(Array.isArray(reportData?.summary) ? reportData.summary : []);
            setReportTotals(reportData?.totals || null);
            setReportPolicy(reportData?.policy || null);
            setStaff(getDataArray(staffRes).filter((person) => String(person.status || 'ACTIVE') === 'ACTIVE'));
        } catch (err) {
            setError(err?.message || 'Failed to load staff attendance.');
        } finally {
            setLoading(false);
        }
    }, [endDate, startDate]);

    useEffect(() => {
        loadRegister();
    }, [loadRegister]);

    const registerRows = useMemo(() => {
        const attendanceByUser = new Map();
        reportRows.forEach((row) => {
            const userId = row.userId || row.user?.id;
            if (userId && !attendanceByUser.has(userId)) attendanceByUser.set(userId, row);
        });

        return staff.map((person) => {
            const attendance = attendanceByUser.get(person.id);
            return {
                ...person,
                attendanceId: attendance?.id,
                clockInAt: attendance?.clockInAt,
                clockOutAt: attendance?.clockOutAt,
                source: attendance?.source,
                markingReason: attendance?.markingReason,
                correctedAt: attendance?.correctedAt,
                corrections: attendance?.corrections || [],
                workedMinutes: attendance?.workedMinutes || 0,
                lateMinutes: attendance?.lateMinutes || 0,
                overtimeMinutes: attendance?.overtimeMinutes || 0,
                missingClockOut: !!attendance?.missingClockOut,
                leaveType: attendance?.leaveType,
                status: attendance?.status || 'ABSENT'
            };
        });
    }, [reportRows, staff]);

    const rowsToShow = useMemo(() => {
        const text = query.trim().toLowerCase();
        const baseRows = isSingleDay
            ? registerRows
            : reportRows.map((row) => ({
                ...row,
                firstName: row.user?.firstName,
                lastName: row.user?.lastName,
                email: row.user?.email,
                role: row.user?.role,
                status: row.status || 'PRESENT'
            }));

        return baseRows.filter((row) => {
            const name = formatName(row).toLowerCase();
            const role = String(row.role || '').toLowerCase();
            const matchesSearch = !text || name.includes(text) || role.includes(text) || String(row.email || '').toLowerCase().includes(text);
            const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [isSingleDay, query, registerRows, reportRows, statusFilter]);

    const counts = useMemo(() => {
        const present = registerRows.filter((row) => PRESENT_STATUSES.has(row.status)).length;
        const absent = registerRows.filter((row) => row.status === 'ABSENT').length;
        const excused = registerRows.filter((row) => ['ON_LEAVE', 'OFF_DUTY', 'HOLIDAY'].includes(row.status)).length;
        return { present, absent, excused, total: registerRows.length };
    }, [registerRows]);

    const markAttendance = async (person, status) => {
        if (!canMark || !isSingleDay || !person?.id) return;
        if (status === person.status) return;
        const reason = window.prompt(`Reason for changing ${formatName(person)} to ${status.replaceAll('_', ' ').toLowerCase()}:`);
        if (!reason?.trim()) return;

        try {
            setMarkingId(`${person.id}:${status}`);
            setError('');
            await hrAPI.markStaffAttendance({ userId: person.id, status, date: startDate, reason: reason.trim() });
            await loadRegister();
        } catch (err) {
            setError(err?.message || `Failed to mark ${formatName(person)} ${status.toLowerCase()}.`);
        } finally {
            setMarkingId('');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-rose-500">HR Attendance</p>
                    <h1 className="mt-1 text-2xl font-medium text-gray-900">Staff Attendance Register</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Use one date for the daily staff register. Wider date ranges show reconciled attendance and payroll-ready totals.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={loadRegister}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gray-900 p-3 text-white"><Clock size={20} /></div>
                        <div>
                            <p className="text-sm text-gray-500">Active Staff</p>
                            <p className="text-2xl font-medium text-gray-900">{counts.total}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><UserCheck size={20} /></div>
                        <div>
                            <p className="text-sm text-gray-500">Present</p>
                            <p className="text-2xl font-medium text-gray-900">{counts.present}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-rose-50 p-3 text-rose-600"><UserX size={20} /></div>
                        <div>
                            <p className="text-sm text-gray-500">Absent by default</p>
                            <p className="text-2xl font-medium text-gray-900">{counts.absent}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Calendar size={20} /></div>
                        <div>
                            <p className="text-sm text-gray-500">Excused / Off Duty</p>
                            <p className="text-2xl font-medium text-gray-900">{counts.excused}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.4fr_0.8fr]">
                    <label className="space-y-1.5">
                        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-500">
                            <Calendar size={14} /> Start Date
                        </span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/10"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-500">
                            <Calendar size={14} /> End Date
                        </span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/10"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-500">
                            <Search size={14} /> Search
                        </span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search by teacher name, email or role..."
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/10"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-widest text-gray-500">Status</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/10"
                        >
                            <option value="ALL">All</option>
                            {ATTENDANCE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {!isSingleDay && (
                    <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Marking is available only for a single day. This range view includes expected workdays, approved leave, late time, overtime and missing clock-outs.
                        </div>
                        {reportTotals && (
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                                {[
                                    ['Expected', reportTotals.expectedDays], ['Attended', reportTotals.attendedDays],
                                    ['Absent', reportTotals.absentDays], ['Late', reportTotals.lateDays],
                                    ['On Leave', reportTotals.leaveDays], ['Missing Out', reportTotals.missingClockOuts]
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                                        <p className="text-xs text-gray-500">{label}</p><p className="text-lg font-semibold text-gray-900">{value}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {reportPolicy && <p className="text-xs text-gray-500">Policy: work starts {reportPolicy.workStartTime}; full day {reportPolicy.requiredMinutes / 60} hours; partial below {reportPolicy.partialDayMinutes / 60} hours.</p>}
                    </div>
                )}

                {error && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {!isSingleDay && reportSummary.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-5 py-4">
                        <h2 className="font-medium text-gray-900">Staff Attendance Summary</h2>
                        <p className="text-xs text-gray-500">Payroll-safe totals for the selected period</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50"><tr>
                                {['Staff', 'Expected', 'Attended', 'Absent', 'Late', 'Leave', 'Worked', 'Overtime', 'Rate'].map((heading) => (
                                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{heading}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {reportSummary.map((item) => (
                                    <tr key={item.user.id}>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatName(item.user)}</td>
                                        <td className="px-4 py-3 text-sm">{item.expectedDays}</td><td className="px-4 py-3 text-sm">{item.attendedDays}</td>
                                        <td className="px-4 py-3 text-sm">{item.absentDays}</td><td className="px-4 py-3 text-sm">{item.lateDays}</td>
                                        <td className="px-4 py-3 text-sm">{item.leaveDays}</td>
                                        <td className="px-4 py-3 text-sm">{Math.floor(item.workedMinutes / 60)}h {item.workedMinutes % 60}m</td>
                                        <td className="px-4 py-3 text-sm">{Math.floor(item.overtimeMinutes / 60)}h {item.overtimeMinutes % 60}m</td>
                                        <td className="px-4 py-3 text-sm font-semibold">{item.attendanceRate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="font-medium text-gray-900">{isSingleDay ? 'Daily Staff Register' : 'Attendance Report'}</h2>
                        <p className="text-xs text-gray-500">{rowsToShow.length} record{rowsToShow.length === 1 ? '' : 's'} shown</p>
                    </div>
                    {canMark ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Can mark attendance</span>
                    ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">View only</span>
                    )}
                </div>

                {loading ? (
                    <div className="flex min-h-[260px] items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-brand-teal" />
                    </div>
                ) : rowsToShow.length === 0 ? (
                    <div className="min-h-[260px] p-10 text-center">
                        <AlertCircle size={30} className="mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-700">No attendance records found</p>
                        <p className="mt-1 text-sm text-gray-500">Adjust the date range, status filter or search term.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Staff</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Clock In</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Clock Out</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Worked / Late</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">Source</th>
                                    {isSingleDay && <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-widest text-gray-500">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {rowsToShow.map((row) => (
                                    <tr key={row.id || row.attendanceId} className="hover:bg-gray-50">
                                        <td className="px-5 py-4">
                                            <p className="font-medium text-gray-900">{formatName(row)}</p>
                                            <p className="text-xs text-gray-500">{row.role || 'Staff'}{row.email ? ` · ${row.email}` : ''}</p>
                                        </td>
                                        <td className="px-5 py-4"><StatusPill status={row.status} /></td>
                                        <td className="px-5 py-4 text-sm text-gray-700">{toTime(row.clockInAt)}</td>
                                        <td className="px-5 py-4 text-sm text-gray-700">{toTime(row.clockOutAt)}</td>
                                        <td className="px-5 py-4 text-xs text-gray-600">
                                            <p>{Math.floor((row.workedMinutes || 0) / 60)}h {(row.workedMinutes || 0) % 60}m</p>
                                            {row.lateMinutes > 0 && <p className="text-amber-700">Late {row.lateMinutes}m</p>}
                                            {row.missingClockOut && <p className="text-rose-700">Missing clock-out</p>}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-gray-500">
                                            <p>{row.source || (row.derived ? 'Reconciled' : '—')}</p>
                                            {row.leaveType && <p className="text-xs text-blue-700">{row.leaveType}</p>}
                                            {row.markingReason && <p className="max-w-48 truncate text-xs" title={row.markingReason}>{row.markingReason}</p>}
                                            {row.corrections?.length > 0 && <p className="text-xs text-violet-700">{row.corrections.length} audit change{row.corrections.length === 1 ? '' : 's'}</p>}
                                        </td>
                                        {isSingleDay && (
                                            <td className="px-5 py-4 text-right">
                                                <select
                                                    value={row.status}
                                                    onChange={(event) => markAttendance(row, event.target.value)}
                                                    disabled={!canMark || !!markingId}
                                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"
                                                >
                                                    {ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                                                </select>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceManager;
