import {
  DEFAULT_SCHOOL_MATCH_CONFIG,
  ensureDefaultSchoolMatchRuleSet,
} from '../services/senior-school-catalog.seed';

describe('Senior school catalogue rule seeding', () => {
  const prismaMock: any = {
    pathwayRuleSet: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a published SCHOOL_MATCH rule after the latest existing version', async () => {
    prismaMock.pathwayRuleSet.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 3 });
    prismaMock.pathwayRuleSet.create.mockResolvedValue({ id: 'rule-4', version: 4 });

    const result = await ensureDefaultSchoolMatchRuleSet(prismaMock);

    expect(prismaMock.pathwayRuleSet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        domain: 'SCHOOL_MATCH',
        version: 4,
        status: 'PUBLISHED',
        config: DEFAULT_SCHOOL_MATCH_CONFIG,
        publishedAt: expect.any(Date),
      }),
      select: { id: true, version: true },
    });
    expect(result).toEqual({ created: true, id: 'rule-4', version: 4 });
  });

  it('keeps an existing published SCHOOL_MATCH rule unchanged', async () => {
    prismaMock.pathwayRuleSet.findFirst.mockResolvedValue({ id: 'rule-2', version: 2 });

    const result = await ensureDefaultSchoolMatchRuleSet(prismaMock);

    expect(prismaMock.pathwayRuleSet.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: false, id: 'rule-2', version: 2 });
  });
});
