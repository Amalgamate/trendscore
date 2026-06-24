import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Calendar, MapPin, ExternalLink, Download, Lock } from 'lucide-react';
import api from '../../../../services/api';
import {
  buildGoogleCalendarUrl,
  buildIcsEventContent,
  downloadIcsFile,
} from '../planner/calendarExternalLinks';

const formatDateTime = (value, allDay = false) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date not available';
  if (allDay) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: '--', month: '---' };
  return {
    day: d.getDate(),
    month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleString('default', { weekday: 'short' }),
  };
};

const EVENT_TYPE_INFO = {
  TERM_OPENING: { label: 'Term Opens', color: 'emerald', border: 'border-emerald-200', bg: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  TERM_CLOSING: { label: 'Term Closes', color: 'rose', border: 'border-rose-200', bg: 'bg-rose-50 text-rose-800', dot: 'bg-rose-500' },
  MIDTERM_BREAK: { label: 'Midterm Break', color: 'amber', border: 'border-amber-200', bg: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  EXAM_WEEK: { label: 'Assessment Week', color: 'indigo', border: 'border-indigo-200', bg: 'bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500' },
  HOLIDAY: { label: 'Public Holiday', color: 'red', border: 'border-red-200', bg: 'bg-red-50 text-red-800', dot: 'bg-red-500' },
  ACADEMIC: { label: 'Academic', color: 'blue', border: 'border-blue-200', bg: 'bg-blue-50 text-blue-800', dot: 'bg-blue-500' },
  SPORTS: { label: 'Sports', color: 'orange', border: 'border-orange-200', bg: 'bg-orange-50 text-orange-800', dot: 'bg-orange-500' },
  MEETING: { label: 'Meeting', color: 'purple', border: 'border-purple-200', bg: 'bg-purple-50 text-purple-800', dot: 'bg-purple-500' },
  GENERAL: { label: 'General', color: 'slate', border: 'border-slate-200', bg: 'bg-slate-50 text-slate-800', dot: 'bg-slate-500' },
};

export default function ParentEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [selectedTerm, setSelectedTerm] = useState('ALL'); // 'ALL', 'TERM_1', 'TERM_2', 'TERM_3'

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch all events for the selected year
      const response = await api.planner.getEvents({ academicYear });
      const raw = response?.data || response || [];
      
      const parsed = raw.map(event => ({
        ...event,
        startDateObj: new Date(event.startDate),
        endDateObj: new Date(event.endDate),
      })).sort((a, b) => a.startDateObj - b.startDateObj);

      setEvents(parsed);
    } catch (err) {
      console.error('Failed to load parent events:', err);
      setError('Unable to load school events right now.');
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  const fetchActiveYear = async () => {
    try {
      const response = await api.config.getActiveTermConfig();
      const active = response?.data ?? response ?? null;
      if (active) {
        if (active.academicYear) {
          setAcademicYear(active.academicYear);
        }
        if (active.term) {
          setSelectedTerm(active.term);
        }
      }
    } catch (error) {
      console.error('Failed to get active term config', error);
    }
  };

  useEffect(() => {
    fetchActiveYear();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleExportGoogle = (event) => {
    const url = buildGoogleCalendarUrl({
      title: event.title,
      start: event.startDateObj,
      end: event.endDateObj,
      allDay: event.allDay,
      description: event.description || '',
      location: event.location || '',
    });
    window.open(url, '_blank');
  };

  const handleExportIcs = (event) => {
    const content = buildIcsEventContent({
      uid: event.id || Math.random().toString(36).substring(2),
      title: event.title,
      start: event.startDateObj,
      end: event.endDateObj,
      allDay: event.allDay,
      description: event.description || '',
      location: event.location || '',
    });
    downloadIcsFile(event.title, content);
  };

  // Filter events by selected term
  const termFilteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedTerm === 'ALL') return true;
      return e.term === selectedTerm;
    });
  }, [events, selectedTerm]);

  // Extract key dates for display cards (opening, closing, midterm, exams)
  const keyDates = useMemo(() => {
    // If term is ALL, we try to match for the active/highest term, or we match first available
    const targetTerm = selectedTerm === 'ALL' ? 'TERM_1' : selectedTerm;
    const termEvents = events.filter(e => e.term === targetTerm);

    const keys = {
      opening: termEvents.find(e => e.type === 'TERM_OPENING'),
      closing: termEvents.find(e => e.type === 'TERM_CLOSING'),
      midterm: termEvents.find(e => e.type === 'MIDTERM_BREAK'),
      exams: termEvents.find(e => e.type === 'EXAM_WEEK'),
    };

    return keys;
  }, [events, selectedTerm]);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      
      {/* Header card with year/term selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            School Calendar & Events
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View term opening/closing dates, upcoming events, exam weeks, and holidays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Year selector */}
          <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 text-sm">
            <span className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Year</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(parseInt(e.target.value, 10))}
              className="bg-transparent border-0 font-bold text-gray-700 focus:ring-0 focus:outline-none pr-8 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Term selector */}
          <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 text-sm">
            <span className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Term</span>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="bg-transparent border-0 font-bold text-gray-700 focus:ring-0 focus:outline-none pr-8 cursor-pointer"
            >
              <option value="ALL">All Terms</option>
              <option value="TERM_1">Term 1</option>
              <option value="TERM_2">Term 2</option>
              <option value="TERM_3">Term 3</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadEvents}
            className="p-2 border rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shrink-0"
            title="Refresh events"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Key Dates Panel */}
      {selectedTerm !== 'ALL' && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 pl-1">Key Term Dates</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Opening Date */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-xl h-14 w-14 border border-emerald-100">
                <span className="text-xs font-bold">{keyDates.opening ? formatShortDate(keyDates.opening.startDate).month : '---'}</span>
                <span className="text-2xl font-extrabold leading-none">{keyDates.opening ? formatShortDate(keyDates.opening.startDate).day : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Term Opens</span>
                <span className="font-bold text-gray-900 text-sm line-clamp-1">{keyDates.opening ? keyDates.opening.title : 'Not set'}</span>
                <span className="text-xs text-gray-500 mt-0.5">{keyDates.opening ? formatShortDate(keyDates.opening.startDate).weekday : ''}</span>
              </div>
            </div>

            {/* Closing Date */}
            <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-rose-50 text-rose-700 rounded-xl h-14 w-14 border border-rose-100">
                <span className="text-xs font-bold">{keyDates.closing ? formatShortDate(keyDates.closing.startDate).month : '---'}</span>
                <span className="text-2xl font-extrabold leading-none">{keyDates.closing ? formatShortDate(keyDates.closing.startDate).day : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Term Closes</span>
                <span className="font-bold text-gray-900 text-sm line-clamp-1">{keyDates.closing ? keyDates.closing.title : 'Not set'}</span>
                <span className="text-xs text-gray-500 mt-0.5">{keyDates.closing ? formatShortDate(keyDates.closing.startDate).weekday : ''}</span>
              </div>
            </div>

            {/* Midterm Break */}
            <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-amber-50 text-amber-700 rounded-xl h-14 w-14 border border-amber-100">
                <span className="text-xs font-bold">{keyDates.midterm ? formatShortDate(keyDates.midterm.startDate).month : '---'}</span>
                <span className="text-2xl font-extrabold leading-none">{keyDates.midterm ? formatShortDate(keyDates.midterm.startDate).day : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Midterm Break</span>
                <span className="font-bold text-gray-900 text-sm line-clamp-1">{keyDates.midterm ? keyDates.midterm.title : 'Not scheduled'}</span>
                {keyDates.midterm && (
                  <span className="text-[10px] text-amber-800 font-medium">
                    Ends: {new Date(keyDates.midterm.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>

            {/* Exam Week */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-700 rounded-xl h-14 w-14 border border-indigo-100">
                <span className="text-xs font-bold">{keyDates.exams ? formatShortDate(keyDates.exams.startDate).month : '---'}</span>
                <span className="text-2xl font-extrabold leading-none">{keyDates.exams ? formatShortDate(keyDates.exams.startDate).day : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Assessments</span>
                <span className="font-bold text-gray-900 text-sm line-clamp-1">{keyDates.exams ? keyDates.exams.title : 'Not scheduled'}</span>
                {keyDates.exams && (
                  <span className="text-[10px] text-indigo-800 font-medium">
                    Ends: {new Date(keyDates.exams.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Events List */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 pl-1">
          {selectedTerm === 'ALL' ? 'Upcoming Year Events' : `Events in ${selectedTerm.replace('_', ' ')}`} ({termFilteredEvents.length})
        </h2>

        {loading ? (
          <div className="bg-white border rounded-2xl p-8 flex justify-center items-center shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl font-semibold shadow-sm text-sm">
            {error}
          </div>
        ) : termFilteredEvents.length === 0 ? (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-400 shadow-sm text-sm">
            No events have been configured or published for this selection yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {termFilteredEvents.map(event => {
              const typeInfo = EVENT_TYPE_INFO[event.type] || EVENT_TYPE_INFO.GENERAL;
              const dateMeta = formatShortDate(event.startDate);
              return (
                <div key={event.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-gray-50 text-gray-600 rounded-xl h-12 w-12 border">
                          <span className="text-[10px] font-bold">{dateMeta.month}</span>
                          <span className="text-lg font-bold leading-none">{dateMeta.day}</span>
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900 line-clamp-1">{event.title || 'Untitled Event'}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase mt-1 ${typeInfo.bg} ${typeInfo.border}`}>
                            <span className={`h-1 w-1 rounded-full ${typeInfo.dot}`}></span>
                            {typeInfo.label}
                          </span>
                        </div>
                      </div>
                      
                      <span className="text-xs text-gray-400 font-medium shrink-0">
                        {event.allDay ? 'All Day' : 'Scheduled'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-sm text-gray-600 border-t pt-3">
                      <p className="flex items-center gap-2">
                        <span className="font-semibold text-gray-500">Starts:</span> 
                        {formatDateTime(event.startDate, event.allDay)}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="font-semibold text-gray-500">Ends:</span> 
                        {formatDateTime(event.endDate, event.allDay)}
                      </p>
                      {event.location && (
                        <p className="flex items-center gap-2 text-gray-500">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{event.location}</span>
                        </p>
                      )}
                    </div>

                    {event.description && (
                      <p className="mt-3 text-xs bg-gray-50 rounded-xl p-3 text-gray-600 leading-relaxed border border-gray-100">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Add to calendar / export actions */}
                  <div className="mt-5 pt-3 border-t flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => handleExportGoogle(event)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors border border-blue-100"
                    >
                      <ExternalLink size={12} />
                      Google Calendar
                    </button>
                    <button
                      onClick={() => handleExportIcs(event)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors border"
                    >
                      <Download size={12} />
                      iCal / Export
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
