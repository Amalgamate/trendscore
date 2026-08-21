/**
 * Creates three deterministic learner personas with report-ready score patterns.
 * Safe to re-run: the same learners, tests and results are updated in place.
 */
import {
  AssessmentStatus,
  CurriculumType,
  Gender,
  LearnerStatus,
  ModerationStatus,
  SummativeTestType,
  TestStatus,
} from '@prisma/client';
import prisma from '../src/config/database';
import { ensureStudentAccountForLearner } from '../src/services/studentAccount.service';

const ACADEMIC_YEAR = 2026;
const TERM = 'TERM_1' as const;
const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Creative Arts and Sports'];

const PERSONAS = [
  {
    admissionNumber: 'EVAL-G7-AMANI-NJERI', firstName: 'Amani', lastName: 'Njeri', gender: Gender.FEMALE, grade: 'GRADE_7',
    pattern: 'Balanced explorer — consistent performance with growing STEM confidence.',
    history: [{ grade: 'GRADE_7', academicYear: 2026, scores: [72, 76, 70, 74, 73, 81] }],
  },
  {
    admissionNumber: 'EVAL-G8-BRIAN-OTIENO', firstName: 'Brian', lastName: 'Otieno', gender: Gender.MALE, grade: 'GRADE_8',
    pattern: 'STEM strength — excellent Mathematics and Science, with language support opportunities.',
    history: [
      { grade: 'GRADE_7', academicYear: 2025, scores: [78, 68, 65, 76, 72, 70] },
      { grade: 'GRADE_8', academicYear: 2026, scores: [92, 71, 68, 90, 77, 74] },
    ],
  },
  {
    admissionNumber: 'EVAL-G9-CHAO-WANJIKU', firstName: 'Chao', lastName: 'Wanjiku', gender: Gender.FEMALE, grade: 'GRADE_9',
    pattern: 'Creative and social-sciences strength — ready for pathway guidance and transition reporting.',
    combinationCode: 'ARTS_FINE_MUSIC_THEATRE',
    history: [
      { grade: 'GRADE_7', academicYear: 2024, scores: [62, 78, 76, 67, 80, 84] },
      { grade: 'GRADE_8', academicYear: 2025, scores: [63, 85, 82, 69, 87, 90] },
      { grade: 'GRADE_9', academicYear: 2026, scores: [64, 91, 88, 70, 92, 95] },
    ],
  },
] as const;

const gradeFor = (score: number) => score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'E';

async function getTest(grade: string, learningArea: string, academicYear: number, createdBy: string) {
  const title = `Evaluation Demo — ${learningArea}`;
  const existing = await prisma.summativeTest.findFirst({
    where: { grade, learningArea, term: TERM, academicYear, title, archived: false },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.summativeTest.create({
    data: {
      title, learningArea, grade, term: TERM, academicYear,
      testDate: new Date(`${academicYear}-08-01T00:00:00.000Z`), totalMarks: 100, passMarks: 40,
      createdBy, published: true, active: true, status: AssessmentStatus.PUBLISHED,
      curriculum: CurriculumType.CBC_AND_EXAM, testType: SummativeTestType.MID_TERM,
      description: 'Deterministic evaluation dataset for report and pathway testing.',
    },
    select: { id: true },
  });
}

async function main() {
  const recorder = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'] }, archived: false, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!recorder) throw new Error('An active admin, head teacher, or teacher is required to seed evaluation results.');

  for (const persona of PERSONAS) {
    const learner = await prisma.learner.upsert({
      where: { admissionNumber: persona.admissionNumber },
      update: {
        firstName: persona.firstName, lastName: persona.lastName, gender: persona.gender,
        grade: persona.grade, stream: 'EVAL', status: LearnerStatus.ACTIVE, archived: false,
      },
      create: {
        admissionNumber: persona.admissionNumber, firstName: persona.firstName, lastName: persona.lastName,
        gender: persona.gender, grade: persona.grade, stream: 'EVAL', status: LearnerStatus.ACTIVE,
        institutionType: 'PRIMARY_CBC', dateOfBirth: new Date(persona.grade === 'GRADE_7' ? '2013-02-15' : persona.grade === 'GRADE_8' ? '2012-06-20' : '2011-10-04'),
      },
    });

    await ensureStudentAccountForLearner({
      learnerId: learner.id, admissionNumber: learner.admissionNumber, firstName: learner.firstName,
      lastName: learner.lastName, middleName: learner.middleName,
    });

    // The counsellor workbench reads ClassEnrollment records (rather than
    // learner grade alone). Keep each evaluation persona in its current-grade
    // class so the test dataset is visible in Class View after every re-seed.
    const currentClass = await prisma.class.findFirst({
      where: {
        grade: persona.grade,
        academicYear: ACADEMIC_YEAR,
        term: TERM,
        institutionType: 'PRIMARY_CBC',
        active: true,
        archived: false,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (!currentClass) {
      throw new Error(`No active ${persona.grade} class exists for ${ACADEMIC_YEAR} ${TERM}.`);
    }
    await prisma.classEnrollment.upsert({
      where: { classId_learnerId: { classId: currentClass.id, learnerId: learner.id } },
      update: { active: true, archived: false, archivedAt: null, archivedBy: null },
      create: { classId: currentClass.id, learnerId: learner.id, active: true },
    });

    // Give the Grade 9 evaluation persona a real, editable combination. This
    // lets the decision-plan test exercise the complete learner workflow.
    if ('combinationCode' in persona) {
      const combination = await prisma.subjectCombinationRule.findUnique({
        where: { code: persona.combinationCode },
        include: { items: { select: { officialLearningAreaId: true, officialLearningArea: { select: { subjectType: true } } } } },
      });
      if (!combination) throw new Error(`Evaluation combination ${persona.combinationCode} was not found.`);

      const existingSelection = await prisma.learnerPathwaySelection.findFirst({
        where: { learnerId: learner.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      const selection = existingSelection
        ? await prisma.learnerPathwaySelection.update({
            where: { id: existingSelection.id },
            data: { pathwayId: combination.pathwayId, trackId: combination.trackId, combinationRuleId: combination.id, status: 'DRAFT', locked: false },
          })
        : await prisma.learnerPathwaySelection.create({
            data: { learnerId: learner.id, pathwayId: combination.pathwayId, trackId: combination.trackId, combinationRuleId: combination.id, status: 'DRAFT' },
          });
      await prisma.learnerPathwaySelectionItem.deleteMany({ where: { selectionId: selection.id } });
      await prisma.learnerPathwaySelectionItem.createMany({
        data: combination.items.map((item) => ({
          selectionId: selection.id,
          officialLearningAreaId: item.officialLearningAreaId,
          subjectType: item.officialLearningArea.subjectType,
        })),
      });
    }

    for (const year of persona.history) {
      for (const [index, learningArea] of SUBJECTS.entries()) {
        const score = year.scores[index];
        const test = await getTest(year.grade, learningArea, year.academicYear, recorder.id);
        await prisma.summativeResult.upsert({
          where: { testId_learnerId: { testId: test.id, learnerId: learner.id } },
          update: {
            marksObtained: score, percentage: score, grade: gradeFor(score), status: score >= 40 ? TestStatus.PASS : TestStatus.FAIL,
            moderationStatus: ModerationStatus.APPROVED, remarks: persona.pattern, recordedBy: recorder.id, archived: false,
          },
          create: {
            testId: test.id, learnerId: learner.id, marksObtained: score, percentage: score, grade: gradeFor(score),
            status: score >= 40 ? TestStatus.PASS : TestStatus.FAIL, moderationStatus: ModerationStatus.APPROVED,
            remarks: persona.pattern, recordedBy: recorder.id,
          },
        });
      }
    }
    console.log(`Seeded ${persona.firstName} ${persona.lastName} in ${currentClass.name}: ${persona.pattern}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
