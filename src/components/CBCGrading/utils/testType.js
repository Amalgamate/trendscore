const TEST_TYPE_PRIORITY = {
  OPENER: 1,
  MID_TERM: 2,
  END_TERM: 3,
  MONTHLY: 4,
  WEEKLY: 5,
  CAT: 6,
  MOCK: 7,
  ASSESSMENT: 8,
  RANDOM: 9,
  OTHER: 10,
};

const TEST_TYPE_LABELS = {
  OPENER: 'Opener',
  MID_TERM: 'Mid Term',
  END_TERM: 'End Term',
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  CAT: 'CAT',
  MOCK: 'Mock',
  ASSESSMENT: 'Assessment',
  RANDOM: 'Random',
  OTHER: 'Other',
};

export const normalizeTestType = (rawType) => {
  if (!rawType || !String(rawType).trim()) return null;

  const normalized = String(rawType)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (
    normalized === 'MIDTERM' ||
    normalized === 'MID_TERM' ||
    normalized.includes('MID_TERM')
  ) return 'MID_TERM';

  if (
    normalized === 'END_OF_TERM' ||
    normalized === 'END_TERM' ||
    normalized === 'ENDTERM' ||
    normalized.includes('END_OF_TERM') ||
    normalized.includes('END_TERM')
  ) return 'END_TERM';

  if (
    normalized === 'OPENER' ||
    normalized === 'OPENING' ||
    normalized.includes('OPENER') ||
    normalized.includes('OPENING')
  ) return 'OPENER';

  if (normalized.includes('MONTH')) return 'MONTHLY';
  if (normalized.includes('WEEK')) return 'WEEKLY';
  if (normalized.includes('CAT')) return 'CAT';
  if (normalized.includes('MOCK')) return 'MOCK';
  if (normalized === 'OTHER') return 'OTHER';
  if (normalized.includes('RANDOM')) return 'RANDOM';
  if (normalized.includes('ASSESS')) return 'ASSESSMENT';

  return normalized;
};

export const inferTestTypeFromTitle = (title) => {
  if (!title || !String(title).trim()) return null;

  const source = String(title).toUpperCase();
  if (/\bMID[\s_-]*TERM\b/.test(source)) return 'MID_TERM';
  if (/\bEND[\s_-]*(OF[\s_-]*)?TERM\b/.test(source)) return 'END_TERM';
  if (/\bOPEN(ER|ING)?\b/.test(source)) return 'OPENER';
  if (/\bCAT\b/.test(source)) return 'CAT';
  if (/\bMOCK\b/.test(source)) return 'MOCK';
  if (/\bMONTH(LY)?\b/.test(source)) return 'MONTHLY';
  if (/\bWEEK(LY)?\b/.test(source)) return 'WEEKLY';
  if (/\bRANDOM\b/.test(source)) return 'RANDOM';
  if (/\bOTHER\b/.test(source)) return 'OTHER';
  if (/\bASSESS(MENT)?\b/.test(source)) return 'ASSESSMENT';

  return null;
};

export const resolveTestType = (item) => {
  const explicitType = normalizeTestType(item?.testType);
  if (explicitType) return explicitType;

  const inferred = inferTestTypeFromTitle(item?.title);
  if (inferred) return inferred;

  return 'ASSESSMENT';
};

export const formatTestTypeLabel = (testType) => {
  const key = normalizeTestType(testType) || 'ASSESSMENT';
  return TEST_TYPE_LABELS[key] || key.replace(/_/g, ' ');
};

export const compareTestTypes = (a, b) => {
  const normalizedA = normalizeTestType(a) || 'ASSESSMENT';
  const normalizedB = normalizeTestType(b) || 'ASSESSMENT';
  const pA = TEST_TYPE_PRIORITY[normalizedA] || 99;
  const pB = TEST_TYPE_PRIORITY[normalizedB] || 99;
  if (pA !== pB) return pA - pB;
  return normalizedA.localeCompare(normalizedB);
};

export const CANONICAL_TEST_TYPE_OPTIONS = [
  { value: 'OPENER', label: 'Opener Exam' },
  { value: 'MID_TERM', label: 'Midterm Assessment' },
  { value: 'END_TERM', label: 'End of Term Exam' },
  { value: 'CAT', label: 'CAT' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'OTHER', label: 'Other' },
  { value: 'MONTHLY', label: 'Monthly Assessment' },
  { value: 'WEEKLY', label: 'Weekly Test' },
  { value: 'MOCK', label: 'Mock Exam' },
  { value: 'RANDOM', label: 'Random Assessment' },
];

export const CANONICAL_TEST_TYPE_VALUES = CANONICAL_TEST_TYPE_OPTIONS.map((option) => option.value);
