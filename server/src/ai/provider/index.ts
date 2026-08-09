/**
 * AI Provider wrapper for TrendSCORE.
 *
 * Wraps the existing ai-bridge.service with:
 *   - Model routing by tier (fast / standard / reasoning)
 *   - TrendSCORE-specific system prompt injection
 *   - Context-aware prompt augmentation
 *
 * The underlying AIBridgeService handles Anthropic ↔ OpenAI switching.
 * This layer handles WHAT model to use and HOW to structure the prompt.
 */

import { aiBridgeService } from '../../services/ai-bridge.service';
import type { AIContext, ModelTier } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// MODEL ROUTING TABLE
// env vars can override any tier
// ─────────────────────────────────────────────────────────────────────────────

interface ModelConfig {
  maxTokens: number;
  temperature: number;
}

const MODEL_TIERS: Record<ModelTier, ModelConfig> = {
  fast: {
    maxTokens: 512,
    temperature: 0.3,
  },
  standard: {
    maxTokens: 1024,
    temperature: 0.5,
  },
  reasoning: {
    maxTokens: 2048,
    temperature: 0.2,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(context: AIContext): string {
  const roleLabel = context.user.role.replace(/_/g, ' ').toLowerCase();

  return [
    `You are TrendSCORE AI, an intelligent assistant embedded in the TrendSCORE school management platform.`,
    ``,
    `Current session:`,
    `- School: ${context.school.name}`,
    `- User: ${context.user.name} (${roleLabel})`,
    `- Module: ${context.currentModule}`,
    context.selectedEntity
      ? `- Selected ${context.selectedEntity.type}: ${context.selectedEntity.name}`
      : null,
    context.school.academicYear
      ? `- Academic year: ${context.school.academicYear}, ${context.school.term || 'current term'}`
      : null,
    ``,
    `Rules you must follow:`,
    `1. Only answer using data provided to you in tool results. Never invent student names, scores, or records.`,
    `2. When you need data, call the appropriate tool. Never guess or fabricate values.`,
    `3. For consequential actions (finalizing decisions, sending bulk messages), always describe what you are about to do and wait for confirmation.`,
    `4. Keep responses concise and professional. You are a school management assistant, not a chatbot.`,
    `5. If you cannot help with something due to permissions, explain why clearly.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCallOptions {
  tier?: ModelTier;
  context: AIContext;
  jsonMode?: boolean;
}

export interface ProviderResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callAI(
  prompt: string,
  opts: ProviderCallOptions
): Promise<ProviderResult> {
  const tier = opts.tier ?? 'fast';
  const config = MODEL_TIERS[tier];

  const systemPrompt = buildSystemPrompt(opts.context);

  const response = await aiBridgeService.generateCompletion(prompt, {
    systemPrompt,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    jsonMode: opts.jsonMode,
  });

  return {
    content: response.content,
    provider: response.provider,
    model: response.model,
    inputTokens: response.usage?.promptTokens ?? 0,
    outputTokens: response.usage?.completionTokens ?? 0,
  };
}

/**
 * Choose the appropriate model tier for a task.
 *
 * Simple lookups → fast
 * Data analysis / summaries → standard
 * Complex reasoning / multi-step → reasoning
 */
export function routeModelTier(task: string): ModelTier {
  const lower = task.toLowerCase();

  if (
    lower.includes('analyz') ||
    lower.includes('trend') ||
    lower.includes('compare') ||
    lower.includes('predict') ||
    lower.includes('insight') ||
    lower.includes('summarize')
  ) {
    return 'standard';
  }

  if (
    lower.includes('reason') ||
    lower.includes('complex') ||
    lower.includes('explain why') ||
    lower.includes('diagnos')
  ) {
    return 'reasoning';
  }

  return 'fast';
}
