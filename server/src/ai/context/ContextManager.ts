/**
 * Context Manager
 *
 * Builds a structured AIContext from an HTTP request.
 * Designed for TrendSCORE's single-school architecture.
 * Only retrieves what's needed — not the entire database.
 */

import prisma from '../../config/database';
import type { AIContext, UserRole } from '../types';

interface BuildContextOptions {
  userId: string;
  role: UserRole;
  currentRoute: string;
  schoolId?: string;
  schoolName?: string;
  selectedEntityId?: string;
  selectedEntityType?: NonNullable<AIContext['selectedEntity']>['type'];
}

export async function buildAIContext(opts: BuildContextOptions): Promise<AIContext> {
  const { userId, currentRoute, selectedEntityId, selectedEntityType } = opts;
  const role = opts.role as UserRole;

  // Load user + active school in parallel — single-school architecture
  const [user, school] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true },
    }),
    opts.schoolId
      ? prisma.school.findUnique({
          where: { id: opts.schoolId },
          select: { id: true, name: true },
        })
      : prisma.school.findFirst({
          where: { archived: false, active: true },
          select: { id: true, name: true },
          orderBy: { createdAt: 'asc' },
        }),
  ]);

  // Resolve selected entity name (non-critical — skip on failure)
  let selectedEntity: AIContext['selectedEntity'];
  if (selectedEntityId && selectedEntityType) {
    selectedEntity = await resolveEntityName(selectedEntityId, selectedEntityType);
  }

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User'
    : 'User';

  return {
    user: {
      id: userId,
      role,
      name: userName,
      schoolId: opts.schoolId || school?.id || '',
    },
    school: {
      id: opts.schoolId || school?.id || '',
      name: opts.schoolName || school?.name || 'TrendSCORE School',
    },
    currentModule: routeToModule(currentRoute),
    currentRoute,
    selectedEntity,
  };
}

/**
 * Build a minimal context without database calls.
 * Use when you already have the data (e.g., from JWT + request body).
 */
export function buildMinimalContext(opts: {
  userId: string;
  role: UserRole;
  schoolId: string;
  schoolName: string;
  userName: string;
  currentModule?: string;
}): AIContext {
  return {
    user: {
      id: opts.userId,
      role: opts.role,
      name: opts.userName,
      schoolId: opts.schoolId,
    },
    school: {
      id: opts.schoolId,
      name: opts.schoolName,
    },
    currentModule: opts.currentModule || 'general',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function resolveEntityName(
  id: string,
  type: NonNullable<AIContext['selectedEntity']>['type']
): Promise<AIContext['selectedEntity']> {
  try {
    if (type === 'learner') {
      const learner = await prisma.learner.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      });
      if (!learner) return undefined;
      return { type, id, name: `${learner.firstName} ${learner.lastName}` };
    }

    if (type === 'class') {
      const cls = await prisma.class.findUnique({
        where: { id },
        select: { name: true },
      });
      if (!cls) return undefined;
      return { type, id, name: cls.name };
    }

    if (type === 'teacher' || type === 'parent' || type === 'staff') {
      const u = await prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true, username: true },
      });
      if (!u) return undefined;
      return {
        type,
        id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || id,
      };
    }
  } catch {
    // Non-critical — skip on failure
  }

  return undefined;
}

/** Map a URL route to a friendly module name. */
function routeToModule(route: string): string {
  const r = (route || '').toLowerCase();
  if (r.includes('pathway')) return 'pathways';
  if (r.includes('attendance')) return 'attendance';
  if (r.includes('assessment') || r.includes('grading')) return 'assessments';
  if (r.includes('fee') || r.includes('account')) return 'finance';
  if (r.includes('student') || r.includes('learner')) return 'learners';
  if (r.includes('staff') || r.includes('teacher') || r.includes('hr')) return 'staff';
  if (r.includes('report')) return 'reports';
  if (r.includes('communication') || r.includes('message')) return 'communication';
  if (r.includes('library')) return 'library';
  if (r.includes('lms') || r.includes('lesson')) return 'lms';
  if (r.includes('dashboard')) return 'dashboard';
  return 'general';
}
