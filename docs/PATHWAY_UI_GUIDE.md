# 🎓 PATHWAYS MODULE - USER EXPERIENCE GUIDE

> **Validated status — 8 August 2026:** The UI and API flow is implemented for recommendations, preferences, review and locking. Email/SMS examples below are illustrative rollout targets; the completion pass verified the in-app notification path only. A finalized transition decision rejects ordinary edits; a reason-required, audited admin override API exists while its dedicated interface remains future work.

## **HOW TO ACCESS THE PATHWAY MODULE AS DIFFERENT USERS**

---

## **PART 1: SUPER ADMIN / COUNSELLOR VIEW** 👨‍🏫

### **Access Point:**
1. Open `http://localhost:3000`
2. Sign in with a provisioned demo administrator account from the deployment secret store. Do not copy passwords into this guide.
3. Navigate to: **Dashboard → Pathway Planner** (or similar)

### **What You'll See:**
- List of Grade 9 learners ready for recommendations
- Each learner's current grades and test scores
- "Start Recommendation" button for each learner

### **The Counsellor Workflow:**

#### **Step 1: Select a Learner**
```
Click on: "John Doe - ADM-2024-001"
↓
System shows:
- Grade 9 performance summary
- Subject strengths: Math (92), Science (88), English (75)
- Teacher notes: "Strong in sciences"
```

#### **Step 2: View Readiness Analysis**
```
System automatically calculates:
┌─────────────────────────────────┐
│ RECOMMENDED PATHWAY: STEM       │
│ Confidence: 85%                 │
│                                 │
│ Component Scores:               │
│ • STEM: 85/100  ▓▓▓▓▓▓░░░ ✓    │
│ • Social: 62/100 ▓▓▓░░░░░░░     │
│ • Arts: 58/100  ▓▓░░░░░░░░     │
│                                 │
│ Why STEM? Strong math &         │
│ science foundation. Mathematics │
│ grade of A supports STEM track. │
└─────────────────────────────────┘
```

#### **Step 3: Add Your Recommendation**
```
Fill in form:
┌─────────────────────────────────┐
│ Recommended Pathway: STEM ▼     │
│ Confidence: 85                  │
│ Teacher Note: Strong in STEM    │
│                                 │
│ Learner Interest: STEM          │
│ Parent Input: (Not yet)         │
│                                 │
│ [SUBMIT RECOMMENDATION]         │
└─────────────────────────────────┘

✅ Submitted!
📧 Email sent to parent
📱 Notification sent to student
```

---

## **PART 2: PARENT VIEW** 👨‍👩‍👧

### **Access Point:**
1. Parent receives: **Email/SMS notification** "Pathway recommendation ready"
2. Or logs into portal: `http://localhost:3000`
3. Navigate to: **Student Dashboard → Pathway Status**

### **The Parent Workflow:**

#### **Step 1: Receive Notification**
```
📧 Email:
Subject: John's pathway recommendation is ready

"We've analyzed John's performance and recommend STEM pathway.
Please review and share your preference: [LINK]"
```

#### **Step 2: View Staff Recommendation**
```
┌───────────────────────────────────────┐
│ JOHN'S PATHWAY RECOMMENDATION        │
├───────────────────────────────────────┤
│                                       │
│ Staff Recommendation: STEM ✓          │
│ Confidence: 85%                       │
│                                       │
│ Justification:                        │
│ "John demonstrates strong aptitude    │
│  in mathematics (92) and science (88).│
│  STEM pathway aligns with academic    │
│  performance and teacher input."      │
│                                       │
│ Teacher Notes: "Excellent problem     │
│ solver, asks great questions"         │
│                                       │
└───────────────────────────────────────┘
```

#### **Step 3: Submit Parent Preference**
```
Option A: I AGREE with recommendation
┌─────────────────────────────────┐
│ ☑ Yes, I agree STEM is best     │
│                                 │
│ [CONFIRM PREFERENCE]            │
└─────────────────────────────────┘

Option B: I PREFER something else
┌─────────────────────────────────┐
│ ☐ No, I prefer:                 │
│    ☑ SOCIAL_SCIENCES            │
│                                 │
│ Reason: "John loves history"    │
│                                 │
│ [SUBMIT DIFFERENT PREFERENCE]   │
└─────────────────────────────────┘
```

#### **Step 4: View Status**
```
After submission:
┌───────────────────────────────────────┐
│ PATHWAY STATUS: PENDING ADMIN REVIEW  │
├───────────────────────────────────────┤
│                                       │
│ Staff Recommendation: STEM            │
│ Your Preference: SOCIAL_SCIENCES ⚠️  │
│                                       │
│ Status: Waiting for admin to finalize │
│ Last Update: Today 2:30 PM            │
│                                       │
└───────────────────────────────────────┘

⚠️ Note: "We see you prefer Social Sciences
    but staff recommended STEM. The counsellor
    will review and discuss with you."
```

---

## **PART 3: STUDENT VIEW** 👤

### **Access Point:**
1. Student logs into: `http://localhost:3000`
2. Navigate to: **Student Portal → Pathways** or **My Dashboard**

### **The Student Workflow:**

#### **Step 1: Receive Notification**
```
📱 In-app notification:
"Your pathway recommendation is ready! 
Staff recommended STEM based on your academic strengths."

🔔 Notification count: 1
```

#### **Step 2: View Recommendation**
```
┌─────────────────────────────────────────┐
│ 📚 YOUR PATHWAY RECOMMENDATION          │
├─────────────────────────────────────────┤
│                                         │
│ RECOMMENDED: STEM                       │
│ Confidence: 85%                         │
│                                         │
│ Your Strengths:                         │
│ • Math: A (92) - Strong! ⭐⭐⭐         │
│ • Science: A (88) - Strong! ⭐⭐⭐      │
│ • English: B (75)                       │
│                                         │
│ Next Steps:                             │
│ ✓ Recommendation submitted              │
│ ⏳ Parent reviewing...                  │
│ ⏳ Waiting for admin approval           │
│                                         │
└─────────────────────────────────────────┘
```

#### **Step 3: View Complete Status**
```
Timeline View:
┌──────────────────────────────────────┐
│ PATHWAY JOURNEY                      │
├──────────────────────────────────────┤
│                                      │
│ ✅ Aug 1 - Recommendation submitted  │
│    "STEM based on your grades"       │
│                                      │
│ ⏳ Aug 2 - Parent reviewing...       │
│    "Your parent is reviewing..."     │
│                                      │
│ ⏳ Aug 3 - Awaiting finalization     │
│    "Admin will finalize soon"        │
│                                      │
│ (Once finalized)                     │
│ 🎯 Next: School Selection            │
│    "Find STEM schools & apply"       │
│                                      │
└──────────────────────────────────────┘
```

#### **Step 4: Search Schools (Once Pathway is Finalized)**
```
After admin locks pathway → button appears:

[🔍 EXPLORE STEM SCHOOLS]

┌────────────────────────────────────┐
│ FIND SENIOR SCHOOLS - STEM         │
├────────────────────────────────────┤
│                                    │
│ Filter by:                         │
│ • County: Nairobi ▼               │
│ • Gender: GIRLS ▼                 │
│ • Type: MIXED ▼                   │
│ • Budget: Any ▼                   │
│                                    │
│ [SEARCH]                           │
│                                    │
├────────────────────────────────────┤
│ 🎓 Kenya High School (STEM)        │
│    📍 Nairobi | 👧 Girls          │
│    ⭐⭐⭐⭐⭐ | Grade: A+            │
│    Facilities: Lab, ICT, Library   │
│    [VIEW] [APPLY]                  │
│                                    │
│ 🎓 Lenana School (STEM)            │
│    📍 Nairobi | 👧 Girls          │
│    ⭐⭐⭐⭐⭐ | Grade: A             │
│    [VIEW] [APPLY]                  │
│                                    │
│ 🎓 Alliance High (STEM)            │
│    📍 Nairobi | 👬 Mixed          │
│    ⭐⭐⭐⭐ | Grade: A              │
│    [VIEW] [APPLY]                  │
│                                    │
└────────────────────────────────────┘

Showing 1-3 of 42 STEM schools
[Load More] [Next Page]
```

---

## **PART 4: ADMIN FINALIZATION VIEW** 👨‍💼

### **Access Point:**
1. Login as Admin
2. Navigate to: **Admin → Pathway Management** or **Dashboard**

### **The Admin Workflow:**

#### **Step 1: View All Pending Recommendations**
```
┌──────────────────────────────────────────┐
│ 📊 PENDING PATHWAY APPROVALS             │
├──────────────────────────────────────────┤
│                                          │
│ Showing 5 of 28 pending                 │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ John Doe - ADM-2024-001            │  │
│ │ Staff: STEM (85%)                  │  │
│ │ Parent: STEM ✓ (agree)             │  │
│ │ Status: ✅ Ready to finalize       │  │
│ │ [APPROVE] [REVIEW]                 │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ Sarah Kim - ADM-2024-002           │  │
│ │ Staff: SOCIAL_SCIENCES (78%)       │  │
│ │ Parent: ARTS_SPORTS ⚠️ (disagree)  │  │
│ │ Status: ⚠️ Needs review            │  │
│ │ [DISCUSS] [OVERRIDE] [HOLD]        │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ Michael Omondi - ADM-2024-003      │  │
│ │ Staff: STEM (65%)                  │  │
│ │ Parent: (not yet submitted)        │  │
│ │ Status: ⏳ Waiting for parent      │  │
│ │ [SEND REMINDER] [HOLD]             │  │
│ └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

#### **Step 2: Review Mismatch (If Parent Disagreed)**
```
Click: [DISCUSS] on Sarah Kim's record

┌──────────────────────────────────────┐
│ ⚠️ PATHWAY MISMATCH REVIEW            │
├──────────────────────────────────────┤
│                                      │
│ Learner: Sarah Kim                   │
│                                      │
│ Academic Data:                       │
│ • Math: 65 (average)                │
│ • Science: 60 (average)             │
│ • English: 88 (strong) ⭐⭐⭐       │
│ • History: 92 (strong) ⭐⭐⭐⭐    │
│ • Art: 95 (exceptional) ⭐⭐⭐⭐⭐ │
│                                      │
│ Staff Recommendation:                │
│ "SOCIAL_SCIENCES (78% confidence)    │
│  - Strong in history & languages"    │
│                                      │
│ Parent Preference:                   │
│ "ARTS_SPORTS - Sarah is creative &   │
│  artistic, excels in art class"      │
│                                      │
│ Analysis:                            │
│ Parent has a point! Sarah's art      │
│ score (95) is exceptional. Could go  │
│ ARTS_SPORTS with guidance.           │
│                                      │
│ Options:                             │
│ ☑ APPROVE PARENT CHOICE: ARTS_SPORTS │
│   (art is genuine strength)          │
│ □ OVERRIDE: Keep SOCIAL_SCIENCES    │
│   (more academic security)          │
│ □ HOLD: Need more discussion         │
│                                      │
│ [APPROVE PARENT] [OVERRIDE] [HOLD]  │
│                                      │
└──────────────────────────────────────┘
```

#### **Step 3: Finalize Pathway**
```
Click: [APPROVE] on John Doe's record

┌──────────────────────────────────────┐
│ ✅ FINALIZING PATHWAY                │
├──────────────────────────────────────┤
│                                      │
│ Learner: John Doe                    │
│ Final Pathway: STEM                  │
│ Status: LOCKED ✓                     │
│                                      │
│ [CONFIRM FINALIZATION]               │
│                                      │
│ (Confirmation required - no undo)   │
│                                      │
└──────────────────────────────────────┘

✅ Success!
📧 Email sent: "Your pathway is now finalized"
📧 Email to parent: Confirmation
🔔 Student notified: Can now search schools
```

---

## **PART 5: CLASS DISTRIBUTION VIEW (HEAD OF CURRICULUM)** 📊

### **Access Point:**
1. Login as Head of Curriculum
2. Navigate to: **Analytics → Pathway Distribution**

### **What You'll See:**
```
┌──────────────────────────────────────────┐
│ CLASS: Grade 9A - 2026                   │
├──────────────────────────────────────────┤
│                                          │
│ Pathway Distribution:                    │
│                                          │
│ 🧪 STEM:              12 learners        │
│    ▓▓▓▓▓▓▓░░░░ 48%                      │
│                                          │
│ 📚 SOCIAL_SCIENCES:    8 learners        │
│    ▓▓▓▓░░░░░░░░ 32%                     │
│                                          │
│ 🎨 ARTS_SPORTS:       5 learners         │
│    ▓▓░░░░░░░░░░ 20%                     │
│                                          │
├──────────────────────────────────────────┤
│ Selection Status:                        │
│                                          │
│ ✅ FINALIZED:         12 learners        │
│ ⏳ PENDING:           10 learners        │
│ ⚠️ MISMATCHES:         3 learners        │
│ 🟡 NEEDS ATTENTION:    2 learners        │
│                                          │
│ [VIEW MISMATCHES] [SEND REMINDERS]      │
│                                          │
└──────────────────────────────────────────┘
```

---

## **PART 6: KEY UI COMPONENTS EXPLAINED**

### **Status Indicators** 🎯
```
✅ FINALIZED     = Locked in, learner can apply to schools
⏳ PENDING       = Waiting for next step
⚠️ MISMATCH      = Parent & staff disagreed
🟡 HOLD          = Admin reviewing
📧 AWAITING      = Waiting for parent input
🔓 UNLOCK        = Can be changed (before finalization)
🔒 LOCKED        = Cannot change (after finalization)
```

### **Confidence Score Visual** 📊
```
90-100%: ▓▓▓▓▓▓▓▓▓▓ Very Confident (Go with recommendation)
80-89%:  ▓▓▓▓▓▓▓▓░░ Confident (Safe choice)
70-79%:  ▓▓▓▓▓▓░░░░ Moderately Confident (Can go either way)
60-69%:  ▓▓▓▓░░░░░░ Low Confidence (Needs discussion)
<60%:    ▓▓░░░░░░░░ Very Low Confidence (Needs review)
```

### **Component Score Breakdown** 📈
```
STEM Score:
What it includes: Math + Physics + Chemistry + Biology
Displays as: "85/100 - Strong foundation in sciences"

SOCIAL_SCIENCES Score:
What it includes: History + Geography + Economics
Displays as: "62/100 - Adequate, but not strongest area"

ARTS_SPORTS Score:
What it includes: English + Kiswahili + Art + PE + Drama
Displays as: "58/100 - Below average, not recommended"
```

---

## **PART 7: NOTIFICATIONS & COMMUNICATIONS**

### **What Each User Receives:**

**PARENT Gets:**
- 📧 Email: "Pathway recommendation ready for review"
- 📱 SMS: "Click here to see John's pathway"
- 🔔 In-app: Notification badge

**STUDENT Gets:**
- 📧 Email: "Your pathway recommendation is ready!"
- 📱 SMS: "Check your pathway dashboard"
- 🔔 In-app: "STEM recommended for you"

**ADMIN Gets:**
- 📧 Email: "Pending pathways awaiting approval: 5"
- 🔔 In-app: Dashboard showing pending count

**COUNSELLOR Gets:**
- 📧 Email: "Parent disagreed with your STEM recommendation for Sarah"
- 🔔 In-app: Flag showing which recommendations have issues

---

## **PART 8: COMPLETE USER JOURNEY (Timeline)**

### **Monday: Assessments Complete**
```
System: Grades entered, ready for analysis
Counsellor: Sees notification "Ready to recommend"
```

### **Tuesday: Recommendation Submitted**
```
Counsellor: Submits STEM for 25 learners
System: 📧 All parents notified
```

### **Wednesday-Thursday: Parent Input**
```
Parents: Review & submit preferences
Sarah's parent: "We prefer ARTS_SPORTS"
System: 🚩 Flags mismatch for admin
```

### **Friday: Admin Finalization**
```
Admin: Reviews 25 pending
Approves 22 (no issues)
Discusses 3 (mismatches)
Finalizes: 25 pathways locked ✅
System: 📧 Students notified → can apply to schools
```

### **Next Week: School Selection**
```
Student: 📱 "Open [SEARCH STEM SCHOOLS]"
Browse: Kenya High, Lenana, Alliance
Apply: Submit applications
Admin: Approves school placements
```

---

## **HOW TO TEST THIS NOW**

1. **Open Frontend:** `http://localhost:3000`
2. **Login as Counsellor:** `counsellor@demo.local` / `Demo@123!`
3. **Navigate to:** Pathway Planner
4. **Select a learner** and follow the recommendation flow
5. **Logout and login as Parent** to see their view
6. **Then login as Student** to see their view

---

## **REAL USER TESTING SCENARIO**

### **Test as Counsellor:**
```
1. Login: counsellor@demo.local
2. Go to: Pathway Planner
3. Click: "Start Recommendation" on John Doe
4. System shows: Analysis (STEM 85%)
5. You confirm: "Yes, STEM"
6. You submit form
7. ✅ John notified, parent gets email
```

### **Test as Parent:**
```
1. Logout
2. Login: parent@demo.local
3. Go to: My Child → Pathway
4. View: "STEM recommended"
5. You choose: "I prefer ARTS_SPORTS"
6. ✅ Mismatch flagged for counsellor
```

### **Test as Admin:**
```
1. Logout
2. Login: admin@trendscore.app
3. Go to: Pathway Management
4. See: John's (STEM, parent agrees) ✅
5. See: Sarah's (STEM, parent disagrees) ⚠️
6. You review Sarah, approve parent's ARTS_SPORTS
7. You finalize both
8. ✅ Students can now apply to schools
```

---

## **KEY TAKEAWAY**

The training docs explain the **WHAT and WHY**.
The UI shows the **HOW** from a user's perspective.

Combined: You understand both the technical backend AND the user experience!
