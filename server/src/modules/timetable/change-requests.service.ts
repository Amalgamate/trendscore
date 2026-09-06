import { Prisma, TimetableChangeRequestStatus } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import { NotificationService } from '../../services/notification.service';

const REVIEWER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];

const requestInclude = {
  class: { select: { id: true, name: true, grade: true, stream: true } },
  learningArea: { select: { id: true, name: true, shortName: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } }
} satisfies Prisma.TimetableChangeRequestInclude;

const userName = (user?: { firstName: string; lastName: string } | null) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'A user';

const timeToMinutes = (value: string) => {
  const [hours, mins] = String(value || '').split(':').map(Number);
  return (hours * 60) + mins;
};

const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);

export type CreateChangeRequestInput = {
  classId: string;
  day: string;
  startTime: string;
  endTime: string;
  learningAreaId?: string | null;
  teacherId?: string | null;
  requestedById: string;
  reason: string;
};

export class TimetableChangeRequestService {
  async create(input: CreateChangeRequestInput) {
    if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
      throw new ApiError(400, 'The requested end time must be after its start time.');
    }
    const classItem = await prisma.class.findFirst({
      where: { id: input.classId, active: true, archived: false }
    });
    if (!classItem) throw new ApiError(404, 'Class not found or is not active.');

    const request = await prisma.timetableChangeRequest.create({
      data: {
        classId: input.classId,
        day: input.day,
        startTime: input.startTime,
        endTime: input.endTime,
        learningAreaId: input.learningAreaId || null,
        teacherId: input.teacherId || null,
        requestedById: input.requestedById,
        reason: input.reason
      },
      include: requestInclude
    });

    // Best-effort notification to the reviewing roles; failures never block the request.
    try {
      await NotificationService.notifyRoles(REVIEWER_ROLES, {
        title: 'New timetable change request',
        message: `${userName(request.requestedBy)} requested a schedule change for ${request.class.name}: ${input.day} ${input.startTime}-${input.endTime}. Reason: ${input.reason}`,
        link: '/app/timetable'
      });
    } catch (error: any) {
      console.warn('[ChangeRequests] reviewer notification failed:', error?.message);
    }

    return request;
  }

  async list(options: { userId: string; canReviewAll: boolean; status?: TimetableChangeRequestStatus; take?: number; cursor?: string }) {
    const take = Math.min(Math.max(options.take ?? 200, 1), 500);
    const requests = await prisma.timetableChangeRequest.findMany({
      where: {
        ...(options.canReviewAll ? {} : { requestedById: options.userId }),
        ...(options.status ? { status: options.status } : {})
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {})
    });
    const hasMore = requests.length > take;
    const page = hasMore ? requests.slice(0, take) : requests;
    return { requests: page, hasMore, nextCursor: hasMore ? page[page.length - 1]?.id : null };
  }

  /** Atomically flips a PENDING request to a terminal status. Returns false
   *  (claim fails) if another reviewer already resolved it — closes the
   *  check-then-act gap between the initial status read and the write. */
  private async claim(tx: Prisma.TransactionClient, id: string, status: 'APPROVED' | 'REJECTED', reviewerId: string, reviewNote?: string) {
    const claim = await tx.timetableChangeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, reviewedById: reviewerId, reviewNote: reviewNote || null, reviewedAt: new Date() }
    });
    return claim.count > 0;
  }

  async reject(id: string, reviewerId: string, reviewNote?: string) {
    const request = await prisma.timetableChangeRequest.findUnique({ where: { id } });
    if (!request) throw new ApiError(404, 'Change request not found.');
    if (request.status !== 'PENDING') throw new ApiError(400, 'Only a pending change request can be reviewed.');

    const updated = await prisma.$transaction(async tx => {
      const claimed = await this.claim(tx, id, 'REJECTED', reviewerId, reviewNote);
      if (!claimed) throw new ApiError(409, 'This change request was already reviewed by someone else.');
      return tx.timetableChangeRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });
    await this.notifyRequester(updated, 'was rejected', reviewNote);
    return updated;
  }

  /** Applies the requested change as a ClassSchedule override after a clash
   *  check against the currently published schedule. The status claim and
   *  the clash re-check both happen inside the same transaction as the
   *  write, so two concurrent approvals of clashing requests can't both
   *  succeed. */
  async approve(id: string, reviewerId: string, reviewNote?: string) {
    const request = await prisma.timetableChangeRequest.findUnique({ where: { id }, include: requestInclude });
    if (!request) throw new ApiError(404, 'Change request not found.');
    if (request.status !== 'PENDING') throw new ApiError(400, 'Only a pending change request can be reviewed.');

    const classItem = await prisma.class.findUniqueOrThrow({ where: { id: request.classId } });

    let subject = 'Lesson';
    if (request.learningAreaId) {
      const area = await prisma.learningArea.findUnique({ where: { id: request.learningAreaId } });
      if (area) subject = area.name;
    }

    const termFilter = {
      active: true,
      academicYear: classItem.academicYear,
      semester: classItem.term,
      day: request.day
    };

    const updated = await prisma.$transaction(async tx => {
      const claimed = await this.claim(tx, id, 'APPROVED', reviewerId, reviewNote);
      if (!claimed) throw new ApiError(409, 'This change request was already reviewed by someone else.');

      // Re-check clashes inside the transaction (same connection as the
      // write below) rather than relying on the check done before this
      // transaction started.
      const classClash = await tx.classSchedule.findFirst({ where: { ...termFilter, classId: request.classId } });
      const teacherClash = request.teacherId ? await tx.classSchedule.findFirst({
        where: { ...termFilter, teacherId: request.teacherId, classId: { not: request.classId } }
      }) : null;
      const clash = classClash && overlaps(classClash, request) ? classClash
        : teacherClash && overlaps(teacherClash, request) ? teacherClash
          : null;
      if (clash) {
        const scope = clash.classId === request.classId ? 'the class' : 'the teacher';
        throw new ApiError(409, `Cannot approve: the requested time clashes with an existing lesson for ${scope} on ${request.day} (${clash.startTime}-${clash.endTime}).`);
      }

      await tx.classSchedule.create({
        data: {
          classId: request.classId,
          subject,
          day: request.day,
          startTime: request.startTime,
          endTime: request.endTime,
          teacherId: request.teacherId,
          learningAreaId: request.learningAreaId,
          semester: classItem.term,
          academicYear: classItem.academicYear,
          isOverride: true,
          overrideNote: `Change request ${request.id}: ${request.reason}`,
          overriddenAt: new Date(),
          overriddenBy: reviewerId
        }
      });

      return tx.timetableChangeRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });

    await this.notifyRequester(updated, 'was approved and applied to the published schedule', reviewNote);
    return updated;
  }

  private async notifyRequester(
    request: Prisma.TimetableChangeRequestGetPayload<{ include: typeof requestInclude }>,
    outcome: string,
    reviewNote?: string | null
  ) {
    try {
      await NotificationService.createNotification({
        userId: request.requestedById,
        title: 'Timetable change request update',
        message: `Your change request for ${request.class.name} (${request.day} ${request.startTime}-${request.endTime}) ${outcome}.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        link: '/app/timetable'
      });
    } catch (error: any) {
      console.warn('[ChangeRequests] requester notification failed:', error?.message);
    }
  }
}

export const timetableChangeRequestService = new TimetableChangeRequestService();
