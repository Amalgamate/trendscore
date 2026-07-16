# TrendSCORE Bug Fix Summary

Session date: 2026-07-11
Scope: prioritized bug fix list (6 items) + 3 issues discovered and fixed along the way.

---

## 1. `/mine` → `/my` route typo
**File:** `src/services/api/lms.api.js`
`LMSAssignmentService.getMySubmissions` was hitting `/lms/submissions/mine`, but the backend route is `/lms/submissions/my` (`server/src/routes/lms.routes.ts`). Fixed the frontend call. This was blocking 3+ screens that render a student's own submissions.

---

## 2. Assignment filtering + PARENT branch
**Files:** `server/src/services/lms-assignment.service.ts`, `server/src/controllers/lms.controller.ts`

- Added `assignmentId` / `learnerIds` to `AssignmentFilters`.
- `getAssignments` now has an explicit `PARENT` branch: resolves the parent's accessible children via `parentAccessService.getAccessibleLearnerIds`, intersects with any caller-supplied `learnerIds`, scopes to those children's active classes, and force-locks `status` to `PUBLISHED`.
- **Bonus fix:** the old code let a caller-supplied `status` query param silently override the `PUBLISHED`-only restriction for `STUDENT` too (a pre-existing privilege-escalation-adjacent bug) — closed for both roles.
- `getMySubmissions` now accepts a single learner or an array of learners, plus `assignmentId` filtering. Fully backward-compatible with the existing call site.
- Controller passes `assignmentId` / `learnerIds` query params through for both endpoints.

---

## 3. `ParentPortalFees` → `MpesaPaymentModal` wiring
**File:** `src/components/CBCGrading/pages/parent-portal/ParentPortalFees.jsx`

- Lifted `selectedChildId` state out of `Step3Distribution` (it was previously local to that component and silently discarded — the parent component never learned which child was selected in "Pay One Child" mode).
- Fixed a bug where the Review & Pay button never rendered at all in "Pay One Child" mode (visibility condition incorrectly required `strategy`, which only applies to "Pay Partial" mode).
- `handleReviewPay` resolves the target child, fetches their invoices via `feeAPI.getLearnerInvoices`, finds an outstanding one, and opens `MpesaPaymentModal` with that invoice + computed amount.
- **Known limitation:** for "Pay Full"/"Pay Partial" spanning multiple children, the M-Pesa STK push is attributed to a single invoice (the first child with a balance), since `MpesaPaymentModal` only drives one M-Pesa transaction per push. True per-child apportionment across a family would need a different flow — not implemented.

---

## 4. Field name alignment: `MyAssignments.jsx` / `StudentDashboard.jsx`
**Root cause (backend):** `GET /api/lms/my-assignments` was calling the legacy `LMSService.getStudentAssignments` — a stub where `dueDate` was always `null`, `totalPoints` was hardcoded to `100`, and `grade` was always `null` — instead of the fully-built `LMSAssignmentService.getStudentAssignments`, which was sitting unused as dead code with real `class`, `learningArea`, `totalMarks`, and `mySubmission.marks`. Switched the controller (`server/src/controllers/lms.controller.ts`) to use the real one.

**Frontend files updated:**
- `src/components/CBCGrading/pages/student/MyAssignments.jsx`
- `src/components/CBCGrading/pages/student/StudentDashboard.jsx`
- `src/components/CBCGrading/pages/student/SubmissionModal.jsx` (not originally on the list, but had the same stale fields)

All now consume `class.name`, `learningArea.name`, `totalMarks`, `mySubmission.marks`, `instructions` instead of `course.title/subject`, `totalPoints`, `submission.grade/feedback`.

---

## 5. Dead settings menu items in `ParentPortalMore.jsx`
**File:** `src/components/CBCGrading/pages/parent-portal/ParentPortalMore.jsx`

- **Change Password** → now opens a real confirmation modal and calls the new `authAPI.forgotPassword(user.email)`, reusing the existing `/auth/forgot-password` email-reset flow (there's no authenticated "change my own password" endpoint in the backend).
- **Privacy & Security** → removed. No backing feature/data exists anywhere in the app.
- **Contact School** → now navigates to the real `parent-portal-support` screen (email/ticket support).
- **Language / Display** → removed, along with the whole "App Settings" section. No i18n system or theme-switching mechanism exists anywhere in the codebase.
- Added `forgotPassword` to `src/services/api/auth.api.js`.

---

## 6. Learner progress route
**Root cause:** `LMSService.getLearnerProgress(learnerId, courseId)` was already fully implemented in `server/src/services/lms.service.ts` — it was just never wired to a controller or route, making it dead code.

**Files:**
- `server/src/controllers/lms.controller.ts` — added `getLearnerProgress` with role scoping (STUDENT → self only, PARENT → own children only, staff → any), mirroring the ownership pattern already used in `getLearnerAnalytics`.
- `server/src/routes/lms.routes.ts` — registered `GET /api/lms/progress/:learnerId/:courseId`.
- `src/components/CBCGrading/pages/parent-portal/ParentLearningTab.jsx` — **bonus fix:** the only real caller was passing the literal string `'current'` as `courseId` (a placeholder that always 404'd, silently swallowed by a `.catch(() => null)`). Now fetches each child's actual active enrollments via `getEnrollments` and aggregates content-level progress across them.

---

## Additional issues found and fixed (not on the original list)

### A. Password reset via email link was completely broken
`authAPI.resetPassword` sent `{ token, password }`, but the backend (`POST /auth/reset-password`) requires `{ token, newPassword, passwordConfirm }`. Every real reset attempt would have failed with "Missing fields." Fixed the API wrapper and the call site in `src/components/auth/ResetPasswordForm.jsx` (which already collected both password fields but only forwarded one).

### B. Assignment submission used JSON + a non-functional `fileUrl` field
`src/components/CBCGrading/pages/student/SubmissionModal.jsx` POSTed a plain JSON body `{ content, fileUrl }` to an endpoint that requires `multipart/form-data` (handled by `multer`) and has no concept of an arbitrary file URL — only real uploaded files via `req.files`. Rewired to build a real `FormData` request (with file-size validation against the assignment's `maxFileSize`) via the already-correct, previously-unused `lmsAPI.submitAssignment` wrapper.

### C. `getEnrollments` had no authorization scoping
`GET /api/lms/enrollments` let any authenticated user with `LEARNING_VIEW` (which includes STUDENT and PARENT) query any learner's enrollments by ID, with no ownership check. Added the same role-scoping pattern used elsewhere: STUDENT is force-scoped to their own learner record, PARENT must supply a `learnerId` and can only query their own child, staff roles remain unrestricted.

---

## Known remaining gaps (flagged, not fixed — out of scope)
- None outstanding — all three issues flagged during the session (A, B, C above) have since been resolved.
