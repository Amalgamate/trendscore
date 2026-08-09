const prismaMock = {
  learner: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  user: { findUnique: jest.fn(), count: jest.fn() },
  feeInvoice: { aggregate: jest.fn() },
  attendance: { groupBy: jest.fn() },
  summativeResult: { aggregate: jest.fn() },
  formativeAssessment: { count: jest.fn() },
  messageReceipt: { count: jest.fn() },
  book: { aggregate: jest.fn() },
  bookLoan: { groupBy: jest.fn() },
};

jest.mock('../config/database', () => ({ __esModule: true, default: prismaMock }));

import {
  detectWorkflowIntent,
  extractCardContext,
  processFreeWorkflowRequest,
} from '../ai/workflow/FreeWorkflowEngine';
import type { AIContext } from '../ai/types';

const context = (role: AIContext['user']['role'] = 'ADMIN'): AIContext => ({
  user: { id: 'user-1', role, name: 'Rico', schoolId: 'school-1' },
  school: { id: 'school-1', name: 'TrendSCORE School' },
  currentModule: 'dashboard',
});

describe('FreeWorkflowEngine', () => {
  beforeEach(() => jest.clearAllMocks());

  it('detects global workflows independently of Pathways', () => {
    expect(detectWorkflowIntent('Show me today attendance', 'dashboard')).toBe('attendance');
    expect(detectWorkflowIntent('How much is outstanding?', 'dashboard')).toBe('finance');
    expect(detectWorkflowIntent('Help me', 'library-catalog')).toBe('library');
  });

  it('extracts contextual Ask AI card content', () => {
    expect(extractCardContext([
      'Use this visible card context when answering:',
      'Card: Attendance rate',
      'Description: Today at a glance',
      'Visible card content: 92%',
      'User question: What should I know?',
    ].join('\n'))).toEqual({
      title: 'Attendance rate',
      description: 'Today at a glance',
      visibleContent: '92%',
    });
  });

  it('answers card questions without calling an external model or database', async () => {
    const result = await processFreeWorkflowRequest({
      context: context(),
      userMessage: [
        'Use this visible card context when answering:',
        'Card: Fee collection',
        'Visible card content: KES 120,000 collected',
        'User question: What should I know?',
      ].join('\n'),
    });

    expect(result.message).toContain('KES 120,000 collected');
    expect(result.meta).toMatchObject({ provider: 'workflow', model: 'deterministic-v1', inputTokens: 0 });
    expect(prismaMock.feeInvoice.aggregate).not.toHaveBeenCalled();
  });

  it('scopes a parent fee summary to linked learners', async () => {
    prismaMock.learner.findMany.mockResolvedValue([
      { id: 'learner-1', firstName: 'Amina', lastName: 'Otieno', grade: 'Grade 7' },
    ]);
    prismaMock.feeInvoice.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { totalAmount: 50000, paidAmount: 35000, balance: 15000 },
    });

    const result = await processFreeWorkflowRequest({
      context: context('PARENT'),
      userMessage: 'What is my fee balance?',
    });

    expect(result.message).toContain('Amina Otieno');
    expect(result.message).toContain('KES 15,000');
    expect(prismaMock.feeInvoice.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ learnerId: { in: ['learner-1'] } }),
    }));
  });
});
