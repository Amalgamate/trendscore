import {
  assertValidAssessmentEntry,
  getAssessmentStatusDetails,
  getCbeGradeDetails,
  isAssessmentStatusCode,
  isCbeGradeCode,
} from '../utils/cbe-grading.util';

describe('CBE grading and assessment status helpers', () => {
  it('maps official KJSEA grade codes to achievement levels', () => {
    expect(getCbeGradeDetails('EE1')).toMatchObject({ achievementLevel: 8, competencyBand: 'EE' });
    expect(getCbeGradeDetails('EE2')).toMatchObject({ achievementLevel: 7, competencyBand: 'EE' });
    expect(getCbeGradeDetails('ME1')).toMatchObject({ achievementLevel: 6, competencyBand: 'ME' });
    expect(getCbeGradeDetails('ME2')).toMatchObject({ achievementLevel: 5, competencyBand: 'ME' });
    expect(getCbeGradeDetails('AE1')).toMatchObject({ achievementLevel: 4, competencyBand: 'AE' });
    expect(getCbeGradeDetails('AE2')).toMatchObject({ achievementLevel: 3, competencyBand: 'AE' });
    expect(getCbeGradeDetails('BE1')).toMatchObject({ achievementLevel: 2, competencyBand: 'BE' });
    expect(getCbeGradeDetails('BE2')).toMatchObject({ achievementLevel: 1, competencyBand: 'BE' });
  });

  it('keeps administrative status codes separate from grade codes', () => {
    expect(isCbeGradeCode('X')).toBe(false);
    expect(isCbeGradeCode('EX')).toBe(false);
    expect(isAssessmentStatusCode('EX')).toBe(true);
    expect(getAssessmentStatusDetails('Y')).toMatchObject({ label: 'Assessment Irregularity', requiresComment: true });
  });

  it('accepts a score-only assessment entry', () => {
    expect(assertValidAssessmentEntry({ marksObtained: 41, totalMarks: 100 })).toMatchObject({
      ok: true,
      kind: 'score',
      score: 41,
    });
  });

  it('rejects scores above the configured test total', () => {
    expect(assertValidAssessmentEntry({ marksObtained: 85, totalMarks: 60 })).toMatchObject({
      ok: false,
      reason: 'Score 85 cannot exceed total marks 60',
    });
  });

  it('accepts a status-only assessment entry', () => {
    expect(assertValidAssessmentEntry({ assessmentStatusCode: 'X', totalMarks: 100 })).toMatchObject({
      ok: true,
      kind: 'status',
      statusCode: 'X',
    });
  });

  it('rejects mixed score and status entries', () => {
    expect(assertValidAssessmentEntry({ marksObtained: 50, assessmentStatusCode: 'X', totalMarks: 100 })).toMatchObject({
      ok: false,
    });
  });

  it('requires comments for configured administrative status codes', () => {
    expect(assertValidAssessmentEntry({ assessmentStatusCode: 'EX', totalMarks: 100 })).toMatchObject({
      ok: false,
    });
    expect(assertValidAssessmentEntry({ assessmentStatusCode: 'EX', teacherComment: 'Documented exemption', totalMarks: 100 })).toMatchObject({
      ok: true,
      kind: 'status',
    });
  });
});
