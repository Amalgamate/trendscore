/**
 * studentSessionToken.util.ts
 *
 * Issues and verifies short-lived HMAC-SHA256-signed session tokens used to
 * bind a phone-lookup result to a subsequent student-phone login request.
 *
 * Token format: {base64url(JSON payload)}.{HMAC-SHA256 hex signature}
 *
 * The payload contains:
 *   - phone_e164:    normalized E.164 phone string from the lookup step
 *   - candidate_ids: sorted array of studentUserIds resolved during lookup
 *   - expires_unix:  Unix timestamp (seconds) — token is valid for 300 s
 *
 * Secret resolution order (same as auth-phone-otp.service.ts):
 *   OTP_HASH_SECRET → JWT_SECRET → JWT_REFRESH_SECRET
 */

import crypto from 'crypto';
import { ApiError } from './error.util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentLookupTokenPayload {
  phone_e164: string;
  candidate_ids: string[];
  expires_unix: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 300; // 5 minutes

function getSecret(): string {
  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('Session token secret is not configured');
  }
  return secret;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  // Restore standard base64 padding
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = padded.length % 4;
  const padded2 = remainder ? padded + '='.repeat(4 - remainder) : padded;
  return Buffer.from(padded2, 'base64').toString('utf8');
}

function computeHmac(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Issue a short-lived session token binding a phone number to a resolved
 * set of student candidate IDs.
 *
 * @param phoneE164    E.164-normalized phone string
 * @param candidateIds Array of studentUserIds (will be sorted before encoding)
 * @returns Opaque token string: `{base64url(payload)}.{hexsig}`
 */
export function issueSessionToken(
  phoneE164: string,
  candidateIds: string[],
): string {
  const payload: StudentLookupTokenPayload = {
    phone_e164: phoneE164,
    candidate_ids: [...candidateIds].sort(),
    expires_unix: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = computeHmac(payloadB64);

  return `${payloadB64}.${sig}`;
}

/**
 * Verify a session token and assert that `studentUserId` is one of the
 * candidate IDs encoded in the token.
 *
 * Throws `ApiError(401, 'Invalid or expired session')` for any of:
 *   - malformed token (not exactly two dot-separated parts)
 *   - HMAC signature mismatch
 *   - token has expired
 *   - `studentUserId` is not in `payload.candidate_ids`
 *
 * @param token         Token string from the lookup response
 * @param studentUserId The student attempting to log in
 * @returns             The decoded payload on success
 */
export function verifySessionToken(
  token: string,
  studentUserId: string,
): StudentLookupTokenPayload {
  const INVALID = new ApiError(401, 'Invalid or expired session');

  // Step 1: structural split
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw INVALID;
  }

  const [payloadB64, providedSig] = parts;

  // Step 2: HMAC verification using timing-safe comparison
  const expectedSig = computeHmac(payloadB64);

  // Hex strings are same length by construction, but guard anyway
  if (expectedSig.length !== providedSig.length) {
    throw INVALID;
  }

  const sigMatches = crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'hex'),
    Buffer.from(providedSig, 'hex'),
  );

  if (!sigMatches) {
    throw INVALID;
  }

  // Step 3: decode and parse payload
  let payload: StudentLookupTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64)) as StudentLookupTokenPayload;
  } catch {
    throw INVALID;
  }

  // Step 4: expiry check
  if (Math.floor(Date.now() / 1000) >= payload.expires_unix) {
    throw INVALID;
  }

  // Step 5: candidate membership check
  if (!Array.isArray(payload.candidate_ids) || !payload.candidate_ids.includes(studentUserId)) {
    throw INVALID;
  }

  return payload;
}
