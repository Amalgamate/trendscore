import summativeTestTypes from '../shared/summativeTestTypes.json';
import { SummativeTestType } from '@prisma/client';

export const CANONICAL_SUMMATIVE_TEST_TYPE_OPTIONS = summativeTestTypes.options as Array<{
  value: SummativeTestType;
  label: string;
}>;

export const CANONICAL_SUMMATIVE_TEST_TYPE_VALUES = CANONICAL_SUMMATIVE_TEST_TYPE_OPTIONS.map((option) => option.value);

const SUMMATIVE_TEST_TYPE_ALIASES = summativeTestTypes.aliases as Record<string, SummativeTestType>;

export function normalizeSummativeTestType(rawType: unknown): SummativeTestType {
  const normalized = String(rawType || 'ASSESSMENT')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (SUMMATIVE_TEST_TYPE_ALIASES[normalized]) return SUMMATIVE_TEST_TYPE_ALIASES[normalized];
  if (normalized.includes('MOCK')) return 'MOCK';
  if (normalized.includes('MONTH')) return 'MONTHLY';
  if (normalized.includes('WEEK')) return 'WEEKLY';
  if (normalized.includes('RANDOM')) return 'RANDOM';
  if (normalized.includes('ASSESS')) return 'ASSESSMENT';
  if (normalized.includes('MID_TERM') || normalized === 'MID') return 'MID_TERM';
  if (normalized.includes('END_TERM')) return 'END_TERM';
  if (normalized.includes('OPEN')) return 'OPENER';
  if (normalized.includes('CAT')) return 'CAT';
  return 'ASSESSMENT';
}

export function getSummativeTestTypeVariants(rawType: unknown): SummativeTestType[] {
  const canonical = normalizeSummativeTestType(rawType);
  return canonical ? [canonical] : [];
}
