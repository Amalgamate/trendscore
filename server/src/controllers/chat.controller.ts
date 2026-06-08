import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ChatService } from '../services/chat.service';
import { ApiError } from '../utils/error.util';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  replyToId: z.string().uuid().optional(),
  attachmentUrl: z.string().url().optional(),
  attachmentType: z.enum(['IMAGE', 'FILE', 'AUDIO']).optional(),
  attachmentName: z.string().max(255).optional(),
});

const createDirectSchema = z.object({
  otherUserId: z.string().uuid(),
  // Optionally seed first message
  initialMessage: z.string().min(1).max(4000).optional(),
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  participantIds: z.array(z.string().uuid()).min(1).max(50),
  avatarUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class ChatController {

  /** GET /api/chat/inbox */
  async getInbox(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const inbox = await ChatService.getInbox(userId);
    const unreadCounts = await ChatService.getUnreadCounts(userId);
    // Merge unread counts
    const enriched = inbox.map((c: any) => ({ ...c, unreadCount: unreadCounts[c.id] ?? 0 }));
    res.json({ success: true, data: enriched });
  }

  /** GET /api/chat/unread-count — total unread across all conversations */
  async getTotalUnread(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const counts = await ChatService.getUnreadCounts(userId);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    res.json({ success: true, data: { total, perConversation: counts } });
  }

  /** POST /api/chat/direct — start or get a direct conversation */
  async startDirect(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { otherUserId, initialMessage } = createDirectSchema.parse(req.body);
    const conversation = await ChatService.getOrCreateDirect({ creatorId: userId, otherUserId });
    if (initialMessage) {
      await ChatService.sendMessage({ conversationId: conversation.id, senderId: userId, body: initialMessage });
    }
    res.json({ success: true, data: conversation });
  }

  /** POST /api/chat/group — create a group conversation */
  async createGroup(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { name, participantIds, avatarUrl } = createGroupSchema.parse(req.body);
    const conversation = await ChatService.createGroup({ creatorId: userId, name, participantIds, avatarUrl });
    res.status(201).json({ success: true, data: conversation });
  }

  /** GET /api/chat/conversations/:id/messages */
  async getMessages(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { id } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 40), 100);
    const messages = await ChatService.getMessages(id, userId, cursor, limit);
    res.json({ success: true, data: messages });
  }

  /** POST /api/chat/conversations/:id/messages */
  async sendMessage(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { id } = req.params;
    const input = sendMessageSchema.parse(req.body);
    const message = await ChatService.sendMessage({ conversationId: id, senderId: userId, ...input });
    res.status(201).json({ success: true, data: message });
  }

  /** PATCH /api/chat/messages/:id — edit a message */
  async editMessage(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { id } = req.params;
    const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    const message = await ChatService.editMessage(id, userId, body);
    res.json({ success: true, data: message });
  }

  /** DELETE /api/chat/messages/:id */
  async deleteMessage(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { id } = req.params;
    await ChatService.deleteMessage(id, userId);
    res.json({ success: true, message: 'Message deleted' });
  }

  /** PATCH /api/chat/conversations/:id/read */
  async markRead(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    await ChatService.markRead(req.params.id, userId);
    res.json({ success: true });
  }

  /** POST /api/chat/messages/:id/reactions */
  async toggleReaction(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { emoji } = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
    const result = await ChatService.toggleReaction(req.params.id, userId, emoji);
    res.json({ success: true, data: result });
  }

  /** GET /api/chat/users/search?q= */
  async searchUsers(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });
    const users = await ChatService.searchUsers(q, userId);
    res.json({ success: true, data: users });
  }

  /** GET /api/chat/record-thread?recordType=&recordId= */
  async getRecordThread(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const { recordType, recordId } = z.object({
      recordType: z.string().min(1),
      recordId: z.string().min(1),
    }).parse(req.query);

    const thread = await ChatService.getRecordThread(recordType, recordId, userId);

    // Load messages separately to have full pagination-ready response
    const messages = await ChatService.getMessages(thread.id, userId);
    res.json({ success: true, data: { ...thread, messages } });
  }
}

export const chatController = new ChatController();
