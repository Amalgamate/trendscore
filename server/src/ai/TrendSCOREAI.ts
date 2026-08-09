/**
 * TrendSCORE AI — Main Orchestrator
 *
 * Entry point for all AI requests in TrendSCORE.
 * Handles:
 *   1. Context resolution
 *   2. Model routing (fast / standard / reasoning)
 *   3. Tool dispatch
 *   4. Confirmation gate
 *   5. Response assembly
 *
 * The orchestrator does NOT hard-code any module logic.
 * Module-specific tools register themselves (see tools/ directory).
 */

import { callAI, routeModelTier } from './provider';
import { executeTool } from './tools/ToolRegistry';
import type { AIContext, AIRequest, AIResponse } from './types';
import { resolveActiveAIMode, type AIMode } from '../services/ai-settings.service';
import { processFreeWorkflowRequest } from './workflow/FreeWorkflowEngine';

// ─────────────────────────────────────────────────────────────────────────────
// TOOL REGISTRATION
// Import all tool files here so they register on startup
// ─────────────────────────────────────────────────────────────────────────────

import './tools/pathway.tools';

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function processAIRequest(request: AIRequest): Promise<AIResponse> {
  const start = Date.now();
  const { userMessage, context, confirmationId, modelTier } = request;
  const mode = await resolveActiveAIMode();

  // If a confirmation ID was provided, re-execute the pending tool
  if (confirmationId) {
    return executeConfirmedAction(confirmationId, context, start, mode);
  }

  if (mode === 'workflow') return processFreeWorkflowRequest(request);

  const tier = modelTier ?? routeModelTier(userMessage);

  // Build a prompt that includes tool awareness
  const toolAwarePrompt = buildToolAwarePrompt(userMessage, context);

  // First pass: ask the model what it wants to do
  const firstPass = await callAI(toolAwarePrompt, { tier, context });

  // Parse tool call intent from model response
  const toolCallIntent = parseToolCallIntent(firstPass.content);

  if (!toolCallIntent) {
    // No tool needed — return model response directly
    return {
      message: firstPass.content,
      meta: {
        provider: firstPass.provider,
        model: firstPass.model,
        inputTokens: firstPass.inputTokens,
        outputTokens: firstPass.outputTokens,
        durationMs: Date.now() - start,
      },
    };
  }

  // Execute the tool
  const toolResult = await executeTool(
    toolCallIntent.toolName,
    toolCallIntent.input,
    context
  );

  // Tool requires confirmation before proceeding
  if (toolResult.pendingConfirmation) {
    return {
      message: buildConfirmationMessage(toolResult.pendingConfirmation.details),
      pendingConfirmation: toolResult.pendingConfirmation,
      meta: {
        provider: firstPass.provider,
        model: firstPass.model,
        inputTokens: firstPass.inputTokens,
        outputTokens: firstPass.outputTokens,
        durationMs: Date.now() - start,
      },
    };
  }

  if (!toolResult.success) {
    return {
      message: toolResult.error || 'I was unable to complete that action.',
      meta: {
        provider: firstPass.provider,
        model: firstPass.model,
        inputTokens: firstPass.inputTokens,
        outputTokens: firstPass.outputTokens,
        durationMs: Date.now() - start,
      },
    };
  }

  // Second pass: ask model to explain the tool result in natural language
  const explanationPrompt = buildExplanationPrompt(
    userMessage,
    toolCallIntent.toolName,
    toolResult.data
  );

  const secondPass = await callAI(explanationPrompt, { tier: 'fast', context });

  return {
    message: secondPass.content,
    toolCalls: [{ toolName: toolCallIntent.toolName, input: toolCallIntent.input }],
    data: toolResult.data,
    meta: {
      provider: secondPass.provider,
      model: secondPass.model,
      inputTokens: firstPass.inputTokens + secondPass.inputTokens,
      outputTokens: firstPass.outputTokens + secondPass.outputTokens,
      durationMs: Date.now() - start,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMED ACTION EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function executeConfirmedAction(
  confirmationId: string,
  context: AIContext,
  start: number,
  mode: AIMode
): Promise<AIResponse> {
  // We need to look up the pending confirmation to know the tool name
  const { consumeConfirmation } = await import('./confirmations/ConfirmationWorkflow');
  const pending = await consumeConfirmation(confirmationId, context.user.id);

  if (!pending) {
    return {
      message: 'This confirmation has expired or is invalid. Please try your request again.',
      meta: { provider: 'n/a', model: 'n/a', inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start },
    };
  }

  // Re-register confirmation to re-execute (consumeConfirmation already removed it)
  // Execute directly now that we have the confirmed request
  const { createConfirmation } = await import('./confirmations/ConfirmationWorkflow');
  const reconfirmed = await createConfirmation(
    pending.toolName,
    pending.input,
    context,
    pending.details
  );

  const toolResult = await executeTool(
    pending.toolName,
    pending.input,
    context,
    reconfirmed.confirmationId
  );

  if (!toolResult.success) {
    return {
      message: toolResult.error || 'The action could not be completed.',
      meta: { provider: 'n/a', model: 'n/a', inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start },
    };
  }

  if (mode === 'workflow') {
    return {
      message: `${pending.details.title} completed successfully.`,
      toolCalls: [{ toolName: pending.toolName, input: pending.input }],
      data: toolResult.data,
      meta: {
        provider: 'workflow',
        model: 'deterministic-v1',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - start,
      },
    };
  }

  const explanationPrompt = buildExplanationPrompt(
    `Confirmed: ${pending.details.title}`,
    pending.toolName,
    toolResult.data
  );

  const explanation = await callAI(explanationPrompt, { tier: 'fast', context });

  return {
    message: explanation.content,
    toolCalls: [{ toolName: pending.toolName, input: pending.input }],
    data: toolResult.data,
    meta: {
      provider: explanation.provider,
      model: explanation.model,
      inputTokens: explanation.inputTokens,
      outputTokens: explanation.outputTokens,
      durationMs: Date.now() - start,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildToolAwarePrompt(userMessage: string, context: AIContext): string {
  const moduleTools = getModuleToolDescriptions(context.currentModule);

  return [
    `User request: "${userMessage}"`,
    ``,
    moduleTools
      ? [
          `Available tools for the ${context.currentModule} module:`,
          moduleTools,
          ``,
          `If you need data to answer this request, respond with a tool call in this exact format:`,
          `TOOL_CALL: { "tool": "<tool_name>", "input": { ... } }`,
          ``,
          `If you can answer without a tool call, respond directly.`,
        ].join('\n')
      : 'Answer the user\'s question directly based on the context provided.',
  ].join('\n');
}

function buildExplanationPrompt(
  originalRequest: string,
  toolName: string,
  data: unknown
): string {
  return [
    `The user asked: "${originalRequest}"`,
    ``,
    `The tool "${toolName}" returned the following data:`,
    JSON.stringify(data, null, 2),
    ``,
    `Explain this result clearly and concisely to the user. `,
    `Do not repeat the raw JSON. Summarize what it means in plain language.`,
    `If there are any notable insights (e.g. mismatches, low confidence, pending actions), highlight them.`,
  ].join('\n');
}

function buildConfirmationMessage(details: { title: string; summary: string; consequences: string[] }): string {
  const lines = [
    `**${details.title}**`,
    ``,
    details.summary,
    ``,
    'This will:',
    ...details.consequences.map((c) => `• ${c}`),
    ``,
    'Please confirm to proceed.',
  ];
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL INTENT PARSING
// ─────────────────────────────────────────────────────────────────────────────

export function parseToolCallIntent(
  modelResponse: string
): { toolName: string; input: unknown } | null {
  const marker = 'TOOL_CALL:';
  const markerIndex = modelResponse.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = modelResponse.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let index = start; index < modelResponse.length; index += 1) {
    const char = modelResponse[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) return null;

  try {
    const parsed = JSON.parse(modelResponse.slice(start, end));
    if (typeof parsed.tool !== 'string') return null;
    return { toolName: parsed.tool, input: parsed.input ?? {} };
  } catch {
    return null;
  }
}

function getModuleToolDescriptions(module: string): string | null {
  const toolsByModule: Record<string, string[]> = {
    pathways: [
      '- get_learner_readiness(learnerId): Analyze a learner\'s Grade 9 pathway readiness',
      '- get_learner_pathway_status(learnerId): Get current recommendation + parent preference + finalization status',
      '- search_senior_schools(pathway, county?, gender?, limit?): Find senior schools for a pathway',
      '- get_class_pathway_summary(classId): Get pathway distribution across a class',
      '- submit_pathway_recommendation(learnerId, recommendedPathway, confidenceScore): Submit staff recommendation',
      '- submit_parent_preference(learnerId, parentPreference): Submit parent preference',
      '- finalize_learner_pathway(learnerId, finalApprovedPathway): Lock and finalize pathway [REQUIRES CONFIRMATION]',
    ],
  };

  const tools = toolsByModule[module];
  if (!tools || tools.length === 0) return null;
  return tools.join('\n');
}
