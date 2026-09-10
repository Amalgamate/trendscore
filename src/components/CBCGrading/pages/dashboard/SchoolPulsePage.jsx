/**
 * SchoolPulsePage
 *
 * Full today's activity stream for admins.
 * Neat table with category filter chips, auto-refreshes via Socket.io,
 * and manual refresh button.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { io } from 'socket.io-client';
import { dashboardAPI } from '../../../../services/api';
import { getAuthItem } from '../../../../utils/authStorage';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const CATEGORY_META = {
    attendance: { label: 'Attendance', colour: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    finance:    { label: 'Finance',    colour: 'bg-blue-100 text-blue-700 border-blue-200' },
    auth:       { label: 'Logins',     colour: 'bg-slate-100 text-slate-600 border-slate-200' },
    hr:         { label: 'HR',         colour: 'bg-violet-100 text-violet-700 border-violet-200' },
    learners:   { label: 'Learners',   colour: 'bg-amber-100 text-amber-700 border-amber-200' },
    system:     { label: 'System',     colour: 'bg-rose-100 text-rose-600 border-rose-200' },
};

const ROW_PULSE = 'bg-blue-50/60';
const ROW_NORMAL = 'hover:bg-slate-50/60';

// ── component ─────────────────────────────────────────────────────────────────

const SchoolPulsePage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [newIds, setNewIds] = useState(new Set());
    const socketRef = useRef(null);
    const tableRef = useRef(null);

    // ── fetch ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await dashboardAPI.getPulse(300);
            if (resp?.success && Array.isArray(resp.data)) {
                setEvents(resp.data);
            }
        } catch (err) {
            setError(err?.message || 'Failed to load pulse');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Socket.io live updates ────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(window.location.origin, {
            withCredentials: true,
            auth: { token: getAuthItem('token') },
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join_attendance', 'attendance:school');
        });

        socket.on('hr:clock_event', (event) => {
            if (!event?.userId) return;
            const id = `live-${Date.now()}-${Math.random()}`;
            const synthesised = {
                id,
                timestamp: new Date().toISOString(),
                icon:      event.eventType === 'CLOCK_IN' ? '🟢' : '🔴',
                label:     event.eventType === 'CLOCK_IN' ? 'Clocked in' : 'Clocked out',
                category:  'attendance',
                actorName: event.fullName,
                actorRole: event.role,
            };
            setEvents((prev) => [synthesised, ...prev]);
            setNewIds((prev) => new Set([...prev, id]));
            setTimeout(() => {
                setNewIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            }, 4000);
        });

        return () => { socket.disconnect(); };
    }, []);

    // ── derived ───────────────────────────────────────────────────────────────
    const categories = [...new Set(events.map((e) => e.category))];

    const filtered = filter === 'all'
        ? events
        : events.filter((e) => e.category === filter);

    const categoryCounts = events.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* ── Page header ── */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Activity size={16} className="text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">School Pulse</h1>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Zap size={10} />
                            Live
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">
                        Today's activity stream — {events.length} events
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── Category filter chips ── */}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        filter === 'all'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    All · {events.length}
                </button>
                {categories.map((cat) => {
                    const meta = CATEGORY_META[cat] || { label: cat, colour: 'bg-slate-100 text-slate-600 border-slate-200' };
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                filter === cat
                                    ? `${meta.colour} ring-2 ring-offset-1 ring-current/20`
                                    : `${meta.colour} opacity-70 hover:opacity-100`
                            }`}
                        >
                            {meta.label} · {categoryCounts[cat] || 0}
                        </button>
                    );
                })}
            </div>

            {/* ── Table ── */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                {loading && events.length === 0 && (
                    <div className="flex items-center gap-2 px-6 py-12 text-slate-400 text-sm justify-center">
                        <RefreshCw size={16} className="animate-spin" /> Loading activity…
                    </div>
                )}

                {!loading && error && (
                    <div className="flex items-center gap-2 px-6 py-8 text-rose-600 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                        <Activity size={32} className="opacity-20" />
                        <p className="text-sm">No events for this category today.</p>
                    </div>
                )}

                {filtered.length > 0 && (
                    <div ref={tableRef} className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 w-24">Time</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 w-8"></th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Event</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Actor</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Role</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((event) => {
                                    const isNew = newIds.has(event.id);
                                    const catMeta = CATEGORY_META[event.category] || { label: event.category, colour: 'bg-slate-100 text-slate-600 border-slate-200' };
                                    return (
                                        <tr
                                            key={event.id}
                                            className={`transition-colors duration-500 ${isNew ? ROW_PULSE : ROW_NORMAL}`}
                                        >
                                            <td className="px-5 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                                                {fmt(event.timestamp)}
                                            </td>
                                            <td className="px-5 py-3 text-base leading-none">
                                                {event.icon}
                                            </td>
                                            <td className="px-5 py-3 text-sm font-semibold text-slate-800">
                                                {event.label}
                                                {isNew && (
                                                    <span className="ml-2 text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                                        NEW
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-700 font-medium">
                                                {event.actorName}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-slate-500 capitalize">
                                                {String(event.actorRole || '').toLowerCase()}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catMeta.colour}`}>
                                                    {catMeta.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
                Showing events from today · Updates live via Socket.io
            </p>
        </div>
    );
};

export default SchoolPulsePage;
