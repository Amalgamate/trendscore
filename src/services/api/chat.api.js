import { fetchWithAuth } from './core';

export const chatAPI = {
  // Inbox
  getInbox: (includeArchived = false) => fetchWithAuth(`/chat/inbox${includeArchived ? '?includeArchived=true' : ''}`),
  getOutbox: (limit = 100) => fetchWithAuth(`/chat/outbox?limit=${encodeURIComponent(limit)}`),
  getTotalUnread: () => fetchWithAuth('/chat/unread-count'),

  // Start conversations
  startDirect: (otherUserId, initialMessage) =>
    fetchWithAuth('/chat/direct', {
      method: 'POST',
      body: JSON.stringify({ otherUserId, initialMessage }),
    }),
  createGroup: (name, participantIds, avatarUrl) =>
    fetchWithAuth('/chat/group', {
      method: 'POST',
      body: JSON.stringify({ name, participantIds, avatarUrl }),
    }),

  // Record thread (chatter on records)
  getRecordThread: (recordType, recordId) =>
    fetchWithAuth(`/chat/record-thread?recordType=${encodeURIComponent(recordType)}&recordId=${encodeURIComponent(recordId)}`),

  // Messages
  getMessages: (conversationId, cursor, limit = 40) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return fetchWithAuth(`/chat/conversations/${conversationId}/messages?${params}`);
  },
  sendMessage: (conversationId, body, options = {}) =>
    fetchWithAuth(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, ...options }),
    }),
  markRead: (conversationId) =>
    fetchWithAuth(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' }),
  updateInboxPreferences: (conversationId, preferences) =>
    fetchWithAuth(`/chat/conversations/${conversationId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),
  editMessage: (messageId, body) =>
    fetchWithAuth(`/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  deleteMessage: (messageId) =>
    fetchWithAuth(`/chat/messages/${messageId}`, { method: 'DELETE' }),
  toggleReaction: (messageId, emoji) =>
    fetchWithAuth(`/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  // Chatbot
  askBot: (message, context) =>
    fetchWithAuth('/chat/bot', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),

  // User search
  searchUsers: (q) => fetchWithAuth(`/chat/users/search?q=${encodeURIComponent(q)}`),
};
