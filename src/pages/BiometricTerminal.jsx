import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Keyboard,
  Loader2,
  LogOut,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Signal,
  Smartphone,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import AwsFaceLivenessCapture from '../components/biometric/AwsFaceLivenessCapture';
import biometricTerminalAPI from '../services/api/biometricTerminal.api';
import {
  clearTerminalConfiguration,
  countTerminalEvents,
  enqueueTerminalEvent,
  listTerminalEvents,
  loadTerminalConfiguration,
  removeTerminalEvent,
  saveTerminalConfiguration,
} from '../utils/biometricTerminalQueue';

const RESULT_RESET_MS = 4500;

const outcomeLabel = (outcome) => {
  if (!outcome) return 'ACCEPTED';
  if (outcome.action === 'skipped_existing') return 'ALREADY RECORDED';
  if (outcome.attendance?.status) return outcome.attendance.status;
  if (outcome.action === 'updated') return 'CLOCKED OUT';
  return 'ACCEPTED';
};

const BiometricTerminal = () => {
  const [searchParams] = useSearchParams();
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState({
    deviceId: searchParams.get('deviceId') || '',
    activationCode: '',
  });
  const [activating, setActivating] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [faceSession, setFaceSession] = useState(null);
  const [faceError, setFaceError] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [manualId, setManualId] = useState('');
  const [personType, setPersonType] = useState('LEARNER');
  const [direction, setDirection] = useState('IN');
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount(await countTerminalEvents()); } catch { setPendingCount(0); }
  }, []);

  useEffect(() => {
    Promise.all([loadTerminalConfiguration(), countTerminalEvents()])
      .then(([stored, queued]) => {
        setConfiguration(stored);
        setPendingCount(queued);
      })
      .catch(() => setFaceError('Secure terminal storage is unavailable in this browser.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => {
      setOnline(false);
      setFaceSession(null);
      setFaceError('Face recognition requires internet. Use manual fallback; it will queue safely.');
      setManualVisible(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showResult = useCallback((nextResult) => {
    setResult(nextResult);
    window.setTimeout(() => setResult(null), RESULT_RESET_MS);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!configuration || !navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const queued = (await listTerminalEvents()).sort((a, b) => a.createdAt - b.createdAt);
      for (const event of queued) {
        try {
          await biometricTerminalAPI.recordEvent(configuration.deviceToken, {
            ...event,
            offlineCaptured: true,
          });
          await removeTerminalEvent(event.eventId);
        } catch (error) {
          if (error.status && error.status < 500 && ![401, 429].includes(error.status)) {
            await removeTerminalEvent(event.eventId);
          } else {
            break;
          }
        }
      }
    } finally {
      setSyncing(false);
      await refreshPendingCount();
    }
  }, [configuration, refreshPendingCount, syncing]);

  useEffect(() => {
    if (online && configuration) syncQueue();
  }, [online, configuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async (event) => {
    event.preventDefault();
    setActivating(true);
    setFaceError('');
    try {
      const data = await biometricTerminalAPI.activate(
        activation.deviceId.trim(),
        activation.activationCode.replace(/\s/g, ''),
      );
      const stored = {
        deviceId: data.device.deviceId,
        deviceName: data.device.name,
        location: data.device.location,
        schoolName: data.schoolName,
        deviceToken: data.deviceToken,
        activatedAt: new Date().toISOString(),
      };
      await saveTerminalConfiguration(stored);
      setConfiguration(stored);
    } catch (error) {
      setFaceError(error.message || 'Terminal activation failed.');
    } finally {
      setActivating(false);
    }
  };

  const submitManualAttendance = useCallback(async (reference, scannedType) => {
    if (!configuration || processing) return;
    const event = {
      eventId: crypto.randomUUID(),
      deviceId: configuration.deviceId,
      personId: reference,
      personType: scannedType,
      timestamp: new Date().toISOString(),
      direction,
      modality: 'MANUAL',
      offlineCaptured: !navigator.onLine,
      createdAt: Date.now(),
    };

    setProcessing(true);
    try {
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { networkError: true });
      const response = await biometricTerminalAPI.recordEvent(configuration.deviceToken, event);
      showResult({ type: 'success', outcome: response.outcome, duplicate: response.duplicate });
    } catch (error) {
      if (error.networkError || !navigator.onLine) {
        await enqueueTerminalEvent(event);
        await refreshPendingCount();
        showResult({ type: 'queued', message: 'Attendance saved offline and will sync automatically.' });
      } else if (error.status === 401) {
        showResult({ type: 'error', message: 'Terminal authorization expired. Ask an administrator to activate it again.' });
      } else {
        showResult({ type: 'error', message: error.message || 'Attendance was not accepted.' });
      }
    } finally {
      setProcessing(false);
    }
  }, [configuration, direction, processing, refreshPendingCount, showResult]);

  const startFaceRecognition = async () => {
    if (!configuration || processing) return;
    if (!navigator.onLine) {
      setFaceError('Face recognition requires internet. Use manual fallback.');
      setManualVisible(true);
      return;
    }
    setProcessing(true);
    setFaceError('');
    try {
      const session = await biometricTerminalAPI.createFaceSession(
        configuration.deviceToken,
        configuration.deviceId,
        direction,
      );
      setFaceSession(session);
    } catch (error) {
      setFaceError(error.message || 'Unable to start face recognition.');
      setManualVisible(true);
    } finally {
      setProcessing(false);
    }
  };

  const completeFaceRecognition = async () => {
    if (!faceSession || !configuration) return;
    setProcessing(true);
    try {
      const response = await biometricTerminalAPI.completeFaceSession(
        configuration.deviceToken,
        configuration.deviceId,
        faceSession.sessionId,
      );
      setFaceSession(null);
      setFaceError('');
      showResult({ type: 'success', outcome: response.outcome, duplicate: response.duplicate });
    } catch (error) {
      setFaceSession(null);
      setFaceError(error.message || 'Face was not accepted. Use manual fallback or try again.');
      setManualVisible(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleFaceError = (livenessError) => {
    setFaceSession(null);
    setFaceError(livenessError?.error?.message || 'The liveness check failed. Start a new scan or use manual fallback.');
    setManualVisible(true);
  };

  const submitManual = (event) => {
    event.preventDefault();
    const reference = manualId.trim();
    if (!reference) return;
    submitManualAttendance(reference, personType);
    setManualId('');
  };

  const resetTerminal = async () => {
    if (!window.confirm('Remove this phone terminal configuration? An administrator must issue a new activation code.')) return;
    await clearTerminalConfiguration();
    setFaceSession(null);
    setConfiguration(null);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="animate-spin" /></div>;
  }

  if (!configuration) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
        <form onSubmit={activate} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-300"><Smartphone size={28} /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">TrendSCORE Terminal</p><h1 className="mt-1 text-2xl font-semibold text-white">Activate this phone</h1></div>
          </div>
          <p className="mt-5 text-sm leading-6 text-white/75">Register the phone under Biometrics → Devices, choose Activate phone, then enter the device ID and one-time code.</p>
          <label className="mt-6 block text-xs font-semibold text-white/75">Device ID
            <input required value={activation.deviceId} onChange={(event) => setActivation({ ...activation, deviceId: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-400" placeholder="PHONE-MAIN-GATE-01" />
          </label>
          <label className="mt-4 block text-xs font-semibold text-white/75">8-digit activation code
            <input required inputMode="numeric" pattern="\d{8}" maxLength={8} value={activation.activationCode} onChange={(event) => setActivation({ ...activation, activationCode: event.target.value.replace(/\D/g, '') })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-indigo-400" placeholder="00000000" />
          </label>
          {faceError && <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{faceError}</div>}
          <button disabled={activating} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 font-semibold text-white disabled:opacity-60">{activating && <Loader2 size={17} className="animate-spin" />} Activate terminal</button>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-white/55"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> The setup code is single-use. AWS and biometric encryption credentials are never stored in this form.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">{configuration.schoolName}</p><h1 className="mt-1 font-semibold text-white">{configuration.deviceName}</h1><p className="text-xs text-white/55">{configuration.location || configuration.deviceId}</p></div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${online ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{online ? <Signal size={14} /> : <WifiOff size={14} />}{online ? 'Online' : 'Offline'}</span>
          <button onClick={syncQueue} disabled={!online || syncing || !pendingCount} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/75 disabled:opacity-40"><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />{pendingCount} queued</button>
          <button onClick={resetTerminal} className="rounded-full bg-white/5 p-2 text-white/55" title="Remove terminal configuration"><LogOut size={15} /></button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative min-h-[62vh] overflow-hidden rounded-[2rem] border border-white/10 bg-black p-4">
          {faceSession ? (
            <AwsFaceLivenessCapture
              session={faceSession}
              onAnalysisComplete={completeFaceRecognition}
              onError={handleFaceError}
              onCancel={() => setFaceSession(null)}
            />
          ) : (
            <div className="flex min-h-[58vh] items-center justify-center px-8 text-center">
              <div className="max-w-md">
                <ScanFace size={88} className="mx-auto text-indigo-300/40" />
                <h2 className="mt-6 text-3xl font-semibold">Face attendance</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">Tap start, position one person in front of the camera, and follow the liveness instructions.</p>
                <button onClick={startFaceRecognition} disabled={processing || !online} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-7 py-3.5 font-semibold text-white disabled:opacity-40">
                  {processing ? <Loader2 size={19} className="animate-spin" /> : <ScanFace size={19} />} Start face recognition
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`absolute inset-0 z-20 flex items-center justify-center p-6 text-center ${result.type === 'success' ? 'bg-emerald-950/95' : result.type === 'queued' ? 'bg-amber-950/95' : 'bg-rose-950/95'}`}>
              <div>{result.type === 'success' ? <UserCheck size={72} className="mx-auto text-emerald-300" /> : result.type === 'queued' ? <CloudOff size={72} className="mx-auto text-amber-300" /> : <AlertTriangle size={72} className="mx-auto text-rose-300" />}
                {result.outcome ? <><h2 className="mt-5 text-3xl font-semibold text-white">{result.outcome.person?.name}</h2><p className="mt-2 text-lg text-white/80">{result.outcome.person?.reference}{result.outcome.person?.grade ? ` · ${result.outcome.person.grade}` : ''}</p><p className="mt-6 text-2xl font-semibold tracking-wide">{outcomeLabel(result.outcome)}</p><p className="mt-2 text-sm text-white/70">{result.outcome.message}</p></> : <><h2 className="mt-5 text-2xl font-semibold text-white">{result.type === 'queued' ? 'Saved offline' : 'Not accepted'}</h2><p className="mt-3 text-sm text-white/75">{result.message}</p></>}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Attendance direction</p>
            <div className="mt-4 grid grid-cols-2 gap-2">{['IN', 'OUT'].map((value) => <button key={value} disabled={Boolean(faceSession)} onClick={() => setDirection(value)} className={`rounded-xl px-3 py-3 text-xs font-semibold ${direction === value ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/55'}`}>CHECK {value}</button>)}</div>
          </div>

          {faceError && (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5">
              <div className="flex items-center gap-2 text-amber-300"><AlertTriangle size={18} /><p className="text-sm font-semibold">Face verification unavailable</p></div>
              <p className="mt-2 text-xs leading-5 text-white/65">{faceError}</p>
              {online && <button onClick={startFaceRecognition} className="mt-4 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold">Try a new face scan</button>}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <button onClick={() => setManualVisible((visible) => !visible)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">
              <Keyboard size={17} /> {manualVisible ? 'Hide manual fallback' : 'Use manual fallback'}
            </button>

            {manualVisible && (
              <form onSubmit={submitManual} className="mt-5 border-t border-white/10 pt-5">
                <p className="text-xs leading-5 text-white/55">Use only when face recognition fails or the person is not enrolled.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">{['LEARNER', 'STAFF'].map((type) => <button type="button" key={type} onClick={() => setPersonType(type)} className={`rounded-xl px-3 py-3 text-xs font-semibold ${personType === type ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/55'}`}>{type}</button>)}</div>
                <input required value={manualId} onChange={(event) => setManualId(event.target.value)} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder={personType === 'LEARNER' ? 'Admission number' : 'Staff ID'} />
                <button disabled={processing} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold disabled:opacity-60">{processing ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Record attendance</button>
              </form>
            )}
          </div>

          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/5 p-5">
            <div className="flex items-center gap-2 text-indigo-300"><ShieldCheck size={18} /><p className="text-sm font-semibold">AWS liveness protection</p></div>
            <p className="mt-2 text-xs leading-5 text-white/55">A new single-use session is created for every attempt. Attendance is recorded only after liveness and face-match thresholds pass.</p>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default BiometricTerminal;
