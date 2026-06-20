import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileText,
  Lock,
  MessageSquare,
  ShieldCheck,
  X,
} from 'lucide-react';
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

const policyCards = [
  {
    title: 'Privacy',
    body: 'We protect school, parent, teacher and learner information using industry-standard safeguards.',
    icon: ShieldCheck,
  },
  {
    title: 'Data Usage',
    body: 'Data may be used to generate reports, analytics and educational insights.',
    icon: Database,
  },
  {
    title: 'Communication Consent',
    body: 'Schools may send SMS, WhatsApp, Email and system notifications through TrendSCORE.',
    icon: MessageSquare,
  },
  {
    title: 'Security',
    body: 'TrendSCORE implements measures to prevent unauthorized access and protect institutional data.',
    icon: Lock,
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
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-5 pt-3">
      <div className="flex min-h-[260px] flex-1 items-center justify-center">
        <img
          src={screen.image}
          alt=""
          className="h-full max-h-[40dvh] w-full max-w-sm object-contain"
          draggable="false"
        />
      </div>
      <div className="space-y-4">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-black leading-tight text-slate-950">{screen.headline}</h1>
          <p className="mx-auto max-w-sm text-sm font-medium leading-6 text-slate-600">
            {screen.description}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {screen.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-brand-purple/10 bg-brand-purple/5 px-3 py-1.5 text-xs font-bold text-brand-purple"
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
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <img src="/splash/trendscore-logo.png" alt="TrendSCORE" className="h-16 w-16 object-contain" />
        <div className="mt-5 space-y-3">
          <h1 className="text-3xl font-black text-slate-950">Your Data Matters</h1>
          <div className="space-y-2 text-sm font-medium leading-6 text-slate-600">
            <p>
              TrendSCORE helps schools manage learner, assessment, attendance, communication and
              finance records securely.
            </p>
            <p>
              Before continuing, please review and accept the Terms of Use, Privacy Policy and Data
              Protection Policy.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-md grid-cols-1 gap-3">
        {policyCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Icon size={19} />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black text-slate-950">{title}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-600">{body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-5 max-w-md rounded-2xl border border-brand-purple/15 bg-brand-purple/5 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-left">
          <input
            type="checkbox"
            checked={accepted}
            required
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-purple accent-brand-purple focus:ring-brand-purple"
          />
          <span className="text-sm font-bold leading-6 text-slate-800">
            I have read and agree to the Terms of Use, Privacy Policy and Data Protection Policy.
          </span>
        </label>
        <button
          type="button"
          onClick={onViewPolicy}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-brand-purple"
        >
          <FileText size={16} />
          View Full Policy
        </button>
      </div>
    </div>
  );
}

function MobileOnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const isConsentStep = step === onboardingScreens.length;

  const currentScreen = onboardingScreens[step];
  const progressItems = useMemo(() => [...onboardingScreens, { headline: 'Consent' }], []);

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

  const handleNext = () => {
    if (!isConsentStep) {
      setStep((current) => current + 1);
      return;
    }

    if (!accepted) return;
    saveConsent();
    onComplete?.();
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden bg-white text-slate-950">
      <div className="flex min-h-[100dvh] w-full flex-col bg-white">
        <header
          className="flex shrink-0 items-center justify-between px-5 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
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
          <div className="h-10 w-10" />
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
          className="shrink-0 border-t border-slate-100 bg-white px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            {progressItems.map((item, index) => (
              <span
                key={item.headline}
                className={`h-2 rounded-full transition-all duration-200 ${
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
