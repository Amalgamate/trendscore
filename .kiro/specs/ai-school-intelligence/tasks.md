# AI School Intelligence Platform — Tasks

## Priority 0: Wire Intelligence Engine to Real Data

The frontend Intelligence Engine (`src/services/intelligence/`) has complete architecture and working UI widgets but every analyzer returns hardcoded mock numbers. These tasks replace the mock `fetch` methods with real API calls against existing and new backend endpoints. No new UI, no LLM calls, no new Prisma models.

---

- [ ] 1. Backend: Add `GET /api/dashboard/intelligence-summary` endpoint
  - Add handler `getIntelligenceSummary` to `server/src/controllers/dashboard.controller.ts`
  - This single endpoint consolidates all data the four analyzers need so they make one API call instead of four
  - Reuse the already-computed `buildSnapshot()` from `insights.service.ts` — do not re-query
  - Response shape (all fields drawn from existing Prisma queries, no new queries needed):
    ```json
    {
      "academics": {
        "averagePercentage": 72,
        "assessmentCompletionRate": 0.81,
        "totalLearners": 312,
        "learnersBelowExpectations": 48,
        "ratingDistribution": { "EE": 90, "ME": 130, "AE": 60, "BE": 32 },
        "subjectBreakdown": [
          { "subject": "Mathematics", "bePct": 38, "avgPct": 61, "totalAssessed": 312 }
        ],
        "termHistory": [
          { "period": "2025 Term 1", "avgPct": 68 },
          { "period": "2025 Term 2", "avgPct": 71 }
        ],
        "pendingDraftCount": 4
      },
      "fees": {
        "totalBilled": 4800000,
        "totalCollected": 3100000,
        "totalOutstanding": 1700000,
        "collectionRate": 0.646,
        "overdueCount": 22,
        "overpaidCount": 3,
        "monthlyHistory": [
          { "month": "Apr 2025", "collected": 1100000, "billed": 1600000, "rate": 0.688 }
        ]
      },
      "attendance": {
        "presentToday": 290,
        "absentToday": 22,
        "lateToday": 8,
        "totalExpected": 312,
        "todayRate": 0.929,
        "weeklyHistory": [
          { "week": "2025-W18", "avgRate": 0.91 }
        ],
        "dailyBreakdown": [
          { "dayOfWeek": "Monday", "avgRate": 0.93 },
          { "dayOfWeek": "Friday", "avgRate": 0.88 }
        ]
      },
      "risk": {
        "atRiskLearners": [
          {
            "learnerId": "abc123",
            "name": "Brian Otieno",
            "grade": "Grade 8",
            "stream": "8A",
            "attendanceRate": 0.71,
            "avgPercentage": 43,
            "feeBalance": 8500,
            "riskFactors": ["low_attendance", "declining_academics", "fee_balance"]
          }
        ],
        "distribution": { "critical": 3, "high": 11, "medium": 28, "total": 312 }
      }
    }
    ```
  - Role access: SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
  - Rate limit: 30 req/min (match `/dashboard/insights`)
  - Attendance `weeklyHistory`: last 9 weeks, one `avgRate` per week using `prisma.attendance.groupBy`
  - Attendance `dailyBreakdown`: aggregate by day-of-week over last 30 days
  - Risk `atRiskLearners`: learners where (attendance < 80% in last 30 days) OR (latest summative avg < 50%) — reuse the logic already in `getTeacherLearnerRiskItems()` in `dashboard.controller.ts` but school-wide, capped at 50 learners sorted by severity
  - Fee `monthlyHistory`: group `FeePayment` by calendar month, last 3 months — use `prisma.$queryRaw` matching the pattern already used in the secondary dashboard
  - Register route in `server/src/routes/dashboard.routes.ts` with `requireRole` guard
  - _No new Prisma models. No LLM calls._

- [ ] 2. Frontend: Add `getIntelligenceSummary` to `src/services/api/dashboard.api.js`
  - Add one method: `getIntelligenceSummary: async () => fetchWithAuth('/dashboard/intelligence-summary')`
  - No other changes to this file
  - _Depends on: Task 1_

- [ ] 3. Frontend: Replace mock data in `AcademicTrendAnalyzer.js`
  - File: `src/services/intelligence/analyzers/AcademicTrendAnalyzer.js`
  - Replace `fetchAcademicData()` body — delete all hardcoded arrays and numbers
  - Import `dashboardAPI` from `../../api/dashboard.api`
  - Call `dashboardAPI.getIntelligenceSummary()` and destructure `academics`
  - Map the API response to the shape `analyzeTrends()` and `analyzeSubjects()` already expect:
    - `averageGrade` ← `academics.averagePercentage / 25` (convert 0–100 to 0–4 scale to preserve existing trend calculation logic)
    - `assessmentCompletion` ← `academics.assessmentCompletionRate`
    - `learnersBelowAverage` ← `academics.learnersBelowExpectations`
    - `totalLearners` ← `academics.totalLearners`
    - `assessmentHistory` ← map `academics.termHistory` to `{ week: period, avg: avgPct/25, completed: assessmentCompletionRate }`
    - `subjectPerformance` ← map `academics.subjectBreakdown` to `{ subject, avgGrade: avgPct/25, completion: 1 - bePct/100, trend: 0 }`
    - `gradeDistribution` ← map `ratingDistribution` to `{ A: EE, B: ME, C: AE, D: BE, E: 0 }`
  - Remove `Math.random()` from `generatePredictions()` — replace the random jitter with a fixed delta of `0` (projection = currentGrade, no stochastic noise)
  - Cache: the engine's existing 30-minute in-memory cache handles deduplication — do not add a second cache layer inside the analyzer
  - Add a `_cachedData` property so repeated `analyzeTrends()` calls within the same engine cycle reuse the already-fetched payload (avoid N API calls per `getInsights()` call)
  - _Depends on: Task 2_

- [ ] 4. Frontend: Replace mock data in `FeeCollectionForecaster.js`
  - File: `src/services/intelligence/analyzers/FeeCollectionForecaster.js`
  - Replace `fetchFeeData()` body — delete all hardcoded KES amounts and rates
  - Import `dashboardAPI` and call `getIntelligenceSummary()`, destructure `fees`
  - Map response:
    - `totalExpected` ← `fees.totalBilled`
    - `totalCollected` ← `fees.totalCollected`
    - `outstanding` ← `fees.totalOutstanding`
    - `collectionRate` ← `fees.collectionRate`
    - `daysInTerm` ← computed as `Math.max(1, fees.monthlyHistory.length * 30)` (proxy until a term-config endpoint is available)
    - `monthlyHistory` ← map `fees.monthlyHistory` to `{ month, collected, expected: billed, rate }`
  - Fix `generateForecast()`: the hardcoded `1667000` monthly expected figure must be replaced with `Math.round(totalExpected / Math.max(1, monthlyHistory.length))`
  - Fix `generatePredictions()`: the hardcoded `5000000` term total must be replaced with `totalExpected`
  - Add `_cachedData` property (same pattern as Task 3)
  - _Depends on: Task 2_

- [ ] 5. Frontend: Replace mock data in `AttendanceAnomalyDetector.js`
  - File: `src/services/intelligence/analyzers/AttendanceAnomalyDetector.js`
  - Replace `fetchAttendanceData()` body — delete all hardcoded attendance records
  - Import `dashboardAPI` and call `getIntelligenceSummary()`, destructure `attendance`
  - Map response:
    - `presentToday` ← `attendance.presentToday`
    - `totalExpected` ← `attendance.totalExpected`
    - `daysPresent` ← `attendance.presentToday` (today's value; full cumulative not available without new query)
    - `daysAbsent` ← `attendance.absentToday`
    - `dailyData` ← map `attendance.dailyBreakdown` to `{ date: dayOfWeek, present: Math.round(avgRate * totalExpected), absent: Math.round((1-avgRate) * totalExpected), rate: avgRate }`
    - `weeklyHistory` ← map `attendance.weeklyHistory` to `{ week, avgRate }`
  - Ensure `analyzePatterns()` guards against `dailyRates` array length < 5 before accessing index 4
  - Add `_cachedData` property (same pattern as Task 3)
  - _Depends on: Task 2_

- [ ] 6. Frontend: Replace mock data in `RiskDetectionAnalyzer.js`
  - File: `src/services/intelligence/analyzers/RiskDetectionAnalyzer.js`
  - Replace `fetchLearnerData()` body — delete the three hardcoded learner objects
  - Import `dashboardAPI` and call `getIntelligenceSummary()`, destructure `risk`
  - Map `risk.atRiskLearners` array to the `learners` shape `calculateRiskFactors()` expects:
    - `id` ← `learnerId`
    - `name` ← `name`
    - `attendanceRate` ← `attendanceRate`
    - `assessmentRate` ← `1` (not available per-learner yet; neutral value preserves scoring logic)
    - `avgGrade` ← `avgPercentage / 25` (convert 0–100 % to 0–4 scale)
    - `outstandingFees` ← `feeBalance`
    - `behaviorIncidents` ← `0` (not available yet; neutral value)
    - `trendAttendance` ← `0` (trend not available per-learner yet; neutral)
    - `trendAcademics` ← `0` (same)
  - Also store `risk.distribution` directly so `analyzeRiskDistribution()` can be bypassed — if the API already provides counts (`critical`, `high`, `medium`, `total`), return them directly from the analyze method instead of recomputing from the mapped learner list (the API set is capped at 50 learners, so recomputing from it would undercount)
  - Add `_cachedData` property (same pattern as Task 3)
  - _Depends on: Task 2_

- [ ] 7. Frontend: Share the API fetch across analyzers — add `IntelligenceDataService`
  - Create `src/services/intelligence/IntelligenceDataService.js`
  - This module owns exactly one `getIntelligenceSummary()` call per engine refresh cycle
  - Expose a singleton with a `fetchSummary(forceRefresh)` method that:
    - Returns cached payload if age < 5 minutes and `forceRefresh` is false
    - Otherwise calls `dashboardAPI.getIntelligenceSummary()` and caches the result
  - Update `AcademicTrendAnalyzer`, `FeeCollectionForecaster`, `AttendanceAnomalyDetector`, `RiskDetectionAnalyzer` to import and call `intelligenceDataService.fetchSummary()` instead of each calling `dashboardAPI` directly
  - This eliminates 4 redundant API calls each time `IntelligenceEngine.getInsights()` runs its `Promise.all`
  - _Depends on: Tasks 3, 4, 5, 6_

- [ ] 8. Frontend: Add loading, empty, and error states to all five widgets
  - Files: `AIInsights.jsx`, `AcademicInsights.jsx`, `RiskAlerts.jsx`, `FeeCollectionForecast.jsx`, `AttendanceAnomalies.jsx`
  - `AIInsights.jsx` already has loading and error states — verify they still work with real data; no visual changes
  - `RiskAlerts.jsx` already has a loading skeleton — add an explicit error state: if `insights` is null after load, show a small error message with a retry button rather than `return null`
  - `AcademicInsights.jsx`: add loading skeleton (3 rows of `animate-pulse` bars matching the existing card layout) and error state
  - `FeeCollectionForecast.jsx`: add loading skeleton and error state
  - `AttendanceAnomalies.jsx`: add loading skeleton and error state
  - Empty state: if the API returns an empty `atRiskLearners` array, `RiskAlerts` should show "No learners flagged at risk" rather than the empty alert list
  - Empty state: if `academics.termHistory` has fewer than 2 entries, `AcademicInsights` should show "Not enough term data yet" rather than rendering the trend chart with a single point
  - Do not change any colours, layout, font sizes, or component structure — only add the missing states
  - _Depends on: Tasks 3, 4, 5, 6_

- [ ] 9. Frontend: Reduce `IntelligenceEngine` cache timeout and add `forceRefresh` passthrough
  - File: `src/services/intelligence/IntelligenceEngine.js`
  - Change `cacheTimeout` in `ENGINE_CONFIG` from `1800000` (30 min) to `300000` (5 min) to match the backend Redis TTL
  - Ensure the `options.forceRefresh` flag passed to `getInsights()` is forwarded to `IntelligenceDataService.fetchSummary(forceRefresh)` so a manual refresh from a widget bypasses both the engine cache and the data service cache
  - No other changes to `IntelligenceEngine.js`
  - _Depends on: Task 7_

---

## Phase 1: Core AI Intelligence (LLM-Powered Features)

These tasks depend on Priority 0 being complete. They add LLM-generated narrative on top of the real data already flowing through the engine.

- [ ] 10. Database: Add `AIGeneratedContent` Prisma model and run migration
  - Add `AIGeneratedContent` model to `server/prisma/schema.prisma` with fields: id, type (enum AIContentType), entityId, entityType, content, prompt, provider, tokensUsed, createdBy, createdAt, archived
  - Add `AIContentType` enum: REPORT_COMMENT, PARENT_MESSAGE, ACADEMIC_ANALYSIS, DAILY_BRIEF, RISK_ANALYSIS, CAREER_GUIDANCE, COMMUNICATION_DRAFT, NL_ANSWER
  - Create and apply Prisma migration
  - _Requirements: cross-cutting security requirement 3_

- [ ] 11. Backend: Build `report-comments.service.ts`
  - Implement `ReportCommentsService` class with `generateComment(input)`, `buildPrompt()`, and `buildFallbackComment()` methods
  - Fetch learner metrics: term average, achievement level, attendance rate, strongest/weakest subject
  - Call `aiBridgeService.generateCompletion()` with CBC-aligned system prompt
  - Fallback to deterministic comment (reuse `aiAssistantService.generateTeacherFeedback()`) if API key missing or LLM fails
  - Persist result to `AIGeneratedContent`
  - _Requirements: Requirement 1 — all acceptance criteria_
  - _Depends on: Task 10_

- [ ] 12. Backend: Build `daily-brief.service.ts`
  - Implement `DailyBriefService` with `generateBrief(principalName)` method
  - Call existing `generateInsights()` for structured metrics — do not re-query the database
  - Build colour-coded bullets array from insight severities
  - Call `aiBridgeService.generateCompletion()` for prose summary
  - Cache result in Redis with 5-minute TTL
  - Deterministic fallback: if LLM unavailable, format bullets directly from the insights payload into a plain-text summary
  - _Requirements: Requirement 4 — all acceptance criteria_

- [ ] 13. Backend: Build `learner-risk.service.ts`
  - Implement `LearnerRiskService` with `getSchoolRiskSummary()` and `getLearnerRiskProfile(learnerId)` methods
  - Compute four risk dimensions: academic (40%), attendance (30%), financial (20%), discipline (10%)
  - Reuse the attendance and academic queries already in `getTeacherLearnerRiskItems()` — do not duplicate Prisma queries
  - Produce composite `riskScore` and `riskLevel`: LOW / MEDIUM / HIGH / CRITICAL
  - Generate narrative and recommended actions (deterministic templates — no LLM)
  - _Requirements: Requirement 5 — all acceptance criteria_

- [ ] 14. Backend: Build `academic-analysis.service.ts`
  - Implement `AcademicAnalysisService` with `analyzeClass(input)` and `analyzeSchool(term, year)` methods
  - Aggregate: class average, delta from prior term, per-subject BE/AE/ME/EE breakdown, weakest strand
  - Call `aiBridgeService.generateCompletion()` for narrative analysis (deterministic fallback if unavailable)
  - Cache per `(classId, term, academicYear)` with 5-minute TTL using `redisCacheService`
  - Return `{ status: 'insufficient_data' }` if fewer than 5 learners have results
  - _Requirements: Requirement 3 — all acceptance criteria_

- [ ] 15. Backend: Extend `ai.controller.ts` with Phase 1 routes
  - Add handlers: `generateReportComment`, `getDailyBrief`, `getRiskSummary`, `getLearnerRisk`, `getClassAnalysis`, `getSchoolAnalysis`
  - Log all LLM calls with provider, token counts, and latency using the existing `logger`
  - _Requirements: all Phase 1 requirements_
  - _Depends on: Tasks 11, 12, 13, 14_

- [ ] 16. Backend: Register Phase 1 routes in `ai.routes.ts`
  - `POST /api/ai/report-comments/:learnerId`
  - `GET  /api/ai/daily-brief`
  - `GET  /api/ai/risk-summary`
  - `GET  /api/ai/risk/:learnerId`
  - `GET  /api/ai/class-analysis/:classId`
  - `GET  /api/ai/school-analysis`
  - All routes require `authenticate` middleware (already applied by `index.ts` parent mount)
  - _Depends on: Task 15_

- [ ] 17. Frontend: Build `DailyBriefWidget` component
  - Create `src/components/ai/DailyBriefWidget.jsx`
  - Show greeting, prose summary, colour-coded bullet list (green/amber/red), recommendation banner
  - Include manual Refresh button
  - Show skeleton loader while fetching; graceful fallback if AI is unavailable
  - Mount widget on the main dashboard home page
  - _Requirements: Requirement 4_
  - _Depends on: Task 16_

- [ ] 18. Frontend: Build `RiskDashboard` page and `LearnerRiskBadge` component
  - Create `src/components/ai/RiskDashboard.jsx` with summary cards (Critical / High / Medium / Low counts)
  - Create filterable `RiskTable` with columns: name, grade, stream, risk badge, dimensions, action button
  - Create `LearnerRiskDrawer` side panel with score gauge, dimension bars, recommended actions
  - Create `LearnerRiskBadge` for inline use on learner list rows
  - Wire to `GET /api/ai/risk-summary`
  - _Requirements: Requirement 5_
  - _Depends on: Task 16_

- [ ] 19. Frontend: Build `ReportCommentGenerator` component
  - Create `src/components/ai/ReportCommentGenerator.jsx`
  - Render "Generate AI Comment" button, loading state, editable text area, Regenerate, and Save buttons
  - Integrate into the existing report card / assessment result view in the assessments module
  - Wire to `POST /api/ai/report-comments/:learnerId`
  - _Requirements: Requirement 1_
  - _Depends on: Task 16_

- [ ] 20. Frontend: Build `AcademicAnalysisPanel` component
  - Create `src/components/ai/AcademicAnalysisPanel.jsx`
  - Display: overall average, delta badge, subject breakdown table, narrative text
  - Add "Analyze Results" button to the class assessment summary page
  - Wire to `GET /api/ai/class-analysis/:classId`
  - _Requirements: Requirement 3_
  - _Depends on: Task 16_

---

## Phase 2: Intelligence Expansion

- [ ] 21. Backend: Extend communication drafting with multi-channel and translation
  - Add `draftMessage(req)` to extend `communication.controller.ts` (route through `ai-bridge.service.ts`, not raw `fetch`)
  - Add `translateMessage(req)` supporting `en`, `sw`, `so`
  - _Requirements: Requirements 2, 9_

- [ ] 22. Backend: Add translation and enhanced draft routes
  - `POST /api/ai/draft-message`
  - `POST /api/ai/translate` — validate `targetLanguage` against allowlist `['en', 'sw', 'so']`
  - _Depends on: Task 21_

- [ ] 23. Frontend: Extend `AIDraftModal` with channel selector and translation
  - Add channel tabs: Email / SMS / WhatsApp
  - Add language selector: English / Kiswahili / Somali
  - _Requirements: Requirements 2, 9_
  - _Depends on: Task 22_

- [ ] 24. Backend: Build `fee-prediction.service.ts`
  - Implement `FeePredictionService` with `forecast()` method
  - Rolling 4-week payment velocity from `FeePayment` records
  - Purely deterministic — no LLM
  - _Requirements: Requirement 7_

- [ ] 25. Backend: Build `attendance-intelligence.service.ts`
  - Day-of-week patterns, class absenteeism ranking, post-midterm dip detection
  - Deterministic narrative templates — no LLM
  - _Requirements: Requirement 8_

- [ ] 26. Backend: Add Phase 2 routes
  - `GET /api/ai/fee-forecast`
  - `GET /api/ai/attendance-trends`
  - _Depends on: Tasks 24, 25_

---

## Phase 3: Platform Signature Features

- [ ] 27. Database: Add `SchoolHealthScore` and `AIConversationTurn` Prisma models
  - `SchoolHealthScore`: id, score, academicScore, financeScore, attendanceScore, staffScore, disciplineScore, aiRecommendation, computedAt
  - `AIConversationTurn`: id, userId, question, answer, intent, createdAt
  - _Requirements: Requirements 10, 11_

- [ ] 28. Backend: Build `school-health-score.service.ts`
  - Weighted composite score (Academic 30%, Finance 25%, Attendance 20%, Staff 15%, Discipline 10%)
  - LLM one-sentence recommendation for lowest component; deterministic fallback
  - Persist to `SchoolHealthScore`
  - _Requirements: Requirement 10_
  - _Depends on: Task 27_

- [ ] 29. Backend: Add Health Score cron jobs in `cron-worker.ts`
  - `0 1 * * *` — compute and persist `SchoolHealthScore`
  - `0 6 * * 1-5` — warm daily brief cache
  - _Depends on: Task 28_

- [ ] 30. Backend: Add `GET /api/ai/health-score` route
  - Returns current score + 30-day history
  - _Depends on: Tasks 28, 29_

- [ ] 31. Frontend: Build `HealthScoreWidget`
  - Overall score, five component bars, AI recommendation sentence, 30-day sparkline
  - Mount on principal dashboard
  - _Requirements: Requirement 10_
  - _Depends on: Task 30_

- [ ] 32. Backend: Build `nl-assistant.service.ts`
  - Deterministic intent classifier: fee_defaulters, at_risk_learners, worst_performing_class, attendance_summary, daily_focus
  - Structured query handlers for each intent (no LLM, < 500ms)
  - LLM fallback with live data context block for unclassified intents
  - SSE streaming for LLM responses
  - Persist turns to `AIConversationTurn`
  - _Requirements: Requirement 11_
  - _Depends on: Task 27_

- [ ] 33. Backend: Add `POST /api/ai/assistant` route
  - SSE stream response; restrict to Admin and Principal roles
  - _Depends on: Task 32_

- [ ] 34. Frontend: Build `AIAssistantFloating` global component
  - Fixed-position trigger button (sparkle icon) for Admin/Principal roles
  - Slide-in panel with conversation history, suggestion chips, text input
  - Stream SSE responses token-by-token
  - Register in `App.jsx` outside the router
  - _Requirements: Requirement 11_
  - _Depends on: Task 33_
