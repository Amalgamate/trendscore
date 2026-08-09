jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    learner: { findUnique: jest.fn(), findMany: jest.fn() },
    class: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    school: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

import type { AIContext } from '../ai/types';
import { parseToolCallIntent } from '../ai/TrendSCOREAI';
import { executeTool, listTools, registerTool } from '../ai/tools/ToolRegistry';
import prisma from '../config/database';

const context: AIContext = {
  user: {
    id: 'admin-1',
    role: 'ADMIN',
    name: 'Admin User',
    schoolId: 'school-1',
  },
  school: {
    id: 'school-1',
    name: 'Test School',
  },
  currentModule: 'pathways',
};

describe('AI tool-call parsing', () => {
  it('parses nested tool input JSON', () => {
    expect(parseToolCallIntent(
      'TOOL_CALL: {"tool":"get_learner_pathway_status","input":{"learnerId":"learner-1"}}',
    )).toEqual({
      toolName: 'get_learner_pathway_status',
      input: { learnerId: 'learner-1' },
    });
  });

  it('handles braces and escaped quotes inside string values', () => {
    expect(parseToolCallIntent(
      'Before\nTOOL_CALL: {"tool":"test","input":{"note":"value {with} \\\"quotes\\\""}}\nAfter',
    )).toEqual({
      toolName: 'test',
      input: { note: 'value {with} "quotes"' },
    });
  });

  it('rejects incomplete JSON', () => {
    expect(parseToolCallIntent(
      'TOOL_CALL: {"tool":"test","input":{"learnerId":"learner-1"}',
    )).toBeNull();
  });
});

describe('AI confirmation binding', () => {
  const toolName = 'test_confirmation_binding';
  const execute = jest.fn(async (input: unknown) => input);

  beforeAll(() => {
    registerTool({
      name: toolName,
      description: 'Test consequential action',
      category: 'CONSEQUENTIAL',
      allowedRoles: ['ADMIN'],
      requiresConfirmation: true,
      describeAction: () => ({
        title: 'Test action',
        summary: 'Test summary',
        consequences: ['A record changes'],
      }),
      execute,
    });
  });

  beforeEach(() => {
    execute.mockClear();
    (prisma.auditLog.create as jest.Mock).mockClear();
  });

  it('rejects a confirmation reused with changed input', async () => {
    const pending = await executeTool(toolName, { learnerId: 'learner-1' }, context);
    const confirmationId = pending.pendingConfirmation?.confirmationId;
    expect(confirmationId).toBeTruthy();

    const result = await executeTool(
      toolName,
      { learnerId: 'learner-2' },
      context,
      confirmationId,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not match/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes the exact action that was confirmed', async () => {
    const input = { learnerId: 'learner-1', pathway: 'STEM' };
    const pending = await executeTool(toolName, input, context);
    const confirmationId = pending.pendingConfirmation?.confirmationId;

    const result = await executeTool(toolName, input, context, confirmationId);

    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith(input, context);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'AI_TOOL_SUCCESS',
        userId: 'admin-1',
        path: toolName,
      }),
    }));
  });
});

describe('AI Pathways role policy', () => {
  it('does not let teachers submit recommendations through AI', () => {
    const tool = listTools().find((candidate) => candidate.name === 'submit_pathway_recommendation');
    expect(tool?.allowedRoles).not.toContain('TEACHER');
  });

  it('reserves final locking for the roles granted LOCK_PATHWAY', () => {
    const tool = listTools().find((candidate) => candidate.name === 'finalize_learner_pathway');
    expect(tool?.allowedRoles).toEqual(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);
  });
});
