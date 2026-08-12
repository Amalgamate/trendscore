/**
 * LMS Service
 * Handles all Learning Management System operations
 *
 * @module services/lms.service
 */

import { PrismaClient, CourseStatus, ContentType, EnrollmentStatus } from '@prisma/client';
import { ApiError } from '../utils/error.util';

const prisma = new PrismaClient();

export class LMSService {
    /**
     * Course Management
     */

    async getCourses(filters: {
        search?: string;
        category?: string;
        status?: string;
        grade?: string;
        subject?: string;
        page?: number;
        limit?: number;
    }) {
        const { search, category, status, grade, subject, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (category) where.category = category;
        if (status) where.status = status;
        if (grade) where.grade = grade;
        if (subject) where.subject = subject;

        const [courses, total] = await Promise.all([
            prisma.lMSCourse.findMany({
                where,
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    _count: {
                        select: { enrollments: true, content: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.lMSCourse.count({ where })
        ]);

        return {
            courses,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getCourse(id: string) {
        return await prisma.lMSCourse.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true }
                },
                content: {
                    orderBy: { order: 'asc' }
                },
                enrollments: {
                    include: {
                        learner: {
                            select: { id: true, firstName: true, lastName: true, admissionNumber: true }
                        }
                    }
                },
                _count: {
                    select: { enrollments: true, content: true }
                }
            }
        });
    }

    async createCourse(data: {
        title: string;
        description: string;
        subject: string;
        grade: string;
        category: string;
        status?: CourseStatus;
        createdById: string;
    }) {
        return await prisma.lMSCourse.create({
            data: {
                ...data,
                status: data.status || CourseStatus.DRAFT
            }
        });
    }

    async updateCourse(id: string, data: Partial<{
        title: string;
        description: string;
        subject: string;
        grade: string;
        category: string;
        status: CourseStatus;
    }>) {
        return await prisma.lMSCourse.update({
            where: { id },
            data
        });
    }

    async deleteCourse(id: string) {
        // Check if course has active enrollments
        const activeEnrollments = await prisma.lMSEnrollment.count({
            where: {
                courseId: id,
                status: EnrollmentStatus.ACTIVE
            }
        });

        if (activeEnrollments > 0) {
            throw new ApiError(400, 'Cannot delete course with active enrollments');
        }

        await prisma.lMSCourse.delete({
            where: { id }
        });
    }

    /**
     * Content Management
     */

    async getContent(filters: {
        courseId?: string;
        type?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { courseId, type, search, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (courseId) where.courseId = courseId;
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [content, total] = await Promise.all([
            prisma.lMSContent.findMany({
                where,
                include: {
                    course: {
                        select: { id: true, title: true }
                    },
                    uploadedBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                },
                orderBy: { order: 'asc' },
                skip,
                take: limit
            }),
            prisma.lMSContent.count({ where })
        ]);

        return {
            content,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async uploadContent(data: {
        courseId: string;
        title: string;
        description?: string;
        type: ContentType;
        url: string;
        duration?: number;
        fileSize?: number;
        order?: number;
        uploadedById: string;
    }) {
        // Get the highest order for this course
        const maxOrder = await prisma.lMSContent.findFirst({
            where: { courseId: data.courseId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });

        const order = data.order || (maxOrder?.order || 0) + 1;

        return await prisma.lMSContent.create({
            data: {
                ...data,
                order
            }
        });
    }

    async deleteContent(id: string) {
        await prisma.lMSContent.delete({
            where: { id }
        });
    }

    /**
     * Enrollment Management
     */

    async getEnrollments(filters: {
        courseId?: string;
        learnerId?: string;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const { courseId, learnerId, status, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (courseId) where.courseId = courseId;
        if (learnerId) where.learnerId = learnerId;
        if (status) where.status = status;

        const [enrollments, total] = await Promise.all([
            prisma.lMSEnrollment.findMany({
                where,
                include: {
                    learner: {
                        select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true }
                    },
                    course: {
                        select: { id: true, title: true, subject: true }
                    },
                    enrolledBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                },
                orderBy: { enrolledAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.lMSEnrollment.count({ where })
        ]);

        return {
            enrollments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getStudentLearnerByUserId(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true, role: true }
        });

        if (!user || user.role !== 'STUDENT') {
            throw new ApiError(403, 'Unauthorized student access');
        }

        const usernameCandidates = [
            user.username,
            user.username?.replace(/-/g, '/'),
            user.email?.split('@')[0],
            user.email?.split('@')[0]?.replace(/-/g, '/')
        ].filter(Boolean) as string[];

        const learner = await prisma.learner.findFirst({
            where: {
                OR: [
                    { studentUserId: userId },
                    { admissionNumber: { in: usernameCandidates } },
                ],
            }
        });

        if (!learner) {
            throw new ApiError(404, 'Learner record not found for this student');
        }

        return learner;
    }

    async getStudentCourses(userId: string) {
        const learner = await this.getStudentLearnerByUserId(userId);

        const enrollments = await prisma.lMSEnrollment.findMany({
            where: {
                learnerId: learner.id,
                status: EnrollmentStatus.ACTIVE
            },
            include: {
                course: {
                    select: { id: true, title: true, subject: true, grade: true, description: true }
                },
                progress: true
            },
            orderBy: { enrolledAt: 'desc' }
        });

        const courseIds = enrollments.map(e => e.courseId);
        const totalCounts = courseIds.length ? await prisma.lMSContent.groupBy({
            by: ['courseId'],
            where: { courseId: { in: courseIds } },
            _count: { _all: true }
        }) : [];

        const totalCountMap = Object.fromEntries(totalCounts.map((count: { courseId: string; _count: { _all: number } }) => [count.courseId, count._count._all]));

        return enrollments.map((enrollment: { courseId: string; progress: Array<{ completed: boolean }>; id: string; course: { id: string; title: string; subject: string; grade: string; description: string | null } }) => {
            const totalItems = totalCountMap[enrollment.courseId] || 0;
            const completedItems = enrollment.progress.filter((p: { completed: boolean }) => p.completed).length;
            const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return {
                courseId: enrollment.course.id,
                enrollmentId: enrollment.id,
                title: enrollment.course.title,
                subject: enrollment.course.subject,
                grade: enrollment.course.grade,
                description: enrollment.course.description || '',
                totalItems,
                completedItems,
                progressPercent
            };
        });
    }

    async getStudentCourse(userId: string, courseId: string) {
        const learner = await this.getStudentLearnerByUserId(userId);

        const enrollment = await prisma.lMSEnrollment.findFirst({
            where: {
                learnerId: learner.id,
                courseId,
                status: EnrollmentStatus.ACTIVE
            },
            include: {
                course: {
                    select: { id: true, title: true, subject: true, grade: true, description: true }
                },
                progress: true
            }
        });

        if (!enrollment) {
            throw new ApiError(404, 'Enrollment not found for this course');
        }

        const contentItems = await prisma.lMSContent.findMany({
            where: { courseId },
            orderBy: { order: 'asc' }
        });

        const progressMap = Object.fromEntries(enrollment.progress.map(p => [p.contentId, p]));

        return {
            courseId: enrollment.course.id,
            enrollmentId: enrollment.id,
            title: enrollment.course.title,
            subject: enrollment.course.subject,
            grade: enrollment.course.grade,
            description: enrollment.course.description,
            totalItems: contentItems.length,
            completedItems: enrollment.progress.filter(p => p.completed).length,
            progressPercent: contentItems.length > 0 ? Math.round((enrollment.progress.filter(p => p.completed).length / contentItems.length) * 100) : 0,
            contentItems: contentItems.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                contentType: item.type,
                contentUrl: item.url,
                completed: progressMap[item.id]?.completed || false
            }))
        };
    }

    async getStudentAssignments(userId: string) {
        const learner = await this.getStudentLearnerByUserId(userId);

        const enrollments = await prisma.lMSEnrollment.findMany({
            where: { learnerId: learner.id, status: EnrollmentStatus.ACTIVE },
            select: { id: true, courseId: true }
        });

        const courseIds = enrollments.map(e => e.courseId);
        const enrollmentIds = enrollments.map(e => e.id);

        if (courseIds.length === 0) {
            return [];
        }

        const assignments = await prisma.lMSContent.findMany({
            where: {
                courseId: { in: courseIds },
                type: ContentType.ASSIGNMENT,
                archived: false
            },
            include: {
                course: {
                    select: { id: true, title: true, subject: true }
                },
                progress: {
                    where: { enrollmentId: { in: enrollmentIds } }
                }
            },
            orderBy: { order: 'asc' }
        });

        return assignments.map(item => {
            const progress = item.progress[0];
            return {
                id: item.id,
                title: item.title,
                description: item.description,
                course: {
                    id: item.course.id,
                    title: item.course.title,
                    subject: item.course.subject
                },
                dueDate: null,
                totalPoints: 100,
                submission: progress ? {
                    submittedAt: progress.lastAccessedAt,
                    grade: null,
                    feedback: null
                } : null
            };
        });
    }

    async submitStudentAssignment(userId: string, assignmentId: string) {
        const learner = await this.getStudentLearnerByUserId(userId);

        const assignment = await prisma.lMSContent.findUnique({
            where: { id: assignmentId }
        });

        if (!assignment) {
            throw new ApiError(404, 'Assignment not found');
        }

        if (assignment.type !== ContentType.ASSIGNMENT) {
            throw new ApiError(400, 'Content is not an assignment');
        }

        const enrollment = await prisma.lMSEnrollment.findFirst({
            where: {
                learnerId: learner.id,
                courseId: assignment.courseId,
                status: EnrollmentStatus.ACTIVE
            }
        });

        if (!enrollment) {
            throw new ApiError(403, 'Not enrolled in this course');
        }

        const progress = await prisma.lMSProgress.upsert({
            where: {
                enrollmentId_contentId: {
                    enrollmentId: enrollment.id,
                    contentId: assignmentId
                }
            },
            update: {
                completed: true,
                progress: 100,
                timeSpent: 0,
                lastAccessedAt: new Date()
            },
            create: {
                enrollmentId: enrollment.id,
                contentId: assignmentId,
                completed: true,
                progress: 100,
                timeSpent: 0,
                lastAccessedAt: new Date()
            }
        });

        return {
            id: progress.id,
            contentId: progress.contentId,
            completed: progress.completed,
            progress: progress.progress,
            submission: {
                submittedAt: progress.lastAccessedAt,
                grade: null,
                feedback: null
            }
        };
    }

    async updateStudentProgress(userId: string, enrollmentId: string, data: {
        contentId: string;
        completed?: boolean;
        progress?: number;
        timeSpent?: number;
    }) {
        const learner = await this.getStudentLearnerByUserId(userId);

        const enrollment = await prisma.lMSEnrollment.findUnique({
            where: { id: enrollmentId }
        });

        if (!enrollment || enrollment.learnerId !== learner.id) {
            throw new ApiError(403, 'Forbidden to update this progress record');
        }

        return await this.updateProgress(enrollmentId, data);
    }

    async enrollLearner(data: {
        courseId: string;
        learnerId: string;
        enrolledById: string;
    }) {
        // Check if already enrolled
        const existingEnrollment = await prisma.lMSEnrollment.findFirst({
            where: {
                courseId: data.courseId,
                learnerId: data.learnerId,
                status: EnrollmentStatus.ACTIVE
            }
        });

        if (existingEnrollment) {
            throw new ApiError(400, 'Learner is already enrolled in this course');
        }

        return await prisma.lMSEnrollment.create({
            data: {
                ...data,
                status: EnrollmentStatus.ACTIVE,
                enrolledAt: new Date()
            }
        });
    }

    async unenrollLearner(enrollmentId: string) {
        await prisma.lMSEnrollment.update({
            where: { id: enrollmentId },
            data: {
                status: EnrollmentStatus.INACTIVE,
                unenrolledAt: new Date()
            }
        });
    }

    /**
     * Progress Tracking
     */

    async getLearnerProgress(learnerId: string, courseId: string) {
        const enrollment = await prisma.lMSEnrollment.findFirst({
            where: {
                learnerId,
                courseId,
                status: EnrollmentStatus.ACTIVE
            },
            include: {
                progress: {
                    include: {
                        content: {
                            select: { id: true, title: true, type: true, duration: true }
                        }
                    },
                    orderBy: { lastAccessedAt: 'desc' }
                }
            }
        });

        if (!enrollment) {
            throw new ApiError(404, 'Enrollment not found');
        }

        const totalContent = await prisma.lMSContent.count({
            where: { courseId }
        });

        const completedContent = enrollment.progress.filter(p => p.completed).length;
        const progressPercentage = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;

        return {
            enrollment,
            totalContent,
            completedContent,
            progressPercentage: Math.round(progressPercentage),
            progress: enrollment.progress
        };
    }

    async updateProgress(enrollmentId: string, data: {
        contentId: string;
        completed?: boolean;
        progress?: number;
        timeSpent?: number;
    }) {
        const { contentId, completed, progress, timeSpent } = data;

        return await prisma.lMSProgress.upsert({
            where: {
                enrollmentId_contentId: {
                    enrollmentId,
                    contentId
                }
            },
            update: {
                completed: completed ?? undefined,
                progress: progress ?? undefined,
                timeSpent: timeSpent ?? undefined,
                lastAccessedAt: new Date()
            },
            create: {
                enrollmentId,
                contentId,
                completed: completed || false,
                progress: progress || 0,
                timeSpent: timeSpent || 0,
                lastAccessedAt: new Date()
            }
        });
    }

    /**
     * Reports
     */

    async getLMSReports(filters: {
        courseId?: string;
        learnerId?: string;
        dateFrom?: string;
        dateTo?: string;
        reportType?: string;
    }) {
        const { courseId, learnerId, dateFrom, dateTo, reportType } = filters;

        const where: any = {};

        if (courseId) where.courseId = courseId;
        if (learnerId) where.learnerId = learnerId;

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        switch (reportType) {
            case 'enrollment':
                return await prisma.lMSEnrollment.findMany({
                    where,
                    include: {
                        learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
                        course: { select: { title: true, subject: true } }
                    },
                    orderBy: { enrolledAt: 'desc' }
                });

            case 'progress':
                return await prisma.lMSProgress.findMany({
                    where,
                    include: {
                        enrollment: {
                            include: {
                                learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
                                course: { select: { title: true, subject: true } }
                            }
                        },
                        content: { select: { title: true, type: true } }
                    },
                    orderBy: { lastAccessedAt: 'desc' }
                });

            default:
                return await prisma.lMSEnrollment.findMany({
                    where,
                    include: {
                        learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
                        course: { select: { title: true, subject: true } },
                        progress: {
                            include: {
                                content: { select: { title: true, type: true } }
                            }
                        }
                    },
                    orderBy: { enrolledAt: 'desc' }
                });
        }
    }

    async getLMSDashboardStats() {
        const [
            totalCourses,
            totalEnrollments,
            activeEnrollments,
            totalContent,
            recentEnrollments
        ] = await Promise.all([
            prisma.lMSCourse.count(),
            prisma.lMSEnrollment.count(),
            prisma.lMSEnrollment.count({ where: { status: EnrollmentStatus.ACTIVE } }),
            prisma.lMSContent.count(),
            prisma.lMSEnrollment.findMany({
                take: 5,
                orderBy: { enrolledAt: 'desc' },
                include: {
                    learner: { select: { firstName: true, lastName: true } },
                    course: { select: { title: true } }
                }
            })
        ]);

        return {
            totalCourses,
            totalEnrollments,
            activeEnrollments,
            totalContent,
            recentEnrollments
        };
    }
}
