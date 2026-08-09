jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    aIGeneratedContent: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import prisma from '../config/database';
import type { AIContext, AIResponse } from '../ai/types';
import {
  archiveAIConversation,
  getAIConversationHistory,
  saveAIExchange,
} from '../ai/conversations/AIConversationStore';

const context: AIContext = {
  user: {
    id: 'user-1',
    role: 'ADMIN',
    name: 'Admin User',
    schoolId: 'school-1',
  },
  school: { id: 'school-1', name: 'Test School' },
  currentModule: 'pathways',
};

const response: AIResponse = {
  message: 'The learner is ready for STEM.',
  data: { pathway: 'STEM' },
  meta: {
    provider: 'test-provider',
    model: 'test-model',
    inputTokens: 12,
    outputTokens: 8,
    durationMs: 25,
  },
};

describe('AIConversationStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists an exchange with its user, school, and session scope', async () => {
    (prisma.aIGeneratedContent.create as jest.Mock).mockResolvedValue({ id: 'exchange-1' });

    await saveAIExchange({
      sessionId: 'session_12345678',
      userMessage: 'Show pathway readiness',
      response,
      context,
    });

    expect(prisma.aIGeneratedContent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: 'school-1',
        createdBy: 'user-1',
        entityType: 'AI_CHAT_SESSION',
        entityId: 'session_12345678',
        type: 'NL_ANSWER',
        tokensUsed: 20,
      }),
    });
  });

  it('does not persist confirmation tool input or execution context', async () => {
    (prisma.aIGeneratedContent.create as jest.Mock).mockResolvedValue({ id: 'exchange-2' });
    await saveAIExchange({
      sessionId: 'session_12345678',
      userMessage: 'Finalize this pathway',
      context,
      response: {
        ...response,
        pendingConfirmation: {
          confirmationId: 'confirmation-1',
          toolName: 'finalize_learner_pathway',
          input: { learnerId: 'learner-1', privateNote: 'do not persist' },
          context,
          details: { title: 'Finalize pathway', summary: 'Locks the decision', consequences: ['The decision is locked'] },
        },
      },
    });

    const createData = (prisma.aIGeneratedContent.create as jest.Mock).mock.calls[0][0].data;
    const stored = JSON.parse(createData.content);
    expect(stored.pendingConfirmation).toEqual({
      confirmationId: 'confirmation-1',
      toolName: 'finalize_learner_pathway',
      details: { title: 'Finalize pathway', summary: 'Locks the decision', consequences: ['The decision is locked'] },
    });
    expect(createData.content).not.toContain('privateNote');
    expect(createData.content).not.toContain('Admin User');
  });

  it('reads only active history owned by the user and school', async () => {
    (prisma.aIGeneratedContent.findMany as jest.Mock).mockResolvedValue([{
      id: 'exchange-1',
      entityId: 'session_12345678',
      prompt: 'Show pathway readiness',
      content: JSON.stringify(response),
      provider: 'test-provider',
      tokensUsed: 20,
      createdAt: new Date('2026-08-08T08:00:00.000Z'),
    }]);

    const history = await getAIConversationHistory({
      sessionId: 'session_12345678',
      userId: 'user-1',
      schoolId: 'school-1',
      limit: 500,
    });

    expect(prisma.aIGeneratedContent.findMany).toHaveBeenCalledWith({
      where: {
        entityType: 'AI_CHAT_SESSION',
        entityId: 'session_12345678',
        createdBy: 'user-1',
        archived: false,
        schoolId: 'school-1',
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    expect(history[0]).toEqual(expect.objectContaining({
      sessionId: 'session_12345678',
      userMessage: 'Show pathway readiness',
      response: expect.objectContaining({ message: response.message }),
    }));
  });

  it('archives only the requesting user’s session in the active school', async () => {
    (prisma.aIGeneratedContent.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const count = await archiveAIConversation({
      sessionId: 'session_12345678',
      userId: 'user-1',
      schoolId: 'school-1',
    });

    expect(count).toBe(2);
    expect(prisma.aIGeneratedContent.updateMany).toHaveBeenCalledWith({
      where: {
        entityType: 'AI_CHAT_SESSION',
        entityId: 'session_12345678',
        createdBy: 'user-1',
        archived: false,
        schoolId: 'school-1',
      },
      data: { archived: true },
    });
  });
});
