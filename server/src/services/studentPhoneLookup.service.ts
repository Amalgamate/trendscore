/**
 * studentPhoneLookup.service.ts
 *
 * Implements the multi-source student phone lookup algorithm.
 * Given a raw phone string, resolves all active non-archived student User
 * records whose linked parent owns that phone — via:
 *   Source A: Learner.parentId → parent User.phone / email / username
 *   Source B: FamilyAccount → FamilyMember.normalizedPhone → LearnerFamilyLink
 *   Source C: Learner.guardianPhone / fatherPhone / motherPhone / primaryContactPhone
 *
 * Then issues a short-lived HMAC-signed session token binding the phone to
 * the resolved candidate set.
 *
 * NEVER throws for any phone input (phone-enumeration resistance, Req 8.4).
 */

import prisma from '../config/database';
import { getKenyanPhoneLookupCandidates, normalizeKenyanPhone } from '../utils/phone.util';
import { buildParentLoginEmail, getParentLoginEmailCandidates } from './parent.service';
import { issueSessionToken } from '../utils/studentSessionToken.util';
import { PRODUCT_EMAIL_DOMAIN } from '../config/productIdentity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentCandidate {
  studentUserId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  grade: string;
}

export interface LookupResult {
  candidates: StudentCandidate[];
  sessionToken: string;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors the private `normalizeBaseUsername` from studentAccount.service.ts.
 * Inlined here because it is not exported from that module.
 */
function normalizeBaseUsername(admissionNumber: string): string {
  const normalized = String(admissionNumber || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `STUDENT-${Date.now()}`;
}

/**
 * Returns true when a Prisma error is a "missing family table" error (P2021 / P2022),
 * matching the handling in parent-access.service.ts.
 */
function isMissingFamilyTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; meta?: { table?: string; modelName?: string } };
  if (maybeError?.code !== 'P2021' && maybeError?.code !== 'P2022') return false;
  const table = String(maybeError.meta?.table || maybeError.meta?.modelName || '');
  return table.includes('family') || table.includes('Family');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StudentPhoneLookupService {
  /**
   * Core resolution algorithm.
   * Returns deduplicated StudentCandidate[] — may be empty.
   * Does NOT throw; callers should wrap in try/catch for unexpected errors.
   */
  private async resolveStudentsForPhone(rawPhone: string): Promise<StudentCandidate[]> {
    // --- Phone candidates ------------------------------------------------
    const phoneCandidates = getKenyanPhoneLookupCandidates(rawPhone);

    // Build email candidates from all phone variants
    const emailCandidates = Array.from(
      new Set([
        ...getParentLoginEmailCandidates(rawPhone),
        ...(buildParentLoginEmail(rawPhone) ? [buildParentLoginEmail(rawPhone) as string] : []),
      ])
    );

    // --- Step 1: Find parent User records --------------------------------
    const parentUsers = await prisma.user.findMany({
      where: {
        archived: false,
        OR: [
          { phone: { in: phoneCandidates } },
          { email: { in: emailCandidates } },
          { username: { in: emailCandidates } },
        ],
      },
      select: { id: true },
    });

    const parentIds = new Set<string>(parentUsers.map((u) => u.id));

    // --- Step 2: FamilyMember records with matching normalizedPhone -------
    const familyAccountIds = new Set<string>();

    try {
      const familyMembers = await prisma.familyMember.findMany({
        where: {
          normalizedPhone: { in: phoneCandidates },
          status: 'ACTIVE',
        },
        select: { userId: true, familyAccountId: true },
      });

      for (const fm of familyMembers) {
        if (fm.userId) {
          parentIds.add(fm.userId);
        }
        familyAccountIds.add(fm.familyAccountId);
      }
    } catch (error) {
      if (!isMissingFamilyTableError(error)) {
        throw error;
      }
      // Family tables may not exist on all deployments — continue gracefully
    }

    // --- Step 3: Collect learner IDs from all sources --------------------
    const learnerIds = new Set<string>();

    // Source A: Learner.parentId
    if (parentIds.size > 0) {
      const directLearners = await prisma.learner.findMany({
        where: {
          parentId: { in: Array.from(parentIds) },
          archived: false,
        },
        select: { id: true },
      });
      for (const l of directLearners) {
        learnerIds.add(l.id);
      }
    }

    // Source B: FamilyAccount → LearnerFamilyLink
    if (familyAccountIds.size > 0) {
      try {
        const familyLinks = await prisma.learnerFamilyLink.findMany({
          where: {
            familyAccountId: { in: Array.from(familyAccountIds) },
          },
          select: { learnerId: true },
        });
        for (const link of familyLinks) {
          learnerIds.add(link.learnerId);
        }
      } catch (error) {
        if (!isMissingFamilyTableError(error)) {
          throw error;
        }
      }
    }

    // Source C: Learner phone columns (no parent User record required)
    const directByPhone = await prisma.learner.findMany({
      where: {
        archived: false,
        OR: [
          { guardianPhone: { in: phoneCandidates } },
          { fatherPhone: { in: phoneCandidates } },
          { motherPhone: { in: phoneCandidates } },
          { primaryContactPhone: { in: phoneCandidates } },
        ],
      },
      select: { id: true },
    });
    for (const l of directByPhone) {
      learnerIds.add(l.id);
    }

    if (learnerIds.size === 0) {
      return [];
    }

    // --- Step 4: Resolve student User accounts ---------------------------
    const learners = await prisma.learner.findMany({
      where: { id: { in: Array.from(learnerIds) } },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        grade: true,
      },
    });

    const candidates: StudentCandidate[] = [];
    const seenUserIds = new Set<string>();

    for (const learner of learners) {
      const username = normalizeBaseUsername(learner.admissionNumber);
      const email = `${username}@${PRODUCT_EMAIL_DOMAIN}`;

      const studentUser = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
          role: 'STUDENT',
          status: 'ACTIVE',
          archived: false,
        },
        select: { id: true },
      });

      if (studentUser && !seenUserIds.has(studentUser.id)) {
        seenUserIds.add(studentUser.id);
        candidates.push({
          studentUserId: studentUser.id,
          admissionNumber: learner.admissionNumber,
          firstName: learner.firstName,
          lastName: learner.lastName,
          grade: learner.grade,
        });
      }
    }

    return candidates;
  }

  /**
   * Public lookup entry point.
   *
   * ALWAYS returns a valid LookupResult — never throws (Req 8.4).
   * On unexpected error, logs a warning and returns empty candidates with a
   * valid session token so the response shape is always uniform.
   *
   * @param phone     Raw phone string from the client
   * @param ipAddress Optional caller IP (reserved for future rate-limit use)
   */
  async lookup(phone: string, ipAddress?: string): Promise<LookupResult> {
    // Determine E.164 phone for the session token; fall back gracefully if
    // the phone cannot be normalized (e.g. invalid format).
    let phoneE164 = phone;
    try {
      phoneE164 = normalizeKenyanPhone(phone).e164;
    } catch {
      // Non-Kenyan or malformed phone — still issue a token, just use raw value.
      phoneE164 = phone;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    try {
      const candidates = await this.resolveStudentsForPhone(phone);
      const candidateIds = candidates.map((c) => c.studentUserId);
      const sessionToken = issueSessionToken(phoneE164, candidateIds);

      return { candidates, sessionToken, expiresAt };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[StudentPhoneLookupService] Unexpected error during lookup:', message);

      // Return an empty-but-valid result to avoid phone enumeration leakage
      const sessionToken = issueSessionToken(phoneE164, []);
      return { candidates: [], sessionToken, expiresAt };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const studentPhoneLookupService = new StudentPhoneLookupService();
