export const CBE_GRADE_CODES = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'] as const;
export type CbeGradeCode = typeof CBE_GRADE_CODES[number];

export const ASSESSMENT_STATUS_CODES = ['X', 'Y', 'Z', 'EX', 'TR', 'WD'] as const;
export type AssessmentStatusCode = typeof ASSESSMENT_STATUS_CODES[number];

export const CBE_GRADE_DETAILS: Record<CbeGradeCode, {
  gradeCode: CbeGradeCode;
  achievementLevel: number;
  competencyBand: 'EE' | 'ME' | 'AE' | 'BE';
  gradeDescription: string;
}> = {
  EE1: { gradeCode: 'EE1', achievementLevel: 8, competencyBand: 'EE', gradeDescription: 'Exceeding Expectations Level 1' },
  EE2: { gradeCode: 'EE2', achievementLevel: 7, competencyBand: 'EE', gradeDescription: 'Exceeding Expectations Level 2' },
  ME1: { gradeCode: 'ME1', achievementLevel: 6, competencyBand: 'ME', gradeDescription: 'Meeting Expectations Level 1' },
  ME2: { gradeCode: 'ME2', achievementLevel: 5, competencyBand: 'ME', gradeDescription: 'Meeting Expectations Level 2' },
  AE1: { gradeCode: 'AE1', achievementLevel: 4, competencyBand: 'AE', gradeDescription: 'Approaching Expectations Level 1' },
  AE2: { gradeCode: 'AE2', achievementLevel: 3, competencyBand: 'AE', gradeDescription: 'Approaching Expectations Level 2' },
  BE1: { gradeCode: 'BE1', achievementLevel: 2, competencyBand: 'BE', gradeDescription: 'Below Expectations Level 1' },
  BE2: { gradeCode: 'BE2', achievementLevel: 1, competencyBand: 'BE', gradeDescription: 'Below Expectations Level 2' },
};

export const ASSESSMENT_STATUS_DETAILS: Record<AssessmentStatusCode, {
  code: AssessmentStatusCode;
  label: string;
  requiresComment: boolean;
}> = {
  X: { code: 'X', label: 'Absent', requiresComment: false },
  Y: { code: 'Y', label: 'Assessment Irregularity', requiresComment: true },
  Z: { code: 'Z', label: 'Not Assessed', requiresComment: false },
  EX: { code: 'EX', label: 'Exempted', requiresComment: true },
  TR: { code: 'TR', label: 'Transfer In', requiresComment: true },
  WD: { code: 'WD', label: 'Withdrawn', requiresComment: true },
};

export function normalizeCbeCode(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function isCbeGradeCode(value: unknown): value is CbeGradeCode {
  return CBE_GRADE_CODES.includes(normalizeCbeCode(value) as CbeGradeCode);
}

export function isAssessmentStatusCode(value: unknown): value is AssessmentStatusCode {
  return ASSESSMENT_STATUS_CODES.includes(normalizeCbeCode(value) as AssessmentStatusCode);
}

export function getCbeGradeDetails(value: unknown) {
  const code = normalizeCbeCode(value);
  return isCbeGradeCode(code) ? CBE_GRADE_DETAILS[code] : null;
}

export function getAssessmentStatusDetails(value: unknown) {
  const code = normalizeCbeCode(value);
  return isAssessmentStatusCode(code) ? ASSESSMENT_STATUS_DETAILS[code] : null;
}

export function assertValidAssessmentEntry(input: {
  marksObtained?: unknown;
  rawScore?: unknown;
  assessmentStatusCode?: unknown;
  teacherComment?: unknown;
  totalMarks: number;
}) {
  const rawStatusCode = normalizeCbeCode(input.assessmentStatusCode);
  const statusDetails = rawStatusCode ? getAssessmentStatusDetails(rawStatusCode) : null;
  const rawScore = input.rawScore ?? input.marksObtained;
  const hasScore = rawScore !== undefined && rawScore !== null && rawScore !== '';

  if (rawStatusCode && !statusDetails) {
    return { ok: false as const, reason: `Invalid assessment status code: ${rawStatusCode}` };
  }

  if (statusDetails && hasScore) {
    return { ok: false as const, reason: 'Enter either a score or a status code, not both' };
  }

  if (statusDetails?.requiresComment && !String(input.teacherComment || '').trim()) {
    return { ok: false as const, reason: `${statusDetails.code} requires a teacher comment` };
  }

  if (statusDetails) {
    return { ok: true as const, kind: 'status' as const, statusCode: statusDetails.code };
  }

  if (!hasScore) {
    return { ok: false as const, reason: 'Score or status code is required' };
  }

  const score = Number(rawScore);
  if (!Number.isFinite(score)) {
    return { ok: false as const, reason: 'Score is not a valid number' };
  }

  if (score < 0 || score > input.totalMarks) {
    return { ok: false as const, reason: `Score ${score} out of valid range 0-${input.totalMarks}` };
  }

  return { ok: true as const, kind: 'score' as const, score };
}
