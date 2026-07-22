/**
 * ImpersonationContext
 *
 * Manages the admin user impersonation session lifecycle:
 *   - startImpersonation(targetUserId): issues a real JWT swap into the target
 *     user's session and persists the original admin session to localStorage.
 *   - stopImpersonation(): revokes the impersonation token server-side and
 *     restores the original admin session from localStorage.
 *   - Mount hydration: on page refresh, restores isImpersonating = true if
 *     both localStorage keys are present and AuthContext has resolved.
 *   - Token-expiry recovery: if a 401/TOKEN_EXPIRED arrives mid-session, the
 *     original admin session is restored locally without calling the stop API.
 *
 * Requirements: 3.10–3.13, 5.1, 5.5–5.8, 8.7, 10.1–10.4
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AuthContext } from './AuthContext';
import { impersonationApi } from '../services/api/impersonation.api';
import axiosInstance from '../services/api/axiosConfig';
import { getAuthItem } from '../utils/authStorage';

// ─── localStorage key constants ───────────────────────────────────────────────
const LS_ORIGINAL_TOKEN = 'trendscore_impersonation_original_token';
const LS_ORIGINAL_USER  = 'trendscore_impersonation_original_user';

// ─── Context definition ────────────────────────────────────────────────────────
const ImpersonationContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ImpersonationProvider({ children }) {
  const auth = useContext(AuthContext);

  const [isImpersonating, setIsImpersonating]   = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState(null);

  // Track whether we've already hydrated on mount to avoid double-runs.
  const hydratedRef = useRef(false);

  // ── Toast helper (graceful — works without a toast library) ──────────────
  const showToast = useCallback((message) => {
    try {
      // Use the project's notification system if it exposes a global event bus
      // or just log to console as a fallback — the banner is the primary UX signal.
      console.info('[Impersonation]', message);
      // Attempt to dispatch a custom event that any global toast listener can pick up
      window.dispatchEvent(
        new CustomEvent('trendscore:toast', { detail: { message, type: 'info' } })
      );
    } catch {
      // Silent fail
    }
  }, []);

  // ── Restore original admin session from localStorage ─────────────────────
  const restoreOriginalSession = useCallback(() => {
    try {
      const originalToken = localStorage.getItem(LS_ORIGINAL_TOKEN);
      const originalUserRaw = localStorage.getItem(LS_ORIGINAL_USER);
      if (!originalToken || !originalUserRaw) return false;

      const originalUser = JSON.parse(originalUserRaw);
      auth.login(originalUser, originalToken);

      // Remove all impersonation localStorage keys (Req 5.6)
      Object.keys(localStorage)
        .filter((k) => k.startsWith('trendscore_impersonation_'))
        .forEach((k) => localStorage.removeItem(k));

      setIsImpersonating(false);
      setImpersonatedUser(null);
      return true;
    } catch {
      return false;
    }
  }, [auth]);

  // ── Mount hydration (Task 7.2 / Req 10.1–10.4) ───────────────────────────
  useEffect(() => {
    // Wait until AuthContext has resolved before hydrating (Req 10.4)
    if (auth.loading) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const originalToken   = localStorage.getItem(LS_ORIGINAL_TOKEN);
      const originalUserRaw = localStorage.getItem(LS_ORIGINAL_USER);

      if (
        originalToken &&
        originalToken.trim() !== '' &&
        originalUserRaw &&
        originalUserRaw.trim() !== '' &&
        auth.user
      ) {
        // Both keys present, parseable, and AuthContext has a user → we are
        // inside an active impersonation session (Req 10.2).
        JSON.parse(originalUserRaw); // validate JSON — throws if corrupt (Req 10.3)

        const currentUser = auth.user;
        setIsImpersonating(true);
        setImpersonatedUser({
          id:    currentUser.id   ?? currentUser.userId ?? '',
          name:  currentUser.name
                   ?? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
                   ?? '—',
          email: currentUser.email ?? '—',
          role:  currentUser.role  ?? '—',
        });
      }
      // else: missing/corrupt keys or no user → isImpersonating stays false (Req 10.3)
    } catch {
      // Corrupt localStorage data → treat as no session (Req 10.3)
      setIsImpersonating(false);
      setImpersonatedUser(null);
    }
  }, [auth.loading, auth.user]); // re-runs once loading flips to false

  // ── Axios interceptor: handle TOKEN_EXPIRED mid-session (Req 8.7) ─────────
  useEffect(() => {
    const interceptorId = axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const code   = error?.response?.data?.code;

        if (status === 401 && code === 'TOKEN_EXPIRED' && isImpersonating) {
          // Token expired during impersonation — restore original session locally
          // WITHOUT calling the stop API (token is already expired).
          restoreOriginalSession();
          showToast('Impersonation session expired. Returned to your account.');
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.response.eject(interceptorId);
    };
  }, [isImpersonating, restoreOriginalSession, showToast]);

  // ── startImpersonation (Task 7.1 / Req 3.10–3.13) ────────────────────────
  const startImpersonation = useCallback(async (targetUserId) => {
    setIsLoading(true);
    setError(null);

    // Capture original admin token and user BEFORE any changes (Req 3.10)
    const originalToken = getAuthItem('token') ?? '';
    const originalUser  = auth.user;

    // Persist original session to localStorage (Req 3.10)
    try {
      localStorage.setItem(LS_ORIGINAL_TOKEN, originalToken);
      localStorage.setItem(LS_ORIGINAL_USER, JSON.stringify(originalUser));
    } catch (storageErr) {
      setError('Failed to save session — localStorage may be full or disabled.');
      setIsLoading(false);
      return false;
    }

    try {
      const result = await impersonationApi.startSession(targetUserId);

      // Switch AuthContext to the impersonated user (Req 3.11)
      // Pass null as refreshToken — impersonation sessions have no refresh token (Req 8.2)
      auth.login(result.impersonatedUser, result.accessToken, null);

      // Update impersonation state (Req 3.12)
      setIsImpersonating(true);
      setImpersonatedUser({
        id:    result.impersonatedUser.id,
        name:  result.impersonatedUser.name,
        email: result.impersonatedUser.email,
        role:  result.impersonatedUser.role,
      });
      return true;
    } catch (err) {
      // Rollback: remove localStorage keys so there's no orphaned state (Req 3.13)
      localStorage.removeItem(LS_ORIGINAL_TOKEN);
      localStorage.removeItem(LS_ORIGINAL_USER);

      const message = err?.response?.data?.error
        ?? err?.response?.data?.message
        ?? err?.message
        ?? 'Failed to start impersonation session.';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  // ── stopImpersonation (Task 7.1 / Req 5.1, 5.5–5.8) ─────────────────────
  const stopImpersonation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Guard: if original token is missing, force full logout (Req 5.8)
    const originalToken = localStorage.getItem(LS_ORIGINAL_TOKEN);
    if (!originalToken) {
      auth.logout();
      setIsImpersonating(false);
      setImpersonatedUser(null);
      setIsLoading(false);
      return;
    }

    try {
      await impersonationApi.stopSession();
      // Restore original admin session (Req 5.5)
      restoreOriginalSession();
    } catch (err) {
      // In local dev the stop/CSRF request can fail while the saved admin
      // session is still valid. Restore locally so the user is not trapped.
      if (restoreOriginalSession()) {
        showToast('Returned to your account. The server could not confirm impersonation cleanup.');
        return;
      }

      // On failure without a recoverable admin session: re-enable exit control.
      const message = err?.response?.data?.error
        ?? err?.response?.data?.message
        ?? err?.message
        ?? 'Failed to end impersonation session. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [auth, restoreOriginalSession, showToast]);

  const value = {
    isImpersonating,
    impersonatedUser,
    isLoading,
    error,
    startImpersonation,
    stopImpersonation,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) {
    throw new Error('useImpersonation must be used within an <ImpersonationProvider>');
  }
  return ctx;
}

export { ImpersonationContext };
export default ImpersonationContext;
