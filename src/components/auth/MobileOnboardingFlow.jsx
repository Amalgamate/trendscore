import React, { useEffect, useState } from 'react';
import {
  MOBILE_CONSENT_STORAGE_KEY,
  MOBILE_ONBOARDING_POLICY_VERSION,
  MOBILE_ONBOARDING_STORAGE_KEY,
} from '../../utils/mobileOnboardingStorage';

function readJsonStorage(key) {
  if (typeof window === 'undefined') return null;

  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function isMobileOnboardingComplete() {
  const onboarding = readJsonStorage(MOBILE_ONBOARDING_STORAGE_KEY);
  const consent = readJsonStorage(MOBILE_CONSENT_STORAGE_KEY);

  return (
    onboarding?.completed === true &&
    consent?.consentAccepted === true &&
    consent?.policyVersion === MOBILE_ONBOARDING_POLICY_VERSION
  );
}

function saveConsent() {
  if (typeof window === 'undefined') return;

  const acceptedAt = new Date().toISOString();
  const consent = {
    policyVersion: MOBILE_ONBOARDING_POLICY_VERSION,
    acceptedAt,
    acceptedByUserId: null,
    consentAccepted: true,
  };

  window.localStorage.setItem(MOBILE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  window.localStorage.setItem(
    MOBILE_ONBOARDING_STORAGE_KEY,
    JSON.stringify({
      completed: true,
      completedAt: acceptedAt,
      policyVersion: MOBILE_ONBOARDING_POLICY_VERSION,
    })
  );
}

function MobileOnboardingFlow({ onComplete }) {
  const [phase, setPhase] = useState('preload');

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => setPhase('splash'), 950);
    const splashTimer = window.setTimeout(() => {
      saveConsent();
      onComplete?.();
    }, 2800);

    return () => {
      window.clearTimeout(preloadTimer);
      window.clearTimeout(splashTimer);
    };
  }, [onComplete]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    const createdThemeMeta = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    const previousThemeColor = meta?.getAttribute('content');
    const previousBodyBackground = document.body.style.backgroundColor;

    if (meta) {
      meta.setAttribute('content', '#ffffff');
    }
    document.body.style.backgroundColor = '#ffffff';

    return () => {
      if (meta && previousThemeColor) {
        meta.setAttribute('content', previousThemeColor);
      } else if (meta && createdThemeMeta) {
        meta.remove();
      }
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, []);

  const handleContinue = () => {
    saveConsent();
    onComplete?.();
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/splash/new/splash-light.png)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-white/10" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
        <img
          src="/splash/new/TrendsCORE-Logo.png"
          alt="TrendSCORE"
          className="w-full max-w-[15.5rem] object-contain drop-shadow-[0_12px_30px_rgba(255,255,255,0.5)]"
        />
        {phase === 'preload' ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="h-9 w-9 rounded-full border-4 border-white/40 border-t-orange-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Preparing your pathway</p>
          </div>
        ) : (
          <div className="mt-10 space-y-3">
            <h1 className="text-[2rem] font-black leading-none text-[#06285a]">Welcome!</h1>
            <p className="text-base font-semibold text-slate-700">Let's get you started</p>
          </div>
        )}
      </div>
      {phase === 'splash' && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          <button
            type="button"
            onClick={handleContinue}
            className="mx-auto flex h-12 w-full max-w-[18rem] items-center justify-center rounded bg-orange-500 text-sm font-black text-white shadow-xl shadow-orange-500/25 active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

export default MobileOnboardingFlow;
