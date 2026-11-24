import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, MessageCircle, ShieldCheck, Unlink } from 'lucide-react';
import { chatAPI } from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

const ParentWhatsAppAssistantCard = () => {
  const { showSuccess, showError } = useNotifications();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const refreshStatus = useCallback(async () => {
    const response = await chatAPI.getWhatsAppAssistant();
    if (response?.success) setStatus(response.data);
    return response?.data;
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await chatAPI.getWhatsAppAssistant();
        if (active && response?.success) setStatus(response.data);
      } catch (error) {
        if (active) showError(error.message || 'Could not load WhatsApp assistant settings');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [showError]);

  useEffect(() => {
    if (!linkCode || !expiresAt) return undefined;
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      if (Date.now() >= expiresAt) {
        setLinkCode('');
        setExpiresAt(0);
        return;
      }
      try {
        const next = await refreshStatus();
        if (next?.linked) {
          setLinkCode('');
          setExpiresAt(0);
          showSuccess('WhatsApp number linked successfully');
        }
      } catch { /* keep showing the issued code while the status check retries */ }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [expiresAt, linkCode, refreshStatus, showSuccess]);

  const requestCode = async () => {
    setBusy(true);
    try {
      const response = await chatAPI.createWhatsAppLinkCode(consent);
      const data = response?.data;
      if (!data?.code) throw new Error(response?.message || 'Could not create a link code');
      setLinkCode(data.code);
      setExpiresAt(Date.now() + (data.expiresInSeconds || 600) * 1000);
      setNow(Date.now());
      showSuccess('Secure link code created. Send it from the WhatsApp number on your parent profile.');
    } catch (error) {
      showError(error.message || 'Could not create a WhatsApp link code');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    setBusy(true);
    try {
      const response = await chatAPI.updateWhatsAppAssistant(!status?.enabled);
      if (!response?.success) throw new Error(response?.message || 'Could not update the assistant');
      setStatus(response.data);
      showSuccess(response.data.enabled ? 'WhatsApp assistant resumed' : 'WhatsApp assistant paused');
    } catch (error) {
      showError(error.message || 'Could not update the assistant');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp from your parent account? You will need to link it again before viewing records in WhatsApp.')) return;
    setBusy(true);
    try {
      await chatAPI.disconnectWhatsAppAssistant();
      setStatus((current) => ({ ...current, linked: false, enabled: false, phone: null, linkedAt: null }));
      setLinkCode('');
      setExpiresAt(0);
      setConsent(false);
      showSuccess('WhatsApp assistant disconnected');
    } catch (error) {
      showError(error.message || 'Could not disconnect WhatsApp');
    } finally {
      setBusy(false);
    }
  };

  const copyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(`LINK ${linkCode}`);
      showSuccess('Link command copied');
    } catch {
      showError('Could not copy the link command. Please type it in WhatsApp.');
    }
  };

  const secondsRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const waNumber = String(status?.whatsappNumber || '').replace(/\D/g, '');
  const whatsappHref = waNumber && linkCode
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`LINK ${linkCode}`)}`
    : null;

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
                <Check size={13} /> Linked
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Securely ask for fee balances and results the school has published for learners linked to your parent account.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Loading assistant settings…</div>
      ) : status?.linked ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Connected number</p>
              <p className="mt-1 text-sm text-gray-600">{status.phone || 'WhatsApp number linked'}</p>
              <p className="mt-1 text-xs text-gray-500">{status.enabled ? 'Assistant replies are active.' : 'Assistant replies are paused.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={toggleEnabled} disabled={busy} className="h-10 border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-60">
                {busy ? 'Saving…' : status.enabled ? 'Pause assistant' : 'Resume assistant'}
              </button>
              <button type="button" onClick={disconnect} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-red-200 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                <Unlink size={15} />Disconnect
              </button>
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-gray-500">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            Only this parent account’s accessible learners are looked up. Never send a password or M-Pesa PIN in chat.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {!status?.phoneReady && (
            <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Add a valid Kenyan phone number to Personal Details and save before linking WhatsApp.</p>
          )}
          {!status?.assistantAvailable && (
            <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The school has not finished configuring WhatsApp yet. Please contact the school office before trying to link your number.</p>
          )}
          <label className="flex cursor-pointer items-start gap-3 border border-gray-200 bg-gray-50 p-4 text-sm leading-5 text-gray-700">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-700" />
            <span>I agree to link the WhatsApp number on my profile. The assistant may retrieve fee balances and school-published results only for learners accessible from my parent account. WhatsApp messages are processed by Meta and the school’s assistant service. If the school enables its local AI classifier, your message text is used only to route your request; fee and result records stay in the school database.</span>
          </label>
          <button type="button" onClick={requestCode} disabled={busy || !consent || !status?.phoneReady || !status?.assistantAvailable} className="inline-flex h-11 items-center gap-2 bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            Create secure link code
          </button>

          {linkCode && secondsRemaining > 0 && (
            <div className="border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-950">Finish linking within {Math.ceil(secondsRemaining / 60)} min</p>
              <p className="mt-1 text-sm text-emerald-900">Send this one-time command from the WhatsApp number shown in your parent profile:</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="border border-emerald-200 bg-white px-4 py-2 text-lg font-black tracking-[0.2em] text-emerald-950">LINK {linkCode}</code>
                <button type="button" onClick={copyInstructions} className="inline-flex h-10 items-center gap-2 border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100"><Copy size={15} />Copy command</button>
                {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Open WhatsApp</a>}
              </div>
              <p className="mt-2 text-xs text-emerald-800">The code works once and expires automatically. This page will update after the message is verified.</p>
              {status?.whatsappNumber && <p className="mt-1 text-xs text-emerald-800">School WhatsApp: {status.whatsappNumber}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentWhatsAppAssistantCard;
