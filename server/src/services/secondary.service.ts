import { Term } from '@prisma/client';
import prisma from '../config/database';
import { gradingService } from './grading.service';
import logger from '../utils/logger';

export const secondaryService = {
  /**
   * Calculate mean grade and points for a learner for a specific term.
   *
   * FIX (2026-05-17): Only include results for subjects in the learner's
   * active LearnerSubjectSelection.  If no selections exist (e.g. Junior
   * School learners who haven't gone through pathway assignment) we fall
   * back to all subjects so non-Senior learners are unaffected.
   */
  async calculateMeanGrade(learnerId: string, term: Term, academicYear: number) {
    try {
      // 1a. Resolve active subject selections for this learner
      const activeSelections = await prisma.learnerSubjectSelection.findMany({
        where: { learnerId, active: true },
        select: { learningAreaId: true },
      });

      const selectedAreaIds = activeSelections.map((s) => s.learningAreaId);

      // Build the learning-area filter only when selections exist
      const learningAreaFilter =
        selectedAreaIds.length > 0
          ? { learningAreaId: { in: selectedAreaIds } }
          : {};

      // 1b. Fetch summative results scoped to selected subjects (or all if no selections)
      const results = await prisma.summativeResult.findMany({
        where: {
          learnerId,
          test: {
            term,
            academicYear,
            archived: false,
            ...learningAreaFilter,
          },
        },
        include: {
          test: {
            select: {
              totalMarks: true,
              weight: true,
            },
          },
        },
      });

      const performanceResults = results.filter((result) => result.percentage !== null && result.percentage !== undefined && !result.assessmentStatusCode);

      if (performanceResults.length === 0) {
        return null;
      }

      // 2. Fetch the SECONDARY grading system
      const gradingSystem = await gradingService.getGradingSystem('SECONDARY');
      const ranges = gradingSystem?.ranges || [];

      // 3. Calculate metrics
      let totalPercentage = 0;
      let totalPoints = 0;

      for (const result of performanceResults) {
        totalPercentage += result.percentage!;

        // Find points for this specific result's percentage
        const range = ranges.find(
          (r) => result.percentage! >= r.minPercentage && result.percentage! <= r.maxPercentage
        );
        totalPoints += range?.points || 0;
      }

      const meanScore = totalPercentage / performanceResults.length;

      // 4. Determine mean grade letter
      const meanGradeRange = ranges.find(
        (r) => meanScore >= r.minPercentage && meanScore <= r.maxPercentage
      );
      const meanGrade = meanGradeRange?.summativeGrade || 'E';

      // 5. Persist the mean grade
      return await prisma.meanGrade.upsert({
        where: {
          learnerId_term_academicYear: {
            learnerId,
            term,
            academicYear,
          },
        },
        update: {
          totalPoints,
          meanGrade,
          meanScore,
        },
        create: {
          learnerId,
          term,
          academicYear,
          totalPoints,
          meanGrade,
          meanScore,
        },
      });
    } catch (error) {
      logger.error('[SecondaryService] Error calculating mean grade:', error);
      throw error;
    }
  },

  /**
   * Calculate and update rankings for a class
   */
  async updateClassRankings(classId: string, term: Term, academicYear: number) {
    try {
      // 1. Get all learners in the class
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          classId,
          active: true,
        },
        select: {
          learnerId: true,
        },
      });

      const learnerIds = enrollments.map((e) => e.learnerId);

      // 2. Calculate mean grades for all learners
      const meanGrades = [];
      for (const learnerId of learnerIds) {
        const mg = await this.calculateMeanGrade(learnerId, term, academicYear);
        if (mg) {
          meanGrades.push(mg);
        }
      }

      // 3. Sort by mean score descending
      meanGrades.sort((a, b) => b.meanScore - a.meanScore);

      // 4. Update positions
      const updatedGrades = [];
      for (let i = 0; i < meanGrades.length; i++) {
        const position = i + 1;
        const mg = await prisma.meanGrade.update({
          where: { id: meanGrades[i].id },
          data: {
            position,
            outOf: meanGrades.length,
          },
        });
        updatedGrades.push(mg);
      }

      return updatedGrades;
    } catch (error) {
      logger.error('[SecondaryService] Error updating class rankings:', error);
      throw error;
    }
  },

  /**
   * Get rankings for a class
   */
  async getClassRankings(classId: string, term: Term, academicYear: number) {
    const rankings = await prisma.meanGrade.findMany({
      where: {
        term,
        academicYear,
        learner: {
          enrollments: {
            some: {
              classId,
              active: true,
            },
          },
        },
      },
      include: {
        learner: {
          select: {
            firstName: true,
            lastName: true,
            admissionNumber: true,
            stream: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    return rankings;
  },
};
