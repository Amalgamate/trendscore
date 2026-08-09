/**
 * TrendSCORE AI — Public Exports
 */

// ── Tool registrations (import side-effects register tools into the registry)
import './tools/pathway.tools';
import './tools/notification.tools';

export { processAIRequest } from './TrendSCOREAI';
export { buildAIContext, buildMinimalContext } from './context/ContextManager';
export { executeTool, registerTool, listTools } from './tools/ToolRegistry';
export { createConfirmation, consumeConfirmation } from './confirmations/ConfirmationWorkflow';
export type {
  AIContext,
  AIRequest,
  AIResponse,
  ToolDefinition,
  ToolCategory,
  ConfirmationDetails,
  ConfirmationRequest,
  ModelTier,
  UserRole,
} from './types';
