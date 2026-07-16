# Assignment Creation - End-to-End Process

## Overview
This document outlines the complete process of creating an assignment in TrendScore LMS, from initial conception to student submission and teacher grading.

---

## Phase 1: Access Assignment Builder

### 1.1 Navigation
```
School Portal Homepage
    ↓
Click "Learning" (top menu)
    ↓
Click "Assignments" tab
    ↓
Click "+ Create New Assignment" button
```

### 1.2 System Loads
- Fetches available classes
- Fetches available streams
- Fetches available learning areas (subjects)
- Fetches available terms
- Auto-selects active term if creating new assignment
- Initializes empty form with defaults

### 1.3 User Role Check
- Verifies user is TEACHER or HEAD_TEACHER
- Checks LEARNING_MANAGE permission
- If unauthorized → Display permission error
- If authorized → Load assignment builder form

---

## Phase 2: Fill Basic Information

### 2.1 Title
```
Field: "Assignment Title"
Type: Text input (required)
Max length: 255 characters
Example: "Chapter 5 - Quadratic Equations Homework"
Validation: Must be non-empty
Error: "Title is required"
```

### 2.2 Category Selection
```
Field: "Category"
Type: Dropdown (required)
Options:
  - HOMEWORK (default)
  - PROJECT
  - REVISION
  - HOLIDAY_WORK
  - RESEARCH
  - READING
  - PRACTICAL
  - GROUP_WORK

Selection affects:
  - Default settings
  - Student notifications
  - Analytics categorization
```

### 2.3 Target Audience
```
Class Selection:
├─ Field: "Class"
├─ Type: Dropdown (required)
├─ Loads from database
├─ Example: "Form 2", "Grade 7", "Primary 5"
└─ Triggers: Load streams for that class

Stream Selection (optional):
├─ Field: "Stream"
├─ Type: Dropdown
├─ Dependent on class selection
├─ Example: "Stream A", "Stream B"
└─ If empty: Assignment goes to entire class

Learning Area (Subject):
├─ Field: "Learning Area"
├─ Type: Dropdown (required)
├─ Example: "Mathematics", "English", "Science"
└─ Validation: Must be selected

Term:
├─ Field: "Term"
├─ Type: Dropdown (required)
├─ Auto-populated: Active term
├─ Example: "Term 1 2026", "Term 2 2026"
└─ Can be changed manually
```

---

## Phase 3: Add Instructions & Content

### 3.1 Instructions/Description
```
Field: "Instructions"
Type: Rich text editor (optional)
Features:
  - Bold, Italic, Underline
  - Bullet points & numbering
  - Headings (H1-H3)
  - Links
  - Code blocks
Max length: 10,000 characters

Example:
"Complete the following problems from your textbook:
• Page 45: Questions 1-10
• Page 47: Questions 5-15

Show all working. Calculators are NOT permitted.
Submit as a single PDF file."
```

### 3.2 Attach Resources (Optional)
```
Option A: Upload from Computer
├─ Supported formats:
│  ├─ PDF (.pdf)
│  ├─ Word (.doc, .docx)
│  ├─ Excel (.xls, .xlsx)
│  ├─ PowerPoint (.ppt, .pptx)
│  └─ Images (.jpg, .png, .gif)
├─ Max file size: 25MB (configurable)
├─ Method 1: Click upload button
├─ Method 2: Drag and drop
└─ Display: File name + size shown

Option B: Link from Web
├─ Paste external URL
├─ Example: YouTube video link, Google Doc
└─ Students click to open in new tab

Option C: Link from Revision Library
├─ Browse existing resources
├─ Select past papers, study guides, etc.
└─ Students access directly
```

---

## Phase 4: Configure Grading

### 4.1 Marks Setup
```
Total Marks (required):
├─ Field: "Total Marks"
├─ Type: Number input
├─ Min: 0, Max: 1000
├─ Example: 50
└─ Used for percentage calculations

Pass Mark (optional):
├─ Field: "Pass Mark"
├─ Type: Number input
├─ Max: Total Marks
├─ Example: 25 (50% of 50)
└─ Used to determine pass/fail

Calculated Fields:
├─ Pass Percentage: (Pass Mark / Total Marks) * 100
├─ Example: (25 / 50) * 100 = 50%
└─ Displayed to students
```

### 4.2 Rubric Builder (Optional)
```
Rubric: Detailed marking criteria

Example Rubric:
┌─────────────────────────┬────────┬─────────────────────────┐
│ Criterion               │ Marks  │ Description             │
├─────────────────────────┼────────┼─────────────────────────┤
│ Problem 1-5 Correct     │ 15     │ All calculations right  │
│ Problem 6-10 Correct    │ 15     │ Shows working           │
│ Presentation/Layout     │ 10     │ Clear, organized        │
│ Method & Understanding  │ 10     │ Demonstrates concept    │
└─────────────────────────┴────────┴─────────────────────────┘
TOTAL:                    50

Steps to Create:
1. Click "+ Add Rubric Row"
2. Enter criterion name (e.g., "Problem 1-5 Correct")
3. Enter marks for criterion (e.g., 15)
4. (Optional) Add description
5. Repeat for each criterion
6. Total marks auto-calculated and validated
7. If total ≠ total marks → Display warning

Validation:
├─ Each criterion has name and marks
├─ Total marks from rubric = Total marks field
├─ Cannot publish if mismatch
└─ Auto-validate and show error
```

---

## Phase 5: Set Submission Rules

### 5.1 Deadline Configuration
```
Due Date (required for publishing):
├─ Field: "Due Date"
├─ Type: Date picker (YYYY-MM-DD format)
├─ Example: 2026-07-15
└─ Validation: Cannot be in past

Due Time (optional):
├─ Field: "Due Time"
├─ Type: Time picker (HH:MM format)
├─ Default: 23:59 (end of day)
├─ Example: 14:30
└─ Combined with date for exact deadline

Combined Deadline:
├─ Display: "Due 15 Jul 2026 at 23:59"
├─ Timezone: School's configured timezone
└─ Used for: Late submission detection

Estimated Time:
├─ Field: "Estimated Time (minutes)"
├─ Type: Number input
├─ Example: 60 (for 1 hour assignment)
├─ Display to students
└─ Help them plan workload
```

### 5.2 Submission Behavior
```
Allow Late Submission:
├─ Field: Checkbox "Allow Late Submission"
├─ Default: Checked (true)
├─ If enabled:
│  ├─ Students can submit after due date
│  ├─ Marked as "LATE" in system
│  ├─ Teacher can apply late penalty
│  └─ Can set deadline for late submissions
└─ If disabled:
   ├─ Submission box closes at due time
   ├─ Students see "Submission Closed"
   └─ Late submissions rejected

Allow Resubmission:
├─ Field: Checkbox "Allow Resubmission"
├─ Default: Unchecked (false)
├─ If enabled:
│  ├─ Students can submit multiple times
│  ├─ System keeps version history
│  ├─ Teacher can compare versions
│  ├─ Teacher marks latest version (default)
│  └─ Good for iterative feedback
└─ If disabled:
   ├─ Only one submission allowed
   └─ Student locked after first submission
```

### 5.3 File Configuration
```
Max File Size:
├─ Field: "Max File Size (MB)"
├─ Type: Number input
├─ Default: 25 MB
├─ Example: 10 (for small files)
├─ Used for upload validation
└─ Error if exceeded: "File too large"

Allowed File Types (advanced):
├─ Field: "Allowed File Types"
├─ Type: Multi-select or comma-separated list
├─ If empty: All types allowed
├─ Example: .pdf, .doc, .docx
├─ Backend validates MIME type
└─ Error if disallowed: "File type not allowed"
```

---

## Phase 6: Additional Settings

### 6.1 Gradebook Sync
```
Field: Checkbox "Sync marks to gradebook"
Default: Unchecked (false)

If enabled:
├─ Marks automatically recorded in gradebook
├─ Contributes to cumulative grade
├─ Updates student progress
├─ Updates class analytics
└─ Teachers see in reports

If disabled:
├─ Marks only visible in LMS
├─ Doesn't affect overall grade
├─ Good for formative assessment
└─ No gradebook impact
```

### 6.2 CBC Outcomes (Optional)
```
Field: "CBC Learning Outcomes"
Type: Multi-select checkboxes
Purpose: Link assignment to curriculum
Example: "Learner can solve quadratic equations"
Use: Analytics & curriculum mapping
Impact: Tracked in student portfolio
```

---

## Phase 7: Save & Publish

### 7.1 Save as Draft
```
Button: "Save as Draft"
Location: Bottom of form

Action:
1. Validate required fields only:
   ├─ Title ✓
   ├─ Class ✓
   ├─ Learning Area ✓
   ├─ Term ✓
   └─ Category ✓

2. Create database record:
   └─ Status: "DRAFT"

3. Success:
   ├─ Show toast notification: "Draft saved"
   ├─ Redirect to assignments list
   └─ User can edit later

Error handling:
├─ If validation fails → Show errors
├─ If API fails → Show error message
└─ User can retry
```

### 7.2 Publish Assignment
```
Button: "Publish" (or "Send")
Location: Bottom of form

Pre-publish Checks:
1. Validate all required fields
2. Check Due Date is set
3. Check rubric total = total marks (if rubric exists)
4. Warn if no instructions/resources

Process:
1. Create/Update assignment in DB with status: "DRAFT"
2. Call endpoint: POST /api/lms/assignments/{id}/publish
3. System changes status to: "PUBLISHED"
4. Assignment becomes visible to target class
5. Students can see in their assignment list

Validations:
├─ Title: Required, non-empty
├─ Class: Required
├─ Learning Area: Required
├─ Term: Required
├─ Category: Required
├─ Due Date: Required (must be set)
├─ Due Time: Optional (defaults to 23:59)
└─ Rubric: Must match total marks if exists

Success:
├─ Toast: "Assignment published successfully"
├─ Redirect to assignments list
├─ Show "PUBLISHED" badge
└─ Students notified

Failure:
├─ Show error: "Failed to publish assignment"
├─ Display specific validation error
├─ Allow user to fix and retry
└─ Draft remains saved
```

---

## Phase 8: Student View & Submission

### 8.1 Students See Assignment
```
After publishing, students in target class see:

In "Assignments" Tab:
├─ Title: "Chapter 5 - Quadratic Equations"
├─ Subject: "Mathematics"
├─ Due date: "15 Jul 2026 at 23:59"
├─ Status badge: "Pending"
├─ Class average (after grading): "75%"
└─ Action: "View" or "Submit"

Click "View Assignment":
├─ Show full details:
│  ├─ Instructions text
│  ├─ Attached resources
│  ├─ Due date & time
│  ├─ Total marks
│  ├─ Estimated time
│  ├─ Rubric (visible)
│  └─ Late submission allowed? Yes/No
└─ Button: "Submit Work"
```

### 8.2 Student Submission
```
Click "Submit Work" button:

Submission Dialog Opens:
├─ File upload field
├─ Drag-and-drop area
├─ Max file size displayed: "Max 25 MB"
├─ Accepted formats: .pdf, .doc, .docx, etc.
└─ Button: "Upload & Submit"

Student uploads file:
├─ Validation:
│  ├─ File size < max (25 MB)
│  ├─ File type allowed
│  ├─ File scanned for viruses
│  └─ User verification: "Submit assignment?"
├─ Success:
│  ├─ API: POST /api/lms/assignments/{id}/submissions
│  ├─ Submission recorded with:
│  │  ├─ Student ID
│  │  ├─ File content
│  │  ├─ Timestamp
│  │  ├─ Status: "SUBMITTED"
│  │  └─ Attempt #1
│  ├─ Toast: "Assignment submitted successfully"
│  └─ Student sees status: "Submitted on 10 Jul 2026 at 14:30"
└─ Error:
   ├─ Show error message
   └─ Allow retry
```

### 8.3 Resubmission (if enabled)
```
If "Allow Resubmission" is enabled:

After first submission:
├─ Button changes to: "Resubmit Work"
├─ Previous submission visible:
│  ├─ Date/time
│  ├─ File download link
│  └─ Version: "Attempt 1"
└─ Can upload new file anytime before due date

After resubmission:
├─ Shows attempt history:
│  ├─ "Attempt 1: 10 Jul 14:30 - v1.pdf"
│  ├─ "Attempt 2: 12 Jul 09:15 - v2.pdf" ← Latest
│  └─ Teacher marks latest by default
├─ Teacher can compare versions
└─ Student sees all attempts

Resubmission after due date:
├─ If "Allow Late Submission": Can still resubmit
├─ Latest submission marked as "LATE"
└─ Teacher can apply late penalty
```

---

## Phase 9: Teacher Marking

### 9.1 View Submissions
```
Teacher navigates to Assignment:
└─ Click "View Submissions"

Submission List shows:
├─ Table with columns:
│  ├─ Student Name
│  ├─ Status (Submitted, Marked, Overdue, Draft)
│  ├─ Submitted Date/Time
│  ├─ Marks
│  ├─ Feedback
│  └─ Action (View, Mark, Download)
│
└─ Filter/Sort options:
   ├─ Filter by status
   ├─ Sort by name, date, marks
   └─ Search student name

Status Indicators:
├─ 🟢 SUBMITTED: Handed in, awaiting marking
├─ 🟠 OVERDUE: Late submission
├─ 🟡 MARKED: Graded with feedback
└─ ⚪ DRAFT: Not submitted
```

### 9.2 Mark Individual Submission
```
Click on student submission:

Marking Interface shows:
├─ Student name & details
├─ Submitted file (preview or download)
├─ Rubric criteria list:
│  ├─ Criterion 1: [____/15] marks
│  ├─ Criterion 2: [____/15] marks
│  ├─ Criterion 3: [____/10] marks
│  └─ Criterion 4: [____/10] marks
├─ Total marks: [____/50]
├─ Feedback text area
├─ Buttons: "Save Draft" / "Submit Marks"
└─ Calculate button: Auto-sum rubric scores

Marking Process:
1. Teacher enters marks for each criterion
2. Auto-calculates total: 15 + 15 + 10 + 10 = 50 ✓
3. Validates total doesn't exceed max
4. Adds feedback comments
5. Clicks "Submit Marks"

API Call:
PUT /api/lms/submissions/{submissionId}/mark
{
  "marks": 45,
  "feedback": "Great work! Minor calculation error in Q5.",
  "rubricScores": {
    "criterion1": 15,
    "criterion2": 15,
    "criterion3": 8,
    "criterion4": 7
  }
}

Result:
├─ Submission status changes to "MARKED"
├─ Toast: "Marks submitted"
├─ Student receives notification
├─ Entry added to gradebook (if sync enabled)
└─ Marks visible on student dashboard
```

### 9.3 Bulk Marking
```
Alternative: Mark multiple submissions efficiently

In Submission List:
├─ Select checkboxes for students
├─ Click "Mark Selected" button
│
├─ Bulk marking interface:
│  ├─ Show first submission
│  ├─ Enter marks/feedback
│  ├─ Buttons: "Previous" / "Next"
│  ├─ Auto-save after each student
│  └─ Progress: "2 of 25 marked"
│
└─ Streamlined workflow for rapid grading
```

---

## Phase 10: Analytics & Reporting

### 10.1 Class Performance
```
After marking submissions:

Teacher dashboard shows:
├─ Class Average: 72%
├─ Highest Mark: 95%
├─ Lowest Mark: 35%
├─ Median: 74%
├─ Submission Rate: 95% (19/20 students)
├─ On-time: 89% (17/19 on time)
└─ Late: 11% (2/19 late)

Distribution Graph:
└─ Histogram showing mark distribution
   ├─ 0-20%: ░░
   ├─ 20-40%: ░░░░
   ├─ 40-60%: ░░░░░░░░
   ├─ 60-80%: ░░░░░░░░░░░
   └─ 80-100%: ░░░░
```

### 10.2 Individual Student Progress
```
Student Analytics show:
├─ This assignment: 42/50 (84%)
├─ Class average: 72%
├─ Your standing: Above average 📈
├─ Historical:
│  ├─ Assignment 1: 75%
│  ├─ Assignment 2: 68%
│  ├─ Assignment 3: 84% ← Current
│  └─ Trend: Improving 📈
└─ Recommendations:
   └─ "Keep up the good work! Focus on calculations."
```

---

## Phase 11: Close & Archive

### 11.1 Close Assignment
```
After marking complete:

Button: "Close Assignment"
Effect:
├─ Status changes to "CLOSED"
├─ New submissions blocked
├─ Students see: "Submission closed"
├─ Existing submissions still viewable
├─ Marks/feedback still visible
└─ Can reopen if needed

Use case:
├─ Prevent late submissions
├─ Lock in deadline
└─ Transition to next assignment
```

### 11.2 Archive Assignment
```
Later (after term ends):

Button: "Archive Assignment"
Effect:
├─ Status changes to "ARCHIVED"
├─ Removed from active list
├─ Moved to "Past Assignments"
├─ Still searchable & viewable
├─ Marks remain in gradebook
└─ Historical reference

Use case:
├─ Clean up active assignments
├─ Keep old assignments for reference
├─ Reduce clutter
└─ Maintain audit trail
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASSIGNMENT CREATION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

START
  │
  ├─→ Teacher Access Assignment Builder
  │   └─→ Load classes, subjects, terms
  │
  ├─→ Fill Form
  │   ├─→ Title, Category, Class, Subject, Term
  │   ├─→ Instructions, Resources
  │   ├─→ Marks, Rubric
  │   ├─→ Deadline, Submission Rules
  │   └─→ Save as DRAFT
  │
  ├─→ Review & Publish
  │   ├─→ Validate all fields
  │   ├─→ Check due date set
  │   └─→ Change status to PUBLISHED
  │
  ├─→ Students See Assignment
  │   ├─→ Appears in assignments list
  │   ├─→ Can view details
  │   └─→ Can submit work
  │
  ├─→ Student Submission
  │   ├─→ Upload file
  │   ├─→ Validate file size/type
  │   ├─→ Record submission (status: SUBMITTED)
  │   └─→ Option to resubmit (if enabled)
  │
  ├─→ Teacher Marking
  │   ├─→ View submission
  │   ├─→ Enter marks & rubric scores
  │   ├─→ Add feedback
  │   ├─→ Submit marks
  │   └─→ Change status to MARKED
  │
  ├─→ Analytics
  │   ├─→ Calculate class average
  │   ├─→ Sync to gradebook (if enabled)
  │   ├─→ Update student dashboard
  │   └─→ Generate reports
  │
  ├─→ Close Assignment
  │   ├─→ Block new submissions
  │   ├─→ Status: CLOSED
  │   └─→ Marks remain accessible
  │
  ├─→ Archive Assignment
  │   ├─→ Status: ARCHIVED
  │   ├─→ Removed from active list
  │   └─→ Kept for historical reference
  │
  └─→ END

```

---

## Key Files

### Frontend
- `src/components/CBCGrading/pages/lms/assignments/AssignmentBuilder.jsx` - Creation form
- `src/components/CBCGrading/pages/lms/assignments/AssignmentsPage.jsx` - List & view
- `src/components/CBCGrading/pages/lms/assignments/MarkingInterface.jsx` - Marking panel
- `src/services/api/lms.api.js` - API client

### Backend
- `server/src/controllers/lms.controller.ts` - Route handlers
- `server/src/services/lms-assignment.service.ts` - Business logic
- `server/src/middleware/upload.middleware.ts` - File upload validation

### Database
- `LearningAssignment` table - Assignment records
- `LearningSubmission` table - Student submissions
- `LearningRubric` table - Rubric criteria

---

## Summary

The assignment creation process is designed to be:
1. **Intuitive** - Guided step-by-step
2. **Flexible** - Simple homework to complex projects
3. **Fair** - Transparent rubrics and grading
4. **Integrated** - Syncs with gradebook and analytics
5. **Trackable** - Full audit trail maintained

Total time to create: **5-15 minutes** depending on complexity.
