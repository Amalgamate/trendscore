import { createHash } from 'crypto';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

const SCORE_VERSION = '2.0';

const normalise = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[\s&-]+/g, '_');
const includesCode = (codes: string[], code?: string | null) => !code || codes.map(normalise).includes(normalise(code));

export type SchoolMatchBreakdown = {
  eligible: boolean;
  factors: Array<{ key: string; label: string; earned: number; possible: number; matched: boolean | null }>;
  exclusions: string[];
  warnings: string[];
  explanation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  inputHash: string;
};

export function bucketFor(score: number, local: boolean, thresholds: Record<string, number> = {}) {
  if (score >= (thresholds.dreamMinimum ?? 85)) return 'DREAM';
  if (score >= (thresholds.targetMinimum ?? 70)) return 'TARGET';
  if (score >= (thresholds.safeMinimum ?? 55)) return 'SAFE';
  return local ? 'LOCAL' : 'ALTERNATIVE';
}

export function confidenceFor(known: number, verified: boolean): SchoolMatchBreakdown['confidence'] {
  if (known <= 3) return 'INSUFFICIENT_DATA';
  if (known >= 8 && verified) return 'HIGH';
  if (known >= 6) return 'MEDIUM';
  return 'LOW';
}

export function accommodationMatches(schoolType: string, preference?: string | null) {
  if (!preference || preference === 'EITHER') return true;
  const type = normalise(schoolType);
  return type === normalise(preference) || type === 'DAY_AND_BOARDING';
}

export function genderMatches(schoolGender: string, learnerGender?: string | null) {
  const school = normalise(schoolGender);
  const learner = normalise(learnerGender);
  if (!learner || school === 'MIXED') return true;
  return (learner === 'MALE' && school === 'BOYS') || (learner === 'FEMALE' && school === 'GIRLS');
}

export const schoolMatchingService = {
  recalculate: async (learnerId: string) => {
    const [learner, selection, recommendation, criteria, schools, publishedRules] = await Promise.all([
      prisma.learner.findUnique({
        where: { id: learnerId },
        select: { id: true, gender: true, county: true, specialNeeds: true },
      }),
      prisma.learnerPathwaySelection.findFirst({
        where: { learnerId },
        orderBy: { updatedAt: 'desc' },
        include: {
          pathway: { select: { code: true, name: true } },
          track: { select: { code: true, name: true } },
          combinationRule: { select: { code: true, name: true } },
        },
      }),
      prisma.learnerPathwayRecommendation.findFirst({
        where: { learnerId },
        orderBy: { createdAt: 'desc' },
        select: { recommendedPathway: true, finalApprovedPathway: true, confidenceScore: true },
      }),
      prisma.learnerSchoolSearchCriteria.findUnique({ where: { learnerId } }),
      prisma.seniorSchool.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.pathwayRuleSet.findFirst({ where: { domain: 'SCHOOL_MATCH', status: 'PUBLISHED' }, orderBy: { version: 'desc' } }),
    ]);
    if (!learner) throw new ApiError(404, 'Learner not found');

    const requiredSupport = criteria?.requiredSupport ?? [];
    const preferredCounties = (criteria?.preferredCounties ?? []).map(normalise);
    const ruleConfig = (publishedRules?.config as any) || {};
    const weights = {
      pathway: Number(ruleConfig.weights?.pathway ?? ruleConfig.pathway ?? 25),
      track: Number(ruleConfig.weights?.track ?? ruleConfig.track ?? 12),
      combination: Number(ruleConfig.weights?.combination ?? ruleConfig.combination ?? 18),
      gender: Number(ruleConfig.weights?.gender ?? ruleConfig.gender ?? 5),
      accommodation: Number(ruleConfig.weights?.accommodation ?? ruleConfig.accommodation ?? 10),
      location: Number(ruleConfig.weights?.location ?? ruleConfig.location ?? 10),
      affordability: Number(ruleConfig.weights?.affordability ?? ruleConfig.affordability ?? 8),
      support: Number(ruleConfig.weights?.support ?? ruleConfig.support ?? 7),
      verification: Number(ruleConfig.weights?.verification ?? ruleConfig.verification ?? 5),
    };
    const thresholds = ruleConfig.thresholds || ruleConfig;
    const scoreVersion = publishedRules ? `school-match-${publishedRules.version}` : SCORE_VERSION;
    const results = schools.map((school) => {
      const exclusions: string[] = [];
      const warnings: string[] = [];
      const factors: SchoolMatchBreakdown['factors'] = [];
      let earned = 0;
      let possible = 0;
      let known = 0;
      const add = (key: string, label: string, points: number, matched: boolean | null) => {
        possible += points;
        const value = matched === true ? points : matched === null ? Math.round(points * 0.35) : 0;
        earned += value;
        if (matched !== null) known += 1;
        factors.push({ key, label, earned: value, possible: points, matched });
      };

      const pathwayCode = selection?.pathway?.code || recommendation?.finalApprovedPathway || recommendation?.recommendedPathway;
      const pathwayKnown = school.pathwayCodes.length > 0;
      const pathwayMatch = pathwayKnown ? includesCode(school.pathwayCodes, pathwayCode) : null;
      if (pathwayCode && pathwayMatch === false) exclusions.push(`Selected pathway ${selection?.pathway?.name ?? pathwayCode} is not offered`);
      if (pathwayCode && pathwayMatch === null) warnings.push('School pathway offering data is incomplete');
      add('pathway', 'Selected pathway', weights.pathway, pathwayCode ? pathwayMatch : null);

      const trackCode = selection?.track?.code;
      const trackMatch = school.trackCodes.length ? includesCode(school.trackCodes, trackCode) : null;
      if (trackCode && trackMatch === false) exclusions.push(`Selected track ${selection?.track?.name ?? trackCode} is not offered`);
      if (trackCode && trackMatch === null) warnings.push('Track offering has not been confirmed');
      add('track', 'Selected track', weights.track, trackCode ? trackMatch : null);

      const combinationCode = selection?.combinationRule?.code;
      const combinationMatch = school.combinationCodes.length ? includesCode(school.combinationCodes, combinationCode) : null;
      if (combinationCode && combinationMatch === false) exclusions.push(`Selected combination ${selection?.combinationRule?.name ?? combinationCode} is not offered`);
      if (combinationCode && combinationMatch === null) warnings.push('Subject combination availability has not been confirmed');
      add('combination', 'Subject combination', weights.combination, combinationCode ? combinationMatch : null);

      const genderMatch = genderMatches(school.gender, learner.gender);
      if (!genderMatch) exclusions.push('School gender category is incompatible with the learner');
      add('gender', 'Gender eligibility', weights.gender, genderMatch);

      const boardingMatch = accommodationMatches(school.schoolType, criteria?.boardingPreference);
      if (criteria?.boardingRequired && !boardingMatch) exclusions.push('Required accommodation is unavailable');
      add('accommodation', 'Day or boarding preference', weights.accommodation, criteria?.boardingPreference ? boardingMatch : null);

      const countyMatch = preferredCounties.length
        ? preferredCounties.includes(normalise(school.county))
        : learner.county ? normalise(learner.county) === normalise(school.county) : null;
      if (criteria?.countyRequired && countyMatch === false) exclusions.push('School is outside the required counties');
      add('location', 'Preferred location', weights.location, countyMatch);

      const affordabilityMatch = criteria?.budgetBand && school.affordabilityBand
        ? normalise(criteria.budgetBand) === normalise(school.affordabilityBand)
        : null;
      add('affordability', 'Affordability band', weights.affordability, affordabilityMatch);
      if (criteria?.budgetBand && !school.affordabilityBand) warnings.push('Affordability information is unknown');

      const supportMatch = requiredSupport.length
        ? requiredSupport.every((need) => school.specialNeedsSupport.map(normalise).includes(normalise(need)))
        : learner.specialNeeds ? (school.specialNeedsSupport.length ? true : null) : null;
      if (requiredSupport.length && supportMatch === false) exclusions.push('Required learner support is unavailable');
      add('support', 'Learner support needs', weights.support, supportMatch);

      add('verification', 'Verified school information', weights.verification, school.verified || school.verificationStatus === 'TREND_SCORE_VERIFIED');
      const eligible = exclusions.length === 0;
      const score = eligible ? Math.round((earned / possible) * 100) : 0;
      const local = countyMatch === true;
      const matchedLabels = factors.filter((factor) => factor.matched === true).map((factor) => factor.label.toLowerCase());
      const explanation = eligible
        ? `Fit is based on ${matchedLabels.slice(0, 4).join(', ') || 'the available school data'}. This is planning guidance, not an admission probability.`
        : exclusions.join('. ');
      const inputHash = createHash('sha256').update(JSON.stringify({
        learner: { gender: learner.gender, county: learner.county, specialNeeds: learner.specialNeeds },
        selection: { pathwayCode, trackCode, combinationCode, recommendationConfidence: recommendation?.confidenceScore }, criteria, school: { id: school.id, updatedAt: school.updatedAt },
      })).digest('hex');
      const breakdown: SchoolMatchBreakdown = {
        eligible, factors, exclusions, warnings, explanation,
        confidence: confidenceFor(known, school.verified), inputHash,
      };
      return { learnerId, schoolId: school.id, school, score, bucket: bucketFor(score, local, thresholds), scoreVersion, breakdown };
    });

    const eligible = results.filter((result) => result.breakdown.eligible);
    await prisma.$transaction([
      prisma.schoolMatchScore.deleteMany({ where: { learnerId, schoolId: { notIn: eligible.map((item) => item.schoolId) } } }),
      ...eligible.map((item) => prisma.schoolMatchScore.upsert({
        where: { learnerId_schoolId: { learnerId, schoolId: item.schoolId } },
        update: { score: item.score, bucket: item.bucket, breakdown: item.breakdown as any, scoreVersion, generatedAt: new Date() },
        create: { learnerId, schoolId: item.schoolId, score: item.score, bucket: item.bucket, breakdown: item.breakdown as any, scoreVersion },
      })),
    ]);
    return {
      matches: eligible.sort((a, b) => b.score - a.score),
      excluded: results.filter((result) => !result.breakdown.eligible),
      scoreVersion,
    };
  },

  getMatches: async (learnerId: string) => prisma.schoolMatchScore.findMany({
    where: { learnerId },
    orderBy: [{ score: 'desc' }, { school: { name: 'asc' } }],
    include: { school: true },
  }),

  compare: async (learnerId: string, schoolIds: string[]) => {
    if (schoolIds.length < 2 || schoolIds.length > 4) throw new ApiError(400, 'Choose between 2 and 4 schools to compare');
    const rows = await prisma.schoolMatchScore.findMany({
      where: { learnerId, schoolId: { in: schoolIds } },
      include: { school: true },
      orderBy: { score: 'desc' },
    });
    if (rows.length !== new Set(schoolIds).size) throw new ApiError(400, 'Recalculate matches before comparing these schools');
    return rows;
  },
};
