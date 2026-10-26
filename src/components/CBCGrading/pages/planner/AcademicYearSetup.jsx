/**
 * AcademicYearSetup
 *
 * The one screen an admin needs for term dates. All three terms, their
 * mid-term break and exam week, checked together and shown on a single
 * year-at-a-glance bar before anything is saved.
 *
 * Saving writes term settings (which own the term itself) and the planner's
 * opening, closing, mid-term and exam events in one step, so the two cannot
 * drift apart.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Info, Loader2, Save } from 'lucide-react';
import api from '../../../../services/api';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';

const TERMS = [
  { id: 'TERM_1', label: 'Term 1', bar: 'bg-blue-500' },
  { id: 'TERM_2', label: 'Term 2', bar: 'bg-purple-500' },
  { id: 'TERM_3', label: 'Term 3', bar: 'bg-indigo-500' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY_TERM = { startDate: '', endDate: '', midtermStart: '', midtermEnd: '', examStart: '', examEnd: '' };
const emptyForm = () => ({ TERM_1: { ...EMPTY_TERM }, TERM_2: { ...EMPTY_TERM }, TERM_3: { ...EMPTY_TERM } });

const MS_DAY = 24 * 60 * 60 * 1000;
const utc = (key) => Date.parse(`${key}T00:00:00Z`);

/** Position of a date on the year bar, 0-100. */
const yearPct = (key, year) => {
  const start = Date.UTC(year, 0, 1);
  const total = (Date.UTC(year + 1, 0, 1) - start) / MS_DAY;
  return Math.min(100, Math.max(0, ((utc(key) - start) / MS_DAY / total) * 100));
};

const termLabel = (id) => `Term ${String(id).slice(-1)}`;
const formatDay = (key) =>
  key ? new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

function DateField({ label, value, onChange, min, max }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</Label>
      <Input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function YearBar({ form, year }) {
  return (
    <div className="space-y-2">
      <div className="relative h-8 rounded-xl bg-slate-100 overflow-hidden" role="img" aria-label={`Academic year ${year} term layout`}>
        {TERMS.map((t) => {
          const f = form[t.id];
          if (!f.startDate || !f.endDate) return null;
          const left = yearPct(f.startDate, year);
          const width = Math.max(1, yearPct(f.endDate, year) - left);
          return (
            <div
              key={t.id}
              className={`absolute inset-y-0 ${t.bar} opacity-90 flex items-center justify-center text-[10px] font-extrabold text-white`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${t.label}: ${formatDay(f.startDate)} to ${formatDay(f.endDate)}`}
            >
              {width > 8 ? t.label : ''}
            </div>
          );
        })}
        {TERMS.map((t) => {
          const f = form[t.id];
          return [
            f.midtermStart && f.midtermEnd ? { k: `${t.id}-m`, s: f.midtermStart, e: f.midtermEnd, c: 'bg-amber-300', n: 'Mid-term break' } : null,
            f.examStart && f.examEnd ? { k: `${t.id}-e`, s: f.examStart, e: f.examEnd, c: 'bg-rose-400', n: 'Exam week' } : null,
          ]
            .filter(Boolean)
            .map((seg) => {
              const left = yearPct(seg.s, year);
              const width = Math.max(0.8, yearPct(seg.e, year) - left);
              return (
                <div
                  key={seg.k}
                  className={`absolute bottom-0 h-2 ${seg.c}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${termLabel(t.id)} ${seg.n}: ${formatDay(seg.s)} to ${formatDay(seg.e)}`}
                />
              );
            });
        })}
      </div>
      <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase text-center">
        {MONTHS.map((m) => <span key={m}>{m}</span>)}
      </div>
      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 bg-amber-300 rounded-sm" />Mid-term break</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 bg-rose-400 rounded-sm" />Exam week</span>
      </div>
    </div>
  );
}

export default function AcademicYearSetup({ academicYear, onSaved, onDirtyChange }) {
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [activeTerm, setActiveTerm] = useState('');
  const [sources, setSources] = useState({});
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');

  const isComplete = TERMS.every((t) => form[t.id].startDate && form[t.id].endDate);

  // Tell the page when there are unsaved edits, so it can ask before they are thrown away.
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  useEffect(() => {
    if (dirtyCallback.current) dirtyCallback.current(dirty);
  }, [dirty]);
  useEffect(() => () => {
    if (dirtyCallback.current) dirtyCallback.current(false);
  }, []);

  const buildPlan = useCallback(() => ({
    academicYear,
    terms: TERMS.map((t) => {
      const f = form[t.id];
      return {
        term: t.id,
        startDate: f.startDate,
        endDate: f.endDate,
        midtermStart: f.midtermStart || null,
        midtermEnd: f.midtermEnd || null,
        examStart: f.examStart || null,
        examEnd: f.examEnd || null,
      };
    }),
    ...(activeTerm ? { activeTerm } : {}),
  }), [academicYear, form, activeTerm]);

  // Load what is already saved for this year.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.planner.getAcademicYearSetup(academicYear);
        const data = res?.data ?? res;
        if (cancelled) return;
        const next = emptyForm();
        const nextSources = {};
        (data?.terms || []).forEach((t) => {
          if (!next[t.term]) return;
          next[t.term] = {
            startDate: t.startDate || '',
            endDate: t.endDate || '',
            midtermStart: t.midtermStart || '',
            midtermEnd: t.midtermEnd || '',
            examStart: t.examStart || '',
            examEnd: t.examEnd || '',
          };
          nextSources[t.term] = t.source;
        });
        setForm(next);
        setSources(nextSources);
        setActiveTerm(data?.activeTerm || '');
        setPreview(null);
        setConfirmed(false);
        setDirty(false);
      } catch (error) {
        console.error('Failed to load academic year setup', error);
        toast.error('Could not load the academic year');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [academicYear]);

  // Check the whole year whenever it changes.
  useEffect(() => {
    if (!isComplete) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await api.planner.checkAcademicYearSetup(buildPlan());
        if (!cancelled) setPreview(res?.data ?? res);
      } catch (error) {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isComplete, buildPlan]);

  const setField = (termId, field, value) => {
    setConfirmed(false);
    setDirty(true);
    setForm((prev) => ({ ...prev, [termId]: { ...prev[termId], [field]: value } }));
  };

  const needsConfirm = Boolean(preview?.requiresConfirmation);
  const canSave = Boolean(preview?.valid) && !checking && !saving && (!needsConfirm || confirmed);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.planner.saveAcademicYearSetup({
        ...buildPlan(),
        confirmRunningTermChange: confirmed,
        reason: reason.trim() || undefined,
      });
      const data = res?.data ?? res;
      const replaced = data?.replacedLegacyEvents || 0;
      toast.success(
        replaced
          ? `Academic year ${academicYear} saved. ${replaced} older planner date${replaced === 1 ? '' : 's'} replaced.`
          : `Academic year ${academicYear} saved`,
      );
      setConfirmed(false);
      setReason('');
      setDirty(false);
      setSources({ TERM_1: 'settings', TERM_2: 'settings', TERM_3: 'settings' });
      if (onSaved) onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to save the academic year');
    } finally {
      setSaving(false);
    }
  };

  const fromPlannerOnly = useMemo(
    () => TERMS.filter((t) => sources[t.id] === 'planner').map((t) => t.label),
    [sources],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
        <div>
          <p className="font-bold">Set up the academic year {academicYear}</p>
          <p className="mt-1 text-blue-700">
            Enter all three terms here. Their opening, closing, mid-term and exam dates feed the term countdown, fees and
            attendance, so this is the only place dates need to be entered. Overlaps and gaps are checked before you save.
          </p>
        </div>
      </div>

      {fromPlannerOnly.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          {fromPlannerOnly.join(', ')} {fromPlannerOnly.length === 1 ? 'was' : 'were'} filled in from earlier planner events.
          Save to move {fromPlannerOnly.length === 1 ? 'it' : 'them'} into the term settings.
        </div>
      )}

      {TERMS.map((t) => {
        const f = form[t.id];
        const closed = Boolean(preview && preview.errors.some((e) => e.startsWith(`${t.label} is closed`)));
        return (
          <section key={t.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <header className="flex items-center gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200">
              <span className={`h-3 w-3 rounded-full ${t.bar}`} />
              <h3 className="font-extrabold text-slate-800">{t.label}</h3>
              {closed && <span className="text-xs font-bold text-rose-600">Closed</span>}
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Term dates</h4>
                <DateField label="Opens" value={f.startDate} onChange={(v) => setField(t.id, 'startDate', v)} />
                <DateField label="Closes" value={f.endDate} min={f.startDate || undefined} onChange={(v) => setField(t.id, 'endDate', v)} />
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Mid-term break <span className="font-medium normal-case text-slate-400">(optional)</span></h4>
                <DateField label="From" value={f.midtermStart} min={f.startDate || undefined} max={f.endDate || undefined} onChange={(v) => setField(t.id, 'midtermStart', v)} />
                <DateField label="To" value={f.midtermEnd} min={f.midtermStart || f.startDate || undefined} max={f.endDate || undefined} onChange={(v) => setField(t.id, 'midtermEnd', v)} />
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Exam week <span className="font-medium normal-case text-slate-400">(optional)</span></h4>
                <DateField label="From" value={f.examStart} min={f.startDate || undefined} max={f.endDate || undefined} onChange={(v) => setField(t.id, 'examStart', v)} />
                <DateField label="To" value={f.examEnd} min={f.examStart || f.startDate || undefined} max={f.endDate || undefined} onChange={(v) => setField(t.id, 'examEnd', v)} />
              </div>
            </div>
          </section>
        );
      })}

      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-extrabold text-slate-800">Year at a glance</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="active-term" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current term</Label>
            <select
              id="active-term"
              value={activeTerm}
              onChange={(e) => { setConfirmed(false); setDirty(true); setActiveTerm(e.target.value); }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Automatic (term containing today)</option>
              {TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <YearBar form={form} year={academicYear} />

        {preview?.breaks?.length > 0 && (
          <ul className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
            {preview.breaks.map((b) => (
              <li key={`${b.after}-${b.before}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
                {b.days} day{b.days === 1 ? '' : 's'} between {termLabel(b.after)} and {termLabel(b.before)}
              </li>
            ))}
          </ul>
        )}

        {!isComplete && (
          <p className="text-sm text-slate-500">Enter the opening and closing dates of all three terms to check the year.</p>
        )}

        {checking && (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Checking the year…</p>
        )}

        {preview && !checking && preview.errors.length > 0 && (
          <ul className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 space-y-1.5">
            {preview.errors.map((e) => (
              <li key={e} className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{e}</li>
            ))}
          </ul>
        )}

        {preview && !checking && preview.warnings.length > 0 && (
          <ul className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1.5">
            {preview.warnings.map((w) => (
              <li key={w} className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{w}</li>
            ))}
          </ul>
        )}

        {preview?.valid && !checking && preview.errors.length === 0 && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />No overlaps. The year is ready to save.
          </p>
        )}

        {needsConfirm && (
          <div className="rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>I understand a term that has already started will change, and that this is recorded.</span>
            </label>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason (optional)</Label>
              <Input value={reason} maxLength={500} placeholder="e.g. Ministry changed the opening date" onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex justify-end border-t pt-5">
          <Button onClick={handleSave} disabled={!canSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save academic year {academicYear}
          </Button>
        </div>
      </section>
    </div>
  );
}
