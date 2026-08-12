import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  Keyboard,
  KeyRound,
  Loader2,
  Radio,
  ScanFace,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { biometricAPI } from '../../../../services/api/biometric.api';

const BridgeConfig = () => {
  const [configuration, setConfiguration] = useState(null);
  const [error, setError] = useState('');
  const webhookUrl = `${window.location.origin}/api/biometric/log`;

  useEffect(() => {
    biometricAPI.getConfiguration()
      .then(setConfiguration)
      .catch((err) => setError(err.message || 'Unable to read biometric platform configuration.'));
  }, []);

  const samplePayload = useMemo(() => JSON.stringify({
    deviceId: 'YOUR-HARDWARE-DEVICE-ID',
    personId: 'LEARNER-ADMISSION-NUMBER',
    personType: 'LEARNER',
    timestamp: new Date().toISOString(),
    direction: 'IN',
  }, null, 2), []);

  const downloadConfiguration = () => {
    const document = JSON.stringify({
      guideVersion: configuration?.guideVersion || '2026.08',
      endpoint: webhookUrl,
      method: 'POST',
      contentType: 'application/json',
      authorization: 'Bearer ONE-TIME-TOKEN-FROM-TERMINAL-MANAGEMENT',
      payload: JSON.parse(samplePayload),
      notes: [
        'Use the device ID and one-time token issued in Terminal Management.',
        'Never place the platform biometric encryption key on a terminal.',
        'Raw vendor PUSH payloads require an approved connector that translates them to this contract.',
      ],
    }, null, 2);
    const url = URL.createObjectURL(new Blob([document], { type: 'application/json' }));
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = 'trendscore-biometric-terminal-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <header className="rounded-3xl bg-slate-950 p-8 text-white md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">School biometric installation</p>
            <h2 className="mt-3 text-3xl font-semibold">Connect a terminal safely</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Register each terminal, configure the issued device token, send one authenticated scan, then verify the heartbeat from Terminal Management.</p>
          </div>
          {!configuration && !error ? <Loader2 className="animate-spin text-indigo-300" /> : (
            <div className={`rounded-2xl border px-5 py-4 ${configuration?.encryptionConfigured ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {configuration?.encryptionConfigured ? <ShieldCheck className="text-emerald-400" size={18} /> : <AlertTriangle className="text-rose-400" size={18} />}
                Template encryption {configuration?.encryptionConfigured ? 'ready' : 'not configured'}
              </div>
              {configuration && <p className="mt-1 text-xs text-slate-400">Key version {configuration.keyVersion} · guide {configuration.guideVersion}</p>}
            </div>
          )}
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-4">
        <Step number="1" icon={Terminal} title="Register" text="Enter the hardware ID, terminal name, location and sync mode in Terminal Management." />
        <Step number="2" icon={KeyRound} title="Save token" text="Copy the one-time device token. The platform stores only its digest." />
        <Step number="3" icon={Radio} title="Send a scan" text="Configure a canonical HTTPS POST or use an approved vendor connector." />
        <Step number="4" icon={CheckCircle2} title="Verify" text="Send a test scan, then select Test on the terminal card within ten minutes." />
      </section>

      <section className={`rounded-3xl border p-7 ${configuration?.faceRecognitionConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3 ${configuration?.faceRecognitionConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><ScanFace size={24} /></div>
            <div>
              <h3 className="font-semibold text-slate-900">AWS face recognition</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {configuration?.faceRecognitionConfigured
                  ? `Ready in ${configuration.faceRecognition?.region}. Liveness threshold ${configuration.faceRecognition?.livenessThreshold}; match threshold ${configuration.faceRecognition?.matchThreshold}.`
                  : `Not configured${configuration?.faceRecognition?.missing?.length ? ` — missing ${configuration.faceRecognition.missing.join(', ')}` : ''}. Manual attendance remains available.`}
              </p>
            </div>
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-xs font-semibold ${configuration?.faceRecognitionConfigured ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
            {configuration?.faceRecognitionConfigured ? 'FACE READY' : 'SETUP REQUIRED'}
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <MiniStep icon={ScanFace} text="Enroll faces with documented consent under Biometric Authority." />
          <MiniStep icon={Smartphone} text="Activate a PHONE terminal and start a new liveness session per attendance event." />
          <MiniStep icon={Keyboard} text="Use manual admission/staff ID only when face recognition fails." />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Server size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-900">Canonical webhook contract</h3>
            <p className="text-xs text-slate-500">Supported by any terminal or connector capable of sending JSON over HTTPS.</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <CopyBlock label="POST endpoint" value={webhookUrl} />
          <CopyBlock label="Authorization header" value="Bearer ONE-TIME-TOKEN-FROM-TERMINAL-MANAGEMENT" />
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">JSON payload</p>
            <div className="relative rounded-2xl bg-slate-950 p-5 text-slate-200">
              <button onClick={() => navigator.clipboard.writeText(samplePayload)} className="absolute right-3 top-3 rounded-lg bg-white/10 p-2 text-slate-300 hover:bg-white/20"><Clipboard size={15} /></button>
              <pre className="overflow-x-auto text-xs leading-6"><code>{samplePayload}</code></pre>
            </div>
          </div>
          <button onClick={downloadConfiguration} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white">
            <Download size={15} /> Download configuration sample
          </button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <InfoCard title="Direct PUSH devices" tone="emerald">
          Use direct mode only when the terminal can send the canonical JSON fields shown above. Store its unique device token in the terminal’s protected webhook configuration.
        </InfoCard>
        <InfoCard title="ZKTeco and other vendor payloads" tone="amber">
          Vendor-native PUSH formats are not accepted directly yet. Use an approved connector to translate the payload, or configure PULL mode with a network-reachable IP address supported by your ZKTeco server edition.
        </InfoCard>
      </section>

      <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6">
        <h3 className="font-semibold text-rose-900">Security boundaries</h3>
        <ul className="mt-3 space-y-2 text-sm text-rose-800">
          <li>• Never copy the platform’s biometric encryption key onto a school terminal.</li>
          <li>• Use one device token per physical terminal and rotate it immediately after loss or compromise.</li>
          <li>• Decommission retired terminals; audit logs remain retained for the school.</li>
          <li>• Do not expose PULL-mode terminal IP addresses to the public internet.</li>
        </ul>
      </section>
    </div>
  );
};

const Step = ({ number, icon: Icon, title, text }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between"><Icon className="text-indigo-600" size={21} /><span className="text-xs font-semibold text-slate-300">{number}</span></div>
    <h3 className="mt-5 font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
  </article>
);

const MiniStep = ({ icon: Icon, text }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 text-xs leading-5 text-slate-600">
    <Icon size={17} className="mt-0.5 shrink-0 text-indigo-600" />
    <span>{text}</span>
  </div>
);

const CopyBlock = ({ label, value }) => (
  <div>
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <code className="min-w-0 flex-1 overflow-x-auto text-xs text-slate-700">{value}</code>
      <button onClick={() => navigator.clipboard.writeText(value)} className="rounded-lg bg-white p-2 text-slate-500 shadow-sm"><Clipboard size={15} /></button>
    </div>
  </div>
);

const InfoCard = ({ title, tone, children }) => (
  <article className={`rounded-3xl border p-6 ${tone === 'emerald' ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
    <h3 className={`font-semibold ${tone === 'emerald' ? 'text-emerald-900' : 'text-amber-900'}`}>{title}</h3>
    <p className={`mt-2 text-sm leading-6 ${tone === 'emerald' ? 'text-emerald-800' : 'text-amber-800'}`}>{children}</p>
  </article>
);

export default BridgeConfig;
