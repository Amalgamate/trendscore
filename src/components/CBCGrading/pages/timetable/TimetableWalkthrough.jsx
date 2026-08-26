/**
 * TimetableWalkthrough
 *
 * An in-page, collapsible step-by-step guide that walks admins through the
 * timetable generation process. Sits at the top of the Engine Setup panel.
 * Progress is persisted to localStorage so dismissed steps stay checked.
 */
import React, { useEffect, useState } from 'react';
import {
  Bell, BookOpen, CalendarCheck, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardList, Coffee, Columns, Eye, Lightbulb, Rocket, SendHorizonal,
  Shuffle, Upload, UserCheck, X,
} from 'lucide-react';

const STORAGE_KEY = 'ts_timetable_walkthrough_v1';

const STEPS = [
  {
    id: 'bell',
    icon: Bell,
    color: 'indigo',
    title: 'Create a bell schedule',
    tab: 'bells',
    short: 'Define the school day periods and mark any breaks.',
    detail: 'Go to Bell schedules, enter the start time, period length in minutes, and the number of periods. After creating it, click any period chip to toggle it between a Lesson and a Break — the engine skips break periods automatically.',
  },
  {
    id: 'allocation',
    icon: ClipboardList,
    color: 'violet',
    title: 'Set weekly allocations',
    tab: 'allocations',
    short: 'Tell the engine how many periods per week each subject needs.',
    detail: 'In Allocations, set a target period count for every grade + learning area combination. For example: Grade 7 — Mathematics — 5 periods per week. These targets are what the generator tries to fill.',
  },
  {
    id: 'assignments',
    icon: UserCheck,
    color: 'sky',
    title: 'Assign teachers to subjects',
    tab: null,
    short: 'Link each teacher to the grades and subjects they teach.',
    detail: 'Go to Settings → Subject Assignments and connect each teacher to their learning area and grade. The generator reads these assignments to pick the right teacher for each lesson slot. Any unassigned subject is still scheduled but flagged as "Teacher unassigned".',
  },
  {
    id: 'availability',
    icon: Coffee,
    color: 'amber',
    title: 'Mark unavailable windows (optional)',
    tab: 'availability',
    short: 'Block times when teachers cannot be scheduled.',
    detail: 'In Availability, add any blocked windows — for example, a part-time teacher unavailable on Friday afternoons. The generator will not place a lesson for that teacher during blocked times.',
  },
  {
    id: 'rooms',
    icon: Columns,
    color: 'emerald',
    title: 'Register specialist rooms (optional)',
    tab: 'rooms',
    short: 'Add labs or specialist spaces the engine should book.',
    detail: 'In Rooms, register labs, ICT rooms, or any space that specific subjects need. Then set the required room type on the allocation for that subject. The engine only schedules that subject when a matching room is free.',
  },
  {
    id: 'plan',
    icon: CalendarCheck,
    color: 'rose',
    title: 'Create a timetable plan',
    tab: 'plans',
    short: 'Name the plan, choose the term and bell schedule.',
    detail: 'In Plans, create a new plan with a name, academic year, term, and bell schedule. This creates a version 1 draft ready for generation.',
  },
  {
    id: 'generate',
    icon: Shuffle,
    color: 'purple',
    title: 'Generate the timetable',
    tab: 'plans',
    short: 'Run the engine — it fills all periods in seconds.',
    detail: 'Click "Generate timetable" on your draft plan. The engine runs a constraint-aware greedy algorithm that respects teacher availability, room requirements, and double-lesson rules. Check the result card for unresolved allocations and hard conflicts.',
  },
  {
    id: 'edit',
    icon: BookOpen,
    color: 'teal',
    title: 'Review and fine-tune in the grid',
    tab: 'plans',
    short: 'Drag lessons, lock key periods, fix any conflicts.',
    detail: 'Click "Edit grid" to open the drag-and-drop editor. Drag unlocked lessons to different periods. Lock critical sessions (assemblies, PE) before regenerating. Red-highlighted lessons have conflicts — the conflict panel explains each one.',
  },
  {
    id: 'approve',
    icon: SendHorizonal,
    color: 'blue',
    title: 'Submit for review',
    tab: 'plans',
    short: 'Route the draft through Department → Deputy → Principal.',
    detail: 'Click "Submit review" in the grid editor. The timetable moves through the approval chain. Each reviewer can approve and advance, or send it back for correction.',
  },
  {
    id: 'publish',
    icon: Upload,
    color: 'green',
    title: 'Publish to the live schedule',
    tab: 'plans',
    short: 'Make it live — teachers and students see it instantly.',
    detail: 'Once the plan reaches Approved status, the green Publish button appears. Clicking it writes all lessons to the live class schedule. Any manual overrides made since the last publish are shown as a warning before you confirm.',
  },
];

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-200',     badge: 'bg-sky-100 text-sky-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-200',    badge: 'bg-rose-100 text-rose-700' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-200',  badge: 'bg-purple-100 text-purple-700' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    ring: 'ring-teal-200',    badge: 'bg-teal-100 text-teal-700' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   ring: 'ring-green-200',   badge: 'bg-green-100 text-green-700' },
};

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const save = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* non-critical */ }
};

const TimetableWalkthrough = ({ onNavigateTab }) => {
  const [open, setOpen]         = useState(() => load().open !== false);
  const [checked, setChecked]   = useState(() => load().checked || {});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { save({ open, checked }); }, [open, checked]);

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const doneCount = STEPS.filter(s => checked[s.id]).length;
  const allDone   = doneCount === STEPS.length;
  const pct       = Math.round((doneCount / STEPS.length) * 100);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Rocket size={16} className="text-indigo-600 shrink-0" />
          <span className="text-sm font-semibold text-indigo-900">Timetable Generator — Quick Start Guide</span>
          <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 rounded-full px-2 py-0.5">{doneCount}/{STEPS.length}</span>
        </div>
        <ChevronDown size={16} className="text-indigo-600 shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Rocket size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">Timetable Generator — Quick Start</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {allDone
                ? 'All steps complete — your timetable engine is fully configured.'
                : `Complete these ${STEPS.length} steps to generate your first conflict-free timetable.`}
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Progress</span>
          <span className="text-[10px] font-bold text-gray-700">{doneCount} / {STEPS.length} steps</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone && (
          <div className="mt-2 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={14} />
            <span className="text-[11px] font-semibold">All done! Generate your first timetable from the Plans tab.</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="px-4 py-3 space-y-2">
        {STEPS.map((step, index) => {
          const c      = COLOR_MAP[step.color];
          const done   = Boolean(checked[step.id]);
          const isOpen = expanded === step.id;
          const Icon   = step.icon;

          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all duration-200
                ${done
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                }`}
            >
              {/* Step header row */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Number / check button */}
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-label={done ? `Uncheck: ${step.title}` : `Check: ${step.title}`}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                    ${done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300 bg-white text-gray-400 hover:border-indigo-400'
                    }`}
                >
                  {done
                    ? <CheckCircle2 size={14} />
                    : <span className="text-[10px] font-bold">{index + 1}</span>}
                </button>

                {/* Icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                  <Icon size={14} className={c.text} />
                </div>

                {/* Title + short description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${done ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-gray-900'}`}>
                    {step.title}
                  </p>
                  {!isOpen && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">{step.short}</p>
                  )}
                </div>

                {/* Tab pill + expand toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {step.tab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.(step.tab)}
                      className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${c.badge} hover:opacity-80 transition-opacity`}
                      title={`Go to ${step.tab} tab`}
                    >
                      {step.tab}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : step.id)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-3 pt-0 border-t border-gray-100">
                  <p className="text-[11px] leading-relaxed text-gray-600 mt-2">{step.detail}</p>
                  {step.tab && (
                    <button
                      type="button"
                      onClick={() => { onNavigateTab?.(step.tab); setExpanded(null); }}
                      className={`mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold ${c.text} hover:opacity-80`}
                    >
                      <Eye size={12} /> Open {step.tab} tab
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tips footer */}
      <div className="px-5 py-3 border-t border-indigo-100 bg-indigo-50/60">
        <div className="flex items-start gap-2">
          <Lightbulb size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pro tips</p>
            <ul className="space-y-1 text-[10px] text-gray-600 leading-relaxed">
              <li>• Lock assemblies and PE periods before regenerating so the engine works around them.</li>
              <li>• If a subject shows "unresolved", check Subject Assignments — the teacher–grade–area link is likely missing.</li>
              <li>• Use "New version" to fork and experiment without affecting the current approved draft.</li>
              <li>• Manual overrides on the live timetable are safe — the engine shows a warning before overwriting them on publish.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reset link */}
      <div className="px-5 py-2 border-t border-indigo-100 flex justify-end">
        <button
          type="button"
          onClick={() => setChecked({})}
          className="text-[10px] text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
        >
          <X size={10} /> Reset progress
        </button>
      </div>
    </div>
  );
};

export default TimetableWalkthrough;
