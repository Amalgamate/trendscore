# AI School Intelligence Platform — Technical Design

## Overview

TrendSCORE currently has three AI-adjacent services:

- `ai-assistant.service.ts` — rule-based CBC pathway prediction and risk text generation (no LLM)
- `ai-bridge.service.ts` — unified Anthropic / OpenAI HTTP wrapper
- `insights.service.ts` — deterministic data-driven insights engine (no LLM)

The AI School Intelligence Platform extends these foundations into a full intelligence layer covering academics, finance, attendance, communications, and a natural-language assistant — making TrendSCORE a School Intelligence Platform rather than just a School Management System.

---

## High-Level Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind + Zustand)                          │
│                                                                       │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ Dashboard     │  │ Academic       │  │ AI Intelligence          │  │
│  │ Daily Brief   │  │ Insights       │  │ Assistant (Floating)     │  │
│  └──────────────┘  └───────────────┘  └─────────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ Report Card   │  │ Fee Collection │  │ Communication Hub        │  │
│  │ Comments      │  │ Assistant      │  │ (multi-channel + translate)│
│  └──────────────┘  └───────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST + WebSocket (Socket.io)
┌────────────────────────────▼────────────────────────────────────────┐
│  Node.js / Express Backend (TypeScript + Prisma)                     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AI Orchestrator Layer  (NEW)                                │    │
│  │                                                               │    │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │    │
│  │  │ AIBridgeService   │  │ InsightsService (existing)        │ │    │
│  │  │ (existing)        │  │ enhanced with LLM narration       │ │    │
│  │  └──────────────────┘  └──────────────────────────────────┘ │    │
│  │                                                               │    │
│  │  ┌─────────────────────────────────────────────────────────┐│    │
│  │  │  New Services                                            ││    │
│  │  │  academic-analysis.service.ts                           ││    │
│  │  │  learner-risk.service.ts                                ││    │
│  │  │  daily-brief.service.ts                                 ││    │
│  │  │  report-comments.service.ts                             ││    │
│  │  │  fee-prediction.service.ts                              ││    │
│  │  │  attendance-intelligence.service.ts                     ││    │
│  │  │  communication-drafting.service.ts (extend existing)    ││    │
│  │  │  school-health-score.service.ts                         ││    │
│  │  │  nl-assistant.service.ts                                ││    │
│  │  └─────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Data Layer: PostgreSQL via Prisma                           │    │
│  │  Learners • Assessments • FeeInvoices • Attendance          │    │
│  │  Staff • Classes • LearningAreas • Pathways                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Redis Cache (optional)  — insight results cached 5 min     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────┐
│  External AI Provider                       │
│  Anthropic Claude (primary)                 │
│  OpenAI (fallback)                          │
│  Configured via AI_PROVIDER + AI_API_KEY    │
└────────────────────────────────────────────┘
```

### Hybrid Intelligence Strategy

The system uses two complementary engines:

| Engine | When to Use | Examples |
|--------|-------------|---------|
| **Deterministic** (existing) | Structured metrics, numbers, rankings, risk scoring | Collection rate %, BE counts, attendance %, ratio calculations |
| **LLM-Generated** (via `ai-bridge.service.ts`) | Narrative text, comments, recommendations, translations, NL queries | Report card comments, daily brief prose, parent messages, chat answers |

This avoids LLM calls for everything, keeping costs low and accuracy high. LLM is used only where natural language output has high value.

### Multi-Tenancy

Every new service receives `schoolId` (from `req.user.schoolId`) and scopes all Prisma queries with `where: { schoolId }`. No cross-school data leakage is possible.

### Caching Strategy

Expensive aggregate queries (daily brief, school health score, class analysis) are cached in Redis with a 5-minute TTL using the existing `redis-cache.service.ts`. Cache keys are namespaced by `schoolId` to enforce isolation.

---

## Component Map

### Phase 1 Components (Immediate Build)

| # | Feature | Backend Service | Controller | Frontend Page/Component |
|---|---------|----------------|------------|------------------------|
| 1 | AI Report Card Comments | `report-comments.service.ts` | `ai.controller.ts` (extend) | `ReportCommentGenerator` component in assessments |
| 2 | AI Parent Message Generator | `communication-drafting.service.ts` (extend) | `communication.controller.ts` (extend) | `AIDraftModal` component (exists, extend) |
| 3 | AI Academic Analysis | `academic-analysis.service.ts` | `ai.controller.ts` (extend) | `AcademicAnalysisPage` |
| 4 | AI Daily Brief | `daily-brief.service.ts` | `dashboard.controller.ts` (extend) | `DailyBriefWidget` on dashboard |
| 5 | AI Learner Risk Detection | `learner-risk.service.ts` (extends existing `ai-assistant.service.ts`) | `ai.controller.ts` (extend) | `RiskDashboard` + `LearnerRiskBadge` |

### Phase 2 Components

| # | Feature | Backend Service | Controller | Frontend Component |
|---|---------|----------------|------------|-------------------|
| 6 | Career Guidance Engine | `ai-assistant.service.ts` (extend) | `pathway.controller.ts` (extend) | `CareerGuidanceCard` |
| 7 | Fee Collection Prediction | `fee-prediction.service.ts` | `fee.controller.ts` (extend) | `FeeCollectionForecast` widget |
| 8 | Attendance Intelligence | `attendance-intelligence.service.ts` | `attendance.controller.ts` (extend) | `AttendanceTrendsPanel` |
| 9 | Communication Hub (translate) | `communication-drafting.service.ts` (extend) | `communication.controller.ts` | `MessageTranslator` component |

### Phase 3 Components

| # | Feature | Backend Service | Frontend Component |
|---|---------|----------------|--------------------|
| 10 | School Health Score™ | `school-health-score.service.ts` | `HealthScoreWidget` |
| 11 | AI School Intelligence Assistant | `nl-assistant.service.ts` | `AIAssistantFloating` (global) |
| 12 | Content Generator | `content-generator.service.ts` | `ContentGeneratorPage` |

---

## Data Models

### New Prisma Models

```prisma
// Persists generated AI artefacts — report comments, drafts, analyses
model AIGeneratedContent {
  id          String   @id @default(cuid())
  schoolId    String
  type        AIContentType
  entityId    String   // learnerId, classId, or schoolId depending on type
  entityType  String   // "learner" | "class" | "school"
  content     String   @db.Text
  prompt      String?  @db.Text
  provider    String?  // "anthropic" | "openai" | "deterministic"
  tokensUsed  Int?
  createdBy   String   // userId
  createdAt   DateTime @default(now())
  archived    Boolean  @default(false)

  school      School   @relation(fields: [schoolId], references: [id])
}

enum AIContentType {
  REPORT_COMMENT
  PARENT_MESSAGE
  ACADEMIC_ANALYSIS
  DAILY_BRIEF
  RISK_ANALYSIS
  CAREER_GUIDANCE
  COMMUNICATION_DRAFT
  NL_ANSWER
}

// Tracks NL assistant conversation turns per school/user
model AIConversationTurn {
  id         String   @id @default(cuid())
  schoolId   String
  userId     String
  question   String   @db.Text
  answer     String   @db.Text
  intent     String?  // classified intent slug
  createdAt  DateTime @default(now())
}

// School Health Score snapshots — computed daily by cron
model SchoolHealthScore {
  id              String   @id @default(cuid())
  schoolId        String
  score           Int      // 0–100
  academicScore   Int
  financeScore    Int
  attendanceScore Int
  staffScore      Int
  disciplineScore Int
  aiRecommendation String? @db.Text
  computedAt      DateTime @default(now())
}
```

### Existing Models Used (Read-Only by AI Services)

| Model | Used For |
|-------|---------|
| `Learner` | Risk detection, report comments, NL queries |
| `SummativeResult` | Academic analysis, pathway prediction |
| `FormativeAssessment` | BE/AE/ME/EE distribution |
| `Attendance` | Attendance intelligence, risk scoring |
| `FeeInvoice` | Fee prediction, parent message context |
| `Payment` | Historical payment pattern analysis |
| `User` (TEACHER) | Staffing insights, timetable overload |
| `Class` / `Stream` | Class-level analysis |
| `LearningArea` | Subject breakdown |

---

## High-Level Design: Individual Features

### 1. AI Report Card Comments

**Flow:**
1. Teacher opens a learner's report card in the assessment module.
2. Clicks "Generate AI Comment" button.
3. Frontend `POST /api/ai/report-comments/:learnerId` with `{ term, academicYear }`.
4. `report-comments.service.ts` fetches: latest summative results, formative ratings, attendance %, performance trend.
5. Constructs a structured prompt embedding all numeric data.
6. Calls `aiBridgeService.generateCompletion()` with a CBC-aligned system prompt.
7. Returns generated comment. Teacher can edit before saving.
8. Saved comment persisted to `AIGeneratedContent` table for audit.

**Mode Fallback:** If `AI_API_KEY` is not set, falls back to the existing deterministic `generateTeacherFeedback()` in `ai-assistant.service.ts`.

### 2. AI Daily Brief

**Flow:**
1. Principal opens dashboard. `DailyBriefWidget` mounts and calls `GET /api/dashboard/daily-brief`.
2. `daily-brief.service.ts` calls `generateInsights()` (existing) to get structured metrics.
3. Formats metrics into a structured prompt: collection rate, attendance, at-risk count, pending actions.
4. Calls `aiBridgeService.generateCompletion()` to produce a 3–5 sentence plain-English morning summary.
5. Response cached in Redis for 5 minutes per `schoolId`.
6. Frontend renders the brief with severity colour coding.

**Fallback:** If LLM unavailable, renders a template-based brief from the deterministic insights payload directly.

### 3. AI Learner Risk Detection

**Enhancement of existing `analyzeLearnerRisk()`:**
- Adds fee balance dimension: pulls `FeeInvoice.balance` for the learner.
- Adds attendance dimension: pulls last 30 days attendance rate.
- Adds discipline dimension: counts `DisciplineRecord` entries this term (if model exists).
- Computes a composite `riskScore` (0–100) from weighted sub-scores.
- Generates richer narrative via LLM using all dimensions.
- Dashboard page shows filterable risk table across all learners in the school.

### 4. AI Academic Analysis

**Class-level (new):**
- Teacher/admin selects a class and term.
- `academic-analysis.service.ts` aggregates: average per subject, BE/AE/ME/EE distribution, gender performance gap (M/F average), trend vs previous term.
- LLM generates a 2–3 paragraph narrative analysis with strand weaknesses and a concrete recommendation.
- Cached per `(classId, term, academicYear)`.

### 5. AI Parent Message Generator

**Enhancement of existing communication drafting:**
- Extends the existing `AIDraftModal` with a "Fee Reminder" template mode.
- Receives `{ learnerId, messageType, channel }` where channel is `email | sms | whatsapp`.
- `communication-drafting.service.ts` fetches learner name, parent name, balance amount.
- LLM generates appropriately formatted version for the requested channel (SMS ≤160 chars, WhatsApp informal, email formal).
- New: Translation endpoint `POST /api/ai/translate` accepts `{ text, targetLanguage }` supporting `en`, `sw`, `so`.

### 6. School Health Score™

**Computation (deterministic, no LLM):**
```
academicScore  = weightedAvg(EE/ME rate, assessmentCoverage)          × 0.30
financeScore   = collectionRate × (1 - overdueRatio)                  × 0.25
attendanceScore = attendanceRate                                        × 0.20
staffScore     = activeStaffRate × (1 / max(1, ratioDeviation))        × 0.15
disciplineScore = 100 - normalizedDisciplineIncidentRate               × 0.10

overallScore = sum of weighted component scores, clamped to 0–100
```
- LLM generates a one-sentence recommendation targeting the lowest-scoring component.
- Persisted daily via cron to `SchoolHealthScore` table for trend display.

### 7. NL School Intelligence Assistant

**Architecture:**
```
User question
     │
     ▼
Intent Classifier (deterministic — keyword/regex matching)
     │
     ├── "fee defaulters"      → feeQueryHandler()
     ├── "at risk" / "risk"    → riskQueryHandler()
     ├── "performing worst"    → academicQueryHandler()
     ├── "attendance"          → attendanceQueryHandler()
     ├── "focus" / "this week" → dailyBriefHandler()
     └── fallback              → LLM with schema-constrained prompt + live data injection
```
- Intent classifier avoids LLM calls for common structured queries, keeping latency < 200ms and cost near zero.
- LLM fallback is invoked only for open-ended questions, with a data context block injected into the system prompt.
- Responses streamed via Server-Sent Events for perceived speed.
- Conversation history (last 5 turns) stored in `AIConversationTurn` and passed as context for follow-up questions.

---

## Low-Level Design

### `report-comments.service.ts`

```typescript
interface ReportCommentInput {
  learnerId: string;
  schoolId: string;
  term: string;
  academicYear: number;
}

interface ReportCommentOutput {
  comment: string;          // final comment text
  provider: string;         // "anthropic" | "openai" | "deterministic"
  tokensUsed?: number;
}

class ReportCommentsService {
  async generateComment(input: ReportCommentInput): Promise<ReportCommentOutput>
  private buildPrompt(learner: LearnerProfile, metrics: LearnerMetrics): string
  private buildFallbackComment(metrics: LearnerMetrics): string
}

// LearnerMetrics collected internally:
interface LearnerMetrics {
  name: string;
  grade: string;
  percentage: number;           // latest term average
  trend: 'improving' | 'declining' | 'stable';
  attendanceRate: number;       // %
  weakestSubject: string | null;
  strongestSubject: string | null;
  achievementLevel: 'EE' | 'ME' | 'AE' | 'BE';
}

// System prompt used:
const REPORT_COMMENT_SYSTEM_PROMPT = `
You are a professional Kenyan teacher writing CBC-aligned report card comments.
Write in third person. Be encouraging, specific, and professional.
Comments must be 2–3 sentences. Do not invent facts not in the data provided.
Align to CBC competency language (e.g., "demonstrates mastery of", "is developing").
`;
```

### `daily-brief.service.ts`

```typescript
interface DailyBriefOutput {
  greeting: string;          // "Good morning, Principal Kamau"
  summary: string;           // LLM-generated 3–5 sentence prose
  bullets: BriefBullet[];    // deterministic structured bullets for quick scan
  recommendation: string;    // single recommended action
  generatedAt: string;
}

interface BriefBullet {
  emoji: string;
  severity: 'green' | 'amber' | 'red';
  text: string;
}

class DailyBriefService {
  async generateBrief(schoolId: string, principalName: string): Promise<DailyBriefOutput>
  private buildBullets(insights: InsightsPayload): BriefBullet[]
  private buildPrompt(insights: InsightsPayload, schoolName: string): string
  private buildFallbackBrief(insights: InsightsPayload): DailyBriefOutput
}
```

### `learner-risk.service.ts`

```typescript
interface LearnerRiskProfile {
  learnerId: string;
  name: string;
  grade: string;
  stream: string;
  riskScore: number;                // 0–100 composite
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dimensions: {
    academic:   { score: number; flag: boolean; detail: string };
    attendance: { score: number; flag: boolean; detail: string };
    financial:  { score: number; flag: boolean; detail: string };
    discipline: { score: number; flag: boolean; detail: string };
  };
  narrative: string;                // LLM or deterministic summary
  recommendedActions: string[];
}

class LearnerRiskService {
  async getSchoolRiskSummary(schoolId: string): Promise<LearnerRiskProfile[]>
  async getLearnerRiskProfile(learnerId: string, schoolId: string): Promise<LearnerRiskProfile>
  private computeRiskScore(dims: RiskDimensions): number
  private computeAcademicDimension(learnerId: string): Promise<RiskDimension>
  private computeAttendanceDimension(learnerId: string): Promise<RiskDimension>
  private computeFinancialDimension(learnerId: string): Promise<RiskDimension>
  private computeDisciplineDimension(learnerId: string): Promise<RiskDimension>
}

// Risk score weighting:
// academic:   0.40
// attendance: 0.30
// financial:  0.20
// discipline: 0.10
```

### `academic-analysis.service.ts`

```typescript
interface ClassAnalysisInput {
  classId: string;
  schoolId: string;
  term: string;
  academicYear: number;
}

interface ClassAnalysisOutput {
  className: string;
  term: string;
  overallAverage: number;
  comparedToPrevTerm: number;       // delta %
  genderGap: { maleAvg: number; femaleAvg: number; gapPct: number };
  subjectBreakdown: SubjectSummary[];
  weakestStrand: string | null;
  narrative: string;                // LLM-generated analysis
  recommendations: string[];
  achievementDistribution: { EE: number; ME: number; AE: number; BE: number };
}

interface SubjectSummary {
  subject: string;
  average: number;
  bePct: number;
  trend: 'up' | 'down' | 'stable';
}

class AcademicAnalysisService {
  async analyzeClass(input: ClassAnalysisInput): Promise<ClassAnalysisOutput>
  async analyzeSchool(schoolId: string, term: string, year: number): Promise<SchoolAnalysisOutput>
  private computeGenderGap(results: SummativeResult[]): GenderGap
  private buildAnalysisPrompt(data: RawClassMetrics): string
}
```

### `fee-prediction.service.ts`

```typescript
interface FeeCollectionForecast {
  weeklyEstimate: number;           // KES amount
  termEstimate: number;
  confidence: number;               // 0–100
  basis: string[];                  // factors used
  trend: 'improving' | 'declining' | 'stable';
  highRiskLearners: { learnerId: string; name: string; balance: number }[];
}

class FeePredictionService {
  async forecast(schoolId: string): Promise<FeeCollectionForecast>
  private analysePaymentVelocity(payments: Payment[]): PaymentVelocity
  private computeConfidence(velocity: PaymentVelocity, invoices: FeeInvoice[]): number
}
// Note: purely deterministic — no LLM needed here.
// Prediction based on: rolling 4-week payment velocity × outstanding balance
```

### `nl-assistant.service.ts`

```typescript
interface NLQuery {
  question: string;
  schoolId: string;
  userId: string;
  conversationHistory?: ConversationTurn[];
}

interface NLAnswer {
  answer: string;
  intent: string;
  dataUsed: string[];    // what data sources were queried
  suggestions: string[]; // follow-up question suggestions
}

type Intent =
  | 'fee_defaulters'
  | 'at_risk_learners'
  | 'worst_performing_class'
  | 'attendance_summary'
  | 'daily_focus'
  | 'unknown';

class NLAssistantService {
  async answer(query: NLQuery): Promise<NLAnswer>
  private classifyIntent(question: string): Intent
  private handleFeeDefaulters(schoolId: string, limit?: number): Promise<string>
  private handleAtRiskLearners(schoolId: string): Promise<string>
  private handleWorstPerformingClass(schoolId: string, subject?: string): Promise<string>
  private handleAttendanceSummary(schoolId: string): Promise<string>
  private handleLLMFallback(query: NLQuery): Promise<string>
  private buildDataContext(schoolId: string): Promise<string>
}
```

### `school-health-score.service.ts`

```typescript
interface HealthScoreComponents {
  academic: number;    // 0–100
  finance: number;
  attendance: number;
  staff: number;
  discipline: number;
}

interface HealthScoreOutput {
  overall: number;
  components: HealthScoreComponents;
  trend: number;       // delta from previous snapshot
  weakestArea: string;
  aiRecommendation: string;
  history: { date: string; score: number }[]; // last 30 days
}

class SchoolHealthScoreService {
  async compute(schoolId: string): Promise<HealthScoreOutput>
  async getHistory(schoolId: string, days: number): Promise<HealthScoreOutput[]>
  private scoreAcademic(snapshot: MetricsSnapshot): number
  private scoreFinance(snapshot: MetricsSnapshot): number
  private scoreAttendance(snapshot: MetricsSnapshot): number
  private scoreStaff(snapshot: MetricsSnapshot): number
  private scoreDiscipline(snapshot: MetricsSnapshot): number
}
```

### Communication Drafting Extensions

```typescript
// Extension to existing communication drafting:

interface MessageDraftRequest {
  context: string;           // e.g. "fee reminder, balance KES 8500"
  channel: 'email' | 'sms' | 'whatsapp';
  learnerId?: string;        // for fee reminders — auto-injects learner/parent name + balance
  language: 'en' | 'sw' | 'so';
}

interface TranslationRequest {
  text: string;
  targetLanguage: 'sw' | 'so' | 'en';
}

// Added to communication-drafting.service.ts:
async draftMessage(req: MessageDraftRequest, schoolId: string): Promise<string>
async translateMessage(req: TranslationRequest): Promise<string>
```

---

## New API Endpoints

All routes are mounted under `/api/ai/` and require `authenticate` middleware. School scoping is enforced server-side from `req.user.schoolId`.

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| `POST` | `/api/ai/report-comments/:learnerId` | `report-comments.service.ts` | Generate CBC report card comment |
| `GET` | `/api/ai/daily-brief` | `daily-brief.service.ts` | Principal's AI morning brief |
| `GET` | `/api/ai/risk-summary` | `learner-risk.service.ts` | All learners risk table |
| `GET` | `/api/ai/risk/:learnerId` | `learner-risk.service.ts` | Single learner risk profile |
| `GET` | `/api/ai/class-analysis/:classId` | `academic-analysis.service.ts` | Class performance narrative |
| `GET` | `/api/ai/school-analysis` | `academic-analysis.service.ts` | School-wide academic narrative |
| `GET` | `/api/ai/fee-forecast` | `fee-prediction.service.ts` | Fee collection prediction |
| `GET` | `/api/ai/health-score` | `school-health-score.service.ts` | School Health Score™ |
| `POST` | `/api/ai/assistant` | `nl-assistant.service.ts` | NL question answering |
| `POST` | `/api/ai/draft-message` | `communication-drafting.service.ts` | Multi-channel message draft |
| `POST` | `/api/ai/translate` | `communication-drafting.service.ts` | Message translation |
| `GET` | `/api/ai/attendance-trends` | `attendance-intelligence.service.ts` | Attendance pattern analysis |

---

## Frontend Component Architecture

### `DailyBriefWidget` (Dashboard)

```
DailyBriefWidget
├── GreetingHeader           — "Good morning, Principal Kamau"
├── BriefNarrativeParagraph  — LLM-generated summary prose
├── MetricBulletList         — colour-coded bullet points
│   ├── BulletItem (green)   — "Fee collection is up 12%"
│   ├── BulletItem (amber)   — "Grade 9 Maths needs attention"
│   └── BulletItem (red)     — "23 learners with balance > KES 10,000"
├── RecommendationBanner     — "Recommended: contact high-balance parents"
└── RefreshButton            — re-fetches (bypasses 5-min cache)
```

### `AIAssistantFloating` (Global)

```
AIAssistantFloating          — fixed position, all pages
├── TriggerButton            — sparkle icon, collapses to dot
├── AssistantPanel (drawer)
│   ├── ConversationHistory  — scrollable turns
│   │   ├── UserMessage
│   │   └── AssistantMessage — with data source attribution
│   ├── SuggestionChips      — pre-built common questions
│   │   ├── "Who are at risk this term?"
│   │   ├── "Top 10 fee defaulters"
│   │   └── "Which class is weakest in Maths?"
│   └── QueryInput           — text input + send button
└── SSE stream connection    — real-time response streaming
```

### `RiskDashboard` (Academics / Learners section)

```
RiskDashboard
├── RiskSummaryCards         — counts: Critical / High / Medium / Low
├── RiskFilterBar            — filter by class, stream, risk level
├── RiskTable
│   ├── LearnerRiskRow       — name, grade, risk badge, dimensions, action button
│   └── ... (paginated)
└── LearnerRiskDrawer        — full profile on row click
    ├── RiskScoreGauge
    ├── DimensionBreakdown   — academic / attendance / financial / discipline bars
    └── RecommendedActions
```

### `ReportCommentGenerator` (Assessment / Report Cards)

```
ReportCommentGenerator
├── GenerateButton           — "Generate AI Comment"
├── LoadingState             — spinner with "Analysing {LearnerName}..."
├── CommentTextArea          — editable output
├── RegenerateButton         — generates a new variant
└── SaveButton               — saves to AIGeneratedContent + report card
```

---

## Configuration

New environment variables required in `server/.env`:

```bash
# AI Provider (already exists in ai-bridge.service.ts)
AI_PROVIDER=anthropic                    # "anthropic" | "openai"
AI_API_KEY=sk-ant-...                    # Anthropic or OpenAI key
AI_BASE_URL=https://api.anthropic.com/v1 # optional override

# AI feature flags — allow per-school or global disabling
AI_REPORT_COMMENTS_ENABLED=true
AI_DAILY_BRIEF_ENABLED=true
AI_NL_ASSISTANT_ENABLED=true
AI_TRANSLATION_ENABLED=true

# Token budget guards
AI_MAX_TOKENS_PER_REQUEST=1024
AI_DAILY_BUDGET_TOKENS=500000            # hard stop if exceeded (future)
```

---

## Error Handling & Fallback Policy

| Scenario | Behaviour |
|----------|-----------|
| `AI_API_KEY` not set | Fall back to deterministic output; no error surfaced to user |
| LLM API rate-limited (429) | Retry once after 2s; then fall back to deterministic |
| LLM API error (5xx) | Fall back to deterministic; log error server-side |
| LLM response unparseable | Return generic template; log prompt + response for debugging |
| Redis cache miss | Compute fresh; do not error |
| Insufficient data for analysis | Return `{ status: 'insufficient_data', message: '...' }` with 200 status |

---

## Security Considerations

- All AI endpoints require `authenticate` middleware (JWT).
- School scoping enforced via `req.user.schoolId` in every service call — never trust client-supplied school ID.
- Generated content stored with `createdBy: userId` for audit trail.
- LLM prompts never include raw passwords, API keys, or other secrets from the database.
- NL assistant intent classification runs before any LLM call, preventing prompt injection via question text.
- Translation endpoint validates `targetLanguage` against an allowlist `['en', 'sw', 'so']`.

---

## Cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Daily brief cache warm | `0 6 * * 1-5` (6am weekdays) | Pre-generate daily brief for all active schools |
| School Health Score | `0 1 * * *` (1am daily) | Compute and persist `SchoolHealthScore` snapshot |
| Risk score refresh | `0 2 * * *` (2am daily) | Refresh cached risk profiles |

All jobs added to existing `server/src/cron-worker.ts`.

---

## Implementation Phases

### Phase 1 — Weeks 1–3
1. Extend `ai.controller.ts` with new Phase 1 routes
2. Build `report-comments.service.ts`
3. Build `daily-brief.service.ts`
4. Build `learner-risk.service.ts` (extending existing `ai-assistant.service.ts`)
5. Build `academic-analysis.service.ts`
6. Add `AIGeneratedContent` Prisma model + migration
7. Frontend: `DailyBriefWidget`, `RiskDashboard`, `ReportCommentGenerator`

### Phase 2 — Weeks 4–6
1. Extend communication drafting with multi-channel + translation
2. Build `fee-prediction.service.ts`
3. Build `attendance-intelligence.service.ts`
4. Frontend: `MessageTranslator`, `FeeCollectionForecast`, `AttendanceTrendsPanel`

### Phase 3 — Weeks 7–10
1. Build `school-health-score.service.ts` + cron
2. Build `nl-assistant.service.ts` with SSE streaming
3. Frontend: `AIAssistantFloating` global component
4. Add `SchoolHealthScore` + `AIConversationTurn` Prisma models + migration
5. Add `HealthScoreWidget` to dashboard
