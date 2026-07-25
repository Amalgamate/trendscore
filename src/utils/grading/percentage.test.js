import { describe, expect, it } from 'vitest';
import { normalizePercentage, percentageFromMark } from './percentage';

describe('grading percentage normalization', () => {
  it('normalizes the 58 percent floating-point boundary', () => {
    expect((58 / 100) * 100).toBeLessThan(58);
    expect(percentageFromMark(58, 100)).toBe(58);
  });

  it.each([
    [11, 100, 11],
    [21, 100, 21],
    [31, 100, 31],
    [41, 100, 41],
    [58, 100, 58],
    [75, 100, 75],
    [90, 100, 90],
    [29, 50, 58],
  ])('keeps grading boundary %s/%s at %s%%', (mark, total, expected) => {
    expect(percentageFromMark(mark, total)).toBe(expected);
  });

  it('preserves useful decimal precision', () => {
    expect(normalizePercentage((2 / 3) * 100)).toBe(66.666667);
  });
});
