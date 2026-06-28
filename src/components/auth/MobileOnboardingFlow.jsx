import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import {
  MOBILE_CONSENT_STORAGE_KEY,
  MOBILE_ONBOARDING_POLICY_VERSION,
  MOBILE_ONBOARDING_STORAGE_KEY,
} from '../../utils/mobileOnboardingStorage';

const onboardingScreens = [
  {
    image: '/splash/teachers.png',
    headline: 'Empowering Teachers',
    description:
      'Manage attendance, assessments, lesson delivery and learner progress from a single platform.',
    chips: ['Attendance Tracking', 'CBC Assessment', 'Performance Insights', 'Academic Reporting'],
  },
  {
    image: '/splash/parents.png',
    headline: 'Keeping Parents Connected',
    description:
      'Receive fee updates, academic reports, attendance alerts and school communication instantly.',
    chips: ['Fee Tracking', 'SMS & WhatsApp Updates', 'Report Cards', 'Attendance Notifications'],
  },
  {
    image: '/splash/stakeholders.png',
    headline: 'One Platform. Every Stakeholder.',
    description:
      'Connecting Teachers, Parents, School Leaders, Accountants and Learners through intelligence and data.',
    chips: ['School Leadership', 'Finance Management', 'Communication', 'Learner Success'],
  },
];


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

function PolicyModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="max-h-[86vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">TrendSCORE Policies</h2>
              <p className="text-xs font-semibold text-slate-500">Version {MOBILE_ONBOARDING_POLICY_VERSION}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close policy"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[66vh] space-y-5 overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700">
          <section>
            <h3 className="mb-1 text-sm font-bold text-slate-950">Terms of Use</h3>
            <p>
              TrendSCORE is provided for authorized school operations, including learner records,
              assessments, attendance, communication, reporting and finance workflows.
            </p>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-bold text-slate-950">Privacy Policy</h3>
            <p>
              The platform stores and processes institutional data with safeguards intended to protect
              school, parent, learner and staff information from unauthorized access.
            </p>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-bold text-slate-950">Data Protection Policy</h3>
            <p>
              Data is used to support school administration, analytics, reports, notifications and
              service improvement in line with institutional responsibilities.
            </p>
          </section>
        </div>
        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-brand-purple text-sm font-bold text-white shadow-lg shadow-brand-purple/20 hover:bg-brand-purple/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingContent({ screen }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Background image — top 58% of the available space */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${screen.image})` }}
      />
      {/* Gradient fade from transparent at top to solid white from ~50% down */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent from-35% via-white/80 via-55% to-white to-70%"
      />
      {/* Text content anchored to the bottom of the flex area */}
      <div className="relative z-10 mt-auto px-6 pb-4 pt-2">
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-black leading-tight text-slate-950">{screen.headline}</h1>
          <p className="mx-auto max-w-sm text-sm font-medium leading-6 text-slate-700">
            {screen.description}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {screen.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-orange-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-orange-600 shadow-sm backdrop-blur"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsentContent({ accepted, setAccepted, onViewPolicy }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500 shadow-sm">
        <ShieldCheck size={32} />
      </div>

      {/* Heading + statement */}
      <div className="mt-5 space-y-2 text-center">
        <h1 className="text-2xl font-black text-slate-950">Before you continue</h1>
        <p className="text-sm font-medium leading-6 text-slate-500">
          TrendSCORE collects and processes school data to power attendance, assessments,
          fees and communication — securely and responsibly.
        </p>
      </div>

      {/* Policy link */}
      <button
        type="button"
        onClick={onViewPolicy}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-purple underline underline-offset-2"
      >
        <FileText size={15} />
        Read our Terms, Privacy &amp; Data Policy
      </button>

      {/* Checkbox */}
      <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm">
        <span className="mt-0.5">
          <Checkbox
            checked={accepted}
            required
            onChange={(e) => setAccepted(e.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-slate-300 focus:ring-orange-400 checked:border-orange-500 checked:bg-orange-500"
          />
        </span>
        <span className="text-sm font-semibold leading-6 text-slate-700">
          I agree to the Terms of Use, Privacy Policy and Data Protection Policy.
        </span>
      </label>
    </div>
  );
}

function MobileOnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const isConsentStep = step === onboardingScreens.length;
  const autoSlideRef = useRef(null);

  const currentScreen = onboardingScreens[step];
  const progressItems = useMemo(() => [...onboardingScreens, { headline: 'Consent' }], []);

  // ── Auto-slide every 3.5 s on onboarding screens only ────────────────
  const startAutoSlide = () => {
    clearInterval(autoSlideRef.current);
    autoSlideRef.current = setInterval(() => {
      setStep((current) => {
        // stop auto-slide once we reach the consent step
        if (current >= onboardingScreens.length - 1) {
          clearInterval(autoSlideRef.current);
          return current + 1;
        }
        return current + 1;
      });
    }, 3500);
  };

  useEffect(() => {
    if (!isConsentStep) {
      startAutoSlide();
    } else {
      clearInterval(autoSlideRef.current);
    }
    return () => clearInterval(autoSlideRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsentStep]);

  // Reset timer on manual navigation
  const goToStep = (next) => {
    setStep(next);
    if (next < onboardingScreens.length) {
      startAutoSlide();
    } else {
      clearInterval(autoSlideRef.current);
    }
  };

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

  const handleSkip = () => {
    clearInterval(autoSlideRef.current);
    saveConsent();
    onComplete?.();
  };

  const handleNext = () => {
    if (!isConsentStep) {
      goToStep(step + 1);
      return;
    }

    if (!accepted) return;
    saveConsent();
    onComplete?.();
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden bg-white text-slate-950">
      <div className="flex h-[100dvh] w-full flex-col bg-white">
        <header
          className="flex shrink-0 items-center justify-between px-5 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          <button
            type="button"
            onClick={() => goToStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-0"
            aria-label="Go back"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/splash/trendscore-compass.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-800">
              TrendSCORE
            </span>
          </div>
          {/* Skip button — only visible on onboarding slides, not the consent step */}
          {!isConsentStep ? (
            <button
              type="button"
              onClick={handleSkip}
              className="flex h-10 items-center justify-center rounded-full px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Skip onboarding"
            >
              Skip
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </header>

        <main className="flex min-h-0 flex-1 flex-col transition-opacity duration-200">
          {isConsentStep ? (
            <ConsentContent
              accepted={accepted}
              setAccepted={setAccepted}
              onViewPolicy={() => setShowPolicy(true)}
            />
          ) : (
            <OnboardingContent screen={currentScreen} />
          )}
        </main>

        <footer
          className="relative z-10 shrink-0 bg-white/95 px-5 pt-4 backdrop-blur"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            {progressItems.map((item, index) => (
              <button
                key={item.headline}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => !isConsentStep && goToStep(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === step ? 'w-8 bg-orange-500' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={isConsentStep && !accepted}
            className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-purple px-5 text-sm font-black text-white shadow-xl shadow-brand-purple/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isConsentStep ? (
              <>
                <Check size={18} />
                Agree & Continue
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </footer>
      </div>

      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </div>
  );
}

export default MobileOnboardingFlow;
