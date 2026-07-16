# Live Lessons — Scoping Plan

Status as of this scoping pass: **does not exist**. Everything under "Lessons" in the
current LMS (`LearningLesson`, `LessonBlock`, `LMSLessonBuilderPage`, `LessonViewerPage`)
is static, async content — text/image/video blocks a student reads or watches on their
own time. There is no scheduling, no real-time session, no video conferencing of any
kind anywhere in the codebase (verified: no Zoom/Agora/WebRTC/Daily/Twilio references).

This document scopes what a real "Live Lessons" feature would take. It does not build
it — that's a deliberate, non-trivial addition (new third-party dependency, new cost
line, new schema) and should be greenlit explicitly before work starts.

---

## 1. Decision: don't build the video layer yourself

Rolling your own WebRTC signaling/SFU is a multi-week distraction from the actual
product (school ERP), and Kenyan school wifi/data conditions punish anything that
isn't built for lossy networks. Use an embeddable video-call API and only build the
**scheduling, access-control, and attendance** layer yourself — that's the part that
actually needs to be TrendScore-specific.

Two reasonable options, both with generous free tiers suitable for piloting:

| Option | Pros | Cons |
|---|---|---|
| **Daily.co** | Drop-in `<iframe>` or prebuilt React component; per-minute pricing; good docs; works well on poor connections | Another vendor + API key to manage |
| **100ms.live** | Similar prebuilt UI kit, India/emerging-market-friendly pricing | Slightly less mature docs |

Recommendation: **Daily.co**, for the prebuilt embeddable call UI (`@daily-co/daily-js`)
— it means the frontend work is "embed an iframe with a room URL," not "build a video
call UI." This keeps the LMS team's actual work scoped to scheduling/permissions/
attendance, matching how `mpesa.service.ts` wraps Daraja rather than building payment
rails from scratch.

This is a recommendation, not a lock-in — the schema below only stores a `provider`
+ `roomUrl`/`meetingId`, so swapping providers later doesn't require a migration.

---

## 2. Schema additions (new models, additive — no changes to existing tables)

```prisma
model LiveLesson {
  id              String            @id @default(uuid())
  schoolId        String
  learningAreaId  String
  classId         String
  streamId        String?
  termId          String
  title           String
  description     String?           @db.Text
  scheduledStart  DateTime
  scheduledEnd    DateTime
  status          LiveLessonStatus  @default(SCHEDULED)
  provider        LiveLessonProvider @default(DAILY)
  roomUrl         String?           // provider-hosted room join link
  roomName        String?           // provider room identifier (for API calls)
  hostUserId      String            // teacher who owns the session
  recordingUrl    String?           // populated after the fact, if recording enabled
  recordingEnabled Boolean          @default(false)
  actualStart     DateTime?
  actualEnd       DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  archived        Boolean           @default(false)

  school          School            @relation(fields: [schoolId], references: [id])
  learningArea    LearningArea      @relation(fields: [learningAreaId], references: [id])
  class           Class             @relation(fields: [classId], references: [id])
  host            User              @relation("LiveLessonHost", fields: [hostUserId], references: [id])
  attendance      LiveLessonAttendance[]

  @@index([schoolId])
  @@index([classId])
  @@index([hostUserId])
  @@index([status])
  @@index([scheduledStart])
  @@map("live_lessons")
}

model LiveLessonAttendance {
  id            String     @id @default(uuid())
  liveLessonId  String
  learnerId     String
  joinedAt      DateTime?
  leftAt        DateTime?
  durationSec   Int?
  status        LiveAttendanceStatus @default(INVITED)
  createdAt     DateTime   @default(now())

  liveLesson    LiveLesson @relation(fields: [liveLessonId], references: [id], onDelete: Cascade)
  learner       Learner    @relation("LiveLessonAttendance", fields: [learnerId], references: [id])

  @@unique([liveLessonId, learnerId])
  @@index([liveLessonId])
  @@index([learnerId])
  @@map("live_lesson_attendance")
}

enum LiveLessonStatus {
  SCHEDULED
  LIVE
  ENDED
  CANCELLED
}

enum LiveLessonProvider {
  DAILY
  ZOOM      // reserved, not implemented in phase 1
  CUSTOM    // reserved for a future self-hosted option
}

enum LiveAttendanceStatus {
  INVITED
  JOINED
  LEFT
  ABSENT
}
```

Deliberately **not** reusing `LearningSession` (already used for async lesson-reading
time tracking — different meaning) or `Event` (general calendar, no video/attendance
concept, would require overloading `meetingLink` with join logic it wasn't designed
for).

---

## 3. Backend

New files, following the existing LMS pattern (`lms-marketplace.service.ts` as the template):

| File | Purpose |
|---|---|
| `server/src/services/live-lesson.service.ts` | Create/update/cancel sessions; calls Daily's REST API to create/delete rooms; computes attendance from join/leave webhooks or client heartbeats |
| `server/src/controllers/live-lesson.controller.ts` | `createLiveLesson`, `listLiveLessons`, `getLiveLesson`, `startLiveLesson` (mints a join token), `endLiveLesson`, `cancelLiveLesson`, `getAttendance`, `dailyWebhook` |
| `server/src/routes/live-lesson.routes.ts` | Mounted at `/api/lms/live-lessons`, gated by existing `requireApp('lms-enterprise')` pattern (reuse marketplace's add-on gating) |

Key behaviors:
- **Room creation** happens at schedule time (not join time) so the link is stable and can go into notifications ahead of the session.
- **Join tokens**: mint a short-lived Daily meeting token server-side per user (teacher gets `is_owner: true`, students don't) — never expose the Daily API key to the frontend.
- **Attendance**: two viable approaches — (a) Daily webhooks (`participant.joined`/`participant.left`) posted to a public `dailyWebhook` endpoint, mirroring how `mpesa.controller.ts` already handles a public payment callback, or (b) client-side heartbeat while the iframe is open. Start with (a); it's more reliable and doesn't depend on the tab staying focused.
- **Notifications**: reuse `LMSNotificationService` (already notifies on assignment publish/marketplace purchase) to notify students 15 min before start and on session start — same pattern, new trigger.

---

## 4. Frontend

| File | Purpose |
|---|---|
| `src/components/CBCGrading/pages/lms/live/LiveLessonsPage.jsx` | List view (upcoming/past), mirrors `AssignmentsPage.jsx`'s teacher/student split view |
| `src/components/CBCGrading/pages/lms/live/LiveLessonScheduler.jsx` | Create/edit form — same shape as `AssignmentBuilder.jsx` (title, class, subject, term, date/time range) |
| `src/components/CBCGrading/pages/lms/live/LiveLessonRoom.jsx` | Renders the Daily prebuilt iframe (`@daily-co/daily-js`), fetches a join token, shows a lobby state before start time |

New `PageRouter.jsx` routes needed: `learning-live`, `learning-live-schedule`, `learning-live-room`. New sidebar entry under the Learning Hub, next to "Lessons" and "Assignments."

---

## 5. Explicitly out of scope for a phase 1

- In-call chat, breakout rooms, screen-annotation — Daily's prebuilt UI already covers basic chat/screen-share; don't build custom controls on day 1.
- Recording playback inside TrendScore (store `recordingUrl`, but just link out to Daily's hosted recording initially — building a video player/scrubber is separate work).
- Zoom/Teams integration — `LiveLessonProvider` enum reserves the slot but only `DAILY` gets implemented.
- Automatic makeup-session scheduling for absentees.

---

## 6. Open questions before starting build

1. **Budget**: Daily.co bills per participant-minute. Worth estimating cost per school at expected concurrent usage before committing.
2. **Add-on gating**: should this ship under the existing `lms-enterprise` flag (same as Marketplace), or its own toggle in `LMSSettings`? Recommend adding `enableLiveLessons Boolean @default(false)` to `LMSSettings` for finer-grained control per school.
3. **Bandwidth reality check**: given the target market (Kenyan schools, variable connectivity), is a live video feature actually the highest-leverage next investment, or would scheduled live lessons mostly fail to connect in practice? Worth a quick informal poll of 2-3 pilot schools before building.
