import { Prisma, SummativeTestType, Term } from '@prisma/client';
import prisma from '../config/database';

type DashboardFilters = {
  academicYear?: number;
  term?: Term;
  grade?: string;
  stream?: string;
  section?: string;
  testType?: SummativeTestType;
};

type LearnerRecord = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  grade: string;
  stream: string | null;
};

type TestRecord = {
  id: string;
  title: string;
  learningArea: string;
  grade: string;
  testType: SummativeTestType | null;
  totalMarks: number;
  status: string;
  published: boolean;
};

type ResultRecord = {
  learnerId: string;
  testId: string;
  marksObtained: number | null;
  percentage: number | null;
  grade: string | null;
  gradeCode: string | null;
  achievementLevel: number | null;
  assessmentStatusCode: string | null;
  learner: {
    grade: string;
    stream: string | null;
  };
  test: {
    title: string;
    learningArea: string;
    grade: string;
    testType: SummativeTestType | null;
  };
};

const SECTION_GRADES: Record<string, string[]> = {
  'pre-primary': ['PLAYGROUP', 'PP1', 'PP2'],
  lower: ['GRADE_1', 'GRADE_2', 'GRADE_3'],
  upper: ['GRADE_4', 'GRADE_5', 'GRADE_6'],
  'junior-sec': ['GRADE_7', 'GRADE_8', 'GRADE_9'],
  senior: ['GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3', 'FORM_4'],
};

const toPercent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);
const roundOne = (value: number) => Math.round(value * 10) / 10;
const roundTwo = (value: number) => Math.round(value * 100) / 100;

const normalizeAll = (value?: string | null) => {
  const text = String(value || '').trim();
  return text && text.toLowerCase() !== 'all' ? text : undefined;
};

const safeAverage = (values: number[]) => (values.length ? roundTwo(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

const getCurrentContext = async () => {
  const config = await prisma.termConfig.findFirst({
    where: { isActive: true, archived: false },
    orderBy: { updatedAt: 'desc' },
    select: { academicYear: true, term: true },
  });

  if (config) return config;

  const test = await prisma.summativeTest.findFirst({
    where: { archived: false },
    orderBy: [{ academicYear: 'desc' }, { updatedAt: 'desc' }],
    select: { academicYear: true, term: true },
  });

  return test || { academicYear: new Date().getFullYear(), term: 'TERM_1' as Term };
};

const normalizeFilters = async (filters: DashboardFilters) => {
  const context = await getCurrentContext();
  return {
    academicYear: filters.academicYear || context.academicYear,
    term: filters.term || context.term,
    grade: normalizeAll(filters.grade),
    stream: normalizeAll(filters.stream),
    section: normalizeAll(filters.section),
    testType: filters.testType,
  };
};

const buildLearnerWhere = (filters: Awaited<ReturnType<typeof normalizeFilters>>): Prisma.LearnerWhereInput => {
  const gradeList = filters.grade ? [filters.grade] : filters.section ? SECTION_GRADES[filters.section] : undefined;

  return {
    archived: false,
    status: 'ACTIVE',
    ...(gradeList?.length ? { grade: { in: gradeList } } : {}),
    ...(filters.stream ? { stream: filters.stream } : {}),
  };
};

const buildTestWhere = (filters: Awaited<ReturnType<typeof normalizeFilters>>, grades: string[]): Prisma.SummativeTestWhereInput => ({
  archived: false,
  active: true,
  academicYear: filters.academicYear,
  term: filters.term,
  ...(grades.length ? { grade: { in: grades } } : {}),
  ...(filters.testType ? { testType: filters.testType } : {}),
});

const createGroups = (learners: LearnerRecord[], tests: TestRecord[], results: ResultRecord[]) => {
  const learnerById = new Map(learners.map((learner) => [learner.id, learner]));
  const testsByGrade = new Map<string, TestRecord[]>();
  tests.forEach((test) => {
    const list = testsByGrade.get(test.grade) || [];
    list.push(test);
    testsByGrade.set(test.grade, list);
  });

  const resultByLearnerTest = new Map<string, ResultRecord>();
  results.forEach((result) => resultByLearnerTest.set(`${result.learnerId}:${result.testId}`, result));

  const scoredResults = results.filter((result) => result.percentage !== null && result.percentage !== undefined && !result.assessmentStatusCode);
  const accountedResults = results.filter((result) => result.assessmentStatusCode || result.percentage !== null || result.marksObtained !== null);

  let expectedEntries = 0;
  let completeEntries = 0;
  let statusOnlyEntries = 0;
  let reportReadyLearners = 0;
  const learnerSummaries: Array<{ learner: LearnerRecord; expected: number; scored: number; accounted: number; mean: number | null; missing: number }> = [];

  learners.forEach((learner) => {
    const gradeTests = testsByGrade.get(learner.grade) || [];
    expectedEntries += gradeTests.length;
    const scores: number[] = [];
    let accounted = 0;
    let scored = 0;
    let statusOnly = 0;

    gradeTests.forEach((test) => {
      const result = resultByLearnerTest.get(`${learner.id}:${test.id}`);
      if (!result) return;
      if (result.assessmentStatusCode) {
        statusOnly += 1;
        accounted += 1;
        return;
      }
      if (result.percentage !== null && result.percentage !== undefined) {
        scores.push(result.percentage);
        scored += 1;
        accounted += 1;
      }
    });

    statusOnlyEntries += statusOnly;
    completeEntries += scored;
    if (gradeTests.length > 0 && accounted === gradeTests.length) reportReadyLearners += 1;
    learnerSummaries.push({
      learner,
      expected: gradeTests.length,
      scored,
      accounted,
      mean: safeAverage(scores),
      missing: Math.max(0, gradeTests.length - accounted),
    });
  });

  return {
    learnerById,
    testsByGrade,
    scoredResults,
    accountedResults,
    expectedEntries,
    completeEntries,
    statusOnlyEntries,
    reportReadyLearners,
    learnerSummaries,
  };
};

const buildGradeRows = (learners: LearnerRecord[], tests: TestRecord[], groups: ReturnType<typeof createGroups>) => {
  const grades = Array.from(new Set([...learners.map((learner) => learner.grade), ...tests.map((test) => test.grade)])).sort();

  return grades.map((grade) => {
    const gradeLearners = learners.filter((learner) => learner.grade === grade);
    const gradeTests = tests.filter((test) => test.grade === grade);
    const summaries = groups.learnerSummaries.filter((summary) => summary.learner.grade === grade);
    const expected = gradeLearners.length * gradeTests.length;
    const scored = summaries.reduce((sum, summary) => sum + summary.scored, 0);
    const accounted = summaries.reduce((sum, summary) => sum + summary.accounted, 0);
    const ready = summaries.filter((summary) => summary.expected > 0 && summary.accounted === summary.expected).length;
    const scores = summaries.map((summary) => summary.mean).filter((value): value is number => value !== null);

    return {
      grade,
      learners: gradeLearners.length,
      tests: gradeTests.length,
      expected,
      scored,
      accounted,
      pending: Math.max(0, expected - accounted),
      completionRate: toPercent(accounted, expected),
      scoredRate: toPercent(scored, expected),
      reportReadyLearners: ready,
      reportReadyRate: toPercent(ready, gradeLearners.length),
      mean: safeAverage(scores),
    };
  });
};

const buildSubjectRows = (results: ResultRecord[], tests: TestRecord[], learners: LearnerRecord[]) => {
  const testsBySubject = new Map<string, TestRecord[]>();
  tests.forEach((test) => {
    const key = test.learningArea || 'Unassigned';
    const list = testsBySubject.get(key) || [];
    list.push(test);
    testsBySubject.set(key, list);
  });

  return Array.from(testsBySubject.entries()).map(([subject, subjectTests]) => {
    const subjectTestIds = new Set(subjectTests.map((test) => test.id));
    const expected = subjectTests.reduce(
      (sum, test) => sum + learners.filter((learner) => learner.grade === test.grade).length,
      0
    );
    const subjectResults = results.filter((result) => subjectTestIds.has(result.testId));
    const scored = subjectResults.filter((result) => result.percentage !== null && result.percentage !== undefined && !result.assessmentStatusCode);
    const accounted = subjectResults.filter((result) => result.assessmentStatusCode || result.percentage !== null || result.marksObtained !== null);
    const scores = scored.map((result) => Number(result.percentage));

    return {
      subject,
      tests: subjectTests.length,
      expected,
      scored: scored.length,
      accounted: accounted.length,
      pending: Math.max(0, expected - accounted.length),
      completionRate: toPercent(accounted.length, expected),
      mean: safeAverage(scores),
    };
  }).sort((a, b) => b.pending - a.pending || a.subject.localeCompare(b.subject));
};

const buildStreamRows = (summaries: ReturnType<typeof createGroups>['learnerSummaries']) => {
  const map = new Map<string, typeof summaries>();
  summaries.forEach((summary) => {
    const key = `${summary.learner.grade} ${summary.learner.stream || 'Default'}`;
    const list = map.get(key) || [];
    list.push(summary);
    map.set(key, list);
  });

  return Array.from(map.entries()).map(([label, rows]) => {
    const scores = rows.map((row) => row.mean).filter((value): value is number => value !== null);
    const expected = rows.reduce((sum, row) => sum + row.expected, 0);
    const accounted = rows.reduce((sum, row) => sum + row.accounted, 0);
    return {
      label,
      learners: rows.length,
      mean: safeAverage(scores),
      completionRate: toPercent(accounted, expected),
      atRisk: rows.filter((row) => (row.mean !== null && row.mean < 50) || row.missing > 0).length,
    };
  }).sort((a, b) => (b.mean || 0) - (a.mean || 0));
};

const buildAchievementRows = (results: ResultRecord[]) => {
  const map = new Map<string, number>();
  results.forEach((result) => {
    const key = result.gradeCode || result.grade || (result.achievementLevel ? `Level ${result.achievementLevel}` : 'Ungraded');
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count, rate: toPercent(count, results.length) }))
    .sort((a, b) => b.count - a.count);
};

export const reportDashboardService = {
  async getDashboardData(rawFilters: DashboardFilters) {
    const filters = await normalizeFilters(rawFilters);
    const learnerWhere = buildLearnerWhere(filters);

    const learners = await prisma.learner.findMany({
      where: learnerWhere,
      select: { id: true, admissionNumber: true, firstName: true, lastName: true, gender: true, grade: true, stream: true },
      orderBy: [{ grade: 'asc' }, { stream: 'asc' }, { lastName: 'asc' }],
    }) as LearnerRecord[];

    const grades = Array.from(new Set(learners.map((learner) => learner.grade)));
    const tests = await prisma.summativeTest.findMany({
      where: buildTestWhere(filters, grades),
      select: { id: true, title: true, learningArea: true, grade: true, testType: true, totalMarks: true, status: true, published: true },
      orderBy: [{ grade: 'asc' }, { learningArea: 'asc' }, { testDate: 'asc' }],
    }) as TestRecord[];

    const results = tests.length && learners.length
      ? await prisma.summativeResult.findMany({
        where: {
          archived: false,
          testId: { in: tests.map((test) => test.id) },
          learnerId: { in: learners.map((learner) => learner.id) },
        },
        select: {
          learnerId: true,
          testId: true,
          marksObtained: true,
          percentage: true,
          grade: true,
          gradeCode: true,
          achievementLevel: true,
          assessmentStatusCode: true,
          learner: { select: { grade: true, stream: true } },
          test: { select: { title: true, learningArea: true, grade: true, testType: true } },
        },
      }) as ResultRecord[]
      : [];

    const groups = createGroups(learners, tests, results);
    const gradeRows = buildGradeRows(learners, tests, groups);
    const subjectRows = buildSubjectRows(results, tests, learners);
    const streamRows = buildStreamRows(groups.learnerSummaries);
    const scoredScores = groups.scoredResults.map((result) => Number(result.percentage));
    const learnersWithTests = groups.learnerSummaries.filter((summary) => summary.expected > 0);
    const allAtRiskLearners = groups.learnerSummaries
      .filter((summary) => summary.expected > 0 && ((summary.mean !== null && summary.mean < 50) || summary.missing > 0))
      .sort((a, b) => b.missing - a.missing || (a.mean || 0) - (b.mean || 0))
    const atRiskLearners = allAtRiskLearners
      .slice(0, 8)
      .map((summary) => ({
        learnerId: summary.learner.id,
        name: `${summary.learner.firstName} ${summary.learner.lastName}`,
        admissionNumber: summary.learner.admissionNumber,
        grade: summary.learner.grade,
        stream: summary.learner.stream,
        mean: summary.mean,
        missing: summary.missing,
        expected: summary.expected,
      }));

    const lowSubject = subjectRows.filter((row) => row.mean !== null).sort((a, b) => (a.mean || 0) - (b.mean || 0))[0] || null;
    const strongestSubject = subjectRows.filter((row) => row.mean !== null).sort((a, b) => (b.mean || 0) - (a.mean || 0))[0] || null;

    return {
      filters,
      summary: {
        learners: learners.length,
        activeLearnersWithTests: learnersWithTests.length,
        tests: tests.length,
        subjects: new Set(tests.map((test) => test.learningArea)).size,
        expectedEntries: groups.expectedEntries,
        scoredEntries: groups.completeEntries,
        accountedEntries: groups.accountedResults.length,
        statusOnlyEntries: groups.statusOnlyEntries,
        pendingEntries: Math.max(0, groups.expectedEntries - groups.accountedResults.length),
        markEntryCompletionRate: toPercent(groups.accountedResults.length, groups.expectedEntries),
        scoredCompletionRate: toPercent(groups.completeEntries, groups.expectedEntries),
        reportReadyLearners: groups.reportReadyLearners,
        reportReadyRate: toPercent(groups.reportReadyLearners, learnersWithTests.length),
        mean: safeAverage(scoredScores),
        atRiskLearners: allAtRiskLearners.length,
        highestSubject: strongestSubject,
        lowestSubject: lowSubject,
      },
      gradeRows,
      subjectRows,
      streamRows,
      achievementRows: buildAchievementRows(groups.scoredResults),
      atRiskLearners,
      recentTests: tests.slice(-6).reverse().map((test) => ({
        id: test.id,
        title: test.title,
        subject: test.learningArea,
        grade: test.grade,
        testType: test.testType,
        status: test.status,
        published: test.published,
      })),
      quality: {
        hasTests: tests.length > 0,
        hasScoredResults: groups.scoredResults.length > 0,
        statusOnlyEntries: groups.statusOnlyEntries,
        missingEntries: Math.max(0, groups.expectedEntries - groups.accountedResults.length),
        coverageRate: roundOne(toPercent(groups.accountedResults.length, groups.expectedEntries)),
      },
    };
  },
};
