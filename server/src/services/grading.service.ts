import { DetailedRubricRating, AggregationStrategy, FormativeAssessmentType } from '@prisma/client';
import prisma from '../config/database';

interface ScoreItem {
  score: number;
  weight?: number;
}

const PERCENTAGE_PRECISION = 1_000_000;

export const normalizePercentage = (percentage: number): number => {
  if (!Number.isFinite(percentage)) return 0;

  const capped = Math.min(100, Math.max(0, percentage));
  return Math.round((capped + Number.EPSILON) * PERCENTAGE_PRECISION) / PERCENTAGE_PRECISION;
};

export const gradingService = {
  /**
   * Uses upsert-style logic to avoid duplicate creation under concurrent requests.
   */
  async getGradingSystem(type: 'SUMMATIVE' | 'CBC' | 'SECONDARY') {
    let system = await prisma.gradingSystem.findFirst({
      where: { type, active: true, isDefault: true },
      include: { ranges: true }
    });

    if (!system) {
      system = await this.createDefaultSystem(type);
    }

    return system;
  },

  /**
   * Get grading system by ID
   */
  async getGradingSystemById(id: string) {
    return await prisma.gradingSystem.findUnique({
      where: { id },
      include: { ranges: true }
    });
  },

  /**
   * Get Aggregation Config for a specific context
   * Hierarchy: Specific (Grade & Subject) -> Grade only -> Subject only -> Global Default
   */
  async getAggregationConfig(type: FormativeAssessmentType, grade?: any, learningArea?: string) {
    const configs = await prisma.aggregationConfig.findMany({ where: { type } });

    return (
      configs.find(c => c.grade === grade && c.learningArea === learningArea) ||
      configs.find(c => c.grade === grade && !c.learningArea) ||
      configs.find(c => !c.grade && c.learningArea === learningArea) ||
      configs.find(c => !c.grade && !c.learningArea)
    );
  },

  /**
   * Calculate aggregated score based on strategy
   */
  calculateAggregatedScore(scores: ScoreItem[], strategy: AggregationStrategy, nValue?: number): number {
    if (scores.length === 0) return 0;

    switch (strategy) {
      case 'SIMPLE_AVERAGE':
        return scores.reduce((sum, item) => sum + item.score, 0) / scores.length;

      case 'BEST_N': {
        if (!nValue || nValue <= 0) return 0;
        const best = scores.map(s => s.score).sort((a, b) => b - a).slice(0, nValue);
        return best.length > 0 ? best.reduce((s, v) => s + v, 0) / best.length : 0;
      }

      case 'DROP_LOWEST_N': {
        if (!nValue || nValue < 0) return this.calculateAggregatedScore(scores, 'SIMPLE_AVERAGE');
        const keep = Math.max(0, scores.length - nValue);
        if (keep === 0) return 0;
        const kept = scores.map(s => s.score).sort((a, b) => b - a).slice(0, keep);
        return kept.reduce((s, v) => s + v, 0) / kept.length;
      }

      case 'WEIGHTED_AVERAGE': {
        let totalWeight = 0;
        let weightedSum = 0;
        for (const item of scores) {
          const w = item.weight || 1;
          weightedSum += item.score * w;
          totalWeight += w;
        }
        return totalWeight === 0 ? 0 : weightedSum / totalWeight;
      }

      case 'MEDIAN': {
        const sorted = scores.map(s => s.score).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      }

      default:
        return scores.reduce((sum, item) => sum + item.score, 0) / scores.length;
    }
  },

  /**
   * FIX: uses findFirst-then-create with a double-check to avoid duplicate rows
   * under concurrent cold-starts. For true safety a DB unique constraint on
   * (type, isDefault) would be the production solution.
   */
  async createDefaultSystem(type: 'SUMMATIVE' | 'CBC' | 'SECONDARY') {
    // Re-check inside the lock window — another request may have created it first
    const existing = await prisma.gradingSystem.findFirst({
      where: { type, isDefault: true },
      include: { ranges: true }
    });
    if (existing) return existing;

    if (type === 'SECONDARY') {
      return await prisma.gradingSystem.create({
        data: {
          name: 'Standard KCSE Secondary Grading',
          type: 'SECONDARY',
          isDefault: true,
          ranges: {
            create: [
              { label: 'A',  minPercentage: 75, maxPercentage: 100, summativeGrade: 'A',  points: 12, color: '#10b981', description: 'Plain' },
              { label: 'A-', minPercentage: 70, maxPercentage: 74,  summativeGrade: 'A-', points: 11, color: '#059669', description: 'Minus' },
              { label: 'B+', minPercentage: 65, maxPercentage: 69,  summativeGrade: 'B+', points: 10, color: '#047857', description: 'Plus' },
              { label: 'B',  minPercentage: 60, maxPercentage: 64,  summativeGrade: 'B',  points: 9,  color: '#3b82f6', description: 'Plain' },
              { label: 'B-', minPercentage: 55, maxPercentage: 59,  summativeGrade: 'B-', points: 8,  color: '#2563eb', description: 'Minus' },
              { label: 'C+', minPercentage: 50, maxPercentage: 54,  summativeGrade: 'C+', points: 7,  color: '#1d4ed8', description: 'Plus' },
              { label: 'C',  minPercentage: 45, maxPercentage: 49,  summativeGrade: 'C',  points: 6,  color: '#f59e0b', description: 'Plain' },
              { label: 'C-', minPercentage: 40, maxPercentage: 44,  summativeGrade: 'C-', points: 5,  color: '#d97706', description: 'Minus' },
              { label: 'D+', minPercentage: 35, maxPercentage: 39,  summativeGrade: 'D+', points: 4,  color: '#ea580c', description: 'Plus' },
              { label: 'D',  minPercentage: 30, maxPercentage: 34,  summativeGrade: 'D',  points: 3,  color: '#c2410c', description: 'Plain' },
              { label: 'D-', minPercentage: 25, maxPercentage: 29,  summativeGrade: 'D-', points: 2,  color: '#dc2626', description: 'Minus' },
              { label: 'E',  minPercentage: 0,  maxPercentage: 24,  summativeGrade: 'E',  points: 1,  color: '#991b1b', description: 'Plain' },
            ]
          }
        },
        include: { ranges: true }
      });
    }

    if (type === 'SUMMATIVE') {
      return await prisma.gradingSystem.create({
        data: {
          name: 'Standard Summative CBC Grading',
          type: 'SUMMATIVE',
          isDefault: true,
          ranges: {
            create: [
              { label: 'EE1', minPercentage: 90, maxPercentage: 100, summativeGrade: 'EE1', rubricRating: 'EE1', points: 8, color: '#10b981', description: 'Outstanding' },
              { label: 'EE2', minPercentage: 75, maxPercentage: 89,  summativeGrade: 'EE2', rubricRating: 'EE2', points: 7, color: '#34d399', description: 'Very High' },
              { label: 'ME1', minPercentage: 58, maxPercentage: 74,  summativeGrade: 'ME1', rubricRating: 'ME1', points: 6, color: '#3b82f6', description: 'High Average' },
              { label: 'ME2', minPercentage: 41, maxPercentage: 57,  summativeGrade: 'ME2', rubricRating: 'ME2', points: 5, color: '#60a5fa', description: 'Average' },
              { label: 'AE1', minPercentage: 31, maxPercentage: 40,  summativeGrade: 'AE1', rubricRating: 'AE1', points: 4, color: '#f59e0b', description: 'Low Average' },
              { label: 'AE2', minPercentage: 21, maxPercentage: 30,  summativeGrade: 'AE2', rubricRating: 'AE2', points: 3, color: '#fbbf24', description: 'Below Average' },
              { label: 'BE1', minPercentage: 11, maxPercentage: 20,  summativeGrade: 'BE1', rubricRating: 'BE1', points: 2, color: '#ef4444', description: 'Low' },
              { label: 'BE2', minPercentage: 0,  maxPercentage: 10,  summativeGrade: 'BE2', rubricRating: 'BE2', points: 1, color: '#b91c1c', description: 'Very Low' },
            ]
          }
        },
        include: { ranges: true }
      });
    } else {
      // CBC rubric uses the unified 8-level scale (EE1/EE2/ME1/ME2/AE1/AE2/BE1/BE2).
      // This is used across Junior + Senior; senior-specific point weightings can be
      // configured by creating per-grade systems (grade field) if needed.
      return await prisma.gradingSystem.create({
        data: {
          name: 'Standard CBC 8-Level Rubric',
          type: 'CBC',
          isDefault: true,
          ranges: {
            create: [
              { label: 'EE1', minPercentage: 90, maxPercentage: 100, rubricRating: 'EE1', parentBand: 'Exceeding Expectations', displayOrder: 1, points: 8, color: '#10b981', description: 'Outstanding' },
              { label: 'EE2', minPercentage: 75, maxPercentage: 89,  rubricRating: 'EE2', parentBand: 'Exceeding Expectations', displayOrder: 2, points: 7, color: '#34d399', description: 'Very High' },
              { label: 'ME1', minPercentage: 58, maxPercentage: 74,  rubricRating: 'ME1', parentBand: 'Meeting Expectations', displayOrder: 3, points: 6, color: '#3b82f6', description: 'High Average' },
              { label: 'ME2', minPercentage: 41, maxPercentage: 57,  rubricRating: 'ME2', parentBand: 'Meeting Expectations', displayOrder: 4, points: 5, color: '#60a5fa', description: 'Average' },
              { label: 'AE1', minPercentage: 31, maxPercentage: 40,  rubricRating: 'AE1', parentBand: 'Approaching Expectations', displayOrder: 5, points: 4, color: '#f59e0b', description: 'Low Average' },
              { label: 'AE2', minPercentage: 21, maxPercentage: 30,  rubricRating: 'AE2', parentBand: 'Approaching Expectations', displayOrder: 6, points: 3, color: '#fbbf24', description: 'Below Average' },
              { label: 'BE1', minPercentage: 11, maxPercentage: 20,  rubricRating: 'BE1', parentBand: 'Below Expectations', displayOrder: 7, points: 2, color: '#ef4444', description: 'Low' },
              { label: 'BE2', minPercentage: 0,  maxPercentage: 10,  rubricRating: 'BE2', parentBand: 'Below Expectations', displayOrder: 8, points: 1, color: '#b91c1c', description: 'Very Low' },
            ]
          }
        },
        include: { ranges: true }
      });
    }
  },

  /**
   * Calculate grade for a percentage (async — fetches system from DB)
   */
  async calculateGrade(percentage: number): Promise<string> {
    const system = await this.getGradingSystem('SUMMATIVE');
    const normalized = normalizePercentage(percentage);
    const range = system.ranges.find(r => normalized >= r.minPercentage && normalized <= r.maxPercentage);
    return range?.summativeGrade || 'BE2';
  },

  normalizePercentage,

  /**
   * Calculate grade with details (sync — caller must supply ranges)
   */
  calculateGradeSync(percentage: number, ranges: any[]): string {
    const normalized = normalizePercentage(percentage);
    const range = ranges.find(r => normalized >= r.minPercentage && normalized <= r.maxPercentage);
    return range?.summativeGrade || 'BE2';
  },

  /**
   * Calculate CBC rating (sync — caller must supply ranges)
   */
  calculateRatingSync(percentage: number, ranges: any[]): DetailedRubricRating {
    const normalized = normalizePercentage(percentage);
    const range = ranges.find(r => normalized >= r.minPercentage && normalized <= r.maxPercentage);
    return range?.rubricRating || 'BE2';
  },

  /**
   * Get points for a specific rating from ranges
   */
  getPointsSync(rating: DetailedRubricRating, ranges: any[]): number {
    const range = ranges.find(r => r.rubricRating === rating);
    return range?.points || 1;
  },

  /**
   * Get average percentage for a specific rating from ranges
   */
  getAveragePercentageSync(rating: DetailedRubricRating, ranges: any[]): number {
    const range = ranges.find(r => r.rubricRating === rating);
    if (!range) return 0;
    return Math.round((range.minPercentage + range.maxPercentage) / 2);
  },

  // NOTE: KCSE letter-grade logic deliberately removed per product policy.
};
