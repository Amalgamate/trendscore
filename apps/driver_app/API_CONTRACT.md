# Driver App — Universal APK API contract (v1)

**Status: agreed. Both sides build to this. Do not change without updating both.**
Owner decisions locked 2026-10-03: one universal APK (one `applicationId`, one icon),
**device approval required**, school resolved by **code only — never a URL**.

## Why this exists
Each school runs its own Docker stack on its own origin with its own database. The app
uses the typed school code to contact the matching fixed TrendsCORE subdomain, then
requires that tenant server to confirm the code and return its origin and branding.
**The app must never accept a typed or pasted URL.**

## Domain pattern (fixed by the app and server)
The app accepts only a school code, then contacts `https://{code}.trendscore.co.ke/api`.
The server checks that the request reached that exact hostname and returns the API origin.
Codes are matched case-insensitively against `^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$`
and rejected if in `SUBDOMAIN_RESERVED_WORDS`.
Codes are matched case-insensitively against `^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$`
and rejected if in `SUBDOMAIN_RESERVED_WORDS`.

---

## 1. `POST /api/driver-connection/resolve` — public, rate-limited

Request
```json
{ "code": "zawadi" }
```

Success `200`
```json
{
  "success": true,
  "data": {
    "schoolCode": "zawadi",
    "schoolId": "uuid",
    "apiOrigin": "https://zawadi.trendscore.co.ke/api",
    "branding": {
      "displayName": "Zawadi CBC Academy",
      "motto": "Knowledge is power",
      "logoUrl": "https://.../logo.png",
      "brandColorHex": "#030B82"
    }
  }
}
```

Failures
| Status | Meaning | App must show |
|---|---|---|
| `400` | malformed code | "That is not a valid school code." |
| `404` | no school with that code | "No school found for that code." |

`404` must be the response for unknown codes or a hostname/code mismatch — do **not** leak the school list.

---

## 2. `POST /api/driver-connection/devices/register` — public, rate-limited

Request
```json
{ "code": "zawadi", "deviceId": "opaque-client-uuid", "label": "Rico's Pixel 8" }
```

Success `200` — **idempotent** on `(schoolId, deviceId)`
```json
{ "success": true, "data": { "status": "PENDING", "requestedAt": "2026-10-03T10:00:00Z" } }
```

| Status | Meaning |
|---|---|
| `404` | unknown school code |
| `429` | too many registration attempts |

---

## 3. `GET /api/driver-connection/devices/status?code=&deviceId=` — public

```json
{ "success": true, "data": { "status": "PENDING" } }   // PENDING | APPROVED | REVOKED
```

The app polls this on launch and before sign-in. Only `APPROVED` may proceed.

---

## 4. Login is gated on approval

**Existing** `POST /api/auth/login` gains one rejection case. New clients send the shared
`schoolCode` field; the server accepts the legacy `driverCode` alias during rollout:

| Status | Meaning | App must show |
|---|---|---|
| `403` + `{ "code": "DEVICE_NOT_APPROVED" }` | school known, device not approved | "Waiting for your school to approve this phone." |

Driver tokens for an unapproved device must not be issued.

---

## Client obligations

1. Persist `schoolCode`, `apiOrigin` and the branding payload per school, namespaced
   by code — a driver may work for two schools.
2. **Tokens namespaced per school.** No token for school A may ever be sent to school B.
3. `apiOrigin` may only take values from `/resolve`. Reject anything else.
4. Cache branding for offline launch; refresh when online.
5. App-level facts (version, build) stay build-time; **school identity does not.**

## Out of scope for v1
Chat surfaces, Driver App Settings page, route maps, proximity alerts, offline
boarding queue (were A–E/F; owner cut to A–D).
