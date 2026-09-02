/**
 * TeacherMobileAssessView
 * Clean, senior UX redesigned mobile assessment and teaching workload hub.
 *
 * Layout:
 *   1. Homeroom / class-teacher hero card (sleek slate-900, if assigned)
 *   2. Grade subject list — all learning areas per grade
 *      - Class teacher: all subjects active
 *      - Subject teacher: only assigned subjects active; others clearly locked
 *   3. Empty state — if nothing assigned
 */

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Lock,
  Loader2,
  PenLine,
  Star,
  Users,
} from 'lucide-react';
import { useTeacherWorkload } from '../../hooks/useTeacherWorkload';
import { cn } from '../../../../utils/cn';

// ─── helpers ─────────────────────────────────────────────────────────────────

const pct = (n) => `${Math.max(0, Math.min(100, Math.round(Number(n || 0))))}%`;

const normalizeGrade = (grade) =>
  String(grade || '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();

/**
 * Format a raw grade code for display.
 * GRADE_4 → Grade 4, PP1 → PP1, etc.
 */
const formatGradeLabel = (grade) => {
  const g = normalizeGrade(grade);
  if (g.startsWith('GRADE_')) return `Grade ${g.replace('GRADE_', '')}`;
  if (/^GRADE\d+$/.test(g)) return `Grade ${g.replace('GRADE', '')}`;
  return String(grade || 'Class')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

// ─── sub-components ───────────────────────────────────────────────────────────

/**
 * HomeroomCard — hero card shown for the class the teacher is in charge of.
 */
const HomeroomCard = ({ cls, onNavigate }) => (
  <div className="rounded-2xl p-5 bg-slate-900 text-white shadow-sm border border-slate-800">
    {/* badge */}
    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-200">
      <Star size={11} className="text-amber-400 fill-amber-400" />
      Class Teacher
    </div>

    {/* grade + stream */}
    <div className="mb-1 text-2xl font-black text-white tracking-tight">{formatGradeLabel(cls.grade)}</div>
    {cls.stream && (
      <div className="mb-4 text-xs font-semibold text-slate-400">{cls.stream} Stream</div>
    )}

    {/* stats row */}
    <div className="mb-5 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/5">
      {[
        { label: 'Learners', value: cls.learnerCount ?? cls.learners ?? '—' },
        { label: 'Attendance', value: pct(cls.attendanceRate) },
        { label: 'Marks', value: pct(cls.assessmentRate) },
      ].map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center px-2 py-3">
          <span className="text-base font-bold text-white tracking-tight">{value}</span>
          <span className="mt-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
      ))}
    </div>

    {/* actions */}
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={() => onNavigate('attendance-daily')}
        className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 py-2.5 text-xs font-bold text-white transition-colors"
      >
        <Users size={14} />
        Attendance
      </button>
      <button
        type="button"
        onClick={() => onNavigate('assess-summative-assessment')}
        className="flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 py-2.5 text-xs font-bold text-slate-900 transition-colors shadow-sm"
      >
        <PenLine size={14} />
        Enter Marks
      </button>
    </div>
  </div>
);

/**
 * SubjectRow — single learning area row inside a GradeSubjectCard.
 * active = tappable, shows chevron.
 * locked = greyed out, non-interactive, shows lock icon.
 */
const SubjectRow = ({ subject, isLast, isActive, onTap }) => {
  if (isActive) {
    return (
      <button
        type="button"
        onClick={onTap}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/60',
          !isLast && 'border-b border-slate-100'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <BookOpen size={15} />
        </div>
        <span className="flex-1 truncate text-sm font-bold text-slate-900">{subject}</span>
        <ChevronRight size={16} className="shrink-0 text-slate-300" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3.5 bg-slate-50/40 opacity-70',
        !isLast && 'border-b border-slate-100'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <BookOpen size={15} className="text-slate-400" />
      </div>
      <span className="flex-1 truncate text-sm font-medium text-slate-400">{subject}</span>
      <Lock size={13} className="shrink-0 text-slate-300" />
    </div>
  );
};

/**
 * GradeSubjectCard — groups all learning areas for a single grade.
 */
const GradeSubjectCard = ({ grade, subjects, assignedSubjects, isClassTeacher, stream, onSubjectTap }) => {
  const gradeLabel = formatGradeLabel(grade);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {gradeLabel}
              {stream ? ` · ${stream}` : ''}
            </p>
            {!isClassTeacher && (
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Subject Teacher</p>
            )}
          </div>
          {isClassTeacher && (
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Star size={9} className="text-amber-400 fill-amber-400" />
              Class Teacher
            </div>
          )}
        </div>
      </div>

      {/* subject list */}
      <div>
        {subjects.map((subject, idx) => {
          const isActive =
            assignedSubjects === null ||
            (Array.isArray(assignedSubjects) &&
              assignedSubjects.some(
                (s) => s.trim().toLowerCase() === subject.trim().toLowerCase()
              ));
          return (
            <SubjectRow
              key={subject}
              subject={subject}
              isLast={idx === subjects.length - 1}
              isActive={isActive}
              onTap={() => onSubjectTap(grade, subject)}
            />
          );
        })}
        {subjects.length === 0 && (
          <p className="px-4 py-4 text-xs font-semibold text-slate-400">
            No learning areas configured for this grade.
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * EmptyAssigned — shown when teacher has no classes at all.
 */
const EmptyAssigned = ({ onNavigate }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <BookOpen size={28} />
    </div>
    <p className="text-sm font-bold text-slate-900">No classes assigned yet</p>
    <p className="mt-1.5 max-w-[240px] text-xs font-medium text-slate-500 leading-relaxed">
      Your class teacher assignment and subject allocations will appear here once the admin sets them up.
    </p>
    <button
      type="button"
      onClick={() => onNavigate('assess-summative-assessment')}
      className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm"
    >
      Go to Mark Entry
      <ArrowRight size={13} />
    </button>
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

/**
 * TeacherMobileAssessView
 * @param {Object}   props.user        - Current user (must have .id)
 * @param {Function} props.onNavigate  - App navigation handler
 */
const TeacherMobileAssessView = ({ user, onNavigate }) => {
  const {
    loading,
    error,
    workload,
    schedules,
    teacherContext,
    getAssignedSubjectsForGrade,
    refresh,
  } = useTeacherWorkload();

  // ── Derive homeroom (class teacher) ────────────────────────────────────────
  const homeroom = useMemo(() => {
    if (!workload) return null;
    const classes = Array.isArray(workload) ? workload : (workload?.classes ?? []);
    return classes.find((c) => c.isClassTeacher) ?? null;
  }, [workload]);

  // ── Derive all grades to show (de-duped, sorted) ──────────────────────────
  const gradeEntries = useMemo(() => {
    const gradeMap = new Map();

    // From workload classes
    const classes = Array.isArray(workload) ? workload : (workload?.classes ?? []);
    classes.forEach((cls) => {
      if (!cls?.grade) return;
      const g = normalizeGrade(cls.grade);
      if (!gradeMap.has(g)) {
        gradeMap.set(g, {
          grade: cls.grade,
          stream: cls.stream || null,
          subjects: new Set(cls.subjects || []),
        });
      } else {
        (cls.subjects || []).forEach((s) => gradeMap.get(g).subjects.add(s));
      }
    });

    // From schedules
    (schedules || []).forEach((s) => {
      const grade = s.class?.grade || s.grade;
      if (!grade) return;
      const g = normalizeGrade(grade);
      const subjectName = s.subject || s.learningArea?.name || s.learningArea?.shortName;
      if (!gradeMap.has(g)) {
        gradeMap.set(g, { grade, stream: s.class?.stream || null, subjects: new Set() });
      }
      if (subjectName) gradeMap.get(g).subjects.add(subjectName);
    });

    // From teacher context subject assignments (includes ALL learning areas per grade)
    (teacherContext?.subjectAssignments || []).forEach((assignment) => {
      if (!assignment?.grade) return;
      const g = normalizeGrade(assignment.grade);
      if (!gradeMap.has(g)) {
        gradeMap.set(g, { grade: assignment.grade, stream: null, subjects: new Set() });
      }
      if (assignment.learningAreaName) gradeMap.get(g).subjects.add(assignment.learningAreaName);
    });

    // Sort grades and convert subjects to sorted arrays
    return Array.from(gradeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([gKey, entry]) => ({
        gradeKey: gKey,
        grade: entry.grade,
        stream: entry.stream,
        subjects: Array.from(entry.subjects).sort((a, b) => a.localeCompare(b)),
        assignedSubjects: getAssignedSubjectsForGrade(entry.grade),
        isClassTeacher:
          teacherContext?.classTeacherOf
            ? normalizeGrade(teacherContext.classTeacherOf.grade) === gKey
            : homeroom
            ? normalizeGrade(homeroom.grade) === gKey
            : false,
      }));
  }, [workload, schedules, teacherContext, homeroom, getAssignedSubjectsForGrade]);

  const hasAnything = gradeEntries.length > 0;

  // ── Subject tap → direct mark entry ───────────────────────────────────────
  const handleSubjectTap = (grade, subjectName) => {
    onNavigate('assess-summative-assessment', {
      prefillGrade: grade,
      prefillSubject: subjectName,
    });
  };

  return (
    <div className="space-y-4 text-slate-900">
      {/* ── Page header ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <h1 className="text-base font-bold text-slate-900">My Classes & Subjects</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Your active teaching allocations for this term
        </p>
      </div>

      <div className="space-y-4">
        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <Loader2 size={26} className="animate-spin text-slate-500" />
            <span className="text-xs font-medium">Loading your classes…</span>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 text-sm font-medium text-rose-700 shadow-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
            <div>
              <p className="font-bold text-slate-900">Couldn't load your classes</p>
              <p className="mt-1 text-xs text-slate-600">
                {error?.message || 'Please try again.'}
              </p>
              <button
                type="button"
                onClick={refresh}
                className="mt-2 text-xs font-bold text-slate-900 underline underline-offset-2"
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
          <HomeroomCard cls={homeroom} onNavigate={onNavigate} />
        )}

        {/* ── Grade + subject list ── */}
        {!loading && !error && gradeEntries.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Learning Areas
              </p>
              <p className="text-[10px] font-medium text-slate-400">
                Tap subject to enter marks
              </p>
            </div>
            {gradeEntries.map((entry) => (
              <GradeSubjectCard
                key={entry.gradeKey}
                grade={entry.grade}
                stream={entry.stream}
                subjects={entry.subjects}
                assignedSubjects={entry.assignedSubjects}
                isClassTeacher={entry.isClassTeacher}
                onSubjectTap={handleSubjectTap}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default TeacherMobileAssessView;
