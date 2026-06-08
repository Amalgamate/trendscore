/**
 * Performance Service
 * Handles cross-term and longitudinal data analysis for learners and classes.
 */

import { PrismaClient, Term, DetailedRubricRating } from '@prisma/client';
import prisma from '../config/database';
import { calculationService } from './calculation.service';

export interface TrendPoint {
    period: string; // e.g., "2025 Term 1"
    percentage: number;
}

export interface PerformanceTrend {
    learnerId: string;
    trend: TrendPoint[];
    growth: number; // change from last period
    status: 'STABLE' | 'IMPROVING' | 'DECLINING';
}

export class PerformanceService {
    /**
     * Get historical performance for a learner across all terms
     */
    async getLearnerPerformanceTrend(learnerId: string): Promise<PerformanceTrend> {
        // 1. Fetch all assessment summaries for the learner
        // Note: We'll aggregate both formative and summative data per term

        // For now, let's get summative averages per term as a proxy for trend
        const summativeResults = await prisma.summativeResult.findMany({
            where: { learnerId },
            include: {
                test: {
                    select: {
                        term: true,
                        academicYear: true
                    }
                }
            },
            orderBy: [
                { test: { academicYear: 'asc' } },
                { test: { term: 'asc' } }
            ]
        });

        const termGroups = new Map<string, number[]>();

        summativeResults.forEach(r => {
            if (r.percentage === null || r.percentage === undefined || r.assessmentStatusCode) return;
            const key = `${r.test.academicYear} ${r.test.term}`;
            if (!termGroups.has(key)) termGroups.set(key, []);
            termGroups.get(key)!.push(r.percentage);
        });

        const trend: TrendPoint[] = Array.from(termGroups.entries()).map(([period, scores]) => ({
            period,
            percentage: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        }));

        // Calculate growth
        let growth = 0;
        let status: 'STABLE' | 'IMPROVING' | 'DECLINING' = 'STABLE';

        if (trend.length >= 2) {
            const current = trend[trend.length - 1].percentage;
            const previous = trend[trend.length - 2].percentage;
            growth = current - previous;

            if (growth > 2) status = 'IMPROVING';
            else if (growth < -2) status = 'DECLINING';
        }

        return {
            learnerId,
            trend,
            growth,
            status
        };
    }

    /**
     * Get class-wide performance distribution (Bell Curve)
     */
    async getClassPerformanceDistribution(classId: string, term: Term, academicYear: number) {
        const results = await prisma.summativeResult.findMany({
            where: {
                test: {
                    term,
                    academicYear
                },
                learner: {
                    enrollments: {
                        some: {
                            classId,
                            active: true
                        }
                    }
                }
            },
            select: {
                percentage: true,
                grade: true
            }
        });

        const distribution = {
            'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0
        };

        const performanceResults = results.filter((r) => r.percentage !== null && r.percentage !== undefined);

        performanceResults.forEach(r => {
            const g = r.grade as keyof typeof distribution;
            if (distribution[g] !== undefined) {
                distribution[g]++;
            }
        });

        return {
            total: performanceResults.length,
            distribution,
            average: performanceResults.length > 0
                ? Math.round(performanceResults.reduce((a, b) => a + b.percentage!, 0) / performanceResults.length)
                : 0
        };
    }
}

export const performanceService = new PerformanceService();
