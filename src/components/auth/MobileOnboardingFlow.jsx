import React, { useEffect } from 'react';
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
  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      saveConsent();
      onComplete?.();
    }, 1800);

    return () => {
      window.clearTimeout(preloadTimer);
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

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/splash/new/splash-light.png)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-white/20" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-white via-white/75 to-transparent" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
        <img
          src="/splash/new/TrendsCORE-Logo.png"
          alt="TrendSCORE"
          className="w-full max-w-[15.5rem] object-contain drop-shadow-[0_12px_30px_rgba(255,255,255,0.5)]"
        />
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-full border-4 border-slate-300 border-t-orange-500 animate-spin" />
          <p className="text-sm font-medium text-slate-700">Warming up your workspace...</p>
        </div>
      </div>
    </div>
  );
}

export default MobileOnboardingFlow;
