jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: { findFirst: jest.fn() },
    termConfig: { count: jest.fn() },
    feeStructure: { count: jest.fn() },
    user: { count: jest.fn() },
    stream: { count: jest.fn() },
    class: { count: jest.fn() },
    learningArea: { count: jest.fn() },
    gradingRange: { count: jest.fn() },
    tertiaryDepartment: { count: jest.fn() },
    tertiaryProgram: { count: jest.fn() },
    tertiaryUnit: { count: jest.fn() },
  },
}));

jest.mock('../middleware/schoolContext.middleware', () => ({ clearSchoolCache: jest.fn() }));

import prisma from '../config/database';
import { getInstitutionSetupProgress } from '../controllers/school.controller';

const mockedPrisma = prisma as unknown as Record<string, { count?: jest.Mock; findFirst?: jest.Mock }>;

describe('getInstitutionSetupProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.school.findFirst!.mockResolvedValue({ name: 'Gamachu School' });
    for (const model of ['termConfig', 'feeStructure', 'user', 'stream', 'class', 'learningArea', 'gradingRange']) {
      mockedPrisma[model].count!.mockResolvedValue(0);
    }
  });

  it('does not query tertiary tables for a PRIMARY_CBC setup flow', async () => {
    const res = { json: jest.fn() } as any;

    await getInstitutionSetupProgress(
      { params: { institutionType: 'PRIMARY_CBC' } } as any,
      res,
    );

    expect(mockedPrisma.tertiaryDepartment.count).not.toHaveBeenCalled();
    expect(mockedPrisma.tertiaryProgram.count).not.toHaveBeenCalled();
    expect(mockedPrisma.tertiaryUnit.count).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
