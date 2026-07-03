/**
 * ImpersonationService
 *
 * Implements the three core operations of the Admin User Impersonation feature:
 *   1. searchUsers      — live search of impersonatable users (Tasks 2.1)
 *   2. startImpersonation — validates scope and issues a short-lived JWT (Task 2.5)
 *   3. stopImpersonation  — revokes the token and writes audit trail (Task 2.11)
 *
 * Requirements: 1.3, 1.4, 2.1–2.6, 3.2–3.9, 5.2–5.4, 8.1–8.6, 9.1–9.6
 */

import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { canManageRole } from '../config/permissions';
import { type Role } from '../config/roleDefinitions';
import { redisCacheService } from './redis-cache.service';
import { authTokenService } from './auth-token.service';
import { ApiError } from '../utils/error.util';
import {
  type UserSearchResult,
  type ImpersonationStartResult,
  type ImpersonationJWTPayload,
  type ImpersonationAuditPayload,
} from '../types/impersonation.types';

// ─────────────────────────────────────────────────────────────────────────────
// Redis key namespace for revoked impersonation access tokens.
// Must be consistent with auth.middleware.ts (Task 3.1).
// Using a distinct prefix from refresh-token revocation (`revoked_rt:`)
// to avoid key-space collisions.
// ─────────────────────────────────────────────────────────────────────────────
export const revokedImpersonationKey = (token: string): string =>
  `revoked_imp:${token}`;

/** Hard-coded TTL for impersonation tokens — 30 minutes (Requirement 8.1). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _IMPERSONATION_TTL_SECONDS = 30 * 60; // kept for documentation; jwt.sign uses '30m' string

// ─────────────────────────────────────────────────────────────────────────────
// Caller context shape — the decoded JWT payload on req.user.
// ─────────────────────────────────────────────────────────────────────────────
interface RequestingUser {
  userId: string;
  email: string;
  role: Role;
  roles?: Role[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper types
// ─────────────────────────────────────────────────────────────────────────────

type InstitutionType = 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

/**
 * Shape of a Prisma User row as fetched by startImpersonation.
 * Required fields are checked explicitly before issuing a token (Req 8.5 / 422).
 */
interface TargetUserRecord {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  roles: Role[];
  institutionType: InstitutionType | null;
  status: string;
  archived: boolean;
  profilePicture: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service class
// ─────────────────────────────────────────────────────────────────────────────

export class ImpersonationService {
  // ───────────────────────────────────────────────────────────────────────────
  // 2.1  searchUsers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Search for users that the requesting admin can impersonate.
   *
   * - Returns `[]` immediately for blank / whitespace-only queries (Req 1.3).
   * - ADMIN callers never see SUPER_ADMIN accounts (Req 2.1).
   * - Non-ADMIN/non-SUPER_ADMIN callers are rejected with HTTP 403.
   * - Results are capped at `limit` (max 10) and ordered by firstName, lastName (Req 2.5, 2.6).
   * - Multi-term search across firstName, lastName, email, phone, staffId, and linked
   *   learner admissionNumber (Req 1.4, 2.2, 2.3).
   *
   * Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  async searchUsers(
    query: string,
    requestingUser: RequestingUser,
    limit: number = 10,
  ): Promise<UserSearchResult[]> {
    // Scope guard — only SUPER_ADMIN and ADMIN may use this endpoint.
    const callerRole = requestingUser.role as string;
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
      throw new ApiError(403, 'Insufficient permissions to search users for impersonation')
        .withCode('ROLE_FORBIDDEN');
    }

    // Early exit for blank / whitespace-only queries (Req 1.3).
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    // Cap limit at 10 (Req 2.5).
    const safeLimit = Math.min(Math.max(1, limit), 10);

    // Scope filter: ADMIN cannot see SUPER_ADMIN accounts (Req 2.1).
    const scopeFilter =
      callerRole === 'ADMIN'
        ? { role: { not: 'SUPER_ADMIN' as Role } }
        : {};

    // Multi-term search — each whitespace-separated token must match at
    // least one of the indexed fields (Req 1.4, 2.2, 2.3).
    const searchTerms = trimmed.split(/\s+/).filter(Boolean);

    const searchFilter = {
      AND: searchTerms.map((term) => ({
        OR: [
          { firstName:  { contains: term, mode: 'insensitive' as const } },
          { lastName:   { contains: term, mode: 'insensitive' as const } },
          { email:      { contains: term, mode: 'insensitive' as const } },
          { phone:      { contains: term } },
          { staffId:    { contains: term, mode: 'insensitive' as const } },
          // Learner admissionNumber (linked via parentId relation) (Req 2.3)
          {
            learners: {
              some: {
                admissionNumber: { contains: term, mode: 'insensitive' as const },
              },
            },
          },
        ],
      })),
    };

    const users = await prisma.user.findMany({
      where: {
        archived: false,
        status: 'ACTIVE',
        ...scopeFilter,
        ...searchFilter,
      },
      take: safeLimit,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id:             true,
        firstName:      true,
        lastName:       true,
        email:          true,
        phone:          true,
        role:           true,
        staffId:        true,
        profilePicture: true,
        status:         true,
        // Left-join learners via parentId relation for linkedLearners enrichment.
        // Each learner's latest active ClassEnrollment is resolved for className.
        learners: {
          select: {
            admissionNumber: true,
            firstName:       true,
            lastName:        true,
            grade:           true,
            stream:          true,
            enrollments: {
              where:   { active: true, archived: false },
              orderBy: { enrolledAt: 'desc' },
              take:    1,
              select: {
                class: {
                  select: { name: true, grade: true },
                },
              },
            },
          },
        },
        // Left-join active, non-archived classes taught by this user (max 3).
        classesAsTeacher: {
          where:  { active: true, archived: false },
          take:   3,
          select: { name: true, grade: true },
        },
      },
    });

    // Map to UserSearchResult shape.
    return users.map((u) => ({
      id:             u.id,
      firstName:      u.firstName,
      lastName:       u.lastName,
      email:          u.email,
      phone:          u.phone,
      role:           u.role as string,
      staffId:        u.staffId,
      profilePicture: u.profilePicture,
      status:         u.status as string,
      linkedLearners: u.learners.map((l) => ({
        admissionNumber: l.admissionNumber,
        firstName:       l.firstName,
        lastName:        l.lastName,
        grade:           l.grade,
        stream:          l.stream,
        className:       l.enrollments[0]?.class?.name ?? null,
      })),
      classesAsTeacher: u.classesAsTeacher.map((c) => ({
        name:  c.name,
        grade: c.grade,
      })),
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2.5  startImpersonation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Validate the impersonation request and issue a short-lived token.
   *
   * Validation order (matches Req 3.2–3.6):
   *   1. Target user must exist and not be archived  → 404
   *   2. Target user must be ACTIVE                  → 400
   *   3. Target role must not be SUPER_ADMIN         → 403 SCOPE_FORBIDDEN
   *   4. Self-impersonation is prohibited            → 403 SCOPE_FORBIDDEN
   *   5. canManageRole check                         → 403 SCOPE_FORBIDDEN
   *   6. Required DB fields must be present          → 422
   *
   * Token (Req 8.1–8.5):
   *   - TTL is hard-coded to 30 min; ignores JWT_EXPIRES_IN
   *   - isImpersonation: true
   *   - originalAdminId: requestingUser.userId
   *   - No refresh token issued
   *
   * AuditLog (Req 9.1, 9.3):
   *   - Non-blocking: failures are caught and logged but never surfaced
   *
   * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 8.1–8.6, 9.1, 9.3, 9.6
   */
  async startImpersonation(
    targetUserId: string,
    requestingUser: RequestingUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ImpersonationStartResult> {
    // ── 1. Fetch target user (Req 3.2) ────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id:             true,
        email:          true,
        firstName:      true,
        lastName:       true,
        role:           true,
        roles:          true,
        institutionType: true,
        status:         true,
        archived:       true,
        profilePicture: true,
      },
    }) as TargetUserRecord | null;

    if (!targetUser || targetUser.archived) {
      throw new ApiError(404, 'User not found');
    }

    // ── 2. Must be ACTIVE (Req 3.2) ───────────────────────────────────────
    if (targetUser.status !== 'ACTIVE') {
      throw new ApiError(400, 'Cannot impersonate inactive user');
    }

    // ── 3. Cannot impersonate SUPER_ADMIN (Req 3.3) ───────────────────────
    if ((targetUser.role as string) === 'SUPER_ADMIN') {
      throw new ApiError(403, 'Cannot impersonate SUPER_ADMIN accounts')
        .withCode('SCOPE_FORBIDDEN');
    }

    // ── 4. Cannot impersonate self (Req 3.5) ─────────────────────────────
    if (targetUserId === requestingUser.userId) {
      throw new ApiError(403, 'Cannot impersonate yourself')
        .withCode('SCOPE_FORBIDDEN');
    }

    // ── 5. Scope check via canManageRole (Req 3.4) ────────────────────────
    if (!canManageRole(requestingUser.role, targetUser.role)) {
      throw new ApiError(403, 'Insufficient scope to impersonate this user')
        .withCode('SCOPE_FORBIDDEN');
    }

    // ── 6. Required token fields must all be present on DB record (Req 8.5, 422) ──
    const missingFields: string[] = [];
    if (!targetUser.role)            missingFields.push('role');
    if (!targetUser.roles)           missingFields.push('roles');
    if (!targetUser.email)           missingFields.push('email');
    if (!targetUser.institutionType) missingFields.push('institutionType');

    if (missingFields.length > 0) {
      throw new ApiError(
        422,
        `Target user record is missing required fields: ${missingFields.join(', ')}`,
      );
    }

    // ── 7. Issue impersonation JWT (Req 8.1–8.5) ─────────────────────────
    //   TTL is hard-coded to 30 min — intentionally ignores JWT_EXPIRES_IN.
    const impersonationRoles = Array.from(new Set([
      targetUser.role,
      ...(targetUser.roles.length > 0 ? targetUser.roles : []),
    ])) as Role[];

    const impersonationPayload: Omit<ImpersonationJWTPayload, 'iat' | 'exp'> = {
      userId:          targetUser.id,
      email:           targetUser.email!,
      role:            targetUser.role,
      roles:           impersonationRoles,
      institutionType: targetUser.institutionType as ImpersonationJWTPayload['institutionType'],
      isImpersonation: true,
      originalAdminId: requestingUser.userId,
    };

    const accessToken = jwt.sign(
      impersonationPayload,
      process.env.JWT_SECRET as string,
      { expiresIn: '30m' },
    );

    // Decode to get the exact iat/exp so we can return an accurate expiresAt.
    const decoded = jwt.decode(accessToken) as ImpersonationJWTPayload;
    const expiresAt = new Date(decoded.exp * 1000);

    // ── 8. Write IMPERSONATION_START audit log (Req 9.1, 9.3) ────────────
    //   Non-blocking: failure is caught and logged; never surfaces to caller.
    const auditPayload: ImpersonationAuditPayload = {
      targetUserId:       targetUser.id,
      targetUserEmail:    targetUser.email!,
      targetUserRole:     targetUser.role as string,
      originalAdminId:    requestingUser.userId,
      originalAdminEmail: requestingUser.email,
      ipAddress:          ipAddress ?? null,
      userAgent:          userAgent ?? null,
      timestamp:          new Date().toISOString(),
    };

    prisma.auditLog
      .create({
        data: {
          action:    'IMPERSONATION_START',
          userId:    requestingUser.userId,
          userEmail: requestingUser.email,
          userRole:  requestingUser.role as string,
          ipAddress: ipAddress ?? null,
          method:    'POST',
          path:      '/api/admin/impersonate/start',
          params:    JSON.stringify(auditPayload),
        },
      })
      .catch((err) => {
        console.error('[ImpersonationService] Failed to write IMPERSONATION_START audit log:', err);
      });

    // ── 9. Return result (no refresh token — Req 8.2) ─────────────────────
    return {
      accessToken,
      impersonatedUser: {
        id:    targetUser.id,
        name:  `${targetUser.firstName} ${targetUser.lastName}`,
        email: targetUser.email!,
        role:  targetUser.role as string,
      },
      originalAdminId: requestingUser.userId,
      expiresAt,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2.11  stopImpersonation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * End an active impersonation session.
   *
   * 1. Revoke the impersonation access token in Redis with the token's
   *    remaining validity as TTL (minimum 1 second) (Req 5.2).
   * 2. Write IMPERSONATION_STOP AuditLog record non-blocking, including
   *    durationSeconds derived from iat vs current time (Req 9.2, 9.4, 9.5).
   * 3. Clear accessToken and refreshToken cookies (Req 5.3, 5.4).
   *
   * Requirements: 5.2, 5.3, 5.4, 9.2, 9.4, 9.5
   */
  async stopImpersonation(
    currentToken: string,
    requestingUser: ImpersonationJWTPayload,
    res: Response,
  ): Promise<void> {
    // ── 1. Revoke the impersonation access token in Redis ────────────────
    //   TTL = remaining token validity (exp - now), minimum 1 second.
    const nowSeconds  = Math.floor(Date.now() / 1000);
    const remaining   = Math.max(requestingUser.exp - nowSeconds, 1);

    await redisCacheService.set(
      revokedImpersonationKey(currentToken),
      '1',
      remaining,
    );

    // ── 2. Write IMPERSONATION_STOP audit log (non-blocking) ─────────────
    //   durationSeconds = now - iat (how long the session lasted).
    const durationSeconds = nowSeconds - requestingUser.iat;

    const auditPayload: ImpersonationAuditPayload = {
      targetUserId:    requestingUser.userId,
      targetUserEmail: requestingUser.email,
      targetUserRole:  requestingUser.role as string,
      originalAdminId: requestingUser.originalAdminId,
      durationSeconds,
      timestamp:       new Date().toISOString(),
    };

    prisma.auditLog
      .create({
        data: {
          action:    'IMPERSONATION_STOP',
          userId:    requestingUser.originalAdminId,
          userEmail: null,
          userRole:  null,
          ipAddress: null,
          method:    'POST',
          path:      '/api/admin/impersonate/stop',
          params:    JSON.stringify(auditPayload),
        },
      })
      .catch((err) => {
        console.error('[ImpersonationService] Failed to write IMPERSONATION_STOP audit log:', err);
      });

    // ── 3. Clear cookies ──────────────────────────────────────────────────
    authTokenService.clearTokenCookies(res);
  }
}

export const impersonationService = new ImpersonationService();
