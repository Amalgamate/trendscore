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
import { Prisma, UserRole } from '@prisma/client';
import logger from '../utils/logger';
import { getCanonicalRoles } from '../utils/roleNormalizer';
import { parentAccessService } from './parent-access.service';
import { resolveStudentUserIdsForLearners } from './student-account-link.service';

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

// Office roles that parents and students are allowed to contact. They must also
// be able to read and answer those conversations (see directRecipientPolicy).
const SCHOOL_CONTACT_ROLES = new Set([
  'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'RECEPTIONIST', 'ACCOUNTANT',
]);
const STAFF_ROLES = new Set([
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
  'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY',
  'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT',
]);

const roleSet = (user: { role?: unknown; roles?: unknown[] }) =>
  new Set<string>(getCanonicalRoles(user));

const hasOneOf = (roles: Set<string>, candidates: Set<string>) =>
  [...roles].some((role) => candidates.has(role));

const asUserRoles = (roles: Set<string>): UserRole[] => [...roles] as UserRole[];

const isAllowedRecipient = (policy: any, recipient: { id: string; role?: unknown; roles?: unknown[] }) => {
  if (!policy || !recipient || hasOneOf(roleSet(recipient), policy.denyRoles)) return false;
  return policy.unrestricted || Boolean(policy.allowedIds?.has(recipient.id)) || Boolean(
    policy.allowedRoles && hasOneOf(roleSet(recipient), policy.allowedRoles),
  );
};

/**
 * Reply-only recipients: people a user may answer when they write first, but
 * may not start a conversation with (e.g. a student writing to a teacher).
 * Without this a student's message to a teacher is stored but never visible to
 * the teacher.
 */
const isReplyOnlyRecipient = (policy: any, recipient: { id: string; role?: unknown; roles?: unknown[] }) => {
  if (!policy || !recipient) return false;
  const recipientRoles = roleSet(recipient);
  if (recipientRoles.has('SUPER_ADMIN')) return false;
  return Boolean(policy.replyOnlyIds?.has(recipient.id)) || Boolean(
    policy.replyOnlyRoles && hasOneOf(recipientRoles, policy.replyOnlyRoles),
  );
};

const isAccessibleWithPolicy = (conversation: any, userId: string, policy: any) => {
  if (!conversation?.participants?.some((participant: any) => participant.userId === userId)) return false;
  if (conversation.participants.some((participant: any) => participant.user?.status !== 'ACTIVE' || participant.user?.archived)) return false;
  if (conversation.type === 'GROUP') {
    return conversation.participants.every((participant: any) => hasOneOf(roleSet(participant.user), STAFF_ROLES));
  }
  if (conversation.type === 'RECORD_THREAD') {
    // Record chatter is a staff tool: parents and students never get access.
    const self = conversation.participants.find((participant: any) => participant.userId === userId);
    return Boolean(self && hasOneOf(roleSet(self.user), STAFF_ROLES));
  }
  if (conversation.type !== 'DIRECT') return true;
  const other = conversation.participants.find((participant: any) => participant.userId !== userId);
  if (!other) return false;
  const otherUser = { id: other.userId, ...other.user };
  return isAllowedRecipient(policy, otherUser) || isReplyOnlyRecipient(policy, otherUser);
};

const getSocketIO = () => {
  // Resolve lazily because the socket service uses this class for its access checks.
  const { getIO } = require('./socket.service') as typeof import('./socket.service');
  return getIO();
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ChatService {

  private static async directRecipientPolicy(requesterId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true, roles: true, studentLearner: { select: { id: true, parentId: true } } },
    });
    if (!requester) return null;

    const roles = roleSet(requester);
    if (hasOneOf(roles, new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER']))) {
      return { unrestricted: true, allowedIds: null as Set<string> | null, allowedRoles: null as Set<string> | null, denyRoles: new Set(['SUPER_ADMIN']) };
    }

    if (roles.has('TEACHER')) {
      const [staff, learners] = await Promise.all([
        prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            archived: false,
            OR: [{ role: { in: asUserRoles(STAFF_ROLES) } }, { roles: { hasSome: asUserRoles(STAFF_ROLES) } }],
          },
          select: { id: true },
        }),
        prisma.learner.findMany({
          where: {
            archived: false,
            enrollments: {
              some: {
                active: true,
                archived: false,
                class: {
                  active: true,
                  archived: false,
                  OR: [
                    { teacherId: requesterId },
                    { teacherAssignments: { some: { teacherId: requesterId } } },
                  ],
                },
              },
            },
          },
          select: { id: true, parentId: true },
        }),
      ]);
      const familyMembers = learners.length ? await prisma.familyMember.findMany({
        where: {
          userId: { not: null },
          status: 'ACTIVE',
          canLogin: true,
          familyAccount: {
            status: 'ACTIVE',
            archived: false,
            learners: { some: { learnerId: { in: learners.map((learner) => learner.id) } } },
          },
        },
        select: { userId: true },
      }) : [];
      // Students who write to this teacher can be answered, but a teacher
      // cannot start a private conversation with a student.
      const studentUserIds = await resolveStudentUserIdsForLearners(learners.map((learner) => learner.id));
      // A teacher who also holds an office role (e.g. head of curriculum) can be
      // contacted by any parent, not only parents of their own classes.
      const isSchoolContact = hasOneOf(roles, SCHOOL_CONTACT_ROLES);
      return {
        unrestricted: false,
        allowedIds: new Set([
          ...staff.map((user) => user.id),
          ...learners.map((learner) => learner.parentId).filter(Boolean) as string[],
          ...familyMembers.map((member) => member.userId).filter(Boolean) as string[],
        ]),
        allowedRoles: isSchoolContact ? new Set(['PARENT']) : null as Set<string> | null,
        replyOnlyIds: new Set(studentUserIds),
        replyOnlyRoles: isSchoolContact ? new Set(['STUDENT']) : null as Set<string> | null,
        denyRoles: new Set(['STUDENT', 'SUPER_ADMIN']),
      };
    }

    if (roles.has('PARENT')) {
      const learnerIds = await parentAccessService.getAccessibleLearnerIds(requesterId);
      const enrollments = learnerIds.length ? await prisma.classEnrollment.findMany({
        where: {
          learnerId: { in: learnerIds },
          active: true,
          archived: false,
          class: { active: true, archived: false },
        },
        select: {
          class: {
            select: {
              teacherId: true,
              teacherAssignments: { select: { teacherId: true } },
            },
          },
        },
      }) : [];
      const teacherIds = new Set<string>();
      enrollments.forEach(({ class: classRecord }) => {
        if (classRecord.teacherId) teacherIds.add(classRecord.teacherId);
        classRecord.teacherAssignments.forEach((assignment) => teacherIds.add(assignment.teacherId));
      });
      return {
        unrestricted: false,
        allowedIds: teacherIds,
        allowedRoles: SCHOOL_CONTACT_ROLES,
        denyRoles: new Set(['STUDENT', 'SUPER_ADMIN']),
      };
    }

    if (roles.has('STUDENT')) {
      const teacherIds = new Set<string>();
      if (requester.studentLearner) {
        const enrollments = await prisma.classEnrollment.findMany({
          where: {
            learnerId: requester.studentLearner.id,
            active: true,
            archived: false,
            class: { active: true, archived: false },
          },
          select: {
            class: {
              select: {
                teacherId: true,
                teacherAssignments: { select: { teacherId: true } },
              },
            },
          },
        });
        enrollments.forEach(({ class: classRecord }) => {
          if (classRecord.teacherId) teacherIds.add(classRecord.teacherId);
          classRecord.teacherAssignments.forEach((assignment) => teacherIds.add(assignment.teacherId));
        });
      }
      if (requester.studentLearner?.parentId) teacherIds.add(requester.studentLearner.parentId);
      return {
        unrestricted: false,
        allowedIds: teacherIds,
        allowedRoles: SCHOOL_CONTACT_ROLES,
        denyRoles: new Set(['STUDENT', 'SUPER_ADMIN']),
      };
    }

    if (hasOneOf(roles, STAFF_ROLES)) {
      // Office roles that parents/students can contact (receptionist, head of
      // curriculum, accountant, ...) must be able to see and answer those
      // conversations. They may start one with a parent, but only reply to students.
      const isSchoolContact = hasOneOf(roles, SCHOOL_CONTACT_ROLES);
      return {
        unrestricted: false,
        allowedIds: null as Set<string> | null,
        allowedRoles: isSchoolContact ? new Set([...STAFF_ROLES, 'PARENT']) : STAFF_ROLES,
        replyOnlyRoles: isSchoolContact ? new Set(['STUDENT']) : null as Set<string> | null,
        denyRoles: new Set(isSchoolContact ? ['SUPER_ADMIN'] : ['STUDENT', 'PARENT', 'SUPER_ADMIN']),
      };
    }
    return { unrestricted: false, allowedIds: new Set<string>(), allowedRoles: new Set<string>(), denyRoles: new Set<string>() };
  }

  /**
   * Enforce school-safe direct-message recipients using the same relationship
   * data used elsewhere for parent and teacher access. The UI search is only a
   * convenience; this check also runs when a caller submits a crafted user ID.
   */
  static async canStartDirect(requesterId: string, otherUserId: string): Promise<boolean> {
    if (!requesterId || !otherUserId || requesterId === otherUserId) return false;
    const [policy, recipient] = await Promise.all([
      ChatService.directRecipientPolicy(requesterId),
      prisma.user.findFirst({
        where: { id: otherUserId, archived: false, status: 'ACTIVE' },
        select: { id: true, role: true, roles: true },
      }),
    ]);
    if (!policy || !recipient) return false;
    return isAllowedRecipient(policy, recipient);
  }

  /** Record threads (chatter on school records) are a staff-only tool. */
  static async canUseRecordThreads(requesterId: string): Promise<boolean> {
    if (!requesterId) return false;
    const requester = await prisma.user.findFirst({
      where: { id: requesterId, archived: false, status: 'ACTIVE' },
      select: { role: true, roles: true },
    });
    return Boolean(requester && hasOneOf(roleSet(requester), STAFF_ROLES));
  }

  static async canCreateGroup(requesterId: string, participantIds: string[]): Promise<boolean> {
    const uniqueIds = [...new Set(participantIds)].filter((id) => id !== requesterId);
    if (!uniqueIds.length) return false;
    const users = await prisma.user.findMany({
      where: { id: { in: [requesterId, ...uniqueIds] }, archived: false, status: 'ACTIVE' },
      select: { id: true, role: true, roles: true },
    });
    if (users.length !== uniqueIds.length + 1) return false;
    return users.every((user) => hasOneOf(roleSet(user), STAFF_ROLES));
  }

  static async canAccessConversation(conversationId: string, userId: string): Promise<boolean> {
    const [conversation, policy] = await Promise.all([
      prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          type: true,
          participants: {
            where: { leftAt: null },
            select: { userId: true, user: { select: { role: true, roles: true, status: true, archived: true } } },
          },
        },
      }),
      ChatService.directRecipientPolicy(userId),
    ]);
    return isAccessibleWithPolicy(conversation, userId, policy);
  }

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
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId: creatorId, archivedAt: { not: null } },
        data: { archivedAt: null },
      });
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
  static async getInbox(userId: string, includeArchived = false) {
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
        ...(includeArchived ? {} : { archivedAt: null }),
        conversation: { type: { not: 'RECORD_THREAD' } },
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: { select: { ...userSelect, roles: true, status: true, archived: true } } },
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

    const inbox = participations
      .filter((p: any) => p.conversation.type !== 'RECORD_THREAD')
      .map((p: any) => {
        const lastReadAt = p.lastReadAt;
        return {
          ...p.conversation,
          myParticipantId: p.id,
          lastReadAt,
          archivedAt: p.archivedAt,
          pinnedAt: p.pinnedAt,
          mutedUntil: p.mutedUntil,
          unreadCount: 0,
          lastMessage: p.conversation.messages[0] ?? null,
        };
      });
    const policy = await ChatService.directRecipientPolicy(userId);
    const accessibleInbox = inbox
      .filter((conversation: any) => isAccessibleWithPolicy(conversation, userId, policy))
      .sort((a: any, b: any) => {
        const pinOrder = Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt));
        return pinOrder || new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime();
      });
    const unreadRows = accessibleInbox.length ? await prisma.chatMessage.groupBy({
      by: ['conversationId'],
      where: {
        deletedAt: null,
        senderId: { not: userId },
        OR: accessibleInbox.map((conversation: any) => ({
          conversationId: conversation.id,
          ...(conversation.lastReadAt ? { createdAt: { gt: conversation.lastReadAt } } : {}),
        })),
      },
      _count: { _all: true },
    }) : [];
    const unreadByConversation = new Map(unreadRows.map((row: any) => [row.conversationId, row._count._all]));
    return accessibleInbox.map((conversation: any) => ({
      ...conversation,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
      participants: conversation.participants.map((participant: any) => ({
        ...participant,
        user: (({ roles: _roles, status: _status, archived: _archived, ...user }: any) => user)(participant.user),
      })),
    }));
  }

  /** Return a user's sent chat messages from conversations they can access. */
  static async getOutbox(userId: string, limit = 100) {
    const accessibleConversations = await ChatService.getInbox(userId, true);
    const conversationIds = accessibleConversations.map((conversation: any) => conversation.id);
    if (!conversationIds.length) return [];

    return prisma.chatMessage.findMany({
      where: { senderId: userId, deletedAt: null, conversationId: { in: conversationIds } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: { select: userSelect } },
            },
          },
        },
      },
    });
  }

  static async updateInboxPreferences(
    conversationId: string,
    userId: string,
    preferences: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null; markUnread?: boolean },
  ) {
    if (!(await ChatService.canAccessConversation(conversationId, userId))) {
      throw new Error('Conversation not found or access denied');
    }
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });
    if (!participant) throw new Error('Conversation not found or access denied');

    return prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: {
        ...(typeof preferences.archived === 'boolean' ? { archivedAt: preferences.archived ? new Date() : null } : {}),
        ...(typeof preferences.pinned === 'boolean' ? { pinnedAt: preferences.pinned ? new Date() : null } : {}),
        ...(preferences.mutedUntil !== undefined ? { mutedUntil: preferences.mutedUntil ? new Date(preferences.mutedUntil) : null } : {}),
        ...(preferences.markUnread ? { lastReadAt: null } : {}),
      },
    });
  }

  /**
   * Get unread counts for all conversations a user is in.
   */
  static async getUnreadCounts(userId: string, includeArchived = false): Promise<Record<string, number>> {
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
        ...(includeArchived ? {} : { archivedAt: null }),
        conversation: { type: { not: 'RECORD_THREAD' } },
      },
      select: {
        conversationId: true,
        lastReadAt: true,
        conversation: {
          select: {
            type: true,
            participants: {
              where: { leftAt: null },
              select: { userId: true, user: { select: { role: true, roles: true, status: true, archived: true } } },
            },
          },
        },
      },
    });

    const counts: Record<string, number> = {};
    const policy = await ChatService.directRecipientPolicy(userId);
    const visibleParticipations = participations.filter((participation: any) =>
      isAccessibleWithPolicy(participation.conversation, userId, policy)
    );
    visibleParticipations.forEach((participant: any) => { counts[participant.conversationId] = 0; });
    if (visibleParticipations.length) {
      const unreadRows = await prisma.chatMessage.groupBy({
        by: ['conversationId'],
        where: {
          deletedAt: null,
          senderId: { not: userId },
          OR: visibleParticipations.map((participant: any) => ({
            conversationId: participant.conversationId,
            ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}),
          })),
        },
        _count: { _all: true },
      });
      unreadRows.forEach((row: any) => { counts[row.conversationId] = row._count._all; });
    }
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
    if (!participant || participant.leftAt || !(await ChatService.canAccessConversation(conversationId, userId))) {
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
    if (!participant || participant.leftAt || !(await ChatService.canAccessConversation(input.conversationId, input.senderId))) {
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
      prisma.conversationParticipant.updateMany({
        where: { conversationId: input.conversationId, leftAt: null },
        data: { archivedAt: null },
      }),
    ]);

    // Emit to all conversation participants EXCEPT the sender.
    // The sender already has the message via the optimistic bubble + HTTP response,
    // so broadcasting back to them causes the duplicate the user sees.
    try {
      const io = getSocketIO();
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
    if (!(await ChatService.canAccessConversation(msg.conversationId, userId))) throw new Error('Conversation access denied');

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      // Soft delete: the message disappears from every thread (queries filter on
      // deletedAt) but its text is kept so school staff can resolve disputes.
      data: { deletedAt: new Date() },
    });

    try {
      const io = getSocketIO();
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
    if (!(await ChatService.canAccessConversation(msg.conversationId, userId))) throw new Error('Conversation access denied');

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { body: newBody, editedAt: new Date() },
      include: { sender: { select: userSelect }, reactions: true },
    });

    try {
      const io = getSocketIO();
      io.to(`conv:${msg.conversationId}`).emit('chat:edited', updated);
    } catch (_) { /* non-critical */ }

    return updated;
  }

  // ── Read receipts ──────────────────────────────────────────────────────────

  /**
   * Mark all messages in a conversation as read up to now.
   */
  static async markRead(conversationId: string, userId: string) {
    if (!(await ChatService.canAccessConversation(conversationId, userId))) throw new Error('Conversation access denied');
    const now = new Date();
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId, leftAt: null },
      data: { lastReadAt: now },
    });

    try {
      const io = getSocketIO();
      io.to(`conv:${conversationId}`).emit('chat:read', { conversationId, userId, readAt: now });
    } catch (_) { /* non-critical */ }
  }

  // ── Reactions ──────────────────────────────────────────────────────────────

  /**
   * Toggle an emoji reaction on a message.
   */
  static async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { conversationId: true } });
    if (!message || !(await ChatService.canAccessConversation(message.conversationId, userId))) {
      throw new Error('Conversation access denied');
    }
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
        const io = getSocketIO();
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

    const policy = await ChatService.directRecipientPolicy(requesterId);
    if (!policy) return [];

    const recipientScopes: Prisma.UserWhereInput[] = [];
    if (policy.allowedIds?.size) recipientScopes.push({ id: { in: [...policy.allowedIds] } });
    if (policy.allowedRoles?.size) {
      const allowedRoles = asUserRoles(policy.allowedRoles);
      recipientScopes.push({ OR: [{ role: { in: allowedRoles } }, { roles: { hasSome: allowedRoles } }] });
    }
    if (!policy.unrestricted && !recipientScopes.length) return [];

    const searchConditions: Prisma.UserWhereInput[] = terms.map((term) => ({ OR: [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ] }));
    if (!policy.unrestricted) searchConditions.push({ OR: recipientScopes });
    if (policy.denyRoles.size) {
      const deniedRoles = asUserRoles(policy.denyRoles);
      searchConditions.push({ NOT: { OR: [
        { role: { in: deniedRoles } },
        { roles: { hasSome: deniedRoles } },
      ] } });
    }

    const candidates = await prisma.user.findMany({
      where: {
        id: {
          not: requesterId,
        },
        archived: false,
        status: 'ACTIVE',
        AND: searchConditions,
      },
      select: { ...userSelect, roles: true, email: true },
      take: Math.min(limit * 4, 80),
    });
    const approved = candidates.filter((candidate) => {
      const candidateRoles = roleSet(candidate);
      if (hasOneOf(candidateRoles, policy.denyRoles)) return false;
      return policy.unrestricted || Boolean(policy.allowedIds?.has(candidate.id)) || Boolean(policy.allowedRoles && hasOneOf(candidateRoles, policy.allowedRoles));
    }).slice(0, limit);
    return approved.map(({ roles: _roles, email: _email, ...candidate }) => candidate);
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
