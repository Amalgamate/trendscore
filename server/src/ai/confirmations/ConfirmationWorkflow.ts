/**
 * Confirmation Workflow
 *
 * Manages the lifecycle of consequential AI actions.
 * Before a CONSEQUENTIAL tool executes, the client receives a
 * ConfirmationRequest describing what will happen.
 * The user must return the confirmationId to proceed.
 *
 * Storage uses the existing Redis cache service with its in-memory fallback.
 * Confirmations expire after 5 minutes.
 */

import crypto from 'crypto';
import type { AIContext, ConfirmationDetails, ConfirmationRequest } from '../types';
import { redisCacheService } from '../../services/redis-cache.service';

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUTED STORE
// ─────────────────────────────────────────────────────────────────────────────

const confirmationKey = (confirmationId: string) => `ai:confirmation:${confirmationId}`;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

const CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a confirmation request for a consequential action.
 * Returns the request to send back to the client.
 */
export async function createConfirmation(
  toolName: string,
  input: unknown,
  context: AIContext,
  details: ConfirmationDetails
): Promise<ConfirmationRequest> {
  const confirmationId = crypto.randomBytes(16).toString('hex');

  const request: ConfirmationRequest = {
    toolName,
    input,
    context,
    details,
    confirmationId,
  };

  await redisCacheService.set(
    confirmationKey(confirmationId),
    request,
    Math.ceil(CONFIRMATION_TTL_MS / 1000),
  );

  return request;
}

/**
 * Retrieve a pending confirmation by ID.
 * Returns null if not found or expired.
 * The confirmation is consumed (removed) after retrieval.
 */
export async function consumeConfirmation(
  confirmationId: string,
  userId: string
): Promise<ConfirmationRequest | null> {
  const request = await redisCacheService.take<ConfirmationRequest>(confirmationKey(confirmationId));
  if (!request) return null;

  // Verify the same user who created it is confirming
  if (request.context.user.id !== userId) return null;

  return request;
}

/**
 * Check if a confirmation is still pending (without consuming it).
 */
export async function hasPendingConfirmation(confirmationId: string): Promise<boolean> {
  return (await redisCacheService.get<ConfirmationRequest>(confirmationKey(confirmationId))) !== null;
}
