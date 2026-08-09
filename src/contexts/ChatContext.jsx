/**
 * ChatContext — In-App Messaging State
 *
 * Root-cause fix for duplicate messages:
 *  The socket `chat:message` event was racing with the optimistic→real swap.
 *  Fix: track a Set of "confirmed real IDs" (sentMessageIds). When the socket
 *  delivers a message whose ID is already in that set, it means the optimistic
 *  replace already ran — skip. When the optimistic replace runs, we add the
 *  real ID to the set so any delayed socket delivery is ignored.
 */

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getAuthItem } from '../utils/authStorage';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [conversations, setConversations]       = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesByConv, setMessagesByConv]     = useState({});
  const [typingUsers, setTypingUsers]           = useState({});   // { [convId]: Set<userId> }
  const [isChatOpen, setIsChatOpen]             = useState(false);
  const [unreadTotal, setUnreadTotal]           = useState(0);

  const socketRef        = useRef(null);
  const typingTimers     = useRef({});
  // Maps tempId → resolvers waiting for the real ID, and realId → true once confirmed.
  // Pre-registered before the HTTP call so the socket echo is always suppressed
  // even if it arrives before the HTTP response.
  const pendingTempIds   = useRef(new Map()); // tempId → realId (set when HTTP responds)
  const ownMessageIds    = useRef(new Set());  // realId → confirmed (used to drop socket echo)
  // Keep a stable ref to activeConversationId for use inside socket closures
  const activeConvRef    = useRef(null);
  activeConvRef.current  = activeConversationId;

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0),
    [conversations]
  );

  // ── Inbox ──────────────────────────────────────────────────────────────────
  const fetchInbox = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const resp = await api.chat.getInbox();
      if (resp.success) setConversations(resp.data);
    } catch (err) {
      console.error('[Chat] fetchInbox failed:', err);
    }
  }, [isAuthenticated]);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (conversationId, cursor) => {
    try {
      const resp = await api.chat.getMessages(conversationId, cursor);
      if (!resp.success) return;
      setMessagesByConv((prev) => {
        const existing = prev[conversationId] ?? [];
        const merged = cursor ? [...resp.data, ...existing] : resp.data;
        return { ...prev, [conversationId]: merged };
      });
      return resp.data;
    } catch (err) {
      console.error('[Chat] loadMessages failed:', err);
    }
  }, []);

  // ── Open conversation ──────────────────────────────────────────────────────
  const openConversation = useCallback(async (conversationId) => {
    setActiveConversationId(conversationId);
    setIsChatOpen(true);
    socketRef.current?.emit('chat:join', conversationId);
    if (!messagesByConv[conversationId]) {
      await loadMessages(conversationId);
    }
    try {
      await api.chat.markRead(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (_) {}
  }, [messagesByConv, loadMessages]);

  // ── Start DM ───────────────────────────────────────────────────────────────
  const startDirect = useCallback(async (otherUserId) => {
    try {
      const resp = await api.chat.startDirect(otherUserId);
      if (!resp.success) return null;
      const conv = resp.data;
      setConversations((prev) =>
        prev.some((c) => c.id === conv.id) ? prev : [{ ...conv, unreadCount: 0 }, ...prev]
      );
      await openConversation(conv.id);
      return conv;
    } catch (err) {
      console.error('[Chat] startDirect failed:', err);
      return null;
    }
  }, [openConversation]);

  // ── Send message — bulletproof dedup ──────────────────────────────────────
  const sendMessage = useCallback(async (conversationId, body, options = {}) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    // 1. Pre-register tempId so we can match it to the real ID once the
    //    HTTP response arrives — regardless of whether the socket echo
    //    races ahead of the response.
    pendingTempIds.current.set(tempId, null);

    // 2. Add optimistic bubble immediately
    const optimistic = {
      id: tempId,
      conversationId,
      senderId: user?.id,
      sender: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        profilePicture: user?.profilePicture,
      },
      body,
      createdAt: new Date().toISOString(),
      reactions: [],
      _pending: true,
      ...options,
    };

    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), optimistic],
    }));

    try {
      const resp = await api.chat.sendMessage(conversationId, body, options);
      if (resp.success) {
        const realId = resp.data.id;

        // Register the real ID so any incoming socket echo for this message
        // is immediately dropped (belt-and-suspenders on top of the server fix)
        ownMessageIds.current.add(realId);
        pendingTempIds.current.delete(tempId);

        // 3. Swap optimistic → real
        setMessagesByConv((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === tempId ? resp.data : m
          ),
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: resp.data, lastMessageAt: resp.data.createdAt }
              : c
          )
        );
      }
      return resp.data;
    } catch (err) {
      pendingTempIds.current.delete(tempId);
      setMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== tempId),
      }));
      console.error('[Chat] sendMessage failed:', err);
    }
  }, [user]);

  // ── Typing ─────────────────────────────────────────────────────────────────
  const typingDebounce = useRef({});
  const sendTyping = useCallback((conversationId, isTyping) => {
    // Throttle: only emit start-typing once per 3s, stop immediately
    if (isTyping) {
      const key = conversationId;
      if (typingDebounce.current[key]) return;
      socketRef.current?.emit('chat:typing', { conversationId, isTyping: true });
      typingDebounce.current[key] = setTimeout(() => {
        delete typingDebounce.current[key];
        socketRef.current?.emit('chat:typing', { conversationId, isTyping: false });
      }, 3000);
    } else {
      clearTimeout(typingDebounce.current[conversationId]);
      delete typingDebounce.current[conversationId];
      socketRef.current?.emit('chat:typing', { conversationId, isTyping: false });
    }
  }, []);

  // ── Reactions ──────────────────────────────────────────────────────────────
  const toggleReaction = useCallback(async (_convId, messageId, emoji) => {
    try { await api.chat.toggleReaction(messageId, emoji); }
    catch (err) { console.error('[Chat] toggleReaction failed:', err); }
  }, []);

  // ── Delete / Edit ──────────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (conversationId, messageId) => {
    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: '' } : m
      ),
    }));
    try { await api.chat.deleteMessage(messageId); } catch (_) {}
  }, []);

  const editMessage = useCallback(async (conversationId, messageId, newBody) => {
    let snapshot;
    setMessagesByConv((prev) => {
      snapshot = prev;
      return {
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, body: newBody, editedAt: new Date().toISOString() } : m
        ),
      };
    });
    try { await api.chat.editMessage(messageId, newBody); }
    catch { setMessagesByConv(snapshot); }
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // In dev Vite runs on a different port than the API server —
    // always connect the socket directly to the API origin.
    const apiOrigin = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).origin   // e.g. http://localhost:5000
      : window.location.origin;                        // production: same origin

    const socket = io(apiOrigin, {
      withCredentials: true,
      auth: { token: getAuthItem('token') },
    });
    socketRef.current = socket;

    socket.on('chat:message', (message) => {
      const convId = message.conversationId;
      const realId = message.id;

      // Drop if this is our own message echo:
      // — ownMessageIds covers the normal case (HTTP responded before socket)
      // — pendingTempIds values covers the race case (socket arrived before HTTP)
      if (ownMessageIds.current.has(realId)) {
        ownMessageIds.current.delete(realId);
        return;
      }
      // Check if the real ID matches any in-flight send we initiated
      for (const [tempId, knownRealId] of pendingTempIds.current.entries()) {
        if (knownRealId === realId) {
          pendingTempIds.current.delete(tempId);
          return;
        }
      }

      setMessagesByConv((prev) => {
        const msgs = prev[convId] ?? [];
        if (msgs.some((m) => m.id === realId)) return prev; // final safety check
        return { ...prev, [convId]: [...msgs, message] };
      });

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convId);
        if (!exists) { fetchInbox(); return prev; }
        return prev.map((c) => {
          if (c.id !== convId) return c;
          const isActive = activeConvRef.current === convId;
          return {
            ...c,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCount: isActive ? 0 : (c.unreadCount ?? 0) + 1,
          };
        });
      });
    });

    socket.on('chat:typing', ({ conversationId, userId, isTyping }) => {
      if (userId === user.id) return;
      setTypingUsers((prev) => {
        const set = new Set(prev[conversationId] ?? []);
        isTyping ? set.add(userId) : set.delete(userId);
        return { ...prev, [conversationId]: set };
      });
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.current[key]);
      if (isTyping) {
        typingTimers.current[key] = setTimeout(() => {
          setTypingUsers((prev) => {
            const set = new Set(prev[conversationId] ?? []);
            set.delete(userId);
            return { ...prev, [conversationId]: set };
          });
        }, 5000);
      }
    });

    socket.on('chat:edited', (message) => {
      setMessagesByConv((prev) => ({
        ...prev,
        [message.conversationId]: (prev[message.conversationId] ?? []).map((m) =>
          m.id === message.id ? message : m
        ),
      }));
    });

    socket.on('chat:deleted', ({ messageId, conversationId }) => {
      setMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: '' } : m
        ),
      }));
    });

    socket.on('chat:reaction', ({ messageId, emoji, userId: reactorId, removed }) => {
      setMessagesByConv((prev) => {
        const entry = Object.entries(prev).find(([, msgs]) =>
          msgs.some((m) => m.id === messageId)
        );
        if (!entry) return prev;
        const [convId, msgs] = entry;
        return {
          ...prev,
          [convId]: msgs.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = m.reactions ?? [];
            if (removed) return { ...m, reactions: reactions.filter((r) => !(r.userId === reactorId && r.emoji === emoji)) };
            if (reactions.some((r) => r.userId === reactorId && r.emoji === emoji)) return m;
            return { ...m, reactions: [...reactions, { userId: reactorId, emoji }] };
          }),
        };
      });
    });

    fetchInbox();
    return () => { socket.disconnect(); socketRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => { setUnreadTotal(totalUnread); }, [totalUnread]);

  const value = useMemo(() => ({
    conversations, activeConversationId, messagesByConv, typingUsers,
    isChatOpen, unreadTotal, setIsChatOpen, openConversation, startDirect,
    sendMessage, sendTyping, toggleReaction, deleteMessage, editMessage,
    fetchInbox, loadMessages,
  }), [
    conversations, activeConversationId, messagesByConv, typingUsers,
    isChatOpen, unreadTotal, openConversation, startDirect, sendMessage,
    sendTyping, toggleReaction, deleteMessage, editMessage, fetchInbox, loadMessages,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
