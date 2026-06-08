/**
 * AI Assistant Service — Inbuilt Analysis Mode
 *
 * All pathway prediction, feedback and risk analysis is performed
 * using deterministic, rule-based logic derived from CBC curriculum
 * guidelines. No external AI API is called anywhere in this file.
 */

import { performanceService } from './performance.service';
import prisma from '../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Official CBC Junior School subject → cluster mapping */
const CLUSTER_MAP: Record<string, 'STEM' | 'SOCIAL' | 'ARTS'> = {
  // STEM
  'mathematics':           'STEM',
  'integrated science':    'STEM',
  'pre-technical studies': 'STEM',
  'pre technical studies': 'STEM',
  'agriculture':           'STEM',
  'computer science':      'STEM',
  'science and technology':'STEM',
  'information communications technology': 'STEM',
  'ict':                   'STEM',

  // SOCIAL
  'english':               'SOCIAL',
  'kiswahili':             'SOCIAL',
  'social studies':        'SOCIAL',
  'religious education':   'SOCIAL',
  'life skills':           'SOCIAL',
  'indigenous language':   'SOCIAL',

  // ARTS
  'creative arts and sports': 'ARTS',
  'creative arts & sports':   'ARTS',
  'creative arts':            'ARTS',
  'creative activities':      'ARTS',
  'ca':                       'ARTS',
  'music':                    'ARTS',
  'physical education':       'ARTS',
  'pe':                       'ARTS',
};

/** Career suggestions keyed by pathway */
const CAREER_MAP: Record<string, string[]> = {
  STEM: [
    'Engineer (Civil / Electrical / Mechanical)',
    'Medical Doctor or Clinical Officer',
    'Software Developer / Data Scientist',
    'Agronomist / Agricultural Engineer',
    'Architect or Quantity Surveyor',
  ],
  'Social Sciences': [
    'Lawyer / Advocate of the High Court',
    'Journalist / Media Personality',
    'Diplomat / International Relations Officer',
    'Sociologist / Counselling Psychologist',
    'Educator / Education Policy Analyst',
  ],
  'Arts and Sports Science': [
    'Visual Artist / Graphic Designer',
    'Professional Athlete / Coach',
    'Musician / Sound Engineer',
    'Fashion Designer / Creative Director',
    'Film Producer / Content Creator',
  ],
};

/** Growth tips keyed by pathway */
const GROWTH_MAP: Record<string, string[]> = {
  STEM: [
    'Strengthen Mathematical problem-solving through regular practice',
    'Explore science fairs, coding clubs and technical competitions',
    'Build a reading habit around technology and innovation topics',
  ],
  'Social Sciences': [
    'Develop public speaking and debate skills',
    'Read widely — newspapers, current affairs and literature',
    'Participate in community service and student leadership roles',
  ],
  'Arts and Sports Science': [
    'Pursue extracurricular activities in music, drama or sport consistently',
    'Build a portfolio of creative work to showcase talent',
    'Seek mentorship from professionals in your area of interest',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Loose, case-insensitive subject → cluster lookup */
function resolveCluster(subject: string): 'STEM' | 'SOCIAL' | 'ARTS' | null {
  const lower = subject.toLowerCase().trim();
  // Exact match first
  if (CLUSTER_MAP[lower]) return CLUSTER_MAP[lower];
  // Partial match
  for (const [key, cluster] of Object.entries(CLUSTER_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return cluster;
  }
  return null;
}

/** Convert numeric average to a CBC rubric label */
function percentageToLabel(pct: number): string {
  if (pct >= 80) return 'Exceeding Expectations (EE)';
  if (pct >= 60) return 'Meeting Expectations (ME)';
  if (pct >= 40) return 'Approaching Expectations (AE)';
  return 'Below Expectations (BE)';
}

/** Derive confidence score from the spread between the top and second cluster */
function deriveConfidence(stem: number, social: number, arts: number): number {
  const scores = [stem, social, arts].sort((a, b) => b - a);
  const gap = scores[0] - scores[1];
  // gap 0 → confidence 50 (tie), gap ≥ 30 → confidence 95
  return Math.min(95, Math.max(50, 50 + Math.round(gap * 1.5)));
}

/** Build a plain-English justification without any AI */
function buildJustification(
  pathway: string,
  stem: number,
  social: number,
  arts: number,
  topSubjects: string[]
): string {
  const top = topSubjects.length > 0
    ? `Performance data highlights strength in ${topSubjects.slice(0, 2).join(' and ')}.`
    : '';
  const clusterLine =
    `STEM cluster average: ${stem}%, ` +
    `Social Sciences cluster average: ${social}%, ` +
    `Arts & Sports cluster average: ${arts}%.`;

  const pathwayLine: Record<string, string> = {
    STEM:
      `The learner's strongest performance is in Science, Mathematics and Technology subjects, ` +
      `indicating a clear aptitude for the STEM pathway.`,
    'Social Sciences':
      `The learner demonstrates greatest strength in Languages and Humanities, ` +
      `pointing towards the Social Sciences pathway.`,
    'Arts and Sports Science':
      `The learner shows the highest engagement and results in Creative Arts and Sports, ` +
      `suggesting the Arts and Sports Science pathway as the best fit.`,
  };

  return `${pathwayLine[pathway] || ''} ${top} ${clusterLine}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class AIAssistantService {

  /**
   * Generate a rule-based teacher comment from performance trend data.
   * No external API call — comment is constructed from score bands.
   */
  async generateTeacherFeedback(
    learnerId: string,
    term: any,
    academicYear: number
  ): Promise<string> {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true, grade: true },
    });

    if (!learner) throw new Error('Learner not found');

    const performanceData = await performanceService.getLearnerPerformanceTrend(learnerId);
    const latest = performanceData.trend[performanceData.trend.length - 1];
    const pct: number = latest?.percentage ?? 0;
    const label = percentageToLabel(pct);
    const trend: string = performanceData.status ?? 'stable';
    const name = learner.firstName;

    if (pct >= 80) {
      return `${name} is ${label} and continues to demonstrate outstanding commitment across all learning areas. ` +
        `The upward trend (${trend}) this term reflects excellent mastery of competencies. ` +
        `Keep encouraging independent research and peer mentorship opportunities.`;
    } else if (pct >= 60) {
      return `${name} is ${label} and shows consistent engagement with the CBC curriculum. ` +
        `Performance trend: ${trend}. With targeted revision in a few areas, ${name} is well-placed to reach the Exceeding Expectations band. ` +
        `Encourage daily reading and regular homework review.`;
    } else if (pct >= 40) {
      return `${name} is ${label} and is making progress, though some learning gaps remain. ` +
        `Performance trend: ${trend}. Additional support in core subjects is recommended. ` +
        `Regular teacher-guided review sessions and parental involvement will be beneficial.`;
    } else {
      return `${name} is currently ${label} and requires urgent academic support. ` +
        `Performance trend: ${trend}. A structured intervention plan is strongly recommended. ` +
        `Close collaboration between parents, the class teacher and the learner is essential this term.`;
    }
  }

  /**
   * Rule-based risk analysis — no AI.
   */
  async analyzeLearnerRisk(learnerId: string): Promise<string> {
    const performanceData = await performanceService.getLearnerPerformanceTrend(learnerId);

    if (performanceData.trend.length < 2) {
      return 'Insufficient historical data for risk analysis. Ensure at least two terms of results are recorded.';
    }

    const latest = performanceData.trend[performanceData.trend.length - 1];
    const pct: number = latest?.percentage ?? 0;
    const growth: number = performanceData.growth ?? 0;

    let riskLevel: string;
    let justification: string;
    let interventions: string;

    if (pct >= 60 && growth >= 0) {
      riskLevel = 'Low';
      justification = `Current average of ${pct}% with a positive growth trend of ${growth}% indicates the learner is on track.`;
      interventions = 'Maintain current study habits. Encourage participation in enrichment activities.';
    } else if (pct >= 40 || (pct >= 60 && growth < -10)) {
      riskLevel = 'Medium';
      justification = `Average of ${pct}% with a trend of ${growth}% suggests performance may be plateauing or declining.`;
      interventions = 'Schedule targeted revision sessions. Review assessment feedback with the learner weekly. Increase parental engagement.';
    } else {
      riskLevel = 'High';
      justification = `Average of ${pct}% with trend ${growth}% indicates the learner is at significant risk of falling behind.`;
      interventions = 'Implement a formal intervention plan immediately. Daily check-ins by the class teacher. Refer to the school counselor if needed.';
    }

    return `Risk Level: ${riskLevel}\nJustification: ${justification}\nInterventions: ${interventions}`;
  }

  /**
   * Deterministic CBC Pathway Prediction — no AI API.
   *
   * Algorithm:
   *  1. Fetch summative results for the term.
   *  2. Map each subject to a CBC cluster (STEM / Social / Arts).
   *  3. Average scores per cluster.
   *  4. Pick the highest-scoring cluster as the recommended pathway.
   *  5. Derive confidence from the gap between top and second cluster.
   *  6. Build justification, career list, and growth tips from lookup tables.
   */
  async generatePathwayPrediction(
    learnerId: string,
    term: string,
    academicYear: number
  ): Promise<any> {
    // 1. Fetch results
    const results = await prisma.summativeResult.findMany({
      where: {
        learnerId,
        test: { academicYear, term: term as any },
      },
      include: { test: { select: { learningArea: true } } },
    });

    // 2. Bucket scores into clusters
    const clusterScores: Record<'STEM' | 'SOCIAL' | 'ARTS', number[]> = {
      STEM: [], SOCIAL: [], ARTS: [],
    };
    const stemSubjects: string[] = [];
    const socialSubjects: string[] = [];
    const artsSubjects: string[] = [];

    for (const r of results) {
      const cluster = resolveCluster(r.test.learningArea);
      if (!cluster || r.percentage === null || r.percentage === undefined) continue;
      clusterScores[cluster].push(r.percentage);
      if (cluster === 'STEM')   stemSubjects.push(r.test.learningArea);
      if (cluster === 'SOCIAL') socialSubjects.push(r.test.learningArea);
      if (cluster === 'ARTS')   artsSubjects.push(r.test.learningArea);
    }

    // 3. Compute averages — keys match PathwayPredictionPage.jsx
    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : 0;

    const clusterBreakdown = {
      STEM:   avg(clusterScores.STEM),
      Social: avg(clusterScores.SOCIAL),
      Arts:   avg(clusterScores.ARTS),
    };

    // 4. Determine winning pathway
    const { STEM, Social, Arts } = clusterBreakdown;
    const maxScore = Math.max(STEM, Social, Arts);

    let predictedPathway: string;
    let topSubjects: string[];

    if (maxScore === 0) {
      // No results recorded yet — return a neutral pending result
      return {
        predictedPathway: 'Analysis Pending',
        confidence: 0,
        justification:
          'No summative results have been recorded for this term yet. ' +
          'Please ensure all subject scores are entered to generate a pathway recommendation.',
        careerRecommendations: [
          'Record all subject results to unlock pathway analysis',
        ],
        growthAreas: [
          'Ensure teachers have entered results for all learning areas',
          'Contact the class teacher if results are missing',
        ],
        clusterBreakdown,
      };
    }

    if (STEM >= Social && STEM >= Arts) {
      predictedPathway = 'STEM';
      topSubjects = stemSubjects;
    } else if (Social >= STEM && Social >= Arts) {
      predictedPathway = 'Social Sciences';
      topSubjects = socialSubjects;
    } else {
      predictedPathway = 'Arts and Sports Science';
      topSubjects = artsSubjects;
    }

    // 5. Confidence from cluster gap
    const confidence = deriveConfidence(STEM, Social, Arts);

    // 6. Build narrative
    const justification = buildJustification(
      predictedPathway, STEM, Social, Arts, topSubjects
    );

    return {
      predictedPathway,
      confidence,
      justification,
      careerRecommendations: CAREER_MAP[predictedPathway] ?? [],
      growthAreas: GROWTH_MAP[predictedPathway] ?? [],
      clusterBreakdown,
    };
  }
}

export const aiAssistantService = new AIAssistantService();
