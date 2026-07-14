import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { configService } from '../services/config.service';
import { calculationService } from '../services/calculation.service';
import { Term, FormativeAssessmentType, Grade } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { getInstitutionType } from '../utils/institutionNormalizer';

// Helper to safely parse dates
const safeParseDate = (dateVal: any, defaultDate: Date): Date => {
  if (!dateVal) return defaultDate;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? defaultDate : d;
};

const generateClassCode = async (): Promise<string> => {
  const existingCodes = await prisma.class.findMany({
    where: { classCode: { startsWith: 'CLS-' } },
    select: { classCode: true },
  });

  const maxNumber = existingCodes.reduce((max, item) => {
    const match = /^CLS-(\d+)$/.exec(item.classCode || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  let counter = maxNumber + 1;
  while (true) {
    const classCode = `CLS-${String(counter).padStart(5, '0')}`;
    const existing = await prisma.class.findUnique({
      where: { classCode },
      select: { id: true },
    });

    if (!existing) return classCode;
    counter++;
  }
};

const GRADE_OPTIONS = [
  'PLAYGROUP', 'PP1', 'PP2',
  'GRADE_1', 'GRADE_2', 'GRADE_3',
  'GRADE_4', 'GRADE_5', 'GRADE_6',
  'GRADE_7', 'GRADE_8', 'GRADE_9',
];

const SS_GRADE_OPTIONS = ['GRADE_10', 'GRADE_11', 'GRADE_12'];

export const getTermConfigs = async (req: Request, res: Response) => {
  const configs = await configService.getTermConfigs();
  res.json({ success: true, data: configs });
};

export const getSpecificTermConfig = async (req: Request, res: Response) => {
  const { term, year } = req.params;
  const config = await configService.getTermConfig({
    term: term as Term,
    academicYear: parseInt(year),
  });
  res.json({ success: true, data: config });
};

export const getActiveTermConfig = async (req: Request, res: Response) => {
  const config = await configService.getActiveTermConfig();
  if (!config) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const inferredTerm: Term = month <= 4 ? 'TERM_1' : month <= 8 ? 'TERM_2' : 'TERM_3';
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31);

    return res.json({
      success: true,
      data: {
        id: null,
        term: inferredTerm,
        academicYear: now.getFullYear(),
        startDate,
        endDate,
        formativeWeight: 30,
        summativeWeight: 70,
        isActive: false,
        isFallback: true,
        message: 'No active term configuration found. Using system fallback.'
      }
    });
  }
  res.json({ success: true, data: { ...config, isFallback: false } });
};

export const upsertTermConfig = async (req: AuthRequest, res: Response) => {
  const { academicYear, term, startDate, endDate, formativeWeight, summativeWeight, isActive } = req.body;

  const fw = formativeWeight != null ? parseFloat(formativeWeight) : 30.0;
  const sw = summativeWeight != null ? parseFloat(summativeWeight) : 70.0;

  const config = await configService.upsertTermConfig({
    academicYear: parseInt(academicYear),
    term,
    startDate: safeParseDate(startDate, new Date()),
    endDate: safeParseDate(endDate, new Date()),
    formativeWeight: fw,
    summativeWeight: sw,
    isActive: Boolean(isActive),
    createdBy: req.user!.userId,
  });
  res.json({ success: true, data: config });
};

export const updateTermConfig = async (req: Request, res: Response) => {
  const { id } = req.params;
  const config = await configService.updateTermConfig(id, req.body);
  res.json({ success: true, data: config });
};

export const getAggregationConfigs = async (req: Request, res: Response) => {
  const configs = await configService.getAggregationConfigs();
  res.json({ success: true, data: configs });
};

export const getSpecificAggregationConfig = async (req: Request, res: Response) => {
  const { assessmentType } = req.params;
  const { grade, learningArea } = req.query;
  const config = await configService.getAggregationConfig({
    assessmentType: assessmentType as FormativeAssessmentType,
    grade: grade as unknown as Grade | undefined,
    learningArea: learningArea as string | undefined,
  });
  res.json({ success: true, data: config });
};

export const createAggregationConfig = async (req: AuthRequest, res: Response) => {
  const config = await configService.createAggregationConfig({
    ...req.body,
    createdBy: req.user!.userId,
  });
  res.status(201).json({ success: true, data: config });
};

export const updateAggregationConfig = async (req: Request, res: Response) => {
  const config = await configService.updateAggregationConfig(req.params.id, req.body);
  res.json({ success: true, data: config });
};

export const deleteAggregationConfig = async (req: Request, res: Response) => {
  await configService.deleteAggregationConfig(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};

export const getStreamConfigs = async (req: Request, res: Response) => {
  const configs = await configService.getStreamConfigs();
  res.json({ success: true, data: configs });
};

export const upsertStreamConfig = async (req: AuthRequest, res: Response) => {
  const config = await configService.upsertStreamConfig(req.body);
  res.json({ success: true, data: config });
};

export const deleteStreamConfig = async (req: Request, res: Response) => {
  await configService.deleteStreamConfig(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};

export const getClasses = async (req: AuthRequest, res: Response) => {
  const institutionType = getInstitutionType(req) as 'PRIMARY_CBC' | 'SECONDARY';
  const classes = await configService.getClasses(institutionType);
  res.json({ success: true, data: classes });
};

export const upsertClass = async (req: AuthRequest, res: Response) => {
  const cls = await configService.upsertClass({ ...req.body });
  res.json({ success: true, data: cls });
};

export const deleteClass = async (req: Request, res: Response) => {
  await configService.deleteClass(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};

export const getGrades = async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const institutionType = getInstitutionType(r) as 'PRIMARY_CBC' | 'SECONDARY';
  res.json({ success: true, data: institutionType === 'SECONDARY' ? SS_GRADE_OPTIONS : GRADE_OPTIONS });
};

export const getConfigurationSummary = async (req: Request, res: Response) => {
  const activeTerm = await configService.getActiveTermConfig();
  const students = await prisma.learner.count({ where: { status: 'ACTIVE' } });
  const classes = await prisma.class.count({ where: { archived: false } });
  res.json({ success: true, data: { activeTerm, stats: { students, classes } } });
};

export const getAvailableStrategies = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'SIMPLE_AVERAGE', name: 'Simple Average', description: 'Calculates the mean of all scores' },
      { id: 'BEST_N', name: 'Best N Scores', description: 'Takes the top N scores' },
      { id: 'DROP_LOWEST_N', name: 'Drop Lowest N', description: 'Excludes the bottom N scores' },
    ],
  });
};

export const recalculateClassScores = async (req: Request, res: Response) => {
  const { classId, term, academicYear } = req.body;
  await calculationService.recalculateClassScores({ classId, term, academicYear });
  res.json({ success: true, message: 'Recalculation started' });
};

export const seedStreams = async (req: Request, res: Response) => {
  const streams = ['A', 'B', 'C', 'D'];
  for (const s of streams) await configService.upsertStreamConfig({ name: s });
  res.json({ success: true, message: 'Streams seeded' });
};

export const seedClasses = async (req: AuthRequest, res: Response) => {
  const institutionType = getInstitutionType(req) as 'PRIMARY_CBC' | 'SECONDARY';
  const year = new Date().getFullYear();
  const term: Term = 'TERM_1';
  const grades =
    institutionType === 'SECONDARY'
      ? (['GRADE10', 'GRADE11', 'GRADE12'] as const)
      : ([
          'PLAYGROUP',
          'PP1',
          'PP2',
          'GRADE_1',
          'GRADE_2',
          'GRADE_3',
          'GRADE_4',
          'GRADE_5',
          'GRADE_6',
          'GRADE_7',
          'GRADE_8',
          'GRADE_9',
        ] as const);

  const results = [];
  let skipped = 0;
  const classesByGrade = new Map<string, string>();
  for (const grade of grades) {
    const stream = 'A';
    const name =
      institutionType === 'SECONDARY'
        ? `Grade ${String(grade).replace('GRADE', '')} ${stream}`
        : `${String(grade).replace('_', ' ')} ${stream}`;

    const existing = await prisma.class.findFirst({
      where: { institutionType, grade, stream, academicYear: year, term },
    });

    if (!existing) {
      const classCode = await generateClassCode();

      const newClass = await prisma.class.create({
        data: { classCode, name, grade, institutionType, stream, academicYear: year, term, active: true },
      });
      results.push(newClass);
      classesByGrade.set(grade, newClass.id);
    } else {
      skipped++;
      classesByGrade.set(grade, existing.id);
    }
  }

  // A seeded class structure should be immediately useful. Attach only eligible
  // learners who have no active class enrollment; existing class assignments are
  // intentionally preserved.
  const eligibleLearners = await prisma.learner.findMany({
    where: { grade: { in: [...grades] }, archived: false },
    select: { id: true, grade: true },
  });
  const existingEnrollmentRows = eligibleLearners.length
    ? await prisma.classEnrollment.findMany({
        where: { learnerId: { in: eligibleLearners.map((learner) => learner.id) }, active: true },
        select: { learnerId: true },
      })
    : [];
  const enrolledLearnerIds = new Set(existingEnrollmentRows.map((enrollment) => enrollment.learnerId));
  const enrollmentRows = eligibleLearners
    .filter((learner) => !enrolledLearnerIds.has(learner.id))
    .map((learner) => ({ classId: classesByGrade.get(learner.grade), learnerId: learner.id }))
    .filter((enrollment): enrollment is { classId: string; learnerId: string } => Boolean(enrollment.classId));

  if (enrollmentRows.length) {
    await prisma.classEnrollment.createMany({ data: enrollmentRows, skipDuplicates: true });
  }

  res.json({
    success: true,
    message: `Seeded ${results.length} classes for ${institutionType} — ${year} ${term}`,
    created: results.length,
    skipped,
    enrolled: enrollmentRows.length,
    data: results,
  });
};

export const configController = {
  getTermConfigs,
  getSpecificTermConfig,
  getActiveTermConfig,
  upsertTermConfig,
  updateTermConfig,
  getAggregationConfigs,
  getSpecificAggregationConfig,
  createAggregationConfig,
  updateAggregationConfig,
  deleteAggregationConfig,
  getStreamConfigs,
  upsertStreamConfig,
  deleteStreamConfig,
  getClasses,
  upsertClass,
  deleteClass,
  getGrades,
  getConfigurationSummary,
  getAvailableStrategies,
  recalculateClassScores,
  seedStreams,
  seedClasses,
};
