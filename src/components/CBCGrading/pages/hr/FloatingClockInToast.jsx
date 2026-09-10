/**
 * FloatingClockInToast
 *
 * Floating bottom-right popup that appears on an admin's desktop when any
 * staff member clocks in or out in real time.
 *
 * - Receives clock events via the `events` prop (pushed from AdminClockInLiveFeed
 *   via onNewEvent callback)
 * - Stacks up to 3 toasts; oldest auto-dismiss after 8 seconds
 * - Plays a soft chime via the Web Audio API (no asset file needed)
 * - Dismissible individually or all at once
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, LogIn, LogOut, X } from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const initials = (name = '') =>
    name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '??';

const COLOURS = [
    'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
];

const avatarColour = (name) => COLOURS[(name?.charCodeAt(0) || 0) % COLOURS.length];

// Soft double-chime via Web Audio API — no file dependency
const playChime = (type = 'CLOCK_IN') => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = type === 'CLOCK_OUT' ? [523, 440] : [440, 523]; // down vs up
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = ctx.currentTime + i * 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    } catch {
        // AudioContext not available — silent failure
    }
};

// ── single toast ──────────────────────────────────────────────────────────────

const Toast = ({ event, onDismiss }) => {
    const isClockin = event.eventType === 'CLOCK_IN';
    const time = isClockin ? fmt(event.clockInAt) : fmt(event.clockOutAt);

    return (
        <div
            className="flex items-start gap-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5
                       animate-in slide-in-from-right-4 fade-in duration-300"
        >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColour(event.fullName)}`}>
                {event.profilePicture
                    ? <img src={event.profilePicture} alt={event.fullName} className="w-10 h-10 rounded-full object-cover" />
                    : initials(event.fullName)
                }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    {isClockin
                        ? (event.isLate
                            ? <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                            : <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />)
                        : <LogOut size={12} className="text-slate-400 shrink-0" />
                    }
                    <span className="text-xs font-bold text-slate-900 truncate">{event.fullName}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug capitalize">
                    {isClockin
                        ? (event.isLate
                            ? `Clocked in late at ${time} · ${event.lateMinutes}m after start`
                            : `Clocked in on time · ${time}`)
                        : `Clocked out at ${time}${event.workedMinutes > 0 ? ` · ${Math.floor(event.workedMinutes / 60)}h ${event.workedMinutes % 60}m worked` : ''}`
                    }
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{String(event.role || '').toLowerCase()}</p>
            </div>

            {/* Dismiss */}
            <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
                <X size={11} />
            </button>
        </div>
    );
};

// ── main component ────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 8000;

const FloatingClockInToast = ({ latestEvent }) => {
    const [toasts, setToasts] = useState([]);
    const timerRefs = useRef({});
    const lastEventIdRef = useRef(null);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        clearTimeout(timerRefs.current[id]);
        delete timerRefs.current[id];
    }, []);

    // When a new event arrives from the parent, add a toast
    useEffect(() => {
        if (!latestEvent) return;

        // Deduplicate — same user + same eventType should not stack
        const eventKey = `${latestEvent.userId}:${latestEvent.eventType}:${latestEvent.clockInAt || latestEvent.clockOutAt}`;
        if (lastEventIdRef.current === eventKey) return;
        lastEventIdRef.current = eventKey;

        const id = `${Date.now()}-${Math.random()}`;
        const toast = { ...latestEvent, id };

        setToasts((prev) => {
            const next = [toast, ...prev].slice(0, MAX_TOASTS);
            return next;
        });

        // Play chime
        playChime(latestEvent.eventType);

        // Auto-dismiss
        timerRefs.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }, [latestEvent, dismiss]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(timerRefs.current).forEach(clearTimeout);
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
            aria-live="polite"
            aria-label="Staff attendance notifications"
        >
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast event={toast} onDismiss={() => dismiss(toast.id)} />
                </div>
            ))}
        </div>
    );
};

export default FloatingClockInToast;
