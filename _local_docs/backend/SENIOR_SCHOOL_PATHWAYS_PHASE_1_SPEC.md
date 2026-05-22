# Senior School Pathways Phase 1 Technical Specification

**Date:** 2026-05-22  
**Scope:** Kenya Senior School CBE pathway catalog, official combinations, validation, and compatibility foundation  
**Status:** Design specification only  
**Runtime impact:** None

---

## 1. Objective

The current Senior Secondary Pathways module is built around:

```text
Pathway -> Category -> Pick subjects within min/max
```

Kenya Senior School CBE requires a stronger model:

```text
Official Pathway -> Official Track -> Approved Subject Combination -> School Offering -> Learner Selection -> Approval -> Reporting
```

Phase 1 introduces the official catalog and validation foundation while keeping the current UI and legacy pathway APIs operational.

---

## 2. Non-Goals

Phase 1 does not:

- Replace the current pathway wizard.
- Delete existing `Pathway`, `SubjectCategory`, `LearningArea`, or `LearnerSubjectSelection` records.
- Force existing learners into the new model.
- Rewrite report card layouts.
- Rewrite timetabling.
- Remove legacy API endpoints.

---

## 3. Current Implementation Summary

Existing core tables:

| Existing Model | Existing Table | Current Role |
|---|---|---|
| `Pathway` | `pathways` | Stores `CORE`, `STEM`, `SOCIAL_SCIENCES`, `ARTS_SPORTS` |
| `SubjectCategory` | `subject_categories` | Stores category min/max rules |
| `LearningArea` | `learning_areas` | Stores subjects per grade, with pathway/category metadata |
| `LearnerSubjectSelection` | `learner_subject_selections` | Stores learner selected learning areas |
| `Learner.pathwayId` | `learners.pathwayId` | Stores learner selected pathway |

Key architectural gap:

```text
Current system validates category counts.
Official Senior School requires approved subject-combination validation.
```

---

## 4. Target Phase 1 Models

### 4.1 `PathwayTrack`

Official tracks under each pathway.

```prisma
model PathwayTrack {
  id          String   @id @default(uuid())
  pathwayId   String
  code        String
  name        String
  description String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  pathway     Pathway  @relation(fields: [pathwayId], references: [id], onDelete: Cascade)

  @@unique([pathwayId, code])
  @@index([pathwayId])
  @@map("pathway_tracks")
}
```

Recommended initial tracks:

| Pathway | Track Code | Track Name |
|---|---|---|
| STEM | `PURE_SCIENCES` | Pure Sciences |
| STEM | `APPLIED_SCIENCES` | Applied Sciences |
| STEM | `TECHNICAL_STUDIES` | Technical Studies |
| Social Sciences | `HUMANITIES_BUSINESS` | Humanities & Business Studies |
| Social Sciences | `LANGUAGES_LITERATURE` | Languages & Literature |
| Arts & Sports Science | `ARTS` | Arts |
| Arts & Sports Science | `SPORTS_RECREATION` | Sports & Recreation |

### 4.2 `OfficialLearningArea`

Canonical official subject catalog.

```prisma
model OfficialLearningArea {
  id             String      @id @default(uuid())
  officialCode   String      @unique
  officialName   String
  subjectType    SubjectType
  pathwayId      String?
  trackId        String?
  examinable     Boolean     @default(true)
  active         Boolean     @default(true)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  pathway        Pathway?       @relation(fields: [pathwayId], references: [id])
  track          PathwayTrack?  @relation(fields: [trackId], references: [id])

  @@index([subjectType])
  @@index([pathwayId])
  @@index([trackId])
  @@map("official_learning_areas")
}
```

### 4.3 `LearningAreaAlias`

Maps legacy and alternate names to official learning areas.

```prisma
model LearningAreaAlias {
  id                     String   @id @default(uuid())
  officialLearningAreaId String
  alias                  String
  source                 String?
  active                 Boolean  @default(true)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  officialLearningArea   OfficialLearningArea @relation(fields: [officialLearningAreaId], references: [id], onDelete: Cascade)

  @@unique([alias])
  @@index([officialLearningAreaId])
  @@map("learning_area_aliases")
}
```

Initial aliases:

| Alias | Official Target |
|---|---|
| Mathematics | Manual resolution: Core Mathematics or Essential Mathematics |
| Computer Science | Computer Studies |
| Mandarin | Mandarin Chinese |
| History & Citizenship | History and Citizenship |
| Fine Art | Fine Arts |
| Physical Education | Physical Education, support subject |

### 4.4 `SubjectCombinationRule`

Approved official optional-subject combination.

```prisma
model SubjectCombinationRule {
  id             String   @id @default(uuid())
  pathwayId      String
  trackId        String
  code           String   @unique
  name           String
  officialSource String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  pathway        Pathway      @relation(fields: [pathwayId], references: [id])
  track          PathwayTrack @relation(fields: [trackId], references: [id])
  items          SubjectCombinationRuleItem[]

  @@index([pathwayId])
  @@index([trackId])
  @@map("subject_combination_rules")
}
```

### 4.5 `SubjectCombinationRuleItem`

Subjects inside an approved combination.

```prisma
model SubjectCombinationRuleItem {
  id                     String @id @default(uuid())
  ruleId                 String
  officialLearningAreaId String
  position               Int

  rule                   SubjectCombinationRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  officialLearningArea   OfficialLearningArea   @relation(fields: [officialLearningAreaId], references: [id])

  @@unique([ruleId, officialLearningAreaId])
  @@index([officialLearningAreaId])
  @@map("subject_combination_rule_items")
}
```

### 4.6 `SchoolLearningAreaOffering`

School-specific subject availability.

```prisma
model SchoolLearningAreaOffering {
  id                     String   @id @default(uuid())
  schoolId               String?
  officialLearningAreaId String
  active                 Boolean  @default(true)
  capacity               Int?
  teacherCount           Int?
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  officialLearningArea   OfficialLearningArea @relation(fields: [officialLearningAreaId], references: [id])

  @@unique([schoolId, officialLearningAreaId])
  @@index([schoolId])
  @@index([officialLearningAreaId])
  @@map("school_learning_area_offerings")
}
```

### 4.7 `LearnerPathwaySelection`

Selection header for draft/final selection.

```prisma
model LearnerPathwaySelection {
  id                String                 @id @default(uuid())
  learnerId          String
  pathwayId          String
  trackId            String?
  combinationRuleId  String?
  status             PathwaySelectionStatus @default(DRAFT)
  locked             Boolean                @default(false)
  lockedAt           DateTime?
  lockedBy           String?
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  learner            Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  pathway            Pathway @relation(fields: [pathwayId], references: [id])

  items              LearnerPathwaySelectionItem[]
  approvals          PathwayApproval[]
  history            PathwaySelectionHistory[]

  @@index([learnerId])
  @@index([pathwayId])
  @@index([status])
  @@map("learner_pathway_selections")
}
```

### 4.8 `LearnerPathwaySelectionItem`

Selected official learning areas.

```prisma
model LearnerPathwaySelectionItem {
  id                     String      @id @default(uuid())
  selectionId             String
  officialLearningAreaId  String
  subjectType             SubjectType
  createdAt               DateTime    @default(now())

  selection               LearnerPathwaySelection @relation(fields: [selectionId], references: [id], onDelete: Cascade)
  officialLearningArea    OfficialLearningArea    @relation(fields: [officialLearningAreaId], references: [id])

  @@unique([selectionId, officialLearningAreaId])
  @@index([officialLearningAreaId])
  @@map("learner_pathway_selection_items")
}
```

### 4.9 `PathwayApproval`

Approval workflow records.

```prisma
model PathwayApproval {
  id           String   @id @default(uuid())
  selectionId  String
  approverRole String
  approverId   String?
  status       String
  comment      String?
  createdAt    DateTime @default(now())
  approvedAt   DateTime?

  selection    LearnerPathwaySelection @relation(fields: [selectionId], references: [id], onDelete: Cascade)

  @@index([selectionId])
  @@index([status])
  @@map("pathway_approvals")
}
```

### 4.10 `PathwaySelectionHistory`

Audit trail for changes.

```prisma
model PathwaySelectionHistory {
  id          String   @id @default(uuid())
  selectionId String
  action      String
  actorId     String?
  snapshot    Json?
  reason      String?
  createdAt   DateTime @default(now())

  selection   LearnerPathwaySelection @relation(fields: [selectionId], references: [id], onDelete: Cascade)

  @@index([selectionId])
  @@index([action])
  @@map("pathway_selection_history")
}
```

---

## 5. New Enums

```prisma
enum SubjectType {
  EXAMINABLE_CORE
  EXAMINABLE_OPTIONAL
  SUPPORT_SUBJECT
  NON_EXAMINABLE
}
```

```prisma
enum PathwaySelectionStatus {
  DRAFT
  SUBMITTED
  TEACHER_REVIEW
  PARENT_REVIEW
  APPROVED
  REJECTED
  LOCKED
}
```

---

## 6. Official Catalog Seed Structure

Recommended seed file:

```text
server/prisma/seed-senior-official-catalog.ts
```

Seed order:

1. Upsert pathways.
2. Upsert tracks.
3. Upsert official learning areas.
4. Upsert aliases.
5. Upsert official subject combination rules.
6. Upsert combination rule items.

### 6.1 Compulsory Subjects

| Official Subject | Type | Notes |
|---|---|---|
| English | `EXAMINABLE_CORE` | Required |
| Kiswahili | `EXAMINABLE_CORE` | Either Kiswahili or KSL |
| Kenya Sign Language | `EXAMINABLE_CORE` | Either Kiswahili or KSL |
| Core Mathematics | `EXAMINABLE_CORE` | Math option |
| Essential Mathematics | `EXAMINABLE_CORE` | Math option |
| Community Service Learning | `EXAMINABLE_CORE` | Required |

### 6.2 Support Subjects

| Official Subject | Type | Notes |
|---|---|---|
| Physical Education | `SUPPORT_SUBJECT` | Offered to all, not part of 7 examinable subjects |
| ICT | `SUPPORT_SUBJECT` | Offered to all, not part of 7 examinable subjects |

### 6.3 Optional Subjects

Optional subjects must be tied to official pathway/track records and allowed combinations.

---

## 7. Rule Engine Design

Recommended service:

```text
server/src/services/senior-pathway-rule-engine.service.ts
```

### 7.1 Input

```ts
type ValidateSeniorPathwaySelectionInput = {
  learnerId: string;
  schoolId?: string | null;
  pathwayId: string;
  trackId?: string | null;
  combinationRuleId?: string | null;
  compulsorySubjectIds: string[];
  optionalSubjectIds: string[];
  supportSubjectIds?: string[];
  allowCrossPathwayException?: boolean;
  exceptionReason?: string | null;
};
```

### 7.2 Output

```ts
type ValidationResult = {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
    field?: string;
    severity: 'ERROR' | 'WARNING';
  }>;
  warnings: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  normalizedSelection: {
    pathwayId: string;
    trackId?: string | null;
    combinationRuleId?: string | null;
    examinableSubjectIds: string[];
    supportSubjectIds: string[];
  };
};
```

### 7.3 Required Validation Rules

| Rule | Code |
|---|---|
| Learner must exist | `LEARNER_NOT_FOUND` |
| Learner must be secondary/senior school | `INVALID_INSTITUTION_TYPE` |
| Pathway must exist | `PATHWAY_NOT_FOUND` |
| Track must belong to pathway | `TRACK_PATHWAY_MISMATCH` |
| Exactly 4 compulsory examinable subjects | `INVALID_CORE_COUNT` |
| English required | `ENGLISH_REQUIRED` |
| Kiswahili or KSL required | `LANGUAGE_CORE_REQUIRED` |
| Core Math or Essential Math required | `MATH_CORE_REQUIRED` |
| CSL required | `CSL_REQUIRED` |
| Exactly 3 optional examinable subjects | `INVALID_OPTIONAL_COUNT` |
| Optional subjects must match official combination | `COMBINATION_NOT_APPROVED` |
| School must offer selected optional subjects | `SUBJECT_NOT_OFFERED` |
| PE/ICT cannot count toward seven examinable subjects | `SUPPORT_SUBJECT_NOT_EXAMINABLE` |
| Locked selections cannot be edited | `SELECTION_LOCKED` |

---

## 8. API Design

Recommended new route mount:

```text
/api/senior-pathways
```

Endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/catalog` | Load official pathways, tracks, core subjects, optional subjects |
| GET | `/combinations?pathwayId=&trackId=` | Load approved combinations |
| GET | `/school-offerings` | Load subjects offered by current school |
| POST | `/validate-selection` | Validate a draft selection |
| POST | `/selections` | Save or update draft |
| GET | `/learners/:learnerId/selection` | Fetch current selection |
| POST | `/selections/:id/submit` | Submit for review |
| POST | `/selections/:id/approve` | Approve selection |
| POST | `/selections/:id/lock` | Lock selection |
| GET | `/selections/:id/history` | Read audit trail |

Legacy routes remain active:

```text
/api/pathways
```

---

## 9. Legacy Compatibility Adapter

Recommended service:

```text
server/src/services/legacy-pathway-selection-adapter.service.ts
```

Purpose:

- Read existing `Learner.pathwayId`.
- Read existing `LearnerSubjectSelection`.
- Resolve `LearningArea.name` through `LearningAreaAlias`.
- Identify unmapped legacy subjects.
- Identify subjects now treated as support/non-examinable.
- Generate migration preview without writing changes.

Output:

```ts
type LegacySelectionPreview = {
  learnerId: string;
  legacyPathwayId?: string | null;
  mappedSubjects: Array<{
    legacyLearningAreaId: string;
    legacyName: string;
    officialLearningAreaId: string;
    officialName: string;
  }>;
  unmappedSubjects: Array<{
    legacyLearningAreaId: string;
    legacyName: string;
    reason: string;
  }>;
  warnings: string[];
};
```

---

## 10. Migration Strategy

### 10.1 Phase 1 Migration Behavior

Phase 1 should only:

- Add new tables.
- Seed official catalog data.
- Seed aliases.
- Add new validation APIs.
- Add read-only legacy migration preview.

Phase 1 should not:

- Rewrite learner selections.
- Rewrite historical assessment rows.
- Delete legacy learning areas.
- Reclassify existing report data.

### 10.2 Later Migration Behavior

After preview review:

1. Generate learner-by-learner migration report.
2. Resolve ambiguous mathematics mappings manually.
3. Move PE to support subject classification.
4. Confirm invalid combinations.
5. Create draft `LearnerPathwaySelection` rows.
6. Leave legacy data untouched for historical reports until reports are migrated.

---

## 11. Test Plan

### 11.1 Rule Engine Tests

| Test | Expected |
|---|---|
| Valid STEM Pure Sciences: English, Kiswahili, Core Mathematics, CSL, Biology, Chemistry, Physics | Pass |
| STEM with Biology, French, Theatre | Fail: `COMBINATION_NOT_APPROVED` |
| Missing mathematics | Fail: `MATH_CORE_REQUIRED` |
| Missing English | Fail: `ENGLISH_REQUIRED` |
| Both Kiswahili and KSL omitted | Fail: `LANGUAGE_CORE_REQUIRED` |
| PE counted as examinable | Fail: `SUPPORT_SUBJECT_NOT_EXAMINABLE` |
| ICT counted as examinable | Fail: `SUPPORT_SUBJECT_NOT_EXAMINABLE` |
| Optional subject not offered by school | Fail: `SUBJECT_NOT_OFFERED` |
| Combination track mismatch | Fail: `TRACK_PATHWAY_MISMATCH` |
| Locked selection edited | Fail: `SELECTION_LOCKED` |
| Alias `Computer Science` resolves | Pass with official `Computer Studies` |

### 11.2 API Tests

| Endpoint | Test |
|---|---|
| `GET /catalog` | Returns pathways, tracks, official learning areas |
| `GET /combinations` | Returns combinations filtered by pathway/track |
| `POST /validate-selection` | Returns validation result without saving |
| `POST /selections` | Saves draft only when valid or save-as-draft mode permits warnings |
| `POST /selections/:id/lock` | Prevents further edits |

### 11.3 Migration Preview Tests

| Test | Expected |
|---|---|
| Legacy `Computer Science` | Maps to `Computer Studies` |
| Legacy `Mandarin` | Maps to `Mandarin Chinese` |
| Legacy `Mathematics` | Marked ambiguous unless policy is provided |
| Legacy `Physical Education` | Mapped as support subject |
| Unknown subject | Appears in unmapped list |

---

## 12. Rollout Plan

### Step 1: Schema

Add new models and enums.

### Step 2: Catalog Seed

Seed official catalog, aliases, and combinations.

### Step 3: Rule Engine

Implement validation service independent of current UI.

### Step 4: New APIs

Expose official catalog and validation endpoints.

### Step 5: Compatibility Adapter

Add legacy preview so existing learners can be analyzed.

### Step 6: Tests

Add automated tests before UI changes.

### Step 7: Review

Review catalog, validation, and migration preview results with real school data.

### Step 8: UI Phase

Only after Phase 1 is stable, replace current picker UI with official combination picker.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Official subject list changes | Keep catalog seed versioned and idempotent |
| Existing learner data is invalid under new rules | Use migration preview and do not auto-lock |
| Math mapping ambiguity | Require manual or school-level policy |
| Reports break after subject renaming | Keep aliases and legacy names during transition |
| Schools offer different subjects | Introduce school offerings before final selection enforcement |

---

## 14. Recommended Build Order

1. Schema models and enums.
2. Official catalog seed.
3. Alias seed.
4. Combination rule seed.
5. Validation service.
6. New read-only catalog APIs.
7. Draft validation API.
8. Legacy migration preview.
9. Unit tests.
10. Integration tests.
11. UI redesign.

---

## 15. Acceptance Criteria

Phase 1 is complete when:

- Official pathways, tracks, learning areas, aliases, and combinations are seeded.
- Rule engine validates official 4 compulsory + 3 optional structure.
- PE and ICT cannot be counted as examinable subjects.
- Core Mathematics and Essential Mathematics are distinct.
- School offerings can block unavailable subjects.
- Legacy selections can be previewed without mutation.
- Existing `/api/pathways` behavior remains operational.
- Tests cover valid and invalid combinations.

