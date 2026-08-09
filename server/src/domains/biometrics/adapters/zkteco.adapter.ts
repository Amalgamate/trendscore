/**
 * ZKTeco Adapter
 *
 * Translates between ZKTeco device protocols and TrendSCORE's
 * device-agnostic webhook format.
 *
 * Modes supported:
 *  1. PUSH (default) — ZKTeco device POSTs attendance records to TrendSCORE.
 *     The device is configured with server URL: POST /api/biometric/log
 *     TrendSCORE's existing webhook endpoint already handles this natively.
 *     This adapter normalises ZKTeco's payload shape to the standard format.
 *
 *  2. PULL — TrendSCORE polls the ZKTeco device via its SDK API.
 *     Used for devices that cannot push (older firmware, network restrictions).
 *     The BiometricSyncWorker calls pullAttendanceLogs() on a schedule.
 *
 * ZKTeco HTTP push payload shape (varies by firmware):
 *  { pin: string, time: string, verified: number, status: number }
 *  or
 *  { employee_id: string, punch_time: string, punch_type: '0'|'1', device_sn: string }
 *
 * ZKTeco REST pull API (ZKBio CVSecurity / ZKBio Time 8.0):
 *  GET /iclock/data/attlog?start_time=...&end_time=...
 *  Returns newline-delimited records: PIN\tDATE_TIME\tSTATUS\tVERIFY\n
 *
 * Reference: ZKTeco Communication Protocol for Push SDK v2.2
 */

import axios from 'axios';
import logger from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** ZKTeco push payload (multiple firmware variants normalised) */
export interface ZKTecoRawPushPayload {
  pin?:         string;   // employee PIN / admission number
  employee_id?: string;   // alternate field name
  time?:        string;   // ISO or "YYYY-MM-DD HH:MM:SS"
  punch_time?:  string;   // alternate field name
  status?:      number;   // 0=check-in, 1=check-out (some firmware)
  punch_type?:  string;   // '0'=check-in, '1'=check-out (other firmware)
  verified?:    number;   // verification type (0=password, 1=fingerprint, 15=face)
  device_sn?:   string;   // device serial number
}

/** Normalised TrendSCORE webhook payload */
export interface NormalisedScanEvent {
  personId:  string;
  timestamp: Date;
  direction: 'IN' | 'OUT';
  verifyType: 'FINGERPRINT' | 'FACE' | 'CARD' | 'PASSWORD' | 'UNKNOWN';
  rawPayload: Record<string, unknown>;
}

/** Pulled attendance record from ZKTeco REST API */
export interface ZKTecoAttendanceRecord {
  pin:       string;
  datetime:  Date;
  direction: 'IN' | 'OUT';
  verify:    number;
}

// ---------------------------------------------------------------------------
// Push payload normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a ZKTeco push payload to TrendSCORE's standard scan event format.
 * Handles multiple firmware variants.
 */
export function normaliseZKTecoPushPayload(raw: ZKTecoRawPushPayload): NormalisedScanEvent | null {
  const personId = raw.pin ?? raw.employee_id;
  if (!personId) {
    logger.warn('[ZKTecoAdapter] Push payload missing pin/employee_id', { raw });
    return null;
  }

  const rawTime = raw.time ?? raw.punch_time;
  if (!rawTime) {
    logger.warn('[ZKTecoAdapter] Push payload missing time/punch_time', { raw });
    return null;
  }

  // Parse timestamp — ZKTeco uses "YYYY-MM-DD HH:MM:SS" or ISO
  const timestamp = parseZKTecoDateTime(rawTime);
  if (!timestamp) {
    logger.warn('[ZKTecoAdapter] Could not parse timestamp', { rawTime });
    return null;
  }

  // Direction: status 0 or punch_type '0' = IN; 1 = OUT
  const rawStatus = raw.status ?? (raw.punch_type !== undefined ? parseInt(raw.punch_type, 10) : 0);
  const direction: 'IN' | 'OUT' = rawStatus === 1 ? 'OUT' : 'IN';

  // Verify type
  const verifyType = resolveVerifyType(raw.verified ?? 1);

  return {
    personId: personId.trim(),
    timestamp,
    direction,
    verifyType,
    rawPayload: raw as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Pull mode — ZKTeco REST API
// ---------------------------------------------------------------------------

export interface ZKTecoDeviceConfig {
  ipAddress:  string;
  port?:      number;
  apiKey?:    string;   // Optional HTTP auth header value
  serialNumber?: string;
}

/**
 * Pull attendance logs from a ZKTeco device via its REST API.
 * Used by BiometricSyncWorker for devices that can't push.
 *
 * @param device  Device network config
 * @param since   Pull records from this datetime onwards
 * @param until   Pull records up to this datetime
 */
export async function pullAttendanceLogs(
  device: ZKTecoDeviceConfig,
  since: Date,
  until: Date,
): Promise<ZKTecoAttendanceRecord[]> {
  const port     = device.port ?? 4370;
  const baseUrl  = `http://${device.ipAddress}:${port}`;
  const startStr = formatZKTecoDateTime(since);
  const endStr   = formatZKTecoDateTime(until);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (device.apiKey) headers['Authorization'] = `Bearer ${device.apiKey}`;

  try {
    const response = await axios.get(`${baseUrl}/iclock/data/attlog`, {
      params: { start_time: startStr, end_time: endStr },
      headers,
      timeout: 10_000,
    });

    if (!response.data) return [];

    // ZKTeco returns tab-delimited lines: PIN\tDATETIME\tSTATUS\tVERIFY\n
    const lines: string[] = String(response.data)
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);

    return lines
      .map(parseZKTecoAttlogLine)
      .filter((r): r is ZKTecoAttendanceRecord => r !== null);

  } catch (err: any) {
    logger.error('[ZKTecoAdapter] Pull failed', {
      ip: device.ipAddress, error: err.message,
    });
    throw new Error(`ZKTeco pull failed for ${device.ipAddress}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseZKTecoDateTime(raw: string): Date | null {
  // Handle "YYYY-MM-DD HH:MM:SS" format
  const normalised = raw.replace(' ', 'T');
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}

function formatZKTecoDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseZKTecoAttlogLine(line: string): ZKTecoAttendanceRecord | null {
  const parts = line.split('\t');
  if (parts.length < 3) return null;

  const pin      = parts[0]?.trim();
  const datetime = parseZKTecoDateTime(parts[1]?.trim() ?? '');
  const status   = parseInt(parts[2]?.trim() ?? '0', 10);
  const verify   = parseInt(parts[3]?.trim() ?? '1', 10);

  if (!pin || !datetime) return null;

  return {
    pin,
    datetime,
    direction: status === 1 ? 'OUT' : 'IN',
    verify,
  };
}

function resolveVerifyType(verified: number): NormalisedScanEvent['verifyType'] {
  // ZKTeco verify types: 1=fingerprint, 4=card, 15=face, 0=password
  switch (verified) {
    case 1:  return 'FINGERPRINT';
    case 4:  return 'CARD';
    case 15: return 'FACE';
    case 0:  return 'PASSWORD';
    default: return 'UNKNOWN';
  }
}
