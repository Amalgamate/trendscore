import { gradingService, normalizePercentage } from '../services/grading.service';

const ranges = [
  { minPercentage: 90, maxPercentage: 100, summativeGrade: 'EE1', rubricRating: 'EE1' },
  { minPercentage: 75, maxPercentage: 89, summativeGrade: 'EE2', rubricRating: 'EE2' },
  { minPercentage: 58, maxPercentage: 74, summativeGrade: 'ME1', rubricRating: 'ME1' },
  { minPercentage: 41, maxPercentage: 57, summativeGrade: 'ME2', rubricRating: 'ME2' },
  { minPercentage: 31, maxPercentage: 40, summativeGrade: 'AE1', rubricRating: 'AE1' },
  { minPercentage: 21, maxPercentage: 30, summativeGrade: 'AE2', rubricRating: 'AE2' },
  { minPercentage: 11, maxPercentage: 20, summativeGrade: 'BE1', rubricRating: 'BE1' },
  { minPercentage: 0, maxPercentage: 10, summativeGrade: 'BE2', rubricRating: 'BE2' },
];

describe('gradingService percentage boundaries', () => {
  it.each([
    [10, 'BE2'],
    [11, 'BE1'],
    [21, 'AE2'],
    [31, 'AE1'],
    [41, 'ME2'],
    [58, 'ME1'],
    [75, 'EE2'],
    [90, 'EE1'],
    [100, 'EE1'],
  ])('classifies the exact %s%% boundary as %s', (percentage, expected) => {
    expect(gradingService.calculateRatingSync(percentage, ranges)).toBe(expected);
    expect(gradingService.calculateGradeSync(percentage, ranges)).toBe(expected);
  });

  it('normalizes floating-point drift before matching a grading range', () => {
    const percentage = (58 / 100) * 100;

    expect(percentage).toBeLessThan(58);
    expect(normalizePercentage(percentage)).toBe(58);
    expect(gradingService.calculateRatingSync(percentage, ranges)).toBe('ME1');
  });

  it('normalizes persisted percentages without losing legitimate decimals', () => {
    expect(normalizePercentage((29 / 50) * 100)).toBe(58);
    expect(normalizePercentage((2 / 3) * 100)).toBe(66.666667);
  });
});
