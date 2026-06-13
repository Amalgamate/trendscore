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

const TEACHING_ROLES = new Set(['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']);
const MARKING_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

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
    const present = status === 'PRESENT';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
            {present ? <CheckCircle2 size={13} /> : <UserX size={13} />}
            {present ? 'Present' : 'Absent'}
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

            setReportRows(getDataArray(reportRes));
            setStaff(
                getDataArray(staffRes).filter((person) =>
                    TEACHING_ROLES.has(String(person.role || '').toUpperCase())
                )
            );
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
                status: attendance ? 'PRESENT' : 'ABSENT'
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
                status: 'PRESENT'
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
        const present = registerRows.filter((row) => row.status === 'PRESENT').length;
        const absent = Math.max(0, registerRows.length - present);
        return { present, absent, total: registerRows.length };
    }, [registerRows]);

    const markAttendance = async (person, status) => {
        if (!canMark || !isSingleDay || !person?.id) return;

        try {
            setMarkingId(`${person.id}:${status}`);
            setError('');
            await hrAPI.markStaffAttendance({ userId: person.id, status, date: startDate });
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
                        Use one date for the daily teacher register. Wider date ranges show the clock-in report.
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gray-900 p-3 text-white"><Clock size={20} /></div>
                        <div>
                            <p className="text-sm text-gray-500">Teachers</p>
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
                            <option value="PRESENT">Present</option>
                            {isSingleDay && <option value="ABSENT">Absent</option>}
                        </select>
                    </label>
                </div>

                {!isSingleDay && (
                    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Marking is available only when start date and end date are the same. This range view is report-only.
                    </div>
                )}

                {error && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="font-medium text-gray-900">{isSingleDay ? 'Daily Teacher Register' : 'Attendance Report'}</h2>
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
                                        <td className="px-5 py-4 text-sm text-gray-500">{row.source || '—'}</td>
                                        {isSingleDay && (
                                            <td className="px-5 py-4 text-right">
                                                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => markAttendance(row, 'PRESENT')}
                                                        disabled={!canMark || row.status === 'PRESENT' || markingId === `${row.id}:PRESENT`}
                                                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Present
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => markAttendance(row, 'ABSENT')}
                                                        disabled={!canMark || row.status === 'ABSENT' || markingId === `${row.id}:ABSENT`}
                                                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Absent
                                                    </button>
                                                </div>
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
