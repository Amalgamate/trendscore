# 🎓 Pathway Module - Step-by-Step Exploration (Super Admin)

## **YOUR ROLE AS SUPER ADMIN**
- Access ALL endpoints
- Can impersonate any role for testing
- Full audit trail access
- Can view all learner data

---

## **PART 1: UNDERSTAND YOUR DATA**

### Step 1.1: Check Available Learners

**What to do:**
```bash
# Option A: Use Prisma Studio (GUI)
npm run prisma:studio
# Opens http://localhost:5555
# Navigate to: Learner table → Filter by grade = GRADE_9

# Option B: Quick query
npm run seed:learners:demo
```

**You'll find:**
- 10+ Grade 9 learners per grade
- Their admission numbers
- Current grades
- Enrollment status

### Step 1.2: Check Available Schools

**Sample Senior Schools in Catalog:**
- ~200+ schools across Kenya
- Categorized by: STEM | SOCIAL_SCIENCES | ARTS_SPORTS
- Classifications: C1 (top tier) → C4 (lowest)
- Filter by: county, gender, facilities, fees

### Step 1.3: Check Your User Role

**Your Super Admin Account:**
```bash
# These are in the database after seeding
Email: admin@trendscore.local (or similar)
Role: SUPER_ADMIN
Access Token: (generated during login)
```

---

## **PART 2: START THE SERVER**

```bash
npm run dev:ts

# Server runs on: http://localhost:5000
# Check it's running:
curl http://localhost:5000/health
```

**Output:** `{"status": "ok"}`

---

## **PART 3: GET YOUR AUTH TOKEN**

As Super Admin, you need a JWT token to test endpoints.

### Method 1: Use Admin Dashboard
1. Open http://localhost:3000 (frontend)
2. Login as: `admin@trendscore.local`
3. Copy token from browser DevTools → Application → Cookies → `accessToken`

### Method 2: Use API Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@trendscore.local",
    "password": "AdminPassword123!"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "role": "SUPER_ADMIN",
    "email": "admin@trendscore.local"
  }
}
```

**Save this token:**
```bash
export TOKEN="<your_token_here>"
```

---

## **PART 4: EXPLORE PATHWAYS STEP-BY-STEP**

### **STEP A: Get a Grade 9 Learner**

```bash
curl -X GET "http://localhost:5000/api/pathwayPlanner/learners?grade=GRADE_9&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response includes:**
```json
{
  "data": [{
    "id": "learner-abc123",
    "firstName": "John",
    "lastName": "Doe",
    "admissionNumber": "ADM-001",
    "grade": "GRADE_9",
    "academicYear": 2026
  }]
}
```

**Copy the learner ID:** `learner-abc123`

```bash
export LEARNER_ID="learner-abc123"
```

---

### **STEP B: Build Grade 9 Readiness Profile**

This analyzes the learner's academics, interests, and recommendations.

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/grade9-transition-readiness" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "term": "TERM_3",
    "academicYear": 2026,
    "learnerInterest": "STEM",
    "teacherRecommendation": "STEM",
    "parentPreference": null
  }'
```

**Response:**
```json
{
  "data": {
    "recommendation": {
      "recommendedPathway": "STEM",
      "confidence": 82,
      "justification": "Strong mathematics and science scores..."
    },
    "componentScores": {
      "academic": {
        "STEM": 85,
        "SOCIAL_SCIENCES": 62,
        "ARTS_SPORTS": 58
      }
    },
    "mismatchWarning": null
  }
}
```

**What this shows:**
- ✅ Recommended pathway: **STEM** (best fit)
- ✅ Confidence: **82/100** (high confidence)
- ✅ Breakdown: STEM (85) > Social (62) > Arts (58)
- ✅ No mismatch between learner interest & recommendation

---

### **STEP C: Submit Pathway Recommendation (As Counsellor)**

Now submit the staff recommendation:

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $TOKEN" \
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "decision-001",
    "learnerId": "learner-abc123",
    "recommendedPathway": "STEM",
    "confidenceScore": 82,
    "createdAt": "2026-08-07T12:14:05Z"
  }
}
```

**What happened:**
- ✅ Recommendation stored in database
- 📧 Email sent to parent & student
- 📱 Notifications created
- 📊 Decision history started (append-only audit trail)

---

### **STEP D: Simulate Parent Response**

The parent logs in and submits their preference:

```bash
# As PARENT (different user, same learner)
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/parent-preference" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentPreference": "STEM"
  }'
```

**Result:**
- ✅ Parent preference recorded
- ✅ Staff recommendation fields preserved
- ✅ Decision history updated with `parentPreference`
- If parent chose differently → `mismatchWarning` triggered

---

### **STEP E: View Decision History (Audit Trail)**

```bash
curl -X GET "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/transition-decision-history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response shows:**
```json
{
  "success": true,
  "data": [
    {
      "id": "decision-001",
      "learnerId": "learner-abc123",
      "recommendedPathway": "STEM",
      "confidenceScore": 82,
      "learnerInterest": "STEM",
      "teacherRecommendation": "STEM",
      "parentPreference": "STEM",
      "finalApprovedPathway": null,
      "analysisPayload": {
        "version": "GRADE9_READINESS_V1",
        "generatedAt": "2026-08-07T12:00:00Z",
        "persistedAt": "2026-08-07T12:14:05Z",
        "savedBy": "staff-001"
      },
      "createdAt": "2026-08-07T12:14:05Z"
    }
  ]
}
```

**What you see:**
- Complete audit trail
- All versions of the decision
- Who changed it and when
- Analysis methodology (`version: GRADE9_READINESS_V1`)

---

### **STEP F: Search Schools Matching This Pathway**

Now the learner wants to find STEM schools:

```bash
curl -X GET "http://localhost:5000/api/pathwayPlanner/senior-schools/search?pathway=STEM&county=Nairobi&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "school-001",
      "name": "Kenya High School",
      "county": "Nairobi",
      "pathwayCodes": ["STEM"],
      "classification": "C1",
      "gender": "GIRLS",
      "facilities": ["Laboratory", "Library", "ICT Lab"],
      "verificationStatus": "TREND_SCORE_VERIFIED"
    },
    {
      "id": "school-002",
      "name": "The Nairobi School",
      "county": "Nairobi",
      "pathwayCodes": ["STEM", "SOCIAL_SCIENCES"],
      "classification": "C1",
      "gender": "BOYS"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 42,
    "pages": 9
  }
}
```

**What you can do:**
- Filter by: pathway, county, classification, gender, affordabilityBand
- See school details, verification status
- Count matching schools (42 STEM schools in Nairobi)

---

### **STEP G: Finalize Pathway (Admin Lock)**

Only ADMIN can lock/finalize:

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendedPathway": "STEM",
    "confidenceScore": 82,
    "finalApprovedPathway": "STEM"
  }'
```

**Result:**
- ✅ `finalApprovedPathway: "STEM"` set (locks the pathway)
- 📧 Final notification sent
- ✅ Learner now proceeds to senior school selection
- 🔒 Cannot be changed without re-approval

---

## **PART 5: TEST PERMISSION CONTROLS**

### Test 1: Parent Tries Staff Endpoint (Should Fail)

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recommendedPathway": "STEM"}'
```

**Expected Response:**
```json
{
  "statusCode": 403,
  "message": "Parents must use the /parent-preference endpoint"
}
```

✅ **Permission control working!**

---

### Test 2: Student Tries to Update Preference (Should Fail)

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/parent-preference" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parentPreference": "ARTS_SPORTS"}'
```

**Expected Response:**
```json
{
  "statusCode": 403,
  "message": "This endpoint is for parent use only"
}
```

✅ **Permission control working!**

---

## **PART 6: VIEW CLASS DISTRIBUTION**

As Head of Curriculum, see how many students → each pathway:

```bash
curl -X GET "http://localhost:5000/api/pathwayPlanner/class/:classId/distribution" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "data": {
    "recommendations": {
      "STEM": 12,
      "SOCIAL_SCIENCES": 8,
      "ARTS_SPORTS": 5
    },
    "selections": {
      "DRAFT": 3,
      "SUBMITTED": 5,
      "APPROVED": 12,
      "LOCKED": 5,
      "NONE": 0
    }
  }
}
```

**Insights:**
- 12 students → STEM pathway
- 5 students haven't made selections yet (DRAFT)
- 5 selections locked and ready

---

## **COMPLETE DEMO FLOW SUMMARY**

```
┌─────────────────────────────────────┐
│ SUPER ADMIN EXPLORATION CHECKLIST    │
└─────────────────────────────────────┘

✅ Step 1: Get Grade 9 learner ID
✅ Step 2: Build readiness profile (analyze data)
✅ Step 3: Submit recommendation (STEM/Social/Arts)
✅ Step 4: Simulate parent response (preference)
✅ Step 5: View decision history (audit trail)
✅ Step 6: Search schools by pathway
✅ Step 7: Test permission controls (parent blocked)
✅ Step 8: Finalize pathway (lock as admin)
✅ Step 9: View class distribution
✅ Step 10: Verify notifications sent

ALL STEPS COMPLETE = PATHWAYS MODULE DEMO SUCCESS ✨
```

---

## **KEY ENDPOINTS SUMMARY**

| Action | Endpoint | Method | Role |
|--------|----------|--------|------|
| Get learners | `/api/pathwayPlanner/learners` | GET | ANY |
| Readiness analysis | `/api/pathwayRecommendation/:id/grade9-transition-readiness` | POST | STAFF |
| Submit recommendation | `/api/pathwayRecommendation/:id/save-transition-decision` | POST | STAFF |
| Parent preference | `/api/pathwayRecommendation/:id/parent-preference` | POST | PARENT |
| View history | `/api/pathwayRecommendation/:id/transition-decision-history` | GET | ANY |
| Search schools | `/api/pathwayPlanner/senior-schools/search` | GET | ANY |
| Class distribution | `/api/pathwayPlanner/class/:id/distribution` | GET | STAFF |

---

## **EXPECTED OUTCOMES**

After completing this exploration, you will have:

✅ Pathway recommendations working (STEM/Social/Arts)
✅ Parent input system verified
✅ Permission controls enforced
✅ Audit trail & versioning demonstrated
✅ School search functional
✅ Admin finalization working
✅ Notifications queued for delivery

**Status: 🟢 PATHWAY MODULE READY FOR PRODUCTION**
