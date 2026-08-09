import { useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useUserNotifications } from '../../contexts/UserNotificationContext';

export default function PwaBadgeSync() {
  const { unreadCount = 0 } = useUserNotifications();
  const { unreadTotal = 0 } = useChat();
  const appBadgeCount = Math.max(0, Number(unreadCount) + Number(unreadTotal));

  useEffect(() => {
    const updateAppBadge = async () => {
      try {
        if (appBadgeCount > 0 && typeof navigator.setAppBadge === 'function') {
          await navigator.setAppBadge(appBadgeCount);
        } else if (typeof navigator.clearAppBadge === 'function') {
          await navigator.clearAppBadge();
        }
      } catch {
        // Badging is optional; visible in-app counters remain the fallback.
      }
    };

    updateAppBadge();
  }, [appBadgeCount]);

  useEffect(() => () => {
    try {
      const clearResult = navigator.clearAppBadge?.();
      clearResult?.catch?.(() => {});
    } catch {
      // Ignore optional platform badge cleanup failures during sign-out.
    }
  }, []);

  return null;
}
