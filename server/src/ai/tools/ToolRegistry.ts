/**
 * Tool Registry
 *
 * All AI tools are registered here.
 * Every tool call goes through:
 *   1. Permission check (role allowed?)
 *   2. Confirmation check (consequential? require confirmation)
 *   3. Execution (calls existing TrendSCORE services)
 *   4. Audit log
 */

import type {
  AIContext,
  AIAuditEntry,
  ToolDefinition,
  ToolCategory,
  ConfirmationRequest,
} from '../types';
import { checkToolPermission } from '../permissions/AIPermissionLayer';
import { createConfirmation, consumeConfirmation } from '../confirmations/ConfirmationWorkflow';
import logger from '../../utils/logger';
import { isDeepStrictEqual } from 'node:util';
import prisma from '../../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, ToolDefinition>();

export function registerTool<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
  if (registry.has(tool.name)) {
    throw new Error(`AI tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool as ToolDefinition);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(category?: ToolCategory): ToolDefinition[] {
  const tools = Array.from(registry.values());
  if (category) return tools.filter((t) => t.category === category);
  return tools;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  /** Set if the tool requires confirmation before it can execute */
  pendingConfirmation?: ConfirmationRequest;
  error?: string;
  durationMs: number;
}

/**
 * Execute a registered tool with full permission checks, confirmation
 * gate, and audit logging.
 *
 * @param toolName   Name of the registered tool
 * @param input      Tool input (validated by the tool itself)
 * @param context    Authenticated user context
 * @param confirmationId  If provided, consume a pending confirmation instead of creating one
 */
export async function executeTool(
  toolName: string,
  input: unknown,
  context: AIContext,
  confirmationId?: string
): Promise<ToolExecutionResult> {
  const startMs = Date.now();

  // 1. Look up tool
  const tool = registry.get(toolName);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}`, durationMs: 0 };
  }

  // 2. Permission check
  const permissionResult = checkToolPermission(tool, context);
  if (!permissionResult.allowed) {
    await writeAudit({
      userId: context.user.id,
      userRole: context.user.role,
      schoolId: context.user.schoolId,
      toolName,
      category: tool.category,
      confirmed: false,
      result: 'denied',
      errorMessage: permissionResult.reason,
      timestamp: new Date(),
      durationMs: Date.now() - startMs,
      inputTokens: 0,
      outputTokens: 0,
    });
    return { success: false, error: permissionResult.reason, durationMs: Date.now() - startMs };
  }

  // 3. Confirmation gate for consequential actions
  if (tool.requiresConfirmation) {
    if (!confirmationId) {
      // No confirmation provided — create one and return it to the client
      let details;
      try {
        details = tool.describeAction
          ? tool.describeAction(input, context)
          : {
              title: tool.name,
              summary: tool.description,
              consequences: ['This action will modify data.'],
            };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startMs,
        };
      }

      const confirmation = await createConfirmation(toolName, input, context, details);
      return {
        success: false,
        pendingConfirmation: confirmation,
        durationMs: Date.now() - startMs,
      };
    }

    // Confirmation ID provided — consume it
    const confirmed = await consumeConfirmation(confirmationId, context.user.id);
    if (!confirmed) {
      return {
        success: false,
        error: 'Confirmation expired or invalid. Please try again.',
        durationMs: Date.now() - startMs,
      };
    }
    if (confirmed.toolName !== toolName || !isDeepStrictEqual(confirmed.input, input)) {
      return {
        success: false,
        error: 'Confirmation does not match this action. Please request a new confirmation.',
        durationMs: Date.now() - startMs,
      };
    }
  }

  // 4. Execute
  try {
    const data = await tool.execute(input, context);

    await writeAudit({
      userId: context.user.id,
      userRole: context.user.role,
      schoolId: context.user.schoolId,
      toolName,
      category: tool.category,
      confirmed: tool.requiresConfirmation,
      result: 'success',
      timestamp: new Date(),
      durationMs: Date.now() - startMs,
      inputTokens: 0,
      outputTokens: 0,
    });

    return { success: true, data, durationMs: Date.now() - startMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    await writeAudit({
      userId: context.user.id,
      userRole: context.user.role,
      schoolId: context.user.schoolId,
      toolName,
      category: tool.category,
      confirmed: tool.requiresConfirmation,
      result: 'error',
      errorMessage: error,
      timestamp: new Date(),
      durationMs: Date.now() - startMs,
      inputTokens: 0,
      outputTokens: 0,
    });

    return { success: false, error, durationMs: Date.now() - startMs };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────────────────────────

async function writeAudit(entry: AIAuditEntry): Promise<void> {
  logger.info(
    {
      ai_audit: true,
      userId: entry.userId,
      schoolId: entry.schoolId,
      tool: entry.toolName,
      category: entry.category,
      result: entry.result,
      durationMs: entry.durationMs,
    },
    `[AI Audit] ${entry.toolName} → ${entry.result}`
  );

  try {
    await prisma.auditLog.create({
      data: {
        action: `AI_TOOL_${entry.result.toUpperCase()}`,
        userId: entry.userId,
        userRole: entry.userRole || null,
        method: 'AI_TOOL',
        path: entry.toolName,
        params: JSON.stringify({
          schoolId: entry.schoolId,
          category: entry.category,
          confirmed: entry.confirmed,
          affectedEntityId: entry.affectedEntityId || null,
          errorMessage: entry.errorMessage || null,
          durationMs: entry.durationMs,
        }),
      },
    });
  } catch (error) {
    logger.warn(
      { err: error, tool: entry.toolName, result: entry.result },
      '[AI Audit] Database persistence failed',
    );
  }
}
