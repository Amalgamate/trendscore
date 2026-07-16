/**
 * CBC Assessment Controller
 * Handles Core Competencies, Values, and Co-Curricular Activities
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Term, DetailedRubricRating } from '@prisma/client';
import prisma from '../config/database';

import logger from '../utils/logger';
// ============================================
// CORE COMPETENCIES
// ============================================

/**
 * Create or Update Core Competencies (single learner)
 * POST /api/cbc/competencies
 */
export const createOrUpdateCompetencies = async (req: AuthRequest, res: Response) => {
  try {
    const {
      learnerId,
      term,
      academicYear,
      communication,
      communicationComment,
      criticalThinking,
      criticalThinkingComment,
      creativity,
      creativityComment,
      collaboration,
      collaborationComment,
      citizenship,
      citizenshipComment,
      learningToLearn,
      learningToLearnComment,
      digitalLiteracy,
      digitalLiteracyComment,
      selfEfficacy,
      selfEfficacyComment
    } = req.body;

    const assessedBy = req.user?.userId;

    if (!assessedBy) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // digitalLiteracy/selfEfficacy are intentionally NOT required here — they were
    // added after this endpoint went live, and older frontend builds / partial
    // bulk imports may still submit records without them.
    if (!learnerId || !term || !academicYear || !communication || !criticalThinking ||
      !creativity || !collaboration || !citizenship || !learningToLearn) {
      return res.status(400).json({
        success: false,
        message: 'All competency ratings are required'
      });
    }

    const result = await _upsertCompetency(
      { learnerId, term, academicYear: parseInt(academicYear), assessedBy },
      {
        communication, communicationComment,
        criticalThinking, criticalThinkingComment,
        creativity, creativityComment,
        collaboration, collaborationComment,
        citizenship, citizenshipComment,
        learningToLearn, learningToLearnComment,
        digitalLiteracy, digitalLiteracyComment,
        selfEfficacy, selfEfficacyComment
      }
    );

    res.json({ success: true, message: 'Core competencies saved successfully', data: result });

  } catch (error: any) {
    logger.error('Error saving core competencies:', error);
    res.status(500).json({ success: false, message: 'Failed to save core competencies', error: error.message });
  }
};

/**
 * Bulk Create or Update Core Competencies (whole class)
 * POST /api/cbc/competencies/bulk
 * Body: { records: [{ learnerId, term, academicYear, communication, ... }] }
 */
export const createOrUpdateCompetenciesBulk = async (req: AuthRequest, res: Response) => {
  try {
    const assessedBy = req.user?.userId;
    if (!assessedBy) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }

    const skipped: Array<{ learnerId: string; reason: string }> = [];
    const savedResults: any[] = [];

    for (const r of records) {
      if (!r.learnerId || !r.term || !r.academicYear ||
        !r.communication || !r.criticalThinking || !r.creativity ||
        !r.collaboration || !r.citizenship || !r.learningToLearn) {
        skipped.push({ learnerId: r.learnerId ?? 'unknown', reason: 'Missing required fields' });
        continue;
      }

      try {
        const result = await _upsertCompetency(
          { learnerId: r.learnerId, term: r.term, academicYear: parseInt(r.academicYear), assessedBy },
          {
            communication: r.communication, communicationComment: r.communicationComment,
            criticalThinking: r.criticalThinking, criticalThinkingComment: r.criticalThinkingComment,
            creativity: r.creativity, creativityComment: r.creativityComment,
            collaboration: r.collaboration, collaborationComment: r.collaborationComment,
            citizenship: r.citizenship, citizenshipComment: r.citizenshipComment,
            learningToLearn: r.learningToLearn, learningToLearnComment: r.learningToLearnComment,
            digitalLiteracy: r.digitalLiteracy, digitalLiteracyComment: r.digitalLiteracyComment,
            selfEfficacy: r.selfEfficacy, selfEfficacyComment: r.selfEfficacyComment
          }
        );
        savedResults.push(result);
      } catch (err: any) {
        skipped.push({ learnerId: r.learnerId, reason: err.message });
      }
    }

    const response: any = {
      success: true,
      message: `Saved ${savedResults.length} of ${records.length} competency records`,
      data: savedResults,
      count: savedResults.length
    };
    if (skipped.length > 0) {
      response.warnings = `${skipped.length} records skipped`;
      response.skipped = skipped;
    }

    res.json(response);

  } catch (error: any) {
    logger.error('Error bulk saving core competencies:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk save core competencies', error: error.message });
  }
};

/** Shared upsert helper for core competencies */
async function _upsertCompetency(
  meta: { learnerId: string; term: string; academicYear: number; assessedBy: string },
  ratings: Record<string, any>
) {
  const existing = await prisma.coreCompetency.findFirst({
    where: { learnerId: meta.learnerId, term: meta.term as Term, academicYear: meta.academicYear }
  });

  if (existing) {
    return prisma.coreCompetency.update({
      where: { id: existing.id },
      data: {
        communication: ratings.communication as DetailedRubricRating,
        communicationComment: ratings.communicationComment,
        criticalThinking: ratings.criticalThinking as DetailedRubricRating,
        criticalThinkingComment: ratings.criticalThinkingComment,
        creativity: ratings.creativity as DetailedRubricRating,
        creativityComment: ratings.creativityComment,
        collaboration: ratings.collaboration as DetailedRubricRating,
        collaborationComment: ratings.collaborationComment,
        citizenship: ratings.citizenship as DetailedRubricRating,
        citizenshipComment: ratings.citizenshipComment,
        learningToLearn: ratings.learningToLearn as DetailedRubricRating,
        learningToLearnComment: ratings.learningToLearnComment,
        digitalLiteracy: (ratings.digitalLiteracy ?? undefined) as DetailedRubricRating | undefined,
        digitalLiteracyComment: ratings.digitalLiteracyComment,
        selfEfficacy: (ratings.selfEfficacy ?? undefined) as DetailedRubricRating | undefined,
        selfEfficacyComment: ratings.selfEfficacyComment,
        assessedBy: meta.assessedBy
      },
      include: {
        learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
        assessor: { select: { firstName: true, lastName: true } }
      }
    });
  }

  return prisma.coreCompetency.create({
    data: {
      learnerId: meta.learnerId,
      term: meta.term as Term,
      academicYear: meta.academicYear,
      communication: ratings.communication as DetailedRubricRating,
      communicationComment: ratings.communicationComment,
      criticalThinking: ratings.criticalThinking as DetailedRubricRating,
      criticalThinkingComment: ratings.criticalThinkingComment,
      creativity: ratings.creativity as DetailedRubricRating,
      creativityComment: ratings.creativityComment,
      collaboration: ratings.collaboration as DetailedRubricRating,
      collaborationComment: ratings.collaborationComment,
      citizenship: ratings.citizenship as DetailedRubricRating,
      citizenshipComment: ratings.citizenshipComment,
      learningToLearn: ratings.learningToLearn as DetailedRubricRating,
      learningToLearnComment: ratings.learningToLearnComment,
      digitalLiteracy: (ratings.digitalLiteracy ?? undefined) as DetailedRubricRating | undefined,
      digitalLiteracyComment: ratings.digitalLiteracyComment,
      selfEfficacy: (ratings.selfEfficacy ?? undefined) as DetailedRubricRating | undefined,
      selfEfficacyComment: ratings.selfEfficacyComment,
      assessedBy: meta.assessedBy
    },
    include: {
      learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
      assessor: { select: { firstName: true, lastName: true } }
    }
  });
}

/**
 * Get Core Competencies for a Learner
 * GET /api/cbc/competencies/:learnerId?term=TERM_1&academicYear=2026
 */
export const getCompetenciesByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ success: false, message: 'Term and academic year are required' });
    }

    const competencies = await prisma.coreCompetency.findFirst({
      where: { learnerId, term: term as Term, academicYear: parseInt(academicYear as string) },
      include: {
        learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
        assessor: { select: { firstName: true, lastName: true } }
      }
    });

    res.json({ success: true, data: competencies });

  } catch (error: any) {
    logger.error('Error fetching core competencies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch core competencies', error: error.message });
  }
};

// ============================================
// VALUES ASSESSMENT
// ============================================

/**
 * Create or Update Values Assessment (single learner)
 * POST /api/cbc/values
 */
export const createOrUpdateValues = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId, term, academicYear, love, responsibility, respect, unity, peace, patriotism, integrity, comment } = req.body;
    const assessedBy = req.user?.userId;

    if (!assessedBy) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (!learnerId || !term || !academicYear || !love || !responsibility ||
      !respect || !unity || !peace || !patriotism || !integrity) {
      return res.status(400).json({ success: false, message: 'All value ratings are required' });
    }

    const result = await _upsertValues(
      { learnerId, term, academicYear: parseInt(academicYear), assessedBy },
      { love, responsibility, respect, unity, peace, patriotism, integrity, comment }
    );

    res.json({ success: true, message: 'Values assessment saved successfully', data: result });

  } catch (error: any) {
    logger.error('Error saving values assessment:', error);
    res.status(500).json({ success: false, message: 'Failed to save values assessment', error: error.message });
  }
};

/**
 * Bulk Create or Update Values Assessments (whole class)
 * POST /api/cbc/values/bulk
 */
export const createOrUpdateValuesBulk = async (req: AuthRequest, res: Response) => {
  try {
    const assessedBy = req.user?.userId;
    if (!assessedBy) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }

    const skipped: Array<{ learnerId: string; reason: string }> = [];
    const savedResults: any[] = [];

    for (const r of records) {
      if (!r.learnerId || !r.term || !r.academicYear ||
        !r.love || !r.responsibility || !r.respect ||
        !r.unity || !r.peace || !r.patriotism || !r.integrity) {
        skipped.push({ learnerId: r.learnerId ?? 'unknown', reason: 'Missing required fields' });
        continue;
      }

      try {
        const result = await _upsertValues(
          { learnerId: r.learnerId, term: r.term, academicYear: parseInt(r.academicYear), assessedBy },
          {
            love: r.love, responsibility: r.responsibility, respect: r.respect,
            unity: r.unity, peace: r.peace, patriotism: r.patriotism,
            integrity: r.integrity, comment: r.comment
          }
        );
        savedResults.push(result);
      } catch (err: any) {
        skipped.push({ learnerId: r.learnerId, reason: err.message });
      }
    }

    const response: any = {
      success: true,
      message: `Saved ${savedResults.length} of ${records.length} values records`,
      data: savedResults,
      count: savedResults.length
    };
    if (skipped.length > 0) {
      response.warnings = `${skipped.length} records skipped`;
      response.skipped = skipped;
    }

    res.json(response);

  } catch (error: any) {
    logger.error('Error bulk saving values assessments:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk save values assessments', error: error.message });
  }
};

/** Shared upsert helper for values */
async function _upsertValues(
  meta: { learnerId: string; term: string; academicYear: number; assessedBy: string },
  ratings: Record<string, any>
) {
  const existing = await prisma.valuesAssessment.findFirst({
    where: { learnerId: meta.learnerId, term: meta.term as Term, academicYear: meta.academicYear }
  });

  if (existing) {
    return prisma.valuesAssessment.update({
      where: { id: existing.id },
      data: {
        love: ratings.love as DetailedRubricRating,
        responsibility: ratings.responsibility as DetailedRubricRating,
        respect: ratings.respect as DetailedRubricRating,
        unity: ratings.unity as DetailedRubricRating,
        peace: ratings.peace as DetailedRubricRating,
        patriotism: ratings.patriotism as DetailedRubricRating,
        integrity: ratings.integrity as DetailedRubricRating,
        comment: ratings.comment,
        assessedBy: meta.assessedBy
      },
      include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
    });
  }

  return prisma.valuesAssessment.create({
    data: {
      learnerId: meta.learnerId,
      term: meta.term as Term,
      academicYear: meta.academicYear,
      love: ratings.love as DetailedRubricRating,
      responsibility: ratings.responsibility as DetailedRubricRating,
      respect: ratings.respect as DetailedRubricRating,
      unity: ratings.unity as DetailedRubricRating,
      peace: ratings.peace as DetailedRubricRating,
      patriotism: ratings.patriotism as DetailedRubricRating,
      integrity: ratings.integrity as DetailedRubricRating,
      comment: ratings.comment,
      assessedBy: meta.assessedBy
    },
    include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
  });
}

/**
 * Get Values Assessment for a Learner
 * GET /api/cbc/values/:learnerId?term=TERM_1&academicYear=2026
 */
export const getValuesByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ success: false, message: 'Term and academic year are required' });
    }

    const values = await prisma.valuesAssessment.findFirst({
      where: { learnerId, term: term as Term, academicYear: parseInt(academicYear as string) },
      include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
    });

    res.json({ success: true, data: values });

  } catch (error: any) {
    logger.error('Error fetching values assessment:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch values assessment', error: error.message });
  }
};

// ============================================
// CO-CURRICULAR ACTIVITIES
// ============================================

/**
 * Create Co-Curricular Activity
 * POST /api/cbc/cocurricular
 */
export const createCoCurricular = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId, term, academicYear, activityName, activityType, performance, achievements, remarks } = req.body;
    const recordedBy = req.user?.userId;

    if (!recordedBy) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (!learnerId || !term || !academicYear || !activityName || !activityType || !performance) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const activity = await prisma.coCurricularActivity.create({
      data: {
        learnerId,
        term: term as Term,
        academicYear: parseInt(academicYear),
        activityName,
        activityType,
        performance: performance as DetailedRubricRating,
        achievements,
        remarks,
        recordedBy
      },
      include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
    });

    res.status(201).json({ success: true, message: 'Co-curricular activity created successfully', data: activity });

  } catch (error: any) {
    logger.error('Error creating co-curricular activity:', error);
    res.status(500).json({ success: false, message: 'Failed to create co-curricular activity', error: error.message });
  }
};

/**
 * Bulk Create Co-Curricular Activities (whole class, same activity)
 * POST /api/cbc/cocurricular/bulk
 * Body: { records: [{ learnerId, term, academicYear, activityName, activityType, performance, ... }] }
 */
export const createCoCurricularBulk = async (req: AuthRequest, res: Response) => {
  try {
    const recordedBy = req.user?.userId;
    if (!recordedBy) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }

    const skipped: Array<{ learnerId: string; reason: string }> = [];
    const created: any[] = [];

    for (const r of records) {
      if (!r.learnerId || !r.term || !r.academicYear || !r.activityName || !r.activityType || !r.performance) {
        skipped.push({ learnerId: r.learnerId ?? 'unknown', reason: 'Missing required fields' });
        continue;
      }

      try {
        const activity = await prisma.coCurricularActivity.create({
          data: {
            learnerId: r.learnerId,
            term: r.term as Term,
            academicYear: parseInt(r.academicYear),
            activityName: r.activityName,
            activityType: r.activityType,
            performance: r.performance as DetailedRubricRating,
            achievements: r.achievements,
            remarks: r.remarks,
            recordedBy
          }
        });
        created.push(activity);
      } catch (err: any) {
        skipped.push({ learnerId: r.learnerId, reason: err.message });
      }
    }

    const response: any = {
      success: true,
      message: `Created ${created.length} of ${records.length} co-curricular records`,
      data: created,
      count: created.length
    };
    if (skipped.length > 0) {
      response.warnings = `${skipped.length} records skipped`;
      response.skipped = skipped;
    }

    res.status(201).json(response);

  } catch (error: any) {
    logger.error('Error bulk creating co-curricular activities:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk create co-curricular activities', error: error.message });
  }
};

/**
 * Get Co-Curricular Activities for a Learner
 * GET /api/cbc/cocurricular/:learnerId?term=TERM_1&academicYear=2026
 */
export const getCoCurricularByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    const whereClause: any = { learnerId, archived: false };

    if (term) whereClause.term = term as Term;
    if (academicYear) whereClause.academicYear = parseInt(academicYear as string);

    const activities = await prisma.coCurricularActivity.findMany({
      where: whereClause,
      include: {
        learner: { select: { firstName: true, lastName: true, admissionNumber: true } },
        recorder: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: activities, count: activities.length });

  } catch (error: any) {
    logger.error('Error fetching co-curricular activities:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch co-curricular activities', error: error.message });
  }
};

/**
 * Update Co-Curricular Activity
 * PUT /api/cbc/cocurricular/:id
 */
export const updateCoCurricular = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const existing = await prisma.coCurricularActivity.findUnique({
      where: { id },
      select: { id: true, recordedBy: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Co-curricular activity not found' });
    }

    // FIX: ownership check — only the recorder or an admin/head teacher may update
    const isPrivileged = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'HEAD_TEACHER';
    if (!isPrivileged && existing.recordedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit co-curricular records that you created'
      });
    }

    const updateData = { ...req.body };
    // Strip immutable fields from the payload
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.recordedBy;
    delete updateData.learnerId;  // learnerId should not be changed after creation

    const activity = await prisma.coCurricularActivity.update({
      where: { id },
      data: updateData,
      include: { learner: { select: { firstName: true, lastName: true } } }
    });

    res.json({ success: true, message: 'Co-curricular activity updated successfully', data: activity });

  } catch (error: any) {
    logger.error('Error updating co-curricular activity:', error);
    res.status(500).json({ success: false, message: 'Failed to update co-curricular activity', error: error.message });
  }
};

/**
 * Delete Co-Curricular Activity
 * DELETE /api/cbc/cocurricular/:id
 */
export const deleteCoCurricular = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      await prisma.coCurricularActivity.delete({ where: { id } });
      res.json({ success: true, message: 'Co-curricular activity permanently deleted by Super Admin' });
    } else {
      await prisma.coCurricularActivity.update({
        where: { id },
        data: { archived: true, archivedAt: new Date(), archivedBy: req.user?.userId }
      });
      res.json({ success: true, message: 'Co-curricular activity archived successfully' });
    }

  } catch (error: any) {
    logger.error('Error deleting co-curricular activity:', error);
    res.status(500).json({ success: false, message: 'Failed to process delete request', error: error.message });
  }
};

// ============================================
// TERMLY REPORT COMMENTS
// ============================================

/**
 * Save Termly Report Comments
 * POST /api/cbc/comments
 */
export const saveReportComments = async (req: Request, res: Response) => {
  try {
    const {
      learnerId,
      term,
      academicYear,
      classTeacherComment,
      classTeacherName,
      classTeacherSignature,
      headTeacherComment,
      headTeacherName,
      headTeacherSignature,
      nextTermOpens
    } = req.body;

    if (!learnerId || !term || !academicYear || !classTeacherComment || !classTeacherName || !nextTermOpens) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existing = await prisma.termlyReportComment.findFirst({
      where: { learnerId, term: term as Term, academicYear: parseInt(academicYear) }
    });

    // FIX: headTeacherDate is set whenever headTeacherName is present (not just when a comment exists).
    // A head teacher may sign without adding a comment, and the date must still be recorded.
    const headTeacherDate = headTeacherName ? new Date() : undefined;

    let result;
    if (existing) {
      result = await prisma.termlyReportComment.update({
        where: { id: existing.id },
        data: {
          classTeacherComment,
          classTeacherName,
          classTeacherSignature,
          classTeacherDate: new Date(),
          headTeacherComment: headTeacherComment ?? null,
          headTeacherName: headTeacherName ?? null,
          headTeacherSignature: headTeacherSignature ?? null,
          headTeacherDate,
          nextTermOpens: new Date(nextTermOpens)
        },
        include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
      });
    } else {
      result = await prisma.termlyReportComment.create({
        data: {
          learnerId,
          term: term as Term,
          academicYear: parseInt(academicYear),
          classTeacherComment,
          classTeacherName,
          classTeacherSignature,
          classTeacherDate: new Date(),
          headTeacherComment: headTeacherComment ?? null,
          headTeacherName: headTeacherName ?? null,
          headTeacherSignature: headTeacherSignature ?? null,
          headTeacherDate,
          nextTermOpens: new Date(nextTermOpens)
        },
        include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
      });
    }

    res.json({ success: true, message: 'Report comments saved successfully', data: result });

  } catch (error: any) {
    logger.error('Error saving report comments:', error);
    res.status(500).json({ success: false, message: 'Failed to save report comments', error: error.message });
  }
};

/**
 * Get Termly Report Comments for a Learner
 * GET /api/cbc/comments/:learnerId?term=TERM_1&academicYear=2026
 */
export const getCommentsByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ success: false, message: 'Term and academic year are required' });
    }

    const comments = await prisma.termlyReportComment.findFirst({
      where: { learnerId, term: term as Term, academicYear: parseInt(academicYear as string) },
      include: { learner: { select: { firstName: true, lastName: true, admissionNumber: true } } }
    });

    res.json({ success: true, data: comments });

  } catch (error: any) {
    logger.error('Error fetching report comments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch report comments', error: error.message });
  }
};
