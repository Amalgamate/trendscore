/**
 * useBootstrapStore
 *
 * Holds the data pre-loaded during the splash screen so every page gets it
 * instantly instead of waiting for an in-page fetch.
 *
 * What is pre-loaded during splash:
 *   - classes + streams (school config)
 *   - subjects  (learning areas)
 * Learners, teachers, and fee stats hydrate after the shell is ready so large
 * imports cannot keep the app stuck on the splash screen.
 *
 * Persistence: sessionStorage — survives F5 within the same tab, cleared on
 * tab close or logout. A `loadedAt` timestamp lets consumers detect stale
 * data (> 5 min) and trigger a background re-fetch.
 *
 * Usage anywhere in the app:
 *   const { learners, teachers, ready } = useBootstrapStore();
 *   // `ready` is true once the first pre-load completed this session
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const CORE_BOOTSTRAP_TIMEOUT_MS = 6000;
const BACKGROUND_BOOTSTRAP_TIMEOUT_MS = 15000;

const loadWithTimeout = (loader, fallback = [], timeoutMs = CORE_BOOTSTRAP_TIMEOUT_MS) => {
  let timeoutId;
  const load = Promise.resolve()
    .then(loader)
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error, value: fallback }));

  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ ok: false, timedOut: true, value: fallback });
    }, timeoutMs);
  });

  return Promise.race([load, timeout]).finally(() => clearTimeout(timeoutId));
};

export const useBootstrapStore = create(
  persist(
    (set, get) => ({
      // ── Data slices ──────────────────────────────────────────────────────
      learners:  null,   // null = never loaded; [] = loaded (possibly empty)
      teachers:  null,
      classes:   null,
      streams:   null,
      subjects:  null,
      feeStats:  null,   // lightweight fee totals { totalBilled, totalPaid, totalBalance, totalWaived, totalOverpaid, count }

      // ── Meta ─────────────────────────────────────────────────────────────
      loadedAt:  null,
      loading:   false,
      error:     null,
      ready:     false,  // true after the first successful bootstrap

      // ── Actions ──────────────────────────────────────────────────────────

      /**
       * bootstrap(apiFns)
       * Called once by the splash screen. Loads lightweight shell config first,
       * then hydrates heavier datasets in the background.
       *
       * apiFns: {
       *   fetchLearners:  () => Promise<learner[]>
       *   fetchTeachers:  () => Promise<teacher[]>
       *   fetchClasses:   () => Promise<class[]>
       *   fetchStreams:   () => Promise<stream[]>
       *   fetchSubjects:  () => Promise<subject[]>
       * }
       */
      bootstrap: async (apiFns) => {
        const { loadedAt, loading, ready, classes, streams, subjects } = get();

        if (loading) return;   // already in progress

        // Data is fresh enough — nothing to do
        if (
          ready &&
          classes !== null &&
          streams !== null &&
          subjects !== null &&
          loadedAt &&
          Date.now() - loadedAt < STALE_AFTER_MS
        ) {
          return;
        }

        set({ loading: true, error: null });

        try {
          const coreResults = await Promise.all([
            loadWithTimeout(apiFns.fetchClasses),
            loadWithTimeout(apiFns.fetchStreams),
            loadWithTimeout(apiFns.fetchSubjects),
          ]);

          const val = (r, fallback = []) => (r.ok ? r.value : fallback);

          set({
            classes:   val(coreResults[0]),
            streams:   val(coreResults[1]),
            subjects:  val(coreResults[2]),
            loadedAt:  Date.now(),
            loading:   false,
            ready:     true,
            error:     null,
          });

          Promise.all([
            loadWithTimeout(apiFns.fetchLearners, [], BACKGROUND_BOOTSTRAP_TIMEOUT_MS),
            loadWithTimeout(apiFns.fetchTeachers, [], BACKGROUND_BOOTSTRAP_TIMEOUT_MS),
          ]).then(([learnersResult, teachersResult]) => {
            const updates = {};
            if (learnersResult.ok) updates.learners = learnersResult.value;
            if (teachersResult.ok) updates.teachers = teachersResult.value;
            if (Object.keys(updates).length > 0) {
              updates.loadedAt = Date.now();
              set(updates);
            }
          });

          if (apiFns.fetchFeeStats) {
            apiFns.fetchFeeStats()
              .then((feeStats) => {
                set({ feeStats: feeStats ?? null });
              })
              .catch(() => {
                // Non-blocking by design: missing feeStats must never delay startup.
              });
          }
        } catch (err) {
          // Partial failure — still mark ready so the app doesn't hang
          set({ loading: false, error: err.message, ready: true });
        }
      },

      /** Re-fetch just the learners slice (e.g. after admission/delete) */
      refreshLearners: async (fetchFn) => {
        try {
          const data = await fetchFn();
          set({ learners: data, loadedAt: Date.now() });
        } catch { /* best-effort, non-blocking */ }
      },

      /** Re-fetch just the teachers slice */
      refreshTeachers: async (fetchFn) => {
        try {
          const data = await fetchFn();
          set({ teachers: data, loadedAt: Date.now() });
        } catch { /* best-effort */ }
      },

      /** Wipe everything — called on logout */
      clear: () => set({
        learners:  null,
        teachers:  null,
        classes:   null,
        streams:   null,
        subjects:  null,
        feeStats:  null,
        loadedAt:  null,
        loading:   false,
        error:     null,
        ready:     false,
      }),
    }),
    {
      name: 'trendscore_bootstrap',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        learners:  s.learners,
        teachers:  s.teachers,
        classes:   s.classes,
        streams:   s.streams,
        subjects:  s.subjects,
        feeStats:  s.feeStats,
        loadedAt:  s.loadedAt,
        ready:     s.ready,
      }),
    }
  )
);
