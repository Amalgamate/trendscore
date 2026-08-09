import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CloudOff,
  Fingerprint,
  Keyboard,
  Loader2,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Signal,
  Smartphone,
  UserCheck,
  WifiOff,
} from 'lucide-react';
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

const parseScanValue = (rawValue, fallbackPersonType) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.personId) {
      return {
        personId: String(parsed.personId).trim(),
        personType: String(parsed.personType || fallbackPersonType).toUpperCase(),
      };
    }
  } catch {
    // Plain admission/staff identifiers are a supported QR format.
  }

  const prefixed = raw.match(/^TS:(LEARNER|STAFF):(.+)$/i);
  if (prefixed) return { personType: prefixed[1].toUpperCase(), personId: prefixed[2].trim() };
  return { personId: raw, personType: fallbackPersonType };
};

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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualId, setManualId] = useState('');
  const [personType, setPersonType] = useState('LEARNER');
  const [direction, setDirection] = useState('IN');
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const resultTimerRef = useRef(null);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount(await countTerminalEvents()); } catch { setPendingCount(0); }
  }, []);

  useEffect(() => {
    Promise.all([loadTerminalConfiguration(), countTerminalEvents()])
      .then(([stored, queued]) => {
        setConfiguration(stored);
        setPendingCount(queued);
      })
      .catch(() => setCameraError('Secure offline storage is unavailable on this browser.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showResult = useCallback((nextResult) => {
    setResult(nextResult);
    window.clearTimeout(resultTimerRef.current);
    resultTimerRef.current = window.setTimeout(() => {
      setResult(null);
      scanLockRef.current = false;
    }, RESULT_RESET_MS);
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
    setCameraError('');
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
      setCameraError(error.message || 'Terminal activation failed.');
    } finally {
      setActivating(false);
    }
  };

  const submitAttendance = useCallback(async ({ personId: reference, personType: scannedType }, modality) => {
    if (!configuration || processing || scanLockRef.current) return;
    if (!reference || !['LEARNER', 'STAFF'].includes(scannedType)) {
      showResult({ type: 'error', message: 'The scanned code is not a valid learner or staff identity.' });
      return;
    }

    scanLockRef.current = true;
    setProcessing(true);
    const event = {
      eventId: crypto.randomUUID(),
      deviceId: configuration.deviceId,
      personId: reference,
      personType: scannedType,
      timestamp: new Date().toISOString(),
      direction,
      modality,
      offlineCaptured: !navigator.onLine,
      createdAt: Date.now(),
    };

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

  const stopCamera = useCallback(() => {
    window.clearInterval(detectorTimerRef.current);
    detectorTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    if (!('BarcodeDetector' in window)) {
      setCameraError('QR camera scanning is not supported by this browser. Use Chrome on Android or Manual Entry.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      detectorTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || scanLockRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const parsed = parseScanValue(codes[0]?.rawValue, personType);
          if (parsed) submitAttendance(parsed, 'QR');
        } catch {
          // Individual camera frames can fail while focus settles; keep scanning.
        }
      }, 500);
    } catch (error) {
      setCameraError(error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or use Manual Entry.'
        : 'Unable to start the camera. Use Manual Entry while the camera is checked.');
      stopCamera();
    }
  }, [personType, stopCamera, submitAttendance]);

  useEffect(() => () => {
    stopCamera();
    window.clearTimeout(resultTimerRef.current);
  }, [stopCamera]);

  const submitManual = (event) => {
    event.preventDefault();
    const parsed = parseScanValue(manualId, personType);
    if (parsed) {
      submitAttendance(parsed, 'MANUAL');
      setManualId('');
    }
  };

  const resetTerminal = async () => {
    if (!window.confirm('Remove this phone terminal configuration? An administrator must issue a new activation code.')) return;
    stopCamera();
    await clearTerminalConfiguration();
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
          {cameraError && <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{cameraError}</div>}
          <button disabled={activating} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 font-semibold text-white disabled:opacity-60">{activating && <Loader2 size={17} className="animate-spin" />} Activate terminal</button>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-white/55"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> The setup code is single-use. Biometric encryption keys and learner templates are never placed on this phone.</p>
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
        <div className="relative min-h-[55vh] overflow-hidden rounded-[2rem] border border-white/10 bg-black">
          <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {cameraActive ? <div className="h-64 w-64 rounded-[2rem] border-2 border-indigo-400 shadow-[0_0_0_999px_rgba(2,6,23,0.45)]"><ScanLine className="mx-auto mt-3 animate-pulse text-indigo-300" /></div> : (
              <div className="max-w-md px-8 text-center"><QrCode size={72} className="mx-auto text-white/20" /><h2 className="mt-5 text-2xl font-semibold text-white">Scan a learner QR code</h2><p className="mt-2 text-sm leading-6 text-white/55">The code may contain an admission number or <code>TS:LEARNER:ADM-1024</code>.</p></div>
            )}
          </div>

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
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Attendance event</p>
            <div className="mt-4 grid grid-cols-2 gap-2">{['LEARNER', 'STAFF'].map((type) => <button key={type} onClick={() => setPersonType(type)} className={`rounded-xl px-3 py-3 text-xs font-semibold ${personType === type ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/55'}`}>{type}</button>)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">{['IN', 'OUT'].map((value) => <button key={value} onClick={() => setDirection(value)} className={`rounded-xl px-3 py-3 text-xs font-semibold ${direction === value ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/55'}`}>CHECK {value}</button>)}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <button onClick={cameraActive ? stopCamera : startCamera} disabled={processing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-950">{cameraActive ? <Camera size={18} /> : <QrCode size={18} />}{cameraActive ? 'Stop camera' : 'Start QR scanner'}</button>
            {cameraError && <p className="mt-3 text-xs leading-5 text-amber-300">{cameraError}</p>}
          </div>

          <form onSubmit={submitManual} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2"><Keyboard size={17} className="text-indigo-300" /><p className="text-sm font-semibold">Manual fallback</p></div>
            <input required value={manualId} onChange={(event) => setManualId(event.target.value)} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder={personType === 'LEARNER' ? 'Admission number' : 'Staff ID'} />
            <button disabled={processing} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold disabled:opacity-60">{processing ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Record attendance</button>
          </form>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5">
            <div className="flex items-center gap-2 text-amber-300"><Fingerprint size={18} /><p className="text-sm font-semibold">Face recognition provider</p></div>
            <p className="mt-2 text-xs leading-5 text-white/55">Not installed. Face capture remains disabled until an evaluated liveness and matching SDK is approved. This terminal never pretends a camera photo is a biometric match.</p>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default BiometricTerminal;
