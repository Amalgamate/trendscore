/**
 * TimetableWalkthrough — Intelligent, data-driven gated wizard.
 *
 * Steps auto-detect their completion state from real foundation data.
 * Each step only becomes active once its prerequisite is satisfied.
 */
import React, { useState } from 'react';
import {
  Bell, BookOpen, CalendarCheck, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardList, Coffee, Columns, Eye, Lightbulb, Lock, SendHorizonal,
  Shuffle, Upload, UserCheck, Zap,
} from 'lucide-react';


const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-300',  badge: 'bg-indigo-100 text-indigo-700',  activeBorder: 'border-indigo-300' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-300',  badge: 'bg-violet-100 text-violet-700',  activeBorder: 'border-violet-300' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-300',     badge: 'bg-sky-100 text-sky-700',        activeBorder: 'border-sky-300' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-300',   badge: 'bg-amber-100 text-amber-700',    activeBorder: 'border-amber-300' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-300', badge: 'bg-emerald-100 text-emerald-700', activeBorder: 'border-emerald-300' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-300',    badge: 'bg-rose-100 text-rose-700',      activeBorder: 'border-rose-300' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-300',  badge: 'bg-purple-100 text-purple-700',  activeBorder: 'border-purple-300' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    ring: 'ring-teal-300',    badge: 'bg-teal-100 text-teal-700',      activeBorder: 'border-teal-300' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-300',    badge: 'bg-blue-100 text-blue-700',      activeBorder: 'border-blue-300' },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   ring: 'ring-green-300',   badge: 'bg-green-100 text-green-700',    activeBorder: 'border-green-300' },
};

function computeProgress({ data, subjectAssignmentCount, manualDone = {} }) {
  const bells  = (data?.bellSchedules?.length || 0) > 0 || Boolean(manualDone.bell);
  const allocs = (data?.allocations?.length   || 0) > 0 || Boolean(manualDone.allocation);
  const plans  = (data?.plans?.length         || 0) > 0 || Boolean(manualDone.plan);
  const hasAssignments = (subjectAssignmentCount || 0) > 0 || Boolean(manualDone.assignments);

  const allVersions  = (data?.plans || []).flatMap(p => p.versions || []);
  const latestStatus = allVersions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.status;

  const generated = ['GENERATED','DEPARTMENT_REVIEW','DEPUTY_REVIEW','PRINCIPAL_REVIEW','APPROVED','PUBLISHED'].includes(latestStatus) || Boolean(manualDone.generate);
  const reviewed  = ['DEPARTMENT_REVIEW','DEPUTY_REVIEW','PRINCIPAL_REVIEW','APPROVED','PUBLISHED'].includes(latestStatus) || Boolean(manualDone.edit);
  const approved  = ['APPROVED','PUBLISHED'].includes(latestStatus) || Boolean(manualDone.approve);
  const published = latestStatus === 'PUBLISHED' || Boolean(manualDone.publish);

  const done = new Set();
  if (bells)          done.add('bell');
  if (allocs)         done.add('allocation');
  if (hasAssignments) done.add('assignments');
  if ((data?.availability?.length || 0) > 0 || manualDone.availability) done.add('availability');
  if ((data?.rooms?.length        || 0) > 0 || manualDone.rooms)        done.add('rooms');
  if (plans)     done.add('plan');
  if (generated) done.add('generate');
  if (reviewed)  done.add('edit');
  if (approved)  done.add('approve');
  if (published) done.add('publish');

  // All steps are always accessible so user is never trapped or blocked
  const unlocked = new Set(STEPS.map(s => s.id));

  return { done, unlocked };
}

const STEPS = [
  { id: 'bell',       icon: Bell,          color: 'indigo',  tab: 'bells',
    title: 'Create a bell schedule',
    short: 'Define period duration, start time, and lesson slots.',
    detail: 'Choose a preset — Lower Primary (30 min), Upper Primary (40 min), or Secondary (45 min) — or customize periods. Break duration changes automatically cascade-shift later periods.' },
  { id: 'allocation', icon: ClipboardList,  color: 'violet',  tab: 'allocations',
    title: 'Set weekly allocations',
    short: 'Specify target periods per week for each subject & grade.',
    detail: 'Set how many periods each learning area needs per week (e.g. Grade 7 Mathematics: 5 periods/week). The generator uses these targets to build the full schedule.' },
  { id: 'assignments', icon: UserCheck,     color: 'sky',     tab: null,
    title: 'Assign teachers to subjects',
    short: 'Connect teachers to grades and learning areas.',
    detail: 'Managed under Settings → Subject Assignments. Connect each teacher to their learning areas and grade. Unassigned subjects are still scheduled but flagged as unassigned.' },
  { id: 'availability', icon: Coffee,       color: 'amber',   tab: 'availability',
    title: 'Mark unavailable windows', optional: true,
    short: 'Block times when specific teachers cannot teach. (Optional)',
    detail: 'Add blocked slots for part-time teachers or off-campus duties. The generator automatically works around these windows.' },
  { id: 'rooms',      icon: Columns,        color: 'emerald', tab: 'rooms',
    title: 'Register specialist rooms', optional: true,
    short: 'Add science labs, ICT suites, or sports grounds. (Optional)',
    detail: 'Register labs and special facilities. The generator ensures matching rooms are booked without double-booking.' },
  { id: 'plan',       icon: CalendarCheck,  color: 'rose',    tab: 'plans',
    title: 'Create a timetable plan',
    short: 'Set plan name, academic year, term, and bell schedule.',
    detail: 'Select your bell schedule and term to create a draft version ready for generation.' },
  { id: 'generate',   icon: Shuffle,        color: 'purple',  tab: 'plans',
    title: 'Generate the timetable',
    short: 'Run the engine to fill all periods in seconds.',
    detail: 'The AI constraint engine schedules all class lessons while respecting teacher workload, availability, and room constraints.' },
  { id: 'edit',       icon: BookOpen,       color: 'teal',    tab: 'plans',
    title: 'Review and fine-tune in the grid',
    short: 'Drag lessons, check the Coverage Report, fix conflicts.',
    detail: 'Fine-tune in the visual drag-and-drop grid editor. Use the Coverage Report button to inspect unfilled spaces across all classes.' },
  { id: 'approve',    icon: SendHorizonal,  color: 'blue',    tab: 'plans',
    title: 'Submit for review',
    short: 'Route draft through Department → Deputy → Principal.',
    detail: 'Move the timetable through institutional approvals before publishing.' },
  { id: 'publish',    icon: Upload,         color: 'green',   tab: 'plans',
    title: 'Publish to live schedule',
    short: 'Push approved schedule to all teachers and student dashboards.',
    detail: 'Publishing synchronizes live class schedules instantly across the school system.' },
];

const TimetableWalkthrough = ({ onNavigateTab, data, subjectAssignmentCount = 0 }) => {
  const [open, setOpen]         = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [manualDone, setManualDone] = useState({});

  const { done, unlocked } = computeProgress({ data, subjectAssignmentCount, manualDone });
  const doneCount = STEPS.filter(s => done.has(s.id)).length;
  const allDone   = doneCount === STEPS.length;
  const pct       = Math.round((doneCount / STEPS.length) * 100);

  const toggleManual = (e, id) => {
    e.stopPropagation();
    setManualDone(prev => ({ ...prev, [id]: !done.has(id) }));
  };

  const getStepStatusBadge = (stepId) => {
    switch (stepId) {
      case 'bell':
        return (data?.bellSchedules?.length || 0) > 0
          ? `${data.bellSchedules.length} schedule${data.bellSchedules.length !== 1 ? 's' : ''}`
          : 'Required';
      case 'allocation':
        return (data?.allocations?.length || 0) > 0
          ? `${data.allocations.length} allocation${data.allocations.length !== 1 ? 's' : ''}`
          : 'Ready to set';
      case 'assignments':
        return subjectAssignmentCount > 0
          ? `${subjectAssignmentCount} assigned`
          : 'Settings';
      case 'availability':
        return (data?.availability?.length || 0) > 0
          ? `${data.availability.length} rule${data.availability.length !== 1 ? 's' : ''}`
          : 'Optional';
      case 'rooms':
        return (data?.rooms?.length || 0) > 0
          ? `${data.rooms.length} room${data.rooms.length !== 1 ? 's' : ''}`
          : 'Optional';
      case 'plan':
        return (data?.plans?.length || 0) > 0
          ? `${data.plans.length} plan${data.plans.length !== 1 ? 's' : ''}`
          : 'Next step';
      default:
        return null;
    }
  };

  const handleCardClick = (step) => {
    if (step.tab) {
      onNavigateTab?.(step.tab);
    } else {
      setExpanded(prev => prev === step.id ? null : step.id);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100 transition-colors">
        <div className="flex items-center gap-2.5">
          <Zap size={16} className="text-indigo-600 shrink-0" />
          <span className="text-sm font-semibold text-indigo-900">Timetable Setup Guide</span>
          <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 rounded-full px-2 py-0.5">{doneCount}/{STEPS.length}</span>
        </div>
        <ChevronDown size={16} className="text-indigo-600 shrink-0" />
      </button>
    );
  }

  const firstIncompleteStep = STEPS.find(s => !done.has(s.id));

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 overflow-hidden shadow-2xs">
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm text-white">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">Intelligent Timetable Setup Guide</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {allDone ? 'All steps complete — your timetable engine is fully configured.'
                       : 'Follow the steps below to configure, generate, and review your timetable.'}
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5 p-1 rounded-lg hover:bg-indigo-100/50">
          <ChevronUp size={16} />
        </button>
      </div>

      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Setup Progress</span>
          <span className="text-[10px] font-bold text-gray-700">{doneCount} / {STEPS.length} steps completed ({pct}%)</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
               style={{ width: `${pct}%` }} />
        </div>
        {allDone && (
          <div className="mt-2 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={14} />
            <span className="text-[11px] font-semibold">All done! Your timetable is published and live.</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {STEPS.map((step, index) => {
          const c        = COLOR_MAP[step.color];
          const isDone   = done.has(step.id);
          const isOpen   = expanded === step.id;
          const isActive = firstIncompleteStep?.id === step.id;
          const isLocked = false;
          const Icon     = step.icon;
          const statusBadge = getStepStatusBadge(step.id);

          return (
            <div
              key={step.id}
              onClick={() => handleCardClick(step)}
              className={[
                'rounded-xl border transition-all duration-200 cursor-pointer',
                isDone   ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300' : '',
                isActive ? `${c.activeBorder} bg-white shadow-xs ring-2 ${c.ring} hover:shadow-sm` : '',
                isLocked ? 'border-gray-200 bg-white/70 hover:border-gray-300 opacity-80' : '',
                !isDone && !isActive && !isLocked ? 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xs' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 px-3.5 py-3">
                {/* Number / Check toggle button */}
                <button
                  type="button"
                  onClick={(e) => toggleManual(e, step.id)}
                  title={isDone ? 'Click to mark uncompleted' : 'Click to mark completed'}
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all hover:scale-105',
                    isDone   ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs' : '',
                    isActive ? `border-current ${c.text} bg-white hover:bg-indigo-50` : '',
                    isLocked ? 'border-gray-300 bg-gray-100 text-gray-400' : '',
                    !isDone && !isActive && !isLocked ? 'border-gray-300 bg-white text-gray-500 hover:border-indigo-400' : '',
                  ].join(' ')}
                >
                  {isDone ? <CheckCircle2 size={15} /> : <span className="text-[11px] font-bold">{index + 1}</span>}
                </button>

                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-100 text-emerald-700' : isLocked ? 'bg-gray-100 text-gray-400' : c.bg + ' ' + c.text}`}>
                  <Icon size={15} />
                </div>

                {/* Title & Short Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={[
                      'text-xs font-bold leading-tight',
                      isDone   ? 'text-emerald-900' : '',
                      isLocked ? 'text-gray-700' : '',
                      isActive ? c.text : (!isDone && !isLocked ? 'text-gray-900' : ''),
                    ].join(' ')}>
                      {step.title}
                    </p>
                    {step.optional && (
                      <span className="text-[9px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                        optional
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/70 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                        ✓ Done
                      </span>
                    )}
                  </div>
                  {!isOpen && (
                    <p className="text-[10px] mt-0.5 text-gray-500 truncate">
                      {step.short}
                    </p>
                  )}
                </div>

                {/* Action button on right */}
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {statusBadge && (
                    <span className="hidden sm:inline-block text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5">
                      {statusBadge}
                    </span>
                  )}
                  {step.tab ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.(step.tab)}
                      className={`text-[10px] font-bold rounded-lg px-2.5 py-1 transition-all flex items-center gap-1 ${
                        isActive
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{step.tab}</span>
                      <span className="text-[11px]">→</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : step.id)}
                      className="text-[10px] font-medium text-indigo-600 hover:underline"
                    >
                      Details
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : step.id)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isOpen && (
                <div className="px-4 pb-3.5 pt-0 border-t border-gray-100">
                  <p className="text-[11px] leading-relaxed text-gray-600 mt-2.5">{step.detail}</p>
                  {step.tab && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onNavigateTab?.(step.tab); }}
                      className={`mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold ${c.text} hover:opacity-80`}
                    >
                      <Eye size={12} /> Open {step.tab} tab now →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-indigo-100 bg-indigo-50/60">
        <div className="flex items-start gap-2">
          <Lightbulb size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Intelligent Timetable Engine Tips</p>
            <ul className="space-y-1 text-[10px] text-gray-600 leading-relaxed">
              <li>• <strong>Lower Primary (PP1–Gr 3):</strong> 30-min periods · <strong>Upper Primary (Gr 4–6):</strong> 40-min · <strong>Secondary (Gr 7+):</strong> 45-min.</li>
              <li>• Click any step above to go directly to its configuration page.</li>
              <li>• Editing any break time automatically shifts subsequent period timings.</li>
              <li>• In the Timetable Grid editor, click "Coverage Report" for automatic gap analysis of all active classes.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableWalkthrough;

