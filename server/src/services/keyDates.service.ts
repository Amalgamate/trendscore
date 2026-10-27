/**
 * keyDates.service.ts
 *
 * Single source for the compact "Term Countdown" card shown on every dashboard.
 *
 * Sources (no new tables):
 *   - TermConfig            -> current / next term, start & end
 *   - Event (planner)       -> TERM_OPENING, TERM_CLOSING, MIDTERM_BREAK, EXAM_WEEK, EXAM, HOLIDAY
 *   - FeeInvoice.dueDate    -> fee deadline row (PARENT: own family; finance/admin roles: school-wide)
 *
 * All day counts are computed server-side in the school's timezone so a wrong
 * device clock cannot change the number a user sees.
 *
 * Visibility (see eventVisibility.service.ts):
 *   - Each event has an audience (staff, teachers, parents, students, drivers;
 *     empty = everyone) and optional class targeting for parents/students.
 *   - Calendar managers (SUPER_ADMIN, ADMIN, HEAD_TEACHER, OWNER) see everything.
 *   - Fee rows: PARENT sees only their accessible learners' invoices;
 *     ACCOUNTANT / ADMIN / SUPER_ADMIN / OWNER see school-wide totals;
 *     every other role gets no fee row.
 */

import prisma from '../config/database';
import { parentAccessService } from './parent-access.service';
import { hasAnyRole } from '../utils/roleNormalizer';
import { getIO } from './socket.service';
import { buildEventVisibilityWhere } from './eventVisibility.service';

export const SCHOOL_TIME_ZONE = process.env.SCHOOL_TIME_ZONE || 'Africa/Nairobi';
export const KEY_DATES_CHANGED_EVENT = 'keydates:changed';

const KEY_EVENT_TYPES = ['TERM_OPENING', 'TERM_CLOSING', 'MIDTERM_BREAK', 'EXAM_WEEK', 'EXAM', 'HOLIDAY'] as const;
type KeyEventType = typeof KEY_EVENT_TYPES[number];

const EVENT_LABELS: Record<KeyEventType, string> = {
  TERM_OPENING: 'Term opens',
  TERM_CLOSING: 'Term closes',
  MIDTERM_BREAK: 'Mid-term break',
  EXAM_WEEK: 'Exam week',
  EXAM: 'Exam',
  HOLIDAY: 'Holiday',
};

const FEE_VIEW_ROLES = ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN', 'OWNER'];
const UNPAID_STATUSES = ['PENDING', 'PARTIAL'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 4;

// ── Date helpers (school-local calendar days) ────────────────────────────────

/** YYYY-MM-DD for the given instant in the school timezone. */
export function schoolDateKey(value: Date | string | number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

/** Whole calendar days from `fromKey` to `toKey` (negative = in the past). */
export function diffDays(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** Start-of-day instant for a school-local date key. */
function startOfSchoolDay(key: string): Date {
  // Kenya has no DST; derive the offset from the zone so SCHOOL_TIME_ZONE overrides still work.
  const probe = new Date(`${key}T12:00:00Z`);
  const local = new Date(probe.toLocaleString('en-US', { timeZone: SCHOOL_TIME_ZONE }));
  const offsetMs = local.getTime() - new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(Date.parse(`${key}T00:00:00Z`) - offsetMs);
}

const termLabel = (term: string) => `Term ${String(term).replace('TERM_', '')}`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface KeyDateItem {
  key: string;
  kind: string;
  label: string;
  date: string;          // YYYY-MM-DD start
  endDate: string;       // YYYY-MM-DD end
  daysUntil: number;     // days to start (negative once started)
  daysUntilEnd: number;  // days to end
  state: 'upcoming' | 'today' | 'ongoing';
  source: 'event' | 'term';
}

export interface FeeDeadline {
  scope: 'family' | 'school';
  nextDueDate: string | null;
  daysUntilDue: number | null;  // negative = overdue
  outstandingKsh: number;
  invoiceCount: number;
  overdueCount: number;
}

interface UserLike { userId?: string; id?: string; role?: unknown; roles?: unknown[] }

// ── Core ─────────────────────────────────────────────────────────────────────

async function resolveTerm(todayKey: string) {
  const configs = await prisma.termConfig.findMany({
    where: { archived: false },
    orderBy: { startDate: 'asc' },
  });
  if (!configs.length) return { current: null as any, next: null as any };

  const withKeys = configs.map((c: any) => ({
    ...c,
    startKey: schoolDateKey(c.startDate),
    endKey: schoolDateKey(c.endDate),
  }));

  const inRange = withKeys.filter((c: any) => c.startKey <= todayKey && todayKey <= c.endKey);
  const current = inRange.find((c: any) => c.isActive) || inRange[0] || null;
  const next = withKeys.find((c: any) => c.startKey > todayKey) || null;
  return { current, next };
}

function termSummary(current: any, next: any, todayKey: string) {
  if (current) {
    const totalDays = diffDays(current.startKey, current.endKey) + 1;
    const dayNumber = Math.min(totalDays, Math.max(1, diffDays(current.startKey, todayKey) + 1));
    return {
      state: 'in_term' as const,
      academicYear: current.academicYear,
      term: current.term,
      label: termLabel(current.term),
      startDate: current.startKey,
      endDate: current.endKey,
      dayNumber,
      totalDays,
      daysLeft: Math.max(0, diffDays(todayKey, current.endKey)),
      progressPct: Math.round((dayNumber / totalDays) * 100),
    };
  }
  if (next) {
    return {
      state: 'break' as const,
      academicYear: next.academicYear,
      term: next.term,
      label: termLabel(next.term),
      startDate: next.startKey,
      endDate: next.endKey,
      daysToOpen: diffDays(todayKey, next.startKey),
    };
  }
  return { state: 'none' as const };
}

function toItem(
  key: string, kind: string, label: string,
  startKey: string, endKey: string, todayKey: string, source: 'event' | 'term',
): KeyDateItem {
  const daysUntil = diffDays(todayKey, startKey);
  const daysUntilEnd = diffDays(todayKey, endKey);
  const state = daysUntil > 0 ? 'upcoming' : daysUntilEnd >= 0 && daysUntil < 0 ? 'ongoing' : 'today';
  return { key, kind, label, date: startKey, endDate: endKey, daysUntil, daysUntilEnd, state, source };
}

async function loadEventItems(user: UserLike, todayKey: string): Promise<KeyDateItem[]> {
  const visibility = await buildEventVisibilityWhere(user);
  const events = await prisma.event.findMany({
    where: {
      type: { in: KEY_EVENT_TYPES as unknown as any[] },
      endDate: { gte: startOfSchoolDay(todayKey) },
      ...visibility,
    },
    orderBy: { startDate: 'asc' },
    take: 60,
  });

  return events.map((e: any) => {
    const type = e.type as KeyEventType;
    const label = type === 'EXAM' || type === 'HOLIDAY' ? (e.title || EVENT_LABELS[type]) : EVENT_LABELS[type];
    return toItem(`event:${e.id}`, type, label, schoolDateKey(e.startDate), schoolDateKey(e.endDate), todayKey, 'event');
  });
}

/** Term start/end from TermConfig, only where the planner has no matching event. */
function termFallbackItems(current: any, next: any, existing: KeyDateItem[], todayKey: string): KeyDateItem[] {
  const out: KeyDateItem[] = [];
  const hasKind = (kind: string, date: string) => existing.some(i => i.kind === kind && i.date === date);
  for (const t of [current, next].filter(Boolean)) {
    if (t.startKey >= todayKey && !hasKind('TERM_OPENING', t.startKey)) {
      out.push(toItem(`term:${t.id}:open`, 'TERM_OPENING', EVENT_LABELS.TERM_OPENING, t.startKey, t.startKey, todayKey, 'term'));
    }
    if (t.endKey >= todayKey && !hasKind('TERM_CLOSING', t.endKey)) {
      out.push(toItem(`term:${t.id}:close`, 'TERM_CLOSING', EVENT_LABELS.TERM_CLOSING, t.endKey, t.endKey, todayKey, 'term'));
    }
  }
  return out;
}

async function loadFeeDeadline(user: UserLike, todayKey: string): Promise<FeeDeadline | null> {
  const todayStart = startOfSchoolDay(todayKey);
  const unpaid = { archived: false, status: { in: UNPAID_STATUSES as unknown as any[] }, balance: { gt: 0 } };

  let scope: 'family' | 'school';
  let where: any;
  if (hasAnyRole(user, ['PARENT'])) {
    const parentId = user.userId || user.id;
    if (!parentId) return null;
    const learnerIds = await parentAccessService.getAccessibleLearnerIds(parentId);
    if (!learnerIds.length) return null;
    scope = 'family';
    where = { ...unpaid, learnerId: { in: learnerIds } };
  } else if (hasAnyRole(user, FEE_VIEW_ROLES)) {
    scope = 'school';
    where = unpaid;
  } else {
    return null;
  }

  const [upcoming, overdueCount, totals] = await Promise.all([
    prisma.feeInvoice.findFirst({
      where: { ...where, dueDate: { gte: todayStart } },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true },
    }),
    prisma.feeInvoice.count({ where: { ...where, dueDate: { lt: todayStart } } }),
    prisma.feeInvoice.aggregate({ where, _sum: { balance: true }, _count: { _all: true } }),
  ]);

  let nextDue: string | null = null;
  if (upcoming?.dueDate) {
    nextDue = schoolDateKey(upcoming.dueDate);
  } else if (overdueCount > 0) {
    const oldest = await prisma.feeInvoice.findFirst({
      where: { ...where, dueDate: { lt: todayStart } },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true },
    });
    nextDue = oldest?.dueDate ? schoolDateKey(oldest.dueDate) : null;
  }

  const invoiceCount = totals._count?._all ?? 0;
  if (!invoiceCount) return null;

  return {
    scope,
    nextDueDate: nextDue,
    daysUntilDue: nextDue ? diffDays(todayKey, nextDue) : null,
    outstandingKsh: Number(totals._sum?.balance ?? 0),
    invoiceCount,
    overdueCount,
  };
}

export async function getKeyDates(user: UserLike) {
  const todayKey = schoolDateKey(new Date());
  const { current, next } = await resolveTerm(todayKey);

  const eventItems = await loadEventItems(user, todayKey);
  const fallback = termFallbackItems(current, next, eventItems, todayKey);

  const items = [...eventItems, ...fallback]
    .filter(i => i.daysUntilEnd >= 0)
    .sort((a, b) => (a.daysUntil - b.daysUntil) || a.label.localeCompare(b.label))
    .slice(0, MAX_ITEMS);

  const fee = await loadFeeDeadline(user, todayKey);

  return {
    today: todayKey,
    timeZone: SCHOOL_TIME_ZONE,
    term: termSummary(current, next, todayKey),
    items,
    fee,
    generatedAt: new Date().toISOString(),
  };
}

/** Tell every connected client the dates changed so cards refetch immediately. */
export function broadcastKeyDatesChanged(): void {
  try {
    getIO().emit(KEY_DATES_CHANGED_EVENT, { at: Date.now() });
  } catch {
    // Socket server not started (tests, scripts) — clients fall back to polling.
  }
}
