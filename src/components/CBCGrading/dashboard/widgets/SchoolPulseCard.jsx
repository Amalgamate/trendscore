/**
 * SchoolPulseCard
 *
 * Compact "School Pulse" widget for the admin dashboard.
 * Shows the 2 most recent activity events and a live pulse indicator.
 * Clicking anywhere opens the full SchoolPulsePage.
 *
 * Props:
 *   onNavigate  — app navigate function
 *   latestEvent — optional Socket.io hr:clock_event to prepend in real time
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ChevronRight, RefreshCw } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { io } from 'socket.io-client';
import { getAuthItem } from '../../../../utils/authStorage';

const CATEGORY_COLOUR = {
    attendance: 'bg-emerald-100 text-emerald-700',
    finance:    'bg-blue-100 text-blue-700',
    auth:       'bg-slate-100 text-slate-600',
    hr:         'bg-violet-100 text-violet-700',
    learners:   'bg-amber-100 text-amber-700',
    system:     'bg-rose-100 text-rose-600',
};

const fmt = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const SchoolPulseCard = ({ onNavigate }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalToday, setTotalToday] = useState(0);
    const socketRef = useRef(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await dashboardAPI.getPulse(20);
            if (resp?.success && Array.isArray(resp.data)) {
                setEvents(resp.data);
                setTotalToday(resp.meta?.total || resp.data.length);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Live updates from Socket.io clock events
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
            const synthesised = {
                id:        `live-${Date.now()}`,
                timestamp: new Date().toISOString(),
                icon:      event.eventType === 'CLOCK_IN' ? '🟢' : '🔴',
                label:     event.eventType === 'CLOCK_IN' ? 'Clocked in' : 'Clocked out',
                category:  'attendance',
                actorName: event.fullName,
                actorRole: event.role,
            };
            setEvents((prev) => [synthesised, ...prev].slice(0, 20));
            setTotalToday((n) => n + 1);
        });

        return () => { socket.disconnect(); };
    }, []);

    const preview = events.slice(0, 2);

    return (
        <button
            type="button"
            onClick={() => onNavigate?.('school-pulse')}
            className="w-full text-left rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden
                       hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                        <Activity size={15} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-blue-100 uppercase tracking-widest">School Pulse</p>
                        <p className="text-xs text-white/80 font-medium">
                            {loading ? 'Loading…' : `${totalToday} events today`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Live dot */}
                    <span className="flex items-center gap-1 text-[10px] text-white/80 font-medium">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        Live
                    </span>
                    <ChevronRight size={15} className="text-white/60" />
                </div>
            </div>

            {/* Event preview */}
            <div className="divide-y divide-slate-50">
                {loading && (
                    <div className="flex items-center gap-2 px-5 py-4 text-slate-400 text-xs">
                        <RefreshCw size={12} className="animate-spin" />
                        Loading activity…
                    </div>
                )}

                {!loading && preview.length === 0 && (
                    <div className="px-5 py-4 text-xs text-slate-400">
                        No activity yet today.
                    </div>
                )}

                {preview.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <span className="text-base shrink-0 leading-none">{event.icon}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-800 truncate">
                                    {event.actorName}
                                </span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLOUR[event.category] || CATEGORY_COLOUR.system}`}>
                                    {event.label}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{event.actorRole?.toLowerCase()}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{fmt(event.timestamp)}</span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50/60 border-t border-blue-100/60">
                <span className="text-[11px] font-semibold text-blue-600">View today's full stream</span>
                <ChevronRight size={13} className="text-blue-500" />
            </div>
        </button>
    );
};

export default SchoolPulseCard;
