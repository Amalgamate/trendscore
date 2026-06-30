/**
 * Shared TypeScript interfaces for the Admin User Impersonation feature.
 *
 * Requirements: 3.7, 6.1, 8.3, 8.4
 */

import { Role } from '../config/permissions';

type InstitutionType = 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

// ─────────────────────────────────────────────────────────────────────────────
// JWT Payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The decoded payload of an impersonation JWT.
 *
 * Discriminated from a normal JWTPayload by `isImpersonation: true`.
 * All claims are sourced from the target user's current database record —
 * never from the request body (Requirement 8.5).
 */
export interface ImpersonationJWTPayload {
  /** Target (impersonated) user's ID */
  userId: string;
  /** Target user's email — copied from DB record */
  email: string;
  /** Target user's canonical role — copied from DB record */
  role: Role;
  /** Target user's full roles array — copied from DB record */
  roles: Role[];
  /** Target user's institution type — copied from DB record */
  institutionType: InstitutionType;
  /** Discriminator flag — always `true` for impersonation tokens (Req 8.3) */
  isImpersonation: true;
  /** The real admin's user ID — used for audit trail and stop flow (Req 8.4) */
  originalAdminId: string;
  /** Issued-at timestamp (seconds since epoch) */
  iat: number;
  /** Expiry: always `iat + 1800` seconds (30 min, non-renewable) (Req 8.1) */
  exp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single user record returned by `GET /api/admin/impersonate/search`.
 */
export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  /** e.g. "TEACHER", "PARENT" */
  role: string;
  staffId: string | null;
  profilePicture: string | null;
  /** "ACTIVE" | "INACTIVE" */
  status: string;
  /**
   * Learner-linked data. Populated when:
   * - the user IS a learner account, or
   * - the user's role is PARENT (linked via parentId).
   */
  linkedLearners: Array<{
    admissionNumber: string;
    firstName: string;
    lastName: string;
    grade: string;
    stream: string | null;
    /** Derived from the latest active ClassEnrollment */
    className: string | null;
  }>;
  /** Classes the user teaches (active, non-archived; max 3 returned). */
  classesAsTeacher: Array<{
    name: string;
    grade: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Impersonation Start / Stop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The response shape returned by `ImpersonationService.startImpersonation`.
 * No refresh token is included by design (Req 8.2).
 */
export interface ImpersonationStartResult {
  /** Short-lived impersonation JWT (30 min, non-renewable) */
  accessToken: string;
  /** Public profile of the impersonated user */
  impersonatedUser: ImpersonatedUserInfo;
  /** The requesting admin's user ID — echoed back for the frontend */
  originalAdminId: string;
  /** Absolute expiry date of the impersonation token */
  expiresAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The structured payload stored in `AuditLog.params` for both
 * `IMPERSONATION_START` and `IMPERSONATION_STOP` events.
 *
 * `durationSeconds` is only present on `IMPERSONATION_STOP` records.
 */
export interface ImpersonationAuditPayload {
  targetUserId: string;
  targetUserEmail: string;
  targetUserRole: string;
  originalAdminId: string;
  /** Present on IMPERSONATION_START records */
  originalAdminEmail?: string;
  /** Present on IMPERSONATION_START records */
  ipAddress?: string | null;
  /** Present on IMPERSONATION_START records */
  userAgent?: string | null;
  /** Present on IMPERSONATION_STOP records — seconds from start to stop */
  durationSeconds?: number;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend / Context shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal user info carried by `ImpersonationContext` while a session is active.
 * Also used as the `ImpersonationBannerProps.impersonatedUser` prop.
 */
export interface ImpersonatedUserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * The admin's original session data persisted to `localStorage` under
 * `trendscore_impersonation_original_token` and
 * `trendscore_impersonation_original_user` before impersonation starts.
 * Restored verbatim on `stopImpersonation`.
 */
export interface StoredAdminSession {
  user: Record<string, any>;
  token: string;
}
