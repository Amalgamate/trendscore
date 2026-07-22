/**
 * UserNotificationContext
 *
 * Single source of truth for in-app notification state.
 *
 * ── Design principles ────────────────────────────────────────────────────────
 *
 * 1. SERVER RETURNS ALL RECORDS (not just unread).
 *    The previous implementation fetched only `isRead:false` rows. On every
 *    page refresh React state was destroyed, the merge ran against an empty
 *    `prev`, and every returned row appeared unread — even ones already read
 *    in a prior session. Returning all records means `isRead` from the DB is
 *    the authoritative value; the frontend never has to guess.
 *
 * 2. DERIVED STATE ONLY.
 *    `unreadNotifications` and `unreadCount` are always computed from
 *    `notifications` via useMemo. There is no separate counter that can drift.
 *
 * 3. OPTIMISTIC UPDATES WITH REVERT.
 *    markAsRead / markAllAsRead flip state immediately so the UI responds
 *    instantly. If the API call fails the state is reverted and a re-fetch
 *    restores the accurate server state.
 *
 * 4. SOCKET DEDUPLICATION.
 *    Incoming real-time notifications are ignored if their ID already exists
 *    in local state (prevents double-counting after a background re-fetch).
 *
 * 5. NO MARK-ALL-ON-BELL-OPEN.
 *    The bell popover no longer marks everything read on open. Items are
 *    marked read individually when clicked, or via an explicit "Mark all read"
 *    button. This prevents the race where a mis-click would silently suppress
 *    notifications before the user saw them.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getAuthItem } from '../utils/authStorage';

const UserNotificationContext = createContext(null);

export const UserNotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [lastBuzzAt, setLastBuzzAt] = useState(0);
  const [lastBuzzType, setLastBuzzType] = useState('');
  const audioRef = useRef(null);
  const notificationIdsRef = useRef(new Set());

  // ── Derived state — always accurate, never drifts ────────────────────────
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );
  const unreadCount = unreadNotifications.length;

  // ── Audio ─────────────────────────────────────────────────────────────────
  const playBeep = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate?.([80, 40, 80]);
    }

    audioRef.current?.play().catch(() => {
      // Autoplay policy — silent failure is acceptable
    });
  }, []);

  // ── Browser Notification ──────────────────────────────────────────────────
  const showBrowserNotification = useCallback((title, message) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body: message, icon: '/branding/logo.png' });
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Server now returns ALL records for the user (both read and unread).
  // We replace local state wholesale — the DB is the authoritative source.
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const resp = await api.userNotifications.getAll();
      if (resp.success && Array.isArray(resp.data)) {
        notificationIdsRef.current = new Set(resp.data.map((n) => n.id).filter(Boolean));
        setNotifications(resp.data);
      }
    } catch (err) {
      console.error('[Notifications] fetch failed:', err);
    }
  }, [isAuthenticated]);

  // ── Socket + initial fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const serverUrl = window.location.origin;
    const socket = io(serverUrl, {
      withCredentials: true,
      auth: { token: getAuthItem('token') },
    });

    socket.on('connect', () => {
      console.log('[Notifications] Socket connected');
    });

    socket.on('notification:new', (notification) => {
      console.log('[Notifications] Real-time notification received:', notification.id);
      if (!notification?.id || notificationIdsRef.current.has(notification.id)) return;
      notificationIdsRef.current.add(notification.id);
      setNotifications((prev) => {
        return [{ ...notification, isRead: false }, ...prev];
      });
      setLastBuzzAt(Date.now());
      setLastBuzzType(notification.type || '');
      playBeep();
      showBrowserNotification(notification.title, notification.message);
    });

    // Initial fetch on mount / auth change
    fetchNotifications();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') registerPushSubscription();
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      registerPushSubscription();
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // ── Push subscription ─────────────────────────────────────────────────────
  const registerPushSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) return;

      let resp;
      try {
        resp = await api.userNotifications.getVapidPublicKey?.();
      } catch {
        console.warn('[Notifications] VAPID key unavailable — push skipped');
        return;
      }

      if (!resp?.data?.publicKey) return;

      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(resp.data.publicKey),
      });

      await api.userNotifications.savePushSubscription?.(subscription);
      console.log('[Notifications] Push subscription registered');
    } catch (err) {
      console.warn('[Notifications] Push subscription failed:', err);
    }
  }, []);

  // ── Mark single as read ───────────────────────────────────────────────────
  // Uses a functional setState updater for the optimistic change so the
  // closure never holds a stale reference to `notifications`. The snapshot
  // for revert is captured inside the updater via the `prev` argument and
  // stored in a ref so the catch block can always access the pre-update state.
  const markAsRead = useCallback(
    async (id) => {
      let snapshot = [];
      setNotifications((prev) => {
        snapshot = prev; // capture inside updater — always the current array, never stale
        return prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        );
      });
      try {
        await api.userNotifications.markAsRead(id);
      } catch (err) {
        console.error('[Notifications] markAsRead failed — reverting:', err);
        setNotifications(snapshot);
        fetchNotifications();
      }
    },
    [fetchNotifications]
  );

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    let snapshot = [];
    setNotifications((prev) => {
      snapshot = prev;
      return prev.map((n) =>
        n.isRead ? n : { ...n, isRead: true, readAt: now }
      );
    });
    try {
      await api.userNotifications.markAllAsRead();
    } catch (err) {
      console.error('[Notifications] markAllAsRead failed — reverting:', err);
      setNotifications(snapshot);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadNotifications,
      unreadCount,
      lastBuzzAt,
      lastBuzzType,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
    }),
    [
      notifications,
      unreadNotifications,
      unreadCount,
      lastBuzzAt,
      lastBuzzType,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
    ]
  );

  return (
    <UserNotificationContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"
        preload="auto"
      />
    </UserNotificationContext.Provider>
  );
};

export const useUserNotifications = () => {
  const context = useContext(UserNotificationContext);
  if (!context) {
    throw new Error(
      'useUserNotifications must be used within UserNotificationProvider'
    );
  }
  return context;
};
