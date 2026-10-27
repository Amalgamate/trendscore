/**
 * academicYear.service.ts
 *
 * "Set up the academic year": one place to define all three terms and their
 * break and exam dates. Saving writes TermConfig (the owner of each term) and
 * the typed planner events inside it (TERM_OPENING, TERM_CLOSING,
 * MIDTERM_BREAK, EXAM_WEEK) in a single transaction, so the two can never
 * disagree.
 *
 * Dates travel as school-local calendar days ("YYYY-MM-DD") and are stored at
 * UTC midnight, which is the same calendar day in Africa/Nairobi.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { redisCacheService } from './redis-cache.service';
import { diffDays, schoolDateKey } from './keyDates.service';

export const TERM_IDS = ['TERM_1', 'TERM_2', 'TERM_3'] as const;
export type TermId = (typeof TERM_IDS)[number];

export interface TermPlanInput {
  term: TermId;
  startDate: string;
  endDate: string;
  midtermStart?: string | null;
  midtermEnd?: string | null;
  examStart?: string | null;
  examEnd?: string | null;
}

export interface AcademicYearPlanInput {
  academicYear: number;
  terms: TermPlanInput[];
  activeTerm?: TermId;
  confirmRunningTermChange?: boolean;
  reason?: string;
}

export interface TermBreak { after: TermId; before: TermId; days: number }

export interface PlanPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  terms: TermPlanInput[];
  breaks: TermBreak[];
  requiresConfirmation: boolean;
  activeTerm: TermId | null;
}

const MIN_TERM_DAYS = 40;
const MAX_TERM_DAYS = 130;
const LONG_BREAK_DAYS = 70;

const termLabel = (t: string) => `Term ${t.slice(-1)}`;
const blank = (v?: string | null) => v == null || v === '';
const toDate = (key: string) => new Date(`${key}T00:00:00.000Z`);

export function isDateKey(v?: string | null): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Optional start/end pair that must sit inside the term. Returns the pair, or null when absent/invalid. */
function checkWindow(
  name: string,
  label: string,
  start: string | null | undefined,
  end: string | null | undefined,
  term: { startDate: string; endDate: string },
  errors: string[],
): [string, string] | null {
  if (blank(start) && blank(end)) return null;
  if (blank(start) || blank(end)) {
    errors.push(`${label}: the ${name} needs both a start and an end date.`);
    return null;
  }
  if (!isDateKey(start) || !isDateKey(end)) {
    errors.push(`${label}: the ${name} dates must be valid dates.`);
    return null;
  }
  if (end < start) {
    errors.push(`${label}: the ${name} ends before it starts.`);
    return null;
  }
  if (start < term.startDate || end > term.endDate) {
    errors.push(`${label}: the ${name} must fall between the opening and closing dates.`);
    return null;
  }
  return [start, end];
}

/** Pure checks on the submitted plan. Needs no database. */
export function validateAcademicYearPlan(input: AcademicYearPlanInput) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const breaks: TermBreak[] = [];

  const byTerm = new Map<TermId, TermPlanInput>();
  for (const t of input.terms) {
    if (byTerm.has(t.term)) errors.push(`${termLabel(t.term)} appears more than once.`);
    byTerm.set(t.term, t);
  }
  for (const id of TERM_IDS) {
    if (!byTerm.has(id)) errors.push(`${termLabel(id)} is missing.`);
  }

  const usable: TermPlanInput[] = [];
  for (const id of TERM_IDS) {
    const t = byTerm.get(id);
    if (!t) continue;
    const label = termLabel(id);

    if (!isDateKey(t.startDate) || !isDateKey(t.endDate)) {
      errors.push(`${label}: opening and closing dates must be valid dates.`);
      continue;
    }
    if (t.endDate <= t.startDate) {
      errors.push(`${label} must close after it opens.`);
      continue;
    }

    const length = diffDays(t.startDate, t.endDate) + 1;
    if (length < MIN_TERM_DAYS) warnings.push(`${label} is only ${length} days long. Check the dates.`);
    if (length > MAX_TERM_DAYS) warnings.push(`${label} runs ${length} days. Check the dates.`);

    const mid = checkWindow('mid-term break', label, t.midtermStart, t.midtermEnd, t, errors);
    const exam = checkWindow('exam week', label, t.examStart, t.examEnd, t, errors);
    if (mid && exam && mid[0] <= exam[1] && exam[0] <= mid[1]) {
      errors.push(`${label}: the exam week overlaps the mid-term break.`);
    }
    usable.push(t);
  }

  for (let i = 0; i < usable.length - 1; i++) {
    const a = usable[i];
    const b = usable[i + 1];
    const gap = diffDays(a.endDate, b.startDate) - 1;
    if (gap < 0) {
      errors.push(`${termLabel(a.term)} and ${termLabel(b.term)} overlap.`);
      continue;
    }
    breaks.push({ after: a.term, before: b.term, days: gap });
    if (gap > LONG_BREAK_DAYS) {
      warnings.push(`The break between ${termLabel(a.term)} and ${termLabel(b.term)} is ${gap} days.`);
    }
  }

  const first = usable.find(t => t.term === 'TERM_1');
  if (first && Number(first.startDate.slice(0, 4)) !== input.academicYear) {
    warnings.push(`Term 1 opens in ${first.startDate.slice(0, 4)}, not ${input.academicYear}.`);
  }

  return { errors, warnings, breaks, terms: usable };
}

/** Everything the screen needs before saving: pure checks plus checks against saved terms. */
export async function previewAcademicYear(input: AcademicYearPlanInput): Promise<PlanPreview> {
  const base = validateAcademicYearPlan(input);
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  let requiresConfirmation = false;
  const todayKey = schoolDateKey(new Date());

  const [sameYear, otherYears] = await Promise.all([
    prisma.termConfig.findMany({ where: { academicYear: input.academicYear, archived: false } }),
    prisma.termConfig.findMany({
      where: { academicYear: { not: input.academicYear }, archived: false },
      select: { academicYear: true, term: true, startDate: true, endDate: true },
    }),
  ]);

  for (const t of base.terms) {
    const label = termLabel(t.term);

    for (const o of otherYears) {
      const oStart = schoolDateKey(o.startDate);
      const oEnd = schoolDateKey(o.endDate);
      if (oStart <= t.endDate && oEnd >= t.startDate) {
        errors.push(`${label} overlaps ${termLabel(o.term)} of ${o.academicYear}.`);
      }
    }

    const saved = sameYear.find(c => c.term === t.term);
    if (!saved) continue;
    const savedStart = schoolDateKey(saved.startDate);
    const savedEnd = schoolDateKey(saved.endDate);
    const changed = savedStart !== t.startDate || savedEnd !== t.endDate;
    if (!changed) continue;

    if (saved.isClosed) {
      errors.push(`${label} is closed, so its dates cannot be changed.`);
    } else if (savedStart <= todayKey) {
      requiresConfirmation = true;
      warnings.push(`${label} has already started. Changing its dates affects fees, attendance and anything already sent to parents.`);
    }
  }

  const todaysTerm = base.terms.find(t => t.startDate <= todayKey && todayKey <= t.endDate);
  const activeTerm = input.activeTerm ?? todaysTerm?.term ?? null;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    terms: base.terms,
    breaks: base.breaks,
    requiresConfirmation,
    activeTerm,
  };
}

/** Validate and save the whole year in one transaction. */
export async function saveAcademicYear(input: AcademicYearPlanInput, userId: string) {
  const preview = await previewAcademicYear(input);
  if (!preview.valid) throw new ApiError(400, preview.errors.join(' '));
  if (preview.requiresConfirmation && !input.confirmRunningTermChange) {
    throw new ApiError(409, 'A term that has already started would change. Confirm the change to continue.');
  }

  const year = input.academicYear;
  const existing = await prisma.termConfig.findMany({ where: { academicYear: year } });
  let replacedLegacyEvents = 0;

  await prisma.$transaction(async tx => {
    for (const t of preview.terms) {
      const label = termLabel(t.term);
      const start = toDate(t.startDate);
      const end = toDate(t.endDate);
      const before = existing.find(c => c.term === t.term);

      const cfg = await tx.termConfig.upsert({
        where: { academicYear_term: { academicYear: year, term: t.term as any } },
        update: { startDate: start, endDate: end, archived: false, archivedAt: null, archivedBy: null },
        create: {
          academicYear: year,
          term: t.term as any,
          startDate: start,
          endDate: end,
          formativeWeight: 30,
          summativeWeight: 70,
          isActive: false,
          isClosed: false,
          createdBy: userId,
        },
      });

      if (before) {
        const oldStart = schoolDateKey(before.startDate);
        const oldEnd = schoolDateKey(before.endDate);
        const trail = [
          { field: 'startDate', oldValue: oldStart, newValue: t.startDate },
          { field: 'endDate', oldValue: oldEnd, newValue: t.endDate },
        ].filter(c => c.oldValue !== c.newValue);
        for (const c of trail) {
          await tx.changeHistory.create({
            data: {
              entityType: 'TermConfig',
              entityId: cfg.id,
              action: 'ACADEMIC_YEAR_SETUP',
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
              changedBy: userId,
              reason: input.reason || null,
            },
          });
        }
      }

      // Events the old planner screen saved under generic types.
      const legacyTerm = t.term.replace('_', ' ');
      const legacy = await tx.event.deleteMany({
        where: {
          academicYear: year,
          term: t.term,
          OR: [
            { type: 'ACADEMIC', title: { in: [`${legacyTerm} Opens`, `${legacyTerm} Closes`] } },
            { type: 'HOLIDAY', title: `${legacyTerm} Midterm Break` },
            { type: 'EXAM', title: `${legacyTerm} Examinations` },
          ],
        },
      });
      replacedLegacyEvents += legacy.count;

      const specs: { type: any; title: string; start: Date; end: Date | null }[] = [
        { type: 'TERM_OPENING', title: `${label} opens`, start, end: start },
        { type: 'TERM_CLOSING', title: `${label} closes`, start: end, end },
        {
          type: 'MIDTERM_BREAK',
          title: `${label} mid-term break`,
          start: blank(t.midtermStart) ? start : toDate(t.midtermStart as string),
          end: blank(t.midtermEnd) ? null : toDate(t.midtermEnd as string),
        },
        {
          type: 'EXAM_WEEK',
          title: `${label} exam week`,
          start: blank(t.examStart) ? start : toDate(t.examStart as string),
          end: blank(t.examEnd) ? null : toDate(t.examEnd as string),
        },
      ];

      for (const s of specs) {
        const found = await tx.event.findFirst({
          where: { academicYear: year, term: t.term, type: s.type },
          orderBy: { createdAt: 'asc' },
        });
        if (!s.end) {
          // Optional window left blank: remove the one this screen manages.
          if (found) await tx.event.delete({ where: { id: found.id } });
          continue;
        }
        const data = { title: s.title, startDate: s.start, endDate: s.end, allDay: true };
        if (found) {
          await tx.event.update({ where: { id: found.id }, data });
        } else {
          await tx.event.create({
            data: {
              ...data,
              type: s.type,
              academicYear: year,
              term: t.term,
              creatorId: userId,
              isParentVisible: true,
              audience: [],
              classIds: [],
            },
          });
        }
      }
    }

    if (preview.activeTerm) {
      await tx.termConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.termConfig.update({
        where: { academicYear_term: { academicYear: year, term: preview.activeTerm as any } },
        data: { isActive: true },
      });
    }
  });

  await redisCacheService.clear();

  return {
    academicYear: year,
    terms: preview.terms,
    breaks: preview.breaks,
    warnings: preview.warnings,
    activeTerm: preview.activeTerm,
    replacedLegacyEvents,
  };
}

// ── Loading the screen ───────────────────────────────────────────────────────

const LEGACY_TYPES: Record<string, { type: string; suffix: string }> = {
  opening: { type: 'ACADEMIC', suffix: 'Opens' },
  closing: { type: 'ACADEMIC', suffix: 'Closes' },
  midterm: { type: 'HOLIDAY', suffix: 'Midterm Break' },
  exam: { type: 'EXAM', suffix: 'Examinations' },
};

/**
 * Current setup for a year, to fill the screen. Term settings win; where a
 * term has none yet, the dates are read from planner events (including ones the
 * old planner screen saved) so existing schools do not start from blank.
 */
export async function loadAcademicYear(year: number) {
  const [configs, events] = await Promise.all([
    prisma.termConfig.findMany({ where: { academicYear: year, archived: false } }),
    prisma.event.findMany({ where: { academicYear: year }, orderBy: { startDate: 'asc' } }),
  ]);

  const key = (d?: Date | null) => (d ? schoolDateKey(d) : '');

  const terms = TERM_IDS.map(id => {
    const cfg = configs.find(c => c.term === id);
    const mine = events.filter(e => e.term === id);
    const legacyName = id.replace('_', ' ');
    const pick = (typed: string, legacy: keyof typeof LEGACY_TYPES) =>
      mine.find(e => e.type === typed) ??
      mine.find(e => e.type === LEGACY_TYPES[legacy].type && e.title === `${legacyName} ${LEGACY_TYPES[legacy].suffix}`);

    const opening = pick('TERM_OPENING', 'opening');
    const closing = pick('TERM_CLOSING', 'closing');
    const mid = pick('MIDTERM_BREAK', 'midterm');
    const exam = pick('EXAM_WEEK', 'exam');

    return {
      term: id,
      startDate: cfg ? key(cfg.startDate) : key(opening?.startDate),
      endDate: cfg ? key(cfg.endDate) : key(closing?.startDate),
      midtermStart: key(mid?.startDate),
      midtermEnd: key(mid?.endDate),
      examStart: key(exam?.startDate),
      examEnd: key(exam?.endDate),
      isActive: Boolean(cfg?.isActive),
      isClosed: Boolean(cfg?.isClosed),
      source: cfg ? 'settings' : opening || closing ? 'planner' : 'none',
    };
  });

  return {
    academicYear: year,
    terms,
    activeTerm: terms.find(t => t.isActive)?.term ?? null,
  };
}
