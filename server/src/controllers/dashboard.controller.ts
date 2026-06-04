import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { redisCacheService } from '../services/redis-cache.service';
import { configService } from '../services/config.service';
import { generateInsights } from '../services/insights.service';
import { CanonicalInstitutionType } from '../utils/institutionNormalizer';

import logger from '../utils/logger';
// ─── TTL constants ─────────────────────────────────────────────────────────────
// Dashboard stats are aggregates — they don't need sub-second freshness.
// 5 min for admin covers multiple page loads within a work session.
// Pass ?fresh=1 to bypass cache for a manual refresh.
const ADMIN_CACHE_TTL   = 300; // 5 min
const TEACHER_CACHE_TTL = 120; // 2 min
const PARENT_CACHE_TTL  = 120; // 2 min

export class DashboardController {

    /**
     * Returns the resolved institution type for this request.
     * Reads req.resolvedInstitutionType set by institutionContextResolver —
     * never re-derives from headers or req.school.
     */
    private getInstitutionType(req: AuthRequest): CanonicalInstitutionType {
        return (req.resolvedInstitutionType ?? 'PRIMARY_CBC') as CanonicalInstitutionType;
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
            const secondaryGrades = ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3'];
            const isSecondaryContext = institutionType === 'SECONDARY';
            const summativeTestScope: Prisma.SummativeTestWhereInput = isSecondaryContext
                ? { grade: { in: secondaryGrades as any } }
                : { NOT: { grade: { in: secondaryGrades as any } } };
            const learnerScope: Prisma.LearnerWhereInput = isSecondaryContext
                ? {
                    archived: false,
                    institutionType: 'SECONDARY' as any,
                    grade: { in: secondaryGrades as any },
                }
                : {
                    archived: false,
                    institutionType: { not: 'SECONDARY' as any },
                    NOT: { grade: { in: secondaryGrades as any } },
                };
            const cacheKey = `dashboard:admin:v2:${institutionType}:${filter}`;

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
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const startOfTerm = activeTermConfig?.startDate ? new Date(activeTermConfig.startDate) : new Date(now.getFullYear(), 0, 1);

            const dateFilter     = this.getDateFilter(filter as string);
            const prevDateFilter = this.getPreviousDateFilter(filter as string);

            // ── Stage 1: All independent queries fired in one Promise.all ─────
            const resultStage1 = await Promise.all([
                // [0] counts
                prisma.learner.count({ where: learnerScope }),
                prisma.user.count({ where: { role: 'TEACHER', archived: false } }),
                prisma.class.count({ where: { archived: false, institutionType: isSecondaryContext ? ('SECONDARY' as any) : ('PRIMARY_CBC' as any) } }),
                prisma.learner.count({ where: { ...learnerScope, createdAt: prevDateFilter } }),
                prisma.user.count({ where: { role: 'TEACHER', archived: false, createdAt: prevDateFilter } }),
                prisma.learner.count({ where: { ...learnerScope, status: 'ACTIVE' } }),
                prisma.user.count({ where: { role: 'TEACHER', status: 'ACTIVE', archived: false } }),
                // [7] group-bys
                prisma.attendance.groupBy({ by: ['status'], where: { date: dateFilter }, _count: true }),
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
                    where: { archived: false },
                    _sum: { paidAmount: true, balance: true },
                }),
                prisma.feeInvoice.groupBy({
                    by: ['feeStructureId'],
                    where: { archived: false },
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
            ]);

            const [
                studentCount, teacherCount, classCount, prevStudentCount, prevTeacherCount,
                activeStudents, activeTeachers, attendanceSummary, studentsByGradeData,
                staffByRole, latestAdmissions, latestFormative, latestSummative,
                upcomingEventsData, pendingDraftCount, genderDistribution,
                latestTest, feeAgg, feeByGrade, summativeByGrade,
                subjectRatings, assessedClassCount, staffOnLeaveCount,
                expensesToday, expensesThisMonth, expensesThisTerm, expensesByCategory,
                recentExpenses
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

            const [feeStructures, testGrades, monthlyPayments] = await Promise.all([
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
                    return prisma.$queryRaw<Array<{ month: string; revenue: number }>>(
                        Prisma.sql`
                            SELECT
                                TO_CHAR(p."createdAt", 'Mon YY') AS month,
                                SUM(p.amount)::float            AS revenue
                            FROM fee_payments p
                            WHERE p."createdAt" >= ${sixMonthsAgo}
                            GROUP BY DATE_TRUNC('month', p."createdAt"), TO_CHAR(p."createdAt", 'Mon YY')
                            ORDER BY DATE_TRUNC('month', p."createdAt")
                        `
                    );
                })(),
            ]);

            const scopedFeeStructures = feeStructures.filter((fs) => {
                const g = String(fs?.grade || '').toUpperCase();
                const isSecondaryGrade = secondaryGrades.includes(g as any);
                return isSecondaryContext ? isSecondaryGrade : !isSecondaryGrade;
            });
            const allowedFeeStructureIds = new Set(scopedFeeStructures.map((fs) => fs.id));
            const scopedFeeByGrade = feeByGrade.filter((row: any) => allowedFeeStructureIds.has(row.feeStructureId));
            const feeStructureMap = new Map(scopedFeeStructures.map(fs => [fs.id, fs]));
            const streamBreakdown = scopedFeeByGrade
                .map((row: any) => {
                    const fs = feeStructureMap.get(row.feeStructureId);
                    if (!fs) return null;
                    return {
                        name:      fs.name || fs.grade?.replace('_', ' ') || 'General',
                        target:    Number(row._sum.totalAmount || 0),
                        collected: Number(row._sum.paidAmount  || 0),
                        bal:       Number(row._sum.balance     || 0),
                    };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => b.bal - a.bal);
            const scopedFeeCollected = scopedFeeByGrade.reduce((sum: number, row: any) => sum + Number(row._sum.paidAmount || 0), 0);
            const scopedFeePending = scopedFeeByGrade.reduce((sum: number, row: any) => sum + Number(row._sum.balance || 0), 0);

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
            const avgAttendance = studentCount > 0 ? (attendanceMap.PRESENT / studentCount) * 100 : 0;

            const payload = {
                stats: {
                    totalStudents: studentCount, activeStudents,
                    totalTeachers: teacherCount, activeTeachers,
                    totalClasses: classCount,
                    totalAssessedClasses: assessedClassCount,
                    totalMissedExams, currentTestSeries,
                    presentToday: attendanceMap.PRESENT, absentToday: attendanceMap.ABSENT, lateToday: attendanceMap.LATE,
                    avgAttendance: parseFloat(avgAttendance.toFixed(1)),
                    feeCollected: scopedFeeCollected,
                    feePending:   scopedFeePending,
                    staffOnLeave: staffOnLeaveCount,
                    studentTrend: this.calculateTrend(studentCount,  prevStudentCount),
                    teacherTrend: this.calculateTrend(teacherCount,  prevTeacherCount),
                    males:   genderDistribution.find((g: any) => g.gender === 'MALE')  ?._count || 0,
                    females: genderDistribution.find((g: any) => g.gender === 'FEMALE')?._count || 0,
                    totalPendingAssessments: pendingDraftCount,
                    performance: { ee: 0, me: 0, ae: 0, be: 0 },
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
                    trendData: monthlyPayments.map(r => ({
                        month:   String(r.month || ''),
                        revenue: Number(r.revenue || 0),
                    })),
                    revenueSources,
                    totalExpenses: Number(expensesThisTerm._sum.amount || 0),
                    expensesSummary: {
                        today: Number(expensesToday._sum.amount || 0),
                        thisMonth: Number(expensesThisMonth._sum.amount || 0),
                        thisTerm: Number(expensesThisTerm._sum.amount || 0),
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

            const cacheKey = `dashboard:teacher:${userId}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const [myClasses, pendingAssessments, recentActivityRaw] = await Promise.all([
                prisma.class.findMany({
                    where: { teacherId: userId, archived: false, institutionType },
                    include: { _count: { select: { enrollments: { where: { active: true } } } } },
                }),
                prisma.formativeAssessment.count({ where: { teacherId: userId, status: 'DRAFT' } }),
                prisma.formativeAssessment.findMany({
                    where: { teacherId: userId },
                    orderBy: { createdAt: 'desc' }, take: 10,
                    select: { id: true, title: true, learningArea: true, createdAt: true },
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
            const payload = {
                stats: {
                    myStudents: totalMyStudents, myClasses: myClassesWithOccupancy.length,
                    pendingTasks: pendingAssessments, messages: 0,
                    analytics: {
                        attendance: 94,
                        graded: pendingAssessments === 0 ? 100 : Math.round(((totalMyStudents - pendingAssessments) / totalMyStudents) * 100),
                        completion: 75, engagement: 90,
                    },
                },
                schedule: myClassesWithOccupancy.map(cls => ({
                    id: cls.id, grade: cls.name, subject: 'Standard CBC',
                    time: '8:00 AM', room: cls.room || 'N/A', status: 'upcoming',
                })),
                recentActivity: recentActivityRaw.map(act => ({
                    id: act.id, text: `${act.title} created for ${act.learningArea}`, time: act.createdAt, type: 'assessment',
                })),
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
    async getParentMetrics(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(400, 'User ID is required');

            const cacheKey = `dashboard:parent:${userId}`;
            const cached = await redisCacheService.get<any>(cacheKey);
            if (cached) return res.json({ success: true, data: cached, _cached: true });

            const [children, noticesCount, notices] = await Promise.all([
                prisma.learner.findMany({
                    where: { parentId: userId, archived: false },
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

            const payload = {
                children: processedChildren,
                notices: notices.map((notice) => ({
                    id: notice.id,
                    title: notice.title,
                    description: notice.content,
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
}
