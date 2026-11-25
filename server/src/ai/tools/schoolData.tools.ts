/**
 * School Data Tools
 *
 * Read-only tools that let the assistant answer questions about learners, fees
 * and attendance from real data instead of guessing.
 *
 * Design notes:
 *   - Every tool resolves the learner through `assertLearnerReadAccess`, so the
 *     teacher/class scope is enforced before any row is read. The model cannot
 *     widen it.
 *   - Tools return compact, pre-summarised objects. A 1.5B model drowns in raw
 *     JSON, so we hand it numbers and short strings it can narrate directly.
 *   - Read-only by construction: no writes, so no confirmation gate is needed.
 */

import { registerTool } from './ToolRegistry';
import { assertLearnerReadAccess, getRestrictedClassIds } from '../permissions/learnerScope';
import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import type { AIContext, UserRole } from '../types';

const READ_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
];

/** Roles allowed to see money owed. Teachers and receptionists are not. */
const FEE_READ_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD_TEACHER',
  'ACCOUNTANT',
];

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} is required`);
  }
  return value.trim();
}

function money(value: unknown): number {
  return Number(value ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LEARNER LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'find_learner',
  description:
    'Find a learner by name or admission number. Returns id, name, grade and class so the learner can be referenced in later questions.',
  category: 'READ',
  allowedRoles: READ_ROLES,
  requiresConfirmation: false,
  async execute(input: Record<string, unknown>, context: AIContext) {
    const query = requiredString(input.query ?? input.name ?? input.admissionNumber, 'query');
    const restrictedClassIds = await getRestrictedClassIds(context);

    const learners = await prisma.learner.findMany({
      where: {
        archived: false,
        OR: [
          { admissionNumber: { equals: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
        ...(restrictedClassIds
          ? { enrollments: { some: { active: true, archived: false, classId: { in: restrictedClassIds } } } }
          : {}),
      },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        grade: true,
        stream: true,
        enrollments: {
          where: { active: true, archived: false },
          select: { class: { select: { name: true } } },
          take: 1,
        },
      },
      take: 10,
    });

    return {
      count: learners.length,
      restrictedToYourClasses: Boolean(restrictedClassIds),
      learners: learners.map((learner) => ({
        id: learner.id,
        admissionNumber: learner.admissionNumber,
        name: `${learner.firstName} ${learner.lastName}`.trim(),
        grade: learner.grade,
        stream: learner.stream || null,
        className: learner.enrollments[0]?.class?.name || null,
      })),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEE BALANCE
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'get_learner_fee_balance',
  description:
    'Get the outstanding fee balance for one learner, including invoiced, paid and balance amounts. Requires a learnerId from find_learner.',
  category: 'READ',
  allowedRoles: FEE_READ_ROLES,
  requiresConfirmation: false,
  async execute(input: Record<string, unknown>, context: AIContext) {
    const learnerId = requiredString(input.learnerId, 'learnerId');
    const scope = await assertLearnerReadAccess(learnerId, context);

    const [learner, invoiceTotals] = await Promise.all([
      prisma.learner.findUnique({
        where: { id: learnerId },
        select: { firstName: true, lastName: true, admissionNumber: true, grade: true },
      }),
      prisma.feeInvoice.aggregate({
        where: { learnerId, archived: false },
        _sum: { totalAmount: true, paidAmount: true, balance: true },
        _count: { _all: true },
      }),
    ]);

    return {
      learner: {
        name: `${learner?.firstName ?? ''} ${learner?.lastName ?? ''}`.trim(),
        admissionNumber: learner?.admissionNumber ?? null,
        grade: learner?.grade ?? null,
      },
      currency: 'KES',
      invoices: invoiceTotals._count._all,
      invoiced: money(invoiceTotals._sum.totalAmount),
      paid: money(invoiceTotals._sum.paidAmount),
      balance: money(invoiceTotals._sum.balance),
      classScoped: scope.classScoped,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'get_learner_attendance_summary',
  description:
    'Summarise a learner\'s attendance over the last N days: present, absent and late counts plus attendance rate. Requires a learnerId from find_learner.',
  category: 'READ',
  allowedRoles: READ_ROLES,
  requiresConfirmation: false,
  async execute(input: Record<string, unknown>, context: AIContext) {
    const learnerId = requiredString(input.learnerId, 'learnerId');
    await assertLearnerReadAccess(learnerId, context);

    const rawDays = Number(input.days ?? 30);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 365) : 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const grouped = await prisma.attendance.groupBy({
      by: ['status'],
      where: { learnerId, date: { gte: since } },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const row of grouped) counts[row.status] = row._count._all;

    const present = counts.PRESENT ?? 0;
    const absent = counts.ABSENT ?? 0;
    const late = counts.LATE ?? 0;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    return {
      days,
      daysRecorded: total,
      present,
      absent,
      late,
      other: total - present - absent - late,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEE ARREARS OVERVIEW (school-wide, leadership + accounts only)
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'get_fee_arrears_overview',
  description:
    'School-wide fee arrears: total owed, number of invoices unpaid, and the largest outstanding balances. Leadership and accounts only.',
  category: 'READ',
  allowedRoles: FEE_READ_ROLES,
  requiresConfirmation: false,
  async execute(_input: Record<string, unknown>, _context: AIContext) {
    const [totals, worst] = await Promise.all([
      prisma.feeInvoice.aggregate({
        where: { archived: false, balance: { gt: 0 } },
        _sum: { balance: true },
        _count: { _all: true },
      }),
      prisma.feeInvoice.findMany({
        where: { archived: false, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        select: {
          balance: true,
          learner: { select: { firstName: true, lastName: true, grade: true } },
        },
        take: 5,
      }),
    ]);

    return {
      currency: 'KES',
      invoicesWithBalance: totals._count._all,
      totalOutstanding: money(totals._sum.balance),
      largestBalances: worst.map((invoice) => ({
        learner: `${invoice.learner?.firstName ?? ''} ${invoice.learner?.lastName ?? ''}`.trim(),
        grade: invoice.learner?.grade ?? null,
        balance: money(invoice.balance),
      })),
    };
  },
});
