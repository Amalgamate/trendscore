/**
 * Pulse Controller
 *
 * Returns today's school activity stream — a merged, enriched timeline of
 * staff clock-ins/outs, fee payments, user logins, and other key actions
 * from the audit_logs table.
 *
 * Fast: single table scan filtered to today, enriched with a user lookup.
 * Safe: strips raw HTTP paths; surfaces only friendly human-readable messages.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Action label map ─────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; category: string; icon: string }> = {
    STAFF_CLOCK_IN:            { label: 'Clocked in',             category: 'attendance', icon: '🟢' },
    STAFF_CLOCK_OUT:           { label: 'Clocked out',            category: 'attendance', icon: '🔴' },
    RECORD_PAYMENT:            { label: 'Fee payment recorded',   category: 'finance',    icon: '💰' },
    REVERSE_PAYMENT:           { label: 'Payment reversed',       category: 'finance',    icon: '↩️' },
    BULK_UPLOAD_FEE_PAYMENTS:  { label: 'Bulk fee upload',        category: 'finance',    icon: '📤' },
    MARK_STAFF_ATTENDANCE:     { label: 'Attendance marked',      category: 'attendance', icon: '📋' },
    LOGIN:                     { label: 'Logged in',              category: 'auth',       icon: '🔑' },
    LOGOUT:                    { label: 'Logged out',             category: 'auth',       icon: '👋' },
    CREATE_LEARNER:            { label: 'New learner admitted',   category: 'learners',   icon: '🎒' },
    UPDATE_LEARNER:            { label: 'Learner record updated', category: 'learners',   icon: '✏️' },
    ARCHIVE_LEARNER:           { label: 'Learner archived',       category: 'learners',   icon: '📦' },
    SUBMIT_LEAVE_REQUEST:      { label: 'Leave request submitted',category: 'hr',         icon: '📅' },
    APPROVE_LEAVE:             { label: 'Leave approved',         category: 'hr',         icon: '✅' },
    GENERATE_PAYROLL:          { label: 'Payroll generated',      category: 'finance',    icon: '💼' },
    CONFIRM_PAYROLL:           { label: 'Payroll confirmed',      category: 'finance',    icon: '✔️' },
    MARK_PAYROLL_PAID:         { label: 'Payroll paid',           category: 'finance',    icon: '🏦' },
    UPDATE_STAFF_HR:           { label: 'Staff record updated',   category: 'hr',         icon: '👤' },
    SCHOOL_SETTINGS:           { label: 'Settings updated',       category: 'system',     icon: '⚙️' },
    CREATE_PERFORMANCE_EVALUATION: { label: 'Performance review added', category: 'hr',  icon: '📊' },
};

const fallbackMeta = (action: string) => ({
    label: action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    category: 'system',
    icon: '📌',
});

// ── Controller ────────────────────────────────────────────────────────────────

export const getTodayPulse = async (req: AuthRequest, res: Response) => {
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(limitRaw, 300) : 100;
    const onlyCategory = req.query.category as string | undefined;

    // Today in UTC (server time) — use start-of-day for the filter
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch today's audit log entries
    const entries = await prisma.auditLog.findMany({
        where: {
            createdAt: { gte: todayStart },
            ...(onlyCategory
                ? {
                      action: {
                          in: Object.entries(ACTION_META)
                              .filter(([, v]) => v.category === onlyCategory)
                              .map(([k]) => k),
                      },
                  }
                : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    // Batch-load user display names for all actors in one query
    const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))] as string[];
    const users = userIds.length
        ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, firstName: true, lastName: true, role: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const pulse = entries.map((entry) => {
        const meta = ACTION_META[entry.action] || fallbackMeta(entry.action);
        const user = entry.userId ? userMap.get(entry.userId) : null;
        const actorName = user
            ? [user.firstName, user.lastName].filter(Boolean).join(' ') || entry.userEmail || 'Unknown'
            : entry.userEmail || 'System';
        const actorRole = user
            ? String(user.role || entry.userRole || '').replace(/_/g, ' ')
            : String(entry.userRole || '').replace(/_/g, ' ');

        return {
            id:         entry.id,
            timestamp:  entry.createdAt.toISOString(),
            icon:       meta.icon,
            label:      meta.label,
            category:   meta.category,
            actorName,
            actorRole,
            userId:     entry.userId,
        };
    });

    // Category counts for the summary chips
    const categoryCounts = pulse.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
    }, {});

    res.json({
        success: true,
        data:    pulse,
        meta: {
            total:          pulse.length,
            categoryCounts,
            generatedAt:    new Date().toISOString(),
        },
    });
};
