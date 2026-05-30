import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import { seedSeniorOfficialCatalog } from '../services/senior-pathway-catalog.seed';
import { validateSeniorPathwaySelection } from '../services/senior-pathway-rule-engine.service';
import { previewLegacyPathwaySelection } from '../services/legacy-pathway-selection-adapter.service';

const resolveSchoolId = (req: AuthRequest) => req.school?.id || null;
const resolveUserId = (req: AuthRequest) => req.user?.userId || null;
const SENIOR_PATHWAY_CODES = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];

const resolveRequiredSchoolId = (req: AuthRequest) => {
  const schoolId = String(req.body?.schoolId || req.query?.schoolId || resolveSchoolId(req) || '').trim();
  if (!schoolId) throw new ApiError(400, 'School context is required to configure Senior School offerings');
  return schoolId;
};

const officialLearningAreaSelect = {
  id: true,
  officialCode: true,
  officialName: true,
  subjectType: true,
  examinable: true,
  pathwayId: true,
  trackId: true,
  pathway: { select: { id: true, code: true, name: true } },
  track: { select: { id: true, code: true, name: true } },
} as const;

const getActiveSchoolOfferings = async (schoolId: string) =>
  prisma.schoolLearningAreaOffering.findMany({
    where: { schoolId, active: true },
    select: {
      id: true,
      schoolId: true,
      active: true,
      capacity: true,
      teacherCount: true,
      notes: true,
      officialLearningArea: { select: officialLearningAreaSelect },
    },
    orderBy: { createdAt: 'asc' },
  });

const buildValidationInput = (req: AuthRequest) => ({
  learnerId: String(req.body.learnerId || ''),
  schoolId: req.body.schoolId ?? resolveSchoolId(req),
  selectionId: req.body.selectionId ?? null,
  pathwayId: String(req.body.pathwayId || ''),
  trackId: req.body.trackId ? String(req.body.trackId) : null,
  combinationRuleId: req.body.combinationRuleId ? String(req.body.combinationRuleId) : null,
  compulsorySubjectIds: Array.isArray(req.body.compulsorySubjectIds) ? req.body.compulsorySubjectIds.map(String) : [],
  optionalSubjectIds: Array.isArray(req.body.optionalSubjectIds) ? req.body.optionalSubjectIds.map(String) : [],
  supportSubjectIds: Array.isArray(req.body.supportSubjectIds) ? req.body.supportSubjectIds.map(String) : [],
  strictSchoolOfferings: Boolean(req.body.strictSchoolOfferings),
});

export const seniorPathwayController = {
  seedCatalog: async (_req: AuthRequest, res: Response) => {
    const result = await seedSeniorOfficialCatalog(prisma as any);
    res.json({ success: true, message: 'Senior School official catalog seeded', data: result });
  },

  getCatalog: async (_req: AuthRequest, res: Response) => {
    const [pathways, coreSubjects, supportSubjects] = await Promise.all([
      prisma.pathway.findMany({
        where: { code: { in: SENIOR_PATHWAY_CODES }, active: true },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          tracks: {
            where: { active: true },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              officialLearningAreas: {
                where: { active: true },
                select: { id: true, officialCode: true, officialName: true, subjectType: true, examinable: true },
                orderBy: { officialName: 'asc' },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
      }),
      prisma.officialLearningArea.findMany({
        where: { subjectType: 'EXAMINABLE_CORE', active: true },
        select: { id: true, officialCode: true, officialName: true, subjectType: true, examinable: true },
        orderBy: { officialName: 'asc' },
      }),
      prisma.officialLearningArea.findMany({
        where: { subjectType: { in: ['SUPPORT_SUBJECT', 'NON_EXAMINABLE'] as any }, active: true },
        select: { id: true, officialCode: true, officialName: true, subjectType: true, examinable: true },
        orderBy: { officialName: 'asc' },
      }),
    ]);

    res.json({ success: true, data: { pathways, coreSubjects, supportSubjects } });
  },

  getCombinations: async (req: AuthRequest, res: Response) => {
    const { pathwayId, trackId } = req.query;
    const rules = await prisma.subjectCombinationRule.findMany({
      where: {
        active: true,
        ...(pathwayId ? { pathwayId: String(pathwayId) } : {}),
        ...(trackId ? { trackId: String(trackId) } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        officialSource: true,
        pathway: { select: { id: true, code: true, name: true } },
        track: { select: { id: true, code: true, name: true } },
        items: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            officialLearningArea: {
              select: { id: true, officialCode: true, officialName: true, subjectType: true, pathwayId: true, trackId: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: rules });
  },

  getSchoolOfferings: async (req: AuthRequest, res: Response) => {
    const schoolId = resolveRequiredSchoolId(req);
    const offerings = await prisma.schoolLearningAreaOffering.findMany({
      where: {
        schoolId,
        active: true,
      },
      select: {
        id: true,
        schoolId: true,
        active: true,
        capacity: true,
        teacherCount: true,
        notes: true,
        officialLearningArea: { select: officialLearningAreaSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: offerings });
  },

  updateSchoolOfferings: async (req: AuthRequest, res: Response) => {
    const schoolId = resolveRequiredSchoolId(req);
    const rawIds: unknown[] = Array.isArray(req.body?.officialLearningAreaIds)
      ? req.body.officialLearningAreaIds
      : Array.isArray(req.body?.subjectIds)
        ? req.body.subjectIds
        : [];

    const officialLearningAreaIds: string[] = Array.from(
      new Set(
        rawIds
          .map((id) => String(id ?? '').trim())
          .filter((id): id is string => id.length > 0)
      )
    );

    const validAreas = officialLearningAreaIds.length
      ? await prisma.officialLearningArea.findMany({
          where: {
            id: { in: officialLearningAreaIds },
            active: true,
            OR: [
              { pathway: { code: { in: SENIOR_PATHWAY_CODES } } },
              { pathwayId: null },
            ],
          },
          select: { id: true },
        })
      : [];

    const validIds = new Set(validAreas.map((area) => area.id));
    const missingIds = officialLearningAreaIds.filter((id) => !validIds.has(id));
    if (missingIds.length) {
      throw new ApiError(400, `Invalid Senior School subject id(s): ${missingIds.join(', ')}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.schoolLearningAreaOffering.updateMany({
        where: { schoolId },
        data: { active: false },
      });

      for (const officialLearningAreaId of officialLearningAreaIds) {
        await tx.schoolLearningAreaOffering.upsert({
          where: { schoolId_officialLearningAreaId: { schoolId, officialLearningAreaId } },
          update: { active: true },
          create: { schoolId, officialLearningAreaId, active: true },
        });
      }
    });

    const offerings = await getActiveSchoolOfferings(schoolId);
    res.json({
      success: true,
      message: 'Senior School offerings updated',
      data: offerings,
    });
  },

  validateSelection: async (req: AuthRequest, res: Response) => {
    const result = await validateSeniorPathwaySelection(prisma as any, buildValidationInput(req));
    res.status(result.valid ? 200 : 400).json({ success: result.valid, data: result, message: result.valid ? 'Selection is valid' : 'Selection has validation errors' });
  },

  saveSelection: async (req: AuthRequest, res: Response) => {
    const input = buildValidationInput(req);
    const validation = await validateSeniorPathwaySelection(prisma as any, input);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Selection has validation errors', data: validation });
    }

    const selection = await prisma.$transaction(async (tx) => {
      const row = input.selectionId
        ? await tx.learnerPathwaySelection.update({
            where: { id: input.selectionId },
            data: {
              pathwayId: input.pathwayId,
              trackId: input.trackId,
              combinationRuleId: input.combinationRuleId,
              status: 'DRAFT',
            },
          })
        : await tx.learnerPathwaySelection.create({
            data: {
              learnerId: input.learnerId,
              pathwayId: input.pathwayId,
              trackId: input.trackId,
              combinationRuleId: input.combinationRuleId,
              status: 'DRAFT',
            },
          });

      await tx.learnerPathwaySelectionItem.deleteMany({ where: { selectionId: row.id } });

      const areas = await tx.officialLearningArea.findMany({
        where: { id: { in: [...input.compulsorySubjectIds, ...input.optionalSubjectIds, ...(input.supportSubjectIds || [])] } },
        select: { id: true, subjectType: true },
      });

      await tx.learnerPathwaySelectionItem.createMany({
        data: areas.map((area) => ({
          selectionId: row.id,
          officialLearningAreaId: area.id,
          subjectType: area.subjectType,
        })),
        skipDuplicates: true,
      });

      await tx.pathwaySelectionHistory.create({
        data: {
          selectionId: row.id,
          action: input.selectionId ? 'UPDATED_DRAFT' : 'CREATED_DRAFT',
          actorId: resolveUserId(req),
          snapshot: validation.normalizedSelection as any,
        },
      });

      return row;
    });

    res.json({ success: true, message: 'Draft pathway selection saved', data: { selection, validation } });
  },

  getLearnerSelection: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const selection = await prisma.learnerPathwaySelection.findFirst({
      where: { learnerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        pathway: { select: { id: true, code: true, name: true } },
        track: { select: { id: true, code: true, name: true } },
        combinationRule: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            officialLearningArea: {
              select: { id: true, officialCode: true, officialName: true, subjectType: true, examinable: true },
            },
          },
        },
        approvals: true,
      },
    });
    res.json({ success: true, data: selection });
  },

  submitSelection: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const row = await prisma.learnerPathwaySelection.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });
    await prisma.pathwaySelectionHistory.create({
      data: { selectionId: id, action: 'SUBMITTED', actorId: resolveUserId(req), reason: req.body?.reason ?? null },
    });
    res.json({ success: true, message: 'Selection submitted for review', data: row });
  },

  approveSelection: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const approverRole = String(req.body?.approverRole || req.user?.role || 'ADMIN');
    const comment = req.body?.comment ? String(req.body.comment) : null;
    const [row] = await prisma.$transaction([
      prisma.learnerPathwaySelection.update({ where: { id }, data: { status: 'APPROVED' } }),
      prisma.pathwayApproval.create({
        data: {
          selectionId: id,
          approverRole,
          approverId: resolveUserId(req),
          status: 'APPROVED',
          comment,
          approvedAt: new Date(),
        },
      }),
      prisma.pathwaySelectionHistory.create({
        data: { selectionId: id, action: 'APPROVED', actorId: resolveUserId(req), reason: comment },
      }),
    ]);
    res.json({ success: true, message: 'Selection approved', data: row });
  },

  lockSelection: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const existing = await prisma.learnerPathwaySelection.findUnique({ where: { id }, select: { id: true, status: true, locked: true } });
    if (!existing) throw new ApiError(404, 'Selection not found');
    if (existing.locked) throw new ApiError(409, 'Selection is already locked');

    const row = await prisma.learnerPathwaySelection.update({
      where: { id },
      data: {
        status: 'LOCKED',
        locked: true,
        lockedAt: new Date(),
        lockedBy: resolveUserId(req),
      },
    });
    await prisma.pathwaySelectionHistory.create({
      data: { selectionId: id, action: 'LOCKED', actorId: resolveUserId(req), reason: req.body?.reason ?? null },
    });
    res.json({ success: true, message: 'Selection locked', data: row });
  },

  getSelectionHistory: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const history = await prisma.pathwaySelectionHistory.findMany({
      where: { selectionId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: history });
  },

  previewLegacySelection: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const preview = await previewLegacyPathwaySelection(prisma as any, learnerId);
    res.json({ success: true, data: preview });
  },
};
