# Clock-In Geofence Audit (Staff Attendance)

## 1. Existing Architecture
- Single-tenant school model: one `School` record is treated as the institution context; users do not appear to be scoped to a `schoolId` in Prisma.
- Staff clock-in/out is implemented as HR “attendance” and stored as `StaffAttendanceLog` (one record per user per day).
- Clock-in UX currently exists primarily inside the mobile Owner/Admin dashboard and is powered by browser geolocation plus a client-side distance check.
- A separate learner attendance feature exists (`Attendance`) and is unrelated to staff clock-in geofencing.
- Biometric devices can also generate staff attendance entries via a public webhook endpoint.

## 2. Existing Database Support
### Staff attendance / clock-in storage
- Prisma model: `StaffAttendanceLog` in [schema.prisma](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/schema.prisma#L1842-L1857)
  - Fields: `userId`, `date`, `clockInAt`, `clockOutAt?`, `source?`, `metadata Json?`
  - Constraint: `@@unique([userId, date])`
- Migration mismatch: the DB table includes `schoolId`, but Prisma model does not.
  - Migration: [20260307053430_add_staff_attendance_log/migration.sql](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/migrations/20260307053430_add_staff_attendance_log/migration.sql#L1-L30)
  - Risk: Prisma cannot read/write `schoolId`; any future “per school campus geofence” capability will require schema alignment.

### School GPS storage
- Prisma `School` includes `latitude Float?` and `longitude Float?` in [schema.prisma](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/schema.prisma#L129-L195)
- No DB support exists for:
  - Geofence radius
  - Geofence enforcement mode (strict/soft/off)
  - Per-campus / per-branch coordinates

### Audit logging storage
- Prisma `AuditLog` in [schema.prisma](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/schema.prisma#L2243-L2258)
  - Captures: `action`, user identity, `ipAddress`, `method`, `path`, `params`, `createdAt`
  - Does not capture request body, response status, or a domain-specific “clock-in attempt outcome”.

## 3. Existing APIs
### Staff clock-in endpoints (HR module)
- Routes: [hr.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/hr.routes.ts#L69-L90)
  - `POST /api/hr/attendance/clock-in` (auth + rate limit + auditLog)
  - `POST /api/hr/attendance/clock-out` (auth + rate limit + auditLog)
  - `GET /api/hr/attendance/today` (auth + rate limit)
- Service persistence: [hr.service.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/services/hr.service.ts#L628-L735)
  - `clockInStaff(...)` upserts by `(userId, date)` and stores `source` + `metadata` JSON.
  - No server-side geofence/distance logic.
  - No validation of location payload (none is expected); payload is treated as `any`.

### Learner attendance endpoints (not staff clock-in)
- Routes: [attendance.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/attendance.routes.ts#L1-L127)
  - Includes request validation via Zod + `validate(...)` middleware.
  - Includes `auditLog(...)` for attendance marking actions.
  - No geolocation usage.

### Biometric attendance ingestion (related to staff attendance records)
- Public webhook: [biometric.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/biometric.routes.ts#L44-L53)
- Staff ingestion writes `StaffAttendanceLog` on `IN`/`OUT`: [biometric.service.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/services/biometric.service.ts#L156-L199)
  - No geofence enforcement or device-location verification.

## 4. Existing UI
### School GPS configuration
- School Settings page supports capturing and saving GPS coordinates:
  - “Get GPS Location” uses `navigator.geolocation.getCurrentPosition(...)` and persists `latitude`/`longitude` via `PUT /schools`.
  - File: [SchoolSettings.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/pages/settings/SchoolSettings.jsx#L209-L356)

### Staff clock-in UX
- Mobile Owner/Admin dashboard contains current geofence-based clock-in experience:
  - File: [OwnerMobileDashboard.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/mobile/OwnerMobileDashboard.jsx#L19-L173)
  - Implements a Haversine calculation (`haversineMetres(...)`) and compares against a hard-coded radius:
    - `const GEOFENCE_RADIUS_M = 5;`
  - Uses `navigator.geolocation.watchPosition(...)` with `{ enableHighAccuracy: true }`
  - Disables “Clock In” unless `geoStatus === 'in-range'`

### Teacher/staff dashboard integration
- A teacher dashboard widget slot exists but is stubbed:
  - Widget config references `WIDGET_IDS.CLOCK_IN_STATUS`: [RoleDashboardConfig.ts](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/configs/RoleDashboardConfig.ts#L207-L278)
  - Widget component is placeholder: [ClockInStatusWidget.tsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/widgets/teacher/ClockInStatusWidget.tsx#L1-L9)

### Client-side clock-in state handling
- Client util stores clock-in state in localStorage and syncs to backend:
  - File: [teacherClockIn.js](file:///c:/Amalgamate/Projects/TreadSCORE/src/utils/teacherClockIn.js#L1-L186)
  - Clock-in/out calls: `hrAPI.clockInStaff(...)` / `hrAPI.clockOutStaff(...)` via [hr.api.js](file:///c:/Amalgamate/Projects/TreadSCORE/src/services/api/hr.api.js#L1-L14)
  - Geolocation is not captured or sent as part of the clock-in payload.

## 5. Existing Security
### What is already present
- Auth is required for HR clock-in/out endpoints: [hr.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/hr.routes.ts#L69-L90)
- Rate limiting exists for clock-in/out calls.
- DB audit middleware logs clock-in/out requests:
  - [permissions.middleware.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/middleware/permissions.middleware.ts#L319-L343)

### What is not present (critical for strict geofence)
- No server-side enforcement of distance-to-school.
- No request schema validation for clock-in/out payloads (unlike learner attendance routes).
- No server-side capture of the user’s location, accuracy, or device context.
- No domain audit trail of “attempts” (including blocked/failed attempts) because the server is not asked to evaluate attempts; the UI simply disables the button.

## 6. Gaps Found
### Geofence audit checklist
- GPS coordinate storage: partial (school lat/lng exists)
- Latitude storage: yes (`School.latitude`)
- Longitude storage: yes (`School.longitude`)
- Radius storage: no
- Distance calculation: frontend-only
- Haversine calculations: frontend-only (Owner mobile dashboard)
- Browser geolocation: yes (SchoolSettings, OwnerMobileDashboard)
- Mobile geolocation: only via mobile web/PWA (no native app layer found)
- GPS permission handling: basic error handling only (no Permissions API usage)
- Location accuracy validation: not implemented (no threshold checks using `position.coords.accuracy`)
- Location spoof detection: not implemented
- Failed clock-in logging: not implemented (blocked attempts never hit backend)
- Clock-in audit trails: partial (route-level audit logs exist, but are not “attempt logs” and do not record outcomes)

### Product/UX gaps
- No dedicated clock-in page; clock-in is embedded inside the Owner/Admin mobile dashboard banner.
- Teacher desktop/mobile dashboards do not expose a working clock-in action (widget is a stub).
- Radius is hard-coded to 5m in UI; not configurable.
- No UI for “school pin missing” remediation beyond showing a warning text.

## 7. Risks Found
### Security gaps (bypass risk)
- Strict enforcement cannot be met while geofencing is only client-side.
  - Any authenticated user can call `POST /api/hr/attendance/clock-in` directly (e.g., from the browser console) from any location.
- HR clock-in/out endpoints accept arbitrary payload (`payload: any`) and have no schema validation, enabling:
  - Untrusted timestamp injection (clock-in at arbitrary time)
  - Oversized `metadata` blobs

### Spoofing risks (hard to fully prevent in web)
- Browser geolocation can be spoofed on desktop devtools, via OS-level “mock location”, or via third-party tooling.
- On Android devices, “Allow mock locations” can return false coordinates.
- Without a native app + device attestation, spoof resistance is limited to heuristics.

### Operational risks (false negatives with 5m strict radius)
- GPS accuracy in real environments commonly ranges ~5–50m (worse indoors).
- A strict 5m cutoff can cause legitimate staff to be blocked from clocking in when accuracy is poor.
- Current code does not check `position.coords.accuracy`, so it cannot distinguish “out of range” from “location is too imprecise to decide”.

### Privacy/compliance considerations
- SchoolSettings performs reverse geocoding via a third-party endpoint (OpenStreetMap Nominatim) from the client.
  - This discloses school GPS coordinates to a third party and is subject to third-party terms/rate limits.

## 8. Recommended Architecture
### Server-side geofence enforcement (required for “strict”)
- Treat the server as the source of truth for geofence decisions.
- On clock-in attempts, require the client to submit:
  - `latitude`, `longitude`, `accuracyMeters`, `capturedAt`, `clientClockId`, `userAgent`, optional `deviceHints`
- The server should:
  - Load the active school coordinates and configured radius.
  - Compute distance (Haversine) and decide allow/deny.
  - Persist a domain attempt record for every attempt (success or failure) with reason codes.

### Data model additions (conceptual)
- Add school settings:
  - `geofenceLatitude`/`geofenceLongitude` (or reuse `School.latitude/longitude`)
  - `geofenceRadiusMeters` (default 5)
  - `geofenceEnforcementMode` (`STRICT` / `SOFT` / `OFF`)
- Add a dedicated attempt log table (separate from `AuditLog`) to support reporting:
  - `userId`, `dateTime`, `action` (CLOCK_IN/CLOCK_OUT), `result` (ALLOWED/DENIED/ERROR)
  - `reasonCode` (OUT_OF_RANGE, NO_SCHOOL_PIN, PERMISSION_DENIED, ACCURACY_TOO_LOW, INVALID_PAYLOAD, etc.)
  - submitted coords + accuracy + derived distance + server decision inputs
  - `ipAddress`, `userAgent`

### Client behavior
- Keep client-side checks for UX only (fast feedback), but never rely on them for enforcement.
- Display clear statuses:
  - “Location permission denied”
  - “Location accuracy too low (try moving outdoors)”
  - “Outside allowed zone (X meters from school)”

## 9. Implementation Phases
### Phase 1 — Foundations (data + validation)
- Align Prisma `StaffAttendanceLog` with the migration (decide whether `schoolId` is required for single-tenant usage).
- Add geofence radius configuration at school level.
- Add schema validation for HR clock-in/out payloads.

### Phase 2 — Server enforcement + attempt logging
- Implement server-side distance computation and strict allow/deny.
- Implement a dedicated staff clock-in attempt log (covers success + denied + malformed).
- Ensure audit logs and attempt logs are both written (audit for “who called what”, attempt log for “what happened and why”).

### Phase 3 — UI completion (teacher + desktop + mobile)
- Replace stub teacher widget with a real clock-in control (desktop + mobile layouts).
- Update clock-in client to submit location + accuracy and display server decision reasons.
- Add admin UI for radius and enforcement mode, and guidance for setting the school pin.

### Phase 4 — Hardening and anti-spoof heuristics
- Add heuristics: minimum accuracy thresholds, rate-limited retries, “impossible travel” checks (optional).
- Optional (stronger): native wrapper + device attestation for higher spoof resistance.

## 10. Quick Wins
- Add request-body validation to `POST /api/hr/attendance/clock-in` and `clock-out` (currently missing).
- Standardize naming: “teacherClockIn” utilities currently back staff attendance; consider refactoring to “staffClockIn”.
- Stop treating localStorage as authoritative; treat server response as the single source of truth for “clocked in today”.
- Add an explicit “school pin not set” admin CTA in the clock-in UI to route to School Settings.
- Add accuracy display (`position.coords.accuracy`) and “cannot determine” status when accuracy is too low.

## 11. Estimated Effort (Relative)
- Phase 1: Medium (schema alignment + settings + validation plumbing)
- Phase 2: Medium–Large (server-side enforcement + robust attempt logging + reporting)
- Phase 3: Medium (UI wiring + permission UX + responsive layouts)
- Phase 4: Small–Medium for heuristics; Large if a native+attestation approach is required

## Files Reviewed
### Backend
- [schema.prisma](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/schema.prisma)
- [20260307053430_add_staff_attendance_log/migration.sql](file:///c:/Amalgamate/Projects/TreadSCORE/server/prisma/migrations/20260307053430_add_staff_attendance_log/migration.sql)
- [hr.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/hr.routes.ts)
- [hr.service.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/services/hr.service.ts)
- [permissions.middleware.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/middleware/permissions.middleware.ts)
- [school.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/school.routes.ts)
- [school.controller.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/controllers/school.controller.ts)
- [attendance.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/attendance.routes.ts)
- [biometric.routes.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/routes/biometric.routes.ts)
- [biometric.service.ts](file:///c:/Amalgamate/Projects/TreadSCORE/server/src/services/biometric.service.ts)

### Frontend
- [OwnerMobileDashboard.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/mobile/OwnerMobileDashboard.jsx)
- [SchoolSettings.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/pages/settings/SchoolSettings.jsx)
- [teacherClockIn.js](file:///c:/Amalgamate/Projects/TreadSCORE/src/utils/teacherClockIn.js)
- [hr.api.js](file:///c:/Amalgamate/Projects/TreadSCORE/src/services/api/hr.api.js)
- [ClockInStatusWidget.tsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/widgets/teacher/ClockInStatusWidget.tsx)
- [RoleDashboardConfig.ts](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/configs/RoleDashboardConfig.ts)
- [WidgetRegistry.ts](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/WidgetRegistry.ts)
- [DashboardResponsiveWrapper.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/DashboardResponsiveWrapper.jsx)
- [PageRouter.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/layout/PageRouter.jsx)
- [DashboardSummary.jsx](file:///c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/pages/dashboard/DashboardSummary.jsx)

