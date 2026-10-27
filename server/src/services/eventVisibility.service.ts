/**
 * eventVisibility.service.ts
 *
 * Single place that decides which planner events a user may see, and how an
 * event's audience / class targeting is normalised when it is saved.
 *
 * Event.audience   : empty = everyone. Otherwise any of STAFF | TEACHERS |
 *                    PARENTS | STUDENTS | DRIVERS.
 * Event.classIds   : empty = whole school. Applies to PARENTS / STUDENTS only.
 * Event.isParentVisible is kept as a derived column for older clients and is
 * always recomputed from audience in resolveAudienceFields().
 *
 * Class targeting matches on grade + stream, not on the Class row id alone,
 * because a Class row exists per term (unique on grade, stream, year, term).
 * An event aimed at Grade 6 North still reaches those families next term.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { hasAnyRole } from '../utils/roleNormalizer';
import { parentAccessService } from './parent-access.service';

export const EVENT_AUDIENCES = ['STAFF', 'TEACHERS', 'PARENTS', 'STUDENTS', 'DRIVERS'] as const;
export type EventAudience = (typeof EVENT_AUDIENCES)[number];

interface UserLike { userId?: string; id?: string; role?: unknown; roles?: unknown[] }

/** Roles that manage the calendar and therefore see every event. */
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'OWNER'];
const TEACHING_ROLES = ['TEACHER', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];
const FAMILY_ROLES = ['PARENT', 'STUDENT'];

const isFamilyUser = (user: UserLike) => hasAnyRole(user, FAMILY_ROLES);

/** The audience values that apply to this user. */
export function audienceTokensFor(user: UserLike): EventAudience[] {
  const tokens = new Set<EventAudience>();
  if (hasAnyRole(user, ['PARENT'])) tokens.add('PARENTS');
  if (hasAnyRole(user, ['STUDENT'])) tokens.add('STUDENTS');
  if (hasAnyRole(user, ['DRIVER'])) tokens.add('DRIVERS');
  if (!isFamilyUser(user) && !hasAnyRole(user, ['DRIVER'])) {
    tokens.add('STAFF');
    if (hasAnyRole(user, TEACHING_ROLES)) tokens.add('TEACHERS');
  }
  return Array.from(tokens);
}

async function learnerIdsFor(user: UserLike): Promise<string[]> {
  const userId = user.userId || user.id;
  if (!userId) return [];
  if (hasAnyRole(user, ['PARENT'])) {
    return parentAccessService.getAccessibleLearnerIds(userId);
  }
  const learners = await prisma.learner.findMany({
    where: { studentUserId: userId },
    select: { id: true },
  });
  return learners.map(l => l.id);
}

/**
 * Ids of every Class row (any term or year) that shares a grade + stream with
 * a class the user's learners are currently enrolled in.
 */
async function visibleClassIdsFor(user: UserLike): Promise<string[]> {
  const learnerIds = await learnerIdsFor(user);
  if (!learnerIds.length) return [];

  const enrollments = await prisma.classEnrollment.findMany({
    where: { learnerId: { in: learnerIds }, active: true, archived: false },
    select: { class: { select: { grade: true, stream: true } } },
  });

  const seen = new Set<string>();
  const pairs: { grade: string; stream: string | null }[] = [];
  for (const e of enrollments) {
    const key = `${e.class.grade}|${e.class.stream ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ grade: e.class.grade, stream: e.class.stream ?? null });
  }
  if (!pairs.length) return [];

  const classes = await prisma.class.findMany({
    where: { OR: pairs },
    select: { id: true },
  });
  return classes.map(c => c.id);
}

/**
 * Prisma `where` fragment limiting events to those this user may see.
 * Merge it into an Event query with Object.assign(where, fragment).
 */
export async function buildEventVisibilityWhere(user: UserLike): Promise<Record<string, any>> {
  if (hasAnyRole(user, MANAGER_ROLES)) return {};

  const tokens = audienceTokensFor(user);
  const and: any[] = [
    { OR: [{ audience: { isEmpty: true } }, ...(tokens.length ? [{ audience: { hasSome: tokens } }] : [])] },
  ];

  if (!isFamilyUser(user)) return { AND: and };

  const classIds = await visibleClassIdsFor(user);
  and.push({
    OR: [{ classIds: { isEmpty: true } }, ...(classIds.length ? [{ classIds: { hasSome: classIds } }] : [])],
  });
  // Belt and braces for rows saved before audience existed.
  return { isParentVisible: true, AND: and };
}

// ── Saving ───────────────────────────────────────────────────────────────────

const reachesFamilies = (audience: string[]) =>
  audience.length === 0 || audience.includes('PARENTS') || audience.includes('STUDENTS');

interface AudienceInput {
  audience?: string[] | null;
  classIds?: string[] | null;
  isParentVisible?: boolean | null;
}

interface ExistingAudience {
  audience: string[];
  classIds: string[];
  isParentVisible: boolean;
}

/**
 * Work out the audience, class targeting and legacy isParentVisible to store.
 * Older clients only send isParentVisible; that is translated without widening
 * or narrowing an audience they never knew about.
 */
export function resolveAudienceFields(input: AudienceInput, existing?: ExistingAudience) {
  let audience: string[];

  if (Array.isArray(input.audience)) {
    audience = input.audience;
  } else if (typeof input.isParentVisible === 'boolean') {
    const current = existing?.audience ?? [];
    if (input.isParentVisible) {
      audience = reachesFamilies(current) ? current : [];
    } else {
      audience = reachesFamilies(current) || current.length === 0 ? ['STAFF'] : current;
    }
  } else {
    // Rows saved before audience existed: hidden from parents means staff-only.
    audience = existing?.audience ?? [];
    if (existing && audience.length === 0 && existing.isParentVisible === false) audience = ['STAFF'];
  }

  audience = Array.from(new Set(audience));
  const invalid = audience.filter(a => !(EVENT_AUDIENCES as readonly string[]).includes(a));
  if (invalid.length) {
    throw new ApiError(400, `Invalid audience: ${invalid.join(', ')}. Use ${EVENT_AUDIENCES.join(', ')}.`);
  }

  const classIds = Array.from(new Set(Array.isArray(input.classIds) ? input.classIds : existing?.classIds ?? []));
  if (classIds.length && !reachesFamilies(audience)) {
    throw new ApiError(400, 'Class targeting applies to parents and students only. Add PARENTS or STUDENTS to the audience, or clear the classes.');
  }

  return { audience, classIds, isParentVisible: reachesFamilies(audience) };
}

export async function assertClassIdsExist(classIds: string[]): Promise<void> {
  if (!classIds.length) return;
  const found = await prisma.class.count({ where: { id: { in: classIds } } });
  if (found !== classIds.length) {
    throw new ApiError(400, 'One or more selected classes do not exist.');
  }
}
