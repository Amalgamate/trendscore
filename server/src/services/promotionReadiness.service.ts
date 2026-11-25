/**
 * promotionReadiness.service.ts
 *
 * Live, per-school readiness check for grade promotion. Used by the Promotion
 * page guidance panel and by the academic-year setup announcement. It never
 * writes data — it only describes what the next promotion would encounter.
 */

import prisma from '../config/database';

export type PromotionInstitutionType = 'PRIMARY_CBC' | 'SECONDARY';
export type PromotionTerm = 'TERM_1' | 'TERM_2' | 'TERM_3';

/** Grades a school can promote into. Matches the promotion controller allow-list. */
export function getPromotionGrades(institutionType: PromotionInstitutionType): string[] {
  return institutionType === 'SECONDARY'
    ? ['GRADE_10', 'GRADE_11', 'GRADE_12']
    : ['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9'];
}

export interface PromotionReadinessInput {
  institutionType: PromotionInstitutionType;
  targetAcademicYear: number;
  targetTerm: PromotionTerm;
}

export interface PromotionStep {
  from: string;
  to: string;
  learnerCount: number;
  targetClassCount: number;
  targetCapacity: number;
  projectedEnrollment: number;
  needsClass: boolean;
  issue: string | null;
}

export interface PromotionReadiness {
  destination: { academicYear: number; term: PromotionTerm };
  activeLearnerCount: number;
  staleEnrollmentCount: number;
  missingClasses: Array<{ grade: string; stream: string }>;
  steps: PromotionStep[];
  suggestedOrder: string[];
  messages: string[];
}

const keyFor = (grade: string, stream: string) => `${grade}|${stream.toLowerCase()}`;

/**
 * Build a readiness snapshot. Capacity is evaluated for the recommended
 * top-down order: each destination grade's own learners move out before the
 * grade below them arrives. Existing target-class occupants are reported
 * separately so an out-of-order run is still understandable.
 */
export async function buildPromotionReadiness(input: PromotionReadinessInput): Promise<PromotionReadiness> {
  const grades = getPromotionGrades(input.institutionType);
  const [learners, classes, staleEnrollments] = await Promise.all([
    prisma.learner.findMany({
      where: { archived: false, institutionType: input.institutionType as any, status: 'ACTIVE' },
      select: { grade: true, stream: true },
    }),
    prisma.class.findMany({
      where: {
        grade: { in: grades },
        academicYear: input.targetAcademicYear,
        term: input.targetTerm as any,
        active: true,
        archived: false,
      },
      select: { grade: true, stream: true, capacity: true, _count: { select: { enrollments: { where: { active: true, archived: false } } } } },
    }),
    prisma.classEnrollment.findMany({
      where: { active: true, archived: false, learner: { status: { not: 'ACTIVE' } } },
      select: { id: true },
    }),
  ]);

  const counts = new Map<string, number>();
  const countsByKey = new Map<string, number>();
  const streamsByGrade = new Map<string, Set<string>>();
  for (const learner of learners) {
    const grade = String(learner.grade || '').toUpperCase();
    if (!grades.includes(grade)) continue;
    counts.set(grade, (counts.get(grade) || 0) + 1);
    const stream = String(learner.stream || 'A');
    countsByKey.set(keyFor(grade, stream), (countsByKey.get(keyFor(grade, stream)) || 0) + 1);
    const set = streamsByGrade.get(grade) || new Set<string>();
    set.add(stream);
    streamsByGrade.set(grade, set);
  }

  const capacityByKey = new Map<string, number>();
  const occupantsByKey = new Map<string, number>();
  const classCountByKey = new Map<string, number>();
  for (const cls of classes) {
    const key = keyFor(String(cls.grade), String(cls.stream || 'A'));
    capacityByKey.set(key, (capacityByKey.get(key) || 0) + Number(cls.capacity || 0));
    occupantsByKey.set(key, (occupantsByKey.get(key) || 0) + Number(cls._count?.enrollments || 0));
    classCountByKey.set(key, (classCountByKey.get(key) || 0) + 1);
  }

  const missingClasses: Array<{ grade: string; stream: string }> = [];
  for (const grade of grades) {
    // The final grade graduates rather than moving into another class.
    if (grade === grades[grades.length - 1]) continue;
    if (!((counts.get(grade) || 0) > 0)) continue;
    const streams = streamsByGrade.get(grade) || new Set<string>(['A']);
    for (const stream of streams) {
      if (!classCountByKey.has(keyFor(grades[grades.indexOf(grade) + 1], stream))) {
        missingClasses.push({ grade: grades[grades.indexOf(grade) + 1], stream });
      }
    }
  }

  const steps: PromotionStep[] = grades.map((grade, index) => {
    const to = grades[index + 1] || 'GRADUATED';
    const learnerCount = counts.get(grade) || 0;
    if (to === 'GRADUATED') {
      return {
        from: grade, to, learnerCount, targetClassCount: 0, targetCapacity: 0,
        projectedEnrollment: 0, needsClass: false, issue: null,
      };
    }
    const streams = learnerCount ? (streamsByGrade.get(grade) || new Set<string>(['A'])) : new Set<string>();
    let targetCapacity = 0;
    let targetClassCount = 0;
    let projectedEnrollment = 0;
    let issue: string | null = null;
    for (const stream of streams) {
      const key = keyFor(to, stream);
      const streamCapacity = capacityByKey.get(key) || 0;
      const streamClasses = classCountByKey.get(key) || 0;
      const incoming = countsByKey.get(keyFor(grade, stream)) || 0;
      targetCapacity += streamCapacity;
      targetClassCount += streamClasses;
      projectedEnrollment += incoming;
      if (!streamClasses) issue = `No active ${to} class for stream ${stream} in ${input.targetAcademicYear} ${input.targetTerm.replace('_', ' ')}.`;
      else if (incoming > streamCapacity) {
        issue = `${to} stream ${stream} has capacity ${streamCapacity} but ${incoming} learners will arrive.`;
      }
    }
    return { from: grade, to, learnerCount, targetClassCount, targetCapacity, projectedEnrollment, needsClass: true, issue };
  });

  // The UI applies one source grade at a time; this is the order that avoids
  // destination classes still being occupied by their current learners.
  const suggestedOrder = [...steps].reverse().map((step) => `${step.from} → ${step.to}`);

  const messages: string[] = [];
  if (missingClasses.length) {
    const summary = missingClasses.slice(0, 6).map((c) => `${c.grade} (${c.stream})`).join(', ');
    messages.push(`Create ${missingClasses.length} destination class${missingClasses.length === 1 ? '' : 'es'} first: ${summary}${missingClasses.length > 6 ? '…' : ''}.`);
  }
  const capacityIssues = steps.filter((step) => step.issue && step.needsClass && step.targetClassCount > 0);
  if (capacityIssues.length) {
    messages.push(`Raise capacity before promoting: ${capacityIssues.map((step) => `${step.from}→${step.to}`).join(', ')}.`);
  }
  if (staleEnrollments.length) {
    messages.push(`${staleEnrollments.length} non-active learner${staleEnrollments.length === 1 ? '' : 's'} still hold active enrollments. Clear them before reviewing seats.`);
  }
  if (!messages.length) messages.push('Destination classes, capacity and enrollment hygiene look ready. You can review placements.');

  return {
    destination: { academicYear: input.targetAcademicYear, term: input.targetTerm },
    activeLearnerCount: learners.length,
    staleEnrollmentCount: staleEnrollments.length,
    missingClasses,
    steps,
    suggestedOrder,
    messages,
  };
}
