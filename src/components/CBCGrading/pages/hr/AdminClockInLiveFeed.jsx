/**
 * AdminClockInLiveFeed
 *
 * Real-time staff clock-in/out activity feed for admin dashboards.
 *
 * - On mount: loads today's full activity from GET /hr/attendance/live
 * - While open: subscribes to Socket.io `hr:clock_event` events on the
 *   `attendance:{schoolId}` room so new clock-ins appear instantly without
 *   a page refresh.
 * - Renders a scrollable card list with status badges, initials avatar,
 *   clock-in/out times, worked duration, and a live "pulse" indicator for
 *   staff currently clocked in.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
    Activity,
    Clock,
    LogIn,
    LogOut,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Users,
} from 'lucide-react';
import { hrAPI } from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';
import { getAuthItem } from '../../../../utils/authStorage';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDuration = (minutes) => {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const initials = (name = '') =>
    name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '??';

const ROLE_HR_ADMIN = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

// ── sub-components ────────────────────────────────────────────────────────────

const Avatar = ({ name, src, size = 9 }) => {
    const cls = `w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0`;
    if (src) {
        return <img src={src} alt={name} className={`${cls} object-cover`} />;
    }
    // deterministic colour from name
    const colours = [
        'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
        'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
        'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
    ];
    const idx = name.charCodeAt(0) % colours.length;
    return <div className={`${cls} ${colours[idx]}`}>{initials(name)}</div>;
};

const EventBadge = ({ event }) => {
    if (event.eventType === 'CLOCK_OUT') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                <LogOut size={10} />
                Out {fmtDuration(event.workedMinutes) ? `· ${fmtDuration(event.workedMinutes)}` : ''}
            </span>
        );
    }
    if (event.isLate) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                Late {event.lateMinutes > 0 ? `· ${event.lateMinutes}m` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={10} />
            On time
        </span>
    );
};

const FeedRow = ({ event, isNew }) => (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors duration-500 ${isNew ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
        <div className="relative shrink-0">
            <Avatar name={event.fullName} src={event.profilePicture} />
            {event.eventType === 'CLOCK_IN' && !event.clockOutAt && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            )}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 truncate">{event.fullName}</span>
                <EventBadge event={event} />
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{event.role?.toLowerCase()}</p>
        </div>
        <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-700 font-medium justify-end">
                {event.eventType === 'CLOCK_IN'
                    ? <><LogIn size={11} className="text-emerald-600" />{fmt(event.clockInAt)}</>
                    : <><LogOut size={11} className="text-slate-400" />{fmt(event.clockOutAt)}</>
                }
            </div>
            {event.clockOutAt && event.workedMinutes > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtDuration(event.workedMinutes)} worked</p>
            )}
            {!event.clockOutAt && event.eventType === 'CLOCK_IN' && (
                <p className="text-[10px] text-emerald-500 mt-0.5 font-medium">● Active</p>
            )}
        </div>
    </div>
);

// ── main component ────────────────────────────────────────────────────────────

const AdminClockInLiveFeed = ({ schoolId, onNewEvent }) => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newIds, setNewIds] = useState(new Set());
    const socketRef = useRef(null);
    const listRef = useRef(null);

    const isAdmin = ROLE_HR_ADMIN.has(String(user?.role || '').toUpperCase());

    // ── initial load ──────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await hrAPI.getLiveFeed();
            const rows = Array.isArray(resp?.data) ? resp.data : [];
            setEvents(rows);
        } catch (err) {
            setError(err?.message || 'Failed to load live feed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Socket.io subscription ────────────────────────────────────────────────
    useEffect(() => {
        if (!isAdmin) return;

        const socket = io(window.location.origin, {
            withCredentials: true,
            auth: { token: getAuthItem('token') },
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            // Join the school attendance room
            const room = `attendance:${schoolId || 'school'}`;
            socket.emit('join_attendance', room);
        });

        socket.on('hr:clock_event', (event) => {
            if (!event?.userId) return;

            setEvents((prev) => {
                // Update existing entry or prepend new one
                const existingIdx = prev.findIndex((e) => e.userId === event.userId);
                if (existingIdx !== -1) {
                    const updated = [...prev];
                    updated[existingIdx] = {
                        ...updated[existingIdx],
                        ...event,
                        // keep clockInAt if server didn't send it (clock-out event)
                        clockInAt: event.clockInAt || updated[existingIdx].clockInAt,
                    };
                    return updated;
                }
                return [event, ...prev];
            });

            // Mark as "new" for 4 seconds to highlight the row
            setNewIds((prev) => new Set([...prev, event.userId]));
            setTimeout(() => {
                setNewIds((prev) => {
                    const next = new Set(prev);
                    next.delete(event.userId);
                    return next;
                });
            }, 4000);

            // Scroll to top so the new event is visible
            listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

            // Bubble up to parent (for FloatingClockInToast)
            onNewEvent?.(event);
        });

        return () => {
            socket.disconnect();
        };
    }, [isAdmin, schoolId, onNewEvent]);

    // ── sort: most-recent clock activity first ────────────────────────────────
    const sorted = [...events].sort((a, b) => {
        const aTime = new Date(a.clockOutAt || a.clockInAt || 0).getTime();
        const bTime = new Date(b.clockOutAt || b.clockInAt || 0).getTime();
        return bTime - aTime;
    });

    const presentCount = events.filter((e) => e.clockInAt && !e.clockOutAt).length;
    const outCount = events.filter((e) => e.clockOutAt).length;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">

            {/* ── header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Activity size={14} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Clock-In Feed</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                {presentCount} active
                            </span>
                            {outCount > 0 && (
                                <span className="text-[10px] text-slate-400">{outCount} clocked out</span>
                            )}
                            <span className="text-[10px] text-slate-400">{events.length} total today</span>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── body ── */}
            <div
                ref={listRef}
                className="divide-y divide-slate-50 overflow-y-auto"
                style={{ maxHeight: 420 }}
            >
                {loading && events.length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
                        <RefreshCw size={14} className="animate-spin" />
                        Loading activity…
                    </div>
                )}

                {!loading && error && (
                    <div className="flex items-center gap-2 px-4 py-4 text-rose-600 text-xs">
                        <AlertTriangle size={14} className="shrink-0" />
                        {error}
                    </div>
                )}

                {!loading && !error && sorted.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
                        <Users size={28} className="opacity-30" />
                        <p className="text-xs">No staff have clocked in today yet.</p>
                    </div>
                )}

                {sorted.map((event) => (
                    <FeedRow
                        key={event.userId}
                        event={event}
                        isNew={newIds.has(event.userId)}
                    />
                ))}
            </div>

            {/* ── footer ── */}
            {sorted.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-50 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Clock size={10} />
                    Updates live · today only
                </div>
            )}
        </div>
    );
};

export default AdminClockInLiveFeed;
