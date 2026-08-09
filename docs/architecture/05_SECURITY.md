# TrendSCORE 2.0 — Security Specification

**Document ID:** SEC-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Parent Document:** `00_MASTER_ARCHITECTURE_SPECIFICATION.md §10`

---

## 1. Threat Model Summary

TrendSCORE handles sensitive data for schools: student personal records, biometric templates, parent contact details, financial data, and staff HR information. The primary threats are:

| Threat | Vector | Impact |
|---|---|---|
| Biometric data theft | Database breach | CRITICAL — legal liability, irreversible harm |
| Cross-school data leak | Missing schoolId scoping | HIGH — privacy violation, legal liability |
| Parent account takeover | OTP interception, weak passwords | HIGH — child safety risk |
| Unauthorised grade/attendance modification | Privilege escalation | MEDIUM — academic integrity |
| SMS spoofing / reply injection | Inbound SMS callback manipulation | MEDIUM — false acknowledgements |
| Biometric device token theft | Token in transit, stolen device | MEDIUM — false attendance logs |
| Cron job failure | Silent failure, no alerting | MEDIUM — parents not notified of absences |
| Injection attacks | Input validation bypass | LOW (Prisma parameterises all queries) |

---

## 2. Authentication Architecture

### JWT Token Flow

```
Client → POST /api/auth/login
           ↓
       Verify credentials
           ↓
       Generate access token (15 min expiry)
       Generate refresh token (7 days expiry, stored in HttpOnly cookie)
           ↓
Client stores access token in memory (not localStorage)
Client uses access token on all API calls
           ↓
Access token expires → Client calls POST /api/auth/refresh
           ↓
       Verify refresh token (HttpOnly cookie)
           ↓
       Issue new access token
```

**Access token payload:**
```json
{
  "userId": "uuid",
  "role": "TEACHER",
  "roles": ["TEACHER"],
  "schoolId": "uuid",
  "sessionId": "uuid",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Security properties:**
- Access tokens are short-lived (15 min) — limits window of token theft
- Refresh tokens are HttpOnly cookies — not accessible to JavaScript
- `sessionId` in JWT allows targeted session invalidation (blacklist in Redis)
- On password change: all existing sessions are invalidated via blacklist

### OTP Flow (Parent / Student Login)

```
POST /api/auth/otp/request  { phone }
   ↓
Generate 6-digit OTP
Store OTP hash (not plaintext) in authOtpChallenges with 10-min expiry
Send OTP via SMS
   ↓
POST /api/auth/otp/verify  { phone, otp }
   ↓
Verify OTP hash
Mark OTP as used (single-use)
Issue JWT tokens
```

**OTP security properties:**
- OTP stored as bcrypt hash — cannot be extracted from database
- Single-use: OTP is invalidated immediately after first successful use
- Rate limited: 3 OTP requests per phone number per 15 minutes
- 10-minute expiry
- Failed attempts counted: 5 failures locks OTP requests for 30 minutes

### Login Attempt Protection

```
POST /api/auth/login
   ↓
Check user.loginAttempts >= 5 AND user.lockedUntil > now()
   → 423 Locked: "Account locked. Try again after {time}"
   ↓
Verify password
   ↓
On failure: increment loginAttempts; if >= 5, set lockedUntil = now() + 30 min
On success: reset loginAttempts to 0
```

---

## 3. Authorisation Architecture

### Permission Middleware

Every route declares its required permission:
```typescript
router.post('/bulk', authenticate, requirePermission('MARK_ATTENDANCE'), ...)
router.get('/timeline', authenticate, requirePermission('VIEW_PRESENCE_TIMELINE'), ...)
```

`requirePermission(permission)` checks:
1. `req.user.role` has this permission in the role-permission map
2. OR `req.user.roles` array contains a role that has this permission

### Scope Enforcement (Data-Level)

Permission middleware only gates the route. Scope enforcement happens in the service:

**Teacher scope (attendance):**
```typescript
if (role === 'TEACHER') {
  const assignedClassIds = await getTeacherAssignedClassIds(userId);
  if (!assignedClassIds.includes(requestedClassId)) throw new ApiError(403, ...);
}
```

**Parent scope (any child data):**
```typescript
const canAccess = await parentAccessService.canAccessLearner(parentUserId, learnerId);
if (!canAccess) throw new ApiError(403, ...);
```

**House master scope (boarding):**
```typescript
const dorm = await getDormitory(dormitoryId);
if (!isAssignedHouseMaster(userId, dormitoryId)) throw new ApiError(403, ...);
```

**Rule:** Scope checks must be in the service layer, not only the controller. If the service is called from multiple places (cron job, API, webhook), the scope check travels with it.

### Role-Permission Map Ownership

The role-permission map is maintained in `server/src/config/permissions.ts`. When a new module adds permissions, they are added to this file with explicit role assignments. This file is the single source of truth for what each role can do.

---

## 4. Biometric Template Security

This is the highest-risk data in the system. The current state (plaintext string storage) is a P0 fix.

### Encryption Specification

**Algorithm:** AES-256-GCM  
**Key source:** `process.env.BIOMETRIC_ENCRYPTION_KEY` (32-byte hex string)  
**IV:** Random 16 bytes generated per encryption operation  
**Storage format:** `{iv_hex}:{ciphertext_hex}:{auth_tag_hex}`

```typescript
// server/src/domains/biometrics/biometric.encryption.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.BIOMETRIC_ENCRYPTION_KEY!, 'hex');
const KEY_VERSION = parseInt(process.env.BIOMETRIC_KEY_VERSION || '1');

export function encryptTemplate(plaintext: Buffer): {
  encrypted: string;
  keyVersion: number;
} {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: `${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`,
    keyVersion: KEY_VERSION
  };
}

export function decryptTemplate(encrypted: string, keyVersion: number): Buffer {
  const key = getKeyForVersion(keyVersion);  // Supports key rotation
  const [ivHex, ciphertextHex, authTagHex] = encrypted.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final()
  ]);
}
```

### Key Rotation Process

1. Generate new key: `BIOMETRIC_ENCRYPTION_KEY_V2`
2. Add to environment with new `BIOMETRIC_KEY_VERSION=2`
3. Run rotation migration script:
   - For each credential: decrypt with old key → re-encrypt with new key → update record
   - Process in batches of 100 — never all at once
   - Idempotent: check `key_version` before processing
4. Remove old key from environment after rotation confirmed
5. Old `key_version` values remain in DB to identify which key was used

### Template API Rules

- Templates are **never** returned in API responses
- Enrollment response returns: `{ id, type, enrolledAt, quality, status }` — no template
- Template comparison happens inside the server only
- No client-side biometric processing

---

## 5. Device Authentication

Biometric devices authenticate via a bearer token on the webhook endpoint.

### Token Lifecycle

```
Admin registers device → POST /api/biometric/devices
   ↓
Server generates 32-byte random token: crypto.randomBytes(32).toString('hex')
Stores token hash (bcrypt) in biometric_devices.token_hash
Returns plaintext token ONCE to admin (shown once, store it)
   ↓
Device is configured with: POST /api/webhooks/biometric/log
   Authorization: Bearer <plaintext_token>
   ↓
Server verifies: bcrypt.compare(requestToken, device.token_hash)
```

**Token properties:**
- 64-character hex string (256 bits entropy)
- Stored as bcrypt hash in database — cannot be extracted
- Shown to admin only once at registration
- Rotatable via `POST /api/biometric/devices/:id/rotate-token`
- Failed device auth attempts are rate-limited: 10 failures in 5 minutes blocks the device IP

### Device Identity Verification

On each webhook call:
1. Token verified against hash
2. `lastSeen` updated
3. Device `status` set to `ONLINE`
4. Request IP logged in `biometric_logs.rawPayload`

---

## 6. SMS Inbound Security (Phase 3)

The inbound SMS callback from Africa's Talking or MobileSasa must be authenticated to prevent spoofed absence acknowledgements.

### Africa's Talking Callback Verification

Africa's Talking does not sign callbacks. Security is enforced by:
1. IP whitelist — only AT's published IP ranges accepted
2. Callback URL obscured (non-guessable path with secret suffix)

### MobileSasa Callback Verification

MobileSasa supports HMAC-SHA256 signing. The callback handler verifies:
```typescript
const signature = req.headers['x-sms-signature'];
const expectedSig = createHmac('sha256', process.env.SMS_CALLBACK_SECRET!)
  .update(rawBody)
  .digest('hex');
if (signature !== expectedSig) throw new ApiError(401, 'Invalid signature');
```

### Reply Injection Prevention

The inbound reply handler must:
1. Verify the from_phone exists in `learners.primaryContactPhone` or parent user's phone
2. Only process replies that match an outbound SMS sent within the last 24 hours (linked by phone + time window)
3. Mark all processed replies — duplicate replies are ignored

---

## 7. Data Protection

### Personal Data Classification

| Data | Classification | Storage | Access |
|---|---|---|---|
| Student name, DOB, grade | STANDARD | Plaintext | School staff |
| Parent phone, email | SENSITIVE | Plaintext | School staff + parent |
| Student photo | SENSITIVE | Cloudinary CDN | School staff + parent |
| Biometric templates | CRITICAL | AES-256-GCM encrypted | System only |
| Staff salary, KRA PIN, NHIF | SENSITIVE | Plaintext | HR/admin only |
| NEMIS UPI number | SENSITIVE | Plaintext | Admin only |
| Medical conditions, allergies | SENSITIVE | Plaintext | Admin + medical staff |

### Response Data Masking

Staff with `VIEW_LEARNER_BASIC` permission receive:
```json
{ "id": "uuid", "firstName": "John", "lastName": "Doe", "admissionNumber": "ADM-2024-001", "grade": "5" }
```

Parent users receive their child's data only. Phone number of other parents is never included.

Biometric credentials in any API response: `{ "id": "uuid", "type": "FINGERPRINT", "enrolledAt": "...", "quality": 95 }` — never `template`.

### Logging Data Rules

- Phone numbers in logs: `+2547****890` (mask middle 4 digits)
- Names in logs: first name only, or initials if full name unnecessary
- No biometric templates in any log output
- No passwords, tokens, or secrets in any log output
- Financial amounts in logs: OK to log totals, not individual account details

---

## 8. API Security Headers

All API responses include:

```
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cache-Control: no-store, no-cache, must-revalidate
```

CORS configuration (production):
```typescript
cors({
  origin: [
    'https://app.trendscore.school',
    'https://*.trendscore.school'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type']
})
```

---

## 9. Secrets Management Reference

| Secret | Environment Variable | Rotation Frequency | Notes |
|---|---|---|---|
| Database URL | `DATABASE_URL` | On compromise | Supabase connection string |
| Direct DB URL | `DIRECT_URL` | On compromise | For migrations only |
| JWT signing key | `JWT_SECRET` | Every 12 months | Rotation requires all sessions to re-login |
| General encryption | `ENCRYPTION_KEY` | Every 12 months | Used for SMS API key storage |
| Biometric encryption | `BIOMETRIC_ENCRYPTION_KEY` | Every 6 months | Requires template re-encryption on rotation |
| Biometric key version | `BIOMETRIC_KEY_VERSION` | On key rotation | Integer, increments on each rotation |
| VAPID keys | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | On compromise | Rotation requires all push subscriptions to re-subscribe |
| SMS callback secret | `SMS_CALLBACK_SECRET` | Every 6 months | Used for HMAC verification |
| Africa's Talking | `AT_API_KEY`, `AT_USERNAME` | Yearly | Provider credentials |
| MobileSasa | `MOBILESASA_API_KEY` | Yearly | Provider credentials |

**Rule:** No secret is ever committed to git. The `.env.example` file contains only placeholder values.

---

## 10. Audit Log Specification

Every sensitive write operation produces an audit record.

### Audit Events by Module

| Module | Event | Logged Fields |
|---|---|---|
| Auth | LOGIN_SUCCESS | userId, ipAddress, userAgent, timestamp |
| Auth | LOGIN_FAILURE | email/phone, ipAddress, attempt count, timestamp |
| Auth | PASSWORD_CHANGE | userId, ipAddress, timestamp |
| Attendance | MARK_ATTENDANCE | learnerId, classId, status, markedBy, date |
| Attendance | UPDATE_ATTENDANCE | learnerId, old status, new status, updatedBy |
| Biometric | DEVICE_REGISTERED | deviceId, adminId, deviceName |
| Biometric | CREDENTIAL_ENROLLED | credentialId, personId, type (no template) |
| Biometric | DEVICE_TOKEN_ROTATED | deviceId, adminId, timestamp |
| HR | ATTENDANCE_CORRECTED | userId, old values, new values, correctedBy, reason |
| HR | PAYROLL_CONFIRMED | payrollId, confirmedBy, month, year |
| Finance | PAYMENT_RECORDED | invoiceId, amount, paymentMethod, recordedBy |
| Finance | WAIVER_APPROVED | waiverId, amount, approvedBy |
| Boarding | EXEAT_APPROVED | exeatId, learnerId, approvedBy |
| Boarding | EXEAT_DENIED | exeatId, learnerId, deniedBy, reason |
| Admin | SCHOOL_CONFIG_CHANGED | field, oldValue, newValue, changedBy |

---

## 11. Security Checklist for New Modules

Before any new module ships to production, confirm:

- [ ] All routes have `authenticate` middleware
- [ ] All routes declare `requirePermission(...)` with appropriate permission string
- [ ] Service-level scope enforcement for teacher/parent/house-master roles
- [ ] All write endpoints validated with Zod schema
- [ ] `schoolId` scoping on all DB queries that return multi-school data
- [ ] No sensitive data in log output
- [ ] No secrets in response bodies
- [ ] Audit events defined and wired
- [ ] Rate limiting applied to write operations
- [ ] Feature flag check at controller entry point
- [ ] Public webhook endpoints use token or HMAC auth (not user JWT)
- [ ] Error messages do not reveal internal system details

---
