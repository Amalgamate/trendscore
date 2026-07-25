import { describe, expect, it } from 'vitest';
import { buildAssessmentCards, calculateYearAverage } from './ParentReportCards';

describe('ParentReportCards helpers', () => {
  it('keeps every assessment as an individual report card', () => {
    const cards = buildAssessmentCards({
      results: [
        { id: 'r1', testId: 't1', marksObtained: 58, percentage: 58, cbcGrade: 'ME1', test: { title: 'Mid Term', learningArea: 'Mathematics', totalMarks: 100 } },
        { id: 'r2', testId: 't2', marksObtained: 75, percentage: 75, cbcGrade: 'EE2', test: { title: 'End Term', learningArea: 'Mathematics', totalMarks: 100 } },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ id: 't1', title: 'Mid Term', percentage: 58, grade: 'ME1' });
    expect(cards[1]).toMatchObject({ id: 't2', title: 'End Term', percentage: 75, grade: 'EE2' });
  });

  it('calculates the whole-year average from recorded terms only', () => {
    expect(calculateYearAverage([{ avg: 50 }, { avg: 70 }, { avg: 80 }])).toBe(67);
    expect(calculateYearAverage([])).toBeNull();
  });
});
