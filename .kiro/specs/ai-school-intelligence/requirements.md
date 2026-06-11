# AI School Intelligence Platform — Requirements

Derived from technical design. Features are grouped by phase.

---

## Phase 1 — Core AI Intelligence

### Requirement 1: AI Report Card Comments

**User Story:** As a teacher, I want to click "Generate AI Comment" on a learner's report card so that I get a CBC-aligned draft comment I can review, edit, and save — eliminating manual comment writing.

#### Acceptance Criteria

1. A "Generate AI Comment" button appears on the report card / assessment result view for each learner.
2. When clicked, the system fetches the learner's latest term average, achievement level (EE/ME/AE/BE), attendance rate, strongest and weakest subject.
3. A CBC-aligned comment is generated in third person, 2–3 sentences, using competency language.
4. The comment is displayed in an editable text area before saving.
5. A "Regenerate" button produces a different variant of the comment.
6. The final saved comment is stored against the learner's report card and in `AIGeneratedContent` with `createdBy` and provider logged.
7. If the AI API is unavailable or unconfigured, a deterministic rule-based comment is produced instead (no error shown to user).
8. Comments are scoped per school — teachers cannot access comments from other schools.

---

### Requirement 2: AI Parent Message Generator

**User Story:** As a teacher or accounts clerk, I want to generate a personalized fee reminder or school notice for a parent in one click, formatted appropriately for Email, SMS, or WhatsApp, so that I don't have to write individual messages.

#### Acceptance Criteria

1. The message drafting modal includes a channel selector: Email, SMS, WhatsApp.
2. For fee reminders, the system auto-injects the learner's name, parent name, and outstanding balance.
3. Email drafts are formal and multi-paragraph. SMS drafts are ≤160 characters. WhatsApp drafts are concise and conversational.
4. A language selector supports English, Kiswahili, and Somali.
5. Generated messages can be edited before sending.
6. Translations are produced via the AI bridge; if unavailable, an error message prompts the user to translate manually.
7. The draft is never sent automatically — user must confirm before dispatch.

---

### Requirement 3: AI Academic Analysis

**User Story:** As a class teacher or academic head, I want to click "Analyze Results" for a class and receive a narrative summary of performance — including weak strands, gender gaps, and a recommendation — so that I can act without manually interpreting spreadsheet data.

#### Acceptance Criteria

1. An "Analyze Results" button is available on the class assessment summary page.
2. The analysis includes: overall class average, change from previous term (delta %), gender performance gap, per-subject averages, and the weakest subject.
3. A 2–3 paragraph narrative is generated identifying the weakest strand, notable trends, and one concrete recommendation.
4. Results are cached per `(classId, term, academicYear)` for 5 minutes to avoid redundant LLM calls.
5. If fewer than 5 learners have results, the system returns a message: "Insufficient data for class analysis."
6. A school-wide analysis is available from the academic dashboard showing all classes side-by-side.
7. Analysis is role-gated: teachers see their assigned classes only; admins see all classes.

---

### Requirement 4: AI School Owner Daily Brief

**User Story:** As a principal or school owner, I want to open my dashboard and immediately see a plain-English morning summary of the school's status so that I can identify what needs my attention in under 30 seconds.

#### Acceptance Criteria

1. A "Daily Brief" widget is displayed on the dashboard home page.
2. The brief shows a personalized greeting using the principal's name.
3. The brief contains 3–5 structured bullets, each colour-coded: green (positive), amber (warning), red (critical).
4. Each bullet corresponds to a real metric: fee collection rate, at-risk learner count, attendance rate, pending assessments.
5. A single "Recommended Action" sentence is shown at the bottom of the widget.
6. The brief is refreshed every 5 minutes (cached in Redis per school).
7. A manual "Refresh" button bypasses the cache and generates a fresh brief on demand.
8. If the LLM is unavailable, the widget falls back to a template-formatted brief from deterministic insight data.

---

### Requirement 5: AI Learner Risk Detection

**User Story:** As a head teacher or class teacher, I want to see which learners are at risk across academic performance, attendance, fee balance, and discipline so that I can proactively intervene before the end of term.

#### Acceptance Criteria

1. A Risk Dashboard page lists all learners in the school (or in the teacher's classes) with a risk level badge: Critical, High, Medium, Low.
2. Risk is computed from four weighted dimensions: academic (40%), attendance (30%), financial (20%), discipline (10%).
3. Each learner's risk card shows dimension-level detail (e.g., "Attendance dropped from 94% to 71%").
4. A narrative explanation is generated for High and Critical risk learners explaining the key contributing factors.
5. Recommended intervention actions are listed per learner (e.g., "Schedule parent meeting", "Enroll in remedial programme").
6. The risk table is filterable by class, stream, and risk level.
7. Risk profiles are refreshed nightly by a scheduled cron job; a manual refresh is also available.
8. Teachers only see learners in their assigned classes; admins see all learners.

---

## Phase 2 — Intelligence Expansion

### Requirement 6: Career Guidance Engine

**User Story:** As a parent or teacher, I want the system to suggest career paths for a learner based on their CBC performance so that pathway selection is informed by evidence.

#### Acceptance Criteria

1. The learner's CBC pathway prediction page (existing) is extended with a "Career Guidance" section.
2. Suggested careers are drawn from the learner's strongest CBC cluster (STEM, Social Sciences, Arts & Sports).
3. At least 3–5 career suggestions are shown with brief descriptions.
4. The system uses the existing deterministic pathway engine — no LLM required for this feature.
5. Suggestions update automatically when new assessment results are entered.

---

### Requirement 7: Fee Collection Prediction

**User Story:** As a finance officer or school owner, I want to see an estimate of expected fee collection for the current week and term so that I can plan cash flow.

#### Acceptance Criteria

1. A "Fee Forecast" widget is displayed on the finance dashboard.
2. The forecast shows: weekly estimate (KES), term estimate (KES), and a confidence score (%).
3. The forecast is based on historical payment velocity (rolling 4-week average) and current outstanding balances.
4. Factors used in the calculation are listed transparently (e.g., "Based on 4-week payment trend and KES 1.2M outstanding").
5. A list of the top 10 highest-balance learners is shown alongside the forecast.
6. The forecast is purely deterministic — no LLM call required.
7. Forecast is refreshed daily; last-computed timestamp is displayed.

---

### Requirement 8: Attendance Intelligence

**User Story:** As a school administrator, I want to see attendance trend analysis — including which days have low attendance and which classes have chronic absenteeism — so that I can address root causes rather than just view raw percentages.

#### Acceptance Criteria

1. An "Attendance Trends" panel is available on the attendance section.
2. The panel shows: day-of-week attendance patterns, class-level absenteeism ranking, and post-midterm attendance dip detection.
3. Natural-language trend descriptions are generated (e.g., "Mondays consistently show 12% lower attendance than the school average").
4. Classes with attendance below 80% over the last 30 days are highlighted with a warning.
5. Data covers the current term; a toggle allows viewing the previous term for comparison.
6. Narrative descriptions are generated deterministically from computed trend data, no LLM needed.

---

### Requirement 9: Communication Hub — Translation

**User Story:** As a teacher or admin, I want to translate school notices and parent messages into Kiswahili or Somali in one click so that I can communicate effectively with parents in Isiolo, Garissa, and Marsabit.

#### Acceptance Criteria

1. A "Translate" button appears on the message drafting modal and the noticeboard compose screen.
2. Supported target languages: English, Kiswahili, Somali.
3. Translation is performed via the AI bridge (LLM).
4. The translated text appears in a side-by-side or tabbed view so the original is not lost.
5. The user can edit the translation before sending.
6. If translation fails, an inline error is shown and the original text is preserved.

---

## Phase 3 — Platform Signature Features

### Requirement 10: School Health Score™

**User Story:** As a school owner or principal, I want to see a single score (0–100) representing the overall health of my school — with component breakdowns — so that I can benchmark performance over time.

#### Acceptance Criteria

1. A "School Health Score" widget is displayed on the principal dashboard.
2. The score is computed from five weighted components: Academic (30%), Finance (25%), Attendance (20%), Staff (15%), Discipline (10%).
3. Each component shows its individual score out of 100 alongside the overall composite score.
4. A one-sentence AI recommendation targets the lowest-scoring component.
5. A 30-day trend chart shows how the overall score has changed.
6. Scores are computed nightly by a cron job and persisted to `SchoolHealthScore`.
7. The score is school-specific — cross-school comparisons are not exposed.

---

### Requirement 11: AI School Intelligence Assistant

**User Story:** As a principal or admin, I want to ask the system natural-language questions about my school — like "who are the top 20 fee defaulters?" or "which learners are at risk?" — and receive accurate answers from live data instantly.

#### Acceptance Criteria

1. A floating AI assistant button is visible on all pages of the system (for admin and principal roles).
2. The assistant responds to at least the following intents: fee defaulters, at-risk learners, worst-performing class (overall or per subject), attendance summary, and "what should I focus on today?".
3. Structured intents are answered by deterministic queries — no LLM call — with response time under 500ms.
4. Open-ended questions fall back to an LLM that receives a live data context block.
5. Responses are streamed to the UI via Server-Sent Events for perceived responsiveness.
6. The last 5 turns of conversation are retained as context for follow-up questions within a session.
7. Pre-built suggestion chips (common questions) are shown above the input to guide users.
8. The assistant is only available to users with Admin or Principal roles.
9. No personally identifiable data beyond what is already visible to the user's role is exposed.

---

## Cross-Cutting Requirements

### Security and Access Control

1. All AI endpoints require valid JWT authentication.
2. `schoolId` is always taken from the authenticated user's token — client-supplied school IDs are rejected.
3. Teachers are restricted to data from their assigned classes; admins have school-wide access.
4. Generated content is stored with `createdBy` (userId) and `schoolId` for full audit trail.
5. LLM prompts must not contain passwords, API keys, or secrets from the database.

### Graceful Degradation

1. Every LLM-powered feature must have a deterministic or template-based fallback.
2. If `AI_API_KEY` is not configured, the system continues to function using deterministic outputs.
3. LLM errors must not surface raw error messages to users — show a friendly fallback instead.

### Performance

1. Dashboard widgets (Daily Brief, Health Score) must load within 2 seconds using cached data.
2. Report comment generation must complete within 10 seconds.
3. NL assistant structured-intent responses must complete within 500ms.
4. LLM-backed responses must complete within 15 seconds; longer responses use SSE streaming.

### Observability

1. All LLM calls must log: provider, model, prompt token count, completion token count, latency, and success/failure.
2. Fallback activations must be logged at `info` level to track how often LLM is unavailable.
3. Token usage is stored in `AIGeneratedContent.tokensUsed` for cost monitoring.
