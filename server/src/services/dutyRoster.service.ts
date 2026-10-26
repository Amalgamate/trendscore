import {
  DutyNotificationType,
  DutyRosterFrequency,
  UserRole,
  UserStatus
} from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { NotificationService, NotificationType } from './notification.service';

type AssignmentInput = {
  teacherId: string;
  dutyDate: string | Date;
  role?: string | null;
  notes?: string | null;
};

function rosterDay(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Roster and assignment dates must be valid');
  return date.toISOString().slice(0, 10);
}

function validateRosterDates(
  startValue: string | Date,
  endValue: string | Date | null | undefined,
  assignments: AssignmentInput[] = []
) {
  const startDay = rosterDay(startValue);
  const endDay = endValue ? rosterDay(endValue) : null;
  if (endDay && endDay < startDay) throw new ApiError(400, 'Roster end date must be on or after its start date');
  for (const assignment of assignments) {
    const day = rosterDay(assignment.dutyDate);
    if (day < startDay || (endDay && day > endDay)) {
      throw new ApiError(400, `Duty assignment date ${day} must fall within the roster date range`);
    }
  }
}

function toStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export class DutyRosterService {
  static async listRosters() {
    return prisma.dutyRoster.findMany({
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true, email: true } }
          },
          orderBy: { dutyDate: 'asc' }
        }
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  static async createRoster(params: {
    title: string;
    frequency: DutyRosterFrequency;
    startDate: string | Date;
    endDate?: string | Date | null;
    isActive?: boolean;
    reminderEnabled?: boolean;
    createdById: string;
    assignments?: AssignmentInput[];
  }) {
    const assignments = params.assignments ?? [];
    validateRosterDates(params.startDate, params.endDate, assignments);
    const rosterId = await prisma.$transaction(async (tx) => {
      const roster = await tx.dutyRoster.create({
        data: {
          title: params.title,
          frequency: params.frequency,
          startDate: new Date(params.startDate),
          endDate: params.endDate ? new Date(params.endDate) : null,
          isActive: params.isActive ?? true,
          reminderEnabled: params.reminderEnabled ?? true,
          createdById: params.createdById
        }
      });
      if (assignments.length) {
        await tx.dutyRosterAssignment.createMany({
          data: assignments.map((assignment) => ({
            rosterId: roster.id,
            teacherId: assignment.teacherId,
            dutyDate: new Date(assignment.dutyDate),
            role: assignment.role || null,
            notes: assignment.notes || null
          }))
        });
      }
      return roster.id;
    });

    return prisma.dutyRoster.findUnique({
      where: { id: rosterId },
      include: {
        assignments: {
          include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { dutyDate: 'asc' }
        }
      }
    });
  }

  static async updateRoster(
    rosterId: string,
    params: {
      title?: string;
      frequency?: DutyRosterFrequency;
      startDate?: string | Date;
      endDate?: string | Date | null;
      isActive?: boolean;
      reminderEnabled?: boolean;
      assignments?: AssignmentInput[];
    },
    actor?: { userId: string; canManageAll: boolean }
  ) {
    const existing = await prisma.dutyRoster.findUnique({
      where: { id: rosterId },
      include: { assignments: { select: { teacherId: true, dutyDate: true, role: true, notes: true } } },
    });
    if (!existing) throw new ApiError(404, 'Duty roster not found');
    if (actor && !actor.canManageAll && existing.createdById !== actor.userId) {
      throw new ApiError(403, 'You can only edit duty rosters you created');
    }
    const nextStart = params.startDate ?? existing.startDate;
    const nextEnd = params.endDate === undefined ? existing.endDate : params.endDate;
    const assignments = params.assignments;
    validateRosterDates(nextStart, nextEnd, assignments ?? existing.assignments);

    await prisma.$transaction(async (tx) => {
      await tx.dutyRoster.update({
        where: { id: rosterId },
        data: {
          title: params.title,
          frequency: params.frequency,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate === null ? null : params.endDate ? new Date(params.endDate) : undefined,
          isActive: params.isActive,
          reminderEnabled: params.reminderEnabled
        }
      });

      if (assignments) {
        await tx.dutyNotificationLog.deleteMany({ where: { assignment: { rosterId } } });
        await tx.dutyRosterAssignment.deleteMany({ where: { rosterId } });
        if (assignments.length) {
          await tx.dutyRosterAssignment.createMany({
            data: assignments.map((assignment) => ({
              rosterId,
              teacherId: assignment.teacherId,
              dutyDate: new Date(assignment.dutyDate),
              role: assignment.role || null,
              notes: assignment.notes || null
            }))
          });
        }
      }
    });

    return prisma.dutyRoster.findUnique({
      where: { id: rosterId },
      include: {
        assignments: {
          include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { dutyDate: 'asc' }
        }
      }
    });
  }

  static async deleteRoster(rosterId: string) {
    const existing = await prisma.dutyRoster.findUnique({ where: { id: rosterId } });
    if (!existing) throw new ApiError(404, 'Duty roster not found');
    await prisma.dutyRoster.delete({ where: { id: rosterId } });
    return { success: true };
  }

  static async getTeachersForDuty() {
    return prisma.user.findMany({
      where: {
        archived: false,
        status: UserStatus.ACTIVE,
        OR: [{ role: UserRole.TEACHER }, { roles: { has: UserRole.TEACHER } }]
      },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
  }

  static async sendDailyPreviousDayReminders(referenceDate = new Date()) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = toStartOfDay(tomorrow);
    const end = toEndOfDay(tomorrow);
    return this.sendRemindersByType(start, end, DutyNotificationType.PREVIOUS_DAY, 'Duty Reminder: Tomorrow', true);
  }

  static async sendDailySameDayReminders(referenceDate = new Date()) {
    const start = toStartOfDay(referenceDate);
    const end = toEndOfDay(referenceDate);
    return this.sendRemindersByType(start, end, DutyNotificationType.SAME_DAY, 'Duty Reminder: Today', false);
  }

  static async sendWeeklySummaries(referenceDate = new Date()) {
    const currentDay = referenceDate.getDay(); // 0 sunday
    const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay;
    const nextMonday = new Date(referenceDate);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    const weekStart = toStartOfDay(nextMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const start = weekStart;
    const end = toEndOfDay(weekEnd);

    const assignments = await prisma.dutyRosterAssignment.findMany({
      where: {
        dutyDate: { gte: start, lte: end },
        roster: {
          isActive: true,
          reminderEnabled: true
        }
      },
      include: {
        roster: true,
        teacher: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ teacherId: 'asc' }, { dutyDate: 'asc' }]
    });

    const grouped = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      if (!grouped.has(assignment.teacherId)) grouped.set(assignment.teacherId, []);
      grouped.get(assignment.teacherId)!.push(assignment);
    }

    let sent = 0;
    for (const [teacherId, teacherAssignments] of grouped.entries()) {
      const hasLog = await prisma.dutyNotificationLog.findFirst({
        where: {
          type: DutyNotificationType.WEEKLY_SUMMARY,
          assignmentId: { in: teacherAssignments.map((a) => a.id) }
        }
      });
      if (hasLog) continue;

      const summaryLines = teacherAssignments
        .slice(0, 5)
        .map((a) => `${new Date(a.dutyDate).toDateString()}${a.role ? ` (${a.role})` : ''}`)
        .join(', ');
      const extra = teacherAssignments.length > 5 ? ` +${teacherAssignments.length - 5} more` : '';
      await NotificationService.createNotification({
        userId: teacherId,
        title: 'Duty Reminder: Next Week',
        message: `You are on duty next week on: ${summaryLines}${extra}.`,
        type: NotificationType.INFO,
        link: '/app/planner',
        metadata: { kind: 'duty_roster', notificationType: DutyNotificationType.WEEKLY_SUMMARY }
      });

      await prisma.dutyNotificationLog.createMany({
        data: teacherAssignments.map((a) => ({ assignmentId: a.id, type: DutyNotificationType.WEEKLY_SUMMARY })),
        skipDuplicates: true
      });
      sent += 1;
    }

    return { sent };
  }

  private static async sendRemindersByType(
    start: Date,
    end: Date,
    type: DutyNotificationType,
    title: string,
    isTomorrow: boolean
  ) {
    const assignments = await prisma.dutyRosterAssignment.findMany({
      where: {
        dutyDate: { gte: start, lte: end },
        roster: {
          isActive: true,
          reminderEnabled: true
        }
      },
      include: {
        roster: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
        notificationLog: { where: { type }, select: { id: true } }
      },
      orderBy: { dutyDate: 'asc' }
    });

    let sent = 0;
    for (const assignment of assignments) {
      if (assignment.notificationLog.length > 0) continue;
      const dutyDate = new Date(assignment.dutyDate);
      const dateLabel = dutyDate.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' });
      await NotificationService.createNotification({
        userId: assignment.teacherId,
        title,
        message: isTomorrow
          ? `You are on duty tomorrow (${dateLabel})${assignment.role ? ` as ${assignment.role}` : ''}.`
          : `You are on duty today (${dateLabel})${assignment.role ? ` as ${assignment.role}` : ''}.`,
        type: NotificationType.INFO,
        link: '/app/planner',
        metadata: {
          kind: 'duty_roster',
          rosterId: assignment.rosterId,
          assignmentId: assignment.id,
          notificationType: type
        }
      });
      await prisma.dutyNotificationLog.create({
        data: {
          assignmentId: assignment.id,
          type
        }
      });
      sent += 1;
    }

    return { sent };
  }
}
