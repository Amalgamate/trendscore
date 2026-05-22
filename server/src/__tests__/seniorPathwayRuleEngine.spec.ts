import { validateSeniorPathwaySelection } from '../services/senior-pathway-rule-engine.service';

const ids = {
  learner: 'learner-1',
  pathway: 'pathway-stem',
  track: 'track-pure',
  rule: 'rule-stem-pure',
  english: 'area-eng',
  kiswahili: 'area-kis',
  coreMath: 'area-core-math',
  csl: 'area-csl',
  biology: 'area-bio',
  chemistry: 'area-chem',
  physics: 'area-phy',
  french: 'area-french',
  theatre: 'area-theatre',
  pe: 'area-pe',
};

const areaRows = [
  { id: ids.english, officialCode: 'ENG', officialName: 'English', subjectType: 'EXAMINABLE_CORE', pathwayId: null, active: true },
  { id: ids.kiswahili, officialCode: 'KIS', officialName: 'Kiswahili', subjectType: 'EXAMINABLE_CORE', pathwayId: null, active: true },
  { id: ids.coreMath, officialCode: 'CORE_MATH', officialName: 'Core Mathematics', subjectType: 'EXAMINABLE_CORE', pathwayId: null, active: true },
  { id: ids.csl, officialCode: 'CSL', officialName: 'Community Service Learning', subjectType: 'EXAMINABLE_CORE', pathwayId: null, active: true },
  { id: ids.biology, officialCode: 'BIO', officialName: 'Biology', subjectType: 'EXAMINABLE_OPTIONAL', pathwayId: ids.pathway, active: true },
  { id: ids.chemistry, officialCode: 'CHEM', officialName: 'Chemistry', subjectType: 'EXAMINABLE_OPTIONAL', pathwayId: ids.pathway, active: true },
  { id: ids.physics, officialCode: 'PHY', officialName: 'Physics', subjectType: 'EXAMINABLE_OPTIONAL', pathwayId: ids.pathway, active: true },
  { id: ids.french, officialCode: 'FRENCH', officialName: 'French', subjectType: 'EXAMINABLE_OPTIONAL', pathwayId: 'social-pathway', active: true },
  { id: ids.theatre, officialCode: 'THEATRE_FILM', officialName: 'Theatre and Film', subjectType: 'EXAMINABLE_OPTIONAL', pathwayId: 'arts-pathway', active: true },
  { id: ids.pe, officialCode: 'PE', officialName: 'Physical Education', subjectType: 'SUPPORT_SUBJECT', pathwayId: null, active: true },
];

const makePrisma = (overrides: Record<string, any> = {}) => ({
  learner: {
    findUnique: jest.fn().mockResolvedValue({ id: ids.learner, institutionType: 'SECONDARY' }),
  },
  pathway: {
    findUnique: jest.fn().mockResolvedValue({ id: ids.pathway, code: 'STEM', active: true }),
  },
  pathwayTrack: {
    findUnique: jest.fn().mockResolvedValue({ id: ids.track, pathwayId: ids.pathway, active: true }),
  },
  subjectCombinationRule: {
    findUnique: jest.fn().mockResolvedValue({
      id: ids.rule,
      pathwayId: ids.pathway,
      trackId: ids.track,
      active: true,
      items: [
        { officialLearningAreaId: ids.biology },
        { officialLearningAreaId: ids.chemistry },
        { officialLearningAreaId: ids.physics },
      ],
    }),
  },
  officialLearningArea: {
    findMany: jest.fn().mockImplementation(({ where }: any) => {
      const requested = new Set(where.id.in);
      return Promise.resolve(areaRows.filter((row) => requested.has(row.id)));
    }),
  },
  learnerPathwaySelection: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  schoolLearningAreaOffering: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  ...overrides,
});

const validInput = {
  learnerId: ids.learner,
  pathwayId: ids.pathway,
  trackId: ids.track,
  combinationRuleId: ids.rule,
  compulsorySubjectIds: [ids.english, ids.kiswahili, ids.coreMath, ids.csl],
  optionalSubjectIds: [ids.biology, ids.chemistry, ids.physics],
};

describe('validateSeniorPathwaySelection', () => {
  test('passes a valid STEM Pure Sciences combination', async () => {
    const result = await validateSeniorPathwaySelection(makePrisma() as any, validInput);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects optional subjects that do not match the approved combination', async () => {
    const result = await validateSeniorPathwaySelection(makePrisma() as any, {
      ...validInput,
      optionalSubjectIds: [ids.biology, ids.french, ids.theatre],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('COMBINATION_NOT_APPROVED');
  });

  test('rejects missing mathematics from compulsory subjects', async () => {
    const result = await validateSeniorPathwaySelection(makePrisma() as any, {
      ...validInput,
      compulsorySubjectIds: [ids.english, ids.kiswahili, ids.csl, ids.pe],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('MATH_CORE_REQUIRED');
  });

  test('rejects support subjects counted as examinable subjects', async () => {
    const result = await validateSeniorPathwaySelection(makePrisma() as any, {
      ...validInput,
      optionalSubjectIds: [ids.biology, ids.chemistry, ids.pe],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('SUPPORT_SUBJECT_NOT_EXAMINABLE');
  });

  test('rejects edits to locked selections', async () => {
    const prisma = makePrisma({
      learnerPathwaySelection: {
        findUnique: jest.fn().mockResolvedValue({ id: 'selection-1', locked: true, status: 'LOCKED' }),
      },
    });

    const result = await validateSeniorPathwaySelection(prisma as any, {
      ...validInput,
      selectionId: 'selection-1',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('SELECTION_LOCKED');
  });
});
