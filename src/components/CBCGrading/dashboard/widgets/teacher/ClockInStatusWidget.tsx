import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hrAPI } from '../../../../../services/api/hr.api';
import { Wifi, WifiOff, Clock, CheckCircle, XCircle, Loader2, Minimize2 } from 'lucide-react';

interface WidgetProps {
  user?: any;
  config?: any;
  onNavigate?: (path: string) => void;
}

type WidgetMode =
  | 'idle'
  | 'loading_status'
  | 'submitting_clock_in'
  | 'submitting_clock_out'
  | 'clock_in_success'
  | 'clock_in_denied'
  | 'clock_out_success'
  | 'clock_out_denied';

// ── GPS / Geofence (DISABLED — replaced by IP/Wi-Fi check) ───────────────────
// Location-based clock-in is paused because indoor GPS accuracy (5–50 m) causes
// legitimate staff to be rejected. Restore by un-commenting below, wiring the
// position into the payload, and removing the IP-only path in performAction.
//
// type GeofenceDecision = {
//   allowed: boolean;
//   enforcementMode: string;
//   radiusMeters: number;
//   distanceMeters: number | null;
//   accuracyMeters: number | null;
//   reasonCode: string | null;
//   message: string;
// };
//
// const getLocation = (options?: PositionOptions) =>
//   new Promise<GeolocationPosition>((resolve, reject) => {
//     if (!navigator.geolocation) {
//       reject(new Error('Geolocation is not supported on this device.'));
//       return;
//     }
//     navigator.geolocation.getCurrentPosition(resolve, reject, options);
//   });
// ─────────────────────────────────────────────────────────────────────────────

type AttendanceRecord = {
  id?: string;
  userId?: string;
  date?: string;
  clockInAt?: string;
  clockOutAt?: string | null;
  source?: string | null;
  metadata?: any;
};

const ClockInStatusWidget: React.FC<WidgetProps> = ({ user }) => {
  const [mode, setMode] = useState<WidgetMode>('loading_status');
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

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
      if (!record?.clockInAt || record?.clockOutAt) setMinimized(false);
      setMode('idle');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load clock-in status.');
      setMode('idle');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const performAction = useCallback(async (action: 'clock-in' | 'clock-out') => {
    setMessage(null);
    setReasonCode(null);

    // ── IP-based clock-in (no location/GPS required) ──────────────────────────
    // The server will verify the request IP against the school's allowed Wi-Fi IPs.
    const payload = {
      source: 'web',
      metadata: { widget: 'CLOCK_IN_STATUS' }
    };

    // ── GPS / Geofence payload (DISABLED — un-comment to restore) ─────────────
    // setMode('getting_location');
    // let position: GeolocationPosition;
    // try {
    //   position = await getLocation({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
    // } catch (error: any) {
    //   const permDenied =
    //     error?.code === 1 || String(error?.message || '').toLowerCase().includes('permission');
    //   const response = action === 'clock-in'
    //     ? await hrAPI.clockInStaff({
    //         source: 'web',
    //         metadata: { widget: 'CLOCK_IN_STATUS', locationError: permDenied ? 'permission_denied' : 'unavailable' }
    //       })
    //     : await hrAPI.clockOutStaff({
    //         source: 'web',
    //         metadata: { widget: 'CLOCK_IN_STATUS', locationError: permDenied ? 'permission_denied' : 'unavailable' }
    //       });
    //   const nextDecision: GeofenceDecision | null = response?.geofenceDecision || null;
    //   const nextReason = response?.reasonCode || nextDecision?.reasonCode || (permDenied ? 'MISSING_LOCATION' : null);
    //   const nextMessage = response?.message || nextDecision?.message ||
    //     (permDenied
    //       ? 'Location permission denied. Enable location access and try again.'
    //       : error?.message || 'Failed to get your location.');
    //   setDecision(nextDecision);
    //   setReasonCode(nextReason);
    //   setMessage(nextMessage);
    //   setMode(permDenied ? 'permission_denied' : mapDeniedState(action, nextReason));
    //   return;
    // }
    // const payload = {
    //   latitude: position.coords.latitude,
    //   longitude: position.coords.longitude,
    //   accuracyMeters: position.coords.accuracy,
    //   capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    //   source: 'web',
    //   metadata: { widget: 'CLOCK_IN_STATUS' }
    // };
    // ─────────────────────────────────────────────────────────────────────────

    setMode(action === 'clock-in' ? 'submitting_clock_in' : 'submitting_clock_out');

    const response = action === 'clock-in'
      ? await hrAPI.clockInStaff(payload)
      : await hrAPI.clockOutStaff(payload);

    const nextReason = response?.reasonCode || null;
    const nextMessage = response?.message || null;

    setReasonCode(nextReason);
    setMessage(nextMessage);

    if (response?.success) {
      const record = response?.data?.attendance as AttendanceRecord | undefined;
      if (record) setAttendance(record);
      setMinimized(false);
      setMode(action === 'clock-in' ? 'clock_in_success' : 'clock_out_success');
      return;
    }

    setMode(action === 'clock-in' ? 'clock_in_denied' : 'clock_out_denied');
  }, []);

  const statusLabel = useMemo(() => {
    if (mode === 'loading_status') return 'Loading…';
    if (mode === 'submitting_clock_in') return 'Submitting clock-in…';
    if (mode === 'submitting_clock_out') return 'Submitting clock-out…';
    if (mode === 'clock_in_success') return 'Clock-in successful';
    if (mode === 'clock_out_success') return 'Clock-out successful';
    if (mode === 'clock_in_denied' || mode === 'clock_out_denied') {
      if (reasonCode === 'IP_DENIED') return 'Not on school Wi-Fi';
      return mode === 'clock_in_denied' ? 'Clock-in denied' : 'Clock-out denied';
    }
    if (isClockedIn) return 'Clocked in';
    return 'Not clocked in';
  }, [isClockedIn, mode, reasonCode]);

  const primaryButton = useMemo(() => {
    const busy = mode === 'submitting_clock_in' || mode === 'submitting_clock_out';
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

  const isIpDenied = reasonCode === 'IP_DENIED';
  const busy = mode === 'submitting_clock_in' || mode === 'submitting_clock_out';

  if (isClockedIn && minimized) {
    return (
      <button
        type="button"
        onClick={() => performAction('clock-out')}
        disabled={busy}
        className={`w-full px-4 py-2.5 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm ${
          busy
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-rose-600 text-white hover:bg-rose-700'
        }`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
        {busy ? 'Clocking out…' : 'Clock Out'}
      </button>
    );
  }

  return (
    <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Staff Attendance</p>
          </div>
          <p className="text-base font-bold text-slate-900 truncate mt-0.5">{statusLabel}</p>
          {attendance?.clockInAt && (
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              In: {new Date(attendance.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {attendance.clockOutAt ? ` · Out: ${new Date(attendance.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={refreshStatus}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          disabled={mode === 'loading_status'}
          type="button"
        >
          Refresh
        </button>
      </div>

      {/* ── IP / Wi-Fi status indicator ── */}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <Wifi size={13} className="text-slate-400" />
        <span className="text-[11px] font-medium text-slate-400">Requires school Wi-Fi connection</span>
      </div>

      {message && (
        <div className={`mt-3 p-3 rounded-xl border ${isIpDenied ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start gap-2">
            {isIpDenied
              ? <WifiOff size={14} className="text-amber-600 mt-0.5 shrink-0" />
              : <XCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />}
            <div>
              <p className={`text-xs font-semibold ${isIpDenied ? 'text-amber-900' : 'text-slate-800'}`}>{message}</p>
              {reasonCode && <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Code: {reasonCode}</p>}
            </div>
          </div>
        </div>
      )}

      {(mode === 'clock_in_success' || mode === 'clock_out_success') && !message && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <CheckCircle size={14} className="shrink-0" />
          <span>{mode === 'clock_in_success' ? 'Clock-in recorded successfully.' : 'Clock-out recorded successfully.'}</span>
        </div>
      )}

      <div className="mt-3.5 flex flex-col gap-2">
        {isClockedIn ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              disabled={primaryButton.disabled}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-700 transition flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Minimize2 size={13} />
              Minimize
            </button>
            <button
              type="button"
              onClick={primaryButton.onClick}
              disabled={primaryButton.disabled}
              className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm ${
                primaryButton.disabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {primaryButton.disabled ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
              {primaryButton.label}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={primaryButton.onClick}
            disabled={primaryButton.disabled}
            className={`w-full px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm ${
              primaryButton.disabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {primaryButton.disabled ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {primaryButton.label}
          </button>
        )}

        {!minimized && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            Verified via network IP. {user?.role ? `Role: ${user.role}.` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default ClockInStatusWidget;
