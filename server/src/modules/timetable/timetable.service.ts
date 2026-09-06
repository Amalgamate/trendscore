import { Prisma, TimetableVersionStatus } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
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

  async updateBellPeriod(
    periodId: string,
    data: { name?: string; type?: any; instructional?: boolean; active?: boolean; startTime?: string; endTime?: string },
    cascade = true
  ) {
    // If timing is being changed and cascade is enabled, shift subsequent periods
    if ((data.startTime || data.endTime) && cascade) {
      const period = await prisma.bellPeriod.findUniqueOrThrow({
        where: { id: periodId },
        include: { bellSchedule: { include: { periods: { orderBy: { sequence: 'asc' } } } } }
      });

      const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

      const newStart = data.startTime ? toMinutes(data.startTime) : toMinutes(period.startTime);
      const newEnd   = data.endTime   ? toMinutes(data.endTime)   : toMinutes(period.endTime);
      const oldDuration = toMinutes(period.endTime) - toMinutes(period.startTime);
      const newDuration = newEnd - newStart;
      const shift = newDuration - oldDuration; // positive = break got longer → shift everything after forward

      const allPeriods = period.bellSchedule.periods;
      const laterPeriods = allPeriods.filter(p => p.sequence > period.sequence);

      await prisma.$transaction(async tx => {
        // Update the target period
        await tx.bellPeriod.update({ where: { id: periodId }, data });
        // Cascade-shift all subsequent periods
        if (shift !== 0) {
          for (const p of laterPeriods) {
            await tx.bellPeriod.update({
              where: { id: p.id },
              data: {
                startTime: toTime(toMinutes(p.startTime) + shift),
                endTime:   toTime(toMinutes(p.endTime)   + shift)
              }
            });
          }
        }
      });
      return prisma.bellPeriod.findUniqueOrThrow({ where: { id: periodId } });
    }

    return prisma.bellPeriod.update({ where: { id: periodId }, data });
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
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status)) throw new ApiError(400, 'This timetable version is not editable.');
    await prisma.$transaction([
      prisma.timetableEntry.deleteMany({ where: { versionId, locked: false } }),
      prisma.timetableEntry.createMany({ data: entries.map(entry => ({ ...entry, versionId })) })
    ]);
    return this.versionEntries(versionId);
  }

  async updateEntry(versionId: string, entryId: string, data: Prisma.TimetableEntryUncheckedUpdateInput) {
    const entry = await prisma.timetableEntry.findFirstOrThrow({ where: { id: entryId, versionId }, include: { version: true } });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(entry.version.status)) throw new ApiError(400, 'This timetable version is not editable.');
    const schedulingChange = ['day', 'startTime', 'endTime', 'bellPeriodId', 'classId', 'teacherId', 'roomId', 'learningAreaId']
      .some(field => Object.prototype.hasOwnProperty.call(data, field));
    if (entry.locked && schedulingChange) throw new ApiError(400, 'Unlock this lesson before moving or reassigning it.');
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
    if (!allowed[version.status]?.includes(status)) throw new ApiError(400, `Cannot move timetable from ${version.status} to ${status}.`);
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
      include: { plan: true, entries: { include: { learningArea: true, room: true, class: { select: { name: true } } } } }
    });
    if (version.status !== TimetableVersionStatus.APPROVED) throw new ApiError(400, 'Only an approved timetable version can be published.');
    const conflicts = await this.conflicts(versionId);
    if (conflicts.some(conflict => conflict.severity === 'ERROR')) throw new ApiError(400, 'Resolve all hard conflicts before publishing.');

    const classIds = [...new Set(version.entries.map(entry => entry.classId))];

    // Count manual overrides that exist for this term — informational only.
    // Publishing always proceeds; the warning is surfaced in the UI so admins
    // know how many quick-edit changes will be replaced by this publish.
    const replacedRows = await prisma.classSchedule.findMany({
      where: {
        classId: { in: classIds },
        academicYear: version.plan.academicYear,
        semester: version.plan.term
      },
      select: { id: true, classId: true, subject: true, day: true, startTime: true, endTime: true, isOverride: true }
    });
    const overrideCount = replacedRows.filter(row => row.isOverride).length;

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
      // Snapshot of the schedule rows this publish replaced, so overridden
      // lessons remain reconstructible after the destructive swap.
      await tx.auditLog.create({
        data: {
          action: 'TIMETABLE_PUBLISH_OVERRIDES_REPLACED',
          method: 'POST',
          path: `/timetable/versions/${versionId}/publish`,
          params: JSON.stringify({
            versionId,
            planId: version.planId,
            academicYear: version.plan.academicYear,
            semester: version.plan.term,
            replacedCount: replacedRows.length,
            replacedOverrides: overrideCount,
            rows: replacedRows.slice(0, 200)
          })
        }
      });
    });
    const replacedClassNames = [...new Set(replacedRows.map(row => row.classId))]
      .map(classId => version.entries.find(entry => entry.classId === classId)?.class.name || classId);
    return { versionId, publishedEntries: version.entries.length, replacedOverrides: overrideCount, replacedClasses: replacedClassNames };
  }

  async deletePlan(planId: string) {
    const plan = await prisma.timetablePlan.findUniqueOrThrow({
      where: { id: planId },
      include: { versions: true }
    });
    const hasPublished = plan.versions.some(v => v.status === 'PUBLISHED');
    await prisma.$transaction(async tx => {
      if (hasPublished) {
        await tx.classSchedule.deleteMany({
          where: { academicYear: plan.academicYear, semester: plan.term }
        });
      }
      await tx.timetablePlan.delete({ where: { id: planId } });
    });
    return { success: true, deletedPlanId: planId, planName: plan.name };
  }

  async resetVersion(versionId: string, clearLocked = true) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({ where: { id: versionId } });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status)) {
      throw new ApiError(400, 'Cannot reset a published or locked timetable version.');
    }
    await prisma.$transaction([
      prisma.timetableEntry.deleteMany({
        where: { versionId, ...(clearLocked ? {} : { locked: false }) }
      }),
      prisma.timetableVersion.update({
        where: { id: versionId },
        data: { status: 'DRAFT', changeNote: 'Reset to blank draft' }
      })
    ]);
    return this.versionEntries(versionId);
  }

  async resetLiveSchedule(academicYear: number, term: any) {
    return prisma.$transaction(async tx => {
      const count = await tx.classSchedule.count({
        where: { academicYear, semester: term }
      });
      await tx.classSchedule.deleteMany({
        where: { academicYear, semester: term }
      });
      await tx.timetableVersion.updateMany({
        where: { plan: { academicYear, term }, status: 'PUBLISHED' },
        data: { status: TimetableVersionStatus.ARCHIVED }
      });
      await tx.timetablePlan.updateMany({
        where: { academicYear, term, status: 'ACTIVE' },
        data: { status: 'DRAFT' }
      });
      return { success: true, clearedLessons: count };
    });
  }

  async deleteBellSchedule(id: string) {
    const plansUsing = await prisma.timetablePlan.count({ where: { bellScheduleId: id } });
    if (plansUsing > 0) {
      throw new ApiError(400, `Cannot delete this bell schedule because it is linked to ${plansUsing} timetable plan(s). Please delete or update those plans first.`);
    }
    await prisma.bellSchedule.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  async deleteRoom(id: string) {
    await prisma.timetableRoom.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  async deleteAllocation(id: string) {
    await prisma.instructionalAllocation.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  async clearAllocations(filter?: { academicYear?: number; grade?: string }) {
    const where: Prisma.InstructionalAllocationWhereInput = {};
    if (filter?.academicYear) where.academicYear = filter.academicYear;
    if (filter?.grade) where.grade = filter.grade;
    const result = await prisma.instructionalAllocation.deleteMany({ where });
    return { success: true, count: result.count };
  }

  async deleteTeacherAvailability(id: string) {
    await prisma.teacherAvailability.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  static readonly MASTER_RESET_CONFIRMATION = 'RESET-TIMETABLE-DATA';

  async masterReset(options: {
    confirm?: string;
    wipeLiveSchedules?: boolean;
    wipePlans?: boolean;
    wipeAllocations?: boolean;
    wipeRooms?: boolean;
    wipeAvailability?: boolean;
    wipeBellSchedules?: boolean;
  } = {}) {
    // Master reset is irreversible and can wipe the school's entire live
    // schedule. Require an explicit confirmation token (checked again here,
    // not just in the route validator) so this can never fire from a wipe
    // flag being filled in accidentally by a script or a future caller that
    // skips the route layer.
    if (options.confirm !== TimetableService.MASTER_RESET_CONFIRMATION) {
      throw new ApiError(400, `Master reset requires confirmation. Pass confirm: "${TimetableService.MASTER_RESET_CONFIRMATION}".`);
    }

    return prisma.$transaction(async tx => {
      let liveCount = 0;
      let planCount = 0;
      let allocCount = 0;
      let roomCount = 0;
      let availCount = 0;
      let bellCount = 0;

      // Every category below is opt-in (=== true) rather than opt-out, so a
      // caller that omits a flag never accidentally wipes that category.

      // 1. Live class schedules
      if (options.wipeLiveSchedules === true) {
        const res = await tx.classSchedule.deleteMany({});
        liveCount = res.count;
      }

      // 2. Plans, Versions, Entries, Change Requests
      if (options.wipePlans === true) {
        await tx.timetableChangeRequest.deleteMany({});
        await tx.timetableEntry.deleteMany({});
        await tx.timetableVersion.deleteMany({});
        const res = await tx.timetablePlan.deleteMany({});
        planCount = res.count;
      }

      // 3. Instructional Allocations
      if (options.wipeAllocations === true) {
        const res = await tx.instructionalAllocation.deleteMany({});
        allocCount = res.count;
      }

      // 4. Availability rules
      if (options.wipeAvailability === true) {
        await tx.roomAvailability.deleteMany({});
        const res = await tx.teacherAvailability.deleteMany({});
        availCount = res.count;
      }

      // 5. Rooms
      if (options.wipeRooms === true) {
        await tx.roomAvailability.deleteMany({});
        const res = await tx.timetableRoom.deleteMany({});
        roomCount = res.count;
      }

      // 6. Bell Schedules (only if plans also wiped)
      if (options.wipeBellSchedules === true) {
        if (options.wipePlans !== true) {
          throw new ApiError(400, 'Cannot wipe bell schedules without also wiping timetable plans.');
        }
        await tx.bellPeriod.deleteMany({});
        const res = await tx.bellSchedule.deleteMany({});
        bellCount = res.count;
      }

      return {
        success: true,
        summary: {
          clearedLiveSchedules: liveCount,
          clearedPlans: planCount,
          clearedAllocations: allocCount,
          clearedRooms: roomCount,
          clearedAvailability: availCount,
          clearedBellSchedules: bellCount,
        }
      };
    });
  }

  /**
   * Gap Analysis — cross-references active classes for the plan's term/year
   * against instructional allocations and generated entries. Returns a per-class
   * breakdown of scheduled vs. required periods and lists fully unscheduled classes.
   */
  async gapAnalysis(versionId: string) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        plan: true,
        entries: {
          include: {
            learningArea: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, grade: true } }
          }
        }
      }
    });

    const { academicYear, term } = version.plan;

    // All active classes for this year+term
    const activeClasses = await prisma.class.findMany({
      where: { academicYear, term, active: true, archived: false },
      select: { id: true, name: true, grade: true, stream: true }
    });

    // All instructional allocations for this year
    const allocations = await prisma.instructionalAllocation.findMany({
      where: { academicYear, active: true },
      include: { learningArea: { select: { id: true, name: true } } }
    });

    // Build entry map: classId → Map<learningAreaId, count>
    const entryMap = new Map<string, Map<string, number>>();
    for (const entry of version.entries) {
      if (!entryMap.has(entry.classId)) entryMap.set(entry.classId, new Map());
      const areaMap = entryMap.get(entry.classId)!;
      areaMap.set(entry.learningAreaId, (areaMap.get(entry.learningAreaId) || 0) + 1);
    }

    const classReports = activeClasses.map(cls => {
      const gradeAllocations = allocations.filter(a => a.grade === cls.grade);
      const areaMap = entryMap.get(cls.id) || new Map();
      const totalRequired = gradeAllocations.reduce((sum, a) => sum + a.targetWeeklyPeriods, 0);
      const totalScheduled = [...areaMap.values()].reduce((sum, n) => sum + n, 0);

      const subjects = gradeAllocations.map(alloc => ({
        learningAreaId: alloc.learningAreaId,
        learningAreaName: alloc.learningArea.name,
        required: alloc.targetWeeklyPeriods,
        scheduled: areaMap.get(alloc.learningAreaId) || 0,
        gap: alloc.targetWeeklyPeriods - (areaMap.get(alloc.learningAreaId) || 0)
      })).filter(s => s.gap !== 0);

      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        stream: cls.stream,
        totalRequired,
        totalScheduled,
        coveragePct: totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 100,
        hasEntries: entryMap.has(cls.id),
        subjectGaps: subjects
      };
    });

    const totalRequired  = classReports.reduce((sum, c) => sum + c.totalRequired, 0);
    const totalScheduled = classReports.reduce((sum, c) => sum + c.totalScheduled, 0);
    const unscheduledClasses = classReports.filter(c => !c.hasEntries);
    const partialClasses     = classReports.filter(c => c.hasEntries && c.coveragePct < 100);
    const fullyScheduled     = classReports.filter(c => c.coveragePct >= 100);

    return {
      versionId,
      academicYear,
      term,
      summary: {
        totalActiveClasses: activeClasses.length,
        fullyScheduled: fullyScheduled.length,
        partiallyScheduled: partialClasses.length,
        unscheduled: unscheduledClasses.length,
        overallCoveragePct: totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 0,
        totalRequired,
        totalScheduled
      },
      classes: classReports.sort((a, b) => a.coveragePct - b.coveragePct) // worst first
    };
  }
}

export const timetableService = new TimetableService();
