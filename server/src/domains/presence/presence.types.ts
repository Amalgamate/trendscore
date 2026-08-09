/**
 * Presence Platform — Type Definitions
 *
 * These types are the contract between domain modules and the Presence Platform.
 * All emitters (Attendance, HR, Biometrics, Transport, Boarding) use these.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type PersonType = 'LEARNER' | 'STAFF' | 'VISITOR';

export type PresenceEventType =
  | 'CLASS_ATTENDANCE'
  | 'GATE_ENTRY'
  | 'GATE_EXIT'
  | 'BUS_BOARDED'
  | 'BUS_ALIGHTED'
  | 'DORM_ROLL_CALL'
  | 'DINING_ATTENDED'
  | 'PREP_ATTENDED'
  | 'ASSEMBLY_ATTENDED'
  | 'LIBRARY_VISITED'
  | 'CLINIC_VISITED'
  | 'EXEAT_DEPARTED'
  | 'EXEAT_RETURNED'
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'VISITOR_ENTRY'
  | 'VISITOR_EXIT';

export type PresenceContext =
  | 'SCHOOL'
  | 'CLASS'
  | 'BUS'
  | 'DORMITORY'
  | 'DINING_HALL'
  | 'LIBRARY'
  | 'CLINIC'
  | 'ASSEMBLY'
  | 'PREP_HALL'
  | 'GATE'
  | 'OFF_CAMPUS'
  | 'EXEAT';

export type EventStatus = 'CONFIRMED' | 'PENDING' | 'DISPUTED';

export type SourceModule =
  | 'ATTENDANCE'
  | 'HR_STAFF'
  | 'BIOMETRIC'
  | 'TRANSPORT'
  | 'BOARDING'
  | 'LIBRARY'
  | 'VISITOR'
  | 'SYSTEM';

// ---------------------------------------------------------------------------
// Input and Output shapes
// ---------------------------------------------------------------------------

/**
 * Input to PresenceService.emit().
 * Callers supply this; the service fills in id, recordedAt, version, createdAt.
 */
export interface PresenceEventInput {
  schoolId:       string;
  personId:       string;
  personType:     PersonType;
  eventType:      PresenceEventType;
  context:        PresenceContext;
  /** When the event actually occurred — may differ from recordedAt for biometric catchup */
  timestamp:      Date;
  recordedBy?:    string;   // userId if manual
  deviceId?:      string;   // biometric_devices.id if automated
  location?:      string;
  direction?:     'IN' | 'OUT';
  status?:        EventStatus;
  sourceModule:   SourceModule;
  sourceRecordId?: string;
  metadata?:      Record<string, unknown>;
}

/**
 * Persisted presence event — what the DB returns after creation.
 */
export interface PresenceEvent extends Required<Omit<PresenceEventInput, 'recordedBy' | 'deviceId' | 'location' | 'direction' | 'status' | 'sourceRecordId' | 'metadata'>> {
  id:             string;
  recordedAt:     Date;
  createdAt:      Date;
  version:        number;
  status:         EventStatus;
  recordedBy?:    string | null;
  deviceId?:      string | null;
  location?:      string | null;
  direction?:     string | null;
  sourceRecordId?: string | null;
  metadata?:      Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Timeline shapes (what the parent portal consumes)
// ---------------------------------------------------------------------------

/**
 * A single entry in a person's presence timeline for a given day.
 * Human-readable, safe for display without further processing.
 */
export interface TimelineEntry {
  /** The presence_events.id */
  id:          string;
  /** When the event occurred */
  timestamp:   Date;
  eventType:   PresenceEventType;
  context:     PresenceContext;
  /** Human-readable location label, if available */
  location:    string | null;
  /** Human-readable description — e.g. "Marked Present — Grade 5B" */
  description: string;
  /** How the event was recorded */
  source:      'MANUAL' | 'BIOMETRIC' | 'DRIVER' | 'SYSTEM';
  /** Raw metadata for UI to optionally use */
  metadata:    Record<string, unknown> | null;
}

export interface TimelineSummary {
  personId:   string;
  date:       string;       // YYYY-MM-DD
  firstEvent: Date | null;
  lastEvent:  Date | null;
  eventCount: number;
  hasClassAttendance: boolean;
  attendanceStatus:   string | null;  // PRESENT | ABSENT | LATE | EXCUSED | SICK
}

// ---------------------------------------------------------------------------
// Snapshot shape (admin school overview)
// ---------------------------------------------------------------------------

export interface SchoolPresenceSnapshot {
  date:            string;  // YYYY-MM-DD
  totalLearners:   number;
  presentCount:    number;
  absentCount:     number;
  lateCount:       number;
  excusedCount:    number;
  unmarkedCount:   number;
  staffPresent:    number;
  staffAbsent:     number;
  attendanceRate:  number;
}
