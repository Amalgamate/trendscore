/**
 * Subject Assignment Controller
 * Handles assigning teachers to specific subjects/learning areas.
 * Assignments can be scoped to a specific class (classId) — which carries
 * the stream distinction — or left at grade level (classId omitted/null).
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';

// Roles allowed for subject allocation — mirrors UserRole enum in Prisma schema
const ALLOWED_TEACHER_ROLES = [
    'TEACHER',
    'HEAD_TEACHER',
    'HEAD_OF_CURRICULUM',
    'ADMIN',
    'SUPER_ADMIN',
] as const;

export class SubjectAssignmentController {

    /**
     * GET /api/subject-assignments
     * Returns assignments filtered by optional query params.
     * Now includes the related class (name + stream) in the response.
     */
    async getAllAssignments(req: AuthRequest, res: Response) {
        const { grade, teacherId, learningAreaId, classId } = req.query;

        const where: Record<string, unknown> = {};
        if (grade)          where.grade          = grade as string;
        if (teacherId)      where.teacherId      = teacherId as string;
        if (learningAreaId) where.learningAreaId = learningAreaId as string;
        if (classId)        where.classId        = classId as string;

        const assignments = await prisma.subjectAssignment.findMany({
            where,
            include: {
                teacher: {
                    select: { id: true, firstName: true, lastName: true, staffId: true },
                },
                learningArea: {
                    select: { id: true, name: true, shortName: true, gradeLevel: true },
                },
                class: {
                    select: { id: true, name: true, grade: true, stream: true },
                },
            },
            orderBy: [
                { grade: 'asc' },
                { learningArea: { name: 'asc' } },
            ],
        });

        res.json({ success: true, data: assignments });
    }

    /**
     * POST /api/subject-assignments
     * Assigns a teacher to a subject.  When classId is supplied the assignment is
     * scoped to that specific class/stream.  When omitted it falls back to the
     * legacy grade-level assignment.
     *
     * Body: { teacherId, learningAreaId, grade, classId? }
     */
    async createAssignment(req: AuthRequest, res: Response) {
        const { teacherId, learningAreaId, grade, classId } = req.body;

        if (!teacherId || !learningAreaId || !grade) {
            throw new ApiError(400, 'teacherId, learningAreaId and grade are required');
        }

        // Verify teacher exists and has an allowed role
        const teacher = await prisma.user.findUnique({
            where: { id: teacherId },
            select: { id: true, role: true },
        });

        if (!teacher || !(ALLOWED_TEACHER_ROLES as readonly string[]).includes(teacher.role)) {
            throw new ApiError(400, 'Invalid teacher or role not allowed for subject allocation');
        }

        // Verify learning area exists
        const learningArea = await prisma.learningArea.findUnique({
            where: { id: learningAreaId },
        });
        if (!learningArea) {
            throw new ApiError(404, 'Learning Area not found');
        }

        // Optionally verify the class exists when classId is supplied
        if (classId) {
            const cls = await prisma.class.findUnique({ where: { id: classId } });
            if (!cls) throw new ApiError(404, 'Class not found');
        }

        let assignment;

        if (classId) {
            // Class-scoped assignment — upsert on (teacherId, learningAreaId, classId)
            // using a raw findFirst + upsert because the partial unique index cannot be
            // expressed as a Prisma @@unique compound (partial indexes are SQL-only).
            const existing = await prisma.subjectAssignment.findFirst({
                where: { teacherId, learningAreaId, classId },
            });

            if (existing) {
                assignment = await prisma.subjectAssignment.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            } else {
                assignment = await prisma.subjectAssignment.create({
                    data: { teacherId, learningAreaId, grade, classId, active: true },
                });
            }
        } else {
            // Legacy grade-level assignment — upsert on (teacherId, learningAreaId, grade, classId=null)
            const existing = await prisma.subjectAssignment.findFirst({
                where: { teacherId, learningAreaId, grade, classId: null },
            });

            if (existing) {
                assignment = await prisma.subjectAssignment.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            } else {
                assignment = await prisma.subjectAssignment.create({
                    data: { teacherId, learningAreaId, grade, classId: null, active: true },
                });
            }
        }

        res.status(201).json({ success: true, data: assignment });
    }

    /**
     * DELETE /api/subject-assignments/:id
     */
    async removeAssignment(req: AuthRequest, res: Response) {
        const { id } = req.params;

        await prisma.subjectAssignment.delete({ where: { id } });

        res.json({ success: true, message: 'Assignment removed successfully' });
    }

    /**
     * GET /api/subject-assignments/eligible-teachers
     * Returns teachers assigned to a learning area, optionally filtered by classId or grade.
     */
    async getEligibleTeachers(req: AuthRequest, res: Response) {
        const { learningAreaId, grade, classId } = req.query;

        if (!learningAreaId) {
            throw new ApiError(400, 'learningAreaId is required');
        }

        const where: Record<string, unknown> = {
            learningAreaId: learningAreaId as string,
            active: true,
        };

        if (classId) {
            where.classId = classId as string;
        } else if (grade) {
            where.grade   = grade as string;
            where.classId = null;
        }

        const assignments = await prisma.subjectAssignment.findMany({
            where,
            include: {
                teacher: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        const teachers = assignments.map((a) => a.teacher);
        res.json({ success: true, data: teachers });
    }
}

export const subjectAssignmentController = new SubjectAssignmentController();
