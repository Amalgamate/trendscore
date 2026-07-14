jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: { findUnique: jest.fn() },
    learnerPathwaySelection: { findUnique: jest.fn() },
  },
}));

import prisma from '../config/database';
import {
  assertLearnerPathwayStage,
  normalizePathwayGrade,
  pathwayStageForGrade,
} from '../middleware/pathwayStage.middleware';

const mockedPrisma = prisma as any;

describe('pathway stage authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['GRADE_7', 'GRADE7'], ['Grade 9', 'GRADE9'], ['GRADE10', 'GRADE10'], ['FORM_2', 'FORM2'],
  ])('normalizes %s', (input, expected) => expect(normalizePathwayGrade(input)).toBe(expected));

  test('separates junior transition and senior execution grades', () => {
    expect(pathwayStageForGrade('GRADE_9')).toBe('JUNIOR_TRANSITION');
    expect(pathwayStageForGrade('GRADE_10')).toBe('SENIOR_EXECUTION');
    expect(pathwayStageForGrade('GRADE_6')).toBeNull();
  });

  test('allows a Grade 9 learner into transition planning', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({ id: 'l1', grade: 'GRADE_9', institutionType: 'PRIMARY_CBC' });
    await expect(assertLearnerPathwayStage('l1', ['JUNIOR_TRANSITION'])).resolves.toMatchObject({ pathwayStage: 'JUNIOR_TRANSITION' });
  });

  test('blocks a Grade 9 learner from senior execution with a clear code', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({ id: 'l1', grade: 'GRADE_9', institutionType: 'PRIMARY_CBC' });
    await expect(assertLearnerPathwayStage('l1', ['SENIOR_EXECUTION'])).rejects.toMatchObject({ statusCode: 403, code: 'PATHWAY_STAGE_FORBIDDEN' });
  });

  test('allows a Grade 10 learner into senior execution', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({ id: 'l2', grade: 'GRADE10', institutionType: 'SECONDARY' });
    await expect(assertLearnerPathwayStage('l2', ['SENIOR_EXECUTION'])).resolves.toMatchObject({ pathwayStage: 'SENIOR_EXECUTION' });
  });
});
