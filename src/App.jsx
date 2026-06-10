import React, { useState, useEffect, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

const Auth = lazy(() => import('./pages/Auth'));
const CBCGradingSystem = lazy(() => import('./components/CBCGrading/CBCGradingSystem'));
import SplashScreen from './components/common/SplashScreen';
import { Toaster } from 'react-hot-toast';
import { SchoolDataProvider } from './contexts/SchoolDataContext';
import { FeeActionsProvider } from './contexts/FeeActionsContext';
import { UserNotificationProvider } from './contexts/UserNotificationContext';
import { ChatProvider } from './contexts/ChatContext';
import { RolePreviewProvider } from './contexts/RolePreviewContext';
import axiosInstance from './services/api/axiosConfig';
import { useBootstrapStore } from './store/useBootstrapStore';

import useSubjectStore from './store/useSubjectStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LEGACY_BRAND_NAMES, PRODUCT_DISPLAY_NAME } from './config/productIdentity';

// ── SW update banner ─────────────────────────────────────────────────────────
function SWUpdateBanner() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <span>A new version is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
      >
        Refresh
      </button>
      <button onClick={() => setShow(false)} className="opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

const APP_DISPLAY_NAME = PRODUCT_DISPLAY_NAME;

const normalizeSchoolName = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return APP_DISPLAY_NAME;
  const lower = trimmed.toLowerCase();
  if (LEGACY_BRAND_NAMES.has(lower)) return APP_DISPLAY_NAME;
  return trimmed;
};

const pickBrandingValue = (incoming, fallback) => {
  if (incoming === null || incoming === undefined) return fallback;
  if (typeof incoming === 'string' && incoming.trim() === '') return fallback;
  return incoming;
};

const DEFAULT_BRANDING = {
  logoUrl: '/branding/logo.png',
  faviconUrl: '/branding/favicon.png',
  pwaLogoUrl: '/logo512.png',
  stampUrl: '/branding/stamp.svg',
  primaryColor: '#030b82',
  secondaryColor: '#0D9488',
  accentColor1: '#3b82f6',
  accentColor2: '#e11d48',
  welcomeTitle: `Welcome to ${APP_DISPLAY_NAME}`,
  welcomeMessage: 'Sign in to access your school portal.',
  schoolName: APP_DISPLAY_NAME,
  motto: 'School Management System',
};

function AppContent() {
  const { isAuthenticated, user, loading, login, logout } = useAuth();
  const fetchSubjects = useSubjectStore(state => state.fetchSubjects);
  const clearBootstrap = useBootstrapStore(state => state.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // splashDone: true once the splash screen calls onReady (data pre-loaded)
  const [splashDone, setSplashDone] = useState(false);
  const [brandingSettings, setBrandingSettings] = useState(DEFAULT_BRANDING);

  const handleSplashReady = useCallback(() => setSplashDone(true), []);

  // Fetch school branding (runs immediately, unauthenticated endpoint)
  useEffect(() => {
    let cancelled = false;
    const fetchBranding = async () => {
      try {
        const resp = await axiosInstance.get('/schools/public/branding');
        if (cancelled) return;
        const branding = resp?.data?.data || resp?.data || resp;
        if (branding) {
          setBrandingSettings(prev => ({
            ...prev,
            ...branding,
            logoUrl: pickBrandingValue(branding.logoUrl, prev.logoUrl),
            faviconUrl: pickBrandingValue(branding.faviconUrl, prev.faviconUrl),
            pwaLogoUrl: pickBrandingValue(branding.pwaLogoUrl, prev.pwaLogoUrl),
            stampUrl: pickBrandingValue(branding.stampUrl, prev.stampUrl),
            schoolName: normalizeSchoolName(branding.name || branding.schoolName),
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch branding, using defaults:', err);
      }
    };
    fetchBranding();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Favicon
  useEffect(() => {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const url = brandingSettings.faviconUrl;
    if (!url) { link.href = '/branding/favicon.png'; return; }
    link.href = url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  }, [brandingSettings.faviconUrl]);

  // PWA icons and manifest
  useEffect(() => {
    const iconUrl = brandingSettings.pwaLogoUrl || brandingSettings.faviconUrl || '/logo512.png';
    const versionedIcon = iconUrl.startsWith('data:')
      ? iconUrl
      : `${iconUrl}${iconUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = versionedIcon;

    let manifestLink = document.querySelector("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = `/api/schools/public/manifest?v=${Date.now()}`;
  }, [brandingSettings.pwaLogoUrl, brandingSettings.faviconUrl]);

  // CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const primary = brandingSettings?.primaryColor || '#030b82';
    const setRgbVar = (name, value) => {
      if (typeof value !== 'string' || !value.startsWith('#') || value.length !== 7) return;
      const r = parseInt(value.slice(1, 3), 16);
      const g = parseInt(value.slice(3, 5), 16);
      const b = parseInt(value.slice(5, 7), 16);
      root.style.setProperty(name, `${r} ${g} ${b}`);
    };

    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-purple', primary);
    setRgbVar('--brand-primary-rgb', primary);
    setRgbVar('--brand-purple-rgb', primary);
    if (brandingSettings?.secondaryColor) {
      root.style.setProperty('--brand-secondary', brandingSettings.secondaryColor);
      root.style.setProperty('--brand-teal', brandingSettings.secondaryColor);
      setRgbVar('--brand-secondary-rgb', brandingSettings.secondaryColor);
      setRgbVar('--brand-teal-rgb', brandingSettings.secondaryColor);
      if (brandingSettings.secondaryColor.startsWith('#') && brandingSettings.secondaryColor.length === 7) {
        const r = parseInt(brandingSettings.secondaryColor.slice(1, 3), 16);
        const g = parseInt(brandingSettings.secondaryColor.slice(3, 5), 16);
        const b = parseInt(brandingSettings.secondaryColor.slice(5, 7), 16);
        const darken = (v) => Math.max(0, Math.floor(v * 0.78)).toString(16).padStart(2, '0');
        root.style.setProperty('--brand-secondary-dark', `#${darken(r)}${darken(g)}${darken(b)}`);
      }
    }
    if (brandingSettings?.accentColor1) {
      root.style.setProperty('--brand-accent-1', brandingSettings.accentColor1);
      setRgbVar('--brand-accent-1-rgb', brandingSettings.accentColor1);
    }
    if (brandingSettings?.accentColor2) {
      root.style.setProperty('--brand-accent-2', brandingSettings.accentColor2);
      setRgbVar('--brand-accent-2-rgb', brandingSettings.accentColor2);
    }
    if (primary.startsWith('#') && primary.length === 7) {
      const r = parseInt(primary.slice(1, 3), 16);
      const g = parseInt(primary.slice(3, 5), 16);
      const b = parseInt(primary.slice(5, 7), 16);
      const darken = (v) => Math.max(0, Math.floor(v * 0.85)).toString(16).padStart(2, '0');
      const dark = `#${darken(r)}${darken(g)}${darken(b)}`;
      root.style.setProperty('--brand-primary-dark', dark);
      root.style.setProperty('--brand-purple-dark', dark);
    }
  }, [brandingSettings]);

  // Page title
  useEffect(() => {
    document.title = isAuthenticated
      ? user?.role === 'SUPER_ADMIN'
        ? 'Admin Dashboard'
        : `${brandingSettings.schoolName || 'School'} — Dashboard`
      : brandingSettings.schoolName || 'School Management';
  }, [isAuthenticated, user, brandingSettings.schoolName]);

  // Navigation guards
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      if (user?.requiresInstitutionSetup) {
        if (pathname !== '/auth/setup-institution') navigate('/auth/setup-institution', { replace: true });
      } else if (
        !pathname.startsWith('/app') &&
        pathname !== '/auth/setup-institution' &&
        pathname !== '/auth/reset-password'
      ) {
        navigate(user?.role === 'ACCOUNTANT' ? '/app/accountant/dashboard' : '/app', { replace: true });
      }
    } else {
      if (pathname.startsWith('/app')) navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, loading, pathname, navigate, user?.requiresInstitutionSetup]);

  const handleAuthSuccess = (userData, token, refreshToken) => {
    // Always clear bootstrap and UI state on login. The incoming user may
    // have a different institutionType and stale cached data must not bleed
    // through. The bootstrap store will refill during the splash screen.
    clearBootstrap();
    localStorage.removeItem('cbc_ui_state');
    localStorage.removeItem('cbc_current_page');
    localStorage.removeItem('cbc_page_params');
    localStorage.removeItem('cbc_expanded_sections');

    login(userData, token, refreshToken);

    if (userData.mustChangePassword) {
      navigate('/auth/reset-password?token=INITIAL_SETUP_REQUIRED', { replace: true });
    } else if (userData.requiresInstitutionSetup) {
      // After a whole institution reset the admin must configure the institution
      // type before entering the app. The backend signals this via requiresInstitutionSetup.
      navigate('/auth/setup-institution', { replace: true });
    } else {
      navigate(userData.role === 'ACCOUNTANT' ? '/app/accountant/dashboard' : '/app', { replace: true });
    }
  };

  const handleLogout = () => {
    clearBootstrap();       // wipe pre-loaded data from sessionStorage
    logout();
    navigate('/auth/login', { replace: true });
  };

  // ── Show splash while: auth is resolving OR data hasn't pre-loaded yet ──
  // Once the user is authenticated AND splashDone, show the real app.
  const showSplash = loading || !splashDone;

  return (
    <>
      {/* Splash always mounts until it calls onReady — it manages its own
          visibility internally so it can do a smooth fade-out */}
      {showSplash && (
        <SplashScreen
          isLoading={loading}
          user={isAuthenticated ? user : null}
          onReady={handleSplashReady}
        />
      )}

      {/* App shell — rendered underneath once auth is confirmed.
          It won't be visible while the splash is on top. */}
      {!loading && (
        <Suspense fallback={<SplashScreen isLoading={true} user={null} onReady={() => {}} />}>
          {isAuthenticated ? (
            <Routes>
              <Route
                path="/auth/setup-institution"
                element={
                  <Auth
                    onAuthSuccess={handleAuthSuccess}
                    brandingSettings={brandingSettings}
                  />
                }
              />
              <Route
                path="/auth/reset-password"
                element={
                  <Auth
                    onAuthSuccess={handleAuthSuccess}
                    brandingSettings={brandingSettings}
                  />
                }
              />
              <Route
                path="/app/*"
                element={
                  <SchoolDataProvider>
                    <FeeActionsProvider>
                      <UserNotificationProvider>
                        <ChatProvider>
                          <RolePreviewProvider user={user}>
                            <CBCGradingSystem
                              user={user}
                              onLogout={handleLogout}
                              brandingSettings={brandingSettings}
                              setBrandingSettings={setBrandingSettings}
                            />
                          </RolePreviewProvider>
                        </ChatProvider>
                      </UserNotificationProvider>
                    </FeeActionsProvider>
                  </SchoolDataProvider>
                }
              />
              <Route
                path="*"
                element={
                  <Navigate
                    to={user?.requiresInstitutionSetup ? '/auth/setup-institution' : '/app'}
                    replace
                  />
                }
              />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/auth/login" replace />} />
              <Route path="/auth/login"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} basePath="/auth" />} />
              <Route path="/auth/register"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} basePath="/auth" />} />
              <Route path="/auth/forgot-password"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} basePath="/auth" />} />
              <Route path="/auth/reset-password"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} />} />
              <Route path="/auth/verify-email"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} />} />
              <Route path="/auth/welcome"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} />} />
              <Route path="/auth/setup-institution"
                element={<Auth onAuthSuccess={handleAuthSuccess} brandingSettings={brandingSettings} />} />
              <Route path="*" element={<Navigate to="/auth/login" replace />} />
            </Routes>
          )}
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
        <SWUpdateBanner />
        <Toaster position="top-right" reverseOrder={false} />
      </HashRouter>
    </ErrorBoundary>
  );
}
