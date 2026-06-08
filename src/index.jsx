import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';

const isLocalDevHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const shouldRegisterServiceWorker = import.meta.env.PROD && 'serviceWorker' in navigator;

const clearDevelopmentServiceWorkers = async () => {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));

    console.info('[SW] Cleared local development service workers and caches.');
  } catch (err) {
    console.warn('[SW] Failed to clear local development service workers:', err);
  }
};

// Keep the service worker for production only.
// In local development it causes stale cached bundles and confusing UI drift.
if (shouldRegisterServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);

        // Check for updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000);

        // Notify app when a new SW is waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw:update-available'));
              console.log('[SW] Update available — refresh to activate');
            }
          });
        });

        // Handle navigation messages from push notification clicks
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'navigate') {
            window.location.hash = event.data.url.replace(/^\//, '#/');
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
} else if (isLocalDevHost) {
  window.addEventListener('load', () => {
    clearDevelopmentServiceWorkers();
  });
}


const enforceLightTheme = () => {
  document.documentElement.classList.remove('dark');
  if (document.body) {
    document.body.classList.remove('dark');
  }
  localStorage.setItem('theme', 'light');
};

enforceLightTheme();

const htmlClassObserver = new MutationObserver(() => {
  if (document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark')) {
    enforceLightTheme();
  }
});

htmlClassObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
if (document.body) {
  htmlClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const AppWrapper = import.meta.env.DEV ? React.Fragment : React.StrictMode;
root.render(
  <AppWrapper>
    <AuthProvider>
      <App />
    </AuthProvider>
  </AppWrapper>
);
