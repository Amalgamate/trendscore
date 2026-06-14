import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import api from '../../../services/api';

const ESCALATION_DELAY_MS = 60 * 1000;

const parseMetadata = (notification) => {
  const raw = notification?.metadata;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

const isFeeApprovalNotification = (notification) => {
  if (!notification || notification.isRead) return false;
  return parseMetadata(notification).kind === 'FEE_CONFIGURATION_APPROVAL';
};

const describeLearner = (metadata) => {
  const parts = [metadata.learnerName, metadata.admissionNumber]
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Learner fee setup';
};

export default function FeeApprovalReminder() {
  const { unreadNotifications, markAsRead, fetchNotifications } = useUserNotifications();
  const [showOverlay, setShowOverlay] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState(0);

  const pendingApprovals = useMemo(
    () => unreadNotifications.filter(isFeeApprovalNotification),
    [unreadNotifications]
  );

  useEffect(() => {
    if (pendingApprovals.length === 0) {
      setShowOverlay(false);
      setError('');
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowOverlay(true);
    }, ESCALATION_DELAY_MS);

    return () => clearTimeout(timer);
  }, [pendingApprovals.length, cycle]);

  const approveNotification = useCallback(
    async (notification) => {
      const metadata = parseMetadata(notification);
      if (!metadata.configurationId) {
        setError('This approval notification is missing the configuration reference.');
        return;
      }

      setBusyId(notification.id);
      setError('');
      try {
        const response = await api.fees.approveLearnerFeeConfiguration(metadata.configurationId);
        if (response?.success === false) {
          throw new Error(response.message || 'Approval failed');
        }
        await markAsRead(notification.id);
        await fetchNotifications();
        toast.success('Fee configuration approved');
      } catch (err) {
        const message = err?.message || 'Fee configuration approval failed';
        setError(message);
        toast.error(message);
      } finally {
        setBusyId(null);
      }
    },
    [fetchNotifications, markAsRead]
  );

  const markNotificationRead = useCallback(
    async (notification) => {
      setBusyId(notification.id);
      setError('');
      try {
        await markAsRead(notification.id);
        await fetchNotifications();
      } catch (err) {
        const message = err?.message || 'Could not mark approval as handled';
        setError(message);
      } finally {
        setBusyId(null);
      }
    },
    [fetchNotifications, markAsRead]
  );

  if (pendingApprovals.length === 0) return null;

  const primaryApproval = pendingApprovals[0];
  const primaryMetadata = parseMetadata(primaryApproval);

  return (
    <>
      <div className="fixed right-5 top-24 z-[90] w-[360px] max-w-[calc(100vw-2rem)] border border-emerald-300 bg-emerald-600 text-white shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Clock size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black uppercase tracking-[0.18em]">
              Approval reminder
            </div>
            <div className="mt-1 text-sm font-semibold">
              {pendingApprovals.length} fee configuration{pendingApprovals.length === 1 ? '' : 's'} waiting.
            </div>
            <div className="mt-1 truncate text-xs text-emerald-50">
              {describeLearner(primaryMetadata)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowOverlay(true)}
                className="bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:bg-emerald-50"
              >
                Review now
              </button>
              <button
                type="button"
                onClick={() => approveNotification(primaryApproval)}
                disabled={busyId === primaryApproval.id}
                className="border border-white/50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
              >
                {busyId === primaryApproval.id ? 'Approving...' : 'Approve first'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showOverlay && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl border border-emerald-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Fee configuration approvals need attention
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    These requests have stayed unattended for at least one minute. Approving one applies it to future invoice generation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOverlay(false);
                  setCycle((value) => value + 1);
                }}
                className="p-2 text-slate-500 hover:bg-white hover:text-slate-900"
                aria-label="Close fee approval reminder"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {error && (
                <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {pendingApprovals.map((notification) => {
                  const metadata = parseMetadata(notification);
                  return (
                    <div
                      key={notification.id}
                      className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-950">
                          {describeLearner(metadata)}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {notification.message}
                        </div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Pending approval
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => approveNotification(notification)}
                          disabled={busyId === notification.id}
                          className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          <CheckCircle2 size={15} />
                          {busyId === notification.id ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => markNotificationRead(notification)}
                          disabled={busyId === notification.id}
                          className="border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                        >
                          Mark handled
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
