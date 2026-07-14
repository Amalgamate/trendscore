import {
  accommodationMatches,
  bucketFor,
  confidenceFor,
  genderMatches,
} from '../services/school-matching.service';
import { classifyCombinationImpact } from '../services/career.service';

describe('school match rules', () => {
  test.each([
    [90, false, 'DREAM'],
    [72, false, 'TARGET'],
    [58, false, 'SAFE'],
    [40, true, 'LOCAL'],
    [40, false, 'ALTERNATIVE'],
  ])('assigns score %s to %s', (score, local, expected) => {
    expect(bucketFor(score as number, local as boolean)).toBe(expected);
  });

  test('accepts mixed schools and rejects incompatible gender schools', () => {
    expect(genderMatches('MIXED', 'FEMALE')).toBe(true);
    expect(genderMatches('BOYS', 'FEMALE')).toBe(false);
    expect(genderMatches('GIRLS', 'FEMALE')).toBe(true);
  });

  test('day and boarding satisfies either explicit accommodation choice', () => {
    expect(accommodationMatches('DAY_AND_BOARDING', 'BOARDING')).toBe(true);
    expect(accommodationMatches('DAY', 'BOARDING')).toBe(false);
  });

  test('confidence reflects evidence coverage and verification', () => {
    expect(confidenceFor(2, true)).toBe('INSUFFICIENT_DATA');
    expect(confidenceFor(8, true)).toBe('HIGH');
    expect(confidenceFor(6, false)).toBe('MEDIUM');
  });
});

describe('career combination impact', () => {
  test('strongly supports matching pathway and track', () => {
    expect(classifyCombinationImpact('STEM', 'PURE_SCIENCES', 'STEM', 'PURE SCIENCES')).toBe('STRONGLY_SUPPORTS');
  });

  test('supports a matching pathway when a career has no track mapping', () => {
    expect(classifyCombinationImpact('SOCIAL_SCIENCES', null, 'SOCIAL SCIENCES', 'LANGUAGES')).toBe('SUPPORTS');
  });

  test('warns when the combination is in another pathway', () => {
    expect(classifyCombinationImpact('STEM', null, 'ARTS_SPORTS', null)).toBe('MAY_RESTRICT');
  });

  test('keeps the result unknown when career mapping data is absent', () => {
    expect(classifyCombinationImpact(null, null, 'STEM', null)).toBe('UNKNOWN');
  });
});
