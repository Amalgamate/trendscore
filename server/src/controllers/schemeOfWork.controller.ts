import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { EmailService } from '../services/email.service';
import { SmsService } from '../services/sms.service';
import { z } from 'zod';
import { Term } from '@prisma/client';

import logger from '../utils/logger';
// Schema for a single week row
const weekSchema = z.object({
  weekNumber: z.number().int().min(1).max(20),
  strand: z.string().optional().nullable(),
  subStrand: z.string().optional().nullable(),
  outcomes: z.string().optional().nullable(),
  inquiryQuestions: z.string().optional().nullable(),
  activities: z.string().optional().nullable(),
  coreCompetencies: z.string().optional().nullable(),
  values: z.string().optional().nullable(),
  pertinentIssues: z.string().optional().nullable(),
  resources: z.string().optional().nullable(),
  assessment: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// Main SoW schema
const schemeOfWorkSchema = z.object({
  grade: z.string(),
  learningArea: z.string(),
  term: z.nativeEnum(Term),
  academicYear: z.number().int(),
  classId: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
  weeks: z.array(weekSchema).default([]),
});

export class SchemeOfWorkController {
  
  // Create a new Scheme of Work
  async create(req: Request, res: Response) {
    const data = schemeOfWorkSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if one already exists for this term/subject (prevent duplicates)
    // We enforce 1 SoW per teacher per Subject per Term per Year
    const existing = await (prisma as any).schemeOfWork.findUnique({
      where: {
        teacherId_grade_learningArea_term_academicYear: {
          teacherId: userId,
          grade: data.grade as any,
          learningArea: data.learningArea,
          term: data.term as any,
          academicYear: data.academicYear
        }
      }
    });

    if (existing) {
      throw new ApiError(400, 'A Scheme of Work already exists for this grade, learning area, and term.');
    }

    const newScheme = await (prisma as any).schemeOfWork.create({
      data: {
        teacherId: userId,
        grade: data.grade as any,
        learningArea: data.learningArea,
        term: data.term as any,
        academicYear: data.academicYear,
        classId: data.classId,
        title: data.title,
        status: data.status,
        weeks: {
          create: data.weeks.map(w => ({
            weekNumber: w.weekNumber,
            strand: w.strand,
            subStrand: w.subStrand,
            outcomes: w.outcomes,
            inquiryQuestions: w.inquiryQuestions,
            activities: w.activities,
            coreCompetencies: w.coreCompetencies,
            values: w.values,
            pertinentIssues: w.pertinentIssues,
            resources: w.resources,
            assessment: w.assessment,
            remarks: w.remarks
          }))
        }
      },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Scheme of Work created successfully',
      data: newScheme
    });
  }

  // Get list of Schemes of Work
  async getAll(req: Request, res: Response) {
    const userRole = req.user!.role;
    const userId = req.user!.userId;
    
    // Extract filters from query
    const { grade, learningArea, term, academicYear, status, teacherId } = req.query;

    const where: any = { archived: false };

    // Teachers only see their own
    if (userRole === 'TEACHER' || userRole === 'PARENT') {
      where.teacherId = userId;
    } else if (teacherId) {
      // Admins can filter by teacher
      where.teacherId = String(teacherId);
    }

    if (grade) where.grade = String(grade);
    if (learningArea) where.learningArea = String(learningArea);
    if (term) where.term = String(term);
    if (academicYear) where.academicYear = parseInt(String(academicYear));
    if (status) where.status = String(status);

    try {
      const schemes = await (prisma as any).schemeOfWork.findMany({
        where,
        include: {
          teacher: {
            select: { id: true, firstName: true, lastName: true }
          },
          _count: {
            select: { weeks: true }
          }
        },
        orderBy: [
          { academicYear: 'desc' },
          { term: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      res.json({ success: true, data: schemes });
    } catch (err: any) {
      logger.error('❌ Schemes Fetch Error:', err.message);
      res.status(500).json({ 
        success: false, 
        message: 'Could not fetch schemes of work. Ensure the database is migrated and the server is restarted.',
        error: err.message
      });
    }
  }

  // Get a specific Scheme of Work by ID
  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    const scheme = await (prisma as any).schemeOfWork.findUnique({
      where: { id },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' }
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    if (!scheme) throw new ApiError(404, 'Scheme of Work not found');

    // Access control
    if (userRole === 'TEACHER' && scheme.teacherId !== userId) {
      throw new ApiError(403, 'You do not have permission to view this Scheme of Work');
    }

    res.json({ success: true, data: scheme });
  }

  // Update a Scheme of Work and its weeks
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = schemeOfWorkSchema.partial().parse(req.body); // Allow partial updates
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const existing = await (prisma as any).schemeOfWork.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Scheme of Work not found');

    // Only creator can edit
    if (userRole === 'TEACHER' && existing.teacherId !== userId) {
      throw new ApiError(403, 'You can only edit your own Scheme of Work');
    }

    // Admins shouldn't directly edit submission content, only status
    // If not DRAFT or REJECTED, cannot edit content
    if (['SUBMITTED', 'APPROVED'].includes(existing.status) && req.body.weeks) {
      throw new ApiError(403, `Cannot edit a Scheme of Work that is ${existing.status}. Please change status to DRAFT or REJECTED first.`);
    }

    const nextIdentity = {
      teacherId: existing.teacherId,
      grade: data.grade ?? existing.grade,
      learningArea: data.learningArea ?? existing.learningArea,
      term: data.term ?? existing.term,
      academicYear: data.academicYear ?? existing.academicYear,
    };
    const duplicate = await (prisma as any).schemeOfWork.findFirst({
      where: { ...nextIdentity, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, 'A Scheme of Work already exists for this grade, learning area, term, and year.');
    }

    // Begin a transaction since we need to update the parent and replace the children (weeks)
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update the parent fields
      const updateData: any = {};
      if (data.grade !== undefined) updateData.grade = data.grade;
      if (data.learningArea !== undefined) updateData.learningArea = data.learningArea;
      if (data.term !== undefined) updateData.term = data.term;
      if (data.academicYear !== undefined) updateData.academicYear = data.academicYear;
      if (data.classId !== undefined) updateData.classId = data.classId;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.status !== undefined) updateData.status = data.status as any;

      await (tx as any).schemeOfWork.update({
        where: { id },
        data: updateData
      });

      // 2. If weeks are provided, replace them
      // (a simple approach is delete all, then create all again)
      if (data.weeks) {
        await (tx as any).schemeOfWorkWeek.deleteMany({
          where: { schemeId: id }
        });

        if (data.weeks.length > 0) {
          await (tx as any).schemeOfWorkWeek.createMany({
            data: data.weeks.map(w => ({
              schemeId: id,
              weekNumber: w.weekNumber,
              strand: w.strand,
              subStrand: w.subStrand,
              outcomes: w.outcomes,
              inquiryQuestions: w.inquiryQuestions,
              activities: w.activities,
              coreCompetencies: w.coreCompetencies,
              values: w.values,
              pertinentIssues: w.pertinentIssues,
              resources: w.resources,
              assessment: w.assessment,
              remarks: w.remarks
            }))
          });
        }
      }

      // 3. Fetch and return the updated entity
      return await (tx as any).schemeOfWork.findUnique({
        where: { id },
        include: {
          weeks: { orderBy: { weekNumber: 'asc' } },
          teacher: { select: { id: true, firstName: true, lastName: true } }
        }
      });
    });

    res.json({
      success: true,
      message: 'Scheme of Work updated successfully',
      data: updated
    });
  }

  // Change status (e.g., submit)
  async updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = z.object({
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'])
    }).parse(req.body);

    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const existing = await (prisma as any).schemeOfWork.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Scheme of Work not found');

    if (userRole === 'TEACHER') {
      // Teachers can only move strictly to SUBMITTED or DRAFT
      if (existing.teacherId !== userId) {
        throw new ApiError(403, 'You can only update your own Scheme of Work status');
      }
      if (!['DRAFT', 'SUBMITTED'].includes(status)) {
        throw new ApiError(403, 'Teachers can only draft or submit Schemes of Work');
      }
      if (existing.status === 'APPROVED') {
        throw new ApiError(403, 'Cannot change status of an approved Scheme of Work');
      }
    }

    const updated = await (prisma as any).schemeOfWork.update({
      where: { id },
      data: { status: status as any }
    });

    res.json({
      success: true,
      message: `Scheme of Work marked as ${status}`,
      data: updated
    });
  }

  // Review (Approve/Reject with comments) - Admin/Head Teacher only
  async review(req: Request, res: Response) {
    const { id } = req.params;
    const { status, remarks } = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      remarks: z.string().optional()
    }).parse(req.body);

    const userId = req.user!.userId;

    const existing = await (prisma as any).schemeOfWork.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Scheme of Work not found');

    const updated = await (prisma as any).schemeOfWork.update({
      where: { id },
      data: {
        status: status as any,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewComment: remarks || null
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    res.json({
      success: true,
      message: `Scheme of Work has been ${status.toLowerCase()}`,
      data: updated
    });

    // Notify submitting teacher of review decision
    (async () => {
      try {
        const teacher = updated.teacher;
        if (!teacher) return;

        const schemeName = `${updated.learningArea} (${updated.grade})`;
        const subject = `Scheme of Work ${status.toLowerCase()}`;
        const messageText = `Your Scheme of Work for ${schemeName} in ${updated.term} ${updated.academicYear} has been ${status.toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ''}`;
        const html = `
          <p>Dear ${teacher.firstName},</p>
          <p>Your Scheme of Work for <strong>${schemeName}</strong> in <strong>${updated.term} ${updated.academicYear}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
          ${remarks ? `<p><strong>Reviewer remarks:</strong> ${remarks}</p>` : ''}
          <p>Thank you.</p>
        `;

        if (teacher.email) {
          await EmailService.sendNotificationEmail({
            to: teacher.email,
            subject,
            text: messageText,
            html
          });
        }

        if (!teacher.email && teacher.phone) {
          await SmsService.sendSms(teacher.phone, messageText);
        }
      } catch (notifyError) {
        logger.error('Failed to notify teacher of scheme review:', notifyError);
      }
    })();
  }

  // Delete
  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const existing = await (prisma as any).schemeOfWork.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Scheme of Work not found');

    if (userRole === 'TEACHER' && existing.teacherId !== userId) {
      throw new ApiError(403, 'You can only delete your own Scheme of Work');
    }

    if (['SUBMITTED', 'APPROVED'].includes(existing.status) && userRole === 'TEACHER') {
      throw new ApiError(403, `Cannot delete a Scheme of Work that is ${existing.status}`);
    }

    await (prisma as any).schemeOfWork.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Scheme of Work deleted successfully'
    });
  }
}
