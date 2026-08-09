/**
 * Notification & Audit Tools
 *
 * READ-only tools that give the AI awareness of the user's notification
 * state and the school's audit trail. No writes — no confirmation needed.
 *
 * Tools:
 *   get_notification_summary   Brief the AI on what the user needs to action
 *   get_audit_trail            Query the ChangeHistory log for a given entity
 */

import { registerTool } from './ToolRegistry';
import prisma from '../../config/database';
import type { AIContext } from '../types';

// Every authenticated role can query their own notification summary
const ALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
  'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'RECEPTIONIST',
  'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK',
] as const;

// Only admin-level roles can query the global audit trail
const AUDIT_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER',
] as const;

// ─── get_notification_summary ─────────────────────────────────────────────────

registerTool({
  name: 'get_notification_summary',
  description:
    'Returns a structured summary of the current user\'s unread notifications, ' +
    'grouped by type (approvals, messages, alerts, LMS, system). ' +
    'Use this when the user asks "what do I have?", "what needs my attention?", ' +
    '"any updates?", or when you want to proactively brief them on open items. ' +
    'Also returns the 3 most recent audit events for context.',
  category: 'READ',
  allowedRoles: ALL_ROLES as unknown as any[],
  requiresConfirmation: false,

  execute: async (_input: unknown, context: AIContext) => {
    const userId = context.user.id;

    // Fetch unread notifications (max 100 — enough to categorise)
    const unread = await prisma.userNotification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        link: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Group by type
    const byType: Record<string, typeof unread> = {};
    for (const n of unread) {
      const key = n.type ?? 'INFO';
      if (!byType[key]) byType[key] = [];
      byType[key].push(n);
    }

    // Count unread chat messages across all conversations
    let unreadMessages = 0;
    try {
      const convParticipants = await prisma.conversationParticipant.findMany({
        where: { userId, leftAt: null },
        select: { conversationId: true, lastReadAt: true },
      });

      if (convParticipants.length > 0) {
        const counts = await Promise.all(
          convParticipants.map((p) =>
            prisma.chatMessage.count({
              where: {
                conversationId: p.conversationId,
                senderId: { not: userId },
                deletedAt: null,
                ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
              },
            })
          )
        );
        unreadMessages = counts.reduce((a, b) => a + b, 0);
      }
    } catch {
      // Non-critical — chat count is optional context
    }

    // Most recent 3 audit events for this school (gives AI recent-change context)
    let recentAudit: { action: string; userId: string | null; path: string | null; createdAt: Date }[] = [];
    try {
      recentAudit = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { action: true, userId: true, path: true, createdAt: true },
      });
    } catch {
      // AuditLog table may not exist in all environments
    }

    // Pending approvals specifically
    const approvalItems = (byType['APPROVAL'] ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      since: n.createdAt,
      link: n.link,
      meta: n.metadata,
    }));

    // Build a human-readable brief for the AI to include in its response
    const parts: string[] = [];

    if (approvalItems.length > 0) {
      const oldest = approvalItems[approvalItems.length - 1];
      const ageMs = Date.now() - new Date(oldest.since).getTime();
      const ageH  = Math.round(ageMs / 3_600_000);
      parts.push(
        `${approvalItems.length} pending approval${approvalItems.length > 1 ? 's' : ''} ` +
        `(oldest: ${ageH}h ago)`
      );
    }
    if (unreadMessages > 0) {
      parts.push(`${unreadMessages} unread chat message${unreadMessages > 1 ? 's' : ''}`);
    }

    const errorCount   = (byType['ERROR']   ?? []).length;
    const warningCount = (byType['WARNING'] ?? []).length;
    const lmsCount     = (byType['INFO']    ?? []).filter((n) => {
      const m = n.metadata as any;
      return m?.kind === 'LMS' || (n.link ?? '').includes('/learning/');
    }).length;

    if (errorCount > 0)   parts.push(`${errorCount} critical alert${errorCount > 1 ? 's' : ''}`);
    if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
    if (lmsCount > 0)     parts.push(`${lmsCount} LMS notification${lmsCount > 1 ? 's' : ''}`);

    const otherCount = unread.length
      - approvalItems.length
      - errorCount
      - warningCount
      - lmsCount;
    if (otherCount > 0) parts.push(`${otherCount} other notification${otherCount > 1 ? 's' : ''}`);

    const brief =
      parts.length === 0
        ? 'No pending items — your notifications are all clear.'
        : `You have: ${parts.join(', ')}.`;

    return {
      brief,
      totalUnread:      unread.length,
      unreadMessages,
      pendingApprovals: approvalItems,
      byType: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, v.length])
      ),
      recentAuditEvents: recentAudit.map((e) => ({
        action:    e.action,
        actor:     e.userId,
        resource:  e.path,
        timestamp: e.createdAt,
      })),
    };
  },
});

// ─── get_audit_trail ──────────────────────────────────────────────────────────

registerTool({
  name: 'get_audit_trail',
  description:
    'Query the school\'s change history log. Use when the user asks "who changed X?", ' +
    '"what happened to this record?", "show me recent changes", or needs an audit report. ' +
    'Can filter by entityType (e.g. Learner, Fee, User), entityId, actor userId, or action type.',
  category: 'READ',
  allowedRoles: AUDIT_ROLES as unknown as any[],
  requiresConfirmation: false,

  execute: async (input: any, _context: AIContext) => {
    const {
      entityType,
      entityId,
      actorId,
      action,
      limit = 20,
      cursor,
    } = input ?? {};

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId   = entityId;
    if (actorId)    where.changedBy   = actorId;
    if (action)     where.action      = action;
    if (cursor)     where.changedAt   = { lt: new Date(cursor) };

    const rows = await prisma.changeHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take:    Math.min(50, Number(limit) || 20),
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        field: true,
        oldValue: true,
        newValue: true,
        changedBy: true,
        changedAt: true,
        reason: true,
        changer: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    const formatted = rows.map((r) => ({
      id:         r.id,
      entityType: r.entityType,
      entityId:   r.entityId,
      action:     r.action,
      field:      r.field,
      oldValue:   r.oldValue,
      newValue:   r.newValue,
      actor:      r.changer
        ? `${r.changer.firstName ?? ''} ${r.changer.lastName ?? ''}`.trim() || r.changedBy
        : r.changedBy,
      actorRole:  r.changer?.role,
      changedAt:  r.changedAt,
      reason:     r.reason,
    }));

    const summary =
      formatted.length === 0
        ? 'No audit records found for those filters.'
        : `Found ${formatted.length} change record${formatted.length > 1 ? 's' : ''}.`;

    return { summary, records: formatted, hasMore: formatted.length === Math.min(50, Number(limit) || 20) };
  },
});
