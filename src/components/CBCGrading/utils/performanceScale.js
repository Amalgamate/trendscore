/**
 * CBC Performance Level Scale (Rubric System)
 *
 * TrendScore uses an 8-level rubric that sub-divides each of the four
 * official KICD CBC bands (EE, ME, AE, BE) into two levels for finer
 * differentiation. The 4-level parent entries are kept for any legacy
 * callers that still reference them (e.g. broadsheet summary counters).
 */

// ─── 8-level detailed scale (primary) ─────────────────────────────────────
export const detailedPerformanceScale = [
  {
    level: 'EE1',
    parent: 'EE',
    name: 'Exceeding Expectations 1',
    label: 'Outstanding',
    points: 8,
    scoreRange: { min: 90, max: 100 },
    color: '#15803d',
    bgColor: '#dcfce7',
    description: 'Consistently demonstrates mastery well beyond grade level',
  },
  {
    level: 'EE2',
    parent: 'EE',
    name: 'Exceeding Expectations 2',
    label: 'Very High',
    points: 7,
    scoreRange: { min: 75, max: 89 },
    color: '#16a34a',
    bgColor: '#dcfce7',
    description: 'Demonstrates mastery beyond grade level in most situations',
  },
  {
    level: 'ME1',
    parent: 'ME',
    name: 'Meeting Expectations 1',
    label: 'High Average',
    points: 6,
    scoreRange: { min: 58, max: 74 },
    color: '#1d4ed8',
    bgColor: '#dbeafe',
    description: 'Meets grade-level competencies with minimal support',
  },
  {
    level: 'ME2',
    parent: 'ME',
    name: 'Meeting Expectations 2',
    label: 'Average',
    points: 5,
    scoreRange: { min: 41, max: 57 },
    color: '#2563eb',
    bgColor: '#dbeafe',
    description: 'Meets grade-level competencies with some support',
  },
  {
    level: 'AE1',
    parent: 'AE',
    name: 'Approaching Expectations 1',
    label: 'Low Average',
    points: 4,
    scoreRange: { min: 31, max: 40 },
    color: '#b45309',
    bgColor: '#fef9c3',
    description: 'Partially meets expectations, developing with support',
  },
  {
    level: 'AE2',
    parent: 'AE',
    name: 'Approaching Expectations 2',
    label: 'Below Average',
    points: 3,
    scoreRange: { min: 21, max: 30 },
    color: '#d97706',
    bgColor: '#fef9c3',
    description: 'Partially meets expectations, requires considerable support',
  },
  {
    level: 'BE1',
    parent: 'BE',
    name: 'Below Expectations 1',
    label: 'Low',
    points: 2,
    scoreRange: { min: 11, max: 20 },
    color: '#c2410c',
    bgColor: '#ffedd5',
    description: 'Has not met expectations, needs substantial support',
  },
  {
    level: 'BE2',
    parent: 'BE',
    name: 'Below Expectations 2',
    label: 'Very Low',
    points: 1,
    scoreRange: { min: 0, max: 10 },
    color: '#b91c1c',
    bgColor: '#fee2e2',
    description: 'Has not met expectations, demonstrates minimal understanding',
  },
];

// ─── 4-level parent scale (legacy / summary use) ───────────────────────────
export const performanceScale = [
  {
    level: 'EE',
    name: 'Exceeding Expectations',
    scoreRange: { min: 75, max: 100 },
    color: '#16a34a',
    bgColor: '#dcfce7',
    description: 'Consistently demonstrates mastery beyond grade level',
    indicators: [
      'Solves problems independently with advanced strategies',
      'Makes connections across different strands',
      'Explains reasoning clearly and accurately',
      'Applies concepts to new situations',
      'Shows creativity and critical thinking',
    ],
  },
  {
    level: 'ME',
    name: 'Meeting Expectations',
    scoreRange: { min: 41, max: 74 },
    color: '#2563eb',
    bgColor: '#dbeafe',
    description: 'Demonstrates grade-level competencies with minimal support',
    indicators: [
      'Understands key concepts',
      'Applies learned skills correctly',
      'Works with some independence',
      'Shows consistent performance',
      'Completes tasks as expected',
    ],
  },
  {
    level: 'AE',
    name: 'Approaching Expectations',
    scoreRange: { min: 21, max: 40 },
    color: '#d97706',
    bgColor: '#fef9c3',
    description: 'Developing competencies, needs support',
    indicators: [
      'Grasps basic concepts with help',
      'Requires scaffolding for tasks',
      'Shows inconsistent performance',
      'Needs more practice',
      'Benefits from additional support',
    ],
  },
  {
    level: 'BE',
    name: 'Below Expectations',
    scoreRange: { min: 0, max: 20 },
    color: '#b91c1c',
    bgColor: '#fee2e2',
    description: 'Struggles with competencies, requires intervention',
    indicators: [
      'Difficulty understanding concepts',
      'Requires significant support',
      'Shows limited progress',
      'Needs intensive intervention',
      'Struggles with basic tasks',
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Get the 8-level detailed rubric entry from a percentage score.
 * @param {number} score - Percentage (0-100)
 * @returns {Object} detailedPerformanceScale entry
 */
export const getDetailedRubricFromScore = (score) => {
  return (
    detailedPerformanceScale.find(
      (r) => score >= r.scoreRange.min && score <= r.scoreRange.max
    ) || detailedPerformanceScale[detailedPerformanceScale.length - 1]
  );
};

/**
 * Get the 8-level code string from a percentage score.
 * @param {number} score - Percentage (0-100)
 * @returns {string} e.g. 'EE1', 'ME2', 'BE1'
 */
export const getRubricCodeFromScore = (score) => {
  return getDetailedRubricFromScore(score).level;
};

/**
 * Get the 4-level parent rubric from a percentage score (for summary/broadsheet use).
 * @param {number} score - Percentage (0-100)
 * @returns {{ level: string, color: string }}
 */
export const getRubricFromScore = (score) => {
  const detailed = getDetailedRubricFromScore(score);
  const parent = performanceScale.find((p) => p.level === detailed.parent);
  return parent
    ? { level: parent.level, color: parent.color }
    : { level: 'BE', color: '#b91c1c' };
};

/**
 * Get full 4-level parent scale object from a percentage score.
 * @param {number} score - Percentage (0-100)
 * @returns {Object} performanceScale entry
 */
export const getFullRubricFromScore = (score) => {
  const { level } = getRubricFromScore(score);
  return performanceScale.find((s) => s.level === level);
};

/**
 * Derive the 4-level parent band from an 8-level detailed code.
 * @param {string} detailedCode - e.g. 'EE1', 'ME2'
 * @returns {string} parent band e.g. 'EE', 'ME'
 */
export const getParentBand = (detailedCode) => {
  if (!detailedCode) return '';
  const entry = detailedPerformanceScale.find((r) => r.level === detailedCode);
  return entry ? entry.parent : detailedCode.replace(/\d$/, '');
};

/**
 * Calculate weighted grade (60% formative, 40% summative).
 * @param {number} formative - Formative average
 * @param {number} summative - Summative score
 * @returns {number} Weighted final grade
 */
export const calculateWeightedGrade = (formative, summative) => {
  return Math.round(formative * 0.6 + summative * 0.4);
};
