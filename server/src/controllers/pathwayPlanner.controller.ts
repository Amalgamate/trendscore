/**
 * pathwayPlanner.controller.ts
 *
 * Pathway Planner module — Phase 2, 3 & 4 endpoints.
 *
 * Covers:
 *   Phase 2 — Counsellor notes + selection unlock
 *   Phase 3 — Student-initiated LearnerPathwaySelection
 *   Phase 4 — Senior school catalogue + learner school preferences
 *
 * All learner-scoped endpoints enforce:
 *   STUDENT  → self only
 *   PARENT   → own children only (via parentAccessService)
 *   Staff    → unrestricted
 */

import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { parentAccessService } from '../services/parent-access.service';
import { validateSeniorPathwaySelection } from '../services/senior-pathway-rule-engine.service';
import { NotificationService, NotificationType } from '../services/notification.service';
import { assertLearnerPathwayAccess } from '../middleware/pathwayAccess.middleware';
import {
  normalizeCounsellorNoteVisibility,
  readableCounsellorNoteVisibilities,
} from '../services/counsellor-note-visibility.service';
import { schoolMatchingService } from '../services/school-matching.service';

// ─── Notification helpers (fire-and-forget) ───────────────────────────────────

async function notifyLearnerAndParent(
  learnerId: string,
  title: string,
  message: string,
  link = '/app/student-pathway-planner',
  audience: { student?: boolean; parent?: boolean } = { student: true, parent: true },
) {
  try {
    // Resolve the learner's student user account (username = admissionNumber)
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { admissionNumber: true, parentId: true },
    });
    if (!learner) return;

    const studentUser = learner.admissionNumber
      ? await prisma.user.findUnique({
          where: { username: learner.admissionNumber },
          select: { id: true },
        })
      : null;

    const targets: string[] = [
      ...(audience.student && studentUser ? [studentUser.id] : []),
      ...(audience.parent && learner.parentId ? [learner.parentId] : []),
    ];

    await Promise.allSettled(
      targets.map(userId =>
        NotificationService.createNotification({ userId, title, message, type: NotificationType.INFO, link })
      )
    );
  } catch {
    // Notifications are non-critical — never block the main operation
  }
}

// ─── Ownership helper ─────────────────────────────────────────────────────────
async function assertAccess(req: AuthRequest, learnerId: string): Promise<void> {
  const role   = req.user?.role ?? '';
  const userId = req.user?.userId;
  if (role === 'STUDENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const self = user?.username
      ? await prisma.learner.findUnique({ where: { admissionNumber: user.username }, select: { id: true } })
      : null;
    if (!self || self.id !== learnerId) throw new ApiError(403, 'Access denied: not your own record');
    return;
  }
  if (role === 'PARENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const ids = await parentAccessService.getAccessibleLearnerIds(userId);
    if (!ids.includes(learnerId)) throw new ApiError(403, 'Access denied: not your child');
    return;
  }
}

const isCounsellor = (role: string) =>
  ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(role);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Counsellor notes
// ─────────────────────────────────────────────────────────────────────────────

export const getCounsellorNotes = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertLearnerPathwayAccess(req, learnerId);
  const readableVisibilities = readableCounsellorNoteVisibilities(req.user);
  const notes = await prisma.counsellorNote.findMany({
    where: {
      learnerId,
      ...(readableVisibilities ? { visibility: { in: readableVisibilities } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });
  res.json({ success: true, data: notes });
};

export const addCounsellorNote = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  const { note, noteType, visibility: rawVisibility } = req.body as {
    note?: string;
    noteType?: string;
    visibility?: string;
  };
  const role   = req.user?.role ?? '';
  const userId = req.user?.userId;

  if (!isCounsellor(role)) throw new ApiError(403, 'Only counsellors and admins can add pathway notes');
  if (!userId) throw new ApiError(401, 'Authentication required');
  if (!note?.trim()) throw new ApiError(400, 'Note text is required');
  const visibility = normalizeCounsellorNoteVisibility(rawVisibility);

  const learner = await prisma.learner.findUnique({ where: { id: learnerId }, select: { id: true } });
  if (!learner) throw new ApiError(404, 'Learner not found');

  const row = await prisma.counsellorNote.create({
    data: {
      learnerId,
      authorId:   userId,
      authorRole: role,
      note:       note.trim(),
      noteType:   noteType || 'GENERAL',
      visibility,
    },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });

  // Private and school-team notes must not leak their existence to family
  // accounts. Shared notes notify only the audience authorized to read them.
  const audience = visibility === 'SHARED_WITH_STUDENT'
    ? { student: true, parent: false }
    : visibility === 'SHARED_WITH_PARENT'
      ? { student: false, parent: true }
      : null;
  if (audience) {
    void notifyLearnerAndParent(
      learnerId,
      'New counsellor note',
      `${row.author.firstName} ${row.author.lastName} added a ${noteType || 'GENERAL'} note to the pathway plan.`,
      '/app/student-pathway-planner',
      audience,
    );
  }

  res.status(201).json({ success: true, data: row });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Selection unlock (counsellor grants student ability to self-select)
// ─────────────────────────────────────────────────────────────────────────────

export const getSelectionUnlock = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertAccess(req, learnerId);
  const row = await prisma.pathwaySelectionUnlock.findUnique({ where: { learnerId } });
  res.json({ success: true, data: { unlocked: !!row, unlockedAt: row?.unlockedAt ?? null, notes: row?.notes ?? null } });
};

export const unlockSelection = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  const { notes } = req.body as { notes?: string };
  const role   = req.user?.role ?? '';
  const userId = req.user?.userId;

  if (!isCounsellor(role)) throw new ApiError(403, 'Only counsellors can unlock selection');
  if (!userId) throw new ApiError(401, 'Authentication required');

  const learner = await prisma.learner.findUnique({ where: { id: learnerId }, select: { id: true } });
  if (!learner) throw new ApiError(404, 'Learner not found');

  const row = await prisma.pathwaySelectionUnlock.upsert({
    where:  { learnerId },
    update: { unlockedBy: userId, unlockedAt: new Date(), notes: notes ?? null },
    create: { learnerId, unlockedBy: userId, notes: notes ?? null },
  });

  // Notify learner + parent (fire-and-forget)
  void notifyLearnerAndParent(
    learnerId,
    'Subject selection unlocked',
    'Your counsellor has unlocked subject selection. You can now choose your subject combination from the Pathway Planner.',
  );

  res.json({ success: true, data: row });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Student-initiated pathway selection
// ─────────────────────────────────────────────────────────────────────────────

export const submitStudentSelection = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  const role   = req.user?.role ?? '';
  const userId = req.user?.userId;

  // Students must be unlocked. Staff can always save.
  if (role === 'STUDENT') {
    await assertAccess(req, learnerId);
    const unlock = await prisma.pathwaySelectionUnlock.findUnique({ where: { learnerId } });
    if (!unlock) throw new ApiError(403, 'Your teacher or counsellor has not yet unlocked subject selection for you');
  } else {
    await assertAccess(req, learnerId);
  }

  const schoolId = req.school?.id ?? null;
  const body = req.body as {
    pathwayId: string;
    trackId?: string;
    combinationRuleId?: string;
    compulsorySubjectIds?: string[];
    optionalSubjectIds?: string[];
    supportSubjectIds?: string[];
    selectionId?: string;
  };

  if (!body.pathwayId) throw new ApiError(400, 'pathwayId is required');

  // Validate using the existing rule engine
  const validation = await validateSeniorPathwaySelection(prisma as any, {
    learnerId,
    schoolId,
    selectionId:           body.selectionId ?? null,
    pathwayId:             body.pathwayId,
    trackId:               body.trackId ?? null,
    combinationRuleId:     body.combinationRuleId ?? null,
    compulsorySubjectIds:  body.compulsorySubjectIds ?? [],
    optionalSubjectIds:    body.optionalSubjectIds ?? [],
    supportSubjectIds:     body.supportSubjectIds ?? [],
    strictSchoolOfferings: false, // soft check for student-initiated
  });

  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Selection has validation errors', data: validation });
  }

  const selection = await prisma.$transaction(async (tx) => {
    const row = body.selectionId
      ? await tx.learnerPathwaySelection.update({
          where: { id: body.selectionId },
          data: {
            pathwayId:         body.pathwayId,
            trackId:           body.trackId ?? null,
            combinationRuleId: body.combinationRuleId ?? null,
            status:            'SUBMITTED',
          },
        })
      : await tx.learnerPathwaySelection.create({
          data: {
            learnerId,
            pathwayId:         body.pathwayId,
            trackId:           body.trackId ?? null,
            combinationRuleId: body.combinationRuleId ?? null,
            status:            'SUBMITTED',
          },
        });

    await tx.learnerPathwaySelectionItem.deleteMany({ where: { selectionId: row.id } });

    const allSubjectIds = [
      ...(body.compulsorySubjectIds ?? []),
      ...(body.optionalSubjectIds ?? []),
      ...(body.supportSubjectIds ?? []),
    ];
    const areas = await tx.officialLearningArea.findMany({
      where: { id: { in: allSubjectIds } },
      select: { id: true, subjectType: true },
    });
    await tx.learnerPathwaySelectionItem.createMany({
      data: areas.map((a) => ({ selectionId: row.id, officialLearningAreaId: a.id, subjectType: a.subjectType })),
      skipDuplicates: true,
    });

    await tx.pathwaySelectionHistory.create({
      data: {
        selectionId: row.id,
        action:      body.selectionId ? 'STUDENT_UPDATED' : 'STUDENT_SUBMITTED',
        actorId:     userId ?? null,
        snapshot:    validation.normalizedSelection as any,
      },
    });

    return row;
  });

  // Notify counsellors that a student submitted (fire-and-forget)
  void NotificationService.notifyRoles(
    ['HEAD_OF_CURRICULUM', 'HEAD_TEACHER', 'ADMIN'],
    {
      title:   'Student pathway selection submitted',
      message: 'A learner submitted a subject combination for review.',
      type:    NotificationType.INFO,
      link:    '/app/sec-pathway-counsellor',
    }
  ).catch(() => {});

  res.status(201).json({ success: true, data: { selection, validation } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Senior school catalogue
// ─────────────────────────────────────────────────────────────────────────────

export const searchSeniorSchools = async (req: AuthRequest, res: Response) => {
  const { query, county, category, schoolType, gender, pathway, track, combination, verificationStatus, affordabilityBand, page = '1', limit = '20' } = req.query as Record<string, string>;
  const pageNumber = Math.max(1, Number.parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit) || 20));
  const skip = (pageNumber - 1) * pageSize;

  const where: any = { active: true };
  if (query) where.OR = [
    { name: { contains: query, mode: 'insensitive' } },
    { county: { contains: query, mode: 'insensitive' } },
    { knecCode: { contains: query, mode: 'insensitive' } },
  ];
  if (county)     where.county     = { contains: county, mode: 'insensitive' };
  if (category)   where.category   = category;
  if (schoolType) where.schoolType = schoolType;
  if (gender)     where.gender     = gender;
  if (pathway)    where.pathwayCodes = { has: pathway };
  if (track)      where.trackCodes = { has: track };
  if (combination) where.combinationCodes = { has: combination };
  if (verificationStatus) where.verificationStatus = verificationStatus;
  if (affordabilityBand) where.affordabilityBand = affordabilityBand;

  const [schools, total] = await Promise.all([
    prisma.seniorSchool.findMany({
      where, skip, take: pageSize,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.seniorSchool.count({ where }),
  ]);

  res.json({ success: true, data: schools, pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Learner school preferences (shortlist)
// ─────────────────────────────────────────────────────────────────────────────

export const getSchoolPreferences = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertAccess(req, learnerId);
  const prefs = await prisma.learnerSchoolPreference.findMany({
    where:   { learnerId },
    orderBy: { rank: 'asc' },
    include: { school: true },
  });
  res.json({ success: true, data: prefs });
};

export const saveSchoolPreferences = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  const role   = req.user?.role ?? '';
  await assertAccess(req, learnerId);

  const preferences = req.body?.preferences as Array<{ schoolId: string; rank: number; notes?: string }>;
  if (!Array.isArray(preferences)) throw new ApiError(400, 'preferences[] array is required');

  const source = role === 'PARENT' ? 'PARENT' : role === 'STUDENT' ? 'LEARNER' : 'COUNSELLOR';

  await prisma.$transaction(async (tx) => {
    // Remove existing preferences for this source
    await tx.learnerSchoolPreference.deleteMany({ where: { learnerId, source } });
    if (preferences.length) {
      await tx.learnerSchoolPreference.createMany({
        data: preferences.map((p) => ({
          learnerId,
          schoolId: p.schoolId,
          rank:     p.rank,
          notes:    p.notes ?? null,
          source,
        })),
        skipDuplicates: true,
      });
    }
  });

  const updated = await prisma.learnerSchoolPreference.findMany({
    where:   { learnerId },
    orderBy: { rank: 'asc' },
    include: { school: true },
  });
  res.json({ success: true, data: updated });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Full counsellor workbench summary for a learner
// Returns: learner profile + latest recommendation + selection + notes + unlock status
// ─────────────────────────────────────────────────────────────────────────────

export const getCounsellorSummary = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  const role = req.user?.role ?? '';
  if (!isCounsellor(role)) throw new ApiError(403, 'Only counsellors can access this endpoint');

  const [
    learner,
    latestRec,
    selection,
    notes,
    unlock,
    savedCareers,
    schoolPreferences,
    familyPreferences,
    parentComments,
  ] = await Promise.all([
    prisma.learner.findUnique({
      where:  { id: learnerId },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        grade: true, institutionType: true, photoUrl: true,
        pathway: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.learnerPathwayRecommendation.findFirst({
      where:   { learnerId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.learnerPathwaySelection.findFirst({
      where:   { learnerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        pathway:         { select: { id: true, code: true, name: true } },
        track:           { select: { id: true, code: true, name: true } },
        combinationRule: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            officialLearningArea: {
              select: { id: true, officialCode: true, officialName: true, subjectType: true },
            },
          },
        },
        approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),
    prisma.counsellorNote.findMany({
      where:   { learnerId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    }),
    prisma.pathwaySelectionUnlock.findUnique({ where: { learnerId } }),
    prisma.learnerCareerSave.findMany({
      where: { learnerId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { career: { select: { id: true, code: true, title: true } } },
    }),
    prisma.learnerSchoolPreference.findMany({
      where: { learnerId },
      orderBy: { rank: 'asc' },
      include: {
        school: {
          select: { id: true, name: true, county: true, schoolType: true, gender: true, verified: true },
        },
      },
    }),
    prisma.learnerSchoolSearchCriteria.findUnique({ where: { learnerId } }),
    prisma.parentComment.findMany({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  if (!learner) throw new ApiError(404, 'Learner not found');

  res.json({
    success: true,
    data: {
      learner,
      latestRecommendation: latestRec,
      selection,
      counsellorNotes: notes,
      selectionUnlocked: !!unlock,
      selectionUnlock:   unlock ?? null,
      evidence: {
        savedCareers,
        schoolPreferences,
        familyPreferences,
        parentComments,
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Class-level pathway distribution (counsellor / admin)
// ─────────────────────────────────────────────────────────────────────────────

export const getClassPathwayDistribution = async (req: AuthRequest, res: Response) => {
  const { classId } = req.params;
  const role = req.user?.role ?? '';
  if (!isCounsellor(role) && role !== 'TEACHER') throw new ApiError(403, 'Access denied');

  const classRecord = await prisma.class.findUnique({
    where:   { id: classId },
    include: { enrollments: { where: { active: true }, select: { learnerId: true } } },
  });
  if (!classRecord) throw new ApiError(404, 'Class not found');

  const learnerIds = classRecord.enrollments.map((e) => e.learnerId);

  const [recs, selections, decisionPlans, careerSaves, schoolPreferences, actionPlans, interventions] = await Promise.all([
    prisma.learnerPathwayRecommendation.findMany({
      where:   { learnerId: { in: learnerIds } },
      select:  { learnerId: true, recommendedPathway: true, confidenceScore: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['learnerId'],
    }),
    prisma.learnerPathwaySelection.findMany({
      where:   { learnerId: { in: learnerIds } },
      select:  { learnerId: true, status: true, pathwayId: true, pathway: { select: { code: true, name: true } }, track: { select: { name: true } }, combinationRule: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      distinct: ['learnerId'],
    }),
    prisma.decisionPlan.findMany({
      where: { learnerId: { in: learnerIds } },
      select: { learnerId: true, status: true, parentReviewedAt: true, counsellorReviewedAt: true },
    }),
    prisma.learnerCareerSave.findMany({
      where: { learnerId: { in: learnerIds }, supportStatus: { not: 'REMOVED' } },
      select: { learnerId: true }, distinct: ['learnerId'],
    }),
    prisma.learnerSchoolPreference.findMany({
      where: { learnerId: { in: learnerIds } },
      select: { learnerId: true }, distinct: ['learnerId'],
    }),
    prisma.learnerActionPlan.findMany({
      where: { learnerId: { in: learnerIds } },
      select: { learnerId: true, items: { select: { status: true } } },
    }),
    prisma.pathwayIntervention.findMany({
      where: { learnerId: { in: learnerIds } },
      select: { learnerId: true, status: true, priority: true, escalatedAt: true },
    }),
  ]);

  // Tally recommendations by pathway
  const recTally: Record<string, number> = {};
  const selTally: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, LOCKED: 0, NONE: 0 };
  recs.forEach((r) => { recTally[r.recommendedPathway] = (recTally[r.recommendedPathway] || 0) + 1; });
  const selByLearner = new Map(selections.map((s) => [s.learnerId, s]));
  learnerIds.forEach((id) => {
    const sel = selByLearner.get(id);
    selTally[sel?.status || 'NONE'] = (selTally[sel?.status || 'NONE'] || 0) + 1;
  });
  const decisionTally: Record<string, number> = {};
  decisionPlans.forEach((plan) => { decisionTally[plan.status] = (decisionTally[plan.status] || 0) + 1; });
  const submittedDecisionCount = decisionPlans.filter((plan) => plan.status !== 'DRAFT').length;
  const trackTally: Record<string, number> = {};
  const combinationTally: Record<string, number> = {};
  selections.forEach((selection) => {
    if (selection.track?.name) trackTally[selection.track.name] = (trackTally[selection.track.name] || 0) + 1;
    if (selection.combinationRule?.name) combinationTally[selection.combinationRule.name] = (combinationTally[selection.combinationRule.name] || 0) + 1;
  });
  const actionItems = actionPlans.flatMap((plan) => plan.items);
  const actionComplete = actionItems.filter((item) => item.status === 'COMPLETED').length;
  const openInterventions = interventions.filter((item) => !['RESOLVED', 'CANCELLED'].includes(item.status));
  const recommendationByLearner = new Map(recs.map((item) => [item.learnerId, item]));
  const pathwayMismatch = selections.filter((selection) => {
    const recommended = recommendationByLearner.get(selection.learnerId)?.recommendedPathway?.replace(/[^A-Z]/gi, '').toUpperCase();
    const selected = selection.pathway?.code?.replace(/[^A-Z]/gi, '').toUpperCase();
    return recommended && selected && recommended !== selected;
  }).length;

  res.json({
    success: true,
    data: {
      class:         { id: classRecord.id, name: classRecord.name, grade: classRecord.grade },
      learnerCount:  learnerIds.length,
      recommendations: recTally,
      selectionStatus: selTally,
      recommendationCoverage: recs.length,
      transitionReadiness: {
        recommendationReady: recs.length,
        careerExplored: careerSaves.length,
        schoolShortlisted: schoolPreferences.length,
        decisionSubmitted: submittedDecisionCount,
        parentReviewed: decisionPlans.filter((plan) => !!plan.parentReviewedAt).length,
        counsellorReviewed: decisionPlans.filter((plan) => !!plan.counsellorReviewedAt).length,
      },
      decisionStatus: decisionTally,
      seniorProgress: {
        tracks: trackTally,
        combinations: combinationTally,
        actionItems: { total: actionItems.length, completed: actionComplete },
        interventions: { open: openInterventions.length, escalated: openInterventions.filter((item) => !!item.escalatedAt).length, urgent: openInterventions.filter((item) => ['HIGH', 'URGENT'].includes(item.priority)).length },
        pathwayMismatch,
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN — Seed school catalogue
// ─────────────────────────────────────────────────────────────────────────────

export const seedSeniorSchools = async (req: AuthRequest, res: Response) => {
  const { seedSeniorSchoolCatalog } = await import('../services/senior-school-catalog.seed');
  const result = await seedSeniorSchoolCatalog(prisma as any);
  res.json({ success: true, message: 'Senior school catalogue seeded', data: result });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN / ADMIN — Upsert a single school record
// ─────────────────────────────────────────────────────────────────────────────

export const upsertSeniorSchool = async (req: AuthRequest, res: Response) => {
  const {
    id, name, knecCode, county, subCounty, schoolType, gender,
    category, pathwayCodes, trackCodes, combinationCodes, minimumKcpeGrade, website, phone, verified,
    verificationStatus, dataSource, affordabilityBand, facilities, specialNeedsSupport,
    latitude, longitude, faithAffiliation, active,
  } = req.body as Record<string, any>;

  if (!name || !county) throw new ApiError(400, 'name and county are required');

  const data = {
    name: String(name),
    county: String(county),
    subCounty:          subCounty  ? String(subCounty)  : null,
    schoolType:         schoolType ? String(schoolType) : 'DAY',
    gender:             gender     ? String(gender)     : 'MIXED',
    category:           category   ? String(category)   : null,
    pathwayCodes:       Array.isArray(pathwayCodes) ? pathwayCodes.map(String) : [],
    trackCodes:         Array.isArray(trackCodes) ? trackCodes.map(String) : [],
    combinationCodes:   Array.isArray(combinationCodes) ? combinationCodes.map(String) : [],
    minimumKcpeGrade:   minimumKcpeGrade != null ? Number(minimumKcpeGrade) : null,
    website:            website ? String(website) : null,
    phone:              phone   ? String(phone)   : null,
    verified:           Boolean(verified),
    verificationStatus: verificationStatus ? String(verificationStatus) : (verified ? 'TREND_SCORE_VERIFIED' : 'UNVERIFIED'),
    verifiedAt:         verified ? new Date() : null,
    dataSource:         dataSource ? String(dataSource) : null,
    affordabilityBand: affordabilityBand ? String(affordabilityBand) : null,
    facilities:         Array.isArray(facilities) ? facilities.map(String) : [],
    specialNeedsSupport: Array.isArray(specialNeedsSupport) ? specialNeedsSupport.map(String) : [],
    latitude:           latitude != null ? Number(latitude) : null,
    longitude:          longitude != null ? Number(longitude) : null,
    faithAffiliation:   faithAffiliation ? String(faithAffiliation) : null,
    active:             active == null ? true : Boolean(active),
  };

  const school = id
    ? await prisma.seniorSchool.update({ where: { id: String(id) }, data })
    : await prisma.seniorSchool.create({ data: knecCode ? { ...data, knecCode: String(knecCode) } : data });

  res.json({ success: true, data: school });
};


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Family search preferences (SPEC-002 / SPEC-004)
// Stored in LearnerSchoolSearchCriteria (model already exists).
// ─────────────────────────────────────────────────────────────────────────────

export const getFamilyPreferences = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertAccess(req, learnerId);
  const prefs = await prisma.learnerSchoolSearchCriteria.findUnique({ where: { learnerId } });
  res.json({ success: true, data: prefs ?? null });
};

export const saveFamilyPreferences = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertAccess(req, learnerId);

  const {
    budgetBand,
    boardingPreference,
    preferredCounties,
    faithPreference,
    notes,
    boardingRequired,
    countyRequired,
    requiredSupport,
  } = req.body as {
    budgetBand?: string;
    boardingPreference?: string;
    preferredCounties?: string[];
    faithPreference?: string;
    notes?: string;
    boardingRequired?: boolean;
    countyRequired?: boolean;
    requiredSupport?: string[];
  };

  const data = {
    budgetBand:         budgetBand         ?? null,
    boardingPreference: boardingPreference ?? null,
    preferredCounties:  Array.isArray(preferredCounties) ? preferredCounties : [],
    faithPreference:    faithPreference    ?? null,
    notes:              notes              ?? null,
    boardingRequired:   Boolean(boardingRequired),
    countyRequired:     Boolean(countyRequired),
    requiredSupport:    Array.isArray(requiredSupport) ? requiredSupport.map(String) : [],
  };

  const row = await prisma.learnerSchoolSearchCriteria.upsert({
    where:  { learnerId },
    update: data,
    create: { learnerId, ...data },
  });

  res.json({ success: true, data: row });
};

// ─────────────────────────────────────────────────────────────────────────────
// SPEC-004 — Explainable school matches, comparison, verification and corrections
// ─────────────────────────────────────────────────────────────────────────────

export const getSchoolMatches = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertLearnerPathwayAccess(req, learnerId);
  const matches = await schoolMatchingService.getMatches(learnerId);
  res.json({ success: true, data: matches });
};

export const recalculateSchoolMatches = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertLearnerPathwayAccess(req, learnerId);
  const result = await schoolMatchingService.recalculate(learnerId);
  res.json({ success: true, data: result });
};

export const compareSchoolMatches = async (req: AuthRequest, res: Response) => {
  const { learnerId } = req.params;
  await assertLearnerPathwayAccess(req, learnerId);
  const schoolIds = String(req.query.schoolIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const rows = await schoolMatchingService.compare(learnerId, schoolIds);
  res.json({ success: true, data: rows });
};

const CORRECTABLE_SCHOOL_FIELDS = new Set([
  'name', 'knecCode', 'county', 'subCounty', 'schoolType', 'gender', 'category',
  'pathwayCodes', 'trackCodes', 'combinationCodes', 'website', 'phone',
  'affordabilityBand', 'facilities', 'specialNeedsSupport', 'faithAffiliation',
]);

const serialiseSchoolValue = (value: unknown) => value == null ? null : (typeof value === 'string' ? value : JSON.stringify(value));

export const submitSchoolCorrection = async (req: AuthRequest, res: Response) => {
  const { schoolId } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');
  const { field, suggestedValue, reason, evidence, source } = req.body as Record<string, unknown>;
  if (!CORRECTABLE_SCHOOL_FIELDS.has(String(field))) throw new ApiError(400, 'This school field cannot be corrected through this workflow');
  if (suggestedValue == null || String(suggestedValue).trim() === '') throw new ApiError(400, 'suggestedValue is required');
  if (!evidence || !String(evidence).trim()) throw new ApiError(400, 'Evidence is required');
  const school = await prisma.seniorSchool.findUnique({ where: { id: schoolId } });
  if (!school) throw new ApiError(404, 'School not found');
  const row = await prisma.schoolCorrection.create({
    data: {
      schoolId, submittedById: userId, field: String(field),
      currentValue: serialiseSchoolValue((school as any)[String(field)]),
      suggestedValue: typeof suggestedValue === 'string' ? suggestedValue : JSON.stringify(suggestedValue),
      reason: reason ? String(reason) : null,
      evidence: String(evidence).trim(), source: source ? String(source) : null,
    },
    include: { school: { select: { id: true, name: true, county: true } } },
  });
  res.status(201).json({ success: true, data: row });
};

export const listSchoolCorrections = async (req: AuthRequest, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const rows = await prisma.schoolCorrection.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { school: true },
  });
  res.json({ success: true, data: rows });
};

function parseCorrectionValue(field: string, value: string): any {
  if (['pathwayCodes', 'trackCodes', 'combinationCodes', 'facilities', 'specialNeedsSupport'].includes(field)) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error();
      return parsed.map(String);
    } catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
  }
  return value;
}

export const reviewSchoolCorrection = async (req: AuthRequest, res: Response) => {
  const { correctionId } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');
  const action = String(req.body?.action ?? '').toUpperCase();
  const decisionReason = String(req.body?.decisionReason ?? '').trim();
  if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'action must be APPROVE or REJECT');
  if (!decisionReason) throw new ApiError(400, 'decisionReason is required');
  const correction = await prisma.schoolCorrection.findUnique({ where: { id: correctionId } });
  if (!correction) throw new ApiError(404, 'Correction not found');
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(correction.status)) throw new ApiError(409, 'Correction has already been decided');
  const row = await prisma.$transaction(async (tx) => {
    if (action === 'APPROVE') {
      await tx.seniorSchool.update({
        where: { id: correction.schoolId },
        data: {
          [correction.field]: parseCorrectionValue(correction.field, correction.suggestedValue),
          verificationStatus: 'STALE', verified: false, verifiedAt: null,
        } as any,
      });
    }
    return tx.schoolCorrection.update({
      where: { id: correctionId },
      data: { status: action === 'APPROVE' ? 'PUBLISHED' : 'REJECTED', reviewedById: userId, reviewedAt: new Date(), decisionReason },
      include: { school: true },
    });
  });
  res.json({ success: true, data: row });
};

export const verifySeniorSchool = async (req: AuthRequest, res: Response) => {
  const { schoolId } = req.params;
  const verificationStatus = String(req.body?.verificationStatus ?? '').toUpperCase();
  const allowed = ['UNVERIFIED', 'MINISTRY_LISTED', 'TREND_SCORE_VERIFIED', 'STALE', 'DISPUTED', 'RETIRED'];
  if (!allowed.includes(verificationStatus)) throw new ApiError(400, 'Invalid verificationStatus');
  const verified = verificationStatus === 'TREND_SCORE_VERIFIED';
  const school = await prisma.seniorSchool.update({
    where: { id: schoolId },
    data: { verificationStatus, verified, verifiedAt: verified ? new Date() : null, active: verificationStatus !== 'RETIRED' },
  });
  res.json({ success: true, data: school });
};
