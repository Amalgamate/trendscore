/**
 * Sample TermlyReportData for admin-facing template previews.
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 7 (School-Level Engine Selection)
 *
 * The School Settings "Report Templates" tab needs to let an admin see what
 * a template actually looks like before selecting it (checklist Phase 7's
 * "ideally rendering the actual template component against ... sample
 * data" design decision — adopted here rather than a static screenshot).
 *
 * This is NOT a fixture for tests and is NEVER sent to the backend — it only
 * ever flows into `resolveReportTemplateComponent()` (registry.js) for a
 * client-side-only preview render. Shape matches
 * `server/src/services/report.service.ts`'s `TermlyReportData` exactly
 * (see that file's interface block) so every field a real template reads —
 * including the ones only `ModernReportTemplate.jsx` renders, like
 * `attendance` — is present and non-crashing.
 *
 * Branding fields (schoolName/schoolAddress/.../brandColor) are intentionally
 * left out of the base sample — the caller merges in the *actual* school's
 * current settings (via `buildReportTemplateProps`-style spread) so the
 * preview reflects the school's real logo/colours/contact details rather
 * than placeholder ones.
 */

export function buildSampleReportData() {
  return {
    learner: {
      id: 'sample-learner',
      firstName: 'Amani',
      lastName: 'Wanjiru',
      middleName: null,
      admissionNumber: 'ADM/2026/0142',
      grade: 'GRADE_6',
      stream: 'Blue',
      dateOfBirth: null,
      gender: 'FEMALE',
    },
    term: 'TERM_2',
    academicYear: new Date().getFullYear(),
    formative: {
      assessments: [],
      summary: {},
    },
    summative: {
      results: [],
      summary: {
        bySubject: [
          { subject: 'Mathematics', averagePercentage: 84, achievementLevel: 4, cbcGrade: 'EE1' },
          { subject: 'English', averagePercentage: 76, achievementLevel: 3, cbcGrade: 'ME2' },
          { subject: 'Kiswahili', averagePercentage: 71, achievementLevel: 3, cbcGrade: 'ME2' },
          { subject: 'Science & Technology', averagePercentage: 88, achievementLevel: 4, cbcGrade: 'EE1' },
          { subject: 'Social Studies', averagePercentage: 79, achievementLevel: 3, cbcGrade: 'ME1' },
          { subject: 'Creative Arts', averagePercentage: 91, achievementLevel: 4, cbcGrade: 'EE1' },
          { subject: 'Agriculture', averagePercentage: 68, achievementLevel: 2, cbcGrade: 'AE1' },
        ],
        byCategoryAverages: [
          { category: 'STEM', averagePercentage: 80, grade: 'ME1' },
          { category: 'SOCIAL', averagePercentage: 75, grade: 'ME2' },
          { category: 'ARTS', averagePercentage: 91, grade: 'EE1' },
        ],
        exclusionNote: 'Administrative status codes are excluded from learner performance calculations.',
      },
    },
    attendance: {
      totalDays: 62,
      present: 58,
      absent: 2,
      late: 1,
      excused: 1,
      sick: 0,
      attendancePercentage: 94,
    },
    coreCompetencies: {
      communication: 'ME1',
      communicationComment: null,
      criticalThinking: 'EE2',
      criticalThinkingComment: null,
      creativity: 'EE1',
      creativityComment: null,
      collaboration: 'ME2',
      collaborationComment: null,
      citizenship: 'ME1',
      citizenshipComment: null,
      learningToLearn: 'ME1',
      learningToLearnComment: null,
    },
    values: {
      love: 'EE1',
      responsibility: 'ME1',
      respect: 'EE1',
      unity: 'ME2',
      peace: 'EE1',
      patriotism: 'ME1',
      integrity: 'ME1',
      comment: null,
    },
    coCurricular: [
      { id: 'sample-cca-1', activityName: 'Athletics', activityType: 'Sports', performance: 'EE1', achievements: 'County finalist, 400m', remarks: null },
      { id: 'sample-cca-2', activityName: 'Debate Club', activityType: 'Clubs', performance: 'ME1', achievements: null, remarks: 'Active and engaged participant' },
    ],
    comments: {
      classTeacher: 'A dedicated learner who has shown remarkable growth this term, particularly in Mathematics and Science. Continues to demonstrate strong collaborative skills in group work.',
      classTeacherName: 'Mrs. J. Otieno',
      classTeacherDate: null,
      headTeacher: 'Keep up the excellent effort. A promising term overall.',
      headTeacherName: 'Mr. P. Kamau',
      headTeacherDate: null,
      parentComment: null,
      nextTermOpens: 'Monday, 4th May 2026',
    },
    overallPerformance: {
      overallGrade: 'ME1',
      grade: 'ME1',
    },
    generatedDate: new Date(),
  };
}
