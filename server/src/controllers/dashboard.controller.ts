import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { redisCacheService } from '../services/redis-cache.service';
import { configService } from '../services/config.service';
import { buildSnapshot, generateInsights } from '../services/insights.service';
import { reportDashboardService } from '../services/reportDashboard.service';
import { parentAccessService } from '../services/parent-access.service';
import { CanonicalInstitutionType } from '../utils/institutionNormalizer';

import logger from '../utils/logger';
// ─── TTL constants ─────────────────────────────────────────────────────────────
// Dashboard stats are aggregates — they don't need sub-second freshness.
// 5 min for admin covers multiple page loads within a work session.
// Pass ?fresh=1 to bypass cache for a manual refresh.
const ADMIN_CACHE_TTL   = 300; // 5 min
const TEACHER_CACHE_TTL = 120; // 2 min
const PARENT_CACHE_TTL  = 120; // 2 min
const STUDENT_CACHE_TTL = 120; // 2 min

const JUNIOR_FEE_GRADES = [
    'PLAYGROUP', 'PP1', 'PP2',
    'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5',
    'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9',
] as const;

const SENIOR_FEE_GRADES = ['GRADE_10', 'GRADE_11', 'GRADE_12'] as const;

const FEE_GRADE_LABELS: Record<string, string> = {
    PLAYGROUP: 'Playgroup',
    PP1: 'PP1',
    PP2: 'PP2',
    GRADE_1: 'Grade 1',
    GRADE_2: 'Grade 2',
    GRADE_3: 'Grade 3',
    GRADE_4: 'Grade 4',
    GRADE_5: 'Grade 5',
    GRADE_6: 'Grade 6',
    GRADE_7: 'Grade 7',
    GRADE_8: 'Grade 8',
    GRADE_9: 'Grade 9',
    GRADE_10: 'Grade 10',
    GRADE_11: 'Grade 11',
    GRADE_12: 'Grade 12',
};

const FEE_TERMS = ['TERM_1', 'TERM_2', 'TERM_3'] as const;
const FEE_TERM_LABELS: Record<string, string> = {
    TERM_1: 'Term 1',
    TERM_2: 'Term 2',
    TERM_3: 'Term 3',
};

const TUTOR_ROLES = ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'] as const;

const parseReportDashboardFilters = (query: AuthRequest['query']) => ({
    academicYear: query.academicYear ? Number(query.academicYear) : undefined,
    term: query.term,
    grade: query.grade,
    stream: query.stream,
    section: query.section,
    testType: query.testType,
});

const normalizeFeeGrade = (raw: unknown): string | null => {
    const value = String(raw ?? '').trim().toUpperCase();
    if (!value) return null;

    if (value.includes('PLAYGROUP') || value.includes('PLAY GROUP')) return 'PLAYGROUP';
    const pp = value.match(/\bPP\s*([12])\b/);
    if (pp) return `PP${pp[1]}`;

    const grade = value.match(/\bGRADE[_\s-]*(1[0-2]|[1-9])\b/);
    if (grade) return `GRADE_${grade[1]}`;

    return null;
};

export class DashboardController {

    private async getStudentLearnerForUser(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true, role: true },
        });

        if (!user || user.role !== 'STUDENT') {
            throw new ApiError(403, 'Unauthorized student access');
        }

        const usernameCandidates = [
            user.username,
            user.username?.replace(/-/g, '/'),
            user.email?.split('@')[0],
            user.email?.split('@')[0]?.replace(/-/g, '/'),
        ].filter(Boolean) as string[];

        const learner = await prisma.learner.findFirst({
            where: {
                admissionNumber: { in: usernameCandidates },
                archived: false,
            },
            include: {
                enrollments: {
                    where: { active: true },
                    include: {
                        class: { select: { id: true, name: true, grade: true, stream: true, room: true } },
                    },
                    take: 1,
                },
            },
        });

        if (!learner) {
            throw new ApiError(404, 'Learner record not found for this student');
        }

        return learner;
    }

    private async getDashboardMessages(userId: string, take = 5) {
        const [receipts, notifications] = await Promise.all([
            prisma.messageReceipt.findMany({
                where: { recipientId: userId },
                include: { message: true },
                orderBy: { createdAt: 'desc' },
                take,
            }),
            prisma.userNotification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take,
            }),
        ]);

        const inboxMessages = receipts.map((receipt) => ({
            id: receipt.id,
            from: receipt.message.senderType.replace(/_/g, ' '),
            subject: receipt.message.subject || 'Message',
            bodyPreview: receipt.message.body.slice(0, 140),
            time: this.formatRelativeDate(receipt.message.sentAt || receipt.message.createdAt),
            type: receipt.message.messageType,
            priority: receipt.readAt ? 'read' : 'unread',
            actionPage: 'comm-notices',
        }));

        const notificationMessages = notifications.map((notification) => ({
            id: notification.id,
            from: 'System',
            subject: notification.title,
            bodyPreview: notification.message.slice(0, 140),
            time: this.formatRelativeDate(notification.createdAt),
            type: notification.type,
            priority: notification.isRead ? 'read' : 'unread',
            actionPage: notification.link || 'comm-notices',
        }));

        return [...inboxMessages, ...notificationMessages]
            .sort((a, b) => (a.priority === 'unread' ? -1 : 1) - (b.priority === 'unread' ? -1 : 1))
            .slice(0, take);
    }

    private async getParentHomeworkItems(children: Array<{ id: string; name: string }>, take = 8) {
        if (children.length === 0) return [];

        const childNameMap = new Map(children.map(child => [child.id, child.name]));
        const enrollments = await prisma.lMSEnrollment.findMany({
            where: {
                learnerId: { in: children.map(child => child.id) },
                status: 'ACTIVE' as any,
                archived: false,
            },
            select: { id: true, learnerId: true, courseId: true },
        });

        if (enrollments.length === 0) return [];

        const enrollmentByCourse = new Map<string, typeof enrollments>();
        enrollments.forEach((enrollment) => {
            if (!enrollmentByCourse.has(enrollment.courseId)) enrollmentByCourse.set(enrollment.courseId, []);
            enrollmentByCourse.get(enrollment.courseId)!.push(enrollment);
        });

        const assignments = await prisma.lMSContent.findMany({
            where: {
                courseId: { in: [...enrollmentByCourse.keys()] },
                type: 'ASSIGNMENT' as any,
                archived: false,
            },
            include: {
                course: { select: { id: true, title: true, subject: true } },
                progress: {
                    where: { enrollmentId: { in: enrollments.map(enrollment => enrollment.id) } },
                    select: { enrollmentId: true, completed: true, lastAccessedAt: true },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { order: 'asc' }],
            take,
        });

        const progressByEnrollment = new Map<string, { completed: boolean; lastAccessedAt: Date }>();
        assignments.forEach((assignment) => {
            assignment.progress.forEach((progress) => {
                progressByEnrollment.set(`${assignment.id}:${progress.enrollmentId}`, {
                    completed: progress.completed,
                    lastAccessedAt: progress.lastAccessedAt,
                });
            });
        });

        return assignments.flatMap((assignment) => {
            const courseEnrollments = enrollmentByCourse.get(assignment.courseId) || [];
            return courseEnrollments.map((enrollment) => {
                const progress = progressByEnrollment.get(`${assignment.id}:${enrollment.id}`);
                return {
                    id: `${assignment.id}:${enrollment.learnerId}`,
                    assignmentId: assignment.id,
                    learnerId: enrollment.learnerId,
                    childName: childNameMap.get(enrollment.learnerId) || 'Learner',
                    subject: assignment.course.subject,
                    title: assignment.title,
                    dueDate: null,
                    submitted: !!progress?.completed,
                    status: progress?.completed ? 'submitted' : 'pending',
                };
            });
        }).slice(0, take);
    }

    private async getLearnerRiskSignals(options: { classIds?: string[]; take?: number; schoolWide?: boolean } = {}) {
        const { classIds = [], take = 50, schoolWide = false } = options;
        if (!schoolWide && classIds.length === 0) return [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const enrollments = await prisma.classEnrollment.findMany({
            where: schoolWide
                ? { active: true, archived: false }
                : { classId: { in: classIds }, active: true, archived: false },
            include: {
                class: { select: { name: true, grade: true, stream: true } },
                learner: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        grade: true,
                        stream: true,
                        attendances: {
                            where: { date: { gte: thirtyDaysAgo }, archived: false },
                            select: { status: true },
                        },
                        summativeResults: {
                            where: { archived: false, percentage: { not: null } },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            select: { percentage: true },
                        },
                        feeInvoices: {
                            where: { archived: false, balance: { gt: 0 } },
                            select: { balance: true },
                        },
                        formativeAssessments: {
                            where: { archived: false, status: 'DRAFT' as any },
                            select: { id: true },
                        },
                    },
                },
            },
            take: schoolWide ? 1000 : 200,
        });

        const learnerSignals = enrollments.map((enrollment) => {
            const learner = enrollment.learner;
            const attendanceTotal = learner.attendances.length;
            const attendanceRate = attendanceTotal > 0
                ? Math.round((learner.attendances.filter(a => a.status === 'PRESENT').length / attendanceTotal) * 100)
                : null;
            const avgScore = learner.summativeResults.length > 0
                ? Math.round(learner.summativeResults.reduce((sum, result) => sum + Number(result.percentage || 0), 0) / learner.summativeResults.length)
                : null;
            const className = enrollment.class?.name || [learner.grade, learner.stream].filter(Boolean).join(' ') || 'Class';
            const feeBalance = learner.feeInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
            const riskFactors: string[] = [];
            if (attendanceRate !== null && attendanceRate < 80) riskFactors.push('low_attendance');
            if (avgScore !== null && avgScore < 50) riskFactors.push('declining_academics');
            if (feeBalance > 0) riskFactors.push('fee_balance');

            let severity: 'critical' | 'high' | 'medium' | null = null;
            if ((attendanceRate !== null && attendanceRate < 65) && (avgScore !== null && avgScore < 40)) severity = 'critical';
            else if ((attendanceRate !== null && attendanceRate < 65) || (avgScore !== null && avgScore < 40)) severity = 'high';
            else if ((attendanceRate !== null && attendanceRate < 80) || (avgScore !== null && avgScore < 50)) severity = 'medium';

            return {
                learnerId: learner.id,
                name: [learner.firstName, learner.lastName].filter(Boolean).join(' '),
                grade: className,
                stream: enrollment.class?.stream || learner.stream || '',
                attendanceRate,
                avgPercentage: avgScore,
                feeBalance: Math.round(feeBalance),
                draftCount: learner.formativeAssessments.length,
                riskFactors,
                severity,
            };
        });

        const dedupedSignals = Array.from(
            learnerSignals.reduce((map, signal) => {
                const existing = map.get(signal.learnerId);
                const rank = { critical: 3, high: 2, medium: 1, null: 0 } as const;
                const currentRank = rank[String(signal.severity) as keyof typeof rank] ?? 0;
                const existingRank = existing ? (rank[String(existing.severity) as keyof typeof rank] ?? 0) : -1;
                if (!existing || currentRank > existingRank) map.set(signal.learnerId, signal);
                return map;
            }, new Map<string, typeof learnerSignals[number]>())
        )
            .map(([, signal]) => signal)
            .filter((signal) => signal.severity !== null)
            .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2 } as const;
                return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
            })
            .slice(0, take);

        return dedupedSignals;
    }

    /**
     * Derives top-performing learners from the same signal data.
     * Learners with avgPercentage >= 70 and no critical risk factor are
     * considered top performers. Sorted descending by avgPercentage.
     */
    private async getTeacherTopPerformers(classIds: string[], take = 5) {
        // Pull a wider slice so we have enough candidates above the threshold
        const signals = await this.getLearnerRiskSignals({ classIds, take: 100 });

        return signals
            .filter((s) => s.avgPercentage !== null && s.avgPercentage >= 70)
            .sort((a, b) => (b.avgPercentage ?? 0) - (a.avgPercentage ?? 0))
            .slice(0, take)
            .map((s) => ({
                id: `${s.learnerId}:top`,
                learnerId: s.learnerId,
                name: s.name,
                grade: s.grade,
                avgScore: s.avgPercentage,
                attendanceRate: s.attendanceRate,
            }));
    }

    private async getTeacherLearnerRiskItems(classIds: string[], take = 6) {
        const learnerSignals = await this.getLearnerRiskSignals({ classIds, take });

        const risks = learnerSignals.flatMap((signal) => {
            const items: any[] = [];

            if (signal.attendanceRate !== null && signal.attendanceRate < 80) {
                items.push({
                    id: `${signal.learnerId}:attendance`,
                    learnerId: signal.learnerId,
                    name: signal.name,
                    grade: signal.grade,
                    issue: `Low attendance (${signal.attendanceRate}%)`,
                    severity: signal.attendanceRate < 65 ? 'high' : 'medium',
                    actionPage: 'attendance-analytics',
                });
            }

            if (signal.avgPercentage !== null && signal.avgPercentage < 50) {
                items.push({
                    id: `${signal.learnerId}:performance`,
                    learnerId: signal.learnerId,
                    name: signal.name,
                    grade: signal.grade,
                    issue: `Academic support needed (${signal.avgPercentage}%)`,
                    severity: signal.avgPercentage < 40 ? 'high' : 'medium',
                    actionPage: 'learners-list',
                });
            }

            if (signal.draftCount > 0) {
                items.push({
                    id: `${signal.learnerId}:drafts`,
                    learnerId: signal.learnerId,
                    name: signal.name,
                    grade: signal.grade,
                    issue: `${signal.draftCount} draft assessment${signal.draftCount === 1 ? '' : 's'}`,
                    severity: 'medium',
                    actionPage: 'assess-summative-assessment',
                });
            }

            return items;
        });

        return risks
            .sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1))
            .slice(0, take);
    }

    private async getAttendanceTrend(studentStart: Date, activeTeacherIds: string[]) {
        const [studentRecords, staffRecords] = await Promise.all([
            prisma.attendance.findMany({
                where: { date: { gte: studentStart }, archived: false },
                select: { date: true, status: true },
            }),
            prisma.staffAttendanceLog.findMany({
                where: { date: { gte: studentStart } },
                select: { date: true, userId: true },
            }),
        ]);

        const weekStarts = Array.from({ length: 5 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (4 - index) * 7);
            date.setHours(0, 0, 0, 0);
            const day = date.getDay();
            date.setDate(date.getDate() - day);
            return date;
        });

        return weekStarts.map((start, index) => {
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            const studentWeek = studentRecords.filter(record => record.date >= start && record.date < end);
            const staffWeek = staffRecords.filter(record => record.date >= start && record.date < end);
            const staffPresent = new Set(staffWeek.map(record => `${record.userId}:${record.date.toISOString().slice(0, 10)}`)).size;
            const teacherOpportunities = Math.max(1, activeTeacherIds.length * 5);

            return {
                week: `W${index + 1}`,
                students: studentWeek.length > 0
                    ? Math.round((studentWeek.filter(record => record.status === 'PRESENT').length / studentWeek.length) * 100)
                    : 0,
                teachers: activeTeacherIds.length > 0 ? Math.round((staffPresent / teacherOpportunities) * 100) : 0,
                target: 90,
            };
        });
    }

    private async getTeacherAttendanceGroups(activeTeachers: Array<{ id: string; subject: string | null; role: string }>, todayStart: Date, todayEnd: Date) {
        if (activeTeachers.length === 0) return [];

        const logs = await prisma.staffAttendanceLog.findMany({
            where: {
                date: { gte: todayStart, lte: todayEnd },
                userId: { in: activeTeachers.map(teacher => teacher.id) }
            },
            select: { userId: true },
        });
        const presentIds = new Set(logs.map(log => log.userId));
        const groupMap = new Map<string, { dept: string; total: number; present: number }>();

        activeTeachers.forEach((teacher) => {
            const dept = teacher.subject || teacher.role.replace(/_/g, ' ') || 'Teaching Staff';
            if (!groupMap.has(dept)) groupMap.set(dept, { dept, total: 0, present: 0 });
            const group = groupMap.get(dept)!;
            group.total += 1;
            if (presentIds.has(teacher.id)) group.present += 1;
        });

        return [...groupMap.values()].map(group => ({
            dept: group.dept,
            rate: group.total > 0 ? Math.round((group.present / group.total) * 100) : 0,
            absent: Math.max(0, group.total - group.present),
            present: group.present,
            total: group.total,
        }));
    }

    /**
     * Returns the resolved institution type for this request.
     * Reads req.resolvedInstitutionType set by institutionContextResolver -
     * never re-derives from headers or req.school.
     */
    private getInstitutionType(req: AuthRequest): CanonicalInstitutionType {
        return (req.resolvedInstitutionType ?? 'PRIMARY_CBC') as CanonicalInstitutionType;
    }

    private formatAcademicPeriod(term: string, academicYear: number) {
        const termLabel = String(term || '')
            .replace(/^TERM_/i, 'Term ')
            .replace(/_/g, ' ')
            .trim();
        return `${academicYear} ${termLabel}`.trim();
    }

    async getIntelligenceSummary(req: AuthRequest, res: Response) {
        try {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

            const currentWeekStart = new Date(today);
            const mondayOffset = (currentWeekStart.getDay() + 6) % 7;
            currentWeekStart.setDate(currentWeekStart.getDate() - mondayOffset);

            const weeklyRanges = Array.from({ length: 9 }, (_, index) => {
                const start = new Date(currentWeekStart);
                start.setDate(start.getDate() - ((8 - index) * 7));
                const end = new Date(start);
                end.setDate(end.getDate() + 7);
                return { start, end };
            });

            const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthlyWindowStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 2, 1);

            const [
                snapshot,
                averagePercentageAgg,
                subjectAverageRows,
                formativeSubjectRatings,
                termHistoryRows,
                attendanceLast30Days,
                weeklyAttendanceGroups,
                monthlyCollectionRows,
                monthlyBillingRows,
                riskSignals,
            ] = await Promise.all([
                buildSnapshot(),
                prisma.summativeResult.aggregate({
                    where: {
                        archived: false,
                        percentage: { not: null },
                    },
                    _avg: { percentage: true },
                }),
                prisma.$queryRaw<Array<{ subject: string; avgPct: number; totalAssessed: number }>>(Prisma.sql`
                    SELECT
                        st."learningArea" AS subject,
                        AVG(sr.percentage)::float AS "avgPct",
                        COUNT(sr.id)::int AS "totalAssessed"
                    FROM summative_results sr
                    INNER JOIN summative_tests st ON st.id = sr."testId"
                    WHERE sr.archived = false
                      AND st.archived = false
                      AND sr.percentage IS NOT NULL
                    GROUP BY st."learningArea"
                    ORDER BY AVG(sr.percentage) ASC, st."learningArea" ASC
                `),
                prisma.formativeAssessment.groupBy({
                    by: ['learningArea', 'overallRating'],
                    where: { archived: false },
                    _count: true,
                }),
                prisma.$queryRaw<Array<{ academicYear: number; term: string; avgPct: number }>>(Prisma.sql`
                    SELECT
                        st."academicYear" AS "academicYear",
                        st.term AS term,
                        AVG(sr.percentage)::float AS "avgPct"
                    FROM summative_results sr
                    INNER JOIN summative_tests st ON st.id = sr."testId"
                    WHERE sr.archived = false
                      AND st.archived = false
                      AND sr.percentage IS NOT NULL
                    GROUP BY st."academicYear", st.term
                    ORDER BY st."academicYear" DESC, st.term DESC
                    LIMIT 6
                `),
                prisma.attendance.findMany({
                    where: {
                        date: { gte: thirtyDaysAgo },
                        archived: false,
                    },
                    select: {
                        learnerId: true,
                        date: true,
                        status: true,
                    },
                }),
                Promise.all(
                    weeklyRanges.map(({ start, end }) =>
                        prisma.attendance.groupBy({
                            by: ['status'],
                            where: {
                                date: { gte: start, lt: end },
                                archived: false,
                            },
                            _count: true,
                        })
                    )
                ),
                prisma.$queryRaw<Array<{ monthStart: Date; collected: number }>>(Prisma.sql`
                    SELECT
                        DATE_TRUNC('month', p."paymentDate") AS "monthStart",
                        SUM(p.amount)::float AS collected
                    FROM fee_payments p
                    WHERE p.archived = false
                      AND p."paymentDate" >= ${monthlyWindowStart}
                    GROUP BY DATE_TRUNC('month', p."paymentDate")
                    ORDER BY DATE_TRUNC('month', p."paymentDate")
                `),
                prisma.$queryRaw<Array<{ monthStart: Date; billed: number }>>(Prisma.sql`
                    SELECT
                        DATE_TRUNC('month', i."createdAt") AS "monthStart",
                        SUM(i."totalAmount")::float AS billed
                    FROM fee_invoices i
                    WHERE i.archived = false
                      AND i."createdAt" >= ${monthlyWindowStart}
                    GROUP BY DATE_TRUNC('month', i."createdAt")
                    ORDER BY DATE_TRUNC('month', i."createdAt")
                `),
                this.getLearnerRiskSignals({ schoolWide: true, take: 50 }),
            ]);

            const subjectTotals = new Map<string, number>();
            const subjectBeCounts = new Map<string, number>();
            formativeSubjectRatings.forEach((row) => {
                const key = row.learningArea || 'Unknown';
                subjectTotals.set(key, (subjectTotals.get(key) || 0) + row._count);
                if (row.overallRating === 'BE') {
                    subjectBeCounts.set(key, (subjectBeCounts.get(key) || 0) + row._count);
                }
            });

            const subjectBreakdown = subjectAverageRows.map((row) => {
                const totalAssessed = Number(row.totalAssessed || 0);
                const totalRated = subjectTotals.get(row.subject) || totalAssessed;
                const beCount = subjectBeCounts.get(row.subject) || 0;
                const bePct = totalRated > 0 ? Math.round((beCount / totalRated) * 100) : 0;
                return {
                    subject: row.subject,
                    bePct,
                    avgPct: Math.round(Number(row.avgPct || 0)),
                    totalAssessed,
                };
            });

            const termOrder = ['TERM_1', 'TERM_2', 'TERM_3'];
            const termHistory = termHistoryRows
                .map((row) => ({
                    period: this.formatAcademicPeriod(String(row.term || ''), Number(row.academicYear || 0)),
                    avgPct: Math.round(Number(row.avgPct || 0)),
                    _year: Number(row.academicYear || 0),
                    _termIndex: termOrder.indexOf(String(row.term || '')),
                }))
                .sort((a, b) => (a._year - b._year) || (a._termIndex - b._termIndex))
                .slice(-6)
                .map(({ period, avgPct }) => ({ period, avgPct }));

            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const dayMap = new Map<string, { total: number; present: number }>();
            dayOrder.forEach((day) => dayMap.set(day, { total: 0, present: 0 }));
            attendanceLast30Days.forEach((record) => {
                const day = record.date.toLocaleDateString('en-US', { weekday: 'long' });
                const bucket = dayMap.get(day) || { total: 0, present: 0 };
                bucket.total += 1;
                if (record.status === 'PRESENT') bucket.present += 1;
                dayMap.set(day, bucket);
            });
            const dailyBreakdown = dayOrder
                .filter((day) => (dayMap.get(day)?.total || 0) > 0)
                .map((day) => {
                    const bucket = dayMap.get(day)!;
                    return {
                        dayOfWeek: day,
                        avgRate: bucket.total > 0 ? Number((bucket.present / bucket.total).toFixed(3)) : 0,
                    };
                });

            const weeklyHistory = weeklyRanges.map(({ start }, index) => {
                const grouped = weeklyAttendanceGroups[index] || [];
                const present = grouped.find((item) => item.status === 'PRESENT')?._count || 0;
                const total = grouped.reduce((sum, item) => sum + item._count, 0);
                const isoYear = start.getUTCFullYear();
                const yearStart = new Date(Date.UTC(isoYear, 0, 1));
                const dayOfYear = Math.floor((Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) - yearStart.getTime()) / 86400000) + 1;
                const weekNumber = Math.ceil(dayOfYear / 7);

                return {
                    week: `${isoYear}-W${String(weekNumber).padStart(2, '0')}`,
                    avgRate: total > 0 ? Number((present / total).toFixed(3)) : 0,
                };
            });

            const monthKeys = Array.from({ length: 3 }, (_, index) => {
                const date = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - (2 - index), 1);
                return date;
            });
            const collectedByMonth = new Map(
                monthlyCollectionRows.map((row) => [
                    new Date(row.monthStart).toISOString().slice(0, 7),
                    Number(row.collected || 0),
                ])
            );
            const billedByMonth = new Map(
                monthlyBillingRows.map((row) => [
                    new Date(row.monthStart).toISOString().slice(0, 7),
                    Number(row.billed || 0),
                ])
            );
            const monthlyHistory = monthKeys.map((monthStart) => {
                const key = monthStart.toISOString().slice(0, 7);
                const collected = collectedByMonth.get(key) || 0;
                const billed = billedByMonth.get(key) || 0;
                return {
                    month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    collected: Math.round(collected),
                    billed: Math.round(billed),
                    rate: billed > 0 ? Number((collected / billed).toFixed(3)) : 0,
                };
            });

            const riskDistribution = riskSignals.reduce(
                (acc, learner) => {
                    if (learner.severity === 'critical') acc.critical += 1;
                    else if (learner.severity === 'high') acc.high += 1;
                    else if (learner.severity === 'medium') acc.medium += 1;
                    return acc;
                },
                { critical: 0, high: 0, medium: 0, total: snapshot.totalStudents }
            );

            const atRiskLearners = riskSignals.map((learner) => ({
                learnerId: learner.learnerId,
                name: learner.name,
                grade: learner.grade,
                stream: learner.stream,
                attendanceRate: learner.attendanceRate !== null ? Number((learner.attendanceRate / 100).toFixed(3)) : 0,
                avgPercentage: learner.avgPercentage !== null ? learner.avgPercentage : 0,
                feeBalance: learner.feeBalance,
                riskFactors: learner.riskFactors,
            }));

            const totalExpectedAttendance = Math.max(snapshot.activeStudents, snapshot.totalStudents);
            const totalBilled = snapshot.feeCollected + snapshot.feePending;

            res.json({
                academics: {
                    averagePercentage: Math.round(Number(averagePercentageAgg._avg.percentage || 0)),
                    assessmentCompletionRate: snapshot.totalClasses > 0
                        ? Number((snapshot.assessedClassCount / snapshot.totalClasses).toFixed(3))
                        : 0,
                    totalLearners: snapshot.totalStudents,
                    learnersBelowExpectations: snapshot.be,
                    ratingDistribution: {
                        EE: snapshot.ee,
                        ME: snapshot.me,
                        AE: snapshot.ae,
                        BE: snapshot.be,
                    },
                    subjectBreakdown,
                    termHistory,
                    pendingDraftCount: snapshot.pendingDraftCount,
                },
                fees: {
                    totalBilled: Math.round(totalBilled),
                    totalCollected: Math.round(snapshot.feeCollected),
                    totalOutstanding: Math.round(snapshot.feePending),
                    collectionRate: totalBilled > 0 ? Number((snapshot.feeCollected / totalBilled).toFixed(3)) : 0,
                    overdueCount: snapshot.overdueInvoices,
                    overpaidCount: snapshot.overpaidInvoices,
                    monthlyHistory,
                },
                attendance: {
                    presentToday: snapshot.presentToday,
                    absentToday: snapshot.absentToday,
                    lateToday: snapshot.lateToday,
                    totalExpected: totalExpectedAttendance,
                    todayRate: totalExpectedAttendance > 0 ? Number((snapshot.presentToday / totalExpectedAttendance).toFixed(3)) : 0,
                    weeklyHistory,
                    dailyBreakdown,
                },
                risk: {
                    atRiskLearners,
                    distribution: riskDistribution,
                },
            });
        } catch (error: any) {
            logger.error('Dashboard Intelligence Summary Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch dashboard intelligence summary');
        }
    }

    /** GET /api/dashboard/secondary */
    async getSecondaryMetrics(req: AuthRequest, res: Response) {
        try {
            const institutionType = this.getInstitutionType(req);
            if (institutionType !== 'SECONDARY') {
                throw new ApiError(403, 'Secondary dashboard is available for secondary institutions only')
                    .withCode('INSTITUTION_FORBIDDEN');
            }

            const cacheKey = `dashboard:secondary:${institutionType}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const secondaryGrades = ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3'];
            const activeTermConfig = await configService.getActiveTermConfig();
            const activeAcademicYear = Number(activeTermConfig?.academicYear || new Date().getFullYear());
            const activeTerm = String(activeTermConfig?.term || 'TERM_1');

            const [
                learnerCount,
                learnersByStream,
                tests,
            ] = await Promise.all([
                prisma.learner.count({
                    where: {
                        institutionType: 'SECONDARY',
                        archived: false,
                        status: 'ACTIVE',
                        grade: { in: secondaryGrades as any }
                    }
                }),
                prisma.learner.groupBy({
                    by: ['stream'],
                    where: {
                        institutionType: 'SECONDARY',
                        archived: false,
                        status: 'ACTIVE',
                        grade: { in: secondaryGrades as any }
                    },
                    _count: true
                }),
                prisma.summativeTest.findMany({
                    where: {
                        archived: false,
                        active: true,
                        status: 'PUBLISHED',
                        grade: { in: secondaryGrades as any }
                    },
                    select: { id: true, testType: true }
                })
            ]);

            const testResultCounts = await prisma.summativeResult.groupBy({
              by: ['testId'],
              where: { archived: false, testId: { in: tests.map(t => t.id) } },
              _count: true,
            });
            const resultsCountMap = new Map(testResultCounts.map((r) => [r.testId, r._count]));
            const countByType = (type: string) => tests.filter((t) => String(t.testType || '').toUpperCase() === type).length;
            const totalAssigned = tests.reduce((sum, t) => sum + Number(resultsCountMap.get(t.id) || 0), 0);
            const avgAssigned = tests.length > 0 ? Math.round(totalAssigned / tests.length) : 0;

            // Trend 1: mean score trend for last 3 terms (within active year)
            const termRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
              SELECT
                st.term AS term,
                AVG(sr.percentage)::float AS mean_percentage
              FROM summative_results sr
              INNER JOIN summative_tests st ON st.id = sr."testId"
              WHERE st."institutionType" = 'SECONDARY'
                AND st.archived = false
                AND st."academicYear" = ${activeAcademicYear}
                AND st.grade = ANY(${secondaryGrades})
              GROUP BY st.term
            `);
            const termOrder = ['TERM_1', 'TERM_2', 'TERM_3'];
            const meanTrend = termRows
              .map((r) => ({
                term: String(r.term || ''),
                mean: Number(r.mean_percentage || 0),
              }))
              .sort((a, b) => termOrder.indexOf(a.term) - termOrder.indexOf(b.term))
              .slice(-3);

            // Trend 2: stream ranking snapshot for active term/year
            const streamRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
              SELECT
                l.stream AS stream,
                AVG(sr.percentage)::float AS mean_percentage
              FROM summative_results sr
              INNER JOIN summative_tests st ON st.id = sr."testId"
              INNER JOIN learners l ON l.id = sr."learnerId"
              WHERE st."institutionType" = 'SECONDARY'
                AND st.archived = false
                AND st."academicYear" = ${activeAcademicYear}
                AND st.term = ${activeTerm}
                AND st.grade = ANY(${secondaryGrades})
                AND l.archived = false
              GROUP BY l.stream
              ORDER BY mean_percentage DESC
              LIMIT 5
            `);
            const streamSnapshot = streamRows.map((r, idx) => ({
              rank: idx + 1,
              stream: String(r.stream || 'Unassigned'),
              mean: Number(r.mean_percentage || 0),
            }));

            // Trend 3: subject performance snapshot for active term/year
            const subjectRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
              SELECT
                st."learningArea" AS learning_area,
                AVG(sr.percentage)::float AS mean_percentage
              FROM summative_results sr
              INNER JOIN summative_tests st ON st.id = sr."testId"
              WHERE st."institutionType" = 'SECONDARY'
                AND st.archived = false
                AND st."academicYear" = ${activeAcademicYear}
                AND st.term = ${activeTerm}
                AND st.grade = ANY(${secondaryGrades})
              GROUP BY st."learningArea"
              ORDER BY mean_percentage DESC
              LIMIT 5
            `);
            const subjectSnapshot = subjectRows.map((r) => ({
              learningArea: String(r.learning_area || 'Unknown'),
              mean: Number(r.mean_percentage || 0),
            }));

            const payload = {
                context: {
                    academicYear: activeAcademicYear,
                    term: activeTerm,
                    institutionType,
                },
                learnerCount,
                streamCount: learnersByStream.filter((s) => Boolean(s.stream)).length,
                activeTestsCount: tests.length,
                avgAssigned,
                tests: {
                    CAT: countByType('CAT'),
                    MID_TERM: countByType('MID_TERM'),
                    END_TERM: countByType('END_TERM'),
                    MOCK: countByType('MOCK')
                },
                trends: {
                    meanTrend,
                    streamSnapshot,
                    subjectSnapshot
                },
            };

            await redisCacheService.set(cacheKey, payload, 120);
            res.json({ success: true, data: payload });
        } catch (error: any) {
            logger.error('Secondary Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch secondary dashboard metrics');
        }
    }

    /**
     * GET /api/dashboard/admin
     * Pass ?fresh=1 to bypass the cache (e.g. after a manual refresh button click).
     */
    async getAdminMetrics(req: AuthRequest, res: Response) {
        console.time('🚀 [DASHBOARD] getAdminMetrics');
        try {
            const { filter = 'today', fresh } = req.query;
            const institutionType = this.getInstitutionType(req);
            const secondaryGrades = ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3', 'FORM_4'];
            const isSecondaryContext = institutionType === 'SECONDARY';
            const allowedFeeGrades = new Set<string>(isSecondaryContext ? SENIOR_FEE_GRADES : JUNIOR_FEE_GRADES);
            const summativeTestScope: Prisma.SummativeTestWhereInput = isSecondaryContext
                ? { OR: [{ grade: { in: secondaryGrades as any } }, { grade: { startsWith: 'FORM' } }] }
                : { NOT: { OR: [{ grade: { in: secondaryGrades as any } }, { grade: { startsWith: 'FORM' } }] } };
            const learnerScope: Prisma.LearnerWhereInput = isSecondaryContext
                ? {
                    archived: false,
                    OR: [
                        { grade: { in: secondaryGrades as any } },
                        { grade: { startsWith: 'FORM' } },
                    ],
                }
                : {
                    archived: false,
                    NOT: {
                        OR: [
                            { grade: { in: secondaryGrades as any } },
                            { grade: { startsWith: 'FORM' } },
                        ],
                    },
                };
            const cacheKey = `dashboard:admin:v4:${institutionType}:${filter}`;

            // ── Serve from cache unless caller explicitly bypassed it ──────────
            if (!fresh) {
                const cached = await redisCacheService.get<any>(cacheKey);
                if (cached) {
                    console.timeEnd('🚀 [DASHBOARD] getAdminMetrics');
                    return res.json({ success: true, data: cached, _cached: true });
                }
            }

            // ── Resolve active term dynamically ───────────────────────────────
            const activeTermConfig   = await configService.getActiveTermConfig();
            const activeAcademicYear = activeTermConfig?.academicYear ?? new Date().getFullYear();
            const activeTerm         = activeTermConfig?.term ?? 'TERM_1';

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const staffStartOfToday = new Date(now);
            staffStartOfToday.setHours(0, 0, 0, 0);
            const staffEndOfToday = new Date(staffStartOfToday);
            staffEndOfToday.setHours(23, 59, 59, 999);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const startOfTerm = activeTermConfig?.startDate ? new Date(activeTermConfig.startDate) : new Date(now.getFullYear(), 0, 1);

            const dateFilter     = this.getDateFilter(filter as string);
            const prevDateFilter = this.getPreviousDateFilter(filter as string);

            // ── Stage 1: All independent queries fired in one Promise.all ─────
            const resultStage1 = await Promise.all([
                // [0] counts
                prisma.learner.count({ where: learnerScope }),
                prisma.user.count({ where: { role: { in: [...TUTOR_ROLES] as any }, archived: false } }),
                prisma.class.count({ where: { archived: false, institutionType: isSecondaryContext ? ('SECONDARY' as any) : ('PRIMARY_CBC' as any) } }),
                prisma.learner.count({ where: { ...learnerScope, createdAt: prevDateFilter } }),
                prisma.user.count({ where: { role: { in: [...TUTOR_ROLES] as any }, archived: false, createdAt: prevDateFilter } }),
                prisma.learner.count({ where: { ...learnerScope, status: 'ACTIVE' } }),
                prisma.user.count({ where: { role: { in: [...TUTOR_ROLES] as any }, status: 'ACTIVE', archived: false } }),
                // [7] group-bys
                prisma.attendance.groupBy({ by: ['status'], where: { date: startOfToday, learner: { ...learnerScope, status: 'ACTIVE' } }, _count: true }),
                prisma.learner.groupBy({ by: ['grade'], where: learnerScope, _count: true }),
                prisma.user.groupBy({ by: ['role'], where: { archived: false }, _count: true }),
                // [10] recent records
                prisma.learner.findMany({
                    where: learnerScope,
                    orderBy: { createdAt: 'desc' }, take: 5,
                    select: { firstName: true, lastName: true, admissionNumber: true, grade: true, createdAt: true }
                }),
                prisma.formativeAssessment.findMany({
                    orderBy: { createdAt: 'desc' }, take: 5,
                    select: { title: true, learningArea: true, learner: { select: { firstName: true, lastName: true } }, createdAt: true }
                }),
                prisma.summativeResult.findMany({
                    orderBy: { createdAt: 'desc' }, take: 5,
                    select: { marksObtained: true, test: { select: { title: true, learningArea: true } }, learner: { select: { firstName: true, lastName: true } }, createdAt: true }
                }),
                // [13] upcoming events (guarded for missing allDay column)
                (async () => {
                    try {
                        return await prisma.event.findMany({
                            where: { startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' }, take: 5,
                            include: { creator: { select: { role: true } } }
                        });
                    } catch (error: any) {
                        if (error?.code === 'P2022' && String(error?.message || '').includes('events.allDay')) {
                            logger.warn('[Dashboard] events.allDay missing — returning empty events until migration runs.');
                            return [];
                        }
                        throw error;
                    }
                })(),
                // [14]
                prisma.formativeAssessment.count({ where: { status: 'DRAFT', archived: false } }),
                prisma.learner.groupBy({ by: ['gender'], where: learnerScope, _count: true }),
                // [16] latest test series
                prisma.summativeTest.findFirst({
                    where: {
                        archived: false,
                        academicYear: activeAcademicYear,
                        term: activeTerm as any,
                        ...summativeTestScope,
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { testType: true, term: true, academicYear: true }
                }),
                // [17-20] financials + performance aggregates
                prisma.feeInvoice.aggregate({
                    where: { archived: false, academicYear: activeAcademicYear },
                    _sum: { paidAmount: true, balance: true },
                }),
                prisma.feeInvoice.groupBy({
                    by: ['feeStructureId', 'term'],
                    where: { archived: false, academicYear: activeAcademicYear },
                    _sum: { totalAmount: true, paidAmount: true, balance: true, transportBilled: true, transportPaid: true, transportBalance: true },
                }),
                prisma.summativeResult.groupBy({
                    by: ['testId'],
                    where: { archived: false },
                    _avg: { percentage: true },
                    _count: true,
                }),
                prisma.formativeAssessment.groupBy({
                    by: ['learningArea', 'overallRating'],
                    where: { archived: false },
                    _count: true,
                }),
                // [21]
                prisma.class.count({ where: { archived: false, active: true, institutionType: isSecondaryContext ? ('SECONDARY' as any) : ('PRIMARY_CBC' as any) } }),
                // [22] staff currently on approved leave today
                prisma.leaveRequest.count({
                    where: {
                        status: 'APPROVED',
                        startDate: { lte: new Date() },
                        endDate:   { gte: new Date() },
                    },
                }),
                // [23] expenses today
                prisma.expense.aggregate({
                    where: { date: { gte: startOfToday } },
                    _sum: { amount: true }
                }),
                // [24] expenses this month
                prisma.expense.aggregate({
                    where: { date: { gte: startOfMonth } },
                    _sum: { amount: true }
                }),
                // [25] expenses this term
                prisma.expense.aggregate({
                    where: { date: { gte: startOfTerm } },
                    _sum: { amount: true }
                }),
                // [26] expenses by category
                prisma.expense.groupBy({
                    by: ['category'],
                    where: { date: { gte: startOfTerm } },
                    _sum: { amount: true }
                }),
                // [27] recent expenses
                prisma.expense.findMany({
                    where: { date: { gte: startOfTerm } },
                    orderBy: { date: 'desc' },
                    take: 5,
                    include: { account: true }
                }),
                // [28-35] fee collection pulse + executive drilldowns
                prisma.feePayment.aggregate({
                    where: { archived: false, paymentDate: { gte: startOfToday } },
                    _sum: { amount: true }
                }),
                prisma.feePayment.aggregate({
                    where: { archived: false, paymentDate: { gte: startOfWeek } },
                    _sum: { amount: true }
                }),
                prisma.feePayment.aggregate({
                    where: { archived: false, paymentDate: { gte: startOfMonth } },
                    _sum: { amount: true }
                }),
                prisma.feePayment.findMany({
                    where: { archived: false, paymentDate: { gte: startOfTerm } },
                    orderBy: { paymentDate: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        receiptNumber: true,
                        amount: true,
                        paymentDate: true,
                        paymentMethod: true,
                        invoice: {
                            select: {
                                invoiceNumber: true,
                                learner: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        grade: true,
                                        stream: true,
                                    }
                                }
                            }
                        }
                    }
                }),
                prisma.feeInvoice.findMany({
                    where: { archived: false, academicYear: activeAcademicYear, balance: { gt: 0 } },
                    orderBy: { balance: 'desc' },
                    take: 120,
                    select: {
                        balance: true,
                        learner: {
                            select: {
                                grade: true,
                                stream: true,
                            }
                        }
                    }
                }),
                prisma.summativeResult.aggregate({
                    where: { archived: false, createdAt: dateFilter },
                    _avg: { percentage: true },
                }),
                prisma.summativeResult.aggregate({
                    where: { archived: false, createdAt: prevDateFilter },
                    _avg: { percentage: true },
                }),
                prisma.expense.aggregate({
                    where: { status: { not: 'PAID' } },
                    _sum: { amount: true },
                    _count: true,
                }),
                // [36] teacher/tutor clock-in records for today
                prisma.staffAttendanceLog.findMany({
                    where: {
                        date: { gte: staffStartOfToday, lte: staffEndOfToday },
                        user: { role: { in: [...TUTOR_ROLES] as any }, archived: false },
                    },
                    select: { userId: true },
                }),
                // [37] subordinate staff user count (non-teacher, non-parent roles)
                prisma.user.count({
                    where: {
                        role: { in: ['ACCOUNTANT', 'RECEPTIONIST', 'ADMIN', 'HEAD_TEACHER'] as any },
                        archived: false,
                    },
                }),
                // [38] subordinate staff clock-in records for today
                prisma.staffAttendanceLog.findMany({
                    where: {
                        date: { gte: staffStartOfToday, lte: staffEndOfToday },
                        user: {
                            role: { in: ['ACCOUNTANT', 'RECEPTIONIST', 'ADMIN', 'HEAD_TEACHER'] as any },
                            archived: false,
                        },
                    },
                    select: { userId: true },
                }),
            ]);

            const [
                studentCount, teacherCount, classCount, prevStudentCount, prevTeacherCount,
                activeStudents, activeTeachers, attendanceSummary, studentsByGradeData,
                staffByRole, latestAdmissions, latestFormative, latestSummative,
                upcomingEventsData, pendingDraftCount, genderDistribution,
                latestTest, feeAgg, feeByGrade, summativeByGrade,
                subjectRatings, assessedClassCount, staffOnLeaveCount,
                expensesToday, expensesThisMonth, expensesThisTerm, expensesByCategory,
                recentExpenses,
                feeCollectionsToday, feeCollectionsThisWeek, feeCollectionsThisMonth, recentFeePayments,
                topDebtorInvoices, currentAssessmentAverage, previousAssessmentAverage, pendingBills,
                teacherClockInsToday, subordinateStaffCount, subordinateClockInsToday,
            ] = resultStage1 as any[];

            // ── Stage 2: Assessment-series detail ─────────────────────────────
            let totalMissedExams    = 0;
            let currentTestSeries   = 'CURRENT SERIES';
            let unAssessedBreakdown: any[] = [];

            if (latestTest?.testType) {
                currentTestSeries = `${latestTest.testType} ${latestTest.term}`.replace(/_/g, ' ');

                const testsInSeries = await prisma.summativeTest.findMany({
                    where: {
                        testType:     latestTest.testType,
                        term:         latestTest.term,
                        academicYear: latestTest.academicYear,
                        archived:     false,
                        ...summativeTestScope,
                    },
                    select: { id: true, grade: true }
                });

                if (testsInSeries.length > 0) {
                    const testIds = testsInSeries.map(t => t.id);
                    const grades  = [...new Set(testsInSeries.map(t => t.grade))];

                    const [totalPerGrade, assessedPerGrade] = await Promise.all([
                        prisma.learner.groupBy({
                            by: ['grade'],
                            where: { ...learnerScope, status: 'ACTIVE', grade: { in: grades as any } },
                            _count: true,
                        }),
                        prisma.learner.groupBy({
                            by: ['grade'],
                            where: {
                                status:  'ACTIVE',
                                ...learnerScope,
                                grade:   { in: grades as any },
                                summativeResults: { some: { testId: { in: testIds }, archived: false } },
                            },
                            _count: true,
                        }),
                    ]);

                    const totalMap    = new Map(totalPerGrade.map(r  => [r.grade, r._count]));
                    const assessedMap = new Map(assessedPerGrade.map(r => [r.grade, r._count]));

                    totalMissedExams = 0;
                    unAssessedBreakdown = grades.map(grade => {
                        const total      = totalMap.get(grade as any)    || 0;
                        const assessed   = assessedMap.get(grade as any) || 0;
                        const unAssessed = total - assessed;
                        totalMissedExams += unAssessed;
                        return { grade: (grade as string).replace(/_/g, ' '), total, assessed, unAssessed };
                    }).filter(b => b.total > 0);
                }
            }

            // ── Stage 3: Lookup tables ────────────────────────────────────────
            const latestAssessments = [
                ...latestFormative.map((f: any) => ({ ...f, type: 'FORMATIVE' })),
                ...latestSummative.map((s: any) => ({
                    title: s.test.title, learningArea: s.test.learningArea,
                    learner: s.learner, createdAt: s.createdAt, type: 'SUMMATIVE'
                }))
            ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

            const [feeStructures, testGrades, monthlyPayments, currentYearTermConfigs] = await Promise.all([
                prisma.feeStructure.findMany({
                    where: { id: { in: feeByGrade.map((r: any) => r.feeStructureId) } },
                    select: {
                        id: true,
                        name: true,
                        grade: true,
                        feeItems: {
                            select: {
                                amount: true,
                                feeType: {
                                    select: {
                                        code: true,
                                        name: true,
                                        category: true
                                    }
                                }
                            }
                        }
                    },
                }),
                prisma.summativeTest.findMany({
                    where: { id: { in: summativeByGrade.map((r: any) => r.testId) } },
                    select: { id: true, grade: true },
                }),
                // Monthly payment totals for last 6 months (powers the trend chart)
                (async () => {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
                    sixMonthsAgo.setDate(1);
                    sixMonthsAgo.setHours(0, 0, 0, 0);
                    return prisma.$queryRaw<Array<{ month: string; revenue: number; outstanding: number; expected: number }>>(
                        Prisma.sql`
                            SELECT
                                TO_CHAR(p."createdAt", 'Mon YY')   AS month,
                                SUM(p.amount)::float               AS revenue,
                                COALESCE(SUM(
                                    CASE WHEN i."balance" > 0 THEN i."balance" ELSE 0 END
                                ), 0)::float                       AS outstanding,
                                COALESCE(SUM(i."totalAmount"), 0)::float AS expected
                            FROM fee_payments p
                            JOIN fee_invoices i ON i.id = p."invoiceId"
                            WHERE p."createdAt" >= ${sixMonthsAgo}
                              AND p.archived = false
                            GROUP BY DATE_TRUNC('month', p."createdAt"), TO_CHAR(p."createdAt", 'Mon YY')
                            ORDER BY DATE_TRUNC('month', p."createdAt")
                        `
                    );
                })(),
                prisma.termConfig.findMany({
                    where: { academicYear: activeAcademicYear },
                    select: {
                        term: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                }),
            ]);

            const scopedFeeStructures = feeStructures.filter((fs) => {
                const grade = normalizeFeeGrade(fs?.grade || fs?.name);
                return grade ? allowedFeeGrades.has(grade) : false;
            });
            const allowedFeeStructureIds = new Set(scopedFeeStructures.map((fs) => fs.id));
            const scopedFeeByGrade = feeByGrade.filter((row: any) => allowedFeeStructureIds.has(row.feeStructureId));
            const feeStructureMap = new Map(scopedFeeStructures.map(fs => [fs.id, fs]));
            const feeBreakdownByGrade = new Map<string, { grade: string; name: string; target: number; collected: number; bal: number }>();
            scopedFeeByGrade.forEach((row: any) => {
                const fs = feeStructureMap.get(row.feeStructureId);
                if (!fs) return;

                const grade = normalizeFeeGrade(fs.grade || fs.name);
                if (!grade || !allowedFeeGrades.has(grade)) return;

                const current = feeBreakdownByGrade.get(grade) || {
                    grade,
                    name: FEE_GRADE_LABELS[grade] || grade.replace('_', ' '),
                    target: 0,
                    collected: 0,
                    bal: 0,
                };

                current.target += Number(row._sum.totalAmount || 0);
                current.collected += Number(row._sum.paidAmount || 0);
                current.bal += Number(row._sum.balance || 0);
                feeBreakdownByGrade.set(grade, current);
            });
            const streamBreakdown = Array.from(feeBreakdownByGrade.values())
                .sort((a: any, b: any) => b.bal - a.bal);
            const activeTermIndex = FEE_TERMS.indexOf(activeTerm as any);
            const termConfigMap = new Map(currentYearTermConfigs.map((cfg: any) => [String(cfg.term), cfg]));
            const feeTermBreakdown = FEE_TERMS.map((term, index) => {
                const config = termConfigMap.get(term);
                const hasStarted = config?.startDate ? new Date(config.startDate) <= now : index <= activeTermIndex;
                const isFuture = activeTermIndex >= 0 ? index > activeTermIndex : !hasStarted;
                const rowsForTerm = scopedFeeByGrade.filter((row: any) => String(row.term) === term);
                const byGrade = new Map<string, { grade: string; name: string; target: number; collected: number; bal: number }>();

                rowsForTerm.forEach((row: any) => {
                    const fs = feeStructureMap.get(row.feeStructureId);
                    if (!fs) return;

                    const grade = normalizeFeeGrade(fs.grade || fs.name);
                    if (!grade || !allowedFeeGrades.has(grade)) return;

                    const current = byGrade.get(grade) || {
                        grade,
                        name: FEE_GRADE_LABELS[grade] || grade.replace('_', ' '),
                        target: 0,
                        collected: 0,
                        bal: 0,
                    };

                    current.target += Number(row._sum.totalAmount || 0);
                    current.collected += Number(row._sum.paidAmount || 0);
                    current.bal += Number(row._sum.balance || 0);
                    byGrade.set(grade, current);
                });

                const rows = Array.from(byGrade.values())
                    .sort((a: any, b: any) => b.bal - a.bal);
                const totals = rows.reduce((sum, row) => ({
                    target: sum.target + row.target,
                    collected: sum.collected + row.collected,
                    bal: sum.bal + row.bal,
                }), { target: 0, collected: 0, bal: 0 });

                return {
                    term,
                    label: FEE_TERM_LABELS[term],
                    academicYear: activeAcademicYear,
                    isActive: term === activeTerm,
                    isFuture,
                    disabled: isFuture || !hasStarted,
                    startDate: config?.startDate ?? null,
                    endDate: config?.endDate ?? null,
                    rows,
                    totals,
                };
            });
            const scopedFeeCollected = scopedFeeByGrade.reduce((sum: number, row: any) => sum + Number(row._sum.paidAmount || 0), 0);
            const scopedFeePending = scopedFeeByGrade.reduce((sum: number, row: any) => sum + Number(row._sum.balance || 0), 0);
            const averageAssessmentScore = Number(currentAssessmentAverage?._avg?.percentage || 0);
            const previousAssessmentScore = Number(previousAssessmentAverage?._avg?.percentage || 0);
            const assessmentTrend = this.calculateTrend(averageAssessmentScore, previousAssessmentScore);

            const debtorClassMap = new Map<string, { className: string; outstanding: number; learners: number }>();
            (topDebtorInvoices || []).forEach((invoice: any) => {
                const learner = invoice?.learner;
                const grade = String(learner?.grade || 'UNASSIGNED').replace(/_/g, ' ');
                const stream = String(learner?.stream || '').trim();
                const className = stream ? `${grade} · ${stream}` : grade;
                const current = debtorClassMap.get(className) || { className, outstanding: 0, learners: 0 };
                current.outstanding += Number(invoice?.balance || 0);
                current.learners += 1;
                debtorClassMap.set(className, current);
            });
            const topDebtorClasses = Array.from(debtorClassMap.values())
                .sort((a, b) => b.outstanding - a.outstanding)
                .slice(0, 5);

            const recentPayments = (recentFeePayments || []).map((payment: any) => ({
                id: payment.id,
                receiptNumber: payment.receiptNumber,
                amount: Number(payment.amount || 0),
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                invoiceNumber: payment.invoice?.invoiceNumber || null,
                learnerName: `${payment.invoice?.learner?.firstName || ''} ${payment.invoice?.learner?.lastName || ''}`.trim(),
                grade: payment.invoice?.learner?.grade || null,
                stream: payment.invoice?.learner?.stream || null,
            }));

            // Calculate category-wise revenue breakdown
            let totalTuitionPaid = 0;
            let totalTransportPaid = 0;
            let totalUniformPaid = 0;
            let totalOthersPaid = 0;

            scopedFeeByGrade.forEach((row: any) => {
                const fs = feeStructureMap.get(row.feeStructureId);
                if (!fs) return;

                const totalBilled = Number(row._sum.totalAmount || 0);
                const totalPaid = Number(row._sum.paidAmount || 0);
                const transportBilled = Number(row._sum.transportBilled || 0);
                const transportPaid = Number(row._sum.transportPaid || 0);

                const nonTransportBilled = Math.max(0, totalBilled - transportBilled);
                const nonTransportPaid = Math.max(0, totalPaid - transportPaid);

                const feeItems = (fs as any).feeItems || [];
                const tuitionItem = feeItems.find((item: any) => item.feeType.code === 'TUITION');
                const tuitionBilled = tuitionItem ? Number(tuitionItem.amount) : 0;

                const uniformItem = feeItems.find((item: any) => item.feeType.code === 'UNIFORM');
                const uniformBilled = uniformItem ? Number(uniformItem.amount) : 0;

                const othersBilled = feeItems.reduce((acc: number, item: any) => {
                    if (item.feeType.code !== 'TUITION' && item.feeType.code !== 'UNIFORM' && item.feeType.code !== 'TRANSPORT') {
                        return acc + Number(item.amount);
                    }
                    return acc;
                }, 0);

                const structureNonTransportBilled = tuitionBilled + uniformBilled + othersBilled;

                if (structureNonTransportBilled > 0) {
                    const ratio = nonTransportPaid / structureNonTransportBilled;
                    totalTuitionPaid += tuitionBilled * ratio;
                    totalUniformPaid += uniformBilled * ratio;
                    totalOthersPaid += othersBilled * ratio;
                } else {
                    totalTuitionPaid += nonTransportPaid;
                }

                totalTransportPaid += transportPaid;
            });

            const revenueSources = [
                { source: 'Fee', amount: Math.round(totalTuitionPaid) },
                { source: 'Transport', amount: Math.round(totalTransportPaid) },
                { source: 'Uniforms', amount: Math.round(totalUniformPaid) },
                { source: 'Others', amount: Math.round(totalOthersPaid) },
            ];

            const gradeMap = new Map(testGrades.map(t => [t.id, t.grade]));
            const classPerfMap: Record<string, { total: number; count: number }> = {};
            summativeByGrade.forEach((r: any) => {
                const grade = gradeMap.get(r.testId) || 'UNKNOWN';
                if (!classPerfMap[grade]) classPerfMap[grade] = { total: 0, count: 0 };
                classPerfMap[grade].total += (r._avg.percentage || 0) * r._count;
                classPerfMap[grade].count += r._count;
            });

            const topPerformingClasses = Object.entries(classPerfMap)
                .map(([grade, d]) => ({
                    grade: grade.replace('_', ' '),
                    avg:   d.count > 0 ? parseFloat((d.total / d.count).toFixed(1)) : 0,
                    label: (d.total / d.count) > 80 ? 'Exceeding' : (d.total / d.count) > 60 ? 'Meeting' : 'Approaching'
                }))
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 5);

            const subjPerfMap: Record<string, { ee: number; me: number; be: number; total: number }> = {};
            subjectRatings.forEach((r: any) => {
                if (!subjPerfMap[r.learningArea]) subjPerfMap[r.learningArea] = { ee: 0, me: 0, be: 0, total: 0 };
                subjPerfMap[r.learningArea].total += r._count;
                if      (r.overallRating === 'EE')                         subjPerfMap[r.learningArea].ee += r._count;
                else if (r.overallRating === 'ME' || r.overallRating === 'AE') subjPerfMap[r.learningArea].me += r._count;
                else if (r.overallRating === 'BE')                         subjPerfMap[r.learningArea].be += r._count;
            });
            const subjectProficiency = Object.entries(subjPerfMap).map(([area, d]) => ({
                area,
                ee: d.total > 0 ? Math.round((d.ee / d.total) * 100) : 0,
                me: d.total > 0 ? Math.round((d.me / d.total) * 100) : 0,
                be: d.total > 0 ? Math.round((d.be / d.total) * 100) : 0,
            })).slice(0, 4);

            const attendanceMap: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0 };
            attendanceSummary.forEach((item: any) => { attendanceMap[item.status] = item._count; });
            const displayedStudentCount = activeStudents || studentCount;
            const avgAttendance = displayedStudentCount > 0 ? (attendanceMap.PRESENT / displayedStudentCount) * 100 : 0;
            const attendanceTrendStart = new Date();
            attendanceTrendStart.setDate(attendanceTrendStart.getDate() - 35);
            attendanceTrendStart.setHours(0, 0, 0, 0);
            const activeTeacherList = await prisma.user.findMany({
                where: { role: { in: [...TUTOR_ROLES] as any }, status: 'ACTIVE', archived: false },
                select: { id: true, subject: true, role: true },
            });
            const [attendanceTrend, teacherAttendanceByDept] = await Promise.all([
                this.getAttendanceTrend(attendanceTrendStart, activeTeacherList.map(teacher => teacher.id)),
                this.getTeacherAttendanceGroups(activeTeacherList, staffStartOfToday, staffEndOfToday),
            ]);

            const presentTeacherCount = new Set((teacherClockInsToday as any[]).map(record => record.userId)).size;
            const presentSubordinateStaffCount = new Set((subordinateClockInsToday as any[]).map(record => record.userId)).size;

            const payload = {
                context: {
                    academicYear: activeAcademicYear,
                    term: activeTerm,
                    institutionType,
                },
                stats: {
                    totalStudents: displayedStudentCount, activeStudents,
                    totalTeachers: teacherCount, activeTeachers,
                    totalClasses: classCount,
                    totalAssessedClasses: assessedClassCount,
                    totalMissedExams, currentTestSeries,
                    presentToday: attendanceMap.PRESENT, absentToday: attendanceMap.ABSENT, lateToday: attendanceMap.LATE,
                    avgAttendance: parseFloat(avgAttendance.toFixed(1)),
                    feeCollected: scopedFeeCollected,
                    feePending:   scopedFeePending,
                    feeCollectionsToday: Number(feeCollectionsToday?._sum?.amount || 0),
                    feeCollectionsThisWeek: Number(feeCollectionsThisWeek?._sum?.amount || 0),
                    feeCollectionsThisMonth: Number(feeCollectionsThisMonth?._sum?.amount || 0),
                    staffOnLeave: staffOnLeaveCount,
                    studentTrend: this.calculateTrend(displayedStudentCount,  prevStudentCount),
                    teacherTrend: this.calculateTrend(teacherCount,  prevTeacherCount),
                    averageAssessmentScore: parseFloat(averageAssessmentScore.toFixed(1)),
                    assessmentTrend,
                    males:   genderDistribution.find((g: any) => g.gender === 'MALE')  ?._count || 0,
                    females: genderDistribution.find((g: any) => g.gender === 'FEMALE')?._count || 0,
                    totalPendingAssessments: pendingDraftCount,
                    performance: { ee: 0, me: 0, ae: 0, be: 0 },
                    // ── Staff / tutor clock-in attendance (today) ──────────────
                    presentTeachers: presentTeacherCount,
                    absentTeachers: Math.max(0, (activeTeachers as number) - presentTeacherCount),
                    teacherAttendanceRate: (activeTeachers as number) > 0
                        ? parseFloat(((presentTeacherCount / (activeTeachers as number)) * 100).toFixed(1))
                        : 0,
                    totalSubordinateStaff: subordinateStaffCount as number,
                    presentSubordinateStaff: presentSubordinateStaffCount,
                    absentSubordinateStaff: Math.max(0, (subordinateStaffCount as number) - presentSubordinateStaffCount),
                    staffAttendanceRate: (subordinateStaffCount as number) > 0
                        ? parseFloat(((presentSubordinateStaffCount / (subordinateStaffCount as number)) * 100).toFixed(1))
                        : 0,
                },
                unAssessedBreakdown,
                distributions: {
                    studentsByGrade: studentsByGradeData.map((item: any) => ({
                        label: item.grade.replace('_', ' '), value: item._count, color: this.getGradeColor(item.grade),
                    })),
                    staff: staffByRole.map((item: any) => ({
                        label: item.role.replace('_', ' '), value: item._count, color: this.getRoleColor(item.role),
                    })),
                    subjectProficiency,
                },
                financials: {
                    streamBreakdown,
                    termBreakdown: feeTermBreakdown,
                    trendData: monthlyPayments.map(r => ({
                        month:       String(r.month || ''),
                        collected:   Number(r.revenue      || 0),
                        outstanding: Number(r.outstanding  || 0),
                        expected:    Number(r.expected     || 0),
                        // keep legacy `revenue` alias so existing widgets don't break
                        revenue:     Number(r.revenue      || 0),
                    })),
                    revenueSources,
                    totalExpenses: Number(expensesThisTerm._sum.amount || 0),
                    profitPosition: scopedFeeCollected - Number(expensesThisTerm._sum.amount || 0),
                    collectionWindows: {
                        today: Number(feeCollectionsToday?._sum?.amount || 0),
                        week: Number(feeCollectionsThisWeek?._sum?.amount || 0),
                        month: Number(feeCollectionsThisMonth?._sum?.amount || 0),
                    },
                    recentPayments,
                    topDebtorClasses,
                    expensesSummary: {
                        today: Number(expensesToday._sum.amount || 0),
                        thisMonth: Number(expensesThisMonth._sum.amount || 0),
                        thisTerm: Number(expensesThisTerm._sum.amount || 0),
                        pendingBills: {
                            count: Number(pendingBills?._count || 0),
                            amount: Number(pendingBills?._sum?.amount || 0),
                        },
                        byCategory: expensesByCategory.map((item: any) => ({
                            category: item.category,
                            amount: Number(item._sum.amount || 0)
                        })),
                        recent: recentExpenses.map((item: any) => ({
                            id: item.id,
                            date: item.date,
                            amount: Number(item.amount),
                            description: item.description,
                            category: item.category,
                            account: item.account?.name || 'Main Bank Account'
                        }))
                    }
                },
                attendanceTrend,
                teacherAttendanceByDept,
                recentActivity: { admissions: latestAdmissions, assessments: latestAssessments },
                topPerformingClasses,
                upcomingEvents: upcomingEventsData.map((evt: any) => ({
                    title: evt.title, date: evt.startDate, category: evt.type,
                    responsible: evt.creator?.role?.replace('_', ' ') || 'Staff',
                })),
            };

            await redisCacheService.set(cacheKey, payload, ADMIN_CACHE_TTL);
            console.timeEnd('🚀 [DASHBOARD] getAdminMetrics');
            res.json({ success: true, data: payload });

        } catch (error: any) {
            console.timeEnd('🚀 [DASHBOARD] getAdminMetrics');
            logger.error('Admin Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch dashboard metrics');
        }
    }

    /** GET /api/dashboard/teacher */
    async getTeacherMetrics(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(400, 'User ID is required');
            const institutionType = this.getInstitutionType(req) as any;

            const cacheKey = `dashboard:teacher:v5:${userId}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            const [myClasses, pendingAssessmentCount, pendingAssessmentItems, recentActivityRaw, recentMessagesRaw, upcomingEventsRaw] = await Promise.all([
                prisma.class.findMany({
                    where: {
                        archived: false,
                        institutionType,
                        OR: [
                            { teacherId: userId },
                            { schedules: { some: { teacherId: userId, active: true, archived: false } } },
                        ],
                    },
                    include: {
                        schedules: {
                            where: { active: true, archived: false },
                            select: {
                                id: true,
                                subject: true,
                                day: true,
                                startTime: true,
                                endTime: true,
                                room: true,
                                teacherId: true,
                                notes: true,
                            },
                        },
                        _count: { select: { enrollments: { where: { active: true } } } },
                    },
                }),
                prisma.formativeAssessment.count({ where: { teacherId: userId, status: 'DRAFT', archived: false } }),
                prisma.formativeAssessment.findMany({
                    where: { teacherId: userId, status: 'DRAFT', archived: false },
                    orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
                    take: 10,
                    select: {
                        id: true,
                        title: true,
                        learningArea: true,
                        type: true,
                        date: true,
                        createdAt: true,
                        learner: { select: { firstName: true, lastName: true, grade: true, stream: true } },
                    },
                }),
                prisma.formativeAssessment.findMany({
                    where: { teacherId: userId },
                    orderBy: { createdAt: 'desc' }, take: 10,
                    select: { id: true, title: true, learningArea: true, createdAt: true },
                }),
                prisma.message.findMany({
                    where: { senderId: userId },
                    orderBy: { createdAt: 'desc' },
                    take: 6,
                    select: { id: true, subject: true, body: true, createdAt: true, status: true, recipientType: true },
                }),
                prisma.event.findMany({
                    where: {
                        startDate: { gte: today, lte: nextWeek },
                        OR: [
                            { creatorId: userId },
                            { type: { in: ['MEETING', 'EXAM', 'ACADEMIC', 'GENERAL'] as any[] } },
                        ],
                    },
                    orderBy: { startDate: 'asc' },
                    take: 8,
                    select: { id: true, title: true, startDate: true, endDate: true, type: true, location: true, allDay: true },
                }),
            ]);

            const myClassesWithOccupancy = await Promise.all(myClasses.map(async (cls) => {
                const enrollmentCount = cls._count.enrollments;
                if (enrollmentCount > 0) return cls;

                const occupancy = await prisma.learner.count({
                    where: {
                        grade: cls.grade,
                        institutionType,
                        ...(cls.stream ? { stream: cls.stream } : {}),
                        status: 'ACTIVE',
                        archived: false,
                    },
                });

                return {
                    ...cls,
                    _count: { ...cls._count, enrollments: occupancy },
                };
            }));

            const totalMyStudents = myClassesWithOccupancy.reduce((sum, cls) => sum + cls._count.enrollments, 0);
            const classIds = myClassesWithOccupancy.map(cls => cls.id);
            const attendanceByClass = classIds.length > 0
                ? await prisma.attendance.groupBy({
                    by: ['classId'],
                    where: { classId: { in: classIds }, date: today, archived: false },
                    _count: true,
                })
                : [];
            const [messages, learnersNeedingAttention, topPerformers] = await Promise.all([
                this.getDashboardMessages(userId),
                this.getTeacherLearnerRiskItems(classIds),
                this.getTeacherTopPerformers(classIds),
            ]);
            const attendanceCountMap = new Map(attendanceByClass.map(row => [row.classId, row._count]));

            const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const todayName = dayNames[new Date().getDay()];
            const formatClassName = (cls: any) => cls.name || [cls.grade, cls.stream].filter(Boolean).join(' ') || 'Class';
            const durationMinutes = (start?: string | null, end?: string | null) => {
                if (!start || !end) return null;
                const [sh, sm] = start.split(':').map(Number);
                const [eh, em] = end.split(':').map(Number);
                if ([sh, sm, eh, em].some(Number.isNaN)) return null;
                return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
            };

            const todaysSchedule = myClassesWithOccupancy.flatMap((cls) => {
                const schedules = (cls.schedules || []).filter((schedule: any) =>
                    String(schedule.day || '').trim().toUpperCase() === todayName
                );
                return schedules.map((schedule: any) => ({
                    id: schedule.id,
                    classId: cls.id,
                    grade: formatClassName(cls),
                    subject: schedule.subject || 'Class session',
                    time: schedule.startTime || '',
                    endTime: schedule.endTime || '',
                    duration: durationMinutes(schedule.startTime, schedule.endTime),
                    room: schedule.room || cls.room || 'N/A',
                    status: 'scheduled',
                    learners: cls._count.enrollments,
                    notes: schedule.notes || '',
                }));
            }).sort((a, b) => String(a.time).localeCompare(String(b.time)));

            const classSummary = myClassesWithOccupancy.map(cls => ({
                id: cls.id,
                grade: formatClassName(cls),
                subject: 'Assigned class',
                time: '',
                room: cls.room || 'N/A',
                status: 'scheduled',
                learners: cls._count.enrollments,
            }));

            const normalizeSubject = (value?: string | null) => String(value || 'Class teacher').trim() || 'Class teacher';
            const learnerAnalysisClasses = myClassesWithOccupancy.map((cls: any) => {
                const teacherSchedules = (cls.schedules || []).filter((schedule: any) =>
                    schedule.teacherId === userId || cls.teacherId === userId
                );
                const subjectMap = new Map<string, any>();

                teacherSchedules.forEach((schedule: any) => {
                    const subject = normalizeSubject(schedule.subject);
                    const existing = subjectMap.get(subject) || {
                        subject,
                        learnerCount: cls._count.enrollments,
                        lessonCount: 0,
                        weeklyMinutes: 0,
                        days: new Set<string>(),
                        rooms: new Set<string>(),
                        nextLesson: null,
                    };
                    const minutes = durationMinutes(schedule.startTime, schedule.endTime) || 0;
                    existing.lessonCount += 1;
                    existing.weeklyMinutes += minutes;
                    if (schedule.day) existing.days.add(String(schedule.day));
                    if (schedule.room || cls.room) existing.rooms.add(schedule.room || cls.room);
                    if (!existing.nextLesson || String(schedule.startTime || '').localeCompare(String(existing.nextLesson.time || '')) < 0) {
                        existing.nextLesson = {
                            day: schedule.day || '',
                            time: schedule.startTime || '',
                            endTime: schedule.endTime || '',
                            room: schedule.room || cls.room || 'N/A',
                        };
                    }
                    subjectMap.set(subject, existing);
                });

                if (subjectMap.size === 0) {
                    subjectMap.set('Class teacher', {
                        subject: 'Class teacher',
                        learnerCount: cls._count.enrollments,
                        lessonCount: 0,
                        weeklyMinutes: 0,
                        days: new Set<string>(),
                        rooms: new Set<string>(cls.room ? [cls.room] : []),
                        nextLesson: null,
                    });
                }

                const subjects = Array.from(subjectMap.values()).map((subject: any) => ({
                    ...subject,
                    days: Array.from(subject.days),
                    rooms: Array.from(subject.rooms),
                    pendingAssessments: pendingAssessmentItems.filter((item: any) =>
                        normalizeSubject(item.learningArea).toLowerCase() === subject.subject.toLowerCase()
                    ).length,
                }));

                return {
                    classId: cls.id,
                    className: formatClassName(cls),
                    grade: cls.grade,
                    stream: cls.stream || '',
                    room: cls.room || 'N/A',
                    learnerCount: cls._count.enrollments,
                    subjectCount: subjects.length,
                    attendanceMarked: attendanceCountMap.get(cls.id) || 0,
                    subjects,
                };
            });

            const learnerAnalysis = {
                totalLearners: totalMyStudents,
                totalClasses: learnerAnalysisClasses.length,
                totalSubjects: learnerAnalysisClasses.reduce((sum, cls) => sum + cls.subjectCount, 0),
                classes: learnerAnalysisClasses,
            };

            const attendanceDue = myClassesWithOccupancy
                .map(cls => {
                    const learners = cls._count.enrollments;
                    const marked = attendanceCountMap.get(cls.id) || 0;
                    return {
                        id: cls.id,
                        grade: formatClassName(cls),
                        subject: 'Daily attendance',
                        time: '',
                        submitted: learners > 0 && marked >= learners,
                        learners,
                        marked,
                    };
                })
                .filter(item => !item.submitted);

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const scheduleWithStatus = todaysSchedule.map((item) => {
                const startParts = String(item.time || '').split(':').map(Number);
                const endParts = String(item.endTime || '').split(':').map(Number);
                const start = startParts.length >= 2 && !startParts.some(Number.isNaN)
                    ? startParts[0] * 60 + startParts[1]
                    : null;
                const end = endParts.length >= 2 && !endParts.some(Number.isNaN)
                    ? endParts[0] * 60 + endParts[1]
                    : null;
                let status = 'scheduled';
                if (start !== null && end !== null && currentMinutes >= start && currentMinutes <= end) status = 'in-progress';
                else if (start !== null && currentMinutes < start) status = 'upcoming';
                else if (end !== null && currentMinutes > end) status = 'completed';
                return { ...item, status };
            });

            const pendingAttendanceLearners = attendanceDue.reduce((sum, item) => (
                sum + Math.max(0, Number(item.learners || 0) - Number(item.marked || 0))
            ), 0);

            const assessmentItems = pendingAssessmentItems.map((item: any) => ({
                id: item.id,
                grade: item.learner?.stream ? `${item.learner.grade?.replace(/_/g, ' ')} ${item.learner.stream}` : item.learner?.grade?.replace(/_/g, ' ') || 'Learner',
                title: item.title || item.learningArea || 'Draft assessment',
                count: 1,
                dueDate: item.date || item.createdAt,
                subject: item.learningArea,
                learnerName: [item.learner?.firstName, item.learner?.lastName].filter(Boolean).join(' '),
                type: item.type,
            }));

            const learnerScope = myClassesWithOccupancy.map((cls: any) => ({
                grade: cls.grade,
                ...(cls.stream ? { stream: cls.stream } : {}),
                institutionType,
                status: 'ACTIVE' as any,
                archived: false,
            }));

            const feeWhere: any = learnerScope.length > 0
                ? {
                    archived: false,
                    balance: { gt: 0 },
                    status: { not: 'CANCELLED' as any },
                    learner: { OR: learnerScope },
                }
                : { id: '__none__' };

            const [feeBalanceAgg, feeBalanceLearners] = await Promise.all([
                prisma.feeInvoice.aggregate({
                    where: feeWhere,
                    _sum: { balance: true },
                }),
                prisma.feeInvoice.findMany({
                    where: feeWhere,
                    distinct: ['learnerId'],
                    select: { learnerId: true },
                }),
            ]);

            // Determine if this teacher is a class (homeroom) teacher
            const classTeacherRecord = myClassesWithOccupancy.find(cls => cls.teacherId === userId);
            const isClassTeacher = !!classTeacherRecord;
            const classTeacherOf = classTeacherRecord
                ? {
                    id: classTeacherRecord.id,
                    name: formatClassName(classTeacherRecord),
                    grade: classTeacherRecord.grade,
                    stream: classTeacherRecord.stream ?? null,
                    learnerCount: classTeacherRecord._count.enrollments,
                }
                : null;

            const classLoad = learnerAnalysisClasses.map((cls: any) => {
                const attendanceMarked = Number(cls.attendanceMarked || 0);
                const learnerCount = Number(cls.learnerCount || 0);
                const pending = Math.max(0, learnerCount - attendanceMarked);
                const assessmentCount = cls.subjects.reduce((sum: number, subject: any) => sum + Number(subject.pendingAssessments || 0), 0);
                const attendanceRate = learnerCount > 0 ? Math.round((attendanceMarked / learnerCount) * 100) : 0;
                return {
                    id: cls.classId,
                    name: cls.className,
                    room: cls.room,
                    learnerCount,
                    attendanceRate,
                    pending,
                    assessmentCount,
                    subjects: cls.subjects.map((subject: any) => subject.subject).slice(0, 3),
                };
            });

            const eventActivity = upcomingEventsRaw
                .filter((evt: any) => new Date(evt.startDate).toDateString() === today.toDateString())
                .map((evt: any) => ({
                    id: evt.id,
                    text: evt.title,
                    detail: evt.type?.replace(/_/g, ' ') || 'Calendar',
                    time: evt.startDate,
                    type: 'calendar',
                }));

            const recentActivity = [
                ...recentActivityRaw.map(act => ({
                    id: act.id,
                    text: act.title || `${act.learningArea} assessment`,
                    detail: `${act.learningArea || 'Assessment'} created`,
                    time: act.createdAt,
                    type: 'assessment',
                })),
                ...recentMessagesRaw.map((msg: any) => ({
                    id: msg.id,
                    text: msg.subject || 'Parent message',
                    detail: `${String(msg.recipientType || '').replace(/_/g, ' ') || 'Message'} · ${msg.status}`,
                    time: msg.createdAt,
                    type: 'message',
                })),
                ...eventActivity,
            ]
                .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())
                .slice(0, 8);

            const pendingWork = {
                assignmentsToReview: assessmentItems.filter((item: any) => String(item.type || '').toUpperCase().includes('ASSIGN')).length,
                assessmentsToGrade: assessmentItems.length,
                learnerAlerts: learnersNeedingAttention.length,
                parentMessages: recentMessagesRaw.filter((msg: any) => msg.status === 'DRAFT' || msg.status === 'FAILED').length,
                attendancePending: attendanceDue.length,
                pendingAttendanceLearners,
                outstandingFeeLearners: feeBalanceLearners.length,
            };

            const nextAttendance = attendanceDue[0];
            const currentLesson = scheduleWithStatus.find((item: any) => item.status === 'in-progress');
            const nextLesson = scheduleWithStatus.find((item: any) => item.status === 'upcoming') || scheduleWithStatus[0];
            const nextAction = nextAttendance
                ? {
                    type: 'attendance',
                    title: `Take attendance for ${nextAttendance.grade}`,
                    description: `${nextAttendance.marked}/${nextAttendance.learners} marked`,
                    actionLabel: 'Start Attendance',
                    navigateTo: 'attendance-daily',
                    classId: nextAttendance.id,
                    priority: 'high',
                }
                : assessmentItems[0]
                    ? {
                        type: 'assessment',
                        title: `Complete ${assessmentItems[0].title}`,
                        description: [assessmentItems[0].subject, assessmentItems[0].learnerName].filter(Boolean).join(' · '),
                        actionLabel: 'Enter Marks',
                        navigateTo: 'assess-summative-assessment',
                        priority: 'medium',
                    }
                    : nextLesson
                        ? {
                            type: 'lesson',
                            title: `${currentLesson ? 'Continue' : 'Prepare'} ${nextLesson.subject}`,
                            description: [nextLesson.grade, nextLesson.room, nextLesson.time].filter(Boolean).join(' · '),
                            actionLabel: 'View Timetable',
                            navigateTo: 'planner-timetable',
                            priority: currentLesson ? 'high' : 'normal',
                        }
                        : {
                            type: 'clear',
                            title: 'No urgent action',
                            description: 'Your attendance and assessment queues are clear.',
                            actionLabel: 'View Learners',
                            navigateTo: 'teacher-learner-analysis',
                            priority: 'low',
                        };

            const upcomingEvents = upcomingEventsRaw.map((evt: any) => ({
                id: evt.id,
                title: evt.title,
                date: evt.startDate,
                endDate: evt.endDate,
                type: evt.type,
                location: evt.location,
                allDay: evt.allDay,
            }));

            const payload = {
                stats: {
                    myStudents: totalMyStudents, myClasses: myClassesWithOccupancy.length,
                    pendingTasks: pendingAssessmentCount + attendanceDue.length + learnersNeedingAttention.length,
                    messages: messages.length,
                    lessonsToday: scheduleWithStatus.length,
                    isClassTeacher,
                    classTeacherOf,
                    analytics: {
                        attendance: totalMyStudents > 0 ? Math.round(((totalMyStudents - attendanceDue.reduce((sum, item) => sum + Math.max(0, item.learners - item.marked), 0)) / totalMyStudents) * 100) : 0,
                        graded: pendingAssessmentCount === 0 ? 100 : Math.max(0, Math.round(((totalMyStudents - pendingAssessmentCount) / (totalMyStudents || 1)) * 100)),
                        completion: 0, engagement: 0,
                    },
                },
                schedule: scheduleWithStatus.length > 0 ? scheduleWithStatus : classSummary,
                attendanceDue,
                assessmentsToMark: assessmentItems,
                pendingWork,
                nextAction,
                myClasses: classLoad,
                feeSummary: {
                    learnersWithBalance: feeBalanceLearners.length,
                    totalOutstanding: Number(feeBalanceAgg._sum.balance || 0),
                },
                learnerAnalysis,
                messages,
                learnersNeedingAttention,
                topPerformers,
                recentActivity,
                upcomingEvents,
                quickActions: [
                    { id: 'attendance', label: 'Take Attendance', icon: 'attendance', navigateTo: 'attendance-daily', count: attendanceDue.length },
                    { id: 'marks', label: 'Enter Marks', icon: 'marks', navigateTo: 'assess-summative-assessment', count: assessmentItems.length },
                    { id: 'lesson-notes', label: 'Lesson Notes', icon: 'notes', navigateTo: 'learning-hub-lesson-plans' },
                    { id: 'message', label: 'Send Message', icon: 'message', navigateTo: 'communication' },
                    { id: 'learners', label: 'Student Search', icon: 'learners', navigateTo: 'teacher-learner-analysis', count: learnersNeedingAttention.length },
                ],
            };

            await redisCacheService.set(cacheKey, payload, TEACHER_CACHE_TTL);
            res.json({ success: true, data: payload });

        } catch (error: any) {
            logger.error('Teacher Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch teacher dashboard metrics');
        }
    }

    /** GET /api/dashboard/parent */
    /** GET /api/dashboard/student */
    async getStudentMetrics(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(400, 'User ID is required');

            const cacheKey = `dashboard:student:v1:${userId}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const learner = await this.getStudentLearnerForUser(userId);

            const [attendance, coursesRaw, assignmentsRaw, summativeResults, formativeAssessments, achievementsRaw, messages] = await Promise.all([
                prisma.attendance.findMany({
                    where: { learnerId: learner.id, archived: false },
                    orderBy: { date: 'desc' },
                    take: 120,
                    select: { id: true, date: true, status: true },
                }),
                prisma.lMSEnrollment.findMany({
                    where: { learnerId: learner.id, status: 'ACTIVE', archived: false },
                    include: {
                        course: {
                            select: { id: true, title: true, subject: true, grade: true, description: true },
                        },
                        progress: {
                            select: { completed: true, progress: true, contentId: true, lastAccessedAt: true },
                        },
                    },
                    orderBy: { enrolledAt: 'desc' },
                }),
                prisma.lMSContent.findMany({
                    where: {
                        archived: false,
                        type: 'ASSIGNMENT',
                        course: {
                            enrollments: {
                                some: { learnerId: learner.id, status: 'ACTIVE', archived: false },
                            },
                        },
                    },
                    include: {
                        course: { select: { id: true, title: true, subject: true } },
                        progress: {
                            where: { enrollment: { learnerId: learner.id } },
                            select: { completed: true, progress: true, lastAccessedAt: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 12,
                }),
                prisma.summativeResult.findMany({
                    where: { learnerId: learner.id, archived: false },
                    include: { test: { select: { title: true, learningArea: true, testDate: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 12,
                }),
                prisma.formativeAssessment.findMany({
                    where: { learnerId: learner.id, archived: false },
                    orderBy: { createdAt: 'desc' },
                    take: 8,
                    select: { id: true, title: true, learningArea: true, type: true, percentage: true, overallRating: true, createdAt: true },
                }),
                prisma.learnerAchievement.findMany({
                    where: { learnerId: learner.id, archived: false },
                    orderBy: { earnedAt: 'desc' },
                    take: 8,
                    select: { id: true, title: true, description: true, type: true, earnedAt: true, xpEarned: true },
                }),
                this.getDashboardMessages(userId),
            ]);

            const courseIds = coursesRaw.map((enrollment) => enrollment.courseId);
            const totalContentCounts = courseIds.length > 0
                ? await prisma.lMSContent.groupBy({
                    by: ['courseId'],
                    where: { courseId: { in: courseIds }, archived: false },
                    _count: { _all: true },
                })
                : [];
            const contentCountMap = new Map(totalContentCounts.map((count) => [count.courseId, count._count._all]));

            const courses = coursesRaw.map((enrollment) => {
                const totalItems = contentCountMap.get(enrollment.courseId) || 0;
                const completedItems = enrollment.progress.filter((item) => item.completed).length;
                const progressPercent = totalItems > 0
                    ? Math.round((completedItems / totalItems) * 100)
                    : Math.round(enrollment.progress.reduce((sum, item) => sum + Number(item.progress || 0), 0) / Math.max(1, enrollment.progress.length));

                return {
                    id: enrollment.course.id,
                    courseId: enrollment.course.id,
                    enrollmentId: enrollment.id,
                    name: enrollment.course.title,
                    title: enrollment.course.title,
                    subject: enrollment.course.subject,
                    teacher: 'Assigned teacher',
                    grade: enrollment.course.grade,
                    description: enrollment.course.description || '',
                    totalItems,
                    completedItems,
                    progress: progressPercent,
                    progressPercent,
                };
            });

            const assignments = assignmentsRaw.map((item) => {
                const progress = item.progress[0];
                const submitted = Boolean(progress?.completed);
                const updatedAt = progress?.lastAccessedAt || item.createdAt;
                return {
                    id: item.id,
                    course: item.course.subject || item.course.title,
                    courseTitle: item.course.title,
                    title: item.title,
                    type: 'Assignment',
                    dueDate: item.createdAt,
                    date: item.createdAt,
                    daysLeft: null,
                    priority: submitted ? 'low' : 'medium',
                    submitted,
                    status: submitted ? 'submitted' : 'pending',
                    grade: submitted ? 'Submitted' : null,
                    score: progress?.progress ?? null,
                    updatedAt,
                };
            });

            const presentDays = attendance.filter((item) => item.status === 'PRESENT').length;
            const absentDays = attendance.filter((item) => item.status === 'ABSENT').length;
            const attendanceRate = attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : 0;

            const scoredResults = summativeResults.filter((result) => typeof result.percentage === 'number');
            const averageScore = scoredResults.length > 0
                ? Math.round(scoredResults.reduce((sum, result) => sum + Number(result.percentage || 0), 0) / scoredResults.length)
                : 0;

            const subjects = summativeResults.map((result) => ({
                id: result.id,
                name: result.test.learningArea,
                learningArea: result.test.learningArea,
                subject: result.test.learningArea,
                quiz: result.test.title,
                title: result.test.title,
                score: Math.round(Number(result.percentage || 0)),
                percentage: result.percentage,
                grade: result.grade,
                letterGrade: result.grade,
                date: result.test.testDate || result.createdAt,
            }));

            const formativeItems = formativeAssessments.map((assessment) => ({
                id: assessment.id,
                name: assessment.learningArea,
                learningArea: assessment.learningArea,
                subject: assessment.learningArea,
                quiz: assessment.title || assessment.type,
                title: assessment.title || assessment.type,
                score: Math.round(Number(assessment.percentage || 0)),
                percentage: assessment.percentage,
                grade: assessment.overallRating,
                letterGrade: assessment.overallRating,
                date: assessment.createdAt,
            }));

            const achievementFallback = [
                {
                    id: 'attendance-consistency',
                    name: 'Attendance Consistency',
                    description: `${attendanceRate}% attendance`,
                    icon: 'attendance',
                    earned: attendanceRate >= 90 && attendance.length > 0,
                },
                {
                    id: 'strong-performance',
                    name: 'Strong Performance',
                    description: `${averageScore}% average score`,
                    icon: 'performance',
                    earned: averageScore >= 80,
                },
                {
                    id: 'course-progress',
                    name: 'Course Progress',
                    description: `${courses.length} active course${courses.length === 1 ? '' : 's'}`,
                    icon: 'course',
                    earned: courses.length > 0,
                },
                {
                    id: 'clear-queue',
                    name: 'Clear Queue',
                    description: 'No pending assignments',
                    icon: 'queue',
                    earned: assignments.length > 0 && assignments.every((assignment) => assignment.submitted),
                },
            ];

            const achievements = achievementsRaw.length > 0
                ? achievementsRaw.map((achievement) => ({
                    id: achievement.id,
                    name: achievement.title,
                    title: achievement.title,
                    description: achievement.description || String(achievement.type).replace(/_/g, ' '),
                    icon: String(achievement.type || 'achievement').toLowerCase(),
                    earned: true,
                    earnedAt: achievement.earnedAt,
                    xpEarned: achievement.xpEarned,
                }))
                : achievementFallback;

            const classEnrollment = learner.enrollments[0]?.class;
            const payload = {
                learner: {
                    id: learner.id,
                    name: [learner.firstName, learner.lastName].filter(Boolean).join(' '),
                    firstName: learner.firstName,
                    lastName: learner.lastName,
                    admissionNumber: learner.admissionNumber,
                    grade: learner.grade,
                    stream: learner.stream,
                    className: classEnrollment?.name || [learner.grade, learner.stream].filter(Boolean).join(' '),
                    photoUrl: learner.photoUrl,
                },
                stats: {
                    attendanceRate,
                    attendance: attendanceRate,
                    attendancePresent: presentDays,
                    attendanceAbsent: absentDays,
                    attendanceTotal: attendance.length,
                    averageScore,
                    overallAverage: averageScore,
                    courseCount: courses.length,
                    pendingAssignments: assignments.filter((assignment) => !assignment.submitted).length,
                    dueSoonCount: assignments.filter((assignment) => !assignment.submitted).length,
                    submittedAssignments: assignments.filter((assignment) => assignment.submitted).length,
                    totalAssignments: assignments.length,
                    badgesEarned: achievements.filter((achievement) => achievement.earned).length,
                },
                courses,
                assignments,
                upcomingDeadlines: assignments.filter((assignment) => !assignment.submitted),
                subjects: subjects.length > 0 ? subjects : formativeItems,
                recentSubjects: subjects.length > 0 ? subjects : formativeItems,
                achievements,
                messages,
            };

            await redisCacheService.set(cacheKey, payload, STUDENT_CACHE_TTL);
            res.json({ success: true, data: payload });
        } catch (error: any) {
            logger.error('Student Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch student dashboard metrics');
        }
    }

    /** GET /api/dashboard/parent */
    async getParentMetrics(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(400, 'User ID is required');

            const cacheKey = `dashboard:parent:${userId}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const accessibleLearnerIds = await parentAccessService.getAccessibleLearnerIds(userId);

            const [children, noticesCount, notices] = await Promise.all([
                prisma.learner.findMany({
                    where: { id: { in: accessibleLearnerIds }, archived: false },
                    include: {
                        feeInvoices: { 
                            where: { archived: false }, 
                            select: { id: true, balance: true, totalAmount: true, invoiceNumber: true, createdAt: true, term: true, academicYear: true },
                            orderBy: { createdAt: 'desc' },
                            take: 10
                        },
                        formativeAssessments: { where: { archived: false }, orderBy: { createdAt: 'desc' }, take: 10 },
                        attendances: { where: { archived: false }, orderBy: { date: 'desc' }, take: 30 },
                        summativeResults: { 
                            where: { archived: false }, 
                            include: { test: { select: { title: true, learningArea: true } } },
                            orderBy: { createdAt: 'desc' },
                            take: 20
                        }
                    },
                }),
                prisma.notice.count({
                    where: { 
                        status: 'PUBLISHED', 
                        archived: false,
                        OR: [
                            { targetAudience: 'ALL' },
                            { targetAudience: 'PARENTS' }
                        ]
                    }
                }),
                prisma.notice.findMany({
                    where: {
                        status: 'PUBLISHED',
                        archived: false,
                        OR: [
                            { targetAudience: 'ALL' },
                            { targetAudience: 'PARENTS' }
                        ]
                    },
                    orderBy: { publishedAt: 'desc' },
                    take: 6,
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        publishedAt: true,
                    }
                }),
            ]);

            const processedChildren = children.map(child => {
                const totalBalance   = child.feeInvoices.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
                const attendanceRate = child.attendances.length > 0
                    ? (child.attendances.filter(a => a.status === 'PRESENT').length / child.attendances.length) * 100
                    : 100;
                const presentDays = child.attendances.filter(a => a.status === 'PRESENT').length;
                const absentDays = child.attendances.filter(a => a.status === 'ABSENT').length;
                const todayKey = new Date().toISOString().slice(0, 10);
                const todayAttendance = child.attendances.find(a => a.date.toISOString().slice(0, 10) === todayKey);
                const todayStatus = todayAttendance
                    ? (todayAttendance.status === 'PRESENT' ? 'PRESENT' : 'ABSENT')
                    : 'NOT_MARKED';

                const avgPerformance = child.summativeResults.length > 0
                    ? child.summativeResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / child.summativeResults.length
                    : 0;

                const getPerformanceLevel = (avg: number) => {
                    if (avg >= 80) return 'EE';
                    if (avg >= 60) return 'ME';
                    if (avg >= 40) return 'AE';
                    return 'BE';
                };

                const subjectStats = child.summativeResults.map(r => ({
                    name: r.test.learningArea,
                    score: r.percentage,
                    grade: r.grade,
                    title: r.test.title
                }));
                const homeworkCount = child.formativeAssessments.filter(a => a.type === 'ASSIGNMENT').length
                    || Math.min(5, child.formativeAssessments.length);
                const newMessages = Math.min(3, Math.max(0, child.formativeAssessments.length - 1));

                return {
                    id: child.id, 
                    name: `${child.firstName} ${child.lastName}`,
                    photoUrl: child.photoUrl,
                    profilePicture: child.photoUrl,
                    grade: child.grade.replace('_', ' '), 
                    className: child.stream ? `Class ${child.stream}` : 'Class',
                    admissionNumber: child.admissionNumber,
                    performanceLevel: getPerformanceLevel(avgPerformance), 
                    overallPerformance: avgPerformance > 0 ? `${Math.round(avgPerformance)}%` : 'No Data',
                    attendanceRate: Math.round(attendanceRate), 
                    todayStatus,
                    attendanceSummary: {
                        presentDays,
                        absentDays,
                        totalDays: child.attendances.length
                    },
                    feeBalance: totalBalance,
                    learningUpdates: child.formativeAssessments.length,
                    homeworkCount,
                    newMessages,
                    invoices: child.feeInvoices.map(inv => ({
                        id: (inv as any).id,
                        number: inv.invoiceNumber,
                        date: inv.createdAt,
                        amount: inv.totalAmount,
                        balance: inv.balance,
                        term: inv.term,
                        year: inv.academicYear
                    })),
                    subjects: subjectStats,
                    recentAssessments: child.formativeAssessments.map(a => ({
                        date: a.createdAt, subject: a.learningArea, type: a.type, grade: a.overallRating,
                    })),
                };
            });

            const [homework, messages] = await Promise.all([
                this.getParentHomeworkItems(processedChildren.map(child => ({ id: child.id, name: child.name }))),
                this.getDashboardMessages(userId),
            ]);

            const payload = {
                children: processedChildren,
                homework,
                messages,
                notices: notices.map((notice) => ({
                    id: notice.id,
                    title: notice.title,
                    description: notice.content,
                    publishedAt: notice.publishedAt,
                    timeLabel: this.formatRelativeDate(notice.publishedAt),
                })),
                stats: {
                    totalBalance: processedChildren.reduce((sum, c) => sum + c.feeBalance, 0),
                    avgAttendance: processedChildren.length > 0
                        ? Math.round(processedChildren.reduce((sum, c) => sum + c.attendanceRate, 0) / processedChildren.length)
                        : 100,
                    bulletins: noticesCount,
                },
            };

            await redisCacheService.set(cacheKey, payload, PARENT_CACHE_TTL);
            res.json({ success: true, data: payload });

        } catch (error: any) {
            logger.error('Parent Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to fetch parent dashboard metrics');
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private getDateFilter(filter: string) {
        const date = new Date(); date.setHours(0, 0, 0, 0);
        switch (filter) {
            case 'week':  { const diff = date.getDate() - date.getDay(); return { gte: new Date(date.setDate(diff)) }; }
            case 'month': return { gte: new Date(date.getFullYear(), date.getMonth(), 1) };
            case 'term':  { const m = date.getMonth(); const s = m < 4 ? 0 : m < 8 ? 4 : 8; return { gte: new Date(date.getFullYear(), s, 1) }; }
            default:      return date;
        }
    }

    private getPreviousDateFilter(filter: string) {
        const date = new Date(); date.setHours(0, 0, 0, 0);
        switch (filter) {
            case 'week':  { const ws = date.getDate() - date.getDay(); return { gte: new Date(date.setDate(ws - 7)), lte: new Date(date.setDate(ws - 1)) }; }
            case 'month': return { gte: new Date(date.getFullYear(), date.getMonth() - 1, 1), lte: new Date(date.getFullYear(), date.getMonth(), 0) };
            case 'term':  { const ts = new Date(date.getFullYear(), Math.floor(date.getMonth() / 4) * 4, 1); return { gte: new Date(ts.getFullYear(), ts.getMonth() - 4, 1), lte: new Date(ts.getFullYear(), ts.getMonth(), 0) }; }
            default:      { const y = new Date(date.setDate(date.getDate() - 1)); const ye = new Date(date.setDate(date.getDate())); ye.setMilliseconds(-1); return { gte: y, lte: ye }; }
        }
    }

    private calculateTrend(current: number, previous: number) {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        return ((current - previous) / previous >= 0 ? '+' : '') + (((current - previous) / previous) * 100).toFixed(1) + '%';
    }

    private formatRelativeDate(value: Date): string {
        const now = Date.now();
        const diffMs = now - value.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.max(0, Math.floor(diffMs / dayMs));
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 7) return `${days} days ago`;
        return value.toLocaleDateString();
    }

    private getGradeColor(grade: string): string {
        const colors: Record<string, string> = { PP1: '#3b82f6', PP2: '#10b981', GRADE_1: '#8b5cf6', GRADE_2: '#f59e0b', GRADE_3: '#ef4444' };
        return colors[grade] || '#6b7280';
    }

    private getRoleColor(role: string): string {
        const colors: Record<string, string> = { TEACHER: '#3b82f6', ADMIN: '#8b5cf6', ACCOUNTANT: '#06b6d4' };
        return colors[role] || '#6b7280';
    }

    /**
     * GET /api/dashboard/insights
     * Returns deterministic, data-driven smart insights — no external AI required.
     * Cached for 3 minutes; pass ?fresh=1 to bypass.
     */
    async getInsights(req: AuthRequest, res: Response) {
        const cacheKey = 'dashboard:insights';
        try {
            if (!req.query.fresh) {
                const cached = await redisCacheService.get<any>(cacheKey);
                if (cached) return res.json({ success: true, data: cached, _cached: true });
            }

            const payload = await generateInsights();
            await redisCacheService.set(cacheKey, payload, 180); // 3-min cache
            res.json({ success: true, data: payload });
        } catch (error: any) {
            logger.error('Insights Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to generate insights');
        }
    }

    async getAssessmentOperations(req: AuthRequest, res: Response) {
        try {
            const data = await reportDashboardService.getDashboardData(parseReportDashboardFilters(req.query));
            res.json({ success: true, data });
        } catch (error: any) {
            logger.error('Assessment Operations Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to load assessment operations dashboard');
        }
    }

    async getAcademicIntelligence(req: AuthRequest, res: Response) {
        try {
            const data = await reportDashboardService.getDashboardData(parseReportDashboardFilters(req.query));
            res.json({ success: true, data });
        } catch (error: any) {
            logger.error('Academic Intelligence Dashboard Error:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, error.message || 'Failed to load academic intelligence dashboard');
        }
    }
}
