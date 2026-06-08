export const CBE_GRADE_LEGEND = [
  { gradeCode: 'EE1', achievementLevel: 8, competencyBand: 'EE', description: 'Exceeding Expectations Level 1' },
  { gradeCode: 'EE2', achievementLevel: 7, competencyBand: 'EE', description: 'Exceeding Expectations Level 2' },
  { gradeCode: 'ME1', achievementLevel: 6, competencyBand: 'ME', description: 'Meeting Expectations Level 1' },
  { gradeCode: 'ME2', achievementLevel: 5, competencyBand: 'ME', description: 'Meeting Expectations Level 2' },
  { gradeCode: 'AE1', achievementLevel: 4, competencyBand: 'AE', description: 'Approaching Expectations Level 1' },
  { gradeCode: 'AE2', achievementLevel: 3, competencyBand: 'AE', description: 'Approaching Expectations Level 2' },
  { gradeCode: 'BE1', achievementLevel: 2, competencyBand: 'BE', description: 'Below Expectations Level 1' },
  { gradeCode: 'BE2', achievementLevel: 1, competencyBand: 'BE', description: 'Below Expectations Level 2' },
];

export const ASSESSMENT_STATUS_CODES = [
  { code: 'X', label: 'Absent', requiresComment: false },
  { code: 'Y', label: 'Assessment Irregularity', requiresComment: true },
  { code: 'Z', label: 'Not Assessed', requiresComment: false },
  { code: 'EX', label: 'Exempted', requiresComment: true },
  { code: 'TR', label: 'Transfer In', requiresComment: true },
  { code: 'WD', label: 'Withdrawn', requiresComment: true },
];

export const getAssessmentStatus = (code) =>
  ASSESSMENT_STATUS_CODES.find((status) => status.code === String(code || '').toUpperCase()) || null;

export const hasPerformanceScore = (row) =>
  row?.mark !== null && row?.mark !== undefined && row?.mark !== '';
