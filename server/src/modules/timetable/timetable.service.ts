import { Prisma, TimetableVersionStatus } from '@prisma/client';
import prisma from '../../config/database';
import { conflictEngine } from './conflict-engine.service';

const entryInclude = {
  class: { select: { id: true, name: true, grade: true, stream: true } },
  learningArea: { select: { id: true, name: true, shortName: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  room: true,
  bellPeriod: true
} satisfies Prisma.TimetableEntryInclude;

export class TimetableService {
  async foundation() {
    const [bellSchedules, rooms, allocations, availability, plans] = await Promise.all([
      prisma.bellSchedule.findMany({ include: { periods: { orderBy: { sequence: 'asc' } } }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
      prisma.timetableRoom.findMany({ orderBy: { name: 'asc' } }),
      prisma.instructionalAllocation.findMany({ include: { learningArea: { select: { id: true, name: true, shortName: true } } }, orderBy: [{ grade: 'asc' }, { learningArea: { name: 'asc' } }] }),
      prisma.teacherAvailability.findMany({ include: { teacher: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ day: 'asc' }, { startTime: 'asc' }] }),
      prisma.timetablePlan.findMany({ include: { bellSchedule: true, versions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } })
    ]);
    return { bellSchedules, rooms, allocations, availability, plans };
  }

  createBellSchedule(data: Prisma.BellScheduleCreateInput) {
    return prisma.$transaction(async tx => {
      if (data.isDefault) await tx.bellSchedule.updateMany({ data: { isDefault: false } });
      return tx.bellSchedule.create({ data, include: { periods: { orderBy: { sequence: 'asc' } } } });
    });
  }

  async updateBellSchedule(id: string, data: { name?: string; description?: string; isDefault?: boolean; active?: boolean }) {
    return prisma.$transaction(async tx => {
      if (data.isDefault) await tx.bellSchedule.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.bellSchedule.update({
        where: { id },
        data,
        include: { periods: { orderBy: { sequence: 'asc' } } }
      });
    });
  }

  async updateBellPeriod(periodId: string, data: { name?: string; type?: any; instructional?: boolean; active?: boolean }) {
    return prisma.bellPeriod.update({
      where: { id: periodId },
      data
    });
  }

  createRoom(data: Prisma.TimetableRoomCreateInput) {
    return prisma.timetableRoom.create({ data });
  }

  updateRoom(id: string, data: { name?: string; code?: string; type?: any; capacity?: number; building?: string; floor?: string; active?: boolean; notes?: string }) {
    return prisma.timetableRoom.update({ where: { id }, data });
  }

  upsertAllocation(data: Prisma.InstructionalAllocationUncheckedCreateInput) {
    return prisma.instructionalAllocation.upsert({
      where: { academicYear_grade_learningAreaId: { academicYear: data.academicYear, grade: data.grade, learningAreaId: data.learningAreaId } },
      create: data,
      update: data,
      include: { learningArea: { select: { id: true, name: true, shortName: true } } }
    });
  }

  upsertTeacherAvailability(data: Prisma.TeacherAvailabilityUncheckedCreateInput) {
    return prisma.teacherAvailability.upsert({
      where: { teacherId_day_startTime_endTime: { teacherId: data.teacherId, day: data.day, startTime: data.startTime, endTime: data.endTime } },
      create: data,
      update: data,
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  async createPlan(data: { name: string; academicYear: number; term: any; bellScheduleId: string; description?: string; createdById?: string }) {
    return prisma.$transaction(async tx => {
      const plan = await tx.timetablePlan.create({ data });
      const version = await tx.timetableVersion.create({ data: { planId: plan.id, version: 1, createdById: data.createdById } });
      return { ...plan, versions: [version] };
    });
  }

  async listVersions(planId: string) {
    return prisma.timetableVersion.findMany({
      where: { planId },
      orderBy: { version: 'desc' },
      select: {
        id: true, version: true, status: true, changeNote: true,
        createdAt: true, publishedAt: true, approvedAt: true,
        _count: { select: { entries: true } }
      }
    });
  }

  async versionEntries(versionId: string) {
    return prisma.timetableEntry.findMany({ where: { versionId }, include: entryInclude, orderBy: [{ day: 'asc' }, { startTime: 'asc' }] });
  }

  async replaceVersionEntries(versionId: string, entries: Prisma.TimetableEntryUncheckedCreateWithoutVersionInput[]) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({ where: { id: versionId } });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status)) throw new Error('This timetable version is not editable.');
    await prisma.$transaction([
      prisma.timetableEntry.deleteMany({ where: { versionId, locked: false } }),
      prisma.timetableEntry.createMany({ data: entries.map(entry => ({ ...entry, versionId })) })
    ]);
    return this.versionEntries(versionId);
  }

  async updateEntry(versionId: string, entryId: string, data: Prisma.TimetableEntryUncheckedUpdateInput) {
    const entry = await prisma.timetableEntry.findFirstOrThrow({ where: { id: entryId, versionId }, include: { version: true } });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(entry.version.status)) throw new Error('This timetable version is not editable.');
    const schedulingChange = ['day', 'startTime', 'endTime', 'bellPeriodId', 'classId', 'teacherId', 'roomId', 'learningAreaId']
      .some(field => Object.prototype.hasOwnProperty.call(data, field));
    if (entry.locked && schedulingChange) throw new Error('Unlock this lesson before moving or reassigning it.');
    return prisma.timetableEntry.update({ where: { id: entryId }, data, include: entryInclude });
  }

  async conflicts(versionId: string) {
    const entries = await prisma.timetableEntry.findMany({ where: { versionId } });
    const teacherIds = [...new Set(entries.map(entry => entry.teacherId).filter(Boolean))] as string[];
    const roomIds = [...new Set(entries.map(entry => entry.roomId).filter(Boolean))] as string[];
    const [teacherAvailability, roomAvailability] = await Promise.all([
      prisma.teacherAvailability.findMany({ where: { teacherId: { in: teacherIds } } }),
      prisma.roomAvailability.findMany({ where: { roomId: { in: roomIds } } })
    ]);
    return conflictEngine.detect(entries, teacherAvailability, roomAvailability);
  }

  async analytics(versionId: string) {
    const entries = await this.versionEntries(versionId);
    const byTeacher = new Map<string, any>(); const byClass = new Map<string, any>(); const byRoom = new Map<string, any>();
    for (const entry of entries) {
      if (entry.teacher) { const key = entry.teacher.id; const item = byTeacher.get(key) || { id: key, name: `${entry.teacher.firstName} ${entry.teacher.lastName}`, periods: 0, days: new Set() }; item.periods++; item.days.add(entry.day); byTeacher.set(key, item); }
      const classItem = byClass.get(entry.class.id) || { id: entry.class.id, name: entry.class.name, periods: 0, learningAreas: new Set() }; classItem.periods++; classItem.learningAreas.add(entry.learningAreaId); byClass.set(entry.class.id, classItem);
      if (entry.room) { const item = byRoom.get(entry.room.id) || { id: entry.room.id, name: entry.room.name, periods: 0 }; item.periods++; byRoom.set(entry.room.id, item); }
    }
    return { teachers: [...byTeacher.values()].map(x => ({ ...x, days: x.days.size })), classes: [...byClass.values()].map(x => ({ ...x, learningAreas: x.learningAreas.size })), rooms: [...byRoom.values()] };
  }

  async transition(versionId: string, status: TimetableVersionStatus) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({ where: { id: versionId } });
    const allowed: Record<string, TimetableVersionStatus[]> = { DRAFT: ['DEPARTMENT_REVIEW'], GENERATED: ['DEPARTMENT_REVIEW'], DEPARTMENT_REVIEW: ['DRAFT', 'DEPUTY_REVIEW'], DEPUTY_REVIEW: ['DEPARTMENT_REVIEW', 'PRINCIPAL_REVIEW'], PRINCIPAL_REVIEW: ['DEPUTY_REVIEW', 'APPROVED'], APPROVED: ['PRINCIPAL_REVIEW'] };
    if (!allowed[version.status]?.includes(status)) throw new Error(`Cannot move timetable from ${version.status} to ${status}.`);
    const data: any = { status }; if (status === 'DEPUTY_REVIEW') data.reviewedAt = new Date(); if (status === 'APPROVED') data.approvedAt = new Date();
    return prisma.timetableVersion.update({ where: { id: versionId }, data });
  }

  async cloneVersion(versionId: string, createdById?: string) {
    const source = await prisma.timetableVersion.findUniqueOrThrow({ where: { id: versionId }, include: { entries: true } });
    const latest = await prisma.timetableVersion.aggregate({ where: { planId: source.planId }, _max: { version: true } });
    return prisma.$transaction(async tx => { const version = await tx.timetableVersion.create({ data: { planId: source.planId, version: (latest._max.version || 0) + 1, changeNote: `Restored from version ${source.version}`, createdById } }); if (source.entries.length) await tx.timetableEntry.createMany({ data: source.entries.map(({ id, createdAt, updatedAt, versionId: _, ...entry }) => ({ ...entry, versionId: version.id })) }); return version; });
  }

  /** Count manual overrides currently on ClassSchedule for the plan's term/year.
   *  Used by the publish confirmation dialog to warn admins before they wipe overrides. */
  async getOverrideCount(versionId: string) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { plan: true, entries: { select: { classId: true } } }
    });
    const classIds = [...new Set(version.entries.map(e => e.classId))];
    if (!classIds.length) return { overrideCount: 0 };
    const overrideCount = await prisma.classSchedule.count({
      where: {
        classId: { in: classIds },
        academicYear: version.plan.academicYear,
        semester: version.plan.term,
        isOverride: true,
      }
    });
    return { overrideCount };
  }

  async publish(versionId: string) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { plan: true, entries: { include: { learningArea: true, room: true } } }
    });
    if (version.status !== TimetableVersionStatus.APPROVED) throw new Error('Only an approved timetable version can be published.');
    const conflicts = await this.conflicts(versionId);
    if (conflicts.some(conflict => conflict.severity === 'ERROR')) throw new Error('Resolve all hard conflicts before publishing.');

    const classIds = [...new Set(version.entries.map(entry => entry.classId))];

    // Count manual overrides that exist for this term — informational only.
    // Publishing always proceeds; the warning is surfaced in the UI so admins
    // know how many quick-edit changes will be replaced by this publish.
    const overrideCount = await prisma.classSchedule.count({
      where: {
        classId: { in: classIds },
        academicYear: version.plan.academicYear,
        semester: version.plan.term,
        isOverride: true,
      }
    });

    await prisma.$transaction(async tx => {
      await tx.classSchedule.deleteMany({
        where: { classId: { in: classIds }, academicYear: version.plan.academicYear, semester: version.plan.term }
      });
      if (version.entries.length) {
        await tx.classSchedule.createMany({ data: version.entries.map(entry => ({
          classId: entry.classId,
          subject: entry.learningArea.name,
          day: entry.day,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room?.name || null,
          teacherId: entry.teacherId,
          learningAreaId: entry.learningAreaId,
          semester: version.plan.term,
          academicYear: version.plan.academicYear,
          // Engine-published rows are canonical — not overrides
          isOverride: false,
        })) });
      }
      await tx.timetableVersion.updateMany({ where: { planId: version.planId, status: 'PUBLISHED' }, data: { status: TimetableVersionStatus.ARCHIVED } });
      await tx.timetableVersion.update({ where: { id: versionId }, data: { status: TimetableVersionStatus.PUBLISHED, publishedAt: new Date() } });
      await tx.timetablePlan.update({ where: { id: version.planId }, data: { status: 'ACTIVE' } });
    });
    return { versionId, publishedEntries: version.entries.length, replacedOverrides: overrideCount };
  }
}

export const timetableService = new TimetableService();
