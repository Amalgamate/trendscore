import { describe, expect, it } from 'vitest';
import { buildAssessmentSmsMetrics } from './assessmentSmsFormatter';

describe('buildAssessmentSmsMetrics', () => {
  it('uses normalized broadsheet subject percentages instead of recalculating them as zero', () => {
    expect(buildAssessmentSmsMetrics({
      averagePct: 68.5,
      subjectScores: { MATHEMATICS: 72, ENGLISH: 65 },
      results: [
        { score: 36, maxScore: 50, learningArea: 'Mathematics' },
        { score: 32.5, maxScore: 50, learningArea: 'English' },
      ],
    })).toEqual({
      averageScore: 68.5,
      subjects: [
        { name: 'MATHEMATICS', percentage: 72, displayCode: null, missing: false },
        { name: 'ENGLISH', percentage: 65, displayCode: null, missing: false },
      ],
    });
  });

  it('accepts maxScore and test.totalMarks from the bulk result shape', () => {
    const metrics = buildAssessmentSmsMetrics({
      results: [
        { marksObtained: 30, maxScore: 40, learningArea: 'Mathematics' },
        { score: 20, test: { totalMarks: 40, learningArea: 'Mathematics' } },
      ],
    });
    expect(metrics.averageScore).toBe(62.5);
    expect(metrics.subjects[0]).toMatchObject({ name: 'MATHEMATICS', percentage: 63 });
  });

  it('preserves missing assessment codes instead of presenting them as zero scores', () => {
    const metrics = buildAssessmentSmsMetrics({
      averagePct: 55,
      subjectScores: { MATHEMATICS: 0 },
      subjectDisplayCodes: { MATHEMATICS: 'X' },
      missingSubjectScores: { MATHEMATICS: true },
    });
    expect(metrics.subjects[0]).toMatchObject({ displayCode: 'X', missing: true });
  });
});
