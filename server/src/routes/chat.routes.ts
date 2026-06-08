/**
 * Chat Routes — In-App Messaging
 * Base path: /api/chat  (registered in routes/index.ts after authenticate)
 */

import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { chatbotController } from '../controllers/chatbot.controller';
import { asyncHandler } from '../utils/async.util';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();
const send = rateLimit({ windowMs: 10_000, maxRequests: 20 }); // 20 msgs / 10s

// Inbox & discovery
router.get('/inbox',            asyncHandler(chatController.getInbox.bind(chatController)));
router.get('/unread-count',     asyncHandler(chatController.getTotalUnread.bind(chatController)));
router.get('/users/search',     asyncHandler(chatController.searchUsers.bind(chatController)));

// Start conversations
router.post('/direct',          asyncHandler(chatController.startDirect.bind(chatController)));
router.post('/group',           asyncHandler(chatController.createGroup.bind(chatController)));

// Record thread (chatter)
router.get('/record-thread',    asyncHandler(chatController.getRecordThread.bind(chatController)));

// Messages
router.get('/conversations/:id/messages',   asyncHandler(chatController.getMessages.bind(chatController)));
router.post('/conversations/:id/messages',  send, asyncHandler(chatController.sendMessage.bind(chatController)));
router.patch('/conversations/:id/read',     asyncHandler(chatController.markRead.bind(chatController)));

// Message actions
router.patch('/messages/:id',           asyncHandler(chatController.editMessage.bind(chatController)));
router.delete('/messages/:id',          asyncHandler(chatController.deleteMessage.bind(chatController)));
router.post('/messages/:id/reactions',  asyncHandler(chatController.toggleReaction.bind(chatController)));

// Chatbot
router.post('/bot',  rateLimit({ windowMs: 10_000, maxRequests: 10 }), asyncHandler(chatbotController.chat));

export default router;
