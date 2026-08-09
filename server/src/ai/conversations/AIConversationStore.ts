import prisma from '../../config/database';
import type { AIContext, AIResponse, ConfirmationRequest } from '../types';

const ENTITY_TYPE = 'AI_CHAT_SESSION';

export interface StoredAIExchange {
  id: string;
  sessionId: string;
  userMessage: string;
  response: Pick<AIResponse, 'message' | 'toolCalls' | 'data' | 'meta'> & {
    pendingConfirmation?: Pick<ConfirmationRequest, 'confirmationId' | 'toolName' | 'details'>;
  };
  createdAt: Date;
}

export async function saveAIExchange(params: {
  sessionId: string;
  userMessage: string;
  response: AIResponse;
  context: AIContext;
}): Promise<void> {
  if (!params.context.school.id) return;

  await prisma.aIGeneratedContent.create({
    data: {
      schoolId: params.context.school.id,
      type: 'NL_ANSWER',
      entityId: params.sessionId,
      entityType: ENTITY_TYPE,
      prompt: params.userMessage,
      content: JSON.stringify({
        message: params.response.message,
        pendingConfirmation: params.response.pendingConfirmation
          ? {
            confirmationId: params.response.pendingConfirmation.confirmationId,
            toolName: params.response.pendingConfirmation.toolName,
            details: params.response.pendingConfirmation.details,
          }
          : undefined,
        toolCalls: params.response.toolCalls,
        data: params.response.data,
        meta: params.response.meta,
      }),
      provider: params.response.meta.provider,
      tokensUsed: params.response.meta.inputTokens + params.response.meta.outputTokens,
      createdBy: params.context.user.id,
    },
  });
}

export async function getAIConversationHistory(params: {
  sessionId: string;
  userId: string;
  schoolId?: string;
  limit?: number;
}): Promise<StoredAIExchange[]> {
  const rows = await prisma.aIGeneratedContent.findMany({
    where: {
      entityType: ENTITY_TYPE,
      entityId: params.sessionId,
      createdBy: params.userId,
      archived: false,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(params.limit || 50, 1), 100),
  });

  return rows.map((row) => {
    let response: StoredAIExchange['response'];
    try {
      response = JSON.parse(row.content) as StoredAIExchange['response'];
    } catch {
      response = {
        message: row.content,
        meta: {
          provider: row.provider || 'unknown',
          model: 'unknown',
          inputTokens: 0,
          outputTokens: row.tokensUsed || 0,
          durationMs: 0,
        },
      };
    }
    return {
      id: row.id,
      sessionId: row.entityId,
      userMessage: row.prompt || '',
      response,
      createdAt: row.createdAt,
    };
  });
}

export async function archiveAIConversation(params: {
  sessionId: string;
  userId: string;
  schoolId?: string;
}): Promise<number> {
  const result = await prisma.aIGeneratedContent.updateMany({
    where: {
      entityType: ENTITY_TYPE,
      entityId: params.sessionId,
      createdBy: params.userId,
      archived: false,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    },
    data: { archived: true },
  });
  return result.count;
}
