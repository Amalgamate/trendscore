# TrendSCORE — AI Architecture Audit Report

**Prepared:** June 2026  
**Scope:** Full audit of existing AI and intelligence capabilities before expanding the AI School Intelligence Platform  
**Directive:** Read-only analysis. No code was modified.

---

## Executive Summary

TrendSCORE has substantially more AI and intelligence capability than it might appear from a surface read. The system has **two independent intelligence layers** — a backend deterministic engine and a frontend JavaScript engine — neither of which is fully wired to the other. There is also a working LLM bridge, a rule-based chatbot, a deterministic risk scorer in the teacher dashboard, a complete CBC pathway prediction engine, and an LLM-powered email drafting feature.

The single most important finding: **the frontend Intelligence Engine (`src/services/intelligence/`) is running entirely on mock/hardcoded data.** It has sophisticated architecture but produces no real output. The backend services are producing real output from live data but are only exposed on 3 API endpoints. Closing this gap is the highest-leverage move before adding any new features.

---

## 1. What Already Exists

### 1.1 Backend AI Services

#### `server/src/services/ai-bridge.service.ts` — LLM Provider Bridge
- **Status:** Fully implemented, production-ready
- **Providers:** Anthropic Claude (primary, `claude-sonnet-4-20250514`) and OpenAI (secondary, `gpt-4o-mini`)
- **Config:** `AI_PROVIDER`, `AI_API_KEY` / `ANTHROPIC_API_KEY`, `AI_BASE_URL` env vars
- **Features:**
  - `generateCompletion(prompt, options)` — single entrypoint for all LLM calls
  - `jsonMode` flag adds a system prompt reinforcement for JSON-only responses
  - `temperature`, `maxTokens`, `systemPrompt` all configurable per-call
  - Returns `{ content, usage: { promptTokens, completionTokens, totalTokens }, provider }`
  - Throws `ApiError(500)` when no API key is set — **does not gracefully fall back to deterministic output**
- **Gaps:**
  - No retry logic on rate-limit (429) errors
  - No fallback to deterministic output on failure — error propagates to caller
  - No token usage logging or budgeting
  - Single instance exported (`aiBridgeService`) — no school-level key overrides

---

#### `server/src/services/ai-assistant.service.ts` — Deterministic CBC Intelligence
- **Status:** Fully implemented, used in production (pathway prediction on report cards)
- **Uses LLM:** No — entirely rule-based, zero external API calls
- **Capabilities:**

| Method | Input | Output | Data Source |
|--------|-------|--------|-------------|
| `generateTeacherFeedback(learnerId, term, year)` | Learner ID | String comment (4 bands: EE/ME/AE/BE) | `performanceService.getLearnerPerformanceTrend()` |
| `analyzeLearnerRisk(learnerId)` | Learner ID | String narrative with risk level + interventions | `performanceService.getLearnerPerformanceTrend()` |
| `generatePathwayPrediction(learnerId, term, year)` | Learner ID + term | `{ predictedPathway, confidence, justification, careerRecommendations, growthAreas, clusterBreakdown }` | `prisma.summativeResult` |

- **CBC Cluster Map:** 17 subjects mapped to STEM / SOCIAL / ARTS with exact + partial matching
- **Pathway logic:** averages scores per cluster → highest cluster wins → confidence from gap between top and second cluster (formula: `50 + gap × 1.5`, clamped 50–95%)
- **Career recommendations:** 5 careers per pathway (STEM, Social Sciences, Arts and Sports Science)
- **Growth tips:** 3 tips per pathway
- **Risk logic:** Two dimensions only — percentage score and growth trend. No attendance, no fee balance, no discipline. Risk levels: Low / Medium / High (no "Critical")
- **Teacher feedback:** Produces 2–3 sentences in 4 fixed templates. No subject-specific commentary
- **Gaps:**
  - Risk analysis uses academic trend only — attendance, fees, and discipline not included
  - Teacher feedback is template-based, not personalized to subject strengths/weaknesses
  - `generateTeacherFeedback` does not use `term` or `academicYear` parameters despite accepting them (uses only `getLearnerPerformanceTrend` which aggregates all terms)
  - No `schoolId` scoping — any authenticated user can fetch any learner's data

---

#### `server/src/services/insights.service.ts` — School-Wide Deterministic Insights
- **Status:** Fully implemented, called from dashboard
- **Uses LLM:** No — entirely deterministic
- **Architecture:** `buildSnapshot()` fetches 14+ parallel Prisma aggregates → 5 insight generators each produce `Insight[]` objects → sorted by severity

| Generator | Thresholds | Severity Levels |
|-----------|-----------|-----------------|
| `academicInsights()` | BE% ≥ 25% = critical, ≥ 15% = warning; draft count ≥ 10 = warning; missed exams > 50 = critical | critical, warning, info, positive |
| `financialInsights()` | collection < 50% = critical, < 70% = warning, ≥ 85% = positive | critical, warning, info, positive |
| `attendanceInsights()` | absence ≥ 15% = critical, ≥ 10% = warning, present ≥ 90% = positive | critical, warning, info |
| `staffingInsights()` | ratio > 55 = critical, > 40 = warning, ≤ 30 = positive | critical, warning, positive |
| `operationsInsights()` | enrollment < 50 = info | info |

- **Output type:** `InsightsPayload` with `{ generatedAt, insights[], summary{}, riskDistribution[] }`
- **Summary fields:** `critical`, `warning`, `info`, `positive` counts; `atRiskStudents` (BE count); `collectionEfficiency`; `attendanceRate`; `assessmentCoverage`; `systemAccuracy` (hardcoded 94); `insightsGenerated`
- **Risk distribution:** 4 bands — BE (red), AE (amber), ME (green), EE (purple) — with learner counts
- **Gaps:**
  - No `schoolId` filtering — aggregates across all data in the database (multi-tenancy risk)
  - `insightsGenerated` is a synthetic metric (`totalStudents + assessedClassCount + 100`) — not meaningful
  - `systemAccuracy: 94` is hardcoded — should be removed or derived
  - No caching — runs all Prisma queries on every request
  - `totalMissedExams` calculation is inaccurate (subtracts total result rows from active students rather than checking per-student per-test)

---

#### `server/src/services/performance.service.ts` — Cross-Term Performance
- **Status:** Fully implemented
- **Uses LLM:** No
- **Capabilities:**
  - `getLearnerPerformanceTrend(learnerId)` — aggregates `summativeResult` by term/year → computes `growth` (delta from last period) and `status` (STABLE/IMPROVING/DECLINING with ±2% threshold)
  - `getClassPerformanceDistribution(classId, term, year)` — grade distribution (A/B/C/D/E) and average for a class
- **Used by:** `ai-assistant.service.ts` for feedback and risk analysis
- **Gaps:**
  - Excludes `assessmentStatusCode` records correctly (administrative codes like ABSENT don't inflate averages)
  - No `schoolId` scoping
  - `getClassPerformanceDistribution` uses A/B/C/D/E grades — mismatched with CBC EE/ME/AE/BE grading used elsewhere

---

#### `server/src/services/pathway-recommendation.service.ts` — Senior School Pathway Recommendation
- **Status:** Fully implemented for Grade 7–9 learners
- **Uses LLM:** Calls `aiAssistantService.generatePathwayPrediction()` (deterministic, not LLM)
- **Capabilities:** Maps CBC cluster prediction → senior secondary pathway code (STEM / SOCIAL_SCIENCES / ARTS_SPORTS) → fetches core + pathway learning areas → suggests subjects using `minSelect`/`maxSelect` constraints
- **Used by:** `pathwayRecommendation.controller.ts` → `GET /api/pathways/recommendation/:learnerId`

---

#### `server/src/controllers/chatbot.controller.ts` — Rule-Based School Assistant
- **Status:** Fully implemented, deployed at `POST /api/chat/bot`
- **Uses LLM:** No — entirely rule-based keyword intent classification
- **Architecture:** `detectIntent(msg)` uses regex → `buildResponse(intent, role, name, stats)` returns role-aware markdown
- **Intents handled:** `fees`, `attendance`, `grades`, `timetable`, `hr`, `learners`, `notices`, `greeting`, `thanks`, `bye`, `general`
- **Role awareness:** Responses differ for PARENT, TEACHER, ADMIN/HEAD_TEACHER/ACCOUNTANT/SUPER_ADMIN
- **Live data fetched per request:** fee totals (role-gated), learner count, school name, today's attendance rate
- **Frontend:** `ChatPanel.jsx` has both an "Inbox" tab and an "AI Chatbot" tab that calls `/api/chat/bot`
- **Gaps:**
  - Intent detection is keyword-only — no semantic understanding
  - Cannot answer multi-part or contextual questions
  - No conversation history or session memory
  - Stats fetched on every request even if not used by that intent

---

#### Communication AI Drafting — `communication.controller.ts`
- **Status:** Fully implemented, in production
- **Uses LLM:** Yes — **OpenAI only** (not routed through `ai-bridge.service.ts`)
- **Endpoint:** `POST /api/communication/email/draft`
- **Roles:** SUPER_ADMIN, ADMIN only
- **Rate limit:** 10 requests per minute
- **System prompt:** `"You write safe, parent-friendly school communication emails. Return valid JSON only."`
- **User prompt fields:** school name, template type, audience, tone, goal, existing heading, existing body
- **Returns:** `{ heading, body }` — sanitized HTML body (scripts/styles/iframes stripped), heading truncated to 140 chars, body to 5000 chars
- **Config:** AI settings stored encrypted in `CommunicationConfig.emailTemplates.__ai` (JSON blob). Falls back to `OPENAI_API_KEY` / `AI_API_KEY` env vars. Provider hardcoded to `openai` — does not use `ai-bridge.service.ts`
- **Important gap:** This is a **separate AI implementation** from `ai-bridge.service.ts`. OpenAI key configured in Communication Settings does not affect the bridge service, and vice versa.

---

### 1.2 Backend API Endpoints (AI-Related)

| Route | Method | Handler | Auth | Description |
|-------|--------|---------|------|-------------|
| `/api/ai/feedback/:learnerId` | GET | `aiController.generateFeedback` | authenticated | Deterministic teacher comment (4 templates) |
| `/api/ai/analyze-risk/:learnerId` | GET | `aiController.analyzeRisk` | authenticated | Deterministic risk string (academic only) |
| `/api/ai/trend/:learnerId` | GET | `aiController.getTrend` | authenticated | Performance trend array |
| `/api/chat/bot` | POST | `chatbotController.chat` | authenticated | Rule-based chatbot, 10 req/10s limit |
| `/api/communication/email/draft` | POST | `draftEmailTemplate` | ADMIN/SUPER_ADMIN, 10 req/min | LLM email draft via OpenAI |
| `/api/pathways/recommendation/:learnerId` | GET | pathway recommendation | authenticated, SECONDARY only | CBC pathway + subject suggestions |

**Note:** No dashboard insights endpoint is currently registered as a dedicated AI route. `generateInsights()` is called internally by the dashboard controller.

---

### 1.3 Frontend Intelligence Layer

#### `src/services/intelligence/IntelligenceEngine.js`
- **Status:** Architecture complete, data layer is **entirely mocked**
- **Architecture:** Singleton with 30-minute in-memory cache. Orchestrates 4 analyzers + NLG. Provides `getInsights()`, `getRiskInsights()`, `getFinancialInsights()`, `getAcademicInsights()`, `getLearnerInsights()`
- **Config:** `riskScoringWeights: { attendance: 0.3, academics: 0.35, fees: 0.25, behavior: 0.1 }` — same weights as the design spec

#### Frontend Analyzers — All Use Mock Data

| Analyzer | What It Computes | Data Source |
|----------|-----------------|-------------|
| `RiskDetectionAnalyzer.js` | 4-dimension risk scores per learner (attendance, academics, fees, behavior) with weighted composite | **Hardcoded mock learners** — no API call |
| `AcademicTrendAnalyzer.js` | Grade trends, subject rankings, completion rates, predictions | **Hardcoded mock assessment history** — no API call |
| `FeeCollectionForecaster.js` | Collection rate, monthly trend, forecast, next-month prediction | **Hardcoded 5M KES mock data** — no API call |
| `AttendanceAnomalyDetector.js` | Baseline deviation, anomaly detection, Friday effect, weekly trends | **Hardcoded attendance records** — no API call |
| `NaturalLanguageInsightGenerator.js` | Converts analyzer outputs into English sentences | Consumes outputs from other analyzers — no direct data access |

#### Frontend Widgets Using the Engine

| Widget | Engine Method | Where Used |
|--------|--------------|-----------|
| `AIInsights.jsx` | `engine.getInsights()` | CBCGrading widgets section |
| `AcademicInsights.jsx` | `engine.getAcademicInsights()` | CBCGrading widgets section |
| `RiskAlerts.jsx` | `engine.getRiskInsights()` | CBCGrading widgets section |
| `FeeCollectionForecast.jsx` | `engine.getFinancialInsights()` | CBCGrading widgets section |
| `AttendanceAnomalies.jsx` | `engine.getAcademicInsights()` | CBCGrading widgets section |

All 5 widgets are currently showing **mock data, not real school data**.

#### `ChatPanel.jsx`
- Has a "Chatbot" tab wired to `POST /api/chat/bot` — this one is live and uses real data
- Inbox tab uses real message data

#### Pathway Prediction in Report Cards
- `SummativeReport.jsx` and `TermlyReportTemplate.jsx` both consume `pathwayPrediction` data
- Pathway prediction is fetched during report card generation and embedded as "Page 3"
- This is live and uses real data from `ai-assistant.service.ts`

---

### 1.4 Database Tables Related to AI

There are **no dedicated AI tables** in the current Prisma schema. AI outputs are not persisted. Relevant tables used as data sources:

| Table | Used By |
|-------|---------|
| `SummativeResult` | Pathway prediction, performance trend, class analysis |
| `FormativeAssessment` | Insights (BE/AE/ME/EE counts), subject weakness detection |
| `Attendance` | Insights (today's rates), risk detection (not yet connected), chatbot stats |
| `FeeInvoice` | Insights (collection rate, overdue), chatbot (fee balance) |
| `FeePayment` | Chatbot (collected total) |
| `Learner` | All AI services |
| `User` | Insights (teacher ratio), chatbot |
| `Class` | Insights (coverage) |
| `CommunicationConfig` | AI draft config (stored in `emailTemplates` JSON blob) |
| `Pathway` | Senior pathway recommendation |
| `SubjectCategory` | Senior pathway recommendation |
| `LearningArea` | Pathway recommendation, CBC cluster mapping |

---

## 2. Existing Prompts

### Communication Drafting (OpenAI, `communication.controller.ts`)

**System prompt:**
```
You write safe, parent-friendly school communication emails. Return valid JSON only.
```

**User prompt template:**
```
School: {schoolName}
Template type: {templateType}
Audience: {audience}
Tone: {tone}
Goal: {goal}
[Existing heading: {existingHeading}]
[Existing body: {existingBody}]
Return only JSON with keys "heading" and "body".
The body may use simple email-safe HTML tags only: p, strong, em, ul, ol, li, br.
Do not include scripts, styles, external images, forms, tracking pixels, or placeholders...
```

**Model:** `gpt-4o-mini` (configurable), temperature 0.4, `json_object` response format

### All Other AI Outputs
All other AI outputs (teacher feedback, risk analysis, pathway prediction) are fully deterministic — no prompts, no LLM calls.

---

## 3. What Should Be Reused

These components are solid, production-tested, and should be built upon directly:

### Must Reuse — Backend

| Component | Why |
|-----------|-----|
| `aiBridgeService.generateCompletion()` | Clean unified LLM interface, works with Anthropic + OpenAI, handles JSON mode. All new LLM features should call this, not raw `fetch()` |
| `aiAssistantService.generatePathwayPrediction()` | Correct CBC cluster logic, confidence scoring, career/growth maps. Career guidance feature is built — just needs a frontend page |
| `aiAssistantService.generateTeacherFeedback()` | Good foundation for report card comments — extend with subject detail, don't replace |
| `performanceService.getLearnerPerformanceTrend()` | Cross-term trend aggregation used by multiple features — reuse in daily brief and risk scoring |
| `generateInsights()` from `insights.service.ts` | Already computes the metrics the daily brief needs. Wire it up rather than re-querying the database |
| `chatbotController.detectIntent()` | The intent classifier pattern is exactly what the NL assistant needs. Extract and extend it |
| `getTeacherLearnerRiskItems()` in `dashboard.controller.ts` | This is a real risk query running on live data (attendance < 80%, score < 50%) — it's already implemented in the teacher dashboard. It's the backend equivalent of what `RiskDetectionAnalyzer.js` is trying to do |

### Must Reuse — Frontend

| Component | Why |
|-----------|-----|
| `IntelligenceEngine.js` architecture | Caching logic, `prioritizeAlerts()`, context-aware `getInsights()` API are all correct. Only the data layer (mock fetches) needs replacing |
| `RiskAlerts.jsx`, `AIInsights.jsx`, `AcademicInsights.jsx`, etc. | UI components are well-built. They just need their data source swapped from mock to real API calls |
| `ChatPanel.jsx` chatbot tab | Already deployed, users know it. Upgrade the backend `chatbotController` rather than build a separate UI |
| `NaturalLanguageInsightGenerator.js` | The sentence-building logic is reusable. Once real data flows in, the output will be meaningful |

---

## 4. What Should Be Extended

| Existing Component | Extension Needed |
|-------------------|-----------------|
| `ai-assistant.service.ts` → `analyzeLearnerRisk()` | Add 3 missing dimensions: attendance (30-day rate from `Attendance` table), fee balance (from `FeeInvoice`), discipline. Upgrade from string output to structured `{ riskLevel, riskScore, dimensions, narrative, recommendedActions }` |
| `ai-assistant.service.ts` → `generateTeacherFeedback()` | Optionally pass through `aiBridgeService` when API key is present to generate richer, subject-specific comments. Keep deterministic as fallback |
| `insights.service.ts` | Add `schoolId` parameter and filter all queries — currently aggregates across all schools. Add Redis caching |
| `performance.service.ts` | Add `schoolId` scoping. Fix `getClassPerformanceDistribution` to return EE/ME/AE/BE bands (not A/B/C/D/E) to match the CBC grading model |
| `ai.controller.ts` | Add Phase 1 endpoints: `report-comments`, `daily-brief`, `risk-summary`, `class-analysis`. The file already has the right pattern and error handling — add handlers here |
| `chatbotController.detectIntent()` | Extract into a shared `IntentClassifier` class reusable by both the chatbot and the future NL assistant |
| `IntelligenceEngine.js` `fetchAcademicData()`, `fetchFeeData()`, etc. | Replace mock returns with real API calls to backend endpoints. This alone will activate all 5 frontend widgets |
| `aiBridgeService` | Add retry logic (1 retry on 429), add a deterministic fallback hook, add school-level API key support |
| Communication drafting | Route through `aiBridgeService` instead of raw `fetch()`. Add multi-channel (SMS/WhatsApp) format variants and translation support |

---

## 5. What Should NOT Be Rebuilt

These are already correct and should not be touched:

| Component | Reason |
|-----------|--------|
| `CLUSTER_MAP` in `ai-assistant.service.ts` | CBC subject → cluster mapping is complete and accurate for Kenyan CBC Junior School. Do not rebuild |
| `CAREER_MAP` and `GROWTH_MAP` | Well-structured lookup tables. Add to them, don't replace |
| `deriveConfidence()` algorithm | Mathematically sound gap-based confidence scoring. Reuse as-is |
| `buildJustification()` | Good deterministic narrative builder. Promote it to a shared utility |
| `percentageToLabel()` | Correct CBC band mapping (80/60/40 thresholds). Used across multiple places |
| `generateInsights()` insight generator pattern | The generator-per-category architecture is clean and extensible. Follow the same pattern for new insight types |
| `SEVERITY_ORDER` sort in insights | Correct priority ordering for insight display |
| `sanitizeGeneratedEmailHtml()` in communication controller | Security-critical HTML sanitizer. Do not remove or weaken |
| `extractJsonObject()` in communication controller | Robust JSON extraction that handles markdown-wrapped responses. Promote to a shared utility in `ai-bridge.service.ts` |
| Pathway prediction page in report cards (`TermlyReportTemplate.jsx`) | Already integrated into PDF report generation and working in production |
| ChatPanel chatbot UI | Users are already using it. Improve the backend, not the UI |

---

## 6. Critical Gaps to Address Before Implementing New Features

These are blocking or risk-introducing issues:

### Gap 1: Frontend Intelligence Engine Uses Entirely Mock Data
All 5 CBCGrading widgets (`AIInsights`, `AcademicInsights`, `RiskAlerts`, `FeeCollectionForecast`, `AttendanceAnomalies`) show hardcoded numbers. Replacing `fetchAcademicData()`, `fetchFeeData()`, `fetchLearnerData()`, and `fetchAttendanceData()` with real API calls is the single highest-leverage change.

### Gap 2: No schoolId Scoping in `insights.service.ts`
`generateInsights()` aggregates all schools' data. In a multi-school deployment this is a data leak. Every Prisma query needs `where: { schoolId }` added before this service is safe.

### Gap 3: Two Separate AI Implementations
Communication drafting uses its own raw `fetch()` to OpenAI. All other AI features use `ai-bridge.service.ts`. These should be unified so there is one API key, one config, one logging point.

### Gap 4: `ai-bridge.service.ts` Has No Fallback
When the LLM is unavailable, `generateCompletion()` throws an error. Every new feature that calls it needs to catch the error and produce a deterministic fallback. Consider adding a `generateCompletionWithFallback(prompt, options, fallbackFn)` helper.

### Gap 5: No AI Output Persistence
No generated content is stored. Teachers cannot see previously generated report comments. There is no audit trail for AI-generated text. The `AIGeneratedContent` model proposed in the design spec is needed.

### Gap 6: Risk Analysis Covers Only Academic Dimension
`analyzeLearnerRisk()` looks at percentage score and growth trend only. The teacher dashboard's `getTeacherLearnerRiskItems()` already computes attendance risk separately (< 80%) and performance risk (< 50%) from live data. These two services should be merged.

---

## 7. Architecture Summary Diagram

```
Current State:

Frontend                              Backend
────────────────────────────────────  ────────────────────────────────────
IntelligenceEngine.js                 ai-bridge.service.ts
  ├─ RiskDetectionAnalyzer            (LLM bridge — unused by most features)
  │    └─ MOCK DATA ⚠️               
  ├─ AcademicTrendAnalyzer            ai-assistant.service.ts
  │    └─ MOCK DATA ⚠️                (CBC logic, pathway, feedback — LIVE)
  ├─ FeeCollectionForecaster                  │
  │    └─ MOCK DATA ⚠️                        └─ called by ai.controller.ts
  ├─ AttendanceAnomalyDetector                          │
  │    └─ MOCK DATA ⚠️               GET /api/ai/feedback/:learnerId
  └─ NaturalLanguageInsightGenerator GET /api/ai/analyze-risk/:learnerId
       └─ consumes above ⚠️          GET /api/ai/trend/:learnerId
                                     
ChatPanel.jsx ──────────────────────► POST /api/chat/bot
  └─ AI tab (Chatbot)                 (chatbotController — LIVE, rule-based)

Communication module ───────────────► POST /api/communication/email/draft
  └─ AIDraftModal                     (raw OpenAI fetch — LIVE, separate impl)

SummativeReport.jsx ────────────────► pathway prediction embedded in report
  └─ pathwayPrediction data           (ai-assistant.service.ts — LIVE)

Dashboard ──────────────────────────► generateInsights() called internally
  └─ (no dedicated AI widget yet)     (insights.service.ts — LIVE, no schoolId scope ⚠️)
```

---

## 8. Recommended First Actions (Before Writing New Features)

1. **Add `schoolId` scoping to `insights.service.ts`** — security fix, must happen before any multi-school deployment
2. **Wire the frontend Intelligence Engine to real API endpoints** — activates 5 existing widgets for free
3. **Unify communication AI under `ai-bridge.service.ts`** — eliminates dual-key configuration confusion  
4. **Add `generateCompletionWithFallback()` to `ai-bridge.service.ts`** — makes all LLM features resilient
5. **Promote `extractJsonObject()` and `sanitizeGeneratedEmailHtml()` to shared utilities** — both needed by multiple upcoming features
6. **Add `AIGeneratedContent` Prisma model** — prerequisite for report comments, daily brief persistence, audit trail

Only after these 6 actions should new features (daily brief, report comments, NL assistant) be implemented.
