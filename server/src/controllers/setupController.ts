/**
 * Bulk Setup Functions — called from Admin UI to seed assessments,
 * grading scales, and summative tests in one operation.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { Term } from '@prisma/client';
import prisma from '../config/database';
import { redisCacheService } from '../services/redis-cache.service';
import { ApiError } from '../utils/error.util';

const LEARNING_AREAS_CONFIG: Record<string, string[]> = {
  PLAYGROUP: ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  PP1:       ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  PP2:       ['Language Activities', 'Kiswahili', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  GRADE_1:   ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  GRADE_2:   ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  GRADE_3:   ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  GRADE_4:   ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  GRADE_5:   ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  GRADE_6:   ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  GRADE_7:   ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  GRADE_8:   ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  GRADE_9:   ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
};

const STANDARD_GRADING_RANGES = [
  { minPercentage: 80, maxPercentage: 100, points: 4, grade: 'A', label: 'Excellent',     color: '#10b981' },
  { minPercentage: 60, maxPercentage: 79,  points: 3, grade: 'B', label: 'Good',          color: '#3b82f6' },
  { minPercentage: 50, maxPercentage: 59,  points: 2, grade: 'C', label: 'Average',       color: '#f59e0b' },
  { minPercentage: 40, maxPercentage: 49,  points: 1, grade: 'D', label: 'Pass',          color: '#f97316' },
  { minPercentage: 0,  maxPercentage: 39,  points: 0, grade: 'E', label: 'Below Average', color: '#ef4444' },
];

/**
 * POST /api/assessments/setup/create-scales
 */
export const bulkCreateGradingScales = async (req: AuthRequest, res: Response) => {
  try {
    const { overwrite = false } = req.body;
    let created = 0;
    let skipped = 0;
    const logs: string[] = [];

    for (const grade of Object.keys(LEARNING_AREAS_CONFIG)) {
      for (const learningArea of LEARNING_AREAS_CONFIG[grade]) {
        const scaleName = `${grade} - ${learningArea}`;
        const existing = await prisma.gradingSystem.findFirst({ where: { name: scaleName } });

        if (existing && !overwrite) { skipped++; logs.push(`⏭️  Skipped: ${scaleName}`); continue; }
        if (existing && overwrite)  { await prisma.gradingSystem.delete({ where: { id: existing.id } }); }

        await prisma.gradingSystem.create({
          data: {
            name: scaleName,
            grade: grade as any,
            learningArea,
            type: 'SUMMATIVE',
            active: true,
            ranges: {
              create: STANDARD_GRADING_RANGES.map((r) => ({
                minPercentage: r.minPercentage,
                maxPercentage: r.maxPercentage,
                points: r.points,
                summativeGrade: r.grade,
                label: r.label,
                color: r.color,
              })),
            },
          },
        });

        created++;
        logs.push(`✅ Created: ${scaleName}`);
      }
    }

    await redisCacheService.deleteByPrefix('grading:');
    res.json({ success: true, message: `Created ${created} grading scales`, data: { created, skipped, logs } });
  } catch (error: any) {
    throw new ApiError(500, error.message);
  }
};

/**
 * POST /api/assessments/setup/create-tests
 */
export const bulkCreateSummativeTests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'User ID required');

    const { term = 'TERM_1', academicYear = new Date().getFullYear(), overwrite = false, weight = 1.0 } = req.body;

    let created = 0;
    let skipped = 0;
    const logs: string[] = [];

    const scales = await prisma.gradingSystem.findMany({ where: { active: true, type: 'SUMMATIVE' } });

    if (scales.length === 0) {
      throw new ApiError(400, 'No grading scales found. Create scales first.');
    }

    for (const scale of scales) {
      if (!scale.grade || !scale.learningArea) continue;

      const testTitle = `${scale.learningArea} Test - ${term}`;
      const existing = await prisma.summativeTest.findFirst({
        where: { grade: scale.grade, learningArea: scale.learningArea, term: term as Term, academicYear: parseInt(String(academicYear)) },
      });

      if (existing && !overwrite) { skipped++; logs.push(`⏭️  Skipped: ${testTitle}`); continue; }
      if (existing && overwrite) {
        await prisma.summativeResult.deleteMany({ where: { testId: existing.id } });
        await prisma.summativeTest.delete({ where: { id: existing.id } });
      }

      await prisma.summativeTest.create({
        data: {
          title: testTitle,
          learningArea: scale.learningArea,
          term: term as Term,
          academicYear: parseInt(String(academicYear)),
          grade: scale.grade,
          testDate: new Date(),
          totalMarks: 100,
          passMarks: 40,
          createdBy: userId,
          scaleId: scale.id,
          status: 'PUBLISHED',
          weight: parseFloat(String(weight)),
          published: true,
          testType: 'ASSESSMENT',
          active: true,
        },
      });

      created++;
      logs.push(`✅ Created: ${testTitle}`);
    }

    await redisCacheService.deleteByPrefix('tests:');
    res.json({ success: true, message: `Created ${created} summative tests`, data: { created, skipped, logs } });
  } catch (error: any) {
    throw new ApiError(500, error.message);
  }
};

/**
 * POST /api/assessments/setup/complete
 * Runs scale creation + test creation in one shot.
 */
export const completeSchoolSetup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'User ID required');

    const { term = 'TERM_1', academicYear = new Date().getFullYear(), overwrite = false, weight = 1.0 } = req.body;
    const logs: string[] = [];

    // Step 1 — Default scale group
    let scaleGroup = await prisma.scaleGroup.findFirst({ where: { name: 'Standard School Grading Scale' } });
    if (!scaleGroup) {
      scaleGroup = await prisma.scaleGroup.create({
        data: { name: 'Standard School Grading Scale', description: 'Default grading scale for all subjects', active: true },
      });
      logs.push('✅ Created default scale group');
    } else {
      logs.push('✅ Using existing scale group');
    }

    // Step 2 — Grading scales
    let scalesCreated = 0;
    for (const grade of Object.keys(LEARNING_AREAS_CONFIG)) {
      for (const learningArea of LEARNING_AREAS_CONFIG[grade]) {
        const scaleName = `${grade} - ${learningArea}`;
        const existing = await prisma.gradingSystem.findFirst({ where: { name: scaleName } });
        if (existing && !overwrite) continue;
        if (existing && overwrite) await prisma.gradingSystem.delete({ where: { id: existing.id } });

        await prisma.gradingSystem.create({
          data: {
            name: scaleName,
            grade: grade as any,
            learningArea,
            type: 'SUMMATIVE',
            active: true,
            scaleGroupId: scaleGroup.id,
            ranges: {
              create: STANDARD_GRADING_RANGES.map((r) => ({
                minPercentage: r.minPercentage,
                maxPercentage: r.maxPercentage,
                points: r.points,
                summativeGrade: r.grade,
                label: r.label,
                color: r.color,
              })),
            },
          },
        });
        scalesCreated++;
      }
    }
    logs.push(`✅ Grading scales created: ${scalesCreated}`);

    // Step 3 — Summative tests
    let testsCreated = 0;
    const scales = await prisma.gradingSystem.findMany({ where: { active: true, type: 'SUMMATIVE' } });

    for (const scale of scales) {
      if (!scale.grade || !scale.learningArea) continue;
      const testTitle = `${scale.learningArea} Test - ${term}`;
      const existing = await prisma.summativeTest.findFirst({
        where: { grade: scale.grade, learningArea: scale.learningArea, term: term as Term, academicYear: parseInt(String(academicYear)) },
      });
      if (existing && !overwrite) continue;
      if (existing && overwrite) {
        await prisma.summativeResult.deleteMany({ where: { testId: existing.id } });
        await prisma.summativeTest.delete({ where: { id: existing.id } });
      }

      await prisma.summativeTest.create({
        data: {
          title: testTitle,
          learningArea: scale.learningArea,
          term: term as Term,
          academicYear: parseInt(String(academicYear)),
          grade: scale.grade,
          testDate: new Date(),
          totalMarks: 100,
          passMarks: 40,
          createdBy: userId,
          scaleId: scale.id,
          weight: parseFloat(String(weight)),
          status: 'PUBLISHED',
          published: true,
          active: true,
        },
      });
      testsCreated++;
    }
    logs.push(`✅ Summative tests created: ${testsCreated}`);

    await redisCacheService.deleteByPrefix('tests:');
    await redisCacheService.deleteByPrefix('grading:');

    res.json({ success: true, message: 'Complete setup successful', data: { scalesCreated, testsCreated, logs } });
  } catch (error: any) {
    throw new ApiError(500, error.message);
  }
};

/**
 * POST /api/assessments/setup/transition-demo
 * Creates clearly labelled synthetic baseline scores for existing Grade 7–9
 * learners. It never changes an existing result.
 */
export const seedTransitionDemoScores = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'User ID required');

  const academicYear = Number(req.body?.academicYear || new Date().getFullYear());
  const term = (req.body?.term || 'TERM_1') as Term;
  const grades = ['GRADE_7', 'GRADE_8', 'GRADE_9'];
  const learners = await prisma.learner.findMany({
    where: { grade: { in: grades }, archived: false },
    select: { id: true, admissionNumber: true, grade: true },
  });

  let testsCreated = 0;
  let scoresCreated = 0;
  const scoreFor = (learnerId: string, area: string) => {
    const value = `${learnerId}:${area}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 58 + (value % 35);
  };

  for (const grade of grades) {
    const gradeLearners = learners.filter((learner) => learner.grade === grade);
    if (!gradeLearners.length) continue;

    for (const learningArea of LEARNING_AREAS_CONFIG[grade]) {
      const title = `Local demo transition baseline — ${learningArea}`;
      let test = await prisma.summativeTest.findFirst({
        where: { grade, learningArea, term, academicYear, title, archived: false },
      });
      if (!test) {
        test = await prisma.summativeTest.create({
          data: {
            title,
            learningArea,
            grade,
            term,
            academicYear,
            testDate: new Date(),
            totalMarks: 100,
            passMarks: 40,
            createdBy: userId,
            status: 'PUBLISHED',
            published: true,
            active: true,
            testType: 'ASSESSMENT',
            description: 'Synthetic local-demo data for the Junior Transition Centre.',
          },
        });
        testsCreated++;
      }

      const existingResults = await prisma.summativeResult.findMany({
        where: { testId: test.id, learnerId: { in: gradeLearners.map((learner) => learner.id) } },
        select: { learnerId: true },
      });
      const existingLearnerIds = new Set(existingResults.map((result) => result.learnerId));
      const rows = gradeLearners
        .filter((learner) => !existingLearnerIds.has(learner.id))
        .map((learner) => {
          const marks = scoreFor(learner.id, learningArea);
          return {
            testId: test.id,
            learnerId: learner.id,
            marksObtained: marks,
            rawScore: marks,
            percentage: marks,
            grade: marks >= 80 ? 'A' : marks >= 60 ? 'B' : 'C',
            remarks: 'Synthetic local-demo transition baseline score.',
            recordedBy: userId,
          };
        });
      if (rows.length) {
        await prisma.summativeResult.createMany({ data: rows, skipDuplicates: true });
        scoresCreated += rows.length;
      }
    }
  }

  await redisCacheService.deleteByPrefix('tests:');
  await redisCacheService.deleteByPrefix('grading:');
  res.json({ success: true, message: 'Local transition demo scores seeded', data: { learners: learners.length, testsCreated, scoresCreated } });
};

/**
 * POST /api/assessments/setup/reset
 */
export const resetAssessments = async (req: AuthRequest, res: Response) => {
  try {
    const { summativeTests = false, formativeAssessments = false, gradingScales = false, assessmentAudits = false } = req.body;
    const results: Record<string, number> = {};

    if (summativeTests) {
      const srh = await prisma.summativeResultHistory.deleteMany();
      const sr  = await prisma.summativeResult.deleteMany();
      const st  = await prisma.summativeTest.deleteMany();
      results.summativeTestsDeleted    = st.count;
      results.summativeResultsDeleted  = sr.count;
      results.summativeHistoryDeleted  = srh.count;
    }

    if (formativeAssessments) {
      const fa = await prisma.formativeAssessment.deleteMany();
      results.formativeAssessmentsDeleted = fa.count;
    }

    if (gradingScales) {
      await prisma.gradingRange.deleteMany();
      const gs = await prisma.gradingSystem.deleteMany();
      const sg = await prisma.scaleGroup.deleteMany();
      results.gradingScalesDeleted = gs.count;
      results.scaleGroupsDeleted   = sg.count;
    }

    if (assessmentAudits) {
      const sa = await prisma.assessmentSmsAudit.deleteMany();
      results.smsAuditsDeleted = sa.count;
    }

    await redisCacheService.clear();

    res.json({ success: true, message: 'Selective reset completed', data: results });
  } catch (error: any) {
    throw new ApiError(500, error.message);
  }
};

export default { bulkCreateGradingScales, bulkCreateSummativeTests, completeSchoolSetup, seedTransitionDemoScores, resetAssessments };
