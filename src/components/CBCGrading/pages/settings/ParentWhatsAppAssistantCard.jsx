import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, MessageCircle, ShieldCheck, Smartphone, Unlink } from 'lucide-react';
import { chatAPI } from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

/**
 * Parent WhatsApp assistant — one decision, one button.
 *
 * The parent is never asked to copy a code. They confirm consent, tap once, and
 * either the tap is enough (the school already holds their number) or the school
 * messages that number and they reply YES on the same phone they are holding.
 */
const ParentWhatsAppAssistantCard = () => {
  const { showSuccess, showError } = useNotifications();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  // Guards against the poll callback firing after unmount.
  const activeRef = useRef(true);

  const applyStatus = useCallback((data) => {
    if (!activeRef.current || !data) return;
    setStatus(data);
    if (data.linked) {
      setAwaiting(false);
      setLinkCode('');
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const response = await chatAPI.getWhatsAppAssistant();
    if (response?.success) applyStatus(response.data);
    return response?.data;
  }, [applyStatus]);

  useEffect(() => {
    activeRef.current = true;
    const load = async () => {
      try {
        const response = await chatAPI.getWhatsAppAssistant();
        if (!activeRef.current) return;
        if (response?.success) {
          setStatus(response.data);
          // Resume the "waiting for your YES" screen after a page reload.
          if (response.data?.awaitingConfirmation) setAwaiting(true);
        }
      } catch (error) {
        if (activeRef.current) showError(error.message || 'Could not load WhatsApp assistant settings');
      } finally {
        if (activeRef.current) setLoading(false);
      }
    };
    load();
    return () => { activeRef.current = false; };
  }, [showError]);

  // While a confirmation is pending, poll for the link landing.
  useEffect(() => {
    if (!awaiting) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await refreshStatus();
        if (next?.linked) showSuccess('WhatsApp assistant is on');
      } catch { /* keep waiting; the challenge expires on its own */ }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [awaiting, refreshStatus, showSuccess]);

  const turnOn = async () => {
    setBusy(true);
    try {
      const response = await chatAPI.requestWhatsAppConfirmation(true);
      if (!response?.success) throw new Error(response?.message || 'Could not turn on the assistant');
      applyStatus(response.data?.status);
      setAwaiting(true);
      await refreshStatus();
      showSuccess(`Check WhatsApp on ${response.data?.phone || 'your phone'} and reply YES`);
    } catch (error) {
      showError(error.message || 'Could not turn on the WhatsApp assistant');
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    setBusy(true);
    try {
      const response = await chatAPI.createWhatsAppLinkCode(true);
      const data = response?.data;
      if (!data?.code) throw new Error(response?.message || 'Could not create a link code');
      setLinkCode(data.code);
      setAwaiting(false);
      showSuccess(`Send “LINK ${data.code}” from your WhatsApp to the school number`);
    } catch (error) {
      showError(error.message || 'Could not create a link code');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    setBusy(true);
    try {
      const response = await chatAPI.updateWhatsAppAssistant(!status?.enabled);
      if (!response?.success) throw new Error(response?.message || 'Could not update the assistant');
      applyStatus(response.data);
      showSuccess(response.data.enabled ? 'Assistant turned back on' : 'Assistant paused');
    } catch (error) {
      showError(error.message || 'Could not update the assistant');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Turn off the WhatsApp assistant for this number? You can turn it back on any time.')) return;
    setBusy(true);
    try {
      await chatAPI.disconnectWhatsAppAssistant();
      setStatus((current) => ({ ...current, linked: false, enabled: false, phone: null, linkedAt: null }));
      setAwaiting(false);
      setLinkCode('');
      setConsent(false);
      setManualOpen(false);
      showSuccess('WhatsApp assistant turned off');
    } catch (error) {
      showError(error.message || 'Could not turn off WhatsApp');
    } finally {
      setBusy(false);
    }
  };

  const waNumber = String(status?.whatsappNumber || '').replace(/\D/g, '');
  const whatsappHref = waNumber && linkCode
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`LINK ${linkCode}`)}`
    : null;

  const canTurnOn = Boolean(consent && status?.phoneReady && status?.assistantAvailable) && !busy;

  return (
    <section className="border border-emerald-200 bg-white p-5 sm:p-6" aria-labelledby="parent-whatsapp-title">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <MessageCircle size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="parent-whatsapp-title" className="text-lg font-bold text-gray-950">WhatsApp school assistant</h2>
            {status?.linked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <Check size={13} /> On
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Ask for fee balances and published results on WhatsApp, for the learners on your own parent account.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Loading…</div>
      ) : status?.linked ? (
        /* ── Already on ───────────────────────────────────────────────────── */
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Number on the assistant</p>
              <p className="mt-1 text-sm text-gray-600">{status.phone || 'WhatsApp number linked'}</p>
              <p className="mt-1 text-xs text-gray-500">{status.enabled ? 'Replying to your messages.' : 'Currently paused.'}</p>
              {!status.assistantAvailable && <p className="mt-2 text-xs font-semibold text-amber-800">The school’s WhatsApp is offline. Ask a school administrator to reconnect it in Settings → Communication → WhatsApp.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={toggleEnabled} disabled={busy} className="h-10 border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-60">
                {busy ? 'Saving…' : status.enabled ? 'Pause' : 'Turn back on'}
              </button>
              <button type="button" onClick={disconnect} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-red-200 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                <Unlink size={15} />Turn off
              </button>
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-gray-500">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            Only learners linked to your parent account are looked up. Never send a password or M-Pesa PIN in chat.
          </p>
        </div>
      ) : awaiting ? (
        /* ── Waiting for YES ──────────────────────────────────────────────── */
        <div className="mt-5 space-y-4">
          <div className="border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Smartphone size={20} className="mt-0.5 shrink-0 text-emerald-800" />
              <div>
                <p className="text-sm font-bold text-emerald-950">Check WhatsApp on {status?.profilePhone || 'your phone'}</p>
                <p className="mt-1 text-sm text-emerald-900">
                  We sent you a message. Reply <span className="font-black">YES</span> and the assistant turns on by itself — nothing else to do.
                </p>
                <p className="mt-2 text-xs text-emerald-800">The message expires in 15 minutes. If it never arrives, try again below.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={turnOn} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}Send again
            </button>
            <button type="button" onClick={() => setManualOpen(true)} className="h-10 px-2 text-sm font-bold text-gray-600 underline hover:text-gray-900">
              Didn’t get a message?
            </button>
          </div>
        </div>
      ) : (
        /* ── Off — the single consent screen ──────────────────────────────── */
        <div className="mt-5 space-y-4">
          {!status?.phoneReady && (
            <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Add a phone number to your profile first, then come back here.</p>
          )}
          {!status?.assistantAvailable && (
            <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The school’s WhatsApp is offline. Ask a school administrator to connect it in Settings → Communication → WhatsApp.</p>
          )}

          {status?.phoneReady && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">We will use this number</p>
              <p className="mt-1 text-lg font-black text-gray-950">{status.profilePhone || '—'}</p>
              <p className="mt-1 text-xs text-gray-500">This is the number on your profile. To use a different one, change it in Personal Details first.</p>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-gray-700">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-700" />
            <span>
              Yes, turn on the WhatsApp assistant. It may show fee balances and results the school has published for
              <strong> my own learners only</strong>, and I can turn it off any time with STOP.
            </span>
          </label>

          <button
            type="button"
            onClick={turnOn}
            disabled={!canTurnOn}
            className="inline-flex h-11 items-center gap-2 bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            Turn on WhatsApp assistant
          </button>

          <button type="button" onClick={() => setManualOpen((open) => !open)} className="block text-xs font-bold text-gray-500 underline hover:text-gray-800">
            Having trouble? Use a code instead
          </button>

          {manualOpen && (
            <div className="border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-700">We will show a short code. Send it from your WhatsApp to the school number.</p>
              <button
                type="button"
                onClick={requestCode}
                disabled={busy || !status?.phoneReady || !status?.assistantAvailable}
                className="mt-3 inline-flex h-10 items-center border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-50"
              >
                Show a code
              </button>
              {linkCode && (
                <div className="mt-3 border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-900">Send this to the school on WhatsApp:</p>
                  <code className="mt-2 inline-block border border-emerald-200 bg-white px-3 py-2 text-base font-black tracking-[0.2em] text-emerald-950">LINK {linkCode}</code>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Open WhatsApp</a>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentWhatsAppAssistantCard;
