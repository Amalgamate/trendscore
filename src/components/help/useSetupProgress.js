import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../services/api/dashboard.api';
import { makeHelpProgressKey, readHelpProgress, writeHelpProgress } from './helpProgress';
import { ONBOARDING_VERSION } from './roleOnboardingJourneys';

export const SETUP_PROGRESS_EVENT = 'trendscore:setup-progress-changed';

export function useSetupProgress(journey, user, currentPage) {
  const userId = user?.id || user?.userId;
  const storageKey = journey ? makeHelpProgressKey('onboarding', ONBOARDING_VERSION, userId, journey.id) : '';
  const [localProgress, setLocalProgress] = useState({ seen: false, steps: {} });
  const [serverStages, setServerStages] = useState({});
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    const saved = readHelpProgress(localStorage, storageKey);
    setLocalProgress({ seen: Boolean(saved.seen), steps: saved.steps || {} });
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (!journey || !userId) return;
    setChecking(true);
    try {
      const result = await dashboardAPI.getSetupStatus();
      setServerStages(result?.data?.stages || {});
    } catch {
      // Keep locally recorded progress when the status check is temporarily unavailable.
    } finally {
      setChecking(false);
    }
  }, [journey, userId]);

  useEffect(() => { refresh(); }, [refresh, currentPage]);
  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  const steps = useMemo(() => Object.fromEntries((journey?.steps || []).map((step, index) => [
    index,
    Boolean(serverStages[step.key] || localProgress.steps[index]),
  ])), [journey, localProgress.steps, serverStages]);

  const total = journey?.steps?.length || 0;
  const completed = Object.values(steps).filter(Boolean).length;
  const complete = total > 0 && completed === total;

  const saveLocal = useCallback((next) => {
    setLocalProgress(next);
    if (storageKey) writeHelpProgress(localStorage, storageKey, next);
    window.dispatchEvent(new CustomEvent(SETUP_PROGRESS_EVENT, { detail: { journeyId: journey?.id } }));
  }, [journey?.id, storageKey]);

  const markSeen = useCallback(() => saveLocal({ ...localProgress, seen: true }), [localProgress, saveLocal]);
  const setStepComplete = useCallback((index, done) => {
    if (serverStages[journey?.steps?.[index]?.key]) return;
    saveLocal({ ...localProgress, seen: true, steps: { ...localProgress.steps, [index]: done } });
  }, [journey?.steps, localProgress, saveLocal, serverStages]);

  return {
    steps,
    completed,
    total,
    complete,
    seen: localProgress.seen,
    isFresh: !localProgress.seen && !complete,
    checking,
    serverStages,
    markSeen,
    setStepComplete,
    refresh,
  };
}
