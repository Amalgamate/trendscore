/**
 * Conversation memory + tool awareness in the orchestrator prompt.
 *
 * These tests cover the two defects this branch fixes:
 *   1. History was persisted and shown in the UI, but never reached the model,
 *      so every turn started blank — "summarise that again" failed.
 *   2. Only the `pathways` module described any tools, so in every other module
 *      a small local model had nothing to call and invented answers instead.
 *
 * The prompt is captured at the boundary (`callAI`) because that is exactly what
 * the model sees — asserting on internal helpers would not catch a regression in
 * how the blocks are assembled.
 */

jest.mock('../ai/provider', () => ({
  __esModule: true,
  callAI: jest.fn(),
  routeModelTier: jest.fn(() => 'fast'),
}));

jest.mock('../services/ai-settings.service', () => ({
  __esModule: true,
  resolveActiveAIMode: jest.fn(async () => 'ollama'),
}));

jest.mock('../ai/tools/ToolRegistry', () => ({
  __esModule: true,
  executeTool: jest.fn(),
  registerTool: jest.fn(),
}));

jest.mock('../ai/workflow/FreeWorkflowEngine', () => ({
  __esModule: true,
  processFreeWorkflowRequest: jest.fn(),
}));

import { callAI } from '../ai/provider';
import { processAIRequest } from '../ai/TrendSCOREAI';
import type { AIContext, AIConversationTurn } from '../ai/types';

const context: AIContext = {
  user: {
    id: 'user-1',
    role: 'HEAD_TEACHER',
    name: 'Grace Wanjiru',
    schoolId: 'school-1',
  },
  school: { id: 'school-1', name: 'Zawadi Junior School' },
  currentModule: 'fees',
};

const mockReply = (content: string) => {
  (callAI as jest.Mock).mockResolvedValue({
    content,
    provider: 'ollama',
    model: 'qwen2.5:1.5b-instruct',
    inputTokens: 100,
    outputTokens: 20,
  });
};

/** The prompt handed to the model on the first pass. */
const capturedPrompt = (): string => {
  expect(callAI).toHaveBeenCalled();
  return (callAI as jest.Mock).mock.calls[0][0] as string;
};

describe('AI conversation memory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes earlier turns so follow-up questions resolve', async () => {
    mockReply('Grade 7 owes the most, about KES 84,000 in total.');

    const history: AIConversationTurn[] = [
      { userMessage: 'How much is outstanding in Grade 7?', assistantMessage: 'Grade 7 owes KES 84,000 across 12 learners.' },
      { userMessage: 'Which class is worst?', assistantMessage: 'Grade 7 is the worst, followed by Grade 9.' },
    ];

    await processAIRequest({ userMessage: 'And what about that one?', context, history });

    const prompt = capturedPrompt();
    expect(prompt).toContain('Earlier in this conversation');
    expect(prompt).toContain('How much is outstanding in Grade 7?');
    expect(prompt).toContain('Grade 7 owes KES 84,000 across 12 learners.');
    expect(prompt).toContain('And what about that one?');
    // The transcript must be ordered oldest-first and explicitly numbered,
    // otherwise the model reads the last question as the first one.
    expect(prompt.indexOf('Turn 1:')).toBeLessThan(prompt.indexOf('Turn 2:'));
  });

  it('omits the transcript entirely on a first turn', async () => {
    mockReply('Hello Grace — what would you like to look at?');

    await processAIRequest({ userMessage: 'Hi', context, history: [] });

    const prompt = capturedPrompt();
    expect(prompt).not.toContain('Earlier in this conversation');
    // Persona still applies, so the model introduces itself as Wendy.
    expect(prompt).toContain('Wendy');
    expect(prompt).toContain('Zawadi Junior School');
  });

  it('keeps only the most recent turns and truncates long ones', async () => {
    mockReply('Noted.');

    const longMessage = 'x'.repeat(2000);
    const history: AIConversationTurn[] = Array.from({ length: 10 }, (_, index) => ({
      userMessage: `question ${index + 1}`,
      assistantMessage: longMessage,
    }));

    await processAIRequest({ userMessage: 'continue', context, history });

    const prompt = capturedPrompt();
    // Six most recent turns survive; the first four are dropped for window budget.
    // Match the full line so "question 1" does not accidentally match "question 10".
    expect(prompt).not.toContain('User: question 1\n');
    expect(prompt).not.toContain('User: question 4\n');
    expect(prompt).toContain('User: question 5\n');
    expect(prompt).toContain('User: question 10\n');
    // Only six turns are rendered.
    expect(prompt.match(/^Turn \d+:$/gm)).toHaveLength(6);

    // Each turn is capped, so ten 2000-char replies cannot flood the window.
    expect(prompt.length).toBeLessThan(10 * 2000);
  });

  it('does not splice history into a confirmation turn', async () => {
    // executeConfirmedAction is a separate path. An unknown confirmation id
    // returns a friendly message rather than throwing — but the important
    // assertion is that the transcript is never rendered there.
    const response = await processAIRequest({
      userMessage: 'yes, finalize it',
      context,
      confirmationId: 'confirmation-1',
      history: [{ userMessage: 'finalize', assistantMessage: 'Shall I finalize?' }],
    });

    expect(response.message).toMatch(/expired or is invalid/i);

    const prompts = (callAI as jest.Mock).mock.calls.map((call) => call[0] as string);
    prompts.forEach((prompt) => {
      expect(prompt).not.toContain('Earlier in this conversation');
    });
  });
});

describe('AI tool awareness across modules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('describes school data tools outside the pathways module', async () => {
    mockReply('Looking that up.');

    await processAIRequest({ userMessage: 'What does Brian owe?', context });

    const prompt = capturedPrompt();
    expect(prompt).toContain('find_learner');
    expect(prompt).toContain('get_learner_fee_balance');
    expect(prompt).toContain('TOOL_CALL:');
  });

  it('adds module-specific tools on top of the always-available set', async () => {
    mockReply('Checking readiness.');

    await processAIRequest({
      userMessage: 'Can you help me prepare for the meeting?',
      context: { ...context, currentModule: 'pathways' },
    });

    const prompt = capturedPrompt();
    expect(prompt).toContain('get_learner_readiness');
    expect(prompt).toContain('find_learner');
  });

  it('instructs the model not to invent figures it does not have', async () => {
    mockReply('I do not have that figure.');

    await processAIRequest({ userMessage: 'How much did we collect in March?', context });

    expect(capturedPrompt()).toContain('Never invent learner names, figures, dates or fee amounts');
  });

  it('names the caller and their role so replies match the audience', async () => {
    mockReply('Here is the summary.');

    await processAIRequest({ userMessage: 'Tell me about yourself', context });

    const prompt = capturedPrompt();
    expect(prompt).toContain('Grace Wanjiru');
    expect(prompt).toContain('head teacher');
  });
});
