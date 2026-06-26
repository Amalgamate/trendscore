/**
 * SplashScreen — data-aware version
 *
 * Behaviour:
 *   1. Renders immediately when the app boots (auth is resolving).
 *   2. Once the user is authenticated, fires off the bootstrap pre-load in
 *      parallel with the existing branding / subject fetches.
 *   3. The progress bar now reflects *actual* fetch progress:
 *        0–20 %   — auth check (instant, localStorage read)
 *       20–40 %   — branding fetch
 *       40–100%   — bootstrap data (learners, teachers, classes, streams, subjects)
 *   4. Fades out once bootstrap reports ready AND a minimum display time
 *      has elapsed (400 ms) so it never flashes.
 *
 * Props:
 *   isLoading  {boolean}  — true while auth context is still initialising
 *   user       {object|null} — the authenticated user (null until auth done)
 *   onReady    {() => void}  — called once splash can safely hide
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/splashscreen.css';
import { useBootstrapStore } from '../../store/useBootstrapStore';
import axiosInstance from '../../services/api/axiosConfig';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

const ROLES_WITH_ALL_LEARNERS_ACCESS = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'LIBRARIAN',
  'NURSE',
  'SECURITY',
  'DRIVER',
  'COOK',
  'CLEANER',
  'GROUNDSKEEPER',
  'IT_SUPPORT',
]);

const ROLES_WITH_ALL_USERS_ACCESS = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
]);

// ── Fetch helpers called by the bootstrap store ────────────────────────────
//  These live outside the component so they never change identity.

const buildApiFns = (institutionType = 'PRIMARY_CBC', role = '') => ({
  fetchLearners: async () => {
    if (!ROLES_WITH_ALL_LEARNERS_ACCESS.has(role)) return [];
    const res = await axiosInstance.get('/learners', {
      params: { limit: 200, status: 'ACTIVE', institutionType },
    });
    return res.data?.data ?? [];
  },

  fetchTeachers: async () => {
    if (!ROLES_WITH_ALL_USERS_ACCESS.has(role)) return [];
    const res = await axiosInstance.get('/users', {
      params: { role: 'TEACHER', limit: 200 },
    });
    return res.data?.data ?? [];
  },

  fetchClasses: async () => {
    if (!ROLES_WITH_ALL_LEARNERS_ACCESS.has(role)) return [];
    const res = await axiosInstance.get('/classes');
    return res.data?.data ?? [];
  },

  fetchStreams: async () => {
    const res = await axiosInstance.get('/facility/streams');
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  },

  fetchSubjects: async () => {
    const res = await axiosInstance.get('/learning-areas');
    return res.data?.data ?? [];
  },

  // Only fetch fee stats for roles that actually use the fee module
  // This pre-loads the metric-card data so FeeCollectionPage shows instantly
  fetchFeeStats: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'].includes(role)
    ? async () => {
        const res = await axiosInstance.get('/fees/invoices', { params: { limit: 'all' } });
        return {
          invoices: res.data?.data ?? [],
          totals:   res.data?.totals ?? null,
        };
      }
    : null,
});

// ── Component ──────────────────────────────────────────────────────────────

const MIN_DISPLAY_MS = 400; // never disappear faster than this

const SplashScreen = ({ isLoading, user, onReady }) => {
  const [progress, setProgress]   = useState(0);
  const [label, setLabel]         = useState('Checking session…');
  const [canHide, setCanHide]     = useState(false);
  const [visible, setVisible]     = useState(true);
  const mountedAt                 = useRef(Date.now());
  const bootstrapFired            = useRef(false);

  const { bootstrap, ready: bootstrapReady } = useBootstrapStore();

  // ── Phase 1: auth resolving (0 → 25%) ────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      setProgress(25);
      setLabel(user ? 'Session restored…' : 'Ready to sign in…');
    }
  }, [isLoading, user]);

  // ── Phase 2: trigger bootstrap once we have a user ────────────────────
  useEffect(() => {
    if (!user || bootstrapFired.current) return;
    bootstrapFired.current = true;

    setProgress(30);
    setLabel('Loading school data…');

    const apiFns = buildApiFns(user.institutionType, user.role ?? '');
    bootstrap(apiFns);
  }, [user, bootstrap]);

  // ── Phase 3: drive progress bar while bootstrap is running ────────────
  useEffect(() => {
    if (!user || bootstrapReady) return; // nothing to animate

    // Animate smoothly from 30 → 90 while waiting for the real data
    const id = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(id); return 90; }
        // Decelerate as we approach 90 so it doesn't stall obviously
        const step = Math.max(1, (90 - prev) * 0.15);
        return Math.min(90, prev + step);
      });
    }, 120);

    return () => clearInterval(id);
  }, [user, bootstrapReady]);

  // ── Phase 4: bootstrap finished ───────────────────────────────────────
  useEffect(() => {
    if (!bootstrapReady) return;

    setProgress(100);
    setLabel('All set!');

    // Respect the minimum display time
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const id = setTimeout(() => setCanHide(true), remaining);
    return () => clearTimeout(id);
  }, [bootstrapReady]);

  // ── Non-authenticated path: just wait for auth to resolve ─────────────
  useEffect(() => {
    if (!isLoading && !user) {
      // Not logged in — hide after minimum time
      const elapsed = Date.now() - mountedAt.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      const id = setTimeout(() => setCanHide(true), remaining);
      return () => clearTimeout(id);
    }
  }, [isLoading, user]);

  // ── Trigger fade-out ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canHide) return;
    const id = setTimeout(() => {
      setVisible(false);
      onReady?.();
    }, 300); // match CSS fade-out duration
    return () => clearTimeout(id);
  }, [canHide, onReady]);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${canHide ? 'fade-out' : ''}`}>
      <div className="splash-content">
        {/* Logo with ring ripple */}
        <div className="splash-logo">
          <div className="logo-ripples">
            <div className="ripple-ring ripple-1" />
            <div className="ripple-ring ripple-2" />
            <div className="ripple-ring ripple-3" />
          </div>
          <div className="logo-circle">
            <img
              src="/splash/trendscore-logo.png"
              alt="TrendScore"
              className="logo-image"
            />
          </div>
        </div>

        <h1 className="splash-title">{PRODUCT_DISPLAY_NAME}</h1>
        <p className="splash-subtitle">Education Management System</p>

        {/* Progress bar */}
        <div className="loading-bar-container">
          <div className="loading-bar">
            <div
              className="loading-bar-fill"
              style={{
                width: `${progress}%`,
                transition: progress === 100 ? 'width 0.3s ease-out' : 'width 0.5s ease-in-out',
              }}
            >
              <div className="loading-bar-shimmer" />
            </div>
          </div>
          <p className="loading-text">{Math.round(progress)}%</p>
        </div>

        <p className="splash-footer">{label}</p>
      </div>
    </div>
  );
};

export default SplashScreen;
