/**
 * Service Worker registration for Trends Core PWA
 *
 * Registers /sw.js in production (and optionally in dev with VITE_SW_DEV=true).
 * Handles update detection and notifies the app via a custom event.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const isDev = import.meta.env.DEV;
  const enableInDev = import.meta.env.VITE_SW_DEV === 'true';

  if (isDev && !enableInDev) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      console.log('[SW] Registered, scope:', registration.scope);

      // Check for updates every 60 minutes
      setInterval(() => registration.update(), 60 * 60 * 1000);

      // Notify app when a new SW is waiting to take over
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available — dispatch event for the UI to show a refresh prompt
            window.dispatchEvent(new CustomEvent('sw:update-available'));
            console.log('[SW] Update available — refresh to activate');
          }
        });
      });

      // Listen for messages from the SW (e.g. navigation from push click)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'navigate') {
          window.location.hash = event.data.url.replace(/^\//, '#/');
        }
      });
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}
