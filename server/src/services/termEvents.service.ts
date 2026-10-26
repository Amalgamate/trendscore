/**
 * termEvents.service.ts
 *
 * Keeps the planner's TERM_OPENING and TERM_CLOSING events in step with
 * TermConfig, so the term settings own the term itself and the planner never
 * holds a second, different copy of those two dates.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';

interface TermLike {
  academicYear: number;
  term: string;
  startDate: Date | string;
  endDate: Date | string;
  createdBy: string;
}

const termNumber = (term: string) => String(term).replace('TERM_', '');

/** Throws 400 unless start/end are real dates, in order, and clear of the year's other terms. */
export async function assertValidTermRange(
  academicYear: number,
  term: string,
  start: Date,
  end: Date,
): Promise<void> {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'Term start and end dates must be valid dates.');
  }
  if (end.getTime() <= start.getTime()) {
    throw new ApiError(400, 'Term end date must be after the start date.');
  }

  const others = await prisma.termConfig.findMany({
    where: { academicYear, archived: false, NOT: { term: term as any } },
    select: { term: true, startDate: true, endDate: true },
  });
  const clash = others.find(o => o.startDate <= end && o.endDate >= start);
  if (clash) {
    throw new ApiError(
      400,
      `These dates overlap Term ${termNumber(clash.term)} of ${academicYear}. Adjust one of the terms.`,
    );
  }
}

/** Create or update the opening and closing events for one term. */
export async function syncTermEvents(config: TermLike): Promise<void> {
  const label = `Term ${termNumber(config.term)}`;
  const start = new Date(config.startDate);
  const end = new Date(config.endDate);

  const targets = [
    { type: 'TERM_OPENING' as const, title: `${label} opens`, date: start },
    { type: 'TERM_CLOSING' as const, title: `${label} closes`, date: end },
  ];

  try {
    for (const t of targets) {
      const existing = await prisma.event.findFirst({
        where: { academicYear: config.academicYear, term: config.term, type: t.type },
      });
      const data = { title: t.title, startDate: t.date, endDate: t.date, allDay: true };
      if (existing) {
        await prisma.event.update({ where: { id: existing.id }, data });
      } else {
        await prisma.event.create({
          data: {
            ...data,
            type: t.type,
            academicYear: config.academicYear,
            term: config.term,
            creatorId: config.createdBy,
            isParentVisible: true,
            audience: [],
            classIds: [],
          },
        });
      }
    }
  } catch (err) {
    // The term itself is saved; do not fail the request over the mirrored events.
    logger.error('[TermEvents] Failed to sync term events', err);
  }
}
