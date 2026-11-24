/**
 * Chat Routes — In-App Messaging
 * Base path: /api/chat  (registered in routes/index.ts after authenticate)
 */

import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { chatbotController } from '../controllers/chatbot.controller';
import { asyncHandler } from '../utils/async.util';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';
import { parentWhatsAppController } from '../controllers/parent-whatsapp.controller';

const router = Router();
const send = rateLimit({ windowMs: 10_000, maxRequests: 20 }); // 20 msgs / 10s

// Inbox & discovery
router.get('/inbox',            asyncHandler(chatController.getInbox.bind(chatController)));
router.get('/outbox',           asyncHandler(chatController.getOutbox.bind(chatController)));
router.get('/unread-count',     asyncHandler(chatController.getTotalUnread.bind(chatController)));
router.get('/users/search',     rateLimit({ windowMs: 60_000, maxRequests: 60 }), asyncHandler(chatController.searchUsers.bind(chatController)));

// Start conversations
router.post('/direct',          rateLimit({ windowMs: 60_000, maxRequests: 20 }), asyncHandler(chatController.startDirect.bind(chatController)));
router.post('/group',           rateLimit({ windowMs: 60_000, maxRequests: 10 }), asyncHandler(chatController.createGroup.bind(chatController)));

// Record thread (chatter)
router.get('/record-thread',    asyncHandler(chatController.getRecordThread.bind(chatController)));

// Messages
router.get('/conversations/:id/messages',   asyncHandler(chatController.getMessages.bind(chatController)));
router.post('/conversations/:id/messages',  send, asyncHandler(chatController.sendMessage.bind(chatController)));
router.patch('/conversations/:id/read',     asyncHandler(chatController.markRead.bind(chatController)));
router.patch('/conversations/:id/preferences', rateLimit({ windowMs: 60_000, maxRequests: 100 }), asyncHandler(chatController.updateInboxPreferences.bind(chatController)));

// Message actions
router.patch('/messages/:id',           asyncHandler(chatController.editMessage.bind(chatController)));
router.delete('/messages/:id',          asyncHandler(chatController.deleteMessage.bind(chatController)));
router.post('/messages/:id/reactions',  asyncHandler(chatController.toggleReaction.bind(chatController)));

// Chatbot
router.post('/bot',  rateLimit({ windowMs: 10_000, maxRequests: 10 }), asyncHandler(chatbotController.chat));

// Parent-controlled WhatsApp assistant account linking and consent controls.
router.get('/parent/whatsapp', asyncHandler(parentWhatsAppController.status));
// Default path — the school messages the parent and they reply YES.
router.post('/parent/whatsapp/confirm', requireCsrf, rateLimit({ windowMs: 60 * 60_000, maxRequests: 5 }), asyncHandler(parentWhatsAppController.requestConfirmation));
// Fallback path, kept for numbers that cannot receive the consent message.
router.post('/parent/whatsapp/link-code', requireCsrf, rateLimit({ windowMs: 60 * 60_000, maxRequests: 5 }), asyncHandler(parentWhatsAppController.createLinkCode));
router.patch('/parent/whatsapp', requireCsrf, asyncHandler(parentWhatsAppController.updateSettings));
router.delete('/parent/whatsapp', requireCsrf, asyncHandler(parentWhatsAppController.disconnect));

export default router;
