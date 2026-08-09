/**
 * Shared types across the TrendSCORE AI layer.
 *
 * These types flow through every layer:
 *   context → tool → permission → provider → confirmation
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HEAD_TEACHER'
  | 'HEAD_OF_CURRICULUM'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT'
  | 'ACCOUNTANT'
  | 'RECEPTIONIST'
  | 'LIBRARIAN'
  | 'NURSE'
  | 'SECURITY'
  | 'DRIVER'
  | 'COOK';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/** Structured context object passed to every AI request. */
export interface AIContext {
  /** Authenticated user */
  user: {
    id: string;
    role: UserRole;
    name: string;
    schoolId: string;
  };

  /** School state */
  school: {
    id: string;
    name: string;
    academicYear?: number;
    term?: string;
  };

  /** Current module/route the user is on */
  currentModule: string;
  currentRoute?: string;

  /** Entity the user currently has selected (learner, class, etc.) */
  selectedEntity?: {
    type: 'learner' | 'class' | 'teacher' | 'parent' | 'staff';
    id: string;
    name: string;
  };

  /** Recent actions this session (last 5) */
  recentActions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLS
// ─────────────────────────────────────────────────────────────────────────────

/** Tool risk classification */
export type ToolCategory = 'READ' | 'SAFE_WRITE' | 'CONSEQUENTIAL';

/** A registered tool definition */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  category: ToolCategory;
  /** Roles allowed to invoke this tool */
  allowedRoles: UserRole[];
  /** Whether this tool requires explicit user confirmation before execution */
  requiresConfirmation: boolean;
  /** Execute the tool — only called after permission check passes */
  execute: (input: TInput, context: AIContext) => Promise<TOutput>;
  /** Describe what will happen (shown in confirmation UI) */
  describeAction?: (input: TInput, context: AIContext) => ConfirmationDetails;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Details shown to the user before a consequential action */
export interface ConfirmationDetails {
  title: string;
  summary: string;
  /** What the action does, in plain language */
  consequences: string[];
  /** Who/what is affected */
  affectedEntity?: string;
  /** Number of records affected */
  affectedCount?: number;
}

export interface ConfirmationRequest {
  toolName: string;
  input: unknown;
  context: AIContext;
  details: ConfirmationDetails;
  /** Unique ID the client returns to confirm execution */
  confirmationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL ROUTING
// ─────────────────────────────────────────────────────────────────────────────

export type ModelTier = 'fast' | 'standard' | 'reasoning';

export interface ModelRoutingHint {
  tier: ModelTier;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI REQUEST / RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequest {
  userMessage: string;
  context: AIContext;
  /** Optional: client-provided confirmation ID for deferred consequential actions */
  confirmationId?: string;
  /** Optional: model tier override */
  modelTier?: ModelTier;
}

export interface AIToolCall {
  toolName: string;
  input: unknown;
}

export interface AIResponse {
  /** Natural language reply to show the user */
  message: string;
  /** Tools that were called */
  toolCalls?: AIToolCall[];
  /** If set, the action requires confirmation before proceeding */
  pendingConfirmation?: ConfirmationRequest;
  /** Data returned from tool execution (for structured UI display) */
  data?: unknown;
  /** Telemetry */
  meta: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────────────────────────

export interface AIAuditEntry {
  userId: string;
  userRole?: UserRole;
  schoolId: string;
  toolName: string;
  category: ToolCategory;
  affectedEntityId?: string;
  confirmed: boolean;
  result: 'success' | 'denied' | 'error';
  errorMessage?: string;
  timestamp: Date;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}
