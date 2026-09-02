/**
 * Class Controller
 * Handles class management and learner enrollment for a single-tenant environment
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { Term } from '@prisma/client';
import { configService } from '../services/config.service';
import { getInstitutionType } from '../utils/institutionNormalizer';

export class ClassController {
  private normalizeCapacity(value: any, fallback = 40): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  }

  private async generateClassCode(): Promise<string> {
    const totalClasses = await prisma.class.count();
    const nextNumber = totalClasses + 1;
    let classCode = `CLS-${String(nextNumber).padStart(5, '0')}`;

    let existing = await prisma.class.findUnique({ where: { classCode } });
    let counter = nextNumber;
    while (existing) {
      counter++;
      classCode = `CLS-${String(counter).padStart(5, '0')}`;
      existing = await prisma.class.findUnique({ where: { classCode } });
    }
    return classCode;
  }

  private async getActiveContext() {
    const activeConfig = await configService.getActiveTermConfig();
    if (activeConfig) {
      return { academicYear: activeConfig.academicYear, term: activeConfig.term };
    }

    // Fallback: If no active TermConfig, try to find the most recent year that has classes
    const latestClass = await prisma.class.findFirst({
      orderBy: { academicYear: 'desc' },
      select: { academicYear: true, term: true }
    });

    if (latestClass) {
      return { academicYear: latestClass.academicYear, term: latestClass.term };
    }

    // Ultimate fallback: current year
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    let term: Term = 'TERM_1';
    if (month >= 4 && month <= 7) term = 'TERM_2';
    if (month >= 8 && month <= 11) term = 'TERM_3';
    return { academicYear: year, term };
  }

  async getAllClasses(req: AuthRequest, res: Response) {
    const { grade, stream, academicYear, term, active = 'true' } = req.query;
    const institutionType = getInstitutionType(req);
    const whereClause: any = { institutionType };

    if (grade) whereClause.grade = grade as string;
    if (stream) whereClause.stream = stream as any;

    if (academicYear) whereClause.academicYear = parseInt(academicYear as string);
    if (term) whereClause.term = term as Term;

    // Track whether the caller pinned a specific term/year or we resolved it
    const callerPinnedTermYear = !!(academicYear || term);

    if (!academicYear && !term) {
      const context = await this.getActiveContext();
      whereClause.academicYear = context.academicYear;
      whereClause.term = context.term;
    }

    if (active) whereClause.active = active === 'true';

    // Scope teachers to only their assigned class(es) so the frontend
    // never needs to do its own fragile ID-matching filter.
    if (req.user?.role === 'TEACHER') {
      whereClause.teacherId = req.user.userId;
    }

    let classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { enrollments: { where: { active: true } } } },
      },
      orderBy: [{ grade: 'asc' }, { stream: 'asc' }],
    });

    // If the active-term query returned nothing (classes haven't been set up for
    // this term yet) and the caller didn't pin a specific term/year, fall back to
    // the most recent term that actually has classes for this institution so the
    // attendance, grading, and other pages never show an empty dropdown.
    if (classes.length === 0 && !callerPinnedTermYear) {
      const latestClassForInstitution = await prisma.class.findFirst({
        where: { institutionType, active: whereClause.active },
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
        select: { academicYear: true, term: true },
      });

      if (latestClassForInstitution) {
        const fallbackWhere = {
          ...whereClause,
          academicYear: latestClassForInstitution.academicYear,
          term: latestClassForInstitution.term,
        };
        classes = await prisma.class.findMany({
          where: fallbackWhere,
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
            _count: { select: { enrollments: { where: { active: true } } } },
          },
          orderBy: [{ grade: 'asc' }, { stream: 'asc' }],
        });
      }
    }

    // Augment each class with a learner count by grade (covers students admitted
    // without an explicit ClassEnrollment record)
    const classesWithOccupancy = await Promise.all(classes.map(async (cls) => {
      const enrollmentCount = cls._count.enrollments;

      // If no enrollment records, fall back to counting learners by grade+stream
      let occupancy = enrollmentCount;
      if (enrollmentCount === 0) {
        occupancy = await prisma.learner.count({
          where: {
            grade: cls.grade,
            institutionType,
            ...(cls.stream ? { stream: cls.stream } : {}),
            status: 'ACTIVE',
            archived: false,
          },
        });
      }

      return {
        ...cls,
        _count: { ...cls._count, enrollments: occupancy },
      };
    }));

    res.json({ success: true, data: classesWithOccupancy, count: classesWithOccupancy.length });
  }

  async getClassById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const institutionType = getInstitutionType(req);

    const classData = await prisma.class.findFirst({
      where: { id, institutionType },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        enrollments: {
          where: { active: true },
          include: {
            learner: {
              select: {
                id: true,
                admissionNumber: true,
                firstName: true,
                lastName: true,
                middleName: true,
                dateOfBirth: true,
                gender: true,
                status: true,
                photoUrl: true,
                feeInvoices: {
                  where: { status: { not: 'CANCELLED' } },
                  select: { id: true, totalAmount: true, paidAmount: true, balance: true, status: true },
                },
              },
            },
          },
          orderBy: { learner: { firstName: 'asc' } }
        },
        schedules: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            learningArea: { select: { id: true, name: true, shortName: true } }
          },
          orderBy: [
            { day: 'asc' },
            { startTime: 'asc' }
          ]
        }
      },
    });

    if (!classData) throw new ApiError(404, 'Class not found');
    res.json({ success: true, data: classData });
  }

  async createClass(req: AuthRequest, res: Response) {
    const { name, grade, stream, teacherId, academicYear, term, capacity = 40, room } = req.body;
    const institutionType = getInstitutionType(req);

    if (!grade || !String(stream || '').trim()) throw new ApiError(400, 'Grade and stream are required. Configure the stream first.');

    let finalYear = academicYear;
    let finalTerm = term;
    if (!finalYear || !finalTerm) {
      const context = await this.getActiveContext();
      finalYear = finalYear || context.academicYear;
      finalTerm = finalTerm || context.term;
    }

    if (teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true, firstName: true, lastName: true }
      });
      if (!teacher || (teacher.role !== 'TEACHER' && teacher.role !== 'HEAD_TEACHER')) throw new ApiError(400, 'Invalid teacher');
    }

    const finalStream = String(stream).trim();
    const configuredStream = await prisma.stream.findFirst({
      where: { name: finalStream, active: true, archived: false },
      select: { id: true },
    });
    if (!configuredStream) throw new ApiError(400, `Stream "${finalStream}" is not an active configured stream.`);
    const finalName = name || `${grade} ${finalStream}`;

    const existingClass = await prisma.class.findFirst({
      where: { institutionType, grade: grade as string, stream: finalStream as any, academicYear: finalYear, term: finalTerm as Term }
    });
    if (existingClass) throw new ApiError(409, 'Class already exists for this term');

    const classCode = await this.generateClassCode();
    const newClass = await prisma.class.create({
      data: { classCode, name: finalName, grade: grade as string, institutionType, stream: finalStream as any, teacherId, academicYear: finalYear, term: finalTerm as Term, capacity: this.normalizeCapacity(capacity), room },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
    });

    res.status(201).json({ success: true, data: newClass });
  }

  async updateClass(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name, teacherId, capacity, room, active } = req.body;

    const classData = await prisma.class.findUnique({ where: { id } });
    if (!classData) throw new ApiError(404, 'Class not found');

    const updateData: any = {};
    if (name) updateData.name = name;
    if (teacherId !== undefined) updateData.teacherId = teacherId;
    if (capacity !== undefined) updateData.capacity = this.normalizeCapacity(capacity, classData.capacity);
    if (room !== undefined) updateData.room = room;
    if (active !== undefined) updateData.active = active;

    const updatedClass = await prisma.class.update({
      where: { id },
      data: updateData,
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } }
    });

    res.json({ success: true, data: updatedClass });
  }

  async enrollLearner(req: AuthRequest, res: Response) {
    const { classId, learnerId } = req.body;
    if (!classId || !learnerId) throw new ApiError(400, 'Missing fields');

    const classData = await prisma.class.findUnique({ where: { id: classId } });
    if (!classData) throw new ApiError(404, 'Class not found');

    const learner = await prisma.learner.findUnique({ where: { id: learnerId } });
    if (!learner) throw new ApiError(404, 'Learner not found');

    const existingEnrollment = await prisma.classEnrollment.findFirst({
      where: { learnerId, active: true, class: { academicYear: classData.academicYear, term: classData.term } }
    });
    if (existingEnrollment && existingEnrollment.classId !== classId) {
      throw new ApiError(400, 'Learner already enrolled in another class this term');
    }

    const enrollment = await prisma.classEnrollment.upsert({
      where: { classId_learnerId: { classId, learnerId } },
      update: { active: true },
      create: { classId, learnerId }
    });

    res.status(201).json({ success: true, data: enrollment });
  }

  async unenrollLearner(req: AuthRequest, res: Response) {
    const { classId, learnerId } = req.body;
    await prisma.classEnrollment.update({
      where: { classId_learnerId: { classId, learnerId } },
      data: { active: false }
    });
    res.json({ success: true, message: 'Unenrolled successfully' });
  }

  async getLearnerClass(req: AuthRequest, res: Response) {
    const { learnerId } = req.params;
    const enrollment = await prisma.classEnrollment.findFirst({
      where: { learnerId, active: true },
      include: { class: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { enrolledAt: 'desc' }
    });
    res.json({ success: true, data: enrollment });
  }

  async getTeacherWorkload(req: AuthRequest, res: Response) {
    const { teacherId } = req.params;
    let { academicYear, term } = req.query;

    if (!academicYear || !term) {
      const context = await this.getActiveContext();
      academicYear = academicYear || context.academicYear.toString();
      term = term || context.term;
    }

    const classes = await prisma.class.findMany({
      where: {
        teacherId,
        academicYear: parseInt(academicYear as string),
        term: term as Term,
        active: true,
        archived: false,
      },
      include: {
        _count: { select: { enrollments: { where: { active: true } } } }
      }
    });

    const workloadClasses = classes.map(({ _count, ...classData }) => {
      const studentCount = _count.enrollments;
      const capacity = classData.capacity || 0;
      return {
        ...classData,
        studentCount,
        utilization: capacity > 0 ? Math.round((studentCount / capacity) * 100) : 0,
      };
    });

    res.json({
      success: true,
      data: {
        classes: workloadClasses,
        classCount: workloadClasses.length,
        totalStudents: workloadClasses.reduce((sum, classData) => sum + classData.studentCount, 0),
      }
    });
  }

  async assignTeacher(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { classId, teacherId } = req.body;

    const finalClassId = id || classId;

    if (!finalClassId) throw new ApiError(400, 'Class ID is required');
    if (!teacherId) throw new ApiError(400, 'Teacher ID is required');

    const updatedClass = await prisma.class.update({
      where: { id: finalClassId },
      data: { teacherId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
    });
    res.json({ success: true, data: updatedClass });
  }

  async unassignTeacher(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { classId } = req.body;

    const finalClassId = id || classId;

    if (!finalClassId) throw new ApiError(400, 'Class ID is required');

    const updatedClass = await prisma.class.update({
      where: { id: finalClassId },
      data: { teacherId: null },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
    });
    res.json({ success: true, data: updatedClass });
  }

  async getTeacherSchedules(req: AuthRequest, res: Response) {
    const { teacherId } = req.params;
    let { academicYear, term } = req.query;

    if (!academicYear || !term) {
      const context = await this.getActiveContext();
      academicYear = academicYear || context.academicYear.toString();
      term = term || context.term;
    }

    const parsedYear = parseInt(academicYear as string);
    const parsedTerm = term as Term;

    const schedules = await prisma.classSchedule.findMany({
      where: {
        teacherId,
        active: true,
        academicYear: parsedYear,
        class: { term: parsedTerm, active: true, archived: false },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            stream: true,
            term: true,
            academicYear: true,
          },
        },
        learningArea: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
      orderBy: [
        { academicYear: 'desc' },
        { day: 'asc' },
        { startTime: 'asc' },
      ],
    });

    res.json({ success: true, data: schedules });
  }

  async getClassSchedules(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const schedules = await prisma.classSchedule.findMany({
      where: { classId: id },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        learningArea: { select: { id: true, name: true, shortName: true } }
      },
      orderBy: [
        { day: 'asc' },
        { startTime: 'asc' }
      ]
    });
    res.json({ success: true, data: schedules });
  }

  async createClassSchedule(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { subject, day, startTime, endTime, room, teacherId, learningAreaId, semester, academicYear, overrideNote } = req.body;

    // Mark as a manual override when an admin/head teacher adds a lesson
    // to an already-published schedule. The overrideNote is required at the
    // route validation layer so it will always be present here.
    const isOverride = Boolean(overrideNote);

    const schedule = await prisma.classSchedule.create({
      data: {
        classId: id,
        subject,
        day,
        startTime,
        endTime,
        room,
        teacherId,
        learningAreaId,
        semester,
        academicYear: parseInt(academicYear as string) || new Date().getFullYear(),
        isOverride,
        overrideNote: isOverride ? overrideNote : null,
        overriddenAt: isOverride ? new Date() : null,
        overriddenBy: isOverride ? (req.user?.userId ?? null) : null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        learningArea: { select: { id: true, name: true, shortName: true } }
      }
    });

    res.status(201).json({ success: true, data: schedule });
  }

  async updateClassSchedule(req: AuthRequest, res: Response) {
    const { scheduleId } = req.params;
    const { subject, day, startTime, endTime, room, teacherId, learningAreaId, semester, academicYear, overrideNote } = req.body;

    // Every manual update to a published schedule is an override.
    // overrideNote is required at the route validation layer.
    const schedule = await prisma.classSchedule.update({
      where: { id: scheduleId },
      data: {
        subject,
        day,
        startTime,
        endTime,
        room,
        teacherId,
        learningAreaId,
        semester,
        academicYear: academicYear ? parseInt(academicYear as string) : undefined,
        isOverride: true,
        overrideNote,
        overriddenAt: new Date(),
        overriddenBy: req.user?.userId ?? null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        learningArea: { select: { id: true, name: true, shortName: true } }
      }
    });

    res.json({ success: true, data: schedule });
  }

  async deleteClassSchedule(req: AuthRequest, res: Response) {
    const { scheduleId } = req.params;
    await prisma.classSchedule.delete({
      where: { id: scheduleId }
    });
    res.json({ success: true, message: 'Schedule deleted successfully' });
  }
}

export const classController = new ClassController();
