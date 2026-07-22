/**
 * SystemControlPage
 * Settings › System Control
 *
 * Provides two high-privilege administrative operations:
 *   1. Force Logout All Users  — invalidates all active sessions
 *   2. Refresh Cache           — flushes the server-side Redis cache
 *
 * Accessible only to SUPER_ADMIN and ADMIN.
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Users,
  Database,
} from 'lucide-react';
import { authAPI } from '../../../../services/api';
import SettingsPageShell from '../../shared/SettingsPageShell';

function clearLocalSessionAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('authToken');
  localStorage.removeItem('selectedInstitutionType');

  document.cookie = 'accessToken=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = 'refreshToken=; Max-Age=0; path=/; SameSite=Lax';
  sessionStorage.setItem('session_expired', 'expired');
  window.location.href = '/';
}

// ─── Confirmation modal ────────────────────────────────────────────────────────
const ConfirmModal = ({ title, description, confirmLabel, confirmClass, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle size={20} />
        </span>
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Action card ───────────────────────────────────────────────────────────────
const ActionCard = ({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  warning,
  buttonLabel,
  buttonClass,
  busy,
  result,
  onAction,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
    {/* Header */}
    <div className="flex items-start gap-4">
      <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        <Icon size={22} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>

    {/* Warning banner */}
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <ShieldAlert size={16} className="text-amber-600 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-800 font-medium">{warning}</p>
    </div>

    {/* Result feedback */}
    {result && (
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${
        result.ok
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border border-rose-200 text-rose-700'
      }`}>
        {result.ok
          ? <CheckCircle2 size={15} className="shrink-0" />
          : <AlertTriangle size={15} className="shrink-0" />}
        {result.message}
      </div>
    )}

    {/* Action button */}
    <div>
      <button
        onClick={onAction}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed ${buttonClass}`}
      >
        {busy
          ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
          : <>{buttonLabel}</>}
      </button>
    </div>
  </div>
);

// ─── Main page ─────────────────────────────────────────────────────────────────
const SystemControlPage = () => {
  const [logoutBusy, setLogoutBusy]     = useState(false);
  const [cacheBusy,  setCacheBusy]      = useState(false);
  const [logoutResult, setLogoutResult] = useState(null);
  const [cacheResult,  setCacheResult]  = useState(null);
  const [confirm, setConfirm]           = useState(null); // 'logout-all' | 'flush-cache' | null

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogoutAll = async () => {
    setConfirm(null);
    setLogoutBusy(true);
    setLogoutResult(null);
    try {
      const res = await authAPI.logoutAll();
      setLogoutResult({ ok: true, message: res?.message || 'All sessions invalidated successfully.' });
      setTimeout(clearLocalSessionAndRedirect, 800);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to invalidate sessions.';
      setLogoutResult({ ok: false, message: msg });
    } finally {
      setLogoutBusy(false);
    }
  };

  const handleFlushCache = async () => {
    setConfirm(null);
    setCacheBusy(true);
    setCacheResult(null);
    try {
      const res = await authAPI.flushCache();
      setCacheResult({ ok: true, message: res?.message || 'Cache cleared successfully.' });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to clear cache.';
      setCacheResult({ ok: false, message: msg });
    } finally {
      setCacheBusy(false);
    }
  };

  return (
    <SettingsPageShell
      title="System Control"
      description="Administrative operations for session management and server cache. These actions are irreversible — use with caution."
      width="focused"
    >

      {/* Action 1 — Logout all users */}
      <ActionCard
        icon={Users}
        iconBg="bg-rose-100"
        iconColor="text-rose-600"
        title="Force Logout All Users"
        description="Immediately invalidates every active session across the system. All users will be signed out and required to log in again."
        warning="This will sign out every user including yourself. You will need to log in again after this action."
        buttonLabel="Logout All Users"
        buttonClass="bg-rose-600 hover:bg-rose-700"
        busy={logoutBusy}
        result={logoutResult}
        onAction={() => setConfirm('logout-all')}
      />

      {/* Action 2 — Refresh cache */}
      <ActionCard
        icon={Database}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        title="Refresh Server Cache"
        description="Clears the server-side Redis cache. Dashboard metrics, school settings, and other cached data will be reloaded from the database on next access."
        warning="Users may experience slightly slower page loads for a few minutes while the cache rebuilds. No data is deleted."
        buttonLabel="Clear Cache"
        buttonClass="bg-blue-600 hover:bg-blue-700"
        busy={cacheBusy}
        result={cacheResult}
        onAction={() => setConfirm('flush-cache')}
      />

      {/* Confirmation modal */}
      {confirm === 'logout-all' && (
        <ConfirmModal
          title="Force Logout All Users?"
          description="This will immediately invalidate every active session across the system. All users — including you — will be signed out."
          confirmLabel="Yes, Logout Everyone"
          confirmClass="bg-rose-600 hover:bg-rose-700"
          onConfirm={handleLogoutAll}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === 'flush-cache' && (
        <ConfirmModal
          title="Clear Server Cache?"
          description="This will flush all cached data from Redis. Dashboard metrics and school data will reload from the database on next access."
          confirmLabel="Yes, Clear Cache"
          confirmClass="bg-blue-600 hover:bg-blue-700"
          onConfirm={handleFlushCache}
          onCancel={() => setConfirm(null)}
        />
      )}
    </SettingsPageShell>
  );
};

export default SystemControlPage;
