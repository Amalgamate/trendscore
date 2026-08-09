# TrendSCORE 2.0 — API Standards

**Document ID:** API-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Parent Document:** `00_MASTER_ARCHITECTURE_SPECIFICATION.md §8`

---

## 1. URL Structure

### Base Paths

| Path prefix | Purpose |
|---|---|
| `/api/` | All existing endpoints — frozen at current shape |
| `/api/v1/` | All new TrendSCORE 2.0 endpoints |
| `/api/webhooks/` | Public inbound callbacks (biometric devices, SMS replies, payment) |

No new routes are added to the root `/api/` path. All new modules register under `/api/v1/`.

### Resource Naming

```
/api/v1/{domain}/{resource}
/api/v1/{domain}/{resource}/:id
/api/v1/{domain}/{resource}/:id/{sub-resource}
/api/v1/{domain}/{resource}/:id/{sub-resource}/:subId
```

Examples:
```
GET  /api/v1/presence/events
GET  /api/v1/presence/learner/:learnerId/timeline
GET  /api/v1/boarding/dormitories
GET  /api/v1/boarding/dormitories/:id/beds
POST /api/v1/boarding/exeat-requests
PUT  /api/v1/boarding/exeat-requests/:id/approve
GET  /api/v1/transport/trips
POST /api/v1/transport/trips/:id/board
```

Rules:
- Resource names are **plural nouns** in kebab-case
- Sub-resources are nested under their parent `/:id/`
- Actions that are not pure CRUD use verb suffixes on the parent resource path:
  `/approve`, `/deny`, `/lock`, `/unlock`, `/sync`, `/board`, `/alight`
- Never abbreviate: `/attendance` not `/att`, `/dormitories` not `/dorms`

---

## 2. HTTP Method Usage

| Method | Use | Body | Idempotent |
|---|---|---|---|
| `GET` | Retrieve resource(s) | None | Yes |
| `POST` | Create new resource or trigger action | JSON | No |
| `PUT` | Replace entire resource | JSON | Yes |
| `PATCH` | Partial update of resource | JSON | No |
| `DELETE` | Soft-delete (archive) a resource | None | Yes |

**TrendSCORE convention:** Hard deletes are not exposed in the API. All `DELETE` calls result in `archived: true`. Permanent deletion is admin-only database operations.

---

## 3. Response Envelope

Every response, success or error, uses the same envelope structure.

### Success — Single Resource

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "personId": "uuid",
    "eventType": "CLASS_ATTENDANCE"
  },
  "message": "Attendance marked successfully"
}
```

### Success — Collection

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "count": 20,
    "page": 1,
    "pageSize": 20,
    "totalCount": 143
  }
}
```

### Success — Action (no data returned)

```json
{
  "success": true,
  "message": "Exeat request approved"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ATTENDANCE_WINDOW_CLOSED",
    "message": "The attendance window for today has closed (lock time: 09:00)",
    "field": "date",
    "details": {
      "lockTime": "09:00",
      "currentTime": "10:15"
    }
  }
}
```

Rules:
- `error.code` is always a SCREAMING_SNAKE_CASE string — machine-readable
- `error.message` is human-readable, safe to display in UI
- `error.field` is present when the error is tied to a specific input field (validation errors)
- `error.details` carries structured extras the UI can act on programmatically
- Never expose stack traces, SQL errors, or internal paths in responses

---

## 4. HTTP Status Codes

| Code | When to use |
|---|---|
| `200 OK` | Successful GET, PUT, PATCH |
| `201 Created` | Successful POST that created a resource |
| `204 No Content` | Successful DELETE with no body |
| `400 Bad Request` | Malformed request, missing fields, validation failure |
| `401 Unauthorized` | No valid authentication token |
| `403 Forbidden` | Authenticated but lacking required permission |
| `404 Not Found` | Resource does not exist or is archived |
| `409 Conflict` | Duplicate — resource already exists (e.g. duplicate attendance mark) |
| `422 Unprocessable Entity` | Request is valid but cannot be processed (e.g. capacity exceeded) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |

**Do not use 200 for errors.** The `success: false` envelope is not a substitute for a correct HTTP status code.

---

## 5. Error Code Registry

### Global Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid token |
| `FORBIDDEN` | 403 | Insufficient permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | One or more fields failed validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `FEATURE_DISABLED` | 403 | Module not enabled for this school |

### Attendance Domain Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `ATTENDANCE_WINDOW_CLOSED` | 422 | Past the lock time |
| `ATTENDANCE_ALREADY_MARKED` | 409 | Duplicate for this learner/date |
| `LEARNER_NOT_IN_CLASS` | 403 | Teacher marking outside their class |
| `CLASS_NOT_FOUND` | 404 | classId does not exist |

### Biometric Domain Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_DEVICE_TOKEN` | 401 | Device token not recognised |
| `DEVICE_NOT_FOUND` | 404 | deviceId not registered |
| `LEARNER_NOT_FOUND_BY_ADM` | 404 | admissionNumber has no learner match |
| `STAFF_NOT_FOUND_BY_ID` | 404 | staffId has no user match |
| `ENROLLMENT_FAILED` | 422 | Template quality below threshold |

### Transport Domain Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VEHICLE_AT_CAPACITY` | 422 | No seats remaining |
| `DUPLICATE_ASSIGNMENT` | 409 | Learner already on this route |
| `TRIP_NOT_IN_PROGRESS` | 422 | Boarding event on a non-active trip |

### Boarding Domain Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `BED_OCCUPIED` | 409 | Bed already assigned |
| `LEARNER_NOT_BOARDER` | 422 | Learner has no dormitory assignment |
| `EXEAT_OVERLAP` | 409 | Existing approved exeat overlaps with requested dates |
| `ROLL_CALL_ALREADY_COMPLETE` | 409 | Roll call for this session already finalised |

---

## 6. Pagination Standard

All collection endpoints support:

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | integer | 1 | — | 1-based page number |
| `pageSize` | integer | 20 | 100 | Records per page |
| `sortBy` | string | varies | — | Field to sort by |
| `sortOrder` | `asc` \| `desc` | `desc` | — | Sort direction |

Response meta:
```json
{
  "meta": {
    "page": 2,
    "pageSize": 20,
    "count": 20,
    "totalCount": 143,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

For high-volume feeds (presence events, biometric logs), cursor-based pagination is preferred:

| Parameter | Type | Description |
|---|---|---|
| `cursor` | string | ID of last item received |
| `limit` | integer | Records to return (max 100) |

Response:
```json
{
  "data": [ ... ],
  "meta": {
    "nextCursor": "uuid-of-last-item",
    "hasMore": true,
    "count": 50
  }
}
```

---

## 7. Filtering and Query Parameters

Filtering is via query parameters. Convention:

| Pattern | Example | Meaning |
|---|---|---|
| Exact match | `?status=PENDING` | status equals PENDING |
| Date range | `?startDate=2026-08-01&endDate=2026-08-31` | ISO 8601 dates |
| Comma list | `?statuses=PRESENT,LATE` | Any of these values |
| Boolean | `?active=true` | boolean string |
| Free text search | `?search=john` | Server-side ILIKE search |
| Nested filter | `?classId=uuid` | Filter by relationship |

Parameters that modify result shape:
- `?include=learner,class` — expand related records inline
- `?fields=id,name,status` — sparse fieldset (future consideration)

---

## 8. Authentication Headers

All authenticated endpoints require:
```
Authorization: Bearer <jwt_access_token>
```

Device webhook endpoints require:
```
Authorization: Bearer <device_token>
```

SMS inbound callbacks use HMAC signature verification:
```
X-SMS-Signature: <hmac_sha256_of_body>
```

---

## 9. Request Validation Standards

All write endpoints validate with Zod. Validation rules:

- Strings: `.trim()` before validate, `.min(1)` on required, max lengths enforced
- UUIDs: `z.string().uuid()`
- Dates: `z.string().datetime()` or `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — both accepted for date-only fields
- Enums: `z.enum([...])` with the full allowable set
- Phone numbers: validated in service layer against Kenyan format, not in Zod (allows international future)
- Optional fields: `z.string().optional()` — never `z.string().nullable()` unless the DB column is nullable and the API must accept null
- Arrays: `z.array(itemSchema).min(1).max(200)` — always bounded

A validation failure returns:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "field": "learnerId",
    "details": {
      "issues": [
        { "path": ["learnerId"], "message": "Required", "code": "invalid_type" }
      ]
    }
  }
}
```

---

## 10. Versioning Deprecation Process

When an existing `/api/` route must change shape:

1. Add the new shape at `/api/v1/{route}`
2. Add `Deprecation: true` and `Sunset: <ISO date>` headers to the old route
3. Log a warning when the deprecated route is called: `[DEPRECATION] GET /api/old-route called`
4. After the Sunset date (minimum 90 days from announcement), the old route returns `410 Gone`

No existing `/api/` routes are changed in shape in TrendSCORE 2.0. All changes are additive.

---

## 11. Webhook Endpoints

Public webhook endpoints (callable without user auth) follow a separate contract:

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/webhooks/biometric/log` | POST | Device Bearer token | Hardware device attendance scan |
| `/api/webhooks/sms/inbound` | POST | HMAC signature | Inbound SMS reply from parent |
| `/api/webhooks/payment/mpesa` | POST | IP whitelist | M-Pesa callback |
| `/api/webhooks/payment/intasend` | POST | Signature | Intasend callback |

Webhook security:
- All webhook payloads are logged to a `webhook_inbound_log` table (future)
- Invalid signatures return `401` with no body
- Webhook handlers are idempotent — duplicate delivery is ignored

---

## 12. Permissions Registry — New Modules

Every new module must declare its permissions before implementation. Permissions follow `VERB_RESOURCE` convention.

### Presence Module Permissions

```
VIEW_PRESENCE_TIMELINE          — View own child / own class timeline
VIEW_ALL_PRESENCE               — View any person's presence data (admin)
VIEW_PRESENCE_ANALYTICS         — View school-wide analytics
MANAGE_PRESENCE_RULES           — Create / update presence rules
```

### Transport Trip Permissions

```
MANAGE_TRANSPORT_TRIPS          — Create / update trips (admin)
RECORD_BOARDING_EVENTS          — Driver boarding confirmation
VIEW_TRANSPORT_TRIPS            — View trip list and boarding manifest
```

### Boarding Module Permissions

```
MANAGE_DORMITORIES              — Create / update dormitory records
ASSIGN_DORMITORY_BEDS           — Assign learners to beds
CONDUCT_ROLL_CALL               — Record roll call entries
MANAGE_EXEAT_REQUESTS           — Approve / deny exeat
SUBMIT_EXEAT_REQUEST            — Parent / learner submits exeat
VIEW_BOARDING_REPORTS           — View roll call history and boarding analytics
MANAGE_HOUSE_MASTERS            — Assign house masters
```

### Biometric Admin Permissions

```
MANAGE_BIOMETRIC_DEVICES        — Register / update devices (existing)
ENROLL_FINGERPRINTS             — Enroll credentials (existing)
VIEW_BIOMETRIC_LOGS             — View raw device logs (existing)
MANAGE_BIOMETRIC_SYNC           — Trigger device sync
```

---
