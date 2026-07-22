import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { validatePassword, PARENT_PASSWORD_POLICY } from '../utils/password.util';
import { verifySessionToken } from '../utils/studentSessionToken.util';
import { authLoginService, AuthLoginResult } from './auth-login.service';
import { redisCacheService } from './redis-cache.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_TOKEN_REDIS_TTL = 300; // seconds — matches token expiry

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentPhoneLoginParams {
  sessionToken: string;
  studentUserId: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  rememberMe?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StudentPhoneLoginService {
  /**
   * Authenticate a student using the session token issued by the lookup step
   * and the student's own password.
   *
   * Steps (mirrors auth-phone-otp.service.ts pattern):
   *  1. Validate & verify the HMAC session token (throws 401 on failure)
   *  2. Enforce one-time-use via Redis key on the token signature
   *  3. Guard against missing studentUserId (400)
   *  4. Validate password format via PARENT_PASSWORD_POLICY (400)
   *  5. Load student User record from DB
   *  6. Role guard — must be STUDENT (403)
   *  7. Status / archived guard (403)
   *  8. Lock check — lockedUntil in the future (403)
   *  9. Clear expired lock if present
   * 10. bcrypt compare — on failure increment attempts, maybe lock, audit FAILURE, throw 401
   * 11. On success — createAuthenticatedSession, audit SUCCESS, return result
   */
  async login(params: StudentPhoneLoginParams): Promise<AuthLoginResult> {
    // ------------------------------------------------------------------
    // Step 3: studentUserId guard (checked before token work per spec §4.4)
    // ------------------------------------------------------------------
    if (!params.studentUserId || params.studentUserId.trim() === '') {
      throw new ApiError(400, 'Please select which student is logging in');
    }

    // ------------------------------------------------------------------
    // Step 1: Token validation — verifySessionToken throws ApiError(401)
    //         automatically on any invalid/expired/mismatched token.
    // ------------------------------------------------------------------
    const payload = verifySessionToken(params.sessionToken, params.studentUserId);

    // ------------------------------------------------------------------
    // Step 2: One-time-use enforcement via Redis
    //         Key is scoped to the token signature (second dot-part).
    // ------------------------------------------------------------------
    const tokenSig = params.sessionToken.split('.')[1];
    const redisKey = `student-session-token:${tokenSig}`;

    const alreadyUsed = await redisCacheService.get<string>(redisKey);
    if (alreadyUsed) {
      throw new ApiError(401, 'Invalid or expired session');
    }

    // Mark the token as used *before* doing any further processing so that
    // concurrent requests with the same token are rejected.
    await redisCacheService.set(redisKey, '1', SESSION_TOKEN_REDIS_TTL);

    // ------------------------------------------------------------------
    // Step 4: Password input validation
    // ------------------------------------------------------------------
    const passwordValidation = validatePassword(params.password, PARENT_PASSWORD_POLICY);
    if (!passwordValidation.valid) {
      throw new ApiError(400, passwordValidation.errors.join(', '));
    }

    // ------------------------------------------------------------------
    // Step 5: Load student User record
    // ------------------------------------------------------------------
    const user = await prisma.user.findUnique({
      where: { id: params.studentUserId },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        status: true,
        archived: true,
        loginAttempts: true,
        lockedUntil: true,
        role: true,
        roles: true,
        firstName: true,
        lastName: true,
        phone: true,
        lastLogin: true,
        institutionType: true,
        emailVerified: true,
        verificationRequired: true,
        passwordResetToken: true,
      },
    });

    if (!user) {
      // Write FAILURE audit log — user not found (treat same as bad credentials)
      await this.writeAuditLog({
        userId: params.studentUserId,
        email: null,
        role: null,
        result: 'FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new ApiError(401, 'Invalid credentials');
    }

    // ------------------------------------------------------------------
    // Step 6: Role guard
    // ------------------------------------------------------------------
    if (user.role !== 'STUDENT') {
      await this.writeAuditLog({
        userId: user.id,
        email: user.email,
        role: user.role,
        result: 'FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new ApiError(403, 'Account is not eligible for student login');
    }

    // ------------------------------------------------------------------
    // Step 7: Status / archived guard
    // ------------------------------------------------------------------
    if (user.status !== 'ACTIVE' || user.archived) {
      await this.writeAuditLog({
        userId: user.id,
        email: user.email,
        role: user.role,
        result: 'FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new ApiError(403, 'Account is not active');
    }

    const now = new Date();

    // ------------------------------------------------------------------
    // Step 8: Lock check
    // ------------------------------------------------------------------
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.writeAuditLog({
        userId: user.id,
        email: user.email,
        role: user.role,
        result: 'FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new ApiError(403, 'Account is locked');
    }

    // ------------------------------------------------------------------
    // Step 9: Clear expired lock
    // ------------------------------------------------------------------
    if (user.lockedUntil && user.lockedUntil <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
      user.loginAttempts = 0;
      user.lockedUntil = null;
    }

    // ------------------------------------------------------------------
    // Step 10: bcrypt compare
    // ------------------------------------------------------------------
    const passwordMatches = await bcrypt.compare(params.password, user.password);

    if (!passwordMatches) {
      const nextAttempts = (user.loginAttempts || 0) + 1;
      const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: nextAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      await this.writeAuditLog({
        userId: user.id,
        email: user.email,
        role: user.role,
        result: 'FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      throw new ApiError(401, 'Invalid credentials');
    }

    // ------------------------------------------------------------------
    // Step 11: Success — create authenticated session
    // ------------------------------------------------------------------
    const session = await authLoginService.createAuthenticatedSession({
      user,
      loginMethod: 'STUDENT_PHONE_PASSWORD',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      rememberMe: params.rememberMe === true,
    });

    await this.writeAuditLog({
      userId: user.id,
      email: user.email,
      role: user.role,
      result: 'SUCCESS',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return session;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async writeAuditLog(params: {
    userId: string;
    email: string | null;
    role: string | null;
    result: 'SUCCESS' | 'FAILURE';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'STUDENT_LOGIN_VIA_PARENT_PHONE',
          userId: params.userId,
          userEmail: params.email || null,
          userRole: params.role || null,
          ipAddress: params.ipAddress || null,
          method: 'STUDENT_PHONE_PASSWORD',
          path: '/api/auth/student-phone/login',
          params: JSON.stringify({
            result: params.result,
            device: params.userAgent || null,
            loginMethod: 'STUDENT_PHONE_PASSWORD',
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (err) {
      // Audit log failures must never block the auth response
      console.warn('[StudentPhoneLoginService] Audit log write failed:', err);
    }
  }
}

export const studentPhoneLoginService = new StudentPhoneLoginService();
