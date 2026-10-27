import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../../../../services/api';
import { Plus, Video, RefreshCw, CalendarPlus, Download, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../ui/sheet';
import { Button } from '../../../ui/button';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import EventAudiencePicker from './EventAudiencePicker';
import {
  buildGoogleCalendarUrl,
  buildIcsEventContent,
  downloadIcsFile,
} from './calendarExternalLinks';

const locales = { 'en-US': enUS };

/**
 * react-big-calendar wraps values with `new Date(value)` then calls this. Undefined/invalid
 * values become Invalid Date and date-fns `format` throws RangeError — guard here.
 */
function safeLocalizerFormat(dateInput, formatString, options) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!isValid(d)) return '';
  try {
    return format(d, formatString, options);
  } catch {
    return '';
  }
}

const localizer = dateFnsLocalizer({
  format: safeLocalizerFormat,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const EVENT_TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'EXAM', label: 'Exam' },
  { value: 'TERM_OPENING', label: 'Term opening' },
  { value: 'TERM_CLOSING', label: 'Term closing' },
  { value: 'MIDTERM_BREAK', label: 'Mid-term break' },
  { value: 'EXAM_WEEK', label: 'Exam week' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'TRIP', label: 'Trip' },
  { value: 'STAFF_EVENT', label: 'Staff event' },
  { value: 'PARENT_EVENT', label: 'Parent event' },
  { value: 'NATIONAL_EVENT', label: 'National event' },
  { value: 'OTHER', label: 'Other' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/** Next full hour → +1 hour window */
function defaultTimedRange() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  if (start <= new Date()) {
    start.setHours(start.getHours() + 1);
  }
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start, end };
}

/** RBC month slots: end is exclusive start-of-next-day */
function slotToAllDayStrings(slotStart, slotEnd) {
  const startDay = new Date(slotStart.getFullYear(), slotStart.getMonth(), slotStart.getDate());
  const endDayStart = new Date(slotEnd.getFullYear(), slotEnd.getMonth(), slotEnd.getDate());
  const lastInclusive = new Date(endDayStart);
  lastInclusive.setDate(lastInclusive.getDate() - 1);
  if (lastInclusive < startDay) {
    return { startStr: toDateInputValue(startDay), endStr: toDateInputValue(startDay) };
  }
  return { startStr: toDateInputValue(startDay), endStr: toDateInputValue(lastInclusive) };
}

function safeDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
}

function emptyForm() {
  return {
    title: '',
    description: '',
    allDay: false,
    startLocal: '',
    endLocal: '',
    startDateOnly: '',
    endDateOnly: '',
    type: 'GENERAL',
    location: '',
    meetingLink: '',
    audience: [],
    classIds: [],
  };
}

const CalendarView = () => {
  const { isAnyRole } = usePermissions();
  const canCreateEvents = isAnyRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());
  const [monthLabel, setMonthLabel] = useState('');
  const requestSequence = useRef(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPhase, setCreatePhase] = useState('form'); // 'form' | 'success'
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [successMeta, setSuccessMeta] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const getMonthRange = (referenceDate) => {
    const ref = isValid(referenceDate) ? referenceDate : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  useEffect(() => {
    const ref = isValid(date) ? date : new Date();
    setMonthLabel(format(ref, 'MMMM yyyy'));
  }, [date]);

  const fetchEvents = useCallback(async (params = {}) => {
    const requestId = ++requestSequence.current;
    try {
      setLoading(true);
      const response = await api.planner.getEvents(params);
      if (requestId === requestSequence.current && response.success) {
        const formattedEvents = (response.data || [])
          .map((evt) => {
            let start = safeDate(evt.startDate);
            let end = safeDate(evt.endDate);
            if (!start || !end) return null;
            if (end <= start) {
              end = new Date(start.getTime() + 60 * 60 * 1000);
            }
            return {
              id: evt.id,
              title: evt.title || 'Untitled',
              start,
              end,
              allDay: evt.allDay,
              resource: { ...evt, startDate: start.toISOString(), endDate: end.toISOString() },
            };
          })
          .filter(Boolean);
        setEvents(formattedEvents);
      }
    } catch (error) {
      if (requestId === requestSequence.current) {
        console.error('Error fetching events:', error);
        toast.error('Calendar is temporarily unavailable. Please try again shortly.');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  const fetchCurrentMonthEvents = useCallback(async () => {
    await fetchEvents(getMonthRange(date));
  }, [date, fetchEvents]);

  useEffect(() => {
    fetchCurrentMonthEvents();
  }, [fetchCurrentMonthEvents]);

  const openCreateDefaults = useCallback(() => {
    const { start, end } = defaultTimedRange();
    setForm({
      ...emptyForm(),
      allDay: false,
      startLocal: toDatetimeLocalValue(start),
      endLocal: toDatetimeLocalValue(end),
    });
    setCreatePhase('form');
    setSuccessMeta(null);
    setCreateOpen(true);
  }, []);

  const handleSelectSlot = useCallback(
    ({ start, end }) => {
      const useAllDay = view === 'month';
      if (useAllDay) {
        const { startStr, endStr } = slotToAllDayStrings(start, end);
        setForm({
          ...emptyForm(),
          allDay: true,
          startDateOnly: startStr,
          endDateOnly: endStr,
        });
      } else {
        setForm({
          ...emptyForm(),
          allDay: false,
          startLocal: toDatetimeLocalValue(start),
          endLocal: toDatetimeLocalValue(end),
        });
      }
      setCreatePhase('form');
      setSuccessMeta(null);
      setCreateOpen(true);
    },
    [view]
  );

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreatePhase('form');
    setSuccessMeta(null);
    setForm(emptyForm());
  };

  const buildCreatePayload = () => {
    const title = form.title.trim();
    if (title.length < 2) {
      toast.error('Title must be at least 2 characters');
      return null;
    }

    let startDate;
    let endDate;
    if (form.allDay) {
      if (!form.startDateOnly || !form.endDateOnly) {
        toast.error('Please choose start and end dates');
        return null;
      }
      const [sy, sm, sd] = form.startDateOnly.split('-').map(Number);
      const [ey, em, ed] = form.endDateOnly.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString();
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
      if (new Date(endDate) < new Date(startDate)) {
        toast.error('End date must be on or after start date');
        return null;
      }
    } else {
      if (!form.startLocal || !form.endLocal) {
        toast.error('Please set start and end date/time');
        return null;
      }
      startDate = new Date(form.startLocal).toISOString();
      endDate = new Date(form.endLocal).toISOString();
      if (new Date(endDate) <= new Date(startDate)) {
        toast.error('End must be after start');
        return null;
      }
    }

    const payload = {
      title,
      startDate,
      endDate,
      allDay: form.allDay,
      type: form.type,
      audience: form.audience,
      classIds: form.classIds,
    };
    const desc = form.description.trim();
    if (desc) payload.description = desc;
    const loc = form.location.trim();
    if (loc) payload.location = loc;
    const link = form.meetingLink.trim();
    if (link) payload.meetingLink = link;
    return payload;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const payload = buildCreatePayload();
    if (!payload) return;

    setSaving(true);
    try {
      const res = await api.planner.createEvent(payload);
      if (res?.success) {
        toast.success('Event saved');
        await fetchCurrentMonthEvents();
        const start = new Date(payload.startDate);
        const end = new Date(payload.endDate);
        setSuccessMeta({
          title: payload.title,
          start,
          end,
          allDay: payload.allDay,
          description: payload.description || '',
          location: payload.location || '',
        });
        setCreatePhase('success');
      } else {
        toast.error(res?.message || 'Could not create event');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not create event';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEvent = (calEvent) => {
    setSelectedEvent(calEvent);
    setDetailOpen(true);
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3174ad';
    const t = event.resource?.type;
    if (t === 'HOLIDAY') backgroundColor = '#e53e3e';
    if (t === 'MEETING') backgroundColor = '#805ad5';
    if (event.resource?.meetingLink) backgroundColor = '#38a169';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  const googleUrlForEventResource = (evt) => {
    if (!evt) return '#';
    const start = safeDate(evt.startDate);
    const end = safeDate(evt.endDate);
    if (!start || !end) return '#';
    return buildGoogleCalendarUrl({
      title: evt.title,
      start,
      end,
      allDay: !!evt.allDay,
      description: evt.description || '',
      location: evt.location || '',
    });
  };

  const downloadIcsForResource = (evt) => {
    if (!evt) return;
    const start = safeDate(evt.startDate);
    const end = safeDate(evt.endDate);
    if (!start || !end) {
      toast.error('Cannot export: invalid event dates');
      return;
    }
    const uid = `${evt.id || crypto.randomUUID()}@trendscore`;
    const ics = buildIcsEventContent({
      uid,
      title: evt.title,
      start,
      end,
      allDay: !!evt.allDay,
      description: evt.description || '',
      location: evt.location || '',
    });
    const safe = (evt.title || 'event').replace(/[^\w\s-]/g, '').slice(0, 60) || 'event';
    downloadIcsFile(safe, ics);
  };

  return (
    <div className="h-[calc(100vh-140px)] bg-white rounded-lg shadow p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            {format(isValid(date) ? date : new Date(), 'MMMM yyyy')}
          </h2>
          <p className="text-sm text-gray-500">
            Showing events for:{' '}
            <span className="font-medium text-gray-700">{monthLabel}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchCurrentMonthEvents()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          {canCreateEvents && <button
            type="button"
            onClick={openCreateDefaults}
            className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-teal-700 transition"
          >
            <Plus size={18} />
            Create Event
          </button>}
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        view={view}
        onView={setView}
        date={isValid(date) ? date : new Date()}
        onNavigate={(next) => {
          const d = next instanceof Date ? next : safeDate(next);
          if (d) setDate(d);
        }}
        selectable={canCreateEvents}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day', 'agenda']}
      />

      <Sheet open={createOpen} onOpenChange={(o) => !o && closeCreateModal()}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-white border-l border-gray-200 shadow-2xl">
          {createPhase === 'form' ? (
            <form onSubmit={handleCreateSubmit} className="flex flex-col h-full min-h-0">
              <SheetHeader className="px-6 py-5 border-b border-gray-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2 text-brand-teal mb-1">
                  <CalendarPlus className="h-4 w-4" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-teal-700">Academic &amp; School Planner</span>
                </div>
                <SheetTitle className="text-xl font-bold text-gray-900">Create Event</SheetTitle>
                <SheetDescription>
                  Saved to the school planner. After saving, you can instantly sync reminders to Google Calendar or export an .ics file.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
                <div className="grid gap-2">
                  <Label htmlFor="evt-title">Title *</Label>
                  <Input
                    id="evt-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Staff meeting, Sports day, Midterm exams"
                    required
                    minLength={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="evt-type">Event Type</Label>
                  <select
                    id="evt-type"
                    className="flex h-10 w-full rounded-lg border-2 border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {EVENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <input
                    id="evt-allday"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                    checked={form.allDay}
                    onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  />
                  <Label htmlFor="evt-allday" className="font-medium text-gray-800 cursor-pointer">
                    All-day event (no specific start/end times)
                  </Label>
                </div>

                {form.allDay ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="evt-start-d">Start date</Label>
                      <Input
                        id="evt-start-d"
                        type="date"
                        value={form.startDateOnly}
                        onChange={(e) => setForm((f) => ({ ...f, startDateOnly: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="evt-end-d">End date</Label>
                      <Input
                        id="evt-end-d"
                        type="date"
                        value={form.endDateOnly}
                        onChange={(e) => setForm((f) => ({ ...f, endDateOnly: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="evt-start">Starts</Label>
                      <Input
                        id="evt-start"
                        type="datetime-local"
                        value={form.startLocal}
                        onChange={(e) => setForm((f) => ({ ...f, startLocal: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="evt-end">Ends</Label>
                      <Input
                        id="evt-end"
                        type="datetime-local"
                        value={form.endLocal}
                        onChange={(e) => setForm((f) => ({ ...f, endLocal: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="evt-desc">Description (optional)</Label>
                  <Textarea
                    id="evt-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Details or notes for attendees"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="evt-loc">Location (optional)</Label>
                    <Input
                      id="evt-loc"
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Main Hall, Sports Field"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="evt-link">Meeting Link (optional)</Label>
                    <Input
                      id="evt-link"
                      type="url"
                      value={form.meetingLink}
                      onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))}
                      placeholder="https://meet.google.com/…"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <EventAudiencePicker
                    audience={form.audience}
                    classIds={form.classIds}
                    onChange={({ audience, classIds }) => setForm((f) => ({ ...f, audience, classIds }))}
                  />
                </div>
              </div>

              <SheetFooter className="px-6 py-4 border-t border-gray-100 bg-slate-50/80 shrink-0 gap-3 sm:gap-2">
                <Button type="button" variant="secondary" onClick={closeCreateModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-brand-teal hover:bg-teal-700 text-white gap-2">
                  {saving ? 'Saving…' : 'Save Event'}
                </Button>
              </SheetFooter>
            </form>
          ) : (
            <div className="flex flex-col h-full min-h-0">
              <SheetHeader className="px-6 py-5 border-b border-gray-100 bg-teal-50/50 shrink-0">
                <div className="flex items-center gap-2 text-teal-700 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                  <span className="text-[11px] font-bold tracking-wider uppercase">Event Created</span>
                </div>
                <SheetTitle className="text-xl font-bold text-gray-900">Event Saved to Planner</SheetTitle>
                <SheetDescription>
                  Reminders can be added to your personal or staff calendars using Google Calendar or an .ics file download.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <div className="font-semibold text-gray-900 text-base">{successMeta?.title || form.title}</div>
                  <div className="text-xs text-gray-500">
                    {form.allDay ? `${form.startDateOnly} to ${form.endDateOnly}` : `${form.startLocal} - ${form.endLocal}`}
                  </div>
                  {form.location && <div className="text-xs text-gray-600">📍 {form.location}</div>}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full gap-2 border-teal-600 text-teal-800 hover:bg-teal-50"
                  >
                    <a
                      href={
                        successMeta
                          ? buildGoogleCalendarUrl({
                              title: successMeta.title,
                              start: successMeta.start,
                              end: successMeta.end,
                              allDay: successMeta.allDay,
                              description: successMeta.description,
                              location: successMeta.location,
                            })
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CalendarPlus size={18} />
                      Add to Google Calendar
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => {
                      if (!successMeta) return;
                      const uid = `${crypto.randomUUID()}@trendscore`;
                      const ics = buildIcsEventContent({
                        uid,
                        title: successMeta.title,
                        start: successMeta.start,
                        end: successMeta.end,
                        allDay: successMeta.allDay,
                        description: successMeta.description,
                        location: successMeta.location,
                      });
                      const safe = (successMeta.title || 'event').replace(/[^\w\s-]/g, '').slice(0, 60) || 'event';
                      downloadIcsFile(safe, ics);
                    }}
                  >
                    <Download size={18} />
                    Download .ics (Apple / Outlook)
                  </Button>
                </div>
              </div>
              <SheetFooter className="px-6 py-4 border-t border-gray-100 bg-slate-50/80 shrink-0">
                <Button type="button" onClick={closeCreateModal} className="w-full sm:w-auto bg-brand-teal hover:bg-teal-700 text-white">
                  Done
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-gray-600">
                {selectedEvent?.resource?.description && (
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedEvent.resource.description}</p>
                )}
                <p>
                  {(() => {
                    const s = selectedEvent?.start;
                    const en = selectedEvent?.end;
                    if (!s || !en || !isValid(s) || !isValid(en)) {
                      return 'Date/time unavailable';
                    }
                    return selectedEvent.allDay
                      ? `${format(s, 'PPP')} – ${format(en, 'PPP')}`
                      : `${format(s, 'PPp')} – ${format(en, 'PPp')}`;
                  })()}
                </p>
                {selectedEvent?.resource?.location && (
                  <p>
                    <span className="font-medium text-gray-700">Location:</span> {selectedEvent.resource.location}
                  </p>
                )}
                {selectedEvent?.resource?.meetingLink && (
                  <a
                    href={selectedEvent.resource.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-teal font-medium hover:underline"
                  >
                    <Video size={16} />
                    Join link
                  </a>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="secondary" type="button" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            <Button asChild variant="outline" className="flex-1 gap-2">
              <a
                href={googleUrlForEventResource(selectedEvent?.resource)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarPlus size={16} />
                Google Calendar
              </a>
            </Button>
            <Button
              type="button"
              className="gap-2 bg-brand-teal hover:bg-teal-700"
              onClick={() => {
                downloadIcsForResource(selectedEvent?.resource);
              }}
            >
              <Download size={16} />
              .ics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
