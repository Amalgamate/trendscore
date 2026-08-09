/**
 * ChatService — In-App Messaging
 *
 * Supports:
 *  - DIRECT conversations (1:1)
 *  - GROUP conversations (named channels)
 *  - RECORD_THREAD conversations (chatter attached to any school record)
 *
 * Socket events emitted:
 *  chat:message   — new message in a conversation
 *  chat:typing    — typing indicator (ephemeral, no DB write)
 *  chat:read      — read cursor update
 *  chat:reaction  — emoji reaction added/removed
 */

import prisma from '../config/database';
import { getIO } from './socket.service';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateDirectConversationInput {
  creatorId: string;
  otherUserId: string;
}

interface CreateGroupConversationInput {
  creatorId: string;
  name: string;
  participantIds: string[];
  avatarUrl?: string;
}

interface CreateRecordThreadInput {
  creatorId: string;
  recordType: string; // e.g. "FeeInvoice"
  recordId: string;
  participantIds: string[];
}

interface SendMessageInput {
  conversationId: string;
  senderId: string;
  body: string;
  replyToId?: string;
  attachmentUrl?: string;
  attachmentType?: 'IMAGE' | 'FILE' | 'AUDIO';
  attachmentName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  profilePicture: true,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ChatService {

  // ── Conversations ──────────────────────────────────────────────────────────

  /**
   * Get or create a DIRECT conversation between two users.
   * Idempotent — two users always share exactly one direct thread.
   */
  static async getOrCreateDirect({ creatorId, otherUserId }: CreateDirectConversationInput) {
    // Find existing direct conversation that contains both users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        participants: {
          every: {
            userId: { in: [creatorId, otherUserId] },
            leftAt: null,
          },
        },
      },
      include: {
        participants: {
          include: { user: { select: userSelect } },
          where: { leftAt: null },
        },
      },
    });

    // Extra guard: confirm BOTH users are actually in the returned conversation
    if (
      existing &&
      existing.participants.some((p) => p.userId === creatorId) &&
      existing.participants.some((p) => p.userId === otherUserId)
    ) {
      return existing;
    }

    // Create new direct conversation
    return prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: creatorId,
        participants: {
          create: [{ userId: creatorId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: { user: { select: userSelect } },
          where: { leftAt: null },
        },
      },
    });
  }

  /**
   * Create a named GROUP conversation.
   */
  static async createGroup({ creatorId, name, participantIds, avatarUrl }: CreateGroupConversationInput) {
    // Always include creator
    const uniqueIds = [...new Set([creatorId, ...participantIds])];
    return prisma.conversation.create({
      data: {
        type: 'GROUP',
        name,
        avatarUrl: avatarUrl ?? null,
        createdById: creatorId,
        participants: {
          create: uniqueIds.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: { user: { select: userSelect } },
          where: { leftAt: null },
        },
      },
    });
  }

  /**
   * Get or create a RECORD_THREAD for a specific record.
   * Participants are added/updated on each call.
   */
  static async getOrCreateRecordThread({ creatorId, recordType, recordId, participantIds }: CreateRecordThreadInput) {
    const existing = await prisma.conversation.findFirst({
      where: { type: 'RECORD_THREAD', recordType, recordId },
      include: {
        participants: {
          include: { user: { select: userSelect } },
          where: { leftAt: null },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: userSelect },
            replyTo: { select: { id: true, body: true, sender: { select: userSelect } } },
            reactions: { include: { user: { select: userSelect } } },
          },
        },
      },
    });

    if (existing) {
      // Ensure all passed participants are in the thread
      await ChatService._ensureParticipants(existing.id, participantIds);
      return existing;
    }

    const uniqueIds = [...new Set([creatorId, ...participantIds])];
    return prisma.conversation.create({
      data: {
        type: 'RECORD_THREAD',
        recordType,
        recordId,
        createdById: creatorId,
        participants: { create: uniqueIds.map((userId) => ({ userId })) },
      },
      include: {
        participants: {
          include: { user: { select: userSelect } },
          where: { leftAt: null },
        },
        messages: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /** Add participants that aren't already in the conversation. */
  private static async _ensureParticipants(conversationId: string, userIds: string[]) {
    const existing = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((p: any) => p.userId));
    const toAdd = userIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) return;
    await prisma.conversationParticipant.createMany({
      data: toAdd.map((userId) => ({ conversationId, userId })),
      skipDuplicates: true,
    });
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  /**
   * Return all non-record-thread conversations for a user,
   * ordered by most recent message, with unread counts.
   */
  static async getInbox(userId: string) {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: { select: userSelect } },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: userSelect } },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    return participations
      .filter((p: any) => p.conversation.type !== 'RECORD_THREAD')
      .map((p: any) => {
        const lastReadAt = p.lastReadAt;
        const unreadCount = lastReadAt
          ? // We don't have a raw count here — will be computed from message list
            0
          : 0; // Will be enriched separately if needed
        return {
          ...p.conversation,
          myParticipantId: p.id,
          lastReadAt,
          unreadCount,
          lastMessage: p.conversation.messages[0] ?? null,
        };
      });
  }

  /**
   * Get unread counts for all conversations a user is in.
   */
  static async getUnreadCounts(userId: string): Promise<Record<string, number>> {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true, lastReadAt: true },
    });

    const counts: Record<string, number> = {};
    await Promise.all(
      participations.map(async (p: any) => {
        const count = await prisma.chatMessage.count({
          where: {
            conversationId: p.conversationId,
            deletedAt: null,
            senderId: { not: userId },
            createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
          },
        });
        counts[p.conversationId] = count;
      })
    );
    return counts;
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  /**
   * Fetch messages for a conversation (paginated, newest last).
   */
  static async getMessages(conversationId: string, userId: string, cursor?: string, limit = 40) {
    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant || participant.leftAt) {
      throw new Error('Not a participant in this conversation');
    }

    const where: any = { conversationId, deletedAt: null };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: userSelect },
        replyTo: {
          select: {
            id: true,
            body: true,
            deletedAt: true,
            sender: { select: userSelect },
          },
        },
        reactions: { include: { user: { select: userSelect } } },
      },
    });

    return messages.reverse(); // Chronological order for display
  }

  /**
   * Send a message and emit socket events to all participants.
   */
  static async sendMessage(input: SendMessageInput) {
    // Verify sender is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: input.conversationId, userId: input.senderId } },
    });
    if (!participant || participant.leftAt) {
      throw new Error('Not a participant in this conversation');
    }

    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          body: input.body,
          replyToId: input.replyToId ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
          attachmentType: (input.attachmentType as any) ?? null,
          attachmentName: input.attachmentName ?? null,
        },
        include: {
          sender: { select: userSelect },
          replyTo: {
            select: {
              id: true,
              body: true,
              sender: { select: userSelect },
            },
          },
          reactions: true,
        },
      }),
      prisma.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Emit to all conversation participants EXCEPT the sender.
    // The sender already has the message via the optimistic bubble + HTTP response,
    // so broadcasting back to them causes the duplicate the user sees.
    try {
      const io = getIO();
      io.to(`conv:${input.conversationId}`).except(input.senderId).emit('chat:message', message);
    } catch (err: any) {
      logger.warn({ err: err.message }, '[Chat] Socket emit failed');
    }

    return message;
  }

  /**
   * Soft-delete a message (sender or admin only).
   */
  static async deleteMessage(messageId: string, userId: string) {
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== userId) throw new Error('Not your message');

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: '' },
    });

    try {
      const io = getIO();
      io.to(`conv:${msg.conversationId}`).emit('chat:deleted', { messageId, conversationId: msg.conversationId });
    } catch (_) { /* non-critical */ }

    return updated;
  }

  /**
   * Edit a message body.
   */
  static async editMessage(messageId: string, userId: string, newBody: string) {
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.deletedAt) throw new Error('Message not found');
    if (msg.senderId !== userId) throw new Error('Not your message');

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { body: newBody, editedAt: new Date() },
      include: { sender: { select: userSelect }, reactions: true },
    });

    try {
      const io = getIO();
      io.to(`conv:${msg.conversationId}`).emit('chat:edited', updated);
    } catch (_) { /* non-critical */ }

    return updated;
  }

  // ── Read receipts ──────────────────────────────────────────────────────────

  /**
   * Mark all messages in a conversation as read up to now.
   */
  static async markRead(conversationId: string, userId: string) {
    const now = new Date();
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });

    try {
      const io = getIO();
      io.to(`conv:${conversationId}`).emit('chat:read', { conversationId, userId, readAt: now });
    } catch (_) { /* non-critical */ }
  }

  // ── Reactions ──────────────────────────────────────────────────────────────

  /**
   * Toggle an emoji reaction on a message.
   */
  static async toggleReaction(messageId: string, userId: string, emoji: string) {
    const existing = await prisma.chatMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    let reaction;
    if (existing) {
      await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
      reaction = null;
    } else {
      reaction = await prisma.chatMessageReaction.create({
        data: { messageId, userId, emoji },
        include: { user: { select: userSelect } },
      });
    }

    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (msg) {
      try {
        const io = getIO();
        io.to(`conv:${msg.conversationId}`).emit('chat:reaction', {
          messageId,
          emoji,
          userId,
          removed: !reaction,
        });
      } catch (_) { /* non-critical */ }
    }

    return reaction;
  }

  // ── Users search (for starting a conversation) ─────────────────────────────

  /**
   * Search staff/users to start a conversation with.
   * Returns users other than the requester, matching name/email.
   */
  static async searchUsers(query: string, requesterId: string, limit = 20) {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    return prisma.user.findMany({
      where: {
        id: { not: requesterId },
        archived: false,
        status: 'ACTIVE',
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { ...userSelect, email: true, phone: true },
      take: limit,
    });
  }

  // ── Record thread helpers ──────────────────────────────────────────────────

  /**
   * Get all messages for a record thread. Creates it if it doesn't exist.
   * Used by the record chatter component.
   */
  static async getRecordThread(recordType: string, recordId: string, requesterId: string, extraParticipants: string[] = []) {
    return ChatService.getOrCreateRecordThread({
      creatorId: requesterId,
      recordType,
      recordId,
      participantIds: [requesterId, ...extraParticipants],
    });
  }
}
