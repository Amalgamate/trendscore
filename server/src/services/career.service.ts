/**
 * career.service.ts
 * Business logic for the Career Explorer (SPEC-005).
 * All DB access goes through Prisma; no raw SQL.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CareerSearchParams {
  query?: string;
  familyId?: string;
  recommendedPathway?: string;
  verificationStatus?: string;
  page?: number;
  limit?: number;
}

export interface CareerMatchInput {
  learnerId: string;
  recommendedPathway?: string;   // from existing recommendation engine
  confidenceScore?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pathwayToBucket(fitScore: number): string {
  if (fitScore >= 80) return 'STRONG_FIT';
  if (fitScore >= 60) return 'GOOD_FIT';
  if (fitScore >= 40) return 'EXPLORE';
  if (fitScore >= 20) return 'ASPIRATIONAL';
  return 'ALTERNATIVE';
}

function confidenceLabel(fitScore: number, hasRecommendation: boolean): string {
  if (!hasRecommendation) return 'INSUFFICIENT_DATA';
  if (fitScore >= 70) return 'HIGH';
  if (fitScore >= 40) return 'MEDIUM';
  return 'LOW';
}

const normalisePathway = (value?: string | null) => String(value ?? '').trim().toUpperCase().replace(/[\s&-]+/g, '_');

export function classifyCombinationImpact(
  careerPathway?: string | null,
  careerTrack?: string | null,
  combinationPathway?: string | null,
  combinationTrack?: string | null,
) {
  const samePathway = normalisePathway(careerPathway) === normalisePathway(combinationPathway);
  const sameTrack = careerTrack ? normalisePathway(careerTrack) === normalisePathway(combinationTrack) : null;
  if (samePathway && sameTrack === true) return 'STRONGLY_SUPPORTS';
  if (samePathway) return 'SUPPORTS';
  if (careerPathway) return 'MAY_RESTRICT';
  return 'UNKNOWN';
}

// ─── Career CRUD ──────────────────────────────────────────────────────────────

export const careerService = {

  listCareers: async (params: CareerSearchParams) => {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const skip  = (page - 1) * limit;

    const where: any = { active: true };

    if (params.query?.trim()) {
      const q = params.query.trim();
      where.OR = [
        { title:        { contains: q, mode: 'insensitive' } },
        { shortSummary: { contains: q, mode: 'insensitive' } },
        { keySkills:    { has: q } },
      ];
    }
    if (params.familyId)            where.familyId           = params.familyId;
    if (params.recommendedPathway)  where.recommendedPathway = params.recommendedPathway;
    if (params.verificationStatus)  where.verificationStatus = params.verificationStatus;

    const [careers, total] = await Promise.all([
      prisma.career.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ recommendedPathway: 'asc' }, { title: 'asc' }],
        include: {
          family: { select: { id: true, code: true, name: true } },
          _count:  { select: { educationRoutes: true } },
        },
      }),
      prisma.career.count({ where }),
    ]);

    return {
      data: careers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  getCareer: async (careerId: string) => {
    const career = await prisma.career.findUnique({
      where: { id: careerId },
      include: {
        family:          { select: { id: true, code: true, name: true } },
        educationRoutes: { where: { active: true }, orderBy: { routeType: 'asc' } },
        alternativeCareerLinks: {
          include: { alternative: { select: { id: true, code: true, title: true, recommendedPathway: true, shortSummary: true } } },
        },
      },
    });
    if (!career) throw new ApiError(404, 'Career not found');
    return career;
  },

  compareCareers: async (careerIds: string[], learnerId?: string) => {
    const uniqueIds = [...new Set(careerIds)];
    if (uniqueIds.length < 2 || uniqueIds.length > 4) throw new ApiError(400, 'Choose between 2 and 4 careers to compare');
    const [careers, matches] = await Promise.all([
      prisma.career.findMany({
        where: { id: { in: uniqueIds }, active: true },
        include: {
          family: { select: { id: true, code: true, name: true } },
          educationRoutes: { where: { active: true }, orderBy: { routeType: 'asc' } },
          alternativeCareerLinks: { include: { alternative: { select: { id: true, title: true } } } },
        },
      }),
      learnerId ? prisma.learnerCareerMatch.findMany({ where: { learnerId, careerId: { in: uniqueIds } } }) : Promise.resolve([]),
    ]);
    if (careers.length !== uniqueIds.length) throw new ApiError(404, 'One or more careers were not found');
    const matchesByCareer = new Map(matches.map((match) => [match.careerId, match]));
    return uniqueIds.map((id) => ({ ...careers.find((career) => career.id === id)!, learnerMatch: matchesByCareer.get(id) ?? null }));
  },

  combinationImpact: async (careerIds: string[], combinationIds: string[]) => {
    if (!careerIds.length || !combinationIds.length) throw new ApiError(400, 'careerIds and combinationIds are required');
    const [careers, combinations] = await Promise.all([
      prisma.career.findMany({ where: { id: { in: [...new Set(careerIds)] }, active: true } }),
      prisma.subjectCombinationRule.findMany({
        where: { id: { in: [...new Set(combinationIds)] }, active: true },
        include: { pathway: { select: { code: true, name: true } }, track: { select: { code: true, name: true } }, items: { include: { officialLearningArea: { select: { officialName: true, officialCode: true } } } } },
      }),
    ]);
    return combinations.map((combination) => ({
      combination: {
        id: combination.id, code: combination.code, name: combination.name,
        pathway: combination.pathway, track: combination.track,
        subjects: combination.items.map((item) => item.officialLearningArea),
      },
      careers: careers.map((career) => {
        const classification = classifyCombinationImpact(
          career.recommendedPathway,
          career.recommendedTrackCode,
          combination.pathway.code,
          combination.track.code,
        );
        const explanation = classification === 'STRONGLY_SUPPORTS'
          ? 'The combination matches both the recommended pathway and track.'
          : classification === 'SUPPORTS'
            ? 'The combination is within the career’s recommended pathway.'
            : classification === 'MAY_RESTRICT'
              ? 'The combination is outside the career’s recommended pathway; verify tertiary subject requirements before deciding.'
              : 'There is not enough structured mapping data to classify this combination.';
        return { career: { id: career.id, title: career.title }, classification, explanation };
      }),
    }));
  },

  listFamilies: async () => {
    return prisma.careerFamily.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { careers: true } } },
    });
  },

  // ─── Admin mutations ────────────────────────────────────────────────────────

  createCareer: async (data: any) => {
    if (!data.code?.trim() || !data.title?.trim()) {
      throw new ApiError(400, 'code and title are required');
    }
    return prisma.career.create({ data });
  },

  updateCareer: async (careerId: string, data: any) => {
    await careerService.getCareer(careerId); // 404 guard
    return prisma.career.update({ where: { id: careerId }, data });
  },

  publishCareer: async (careerId: string) => {
    const career = await careerService.getCareer(careerId);
    if (!career.source?.trim()) throw new ApiError(400, 'A source is required before publishing a career');
    return prisma.career.update({
      where: { id: careerId },
      data: { active: true, verificationStatus: 'SOURCE_VERIFIED', publishedAt: new Date(), retiredAt: null },
    });
  },

  retireCareer: async (careerId: string) => {
    await careerService.getCareer(careerId);
    return prisma.career.update({
      where: { id: careerId },
      data: { active: false, verificationStatus: 'RETIRED', retiredAt: new Date() },
    });
  },

  // ─── Learner: career matching ────────────────────────────────────────────────
  // Rules-based scoring per SPEC-005 §8.
  // Factors: pathway alignment (primary), pathway trust from recommendation confidence.

  generateCareerMatches: async (input: CareerMatchInput) => {
    const { learnerId, recommendedPathway, confidenceScore = 0 } = input;

    // Load all active careers with pathway tag
    const [allCareers, publishedRules] = await Promise.all([
      prisma.career.findMany({
        where: { active: true },
        select: {
          id: true, code: true, title: true, shortSummary: true,
          recommendedPathway: true, keySkills: true, familyId: true,
        },
      }),
      prisma.pathwayRuleSet.findFirst({ where: { domain: 'CAREER_FIT', status: 'PUBLISHED' }, orderBy: { version: 'desc' } }),
    ]);
    const ruleConfig = (publishedRules?.config as any) || {};
    const pathwayWeight = Number(ruleConfig.weights?.pathwayAlignment ?? ruleConfig.pathwayAlignment ?? 60);
    const differentPathwayPoints = Number(ruleConfig.weights?.differentPathway ?? ruleConfig.differentPathway ?? 10);
    const confidenceWeight = Number(ruleConfig.weights?.recommendationConfidence ?? ruleConfig.recommendationConfidence ?? 20);
    const missingMappingPenalty = Number(ruleConfig.penalties?.missingMapping ?? ruleConfig.missingMappingPenalty ?? 10);
    const scoreVersion = publishedRules ? `career-fit-${publishedRules.version}` : '1.0';

    const hasRec = !!recommendedPathway;

    const matches = allCareers.map(career => {
      let fitScore = 0;
      const matchedStrengths: string[] = [];
      const developmentAreas: string[] = [];
      const warnings: string[] = [];

      // Factor 1 — Pathway alignment (60 pts max)
      if (hasRec && career.recommendedPathway) {
        if (career.recommendedPathway === recommendedPathway) {
          fitScore += pathwayWeight;
          matchedStrengths.push(`Aligned with your ${recommendedPathway.replace('_', ' ')} recommendation`);
        } else {
          fitScore += differentPathwayPoints;
          warnings.push('Career is in a different pathway');
        }
      } else if (!hasRec) {
        warnings.push('Complete assessments for a personalised fit score');
      }

      // Factor 2 — Recommendation confidence (20 pts max)
      const confBonus = Math.min(confidenceWeight, Math.round((confidenceScore / 100) * confidenceWeight));
      fitScore += confBonus;
      if (confBonus > 10) matchedStrengths.push('Strong academic evidence supports this pathway');

      // Factor 3 — Data quality penalty
      if (!career.recommendedPathway) {
        fitScore = Math.max(0, fitScore - missingMappingPenalty);
        warnings.push('Limited data for this career');
      }

      fitScore = Math.min(100, Math.max(0, fitScore));
      const bucket     = pathwayToBucket(fitScore);
      const confidence = confidenceLabel(fitScore, hasRec);

      return {
        learnerId,
        careerId:        career.id,
        fitScore,
        confidence,
        bucket,
        matchedStrengths,
        developmentAreas,
        warnings,
        scoreVersion,
      };
    });

    // Upsert top matches (store all, front-end can filter by bucket)
    if (matches.length > 0) {
      await Promise.allSettled(
        matches.map(m =>
          prisma.learnerCareerMatch.upsert({
            where:  { learnerId_careerId: { learnerId: m.learnerId, careerId: m.careerId } },
            update: { fitScore: m.fitScore, confidence: m.confidence, bucket: m.bucket,
                      matchedStrengths: m.matchedStrengths, developmentAreas: m.developmentAreas,
                      warnings: m.warnings, scoreVersion: m.scoreVersion, generatedAt: new Date() },
            create: m,
          })
        )
      );
    }

    return matches.sort((a, b) => b.fitScore - a.fitScore);
  },

  getLearnerMatches: async (learnerId: string, limit = 20) => {
    const matches = await prisma.learnerCareerMatch.findMany({
      where:   { learnerId },
      orderBy: { fitScore: 'desc' },
      take:    limit,
      include: {
        career: {
          include: {
            family: { select: { id: true, code: true, name: true } },
            _count: { select: { educationRoutes: true } },
          },
        },
      },
    });
    return matches;
  },

  // ─── Learner: save / unsave careers ─────────────────────────────────────────

  saveCareer: async (learnerId: string, careerId: string, savedBy: string, savedByRole: string, note?: string) => {
    await careerService.getCareer(careerId); // 404 guard

    return prisma.learnerCareerSave.upsert({
      where:  { learnerId_careerId: { learnerId, careerId } },
      update: { note: note ?? undefined, updatedAt: new Date() },
      create: { learnerId, careerId, savedBy, savedByRole, note: note ?? null },
      include: { career: { select: { id: true, code: true, title: true, recommendedPathway: true } } },
    });
  },

  updateSave: async (learnerId: string, careerId: string, data: { note?: string; priority?: number; supportStatus?: string }) => {
    if (data.supportStatus && !['LEARNER_INTERESTED', 'PARENT_SUPPORTS', 'PARENT_UNCERTAIN', 'COUNSELLOR_RECOMMENDS', 'UNDER_DISCUSSION', 'REMOVED'].includes(data.supportStatus)) {
      throw new ApiError(400, 'Invalid career support status');
    }
    return prisma.learnerCareerSave.update({
      where:  { learnerId_careerId: { learnerId, careerId } },
      data,
      include: { career: { select: { id: true, code: true, title: true } } },
    });
  },

  removeSave: async (learnerId: string, careerId: string) => {
    await prisma.learnerCareerSave.delete({
      where: { learnerId_careerId: { learnerId, careerId } },
    });
  },

  getSavedCareers: async (learnerId: string) => {
    return prisma.learnerCareerSave.findMany({
      where:   { learnerId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        career: {
          include: {
            family:         { select: { id: true, code: true, name: true } },
            educationRoutes: { where: { active: true }, select: { id: true, routeType: true, qualificationTitle: true } },
          },
        },
      },
    });
  },

  // ─── Admin: career families ──────────────────────────────────────────────────

  createFamily: async (data: { code: string; name: string; description?: string }) => {
    if (!data.code?.trim() || !data.name?.trim()) throw new ApiError(400, 'code and name are required');
    return prisma.careerFamily.create({ data });
  },
};
