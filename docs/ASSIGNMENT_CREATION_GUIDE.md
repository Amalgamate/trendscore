# Assignment & Homework Creation Process

## Overview
The TrendScore LMS provides a complete workflow for creating, managing, and tracking assignments and homework. Teachers can create rich assignments with instructions, rubrics, file attachments, and configure submission settings.

---

## Step-by-Step Creation Process

### 1. Access Assignment Builder
- Navigate to **Learning** → **Assignments** tab
- Click **"+ Create New Assignment"** button
- Or edit an existing assignment by clicking the pencil icon

### 2. Fill in Basic Details

#### Required Fields:
- **Title** - Assignment name (e.g., "Chapter 5 Homework - Quadratic Equations")
- **Class** - Target class/grade level
- **Learning Area** - Subject (Math, English, Science, etc.)
- **Term** - Academic term (automatically defaults to active term)
- **Category** - Type of work:
  - HOMEWORK
  - PROJECT
  - REVISION
  - HOLIDAY_WORK
  - RESEARCH
  - READING
  - PRACTICAL
  - GROUP_WORK

#### Optional Fields:
- **Stream** - Specific stream within class (e.g., Stream A, B, C)
- **Instructions** - Detailed assignment description and requirements
- **Estimated Time** - How long students should spend (in minutes)

### 3. Set Grading Configuration

#### Marks Setup:
- **Total Marks** - Maximum achievable score
- **Pass Mark** - Minimum score to pass (e.g., 50% of total)

#### Submission Settings:
- **Due Date** - When assignment is due
- **Due Time** - Time deadline (defaults to 23:59)
- **Allow Late Submission** - Toggle to permit submissions after due date
- **Allow Resubmission** - Allow students to revise and resubmit

#### File Requirements:
- **Max File Size** - Upload limit per student (MB, default 25MB)
- **Allowed File Types** - Restrict file types (optional)

### 4. Create Rubric (Optional)

Add grading criteria to standardize marking:

```
Example Rubric:
┌─────────────────────────────┬───────┐
│ Criterion                   │ Marks │
├─────────────────────────────┼───────┤
│ Content Accuracy            │ 20    │
│ Clarity of Explanation      │ 15    │
│ Organization & Structure    │ 10    │
│ Grammar & Presentation      │ 5     │
└─────────────────────────────┴───────┘
Total: 50 marks
```

- Click **"+ Add Rubric Row"** for each criterion
- Enter criterion name and marks allocation
- Marks automatically sum to Total Marks

### 5. Attach Resources (Optional)

#### Via File Upload:
- Toggle to **"Upload File"** mode
- Select PDF, Word, Excel, PowerPoint documents
- Or paste URL to external resource
- Supports:
  - PDF documents (.pdf)
  - MS Word (.doc, .docx)
  - Excel spreadsheets (.xls, .xlsx)
  - PowerPoint presentations (.ppt, .pptx)

#### Via Revision Library:
- Link to existing resources from revision library
- Students can access for reference

### 6. Save & Publish

#### Save as Draft:
- Click **"Save as Draft"** button
- Assignment saved but not visible to students
- Status: **DRAFT**
- Can be edited anytime before publishing

#### Publish Assignment:
- Click **"Publish"** button (or **"Send"** on some views)
- Assignment becomes visible to target class
- Status: **PUBLISHED**
- Students can view and start submissions
- **Note:** Publishing requires a due date

---

## Assignment States/Lifecycle

```
┌─────────────────────────────────────────────┐
│         DRAFT (Editing in Progress)         │
│  ✓ Can edit anytime                         │
│  ✗ Not visible to students                  │
│  ✗ Cannot receive submissions               │
└──────────────┬──────────────────────────────┘
               │
               ├─→ Save as Draft
               │
               ├─→ Publish
               │
               ▼
┌─────────────────────────────────────────────┐
│       PUBLISHED (Active Assignment)         │
│  ✓ Visible to assigned class                │
│  ✓ Students can submit                      │
│  ✓ Can mark submissions                     │
│  ✗ Limited editing (title, instructions)   │
└──────────────┬──────────────────────────────┘
               │
               ├─→ Close Assignment
               │
               ├─→ Archive Assignment
               │
               ▼
┌─────────────────────────────────────────────┐
│        CLOSED (Submissions Locked)          │
│  ✓ Visible in history                       │
│  ✓ Already submitted work viewable          │
│  ✗ New submissions blocked                  │
└──────────────┬──────────────────────────────┘
               │
               ├─→ Archive (remove from active list)
               │
               ▼
┌─────────────────────────────────────────────┐
│      ARCHIVED (Historical Record)           │
│  ✓ Searchable in past assignments           │
│  ✓ View-only mode                           │
└─────────────────────────────────────────────┘
```

---

## Backend Data Structure

### Create Request
```typescript
POST /api/lms/assignments

{
  "title": "Chapter 5 Homework",
  "classId": "class-123",
  "learningAreaId": "math-456",
  "termId": "term-789",
  "category": "HOMEWORK",
  "streamId": "stream-A",
  "instructions": "Complete problems 1-20...",
  "dueDate": "2026-07-15T23:59:00Z",
  "estimatedMins": 60,
  "totalMarks": 50,
  "passMark": 25,
  "allowLateSubmit": true,
  "allowResubmit": false,
  "maxFileSize": 25,
  "allowedFileTypes": [],
  "rubric": [
    { "criterion": "Content", "marks": 20 },
    { "criterion": "Clarity", "marks": 15 }
  ],
  "cbcOutcomes": ["competency-id-1"],
  "gradebookSync": false
}
```

### Response
```typescript
{
  "id": "assignment-123",
  "title": "Chapter 5 Homework",
  "status": "DRAFT",
  "createdAt": "2026-07-04T12:00:00Z",
  "updatedAt": "2026-07-04T12:00:00Z",
  // ... other fields
}
```

### Publish Request
```
POST /api/lms/assignments/{id}/publish
```

---

## Student Experience

### View Assignments
1. Students navigate to **Learning** → **Assignments**
2. See list of published assignments for their class
3. Filter by status:
   - **Pending** - Not yet submitted
   - **Submitted** - Handed in, awaiting marking
   - **Marked** - Graded with feedback
   - **Overdue** - Missed deadline

### Submit Assignment
1. Click on assignment to view details
2. Read instructions and download resources
3. **Submit Work** button opens submission dialog
4. Upload file (PDF, Word, image, etc.)
5. Submit - locked from further edits
6. Can resubmit if allowed by teacher

### View Feedback
1. After teacher marks, status changes to **Marked**
2. Click assignment to view:
   - Marks received
   - Teacher feedback
   - Rubric scores per criterion
   - Compared to class average

---

## Teacher Marking Workflow

### View Submissions
1. Click on published assignment
2. **View Submissions** tab shows:
   - Student name
   - Submission status (Submitted, Marked, Overdue, Draft)
   - Submission date/time
   - Marks (if graded)

### Mark a Submission
1. Click on student's submission
2. View submitted file
3. Enter marks in each rubric criterion
4. Add feedback comments
5. **Submit Marks** - grade is recorded
6. Student receives notification

### Bulk Marking
- **Mark All** button available for submissions
- Streamlined interface for rapid grading

---

## Advanced Features

### Rubric-Based Grading
- Automatic mark calculation from criteria
- Consistent grading across class
- Transparent criteria for students

### Gradebook Sync
- Marks automatically sync to assessments module
- Cumulative grade tracking
- Performance analytics

### File Management
- Support for multiple file formats
- Virus scanning on upload
- Storage limits per file

### Late Submission Handling
- If allowed: accepts submissions after due date
- Marks as "LATE" in submission status
- Optional late submission penalty (teacher configurable)

### Resubmission Workflow
- Students can revise and resubmit
- Track submission history
- Compare versions (with teacher review)

---

## Common Scenarios

### Scenario 1: Create Weekly Homework
1. Create assignment with category "HOMEWORK"
2. Set due date to next day 23:59
3. Add simple rubric (e.g., 10 marks total)
4. Publish immediately
5. Students submit during class or at home

### Scenario 2: Long-term Project
1. Create assignment with category "PROJECT"
2. Set due date 2 weeks away
3. Attach detailed rubric with 5-7 criteria
4. Link to reference materials from revision library
5. Allow resubmission for iterative feedback
6. Mark submissions as they arrive

### Scenario 3: Exam Revision
1. Create assignment with category "REVISION"
2. Set no due date initially (optional)
3. Attach past papers, mark schemes, study guides
4. Allow students to self-assess
5. Optionally collect for teacher review

### Scenario 4: Formative Assessment
1. Create quick assignment (5 minutes)
2. Publish to get immediate class feedback
3. Use responses to adjust lesson pacing
4. Close after collection (don't grade formally)

---

## Permissions Required

### To Create Assignments:
- Role: TEACHER or HEAD_TEACHER
- Permission: LEARNING_MANAGE

### To View Student Submissions:
- Role: TEACHER or HEAD_TEACHER
- Own class assignments only

### To View Assignment Submissions (Admin):
- Role: ADMIN or SUPER_ADMIN
- Can view any school's assignments

### Students:
- View assigned assignments
- Submit work
- View own marks/feedback

---

## Troubleshooting

### Assignment not visible to students
- Check **Status**: Must be PUBLISHED
- Check **Due Date**: Must be set (cannot be empty)
- Check **Class Assignment**: Verify class is correct
- Check **Student Enrollment**: Verify students are in class

### File upload fails
- Check file size < 25MB (or configured limit)
- Check file format is allowed
- Check network connection
- Try different browser

### Marks not syncing to gradebook
- Enable **Gradebook Sync** when creating assignment
- Check assessment mapping is configured
- Verify term/class settings match

### Student cannot resubmit
- Check **Allow Resubmission** is enabled
- Verify assignment is not CLOSED
- Check submission deadline hasn't passed (if resubmission limited)

---

## API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Create | `/api/lms/assignments` | POST |
| Get One | `/api/lms/assignments/:id` | GET |
| List | `/api/lms/assignments` | GET |
| Update | `/api/lms/assignments/:id` | PUT |
| Publish | `/api/lms/assignments/:id/publish` | POST |
| Close | `/api/lms/assignments/:id/close` | POST |
| Archive | `/api/lms/assignments/:id/archive` | POST |
| Submissions | `/api/lms/assignments/:id/submissions` | GET |
| Submit | `/api/lms/assignments/:id/submissions` | POST |
| Mark | `/api/lms/submissions/:id/mark` | POST |

---

## Summary

The assignment creation process is designed to be:
- **Simple** for quick homework (5 minutes)
- **Powerful** for detailed projects (rubric, resources, late handling)
- **Fair** through transparent rubrics and resubmission options
- **Integrated** with the gradebook and analytics
- **Mobile-friendly** for teachers marking on the go

Start with basic assignments and gradually use advanced features as needed!
