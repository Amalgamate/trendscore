/**
 * TeacherMobileAssessView
 * The Assess landing page for teachers on mobile.
 * Layout:
 *   1. Homeroom / class-teacher card (hero) — if assigned
 *   2. Subject classes taught across grades — list
 *   3. Empty state — if nothing assigned
 *   4. Quick assessment actions at the bottom
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  PenLine,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { classAPI } from '../../../../services/api';

// ─── helpers ─────────────────────────────────────────────────────────────────

const pct = (n) => `${Math.max(0, Math.min(100, Math.round(Number(n || 0))))}%`;

const GRADE_COLOR = [
  { bg: 'bg-violet-50', text: 'text-violet-700', bar: 'bg-violet-500', dot: 'bg-violet-400' },
  { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500',   dot: 'bg-blue-400'   },
  { bg: 'bg-emerald-50',text: 'text-emerald-700', bar: 'bg-emerald-500',dot: 'bg-emerald-400'},
  { bg: 'bg-amber-50',  text: 'text-amber-700',   bar: 'bg-amber-500',  dot: 'bg-amber-400'  },
  { bg: 'bg-rose-50',   text: 'text-rose-700',    bar: 'bg-rose-500',   dot: 'bg-rose-400'   },
  { bg: 'bg-teal-50',   text: 'text-teal-700',    bar: 'bg-teal-500',   dot: 'bg-teal-400'   },
];
const colorAt = (i) => GRADE_COLOR[i % GRADE_COLOR.length];

// ─── sub-components ───────────────────────────────────────────────────────────

/**
 * ProgressBar — two-toned: attendance (green) + assessment (blue)
 */
const DualBar = ({ attendance = 0, assessment = 0 }) => (
  <div className="space-y-1.5 text-[11px] font-semibold">
    <div className="flex items-center justify-between text-slate-500">
      <span>Attendance</span>
      <span className="font-black text-emerald-600">{pct(attendance)}</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: pct(attendance) }} />
    </div>
    <div className="flex items-center justify-between text-slate-500 pt-0.5">
      <span>Mark entry</span>
      <span className="font-black text-blue-600">{pct(assessment)}</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: pct(assessment) }} />
    </div>
  </div>
);

/**
 * HomeroomCard — large hero card for the class the teacher is in charge of
 */
const HomeroomCard = ({ cls, onNavigate }) => (
  <div className="rounded-2xl bg-[#06285a] p-5 shadow-lg"
    style={{ background: 'linear-gradient(135deg, var(--toolbar-bg, #06285a) 0%, color-mix(in srgb, var(--toolbar-bg, #06285a) 80%, black) 100%)' }}>

    {/* badge */}
    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/80">
      <Star size={10} />
      Class Teacher
    </div>

    {/* grade + stream */}
    <div className="mb-1 text-2xl font-black text-white">{cls.grade}</div>
    {cls.stream && (
      <div className="mb-4 text-sm font-semibold text-white/70">{cls.stream}</div>
    )}

    {/* stats row */}
    <div className="mb-5 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 border border-white/20">
      {[
        { label: 'Learners', value: cls.learnerCount ?? cls.learners ?? '—' },
        { label: 'Attendance', value: pct(cls.attendanceRate) },
        { label: 'Marks', value: pct(cls.assessmentRate) },
      ].map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center py-3 px-2">
          <span className="text-base font-black text-white">{value}</span>
          <span className="mt-0.5 text-[10px] font-semibold text-white/60">{label}</span>
        </div>
      ))}
    </div>

    {/* actions */}
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onNavigate('attendance-daily')}
        className="flex items-center justify-center gap-2 rounded-xl bg-white/15 border border-white/25 py-2.5 text-xs font-black text-white"
      >
        <Users size={14} />
        Attendance
      </button>
      <button
        type="button"
        onClick={() => onNavigate('assess-summative-assessment')}
        className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black text-[#06285a]"
        style={{ background: 'var(--brand-secondary, #ff7900)' }}
      >
        <PenLine size={14} />
        Enter Marks
      </button>
    </div>
  </div>
);

/**
 * SubjectClassRow — compact row for a subject taught in a class
 */
const SubjectClassRow = ({ cls, index, onNavigate }) => {
  const c = colorAt(index);
  return (
    <button
      type="button"
      onClick={() => onNavigate('assess-summative-assessment')}
      className="w-full flex items-center gap-3 rounded-xl bg-white border border-slate-100 p-3 text-left shadow-sm active:bg-slate-50"
    >
      {/* icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
        <BookOpen size={18} />
      </div>

      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black text-slate-950 truncate">{cls.subject}</span>
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${c.bg} ${c.text} shrink-0`}>
            {cls.grade}
          </span>
        </div>
        {/* mini bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-slate-100">
            <div className={`h-1 rounded-full ${c.bar}`} style={{ width: pct(cls.assessmentRate) }} />
          </div>
          <span className="text-[10px] font-black text-slate-500 shrink-0 w-8 text-right">
            {pct(cls.assessmentRate)}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
          {cls.learnerCount ?? cls.learners ?? 0} learners · {cls.room || 'No room assigned'}
        </div>
      </div>

      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );
};

/**
 * EmptyAssigned — shown when teacher has no classes at all
 */
const EmptyAssigned = ({ onNavigate }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-300">
      <BookOpen size={32} />
    </div>
    <p className="text-sm font-black text-slate-800">No classes assigned yet</p>
    <p className="mt-2 max-w-[240px] text-xs font-semibold text-slate-500 leading-relaxed">
      Your class teacher assignment and subject allocations will appear here once the admin sets them up.
    </p>
    <button
      type="button"
      onClick={() => onNavigate('assess-summative-assessment')}
      className="mt-6 flex items-center gap-2 rounded-xl bg-[#06285a] px-5 py-2.5 text-xs font-black text-white"
      style={{ background: 'var(--toolbar-bg, #06285a)' }}
    >
      Go to Mark Entry anyway
      <ArrowRight size={13} />
    </button>
  </div>
);

/**
 * QuickActionTile — small action tile at the bottom
 */
const QuickActionTile = ({ icon: Icon, label, helper, color, bg, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 p-3 text-left shadow-sm active:bg-slate-50"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color, background: bg }}>
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-950">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 truncate">{helper}</p>
    </div>
    <ChevronRight size={15} className="text-slate-300 shrink-0" />
  </button>
);

// ─── main component ───────────────────────────────────────────────────────────

/**
 * TeacherMobileAssessView
 * @param {Object} props
 * @param {Object} props.user        - Current user (must have .id)
 * @param {Function} props.onNavigate
 */
const TeacherMobileAssessView = ({ user, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [homeroom, setHomeroom] = useState(null);       // single class where teacher is class teacher
  const [subjectClasses, setSubjectClasses] = useState([]); // subject assignments across grades

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await classAPI.getTeacherWorkload(user.id);
        if (cancelled) return;

        // The workload endpoint returns an array of assignment objects.
        // Each item has: classId, grade, stream, subject, learnerCount,
        // room, isClassTeacher, attendanceRate, assessmentRate
        const raw = Array.isArray(res) ? res : (res?.data ?? []);

        const homeroomEntry = raw.find((c) => c.isClassTeacher);
        const subjects = raw.filter((c) => !c.isClassTeacher);

        setHomeroom(homeroomEntry ?? null);
        setSubjectClasses(subjects);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load your classes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const hasAnything = homeroom || subjectClasses.length > 0;

  return (
    <div className="min-h-full bg-slate-50 pb-28">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-4 pb-3">
        <h1 className="text-base font-black text-slate-950">My Classes</h1>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          Your teaching assignments this term
        </p>
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-xs font-semibold">Loading your classes…</span>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">Couldn't load your classes</p>
              <p className="mt-1 font-semibold text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 text-xs font-black text-red-700 underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && !hasAnything && (
          <EmptyAssigned onNavigate={onNavigate} />
        )}

        {/* ── Homeroom hero card ── */}
        {!loading && homeroom && (
          <section>
            <HomeroomCard cls={homeroom} onNavigate={onNavigate} />
          </section>
        )}

        {/* ── Subject classes ── */}
        {!loading && subjectClasses.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between px-0.5">
              <div>
                <h2 className="text-sm font-black text-slate-950">Subject Assignments</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {subjectClasses.length} class{subjectClasses.length !== 1 ? 'es' : ''} across grades
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assess-summative-assessment')}
                className="text-[11px] font-black text-blue-600 flex items-center gap-1"
              >
                Enter marks <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {subjectClasses.map((cls, i) => (
                <SubjectClassRow
                  key={`${cls.classId}-${cls.subject}`}
                  cls={cls}
                  index={i}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Homeroom detail stats (only shown if homeroom exists) ── */}
        {!loading && homeroom && (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-950">Class Overview</h2>
              <span className="text-[11px] font-bold text-slate-400">{homeroom.grade}</span>
            </div>
            <DualBar attendance={homeroom.attendanceRate} assessment={homeroom.assessmentRate} />
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>
                {homeroom.learnerCount ?? homeroom.learners ?? 0} learners enrolled
                {homeroom.room ? ` · ${homeroom.room}` : ''}
              </span>
            </div>
          </section>
        )}

        {/* ── Quick actions ── */}
        {!loading && hasAnything && (
          <section>
            <h2 className="mb-3 text-sm font-black text-slate-950 px-0.5">Quick Actions</h2>
            <div className="space-y-2">
              <QuickActionTile
                icon={Target}
                label="Summative Tests"
                helper="Create or deploy tests"
                color="#7c3aed"
                bg="#f1e9ff"
                onClick={() => onNavigate('assess-summative-tests')}
              />
              <QuickActionTile
                icon={PenLine}
                label="Record Marks"
                helper="Enter scores for your classes"
                color="#2563eb"
                bg="#e8f0ff"
                onClick={() => onNavigate('assess-summative-assessment')}
              />
              <QuickActionTile
                icon={ClipboardList}
                label="Formative Assessment"
                helper="Track classroom observations"
                color="#16a34a"
                bg="#e7f8ee"
                onClick={() => onNavigate('assess-formative')}
              />
              <QuickActionTile
                icon={FileText}
                label="Reports"
                helper="View learner and class reports"
                color="#f97316"
                bg="#fff1e7"
                onClick={() => onNavigate('assess-summary-report')}
              />
              <QuickActionTile
                icon={Star}
                label="Core Competencies"
                helper="CBC competency assessments"
                color="#ca8a04"
                bg="#fefce8"
                onClick={() => onNavigate('assess-core-competencies')}
              />
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default TeacherMobileAssessView;
