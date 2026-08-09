/**
 * TimelineEngine
 *
 * Assembles a chronological, human-readable presence timeline for a person
 * on a given day. Used by the parent portal and teacher views.
 *
 * The timeline reads from presence_events only — it never queries domain tables.
 * This makes it a pure aggregator: the event store is the single source.
 */

import prisma from '../../config/database';
import {
  PresenceEventType,
  PresenceContext,
  TimelineEntry,
  TimelineSummary,
} from './presence.types';

// ---------------------------------------------------------------------------
// Source label resolution
// ---------------------------------------------------------------------------

type SourceLabel = 'MANUAL' | 'BIOMETRIC' | 'DRIVER' | 'SYSTEM';

function resolveSource(sourceModule: string, deviceId: string | null): SourceLabel {
  if (deviceId) return 'BIOMETRIC';
  if (sourceModule === 'TRANSPORT') return 'DRIVER';
  if (sourceModule === 'SYSTEM') return 'SYSTEM';
  return 'MANUAL';
}

// ---------------------------------------------------------------------------
// Human-readable description builder
// ---------------------------------------------------------------------------

function buildDescription(
  eventType: PresenceEventType,
  context: PresenceContext,
  location: string | null,
  metadata: Record<string, unknown> | null,
): string {
  switch (eventType) {

    case 'CLASS_ATTENDANCE': {
      const status = String(metadata?.attendanceStatus ?? 'PRESENT');
      const statusLabel: Record<string, string> = {
        PRESENT: 'Present',
        ABSENT:  'Absent',
        LATE:    'Late',
        EXCUSED: 'Excused',
        SICK:    'Sick',
      };
      const label = statusLabel[status] ?? status;
      const grade = metadata?.grade ? ` — ${metadata.grade}` : '';
      return `Marked ${label}${grade}`;
    }

    case 'GATE_ENTRY':
      return location ? `Arrived at ${location}` : 'Arrived at School Gate';

    case 'GATE_EXIT':
      return location ? `Left via ${location}` : 'Left School Gate';

    case 'BUS_BOARDED': {
      const routeName = metadata?.routeName ? String(metadata.routeName) : null;
      const dir = String(metadata?.direction ?? '').toLowerCase();
      if (routeName && dir === 'outbound') return `Boarded ${routeName} Bus (to school)`;
      if (routeName && dir === 'inbound') return `Boarded ${routeName} Bus (home)`;
      if (routeName) return `Boarded ${routeName} Bus`;
      return 'Boarded School Bus';
    }

    case 'BUS_ALIGHTED': {
      const routeName = metadata?.routeName ? String(metadata.routeName) : null;
      return routeName ? `Alighted from ${routeName} Bus` : 'Alighted from School Bus';
    }

    case 'DORM_ROLL_CALL': {
      const session = String(metadata?.session ?? '').toLowerCase();
      const dorm = location ?? 'dormitory';
      if (session === 'morning') return `Present — Morning Roll Call (${dorm})`;
      if (session === 'night')   return `Present — Night Roll Call (${dorm})`;
      return `Present — Dorm Roll Call (${dorm})`;
    }

    case 'DINING_ATTENDED': {
      const session = String(metadata?.session ?? '').toLowerCase();
      const sessionLabels: Record<string, string> = {
        breakfast: 'Breakfast',
        lunch:     'Lunch',
        dinner:    'Dinner / Supper',
      };
      return `Present — ${sessionLabels[session] ?? 'Meal'}`;
    }

    case 'PREP_ATTENDED': {
      const session = String(metadata?.session ?? '').toLowerCase();
      return session === 'afternoon' ? 'Present — Afternoon Prep' : 'Present — Evening Prep';
    }

    case 'ASSEMBLY_ATTENDED':
      return 'Present — Assembly';

    case 'LIBRARY_VISITED':
      return 'Library Visit';

    case 'CLINIC_VISITED':
      return 'Clinic / Sick Bay Visit';

    case 'EXEAT_DEPARTED': {
      const exeatType = metadata?.exeatType ? String(metadata.exeatType) : 'leave';
      return `Departed on ${exeatType}`;
    }

    case 'EXEAT_RETURNED':
      return 'Returned from leave';

    case 'CLOCK_IN':
      return 'Clocked In';

    case 'CLOCK_OUT':
      return 'Clocked Out';

    case 'VISITOR_ENTRY':
      return location ? `Visitor arrived — ${location}` : 'Visitor arrived';

    case 'VISITOR_EXIT':
      return 'Visitor departed';

    default:
      return String(eventType).replace(/_/g, ' ');
  }
}

// ---------------------------------------------------------------------------
// TimelineEngine
// ---------------------------------------------------------------------------

export class TimelineEngine {
  /**
   * Build a chronological timeline for a person on a given date.
   *
   * @param personId  - Learner or staff UUID
   * @param date      - The calendar date (UTC midnight is fine)
   * @returns         - Array of TimelineEntry, earliest first
   */
  async buildTimeline(personId: string, date: Date, schoolId?: string): Promise<TimelineEntry[]> {
    const startOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
    );
    const endOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
    );

    const events = await prisma.presenceEvent.findMany({
      where: {
        personId,
        ...(schoolId ? { schoolId } : {}),
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((e) => ({
      id:          e.id,
      timestamp:   e.timestamp,
      eventType:   e.eventType as PresenceEventType,
      context:     e.context as PresenceContext,
      location:    e.location,
      description: buildDescription(
        e.eventType as PresenceEventType,
        e.context as PresenceContext,
        e.location,
        e.metadata as Record<string, unknown> | null,
      ),
      source:      resolveSource(e.sourceModule, e.deviceId),
      metadata:    e.metadata as Record<string, unknown> | null,
    }));
  }

  /**
   * Build a summary for a person on a given date.
   * Lighter than the full timeline — used for absence checks.
   */
  async buildSummary(personId: string, date: Date, schoolId?: string): Promise<TimelineSummary> {
    const entries = await this.buildTimeline(personId, date, schoolId);
    const dateStr = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');

    const attendanceEvent = entries.find((e) => e.eventType === 'CLASS_ATTENDANCE');
    const attendanceStatus = attendanceEvent
      ? String((attendanceEvent.metadata as any)?.attendanceStatus ?? null)
      : null;

    return {
      personId,
      date:                dateStr,
      firstEvent:          entries[0]?.timestamp ?? null,
      lastEvent:           entries[entries.length - 1]?.timestamp ?? null,
      eventCount:          entries.length,
      hasClassAttendance:  !!attendanceEvent,
      attendanceStatus:    attendanceStatus === 'null' ? null : attendanceStatus,
    };
  }
}

export const timelineEngine = new TimelineEngine();
