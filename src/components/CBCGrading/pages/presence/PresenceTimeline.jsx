/**
 * PresenceTimeline
 * Shows a learner's full-day presence timeline.
 * Used by teachers and admins — parents see this via ParentPortalAttendance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, MapPin, Bus, Home, Utensils, BookOpen,
  Clock, ChevronLeft, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import api from '../../../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const EVENT_ICONS = {
  CLASS_ATTENDANCE:  Activity,
  GATE_ENTRY:        MapPin,
  GATE_EXIT:         MapPin,
  BUS_BOARDED:       Bus,
  BUS_ALIGHTED:      Bus,
  DORM_ROLL_CALL:    Home,
  DINING_ATTENDED:   Utensils,
  PREP_ATTENDED:     BookOpen,
  CLOCK_IN:          Clock,
  CLOCK_OUT:         Clock,
  EXEAT_DEPARTED:    ChevronRight,
  EXEAT_RETURNED:    ChevronLeft,
  default:           Activity,
};

const EVENT_COLORS = {
  CLASS_ATTENDANCE:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  GATE_ENTRY:        'bg-blue-50 border-blue-200 text-blue-700',
  GATE_EXIT:         'bg-slate-50 border-slate-200 text-slate-600',
  BUS_BOARDED:       'bg-amber-50 border-amber-200 text-amber-700',
  BUS_ALIGHTED:      'bg-amber-50 border-amber-200 text-amber-600',
  DORM_ROLL_CALL:    'bg-indigo-50 border-indigo-200 text-indigo-700',
  DINING_ATTENDED:   'bg-orange-50 border-orange-200 text-orange-700',
  PREP_ATTENDED:     'bg-purple-50 border-purple-200 text-purple-700',
  CLOCK_IN:          'bg-teal-50 border-teal-200 text-teal-700',
  CLOCK_OUT:         'bg-teal-50 border-teal-200 text-teal-600',
  default:           'bg-gray-50 border-gray-200 text-gray-600',
};

const SOURCE_BADGE = {
  BIOMETRIC: { label: 'Biometric', cls: 'bg-emerald-100 text-emerald-700' },
  DRIVER:    { label: 'Driver',    cls: 'bg-amber-100 text-amber-700' },
  MANUAL:    { label: 'Manual',    cls: 'bg-gray-100 text-gray-600' },
  SYSTEM:    { label: 'System',    cls: 'bg-slate-100 text-slate-600' },
};

const isoDate = (d) => d.toISOString().slice(0, 10);
const prettyDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// ── Main component ────────────────────────────────────────────────────────────

const PresenceTimeline = ({ learnerId, learnerName, grade, compact = false }) => {
  const [date, setDate]     = useState(isoDate(new Date()));
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const fetchTimeline = useCallback(async (d) => {
    if (!learnerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.presence.getLearnerTimeline(learnerId, d);
      if (res?.success) setData(res.data);
      else setError('Could not load presence data');
    } catch {
      setError('Failed to load presence timeline');
    } finally {
      setLoading(false);
    }
  }, [learnerId]);

  useEffect(() => { fetchTimeline(date); }, [fetchTimeline, date]);

  const shiftDate = (delta) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    const next = isoDate(d);
    const today = isoDate(new Date());
    if (next > today) return; // don't go future
    setDate(next);
  };

  const isToday = date === isoDate(new Date());

  return (
    <div className={compact ? '' : 'max-w-2xl mx-auto'}>
      {/* Date navigator */}
      <div className="flex items-center justify-between mb-4">
        {!compact && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {learnerName ?? 'Presence Timeline'}
            </h2>
            {grade && <p className="text-sm text-gray-400">{grade}</p>}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {isToday ? 'Today' : prettyDate(date).split(',').slice(0, 2).join(',')}
          </span>
          <button
            onClick={() => shiftDate(1)}
            disabled={isToday}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition disabled:opacity-30"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading timeline…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Activity size={32} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No presence events recorded</p>
              <p className="text-xs mt-1">
                {isToday ? 'Events will appear here as the day progresses' : `No activity recorded for ${prettyDate(date)}`}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[23px] top-3 bottom-3 w-px bg-gray-100" />

              <div className="space-y-3">
                {data.events.map((ev) => {
                  const Icon = EVENT_ICONS[ev.eventType] ?? EVENT_ICONS.default;
                  const colorCls = EVENT_COLORS[ev.eventType] ?? EVENT_COLORS.default;
                  const sourceBadge = SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.MANUAL;

                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      {/* Icon dot */}
                      <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border ${colorCls} z-10`}>
                        <Icon size={18} />
                      </div>

                      {/* Card */}
                      <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-tight">
                              {ev.description}
                            </p>
                            {ev.location && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <MapPin size={11} />
                                {ev.location}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-500">
                              {formatTime(ev.timestamp)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sourceBadge.cls}`}>
                              {sourceBadge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary footer */}
          {data.events.length > 0 && (
            <div className="mt-4 flex items-center gap-3 text-xs text-gray-400 px-1">
              <Activity size={12} />
              <span>{data.eventCount} event{data.eventCount !== 1 ? 's' : ''} recorded</span>
              {data.events[0] && (
                <>
                  <span>·</span>
                  <span>First at {formatTime(data.events[0].timestamp)}</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PresenceTimeline;
