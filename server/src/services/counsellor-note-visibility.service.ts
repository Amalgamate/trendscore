import { ApiError } from '../utils/error.util';
import { hasAnyRole } from '../utils/roleNormalizer';

export const COUNSELLOR_NOTE_VISIBILITIES = [
  'COUNSELLOR_ONLY',
  'SHARED_WITH_STUDENT',
  'SHARED_WITH_PARENT',
  'SCHOOL_TEAM_VISIBLE',
] as const;

export type CounsellorNoteVisibility = typeof COUNSELLOR_NOTE_VISIBILITIES[number];

const VISIBILITY_ALIASES: Readonly<Record<string, CounsellorNoteVisibility>> = {
  COUNSELLOR_AND_LEARNER: 'SHARED_WITH_STUDENT',
  LEARNER_VISIBLE: 'SHARED_WITH_STUDENT',
  PARENT_VISIBLE: 'SHARED_WITH_PARENT',
};

const COUNSELLOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];

export function normalizeCounsellorNoteVisibility(raw: unknown): CounsellorNoteVisibility {
  const value = String(raw ?? 'COUNSELLOR_ONLY').trim().toUpperCase();
  const normalized = VISIBILITY_ALIASES[value] ?? value;
  if (!COUNSELLOR_NOTE_VISIBILITIES.includes(normalized as CounsellorNoteVisibility)) {
    throw new ApiError(
      422,
      `visibility must be one of: ${COUNSELLOR_NOTE_VISIBILITIES.join(', ')}`,
    );
  }
  return normalized as CounsellorNoteVisibility;
}

/**
 * Returns null when the viewer may read every note, otherwise the exact stored
 * visibility values that may be returned. Legacy aliases remain readable so
 * previously-created shared notes do not disappear after hardening.
 */
export function readableCounsellorNoteVisibilities(
  user: { role?: unknown; roles?: unknown[] } | undefined | null,
): string[] | null {
  if (hasAnyRole(user, COUNSELLOR_ROLES)) return null;
  if (hasAnyRole(user, ['STUDENT'])) {
    return ['SHARED_WITH_STUDENT', 'COUNSELLOR_AND_LEARNER', 'LEARNER_VISIBLE'];
  }
  if (hasAnyRole(user, ['PARENT'])) {
    return ['SHARED_WITH_PARENT', 'PARENT_VISIBLE'];
  }
  if (hasAnyRole(user, ['TEACHER'])) return ['SCHOOL_TEAM_VISIBLE'];
  throw new ApiError(403, 'Access denied: counsellor notes are restricted');
}

