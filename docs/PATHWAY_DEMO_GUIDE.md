# 🎯 Pathways Module - Complete Demo Guide

## 📋 Demo Scenario Overview
This guide walks through a complete pathway recommendation flow from Grade 9 → Senior School selection.

---

## **STEP 1: Prepare Demo Data** 

Run these seeds in order:

```bash
# Seed core pathway data
npm run seed:ss:pathways          # Senior school pathways (STEM, Social, Arts)
npm run seed:ss:official-catalog  # Senior school catalog
npm run seed:careers              # Career data

# Seed demo learners and related data
npm run seed:planner-demo         # Creates Grade 9 learners with assessments
npm run seed:learners:demo        # Additional demo learners
```

**What you'll have after seeding:**
- ✅ 5-10 Grade 9 learners ready for pathway recommendations
- ✅ 50+ senior schools categorized by pathway
- ✅ Mock assessment scores for each learner
- ✅ Demo staff accounts (counsellor, head teacher, admin)
- ✅ Demo parent accounts linked to learners

---

## **STEP 2: Check Available Demo Users**

**Super Admin (You):**
```
Email: admin@trendscore.local or check seed output
Role: SUPER_ADMIN
Access: All endpoints, can impersonate other roles
```

**Demo Accounts to Use:**
- **Counsellor:** `counsellor@demo.local`
- **Head Teacher:** `teacher@demo.local`
- **Parent:** `parent@demo.local`
- **Student:** `student@demo.local`

---

## **STEP 3: Start Development Server**

```bash
npm run dev:ts
# Server runs on http://localhost:5000
```

---

## **STEP 4: Complete Pathway Demo Flow**

### **A. SUPER ADMIN - View System Data**

```bash
# Terminal 1: Start server
npm run dev:ts

# Terminal 2: As Super Admin, check learner data
curl -X GET http://localhost:5000/api/pathwayPlanner/learners \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response includes:**
- Grade 9 learners eligible for pathway recommendations
- Their current grades and assessment scores
- Academic strength indicators (STEM, Social Sciences, Arts)

---

### **B. COUNSELLOR - Build Recommendation**

**Step 1: Get Grade 9 Readiness Analysis**

```bash
curl -X POST http://localhost:5000/api/pathwayRecommendation/:learnerId/grade9-transition-readiness \
  -H "Authorization: Bearer <COUNSELLOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "term": "TERM_3",
    "academicYear": 2026,
    "learnerInterest": "STEM",
    "teacherRecommendation": "STEM",
    "parentPreference": null
  }'
```

**Response includes:**
- `recommendedPathway`: STEM | SOCIAL_SCIENCES | ARTS_SPORTS
- `confidence`: 0-100 score
- `componentScores`: Breakdown by subject cluster
- `justification`: Why this pathway
- `mismatchWarning`: If learner interest ≠ recommendation

---

**Step 2: Submit Pathway Recommendation**

```bash
curl -X POST http://localhost:5000/api/pathwayRecommendation/:learnerId/save-transition-decision \
  -H "Authorization: Bearer <COUNSELLOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendedPathway": "STEM",
    "confidenceScore": 82,
    "learnerInterest": "STEM",
    "teacherRecommendation": "STEM",
    "parentPreference": null,
    "mismatchWarning": null,
    "analysisPayload": {
      "version": "GRADE9_READINESS_V1",
      "generatedAt": "2026-08-07T12:00:00Z"
    }
  }'
```

**Result:**
- ✅ Recommendation stored in database
- 📧 Parent & student notified
- 📊 Transition decision history started

---

### **C. PARENT - Submit Preference**

**Parent receives notification →** Views child's pending pathway

```bash
curl -X POST http://localhost:5000/api/pathwayRecommendation/:learnerId/parent-preference \
  -H "Authorization: Bearer <PARENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "parentPreference": "STEM"
  }'
```

**Result:**
- ✅ Parent preference recorded (doesn't overwrite staff fields)
- ✅ Preserved in decision history
- Staff can see mismatch if parent chose differently

---

### **D. STUDENT - View Recommendation**

```bash
curl -X GET http://localhost:5000/api/pathwayRecommendation/:learnerId/transition-decision-history \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json"
```

**Sees:**
- Staff recommendation (pathway + confidence)
- Parent's preference (if submitted)
- Historical decisions (audit trail)
- Next steps: School selection

---

### **E. ADMIN - Search & Filter Schools**

**Find schools matching STEM pathway:**

```bash
curl -X GET "http://localhost:5000/api/pathwayPlanner/senior-schools/search?pathway=STEM&county=Nairobi&limit=10" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Filter options:**
- `pathway`: STEM, SOCIAL_SCIENCES, ARTS_SPORTS
- `county`: Any county
- `classification`: C1, C2, C3, C4
- `gender`: BOYS, GIRLS, MIXED
- `affordabilityBand`: Tier 1, Tier 2, Tier 3
- `verificationStatus`: TREND_SCORE_VERIFIED, UNVERIFIED

**Response includes:**
- School name, facilities, fees
- Historical performance data
- Pathway combinations offered
- Transition success rate

---

### **F. HEAD OF CURRICULUM - View Class Distribution**

```bash
curl -X GET http://localhost:5000/api/pathwayPlanner/class/:classId/distribution \
  -H "Authorization: Bearer <HEAD_TEACHER_TOKEN>"
```

**See:**
- How many learners → STEM / Social / Arts
- Selection status: DRAFT → SUBMITTED → APPROVED → LOCKED
- Outliers & mismatches needing intervention

---

## **STEP 5: Complete Pathway Journey**

### Timeline:

```
Week 1: Grade 9 Mock Exams
   └─→ Assessments completed
       
Week 2: Readiness Analysis
   └─→ Counsellor runs transition readiness
   └─→ Staff submits recommendations (STEM/Social/Arts)
   └─→ System sends notifications
   
Week 3: Parent Input
   └─→ Parents review recommendations
   └─→ Parents submit preferences
   └─→ Counsellor reviews mismatches
   
Week 4: School Search & Application
   └─→ Students search schools by pathway
   └─→ Admin verifies school data
   └─→ Students apply
   
Week 5: Finalization
   └─→ Admin approves & locks pathway
   └─→ Placement confirmed
```

---

## **STEP 6: Data to Check**

### View Pending Recommendations:

```bash
# As Counsellor - see all pending
SELECT learnerId, recommendedPathway, confidenceScore, createdAt
FROM learnerPathwayRecommendation
WHERE finalApprovedPathway IS NULL
ORDER BY createdAt DESC;
```

### View Decision History (Audit Trail):

```bash
# See all historical decisions for one learner
SELECT * FROM learnerPathwayRecommendation
WHERE learnerId = 'LEARNER_ID'
ORDER BY createdAt DESC;
```

### Check Mismatches:

```bash
# Where parent preference ≠ staff recommendation
SELECT learnerId, recommendedPathway, parentPreference
FROM learnerPathwayRecommendation
WHERE recommendedPathway != parentPreference
AND parentPreference IS NOT NULL;
```

---

## **Permission Matrix for Demo**

| Endpoint | SUPER_ADMIN | PARENT | STUDENT | COUNSELLOR | HEAD_TEACHER | ADMIN |
|----------|-----------|--------|---------|-----------|--------------|-------|
| `/grade9-transition-readiness` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/save-transition-decision` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/parent-preference` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/transition-decision-history` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/senior-schools/search` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/class/distribution` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## **Demo Success Criteria** ✅

After completing this flow, you'll have demonstrated:

- ✅ Grade 9 readiness analysis engine
- ✅ Pathway recommendation (STEM/Social/Arts)
- ✅ Parent preference input (separate endpoint)
- ✅ Role-based access controls
- ✅ Permission enforcement (parent blocked from staff endpoint)
- ✅ Notification system
- ✅ Decision history & audit trail
- ✅ School discovery by pathway
- ✅ Admin finalization & locking
- ✅ Data versioning & analysis payload capture

---

## **Troubleshooting**

**"401 Unauthorized"** → Generate valid JWT token for your user role

**"403 Forbidden"** → You don't have permission for that endpoint (check role)

**"404 Not Found"** → Learner ID doesn't exist (run seeds first)

**"422 Unprocessable Entity"** → Invalid pathway code (use STEM, SOCIAL_SCIENCES, ARTS_SPORTS only)

---

## **Quick Start (One Command)**

```bash
# Run all required seeds
npm run seed:ss:pathways && \
npm run seed:ss:official-catalog && \
npm run seed:careers && \
npm run seed:planner-demo && \
npm run dev:ts
```

Then open Postman or VS Code REST Client and start testing the endpoints above!
