/**
 * AI Permission Layer
 *
 * Every AI tool call passes through this layer before execution.
 * Authorization is deterministic — the model's instructions CANNOT override it.
 *
 * Rules:
 * 1. Tool must list the user's role in allowedRoles
 * 2. The user's schoolId must match the target entity's school (tenant isolation)
 * 3. PARENT role can only access their own children
 * 4. STUDENT role can only access their own data
 */

import type { AIContext, PermissionCheckResult, ToolDefinition, UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// ROLE HIERARCHY
// Higher index = more authority
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_AUTHORITY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  HEAD_TEACHER: 80,
  HEAD_OF_CURRICULUM: 75,
  TEACHER: 60,
  ACCOUNTANT: 50,
  RECEPTIONIST: 40,
  LIBRARIAN: 40,
  NURSE: 40,
  SECURITY: 30,
  DRIVER: 30,
  COOK: 30,
  PARENT: 20,
  STUDENT: 10,
};

export function hasRoleAuthority(role: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_AUTHORITY[role] ?? 0) >= (ROLE_AUTHORITY[requiredRole] ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a user can invoke a specific tool.
 */
export function checkToolPermission(
  tool: ToolDefinition,
  context: AIContext
): PermissionCheckResult {
  const { role } = context.user;

  if (!tool.allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Your role (${role.replace(/_/g, ' ').toLowerCase()}) does not have access to this action. Allowed roles: ${tool.allowedRoles.map((r) => r.replace(/_/g, ' ').toLowerCase()).join(', ')}.`,
    };
  }

  return { allowed: true };
}

/**
 * Verify tenant isolation — the target entity must belong to the user's school.
 * Call this inside tool.execute() when querying school-scoped data.
 */
export function assertSchoolOwnership(
  entitySchoolId: string,
  context: AIContext
): void {
  if (context.user.role === 'SUPER_ADMIN') return; // super admin can cross schools
  if (entitySchoolId !== context.user.schoolId) {
    throw new Error(
      `Access denied: this record does not belong to your school.`
    );
  }
}

/**
 * Roles that can perform school-wide staff actions.
 */
export const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
];

/**
 * Roles that can view pathway data.
 */
export const PATHWAY_READ_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'PARENT',
  'STUDENT',
];

/**
 * Roles that can submit pathway recommendations.
 */
export const PATHWAY_WRITE_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
];

/**
 * Roles that can finalize (lock) pathways.
 */
export const PATHWAY_FINALIZE_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
];
