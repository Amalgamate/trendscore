/**
 * PresenceService
 *
 * The single emission point for all presence events in TrendSCORE.
 * Every domain module that generates a presence fact calls emit().
 *
 * Design decisions:
 *  - Synchronous: emit() is called inside the same DB transaction as the domain write
 *  - Idempotent: duplicate (personId, eventType, timestamp) returns existing record
 *  - Non-blocking on failure: unexpected errors are recorded in presence_event_failures
 *    and never propagate to the caller (domain write always succeeds)
 *
 * See: docs/architecture/03_EVENT_ARCHITECTURE.md
 * See: docs/implementation/adr/ADR-002_synchronous_events_over_message_broker.md
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { PresenceEventInput, PresenceEvent } from './presence.types';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PresenceService {
  /**
   * Emit a presence event.
   *
   * Called by domain modules after a successful domain write.
   * Supports an optional Prisma transaction client so the event is written
   * atomically with the domain record.
   *
   * @param event  - The presence event to record
   * @param tx     - Optional Prisma transaction client
   * @returns      The created (or existing, on dedup) PresenceEvent
   */
  async emit(
    event: PresenceEventInput,
    tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  ): Promise<PresenceEvent> {
    const db = tx ?? prisma;

    try {
      // A source record is authoritative for its projection. For example, a
      // teacher may correct ABSENT to PRESENT after submitting a daily register.
      // The event timeline must reflect that correction instead of treating it
      // as an unrelated duplicate event.
      if (event.sourceRecordId) {
        const projected = await (db as any).presenceEvent.findFirst({
          where: {
            schoolId:       event.schoolId,
            sourceModule:   event.sourceModule,
            sourceRecordId: event.sourceRecordId,
            eventType:      event.eventType,
          },
        });

        if (projected) {
          return await (db as any).presenceEvent.update({
            where: { id: projected.id },
            data: {
              personId:   event.personId,
              personType: event.personType,
              context:    event.context,
              timestamp:  event.timestamp,
              recordedBy: event.recordedBy ?? null,
              deviceId:   event.deviceId ?? null,
              location:   event.location ?? null,
              direction:  event.direction ?? null,
              status:     event.status ?? 'CONFIRMED',
              metadata:   event.metadata ?? undefined,
              version:    { increment: 1 },
            },
          }) as PresenceEvent;
        }
      }

      const created = await (db as any).presenceEvent.create({
        data: {
          schoolId:       event.schoolId,
          personId:       event.personId,
          personType:     event.personType,
          eventType:      event.eventType,
          context:        event.context,
          timestamp:      event.timestamp,
          recordedBy:     event.recordedBy ?? null,
          deviceId:       event.deviceId ?? null,
          location:       event.location ?? null,
          direction:      event.direction ?? null,
          status:         event.status ?? 'CONFIRMED',
          sourceModule:   event.sourceModule,
          sourceRecordId: event.sourceRecordId ?? null,
          metadata:       event.metadata ?? undefined,
          version:        1,
        },
      });

      return created as PresenceEvent;

    } catch (createError: any) {
      // P2002 = unique constraint violation → duplicate event (idempotency)
      if (createError?.code === 'P2002') {
        const existing = await (db as any).presenceEvent.findFirst({
          where: {
            schoolId:  event.schoolId,
            personId:  event.personId,
            eventType: event.eventType,
            timestamp: event.timestamp,
          },
        });

        if (existing) {
          logger.debug('[PresenceService] Duplicate event suppressed', {
            personId:  event.personId,
            eventType: event.eventType,
            timestamp: event.timestamp.toISOString(),
          });
          return existing as PresenceEvent;
        }
      }

      // Any other error: record in failures table, log, but DO NOT throw.
      // The domain write must always succeed regardless of presence state.
      await this.recordFailure(event, createError);
      logger.error('[PresenceService] emit() failed — recorded in presence_event_failures', {
        personId:      event.personId,
        eventType:     event.eventType,
        sourceModule:  event.sourceModule,
        sourceRecordId: event.sourceRecordId,
        error:         createError?.message,
      });

      // Return a synthetic event so callers don't need null checks
      return this.syntheticEvent(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Failure recording
  // ---------------------------------------------------------------------------

  private async recordFailure(event: PresenceEventInput, error: unknown): Promise<void> {
    try {
      await prisma.presenceEventFailure.create({
        data: {
          schoolId:       event.schoolId,
          sourceModule:   event.sourceModule,
          sourceRecordId: event.sourceRecordId ?? null,
          errorMessage:   (error as any)?.message ?? String(error),
          payload:        event as any,
          retryCount:     0,
          resolved:       false,
        },
      });
    } catch (failureError: any) {
      // Last resort: just log — never let this throw
      logger.error('[PresenceService] Could not write to presence_event_failures', {
        error: failureError?.message,
      });
    }
  }

  /** Synthetic event returned when persistence fails — carries all input fields */
  private syntheticEvent(event: PresenceEventInput): PresenceEvent {
    const now = new Date();
    return {
      id:             `synthetic-${Date.now()}`,
      schoolId:       event.schoolId,
      personId:       event.personId,
      personType:     event.personType,
      eventType:      event.eventType,
      context:        event.context,
      timestamp:      event.timestamp,
      recordedAt:     now,
      createdAt:      now,
      version:        1,
      status:         event.status ?? 'CONFIRMED',
      sourceModule:   event.sourceModule,
      recordedBy:     event.recordedBy ?? null,
      deviceId:       event.deviceId ?? null,
      location:       event.location ?? null,
      direction:      event.direction ?? null,
      sourceRecordId: event.sourceRecordId ?? null,
      metadata:       event.metadata ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // School resolver (lazy — fetches once per request context)
  // ---------------------------------------------------------------------------

  /**
   * Resolve the schoolId for the current deployment.
   * Uses the first active non-archived school.
   * Controllers that have req.user.schoolId should pass it directly instead.
   */
  async resolveSchoolId(): Promise<string | null> {
    const school = await prisma.school.findFirst({
      where: { archived: false, active: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return school?.id ?? null;
  }
}

// Singleton export — all modules share one instance
export const presenceService = new PresenceService();
