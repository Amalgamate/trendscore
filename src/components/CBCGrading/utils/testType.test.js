import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CANONICAL_TEST_TYPE_OPTIONS, CANONICAL_TEST_TYPE_VALUES, normalizeTestType } from './testType';

const getSchemaSummativeTestTypes = () => {
  const schema = readFileSync('server/prisma/schema.prisma', 'utf8');
  const enumBody = schema.match(/enum\s+SummativeTestType\s+\{([\s\S]*?)\}/)?.[1] || '';

  return enumBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
};

describe('summative test type options', () => {
  it('matches the Prisma SummativeTestType enum exactly', () => {
    expect(CANONICAL_TEST_TYPE_VALUES).toEqual(getSchemaSummativeTestTypes());
  });

  it('has one visible option per canonical value', () => {
    const optionValues = CANONICAL_TEST_TYPE_OPTIONS.map((option) => option.value);
    const labels = CANONICAL_TEST_TYPE_OPTIONS.map((option) => option.label);

    expect(optionValues).toEqual(CANONICAL_TEST_TYPE_VALUES);
    expect(new Set(optionValues).size).toBe(CANONICAL_TEST_TYPE_VALUES.length);
    expect(labels.every(Boolean)).toBe(true);
  });

  it('does not collapse Other into Mock', () => {
    expect(normalizeTestType('OTHER')).toBe('OTHER');
  });
});
