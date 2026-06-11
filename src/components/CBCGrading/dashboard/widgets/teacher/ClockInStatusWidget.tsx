import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hrAPI } from '../../../../../services/api/hr.api';

interface WidgetProps {
  user?: any;
  config?: any;
  onNavigate?: (path: string) => void;
}

type WidgetMode =
  | 'idle'
  | 'loading_status'
  | 'getting_location'
  | 'submitting_clock_in'
  | 'submitting_clock_out'
  | 'permission_denied'
  | 'clock_in_success'
  | 'clock_in_denied'
  | 'clock_out_success'
  | 'clock_out_denied';

type GeofenceDecision = {
  allowed: boolean;
  enforcementMode: string;
  radiusMeters: number;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  reasonCode: string | null;
  message: string;
};

type AttendanceRecord = {
  id?: string;
  userId?: string;
  date?: string;
  clockInAt?: string;
  clockOutAt?: string | null;
  source?: string | null;
  metadata?: any;
};

const getLocation = (options?: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const ClockInStatusWidget: React.FC<WidgetProps> = ({ user }) => {
  const [mode, setMode] = useState<WidgetMode>('loading_status');
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [decision, setDecision] = useState<GeofenceDecision | null>(null);

  const isClockedIn = useMemo(() => {
    if (!attendance?.clockInAt) return false;
    return !attendance.clockOutAt;
  }, [attendance]);

  const refreshStatus = useCallback(async () => {
    try {
      setMode('loading_status');
      const response = await hrAPI.getTodayClockIn();
      const record = response?.data as AttendanceRecord | null;
      setAttendance(record || null);
      setMode('idle');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load clock-in status.');
      setMode('idle');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const mapDeniedState = (action: 'clock-in' | 'clock-out', code?: string | null) => {
    if (action === 'clock-in') return 'clock_in_denied';
    return 'clock_out_denied';
  };

  const performAction = useCallback(async (action: 'clock-in' | 'clock-out') => {
    setMessage(null);
    setReasonCode(null);
    setDecision(null);

    setMode('getting_location');
    let position: GeolocationPosition;
    try {
      position = await getLocation({
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0
      });
    } catch (error: any) {
      const permDenied =
        error?.code === 1 || String(error?.message || '').toLowerCase().includes('permission');
      const response = action === 'clock-in'
        ? await hrAPI.clockInStaff({
            source: 'web',
            metadata: { widget: 'CLOCK_IN_STATUS', locationError: permDenied ? 'permission_denied' : 'unavailable' }
          })
        : await hrAPI.clockOutStaff({
            source: 'web',
            metadata: { widget: 'CLOCK_IN_STATUS', locationError: permDenied ? 'permission_denied' : 'unavailable' }
          });
      const nextDecision: GeofenceDecision | null = response?.geofenceDecision || null;
      const nextReason = response?.reasonCode || nextDecision?.reasonCode || (permDenied ? 'MISSING_LOCATION' : null);
      const nextMessage = response?.message || nextDecision?.message ||
        (permDenied
          ? 'Location permission denied. Enable location access and try again.'
          : error?.message || 'Failed to get your location.');

      setDecision(nextDecision);
      setReasonCode(nextReason);
      setMessage(nextMessage);
      setMode(permDenied ? 'permission_denied' : mapDeniedState(action, nextReason));
      return;
    }

    const payload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
      source: 'web',
      metadata: { widget: 'CLOCK_IN_STATUS' }
    };

    setMode(action === 'clock-in' ? 'submitting_clock_in' : 'submitting_clock_out');
    const response = action === 'clock-in'
      ? await hrAPI.clockInStaff(payload)
      : await hrAPI.clockOutStaff(payload);

    const nextDecision: GeofenceDecision | null =
      response?.data?.geofenceDecision || response?.geofenceDecision || null;
    const nextReason = response?.reasonCode || nextDecision?.reasonCode || null;
    const nextMessage = response?.message || nextDecision?.message || null;

    setDecision(nextDecision);
    setReasonCode(nextReason);
    setMessage(nextMessage);

    if (response?.success) {
      const record = response?.data?.attendance as AttendanceRecord | undefined;
      if (record) setAttendance(record);
      setMode(action === 'clock-in' ? 'clock_in_success' : 'clock_out_success');
      return;
    }

    setMode(mapDeniedState(action, nextReason));
  }, []);

  const statusLabel = useMemo(() => {
    if (mode === 'loading_status') return 'Loading…';
    if (mode === 'getting_location') return 'Getting location…';
    if (mode === 'submitting_clock_in') return 'Submitting clock-in…';
    if (mode === 'submitting_clock_out') return 'Submitting clock-out…';
    if (mode === 'permission_denied') return 'Location permission denied';
    if (mode === 'clock_in_success') return 'Clock-in successful';
    if (mode === 'clock_out_success') return 'Clock-out successful';
    if (mode === 'clock_in_denied' || mode === 'clock_out_denied') {
      if (reasonCode === 'ACCURACY_TOO_LOW') return 'Accuracy too low';
      if (reasonCode === 'OUT_OF_RANGE') return 'Outside allowed zone';
      if (reasonCode === 'NO_SCHOOL_PIN') return 'School pin missing';
      return mode === 'clock_in_denied' ? 'Clock-in denied' : 'Clock-out denied';
    }
    if (isClockedIn) return 'Clocked in';
    return 'Not clocked in';
  }, [isClockedIn, mode, reasonCode]);

  const primaryButton = useMemo(() => {
    const busy = mode === 'getting_location' || mode === 'submitting_clock_in' || mode === 'submitting_clock_out';
    if (isClockedIn) {
      return {
        label: busy ? 'Clocking out…' : 'Clock Out',
        onClick: () => performAction('clock-out'),
        disabled: busy
      };
    }
    return {
      label: busy ? 'Clocking in…' : 'Clock In',
      onClick: () => performAction('clock-in'),
      disabled: busy
    };
  }, [isClockedIn, mode, performAction]);

  const secondaryNote = useMemo(() => {
    if (!decision) return null;
    if (decision.allowed && decision.reasonCode && decision.reasonCode !== 'GEOFENCE_DISABLED') {
      return `Warning: ${decision.reasonCode}`;
    }
    if (!decision.allowed && decision.reasonCode) {
      return `Denied: ${decision.reasonCode}`;
    }
    return null;
  }, [decision]);

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff Attendance</p>
          <p className="text-lg font-bold text-gray-900 truncate">{statusLabel}</p>
          {attendance?.clockInAt && (
            <p className="text-xs text-gray-500 mt-1">
              Clock-in: {new Date(attendance.clockInAt).toLocaleTimeString()}
              {attendance.clockOutAt ? ` · Clock-out: ${new Date(attendance.clockOutAt).toLocaleTimeString()}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={refreshStatus}
          className="text-xs font-semibold text-brand-purple hover:text-brand-purple/80"
          disabled={mode === 'loading_status'}
          type="button"
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-800">{message}</p>
          {reasonCode && <p className="text-xs text-gray-500 mt-1">Reason: {reasonCode}</p>}
          {decision?.accuracyMeters != null && (
            <p className="text-xs text-gray-500 mt-1">Accuracy: {Math.round(decision.accuracyMeters)}m</p>
          )}
          {decision?.distanceMeters != null && decision?.radiusMeters != null && (
            <p className="text-xs text-gray-500 mt-1">
              Distance: {Math.round(decision.distanceMeters)}m · Radius: {decision.radiusMeters}m · Mode: {decision.enforcementMode}
            </p>
          )}
          {secondaryNote && <p className="text-xs text-amber-700 mt-1">{secondaryNote}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={primaryButton.onClick}
          disabled={primaryButton.disabled}
          className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition ${
            primaryButton.disabled
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : isClockedIn
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {primaryButton.label}
        </button>

        <p className="text-xs text-gray-500">
          Your location is verified by the server. {user?.role ? `Role: ${user.role}.` : ''}
        </p>
      </div>
    </div>
  );
};

export default ClockInStatusWidget;
