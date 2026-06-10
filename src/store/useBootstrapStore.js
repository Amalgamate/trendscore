/**
 * useBootstrapStore
 *
 * Holds the data pre-loaded during the splash screen so every page gets it
 * instantly instead of waiting for an in-page fetch.
 *
 * What is pre-loaded (all in parallel during splash):
 *   - learners   (active students, limit 200)
 *   - teachers
 *   - classes + streams (school config)
 *   - subjects  (learning areas)
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
       * Called once by the splash screen. Runs all five fetches in parallel.
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
        const { loadedAt, loading, ready } = get();

        if (loading) return;   // already in progress

        // Data is fresh enough — nothing to do
        if (ready && loadedAt && Date.now() - loadedAt < STALE_AFTER_MS) return;

        set({ loading: true, error: null });

        try {
          // Keep startup fast: wait only for core datasets required by the shell.
          // Heavy fee stats hydrate asynchronously after the app becomes ready.
          const results = await Promise.allSettled([
            apiFns.fetchLearners(),
            apiFns.fetchTeachers(),
            apiFns.fetchClasses(),
            apiFns.fetchStreams(),
            apiFns.fetchSubjects(),
          ]);

          const val = (r, fallback = []) =>
            r.status === 'fulfilled' ? r.value : fallback;

          set({
            learners:  val(results[0]),
            teachers:  val(results[1]),
            classes:   val(results[2]),
            streams:   val(results[3]),
            subjects:  val(results[4]),
            loadedAt:  Date.now(),
            loading:   false,
            ready:     true,
            error:     null,
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
