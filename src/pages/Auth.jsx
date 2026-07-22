import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '../components/common/PageTransition';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';
import EmailVerificationForm from '../components/auth/EmailVerificationForm';
import WelcomeScreen from '../components/auth/WelcomeScreen';
import InstitutionSetupWizard from '../components/auth/InstitutionSetupWizard';
import MobileOnboardingFlow, { isMobileOnboardingComplete } from '../components/auth/MobileOnboardingFlow';
import { useMobile } from '../hooks/useMobileDetection';

const AUTH_VIEWS = ['login', 'register', 'forgot-password', 'reset-password', 'verify-email', 'welcome', 'setup-institution'];
const FULL_VIEWS = ['login', 'register', 'verify-email', 'welcome', 'forgot-password', 'setup-institution'];

function showBlobBackground(view) {
  return !FULL_VIEWS.includes(view);
}

function Auth({ onAuthSuccess, brandingSettings, basePath = '/auth' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const pathname = location.pathname;
  const state = location.state || {};

  const view = useMemo(() => {
    const base = basePath.replace(/\/$/, '');
    const suf = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : '/';
    const seg = suf.split('/').filter(Boolean)[0] || 'login';
    if (AUTH_VIEWS.includes(seg)) return seg;
    return 'login';
  }, [pathname, basePath]);

  const userData = state.userData || null;
  const [showMobileOnboarding, setShowMobileOnboarding] = useState(() => !isMobileOnboardingComplete());

  useEffect(() => {
    if (view !== 'login' || !isMobile) {
      setShowMobileOnboarding(false);
      return;
    }

    setShowMobileOnboarding(!isMobileOnboardingComplete());
  }, [isMobile, view]);

  const toLogin = () => navigate(`${basePath}/login`);
  const toRegister = () => navigate(`${basePath}/register`);
  const toForgotPassword = () => navigate(`${basePath}/forgot-password`);

  const handleLoginSuccess = (userData, token, refreshToken, options) => {
    onAuthSuccess(userData, token, refreshToken, options);
  };

  const handleRegisterSuccess = (user) => {
    navigate(`${basePath}/verify-email`, { state: { userData: user }, replace: true });
  };

  const mapVerifiedUserToLogin = (user) => {
    const roles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [user?.role];
    return {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      roles,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      institutionType: user.institutionType || 'PRIMARY_CBC',
      schoolId: user.schoolId || null,
      institutionTypeLocked: user.institutionTypeLocked === true,
      requiresInstitutionSetup: user.requiresInstitutionSetup === true,
      school: user.school || null,
    };
  };

  const handleVerifySuccess = (verificationResponse) => {
    if (verificationResponse?.token && verificationResponse?.user) {
      const { token, refreshToken, user } = verificationResponse;
      onAuthSuccess(mapVerifiedUserToLogin(user), token, refreshToken);
      return;
    }

    if (!userData) {
      toLogin();
      return;
    }
    navigate(`${basePath}/welcome`, { state: { userData }, replace: true });
  };

  const handleResetSuccess = () => {
    navigate(`${basePath}/login`, { replace: true });
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50';
    toast.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Password reset successful! Please sign in.</span>';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleGetStarted = () => {
    toLogin();
  };

  if ((view === 'verify-email' || view === 'welcome') && !userData) {
    toLogin();
    return null;
  }

  const isMobileOnboardingActive = view === 'login' && isMobile && showMobileOnboarding;
  const layoutClass = showBlobBackground(view) ? 'bg-brand-purple/5 flex items-center justify-center p-4' : '';
  const contentClass = isMobileOnboardingActive
    ? 'w-full min-h-[100dvh]'
    : FULL_VIEWS.includes(view)
      ? 'w-full h-screen'
      : 'relative z-10 w-full flex items-center justify-center';

  return (
    <div className={`min-h-screen ${layoutClass}`}>
      {showBlobBackground(view) && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-purple rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob" />
          <div className="absolute top-40 right-10 w-72 h-72 bg-brand-teal rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-brand-purple rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000" />
        </div>
      )}
      <div className={contentClass}>
        <AnimatePresence mode="wait">
          {isMobileOnboardingActive && (
            <PageTransition key="onboarding">
              <MobileOnboardingFlow onComplete={() => setShowMobileOnboarding(false)} />
            </PageTransition>
          )}
          {view === 'login' && !isMobileOnboardingActive && (
            <PageTransition key="login">
              <LoginForm
                onSwitchToRegister={toRegister}
                onSwitchToForgotPassword={toForgotPassword}
                onLoginSuccess={handleLoginSuccess}
                brandingSettings={brandingSettings}
              />
            </PageTransition>
          )}
          {view === 'register' && (
            <PageTransition key="register">
              <RegisterForm
                onSwitchToLogin={toLogin}
                onRegisterSuccess={handleRegisterSuccess}
                brandingSettings={brandingSettings}
              />
            </PageTransition>
          )}
          {view === 'forgot-password' && (
            <PageTransition key="forgot-password">
              <ForgotPasswordForm onSwitchToLogin={toLogin} brandingSettings={brandingSettings} />
            </PageTransition>
          )}
          {view === 'reset-password' && (
            <PageTransition key="reset-password">
              <ResetPasswordForm onResetSuccess={handleResetSuccess} />
            </PageTransition>
          )}
          {view === 'verify-email' && (
            <PageTransition key="verify-email">
              <EmailVerificationForm
                email={userData?.email}
                phone={userData?.phone}
                onVerifySuccess={handleVerifySuccess}
                brandingSettings={brandingSettings}
              />
            </PageTransition>
          )}
          {view === 'welcome' && (
            <PageTransition key="welcome">
              <WelcomeScreen
                user={userData}
                onGetStarted={handleGetStarted}
                brandingSettings={brandingSettings}
              />
            </PageTransition>
          )}
          {view === 'setup-institution' && (
            <PageTransition key="setup-institution">
              <InstitutionSetupWizard
                onComplete={() => navigate('/app', { replace: true })}
                brandingSettings={brandingSettings}
              />
            </PageTransition>
          )}
        </AnimatePresence>
      </div>
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}

export default Auth;
