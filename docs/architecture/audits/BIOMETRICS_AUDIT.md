# Biometrics Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Executive Summary

The biometric attendance system is **architecturally scaffolded but functionally incomplete**. The foundation — device registry, credential store, attendance log table, and a webhook listener — exists and is wired. However, no real hardware SDK has been integrated. The system is designed as a **generic bridge**: any device that can POST an HTTP webhook can be supported. No fingerprint SDK, facial recognition library, ZKTeco SDK, or similar vendor dependency is present anywhere in the codebase.

**Verdict:** The biometric foundation is salvageable. It does not need a rewrite. It needs:
1. A real device SDK adapter (ZKTeco is the most likely target for Kenya market)
2. An enrollment UI
3. A sync/polling mechanism for offline devices
4. An admin device management UI

---

## 2. Files Involved

| File | Purpose | Status |
|---|---|---|
| `server/src/controllers/biometric.controller.ts` | API controller — device CRUD, enrollment, webhook handler, log viewer | ✅ Present |
| `server/src/services/biometric.service.ts` | Core logic — device validation, log creation, learner/staff attendance dispatch | ✅ Present |
| `server/src/routes/biometric.routes.ts` | Route definitions with permission gates | ✅ Present |

No frontend biometric pages were found in `src/pages/` or `src/components/`.

---

## 3. Database Models

### `biometric_devices`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Internal |
| deviceId | String unique | External hardware ID |
| name | String | Human-readable label |
| type | String | e.g. TERMINAL, FINGERPRINT, FACE |
| location | String? | Deployment location description |
| ipAddress | String? | For network-reachable devices |
| token | String? | Shared secret for webhook auth |
| status | String | ONLINE / OFFLINE |
| lastSeen | DateTime | Updated on every successful log |

**Missing fields:**
- `schoolId` — no multi-tenancy scoping on device
- `serialNumber` — no hardware serial tracking
- `firmwareVersion` — no version tracking for SDK compatibility
- `syncMode` — no indication of whether device pushes or is polled

### `biometric_credentials`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Internal |
| userId | String? | Links to User (staff) |
| learnerId | String? | Links to Learner (student) |
| type | String | e.g. FINGERPRINT, FACE, CARD |
| template | String | Raw biometric template (blob/string) |
| fingerIndex | Int? | Finger number (1–10) |
| quality | Int? | Capture quality score |

**Problems:**
- `template` is stored as a plain `String` — biometric templates are binary blobs, not strings. This would cause data corruption for any real SDK template.
- No encryption at rest. Biometric templates must be encrypted — this is a **critical security gap**.
- No `deviceId` reference — cannot know which device a credential was enrolled on.
- No `enrolledAt` timestamp.
- No `status` field (e.g. ACTIVE / REVOKED).

### `biometric_logs`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Internal |
| deviceId | String | FK to biometric_devices |
| personId | String | admissionNumber or staffId (external identifier) |
| personType | String | LEARNER or STAFF |
| timestamp | DateTime | When the scan occurred |
| direction | String | IN or OUT |
| status | String | PENDING / PROCESSED / FAILED |
| errorMessage | String? | Failure reason |

**Indexed on:** deviceId, status, timestamp

**Problems:**
- `personId` stores a human-readable ID (admissionNumber / staffId) not the internal UUID. Lookups require a secondary query.
- No `rawPayload` field — original device data is discarded after parsing.
- No retry mechanism for FAILED records.
- No `schoolId` — same as devices, no multi-tenancy.

---

## 4. API Endpoints

| Route | Method | Auth | Description |
|---|---|---|---|
| `POST /api/biometric/devices` | POST | MANAGE_BIOMETRIC_DEVICES | Register or upsert a device |
| `GET /api/biometric/devices` | GET | MANAGE_BIOMETRIC_DEVICES | List all devices |
| `POST /api/biometric/enroll` | POST | ENROLL_FINGERPRINTS | Store a biometric credential |
| `POST /api/biometric/log` | POST | **Public** (deviceToken in body) | Webhook for device attendance events |
| `GET /api/biometric/logs` | GET | VIEW_BIOMETRIC_LOGS | Query recent logs (max 100) |

**Security concern:** The `/log` endpoint is public. It is protected only by a `deviceToken` field in the request body. This is acceptable for device webhooks but the token should be in the `Authorization` header for better security and compatibility with hardware configuration UIs.

---

## 5. Business Logic (biometric.service.ts)

### processAttendanceLog() — Main webhook handler

1. Validates device by `deviceId + token`
2. Updates device `lastSeen` + `status = ONLINE`
3. Creates a raw `BiometricLog` with status `PENDING`
4. Dispatches to either `handleLearnerAttendance()` or `handleStaffAttendance()`
5. Updates log to `PROCESSED` or `FAILED`

### handleLearnerAttendance()

- Looks up learner by `admissionNumber`
- If attendance for today already exists → returns existing record (no update, no OUT tracking)
- Creates new attendance record with `status = PRESENT` and a remarks string
- Falls back to `SUPER_ADMIN` user as `markedBy` — this is a code smell

**Problems:**
- OUT direction is not handled for learners — only creates a record on first scan of the day
- No early departure detection
- No late arrival status (e.g. scan at 09:30 = LATE, not PRESENT)
- No threshold-based status — no integration with school's `attendanceLockTime`

### handleStaffAttendance()

- Looks up staff by `staffId`
- IN direction: creates new `StaffAttendanceLog` with `clockInAt` and `source = BIOMETRIC`
- OUT direction: updates existing record's `clockOutAt`
- Correctly handles the IN/OUT bidirectional clock model

**Better implementation** than learner side — the staff attendance properly handles both directions.

---

## 6. What Devices Were Intended?

No device SDK dependency was found in:
- `package.json`
- `server/package.json`
- Any source file

No ZKTeco SDK, Suprema SDK, Hikvision SDK, Digital Persona SDK, or similar library is referenced. The system was designed as a **brand-agnostic webhook bridge** — devices push events via HTTP POST.

**Intended device types** inferred from schema `type` field and code comments:
- TERMINAL (generic access terminal)
- FINGERPRINT (explicitly referenced)
- FACE (implied by credential `type` field)
- CARD (implied — RFID/NFC card scanning)

---

## 7. Enrollment Assessment

The enrollment API (`POST /api/biometric/enroll`) simply writes a credential record to the database. There is:
- No device communication during enrollment
- No template extraction from a real scanner
- No quality threshold enforcement
- No duplicate check (same finger enrolled twice)
- No enrollment UI
- No admin workflow (who enrolls students? which device?)

**Enrollment is essentially a mock stub.** A real implementation would require:
1. A device-side enrollment mode
2. SDK call to capture and extract template
3. Template upload to server with encryption
4. Device-to-server sync of enrolled templates

---

## 8. Synchronization Assessment

No synchronization exists. The system assumes a **push-only model** (device calls TrendScore). Many real biometric terminals (ZKTeco, etc.) operate in **pull mode** — the server must periodically pull attendance records from the device. A sync service for this does not exist.

---

## 9. What Works vs What Doesn't

| Capability | Status | Notes |
|---|---|---|
| Device registration via API | ✅ Works | Manual, no UI |
| Webhook receive + raw log | ✅ Works | HTTP POST from any device |
| Device token authentication | ✅ Works | Basic but functional |
| Staff clock-in via biometric | ✅ Works | IN/OUT both handled |
| Learner attendance via biometric | ⚠️ Partial | IN only; no OUT, no late detection |
| Credential enrollment | ❌ Stub only | No real SDK, no device communication |
| Admin device management UI | ❌ Missing | No frontend at all |
| Template encryption at rest | ❌ Missing | CRITICAL security gap |
| Device polling/sync | ❌ Missing | Push-only assumed |
| Failed log retry | ❌ Missing | FAILED logs sit forever |
| Multi-tenancy (schoolId) | ❌ Missing | All devices global |
| Late arrival detection via time | ❌ Missing | Always marks PRESENT |

---

## 10. Can the Biometric Implementation Be Salvaged?

**Yes.** The following work is reusable:
- All three database models (with schema enhancements)
- The webhook endpoint and device authentication pattern
- The service dispatch logic (learner vs staff routing)
- Staff clock-in/out biometric integration
- The log PENDING/PROCESSED/FAILED lifecycle

**Required additions (not rewrites):**
1. Schema enhancement — add encryption, schoolId, retryAt, rawPayload, enrolledAt
2. Template encryption service (AES-256 on write, decrypt on compare)
3. ZKTeco SDK adapter (most likely for Kenya market) — device polling + push enrollment
4. Admin UI — device list, enrollment workflow, log viewer
5. Learner attendance enhancement — respect `attendanceLockTime`, detect LATE
6. Sync worker for offline devices (cron-based pull)

---

## 11. Recommended Device Integrations

| Priority | Vendor | Protocol | Notes |
|---|---|---|---|
| HIGH | ZKTeco | HTTP Push + SDK pull | Most common in Kenyan schools |
| MEDIUM | Hikvision | ISAPI / webhook | Used in gate/CCTV setups |
| LOW | Suprema BioStar | REST API | Premium fingerprint/face |
| LOW | Digital Persona | USB SDK | For enrollment stations |
| LOW | NFC/RFID cards | Webhook | Low cost, no biometric needed |

---

## 12. Recommended Architecture

```
Hardware Device (ZKTeco / Hikvision / etc.)
    │
    ├─► Push Mode: POST /api/biometric/log (existing webhook)
    └─► Pull Mode: BiometricSyncWorker (new cron — polls device SDK)
            │
            ▼
    BiometricService.processAttendanceLog()
            │
            ├─► BiometricLog (raw audit)
            ├─► Attendance (learner) — with time-based status detection
            └─► StaffAttendanceLog (staff) — existing, works
```
