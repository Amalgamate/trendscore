/**
 * Pathway Tools
 *
 * Registered AI tools for the Pathways module.
 * Every tool calls PathwayService — the model never queries the DB directly.
 *
 * Tools:
 *   READ:
 *     get_learner_readiness         Analyze Grade 9 pathway readiness
 *     get_learner_pathway_status    Current decision + parent preference + mismatch
 *     search_senior_schools         Find schools by pathway + filters
 *     get_class_pathway_summary     Class-wide distribution + status
 *
 *   SAFE_WRITE:
 *     submit_pathway_recommendation Staff submits recommendation
 *     submit_parent_preference      Parent submits preference
 *
 *   CONSEQUENTIAL:
 *     finalize_learner_pathway      Lock pathway (requires confirmation)
 */

import { registerTool } from './ToolRegistry';
import { PathwayService } from '../../services/pathway.service';
import {
  PATHWAY_READ_ROLES,
  PATHWAY_WRITE_ROLES,
  PATHWAY_FINALIZE_ROLES,
} from '../permissions/AIPermissionLayer';
import prisma from '../../config/database';
import type { AIContext } from '../types';
import { parentAccessService } from '../../services/parent-access.service';
import { assertLearnerPathwayStage } from '../../middleware/pathwayStage.middleware';
import { ApiError } from '../../utils/error.util';

const PATHWAY_CODES = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'] as const;
const PATHWAY_STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} is required`);
  }
  return value.trim();
}

function requiredPathway(value: unknown, field: string): typeof PATHWAY_CODES[number] {
  const pathway = requiredString(value, field);
  if (!PATHWAY_CODES.includes(pathway as typeof PATHWAY_CODES[number])) {
    throw new ApiError(422, `${field} must be one of: ${PATHWAY_CODES.join(', ')}`);
  }
  return pathway as typeof PATHWAY_CODES[number];
}

async function assertLearnerAccess(learnerId: string, context: AIContext): Promise<void> {
  if (PATHWAY_STAFF_ROLES.has(context.user.role)) return;

  if (context.user.role === 'PARENT') {
    if (await parentAccessService.canAccessLearner(context.user.id, learnerId)) return;
    throw new ApiError(403, 'Access denied: not your child');
  }

  if (context.user.role === 'STUDENT') {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { username: true },
    });
    const learner = user?.username
      ? await prisma.learner.findUnique({
          where: { admissionNumber: user.username },
          select: { id: true },
        })
      : null;
    if (learner?.id === learnerId) return;
    throw new ApiError(403, 'Access denied: not your own record');
  }

  throw new ApiError(403, 'Access denied: pathway records are restricted');
}

// ─────────────────────────────────────────────────────────────────────────────
// READ TOOLS
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'get_learner_readiness',
  description: "Analyze a Grade 9 learner's readiness for senior secondary pathway (STEM, Social Sciences, Arts & Sports). Returns confidence score and component breakdown.",
  category: 'READ',
  allowedRoles: PATHWAY_READ_ROLES,
  requiresConfirmation: false,
  execute: async (input: { learnerId: string }, context: AIContext) => {
    const learnerId = requiredString(input?.learnerId, 'learnerId');
    await assertLearnerAccess(learnerId, context);
    await assertLearnerPathwayStage(learnerId, ['JUNIOR_TRANSITION']);
    const exists = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { id: true },
    });
    if (!exists) return { error: 'Learner not found' };
    return PathwayService.analyzeReadiness(learnerId);
  },
});

registerTool({
  name: 'get_learner_pathway_status',
  description: "Get the current pathway decision for a learner: staff recommendation, parent preference, finalization status, and any mismatch warning.",
  category: 'READ',
  allowedRoles: PATHWAY_READ_ROLES,
  requiresConfirmation: false,
  execute: async (input: { learnerId: string }, context: AIContext) => {
    const learnerId = requiredString(input?.learnerId, 'learnerId');
    await assertLearnerAccess(learnerId, context);
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true, grade: true },
    });
    if (!learner) return { error: 'Learner not found' };

    const [decisionCtx, history] = await Promise.all([
      PathwayService.getDecisionContext(learnerId),
      PathwayService.getDecisionHistory(learnerId),
    ]);

    return {
      learner: {
        id: learnerId,
        name: `${learner.firstName} ${learner.lastName}`,
        grade: learner.grade,
      },
      currentStatus: decisionCtx,
      historyCount: history.length,
      latestTimestamp: history[0]?.createdAt ?? null,
    };
  },
});

registerTool({
  name: 'search_senior_schools',
  description: 'Search for senior secondary schools that offer a specific pathway. Supports filtering by county, gender, and school type.',
  category: 'READ',
  allowedRoles: PATHWAY_READ_ROLES,
  requiresConfirmation: false,
  execute: async (
    input: {
      pathway: 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';
      county?: string;
      gender?: string;
      classification?: string;
      limit?: number;
    },
    _context: AIContext
  ) => {
    const pathway = requiredPathway(input?.pathway, 'pathway');
    const limit = input?.limit == null ? 10 : Number(input.limit);
    if (!Number.isFinite(limit) || limit <= 0) throw new ApiError(422, 'limit must be a positive number');
    return PathwayService.searchSchools(pathway, {
      county: input.county,
      gender: input.gender,
      classification: input.classification,
      limit: Math.min(Math.floor(limit), 25),
    });
  },
});

registerTool({
  name: 'get_class_pathway_summary',
  description: 'Get the pathway distribution and recommendation status for an entire class. Shows STEM / Social / Arts counts and how many are finalized vs pending.',
  category: 'READ',
  allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  requiresConfirmation: false,
  execute: async (input: { classId: string }, _context: AIContext) => {
    const classId = requiredString(input?.classId, 'classId');
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true },
    });
    if (!cls) return { error: 'Class not found' };

    const distribution = await PathwayService.getClassDistribution(classId);
    return { className: cls.name, ...distribution };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFE WRITE TOOLS
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'submit_pathway_recommendation',
  description: "Submit a staff pathway recommendation for a Grade 9 learner.",
  category: 'SAFE_WRITE',
  allowedRoles: PATHWAY_WRITE_ROLES,
  requiresConfirmation: false,
  execute: async (
    input: {
      learnerId: string;
      recommendedPathway: 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';
      confidenceScore: number;
      teacherRecommendation?: string;
      learnerInterest?: string;
    },
    context: AIContext
  ) => {
    const learnerId = requiredString(input?.learnerId, 'learnerId');
    const recommendedPathway = requiredPathway(input?.recommendedPathway, 'recommendedPathway');
    const confidenceScore = Number(input?.confidenceScore);
    if (!Number.isFinite(confidenceScore)) throw new ApiError(422, 'confidenceScore must be a number');
    await assertLearnerAccess(learnerId, context);
    await assertLearnerPathwayStage(learnerId, ['JUNIOR_TRANSITION']);
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true },
    });
    if (!learner) throw new Error('Learner not found');

    const row = await PathwayService.submitRecommendation(learnerId, {
      recommendedPathway,
      confidenceScore: Math.min(Math.max(confidenceScore, 0), 100),
      teacherRecommendation: input.teacherRecommendation,
      learnerInterest: input.learnerInterest,
      updatedBy: context.user.id,
    });

    return {
      success: true,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      recommendedPathway,
      confidenceScore: Math.min(Math.max(confidenceScore, 0), 100),
      record: row,
    };
  },
});

registerTool({
  name: 'submit_parent_preference',
  description: "Submit a parent pathway preference for their child. Preserves all existing staff recommendation data.",
  category: 'SAFE_WRITE',
  allowedRoles: ['PARENT', 'SUPER_ADMIN'],
  requiresConfirmation: false,
  execute: async (
    input: {
      learnerId: string;
      parentPreference: 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS' | null;
    },
    context: AIContext
  ) => {
    const learnerId = requiredString(input?.learnerId, 'learnerId');
    const parentPreference = input?.parentPreference === null
      ? null
      : requiredPathway(input?.parentPreference, 'parentPreference');
    await assertLearnerAccess(learnerId, context);
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true },
    });
    if (!learner) throw new Error('Learner not found');

    const row = await PathwayService.submitParentPreference(learnerId, {
      parentPreference,
      updatedBy: context.user.id,
    });

    return {
      success: true,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      parentPreference,
      record: row,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSEQUENTIAL TOOLS
// ─────────────────────────────────────────────────────────────────────────────

registerTool({
  name: 'finalize_learner_pathway',
  description: "Finalize and lock a learner's pathway. Once locked the student can search and apply to senior schools. Cannot be undone without admin override.",
  category: 'CONSEQUENTIAL',
  allowedRoles: PATHWAY_FINALIZE_ROLES,
  requiresConfirmation: true,

  describeAction: (
    input: { learnerId: string; finalApprovedPathway: string; learnerName?: string },
    _context: AIContext
  ) => {
    const finalApprovedPathway = requiredPathway(input?.finalApprovedPathway, 'finalApprovedPathway');
    return {
      title: 'Finalize Pathway',
      summary: `Lock ${input?.learnerName || 'this learner'}'s pathway as ${finalApprovedPathway.replace(/_/g, ' ')}.`,
      consequences: [
      `Pathway will be set to: ${finalApprovedPathway.replace(/_/g, ' ')}`,
      'The student will be able to search and apply to senior secondary schools.',
      'Further changes require admin-level override.',
      ],
      affectedEntity: input?.learnerName,
    };
  },

  execute: async (
    input: {
      learnerId: string;
      finalApprovedPathway: 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';
      learnerName?: string;
    },
    context: AIContext
  ) => {
    const learnerId = requiredString(input?.learnerId, 'learnerId');
    const finalApprovedPathway = requiredPathway(input?.finalApprovedPathway, 'finalApprovedPathway');
    await assertLearnerAccess(learnerId, context);
    await assertLearnerPathwayStage(learnerId, ['JUNIOR_TRANSITION']);
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true },
    });
    if (!learner) throw new Error('Learner not found');

    const row = await PathwayService.finalizePathway(learnerId, {
      finalApprovedPathway,
      updatedBy: context.user.id,
    });

    return {
      success: true,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      finalApprovedPathway,
      locked: true,
      record: row,
    };
  },
});
