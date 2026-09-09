import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hrAPI } from '../../../../../services/api/hr.api';
import { Wifi, WifiOff, Clock, CheckCircle, XCircle, Info, Loader2, Minimize2 } from 'lucide-react';

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
  | 'clock_out_denied'
  // Idempotent outcomes — the request succeeded but nothing actually changed
  // (repeat click, stale tab, second device). These are informational, not
  // errors and not fresh successes, so they get their own neutral styling
  // instead of borrowing the green "success" or red "denied" treatment.
  | 'already_clocked_in'
  | 'already_completed'
  | 'already_clocked_out';

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

  // The current model supports one clock-in/clock-out cycle per day. Once both
  // are set, there is nothing left to action until tomorrow — the UI should
  // say so plainly instead of re-offering a "Clock In" button that would just
  // bounce off the server's idempotency guard.
  const dayComplete = useMemo(
    () => Boolean(attendance?.clockInAt && attendance?.clockOutAt),
    [attendance]
  );

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

  // Auto-clear transient feedback (success / info banners) so the permanent
  // status derived from `attendance` takes back over the headline instead of
  // a one-off action label sitting there indefinitely. Denials stay visible
  // since they're actionable (e.g. "connect to school Wi-Fi and retry").
  useEffect(() => {
    const transientModes: WidgetMode[] = [
      'clock_in_success',
      'clock_out_success',
      'already_clocked_in',
      'already_completed',
      'already_clocked_out'
    ];
    if (!transientModes.includes(mode)) return;
    const timer = setTimeout(() => {
      setMode('idle');
      setMessage(null);
      setReasonCode(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [mode]);

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

      if (action === 'clock-in') {
        const alreadyCompleted = Boolean(response?.data?.alreadyCompleted);
        const alreadyClockedIn = Boolean(response?.data?.alreadyClockedIn);
        setMode(
          alreadyCompleted ? 'already_completed'
            : alreadyClockedIn ? 'already_clocked_in'
            : 'clock_in_success'
        );
      } else {
        const alreadyClockedOut = Boolean(response?.data?.alreadyClockedOut);
        setMode(alreadyClockedOut ? 'already_clocked_out' : 'clock_out_success');
      }
      return;
    }

    setMode(action === 'clock-in' ? 'clock_in_denied' : 'clock_out_denied');
  }, []);

  // The headline always reflects the *durable* attendance state, not a
  // one-off action outcome — so it can never say "Clock-in successful" while
  // the record underneath shows the day already closed out. Busy and denied
  // states are the only exceptions, since those describe what's happening
  // right now rather than the saved record.
  const statusLabel = useMemo(() => {
    if (mode === 'loading_status') return 'Loading…';
    if (mode === 'submitting_clock_in') return 'Clocking in…';
    if (mode === 'submitting_clock_out') return 'Clocking out…';
    if (mode === 'clock_in_denied' || mode === 'clock_out_denied') {
      if (reasonCode === 'IP_DENIED') return 'Not on school Wi-Fi';
      return mode === 'clock_in_denied' ? 'Clock-in denied' : 'Clock-out denied';
    }
    if (dayComplete) return 'Clocked out for today';
    if (isClockedIn) return 'Clocked in';
    return 'Not clocked in yet';
  }, [dayComplete, isClockedIn, mode, reasonCode]);

  const primaryButton = useMemo(() => {
    const busy = mode === 'submitting_clock_in' || mode === 'submitting_clock_out';
    if (dayComplete) {
      return { label: 'Day complete', onClick: undefined, disabled: true };
    }
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
  }, [dayComplete, isClockedIn, mode, performAction]);

  const isIpDenied = reasonCode === 'IP_DENIED';
  const busy = mode === 'submitting_clock_in' || mode === 'submitting_clock_out';

  // Feedback banner styling is driven entirely by *why* we're showing a
  // message, not by the presence of a message string. A repeat clock-in
  // ("already_clocked_in") is not an error and shouldn't look like one, and a
  // genuine denial shouldn't look like a shrug.
  type FeedbackTone = 'denied' | 'info' | 'success' | null;
  const feedbackTone: FeedbackTone = useMemo(() => {
    if (mode === 'clock_in_denied' || mode === 'clock_out_denied') return 'denied';
    if (mode === 'already_clocked_in' || mode === 'already_completed' || mode === 'already_clocked_out') return 'info';
    if (mode === 'clock_in_success' || mode === 'clock_out_success') return 'success';
    return null;
  }, [mode]);

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
        <div
          className={`mt-3 p-3 rounded-xl border flex items-start gap-2 ${
            feedbackTone === 'denied'
              ? (isIpDenied ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200')
              : feedbackTone === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-sky-50 border-sky-200'
          }`}
        >
          {feedbackTone === 'denied'
            ? (isIpDenied
                ? <WifiOff size={14} className="text-amber-600 mt-0.5 shrink-0" />
                : <XCircle size={14} className="text-rose-600 mt-0.5 shrink-0" />)
            : feedbackTone === 'success'
              ? <CheckCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" />
              : <Info size={14} className="text-sky-600 mt-0.5 shrink-0" />}
          <div>
            <p className={`text-xs font-semibold ${
              feedbackTone === 'denied'
                ? (isIpDenied ? 'text-amber-900' : 'text-rose-900')
                : feedbackTone === 'success'
                  ? 'text-emerald-900'
                  : 'text-sky-900'
            }`}>{message}</p>
            {reasonCode && feedbackTone === 'denied' && (
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Code: {reasonCode}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3.5 flex flex-col gap-2">
        {dayComplete ? (
          <div className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-500" />
            Day complete — see you tomorrow
          </div>
        ) : isClockedIn ? (
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
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
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
