# 🎓 PATHWAYS MODULE - COMPLETE TRAINING GUIDE

> **Validated status — 8 August 2026:** The core recommendation, preference, authorization, history and finalization-lock flows are implemented. Email/SMS steps in this training document remain rollout targets unless separately verified in the configured environment. Changing a finalized transition decision requires the reason-required, audited admin override API; a dedicated override UI remains future work.

## **WHAT IS THE PATHWAYS MODULE?**

The Pathways Module helps Grade 9 learners transition to Senior Secondary by:
1. **Analyzing** their academic strength (STEM, Social Sciences, or Arts)
2. **Recommending** the best pathway based on grades & interests
3. **Capturing** parent preferences separately
4. **Guiding** school selection based on pathway
5. **Auditing** all decisions with full versioning

**Three Pathways Available:**
- 🧪 **STEM** - Sciences, Mathematics, Technology (Kenya High, Lenana, etc.)
- 📚 **SOCIAL_SCIENCES** - History, Geography, Economics (Strathmore School, etc.)
- 🎨 **ARTS_SPORTS** - Languages, Arts, Physical Education (Alliance High, etc.)

---

## **WHO DOES WHAT? (Role Breakdown)**

### **1. 👨‍🏫 COUNSELLOR / HEAD OF CURRICULUM**
**Your Job:** Analyze learners and recommend pathways

**Steps:**
1. Review Grade 9 learner's grades & test scores
2. Run readiness analysis (analyzes academics, interests)
3. Submit pathway recommendation (STEM/Social/Arts + confidence score)
4. System notifies parent & student
5. Monitor if parent disagrees (mismatch warnings)

**Key Phrase:** "I recommend STEM because your science scores are excellent (85/100)"

---

### **2. 👨‍👩‍👧 PARENT**
**Your Job:** Agree or suggest different pathway

**Steps:**
1. Receive notification: "Pathway recommendation ready for review"
2. View staff recommendation (STEM/Social/Arts)
3. Submit preference: "I agree" OR "I prefer Arts instead"
4. System records preference alongside staff recommendation
5. Staff reviews if there's a mismatch

**Key Phrase:** "My child is creative, I think Arts is better"

---

### **3. 👤 STUDENT**
**Your Job:** Review and prepare for school selection

**Steps:**
1. Receive notification
2. View finalized pathway (staff + parent inputs)
3. Search for schools matching that pathway
4. Begin application process

**Key Phrase:** "I see I'm recommended for STEM, now let me find STEM schools"

---

### **4. 👨‍💼 ADMIN (You)**
**Your Job:** Oversee, verify, finalize

**Steps:**
1. Review all pending recommendations
2. Check for mismatches (staff vs parent)
3. Resolve conflicts if needed
4. **Finalize** pathway (locks it in)
5. Approve school applications

**Key Phrase:** "Everything looks good, I'm finalizing STEM for John"

---

## **STEP-BY-STEP TUTORIAL**

### **TUTORIAL PART 1: GET YOUR ADMIN TOKEN**

**Goal:** Authenticate as Super Admin to use the API

```bash
# Step 1: Open terminal and run:
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@trendscore.app",
    "password": "test"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123",
    "firstName": "Admin",
    "email": "admin@trendscore.app",
    "role": "SUPER_ADMIN"
  }
}
```

**Step 2: Save your token**
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

✅ **You're now authenticated as Super Admin!**

---

### **TUTORIAL PART 2: FIND A LEARNER TO WORK WITH**

**Goal:** Get a Grade 9 learner ready for pathway recommendation

```bash
curl -X GET "http://localhost:5000/api/pathwayPlanner/learners?grade=GRADE_9&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "learner-uuid-123",
    "firstName": "John",
    "lastName": "Doe",
    "admissionNumber": "ADM-2024-001",
    "grade": "GRADE_9",
    "academicYear": 2026
  }
}
```

**Step 2: Save learner ID**
```bash
export LEARNER_ID="learner-uuid-123"
```

✅ **You have a learner to work with!**

---

### **TUTORIAL PART 3: RUN READINESS ANALYSIS (The Brain of Pathways)**

**Goal:** Let the system analyze the learner's data and suggest a pathway

**What happens internally:**
- System reviews all Grade 9 grades
- Calculates strength in: Math, Sciences, Languages, etc.
- Scores in: STEM (0-100), SOCIAL_SCIENCES (0-100), ARTS_SPORTS (0-100)
- Compares with learner interest & teacher recommendation
- Flags mismatches

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
  "success": true,
  "data": {
    "recommendation": {
      "recommendedPathway": "STEM",
      "confidence": 85,
      "justification": "Excellent math (92) and science (88) scores. Teacher recommends STEM."
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

**What This Means:**
- ✅ **Best Pathway:** STEM (85/100)
- ✅ **Why:** Math & science scores are strongest
- ✅ **Confidence:** 85% sure this is correct
- ✅ **No Warning:** Learner interest matches recommendation

---

### **TUTORIAL PART 4: SUBMIT STAFF RECOMMENDATION**

**Goal:** As Counsellor, submit the official recommendation

**This step:**
- Records the recommendation in database
- Creates audit trail entry
- Sends notification to parent & student
- Starts decision history

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendedPathway": "STEM",
    "confidenceScore": 85,
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
    "id": "decision-uuid-001",
    "learnerId": "learner-uuid-123",
    "recommendedPathway": "STEM",
    "confidenceScore": 85,
    "createdAt": "2026-08-07T12:34:56Z"
  }
}
```

✅ **Recommendation submitted!**
📧 **Parent & student notified automatically**

---

### **TUTORIAL PART 5: PARENT SUBMITS PREFERENCE**

**Goal:** Simulate parent reviewing and responding to the recommendation

**As Parent (different user token needed):**

```bash
# Parent logs in and gets their token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "parent@demo.local", "password": "test"}'

# Save parent token
export PARENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Parent submits their preference
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/parent-preference" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentPreference": "STEM"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "decision-uuid-002",
    "learnerId": "learner-uuid-123",
    "recommendedPathway": "STEM",
    "parentPreference": "STEM",
    "createdAt": "2026-08-07T13:00:00Z"
  }
}
```

✅ **Parent preference recorded**
- Staff recommendation stays intact (STEM)
- Parent preference added (STEM)
- No mismatch warning

---

### **TUTORIAL PART 6: VIEW COMPLETE DECISION HISTORY (Audit Trail)**

**Goal:** See all changes and versioning

```bash
curl -X GET "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/transition-decision-history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "decision-uuid-002",
      "learnerId": "learner-uuid-123",
      "recommendedPathway": "STEM",
      "confidenceScore": 85,
      "learnerInterest": "STEM",
      "teacherRecommendation": "STEM",
      "parentPreference": "STEM",
      "finalApprovedPathway": null,
      "analysisPayload": {
        "version": "GRADE9_READINESS_V1",
        "generatedAt": "2026-08-07T12:00:00Z",
        "persistedAt": "2026-08-07T12:34:56Z",
        "savedBy": "staff-uuid-001"
      },
      "createdAt": "2026-08-07T13:00:00Z"
    },
    {
      "id": "decision-uuid-001",
      "learnerId": "learner-uuid-123",
      "recommendedPathway": "STEM",
      "confidenceScore": 85,
      "parentPreference": null,
      "createdAt": "2026-08-07T12:34:56Z"
    }
  ]
}
```

✅ **Full audit trail visible:**
- Decision 1: Staff submitted STEM (85% confidence)
- Decision 2: Parent confirmed STEM preference
- Can revert to any version if needed

---

### **TUTORIAL PART 7: SEARCH SCHOOLS FOR THIS PATHWAY**

**Goal:** Find schools matching STEM pathway

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
      "facilities": ["Laboratory", "ICT Lab", "Library"],
      "verificationStatus": "TREND_SCORE_VERIFIED",
      "minimumKcpeGrade": "A"
    },
    {
      "id": "school-002",
      "name": "Nairobi School",
      "county": "Nairobi",
      "pathwayCodes": ["STEM"],
      "classification": "C1",
      "gender": "BOYS"
    },
    {
      "id": "school-003",
      "name": "Bishops School",
      "county": "Nairobi",
      "pathwayCodes": ["STEM", "SOCIAL_SCIENCES"],
      "classification": "C2",
      "gender": "MIXED"
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

✅ **Found 42 STEM schools in Nairobi**
- Can filter by: gender, classification, facilities, fees
- Student can now apply to schools

---

### **TUTORIAL PART 8: FINALIZE PATHWAY (Admin Lock)**

**Goal:** As Admin, lock the pathway so learner can proceed

```bash
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendedPathway": "STEM",
    "confidenceScore": 85,
    "finalApprovedPathway": "STEM"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "decision-uuid-003",
    "learnerId": "learner-uuid-123",
    "recommendedPathway": "STEM",
    "finalApprovedPathway": "STEM",
    "createdAt": "2026-08-07T14:00:00Z"
  }
}
```

✅ **Pathway locked and finalized**
- 🔒 Cannot be changed without new admin approval
- 📧 Final notification sent
- ✅ Learner proceeds to senior school application

---

## **ADVANCED: HANDLE MISMATCHES**

### **Scenario: Parent Disagrees with Recommendation**

**Example:** Staff recommends STEM (90 confidence), but parent prefers Arts

```bash
# Parent submits different preference
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/parent-preference" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parentPreference": "ARTS_SPORTS"}'
```

**What You'll See in History:**
```json
{
  "recommendedPathway": "STEM",        // Staff recommendation
  "parentPreference": "ARTS_SPORTS",   // Parent different choice
  "mismatchWarning": "Parent prefers ARTS_SPORTS but staff recommends STEM"
}
```

**Your Action as Counsellor:**
1. ✅ Review the mismatch
2. ✅ Talk to parent about why staff recommended STEM
3. ✅ Check learner's actual scores/interest
4. ✅ Either: Accept parent choice OR Present evidence for STEM
5. ✅ Document decision in counsellor notes

---

## **PERMISSION MATRIX (What Each Role Can Do)**

| Action | PARENT | STUDENT | COUNSELLOR | ADMIN |
|--------|--------|---------|-----------|-------|
| View recommendation | ✅ | ✅ | ✅ | ✅ |
| Submit preference | ✅ | ❌ | ❌ | ❌ |
| Submit recommendation | ❌ | ❌ | ✅ | ✅ |
| Finalize pathway | ❌ | ❌ | ❌ | ✅ |
| Search schools | ✅ | ✅ | ✅ | ✅ |
| View history | ✅ | ✅ | ✅ | ✅ |

---

## **COMMON QUESTIONS ANSWERED**

### **Q1: What if learner interest ≠ test scores?**
**A:** System flags `mismatchWarning`. You should investigate:
- Is learner interested in something they're not good at?
- Need intervention/tutoring?
- Or should we respect learner choice despite scores?

### **Q2: Can parent change their preference after it's finalized?**
**A:** NO. Once admin sets `finalApprovedPathway`, it's locked. Parent can submit new preference, but it won't change the approved pathway. Only admin can modify.

### **Q3: What if a school offers multiple pathways?**
**A:** Student still gets one STEM/Social/Arts. School might offer "STEM and Social", but learner is placed in one based on grades.

### **Q4: How is confidence score calculated?**
**A:** Based on cluster scores:
- If STEM score is 85/100 → High confidence
- If all three scores are similar (60/65/60) → Low confidence (can't decide)

### **Q5: Can I undo a recommendation?**
**A:** YES - submit new recommendation. System appends to history (doesn't delete). Full audit trail preserved.

---

## **QUICK REFERENCE CHEAT SHEET**

```bash
# 1. GET TOKEN
export TOKEN="..."

# 2. FIND LEARNER
curl -X GET "http://localhost:5000/api/pathwayPlanner/learners?grade=GRADE_9" \
  -H "Authorization: Bearer $TOKEN"
export LEARNER_ID="..."

# 3. ANALYZE
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/grade9-transition-readiness" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"term":"TERM_3","academicYear":2026,"learnerInterest":"STEM","teacherRecommendation":"STEM"}'

# 4. SUBMIT RECOMMENDATION
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"recommendedPathway":"STEM","confidenceScore":85}'

# 5. VIEW HISTORY
curl -X GET "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/transition-decision-history" \
  -H "Authorization: Bearer $TOKEN"

# 6. SEARCH SCHOOLS
curl -X GET "http://localhost:5000/api/pathwayPlanner/senior-schools/search?pathway=STEM&county=Nairobi" \
  -H "Authorization: Bearer $TOKEN"

# 7. FINALIZE
curl -X POST "http://localhost:5000/api/pathwayRecommendation/$LEARNER_ID/save-transition-decision" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"recommendedPathway":"STEM","finalApprovedPathway":"STEM"}'
```

---

## **SUCCESS METRICS**

After completing this training, you should be able to:

- ✅ Authenticate and get tokens
- ✅ Find Grade 9 learners
- ✅ Run readiness analysis
- ✅ Submit pathway recommendations
- ✅ Handle parent preferences
- ✅ View complete audit trail
- ✅ Search schools by pathway
- ✅ Finalize pathways
- ✅ Handle mismatches
- ✅ Understand permission controls

**🎓 When all are checked → You're a Pathways Expert!**

---

## **NEXT STEPS**

1. **Try Tutorial Part 1-4 now** → Submit recommendations
2. **Test Permission Controls** → Try endpoints you shouldn't access
3. **Check Multi-Learner Flow** → Do 3-5 learners in parallel
4. **Monitor Class Distribution** → See all pathways in one class
5. **Verify Notifications** → Check email/SMS alerts work

**Questions? Ask me for clarification on any step!**
