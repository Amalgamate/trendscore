/**
 * Scale Group Controller - ENHANCED VERSION
 * Handles scale group management operations
 */

import { Response } from 'express';
import prisma from '../config/database'; // Using shared client
import { AuthRequest } from '../middleware/permissions.middleware';

import logger from '../utils/logger';
// Official CBC Grade-Based Mapping
const OFFICIAL_CBC_MAPPING: { [key: string]: string[] } = {
  'PLAYGROUP': ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'PP1': ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'PP2': ['Language Activities', 'Kiswahili', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'GRADE_1': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_2': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_3': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_4': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_5': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_6': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_7': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  'GRADE_8': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  'GRADE_9': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports']
};

/**
 * Get all scale groups
 * GET /api/grading/scale-groups
 */
export const getScaleGroups = async (req: AuthRequest, res: Response) => {
  try {
    const scaleGroups = await prisma.scaleGroup.findMany({
      where: {
        archived: false
      },
      include: {
        gradingSystems: {
          where: { archived: false },
          include: {
            ranges: {
              orderBy: { minPercentage: 'desc' }
            }
          },
          orderBy: [
            { grade: 'asc' },
            { learningArea: 'asc' }
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: scaleGroups
    });

  } catch (error: any) {
    logger.error('Error fetching scale groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scale groups',
      error: error.message
    });
  }
};

/**
 * Get a single scale group by ID
 * GET /api/grading/scale-groups/:id
 */
export const getScaleGroupById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const scaleGroup = await prisma.scaleGroup.findFirst({
      where: {
        id,
        archived: false
      },
      include: {
        gradingSystems: {
          where: { archived: false },
          include: {
            ranges: {
              orderBy: { minPercentage: 'desc' }
            }
          },
          orderBy: [
            { grade: 'asc' },
            { learningArea: 'asc' }
          ]
        }
      }
    });

    if (!scaleGroup) {
      return res.status(404).json({
        success: false,
        message: 'Scale group not found'
      });
    }

    res.json({
      success: true,
      data: scaleGroup
    });

  } catch (error: any) {
    logger.error('Error fetching scale group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scale group',
      error: error.message
    });
  }
};

/**
 * Create a new scale group
 * POST /api/grading/scale-groups
 */
export const createScaleGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Scale group name is required'
      });
    }

    // Check if name already exists
    const existing = await prisma.scaleGroup.findFirst({
      where: {
        name,
        archived: false
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A scale group with this name already exists'
      });
    }

    const scaleGroup = await prisma.scaleGroup.create({
      data: {
        name,
        description,
        active: true
      }
    });

    res.json({
      success: true,
      data: scaleGroup,
      message: 'Scale group created successfully'
    });

  } catch (error: any) {
    logger.error('Error creating scale group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scale group',
      error: error.message
    });
  }
};

/**
 * Update a scale group
 * PUT /api/grading/scale-groups/:id
 */
export const updateScaleGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, active, isDefault } = req.body;

    // Verify ownership
    const existing = await prisma.scaleGroup.findFirst({
      where: { id, archived: false }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Scale group not found'
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.scaleGroup.updateMany({
        where: {
          archived: false,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const updated = await prisma.scaleGroup.update({
      where: { id },
      data: {
        name,
        description,
        active,
        isDefault
      }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Scale group updated successfully'
    });

  } catch (error: any) {
    logger.error('Error updating scale group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scale group',
      error: error.message
    });
  }
};

/**
 * Delete a scale group
 * DELETE /api/grading/scale-groups/:id
 */
export const deleteScaleGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const userId = req.user?.userId;

    logger.info(`\n🗑️  Delete request for scale group: ${id}${force === 'true' ? ' (FORCED)' : ''}`);

    // Get details including grading systems
    const existing = await prisma.scaleGroup.findFirst({
      where: { id, archived: false },
      include: {
        gradingSystems: {
          where: { archived: false },
          select: {
            id: true,
            name: true,
            learningArea: true,
            grade: true
          }
        }
      }
    });

    if (!existing) {
      logger.info('❌ Scale group not found or already deleted');
      return res.status(404).json({
        success: false,
        message: 'Scale group not found or already deleted'
      });
    }

    logger.info(`📊 Found scale group: "${existing.name}"`);
    logger.info(`📝 Contains ${existing.gradingSystems.length} grading systems`);

    // Check for tests using any of these grading systems
    if (force !== 'true') {
      const systemIds = existing.gradingSystems.map((gs: any) => gs.id);

      if (systemIds.length > 0) {
        const testsUsingScales = await prisma.summativeTest.findMany({
          where: {
            scaleId: { in: systemIds },
            archived: false
          },
          select: {
            id: true,
            title: true,
            scaleId: true
          },
          take: 10
        });

        if (testsUsingScales.length > 0) {
          logger.info(`⚠️  Warning: ${testsUsingScales.length} tests are using these scales`);
          return res.status(409).json({
            success: false,
            message: `Cannot delete scale group "${existing.name}". ${testsUsingScales.length} test(s) are currently using these grading scales.`,
            details: {
              testsCount: testsUsingScales.length,
              testNames: testsUsingScales.map((t: any) => t.title)
            }
          });
        }
      }
    }

    // Deletion transaction
    const result = await prisma.$transaction(async (tx) => {
      const systemIds = existing.gradingSystems.map((gs: any) => gs.id);
      let rangesCount = 0;
      let testsArchivedCount = 0;

      if (systemIds.length > 0) {
        // 1. Archive associated tests if force is true
        if (force === 'true') {
          const testsResult = await tx.summativeTest.updateMany({
            where: {
              scaleId: { in: systemIds },
              archived: false
            },
            data: {
              archived: true,
              archivedAt: new Date(),
              archivedBy: userId
            }
          });
          testsArchivedCount = testsResult.count;
          logger.info(`✅ Force Delete: Archived ${testsArchivedCount} tests`);
        }

        // 2. Archive grading ranges
        const rangesResult = await tx.gradingRange.updateMany({
          where: {
            systemId: { in: systemIds }
          },
          data: {
            archived: true,
            archivedAt: new Date(),
            archivedBy: userId
          }
        });
        rangesCount = rangesResult.count;
      }

      const systemsResult = await tx.gradingSystem.updateMany({
        where: {
          scaleGroupId: id,
          archived: false
        },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: userId
        }
      });

      return {
        scaleGroupName: existing.name,
        systemsDeleted: systemsResult.count,
        rangesDeleted: rangesCount,
        testsArchived: testsArchivedCount,
        learningAreas: existing.gradingSystems.map((gs: any) => gs.learningArea || 'All Subjects')
      };
    });

    res.json({
      success: true,
      message: result.testsArchived > 0 
        ? `Scale group "${result.scaleGroupName}" and ${result.testsArchived} associated tests deleted successfully`
        : `Scale group "${result.scaleGroupName}" deleted successfully`,
      details: {
        scaleGroupName: result.scaleGroupName,
        gradingSystemsDeleted: result.systemsDeleted,
        gradingRangesDeleted: result.rangesDeleted,
        testsArchived: result.testsArchived,
        learningAreasAffected: result.learningAreas.length
      }
    });

  } catch (error: any) {
    logger.error('❌ Error deleting scale group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scale group',
      error: error.message
    });
  }
};

/**
 * Generate grading systems for a scale group
 * POST /api/grading/scale-groups/:id/generate-grades
 */
export const generateGradesForScaleGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { grades, ranges } = req.body;

    const scaleGroup = await prisma.scaleGroup.findFirst({
      where: { id, archived: false }
    });

    if (!scaleGroup) {
      return res.status(404).json({
        success: false,
        message: 'Scale group not found'
      });
    }

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Grades array is required'
      });
    }

    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ranges array is required'
      });
    }

    // Identify existing systems for this school to avoid duplicates
    const existingSystems = await prisma.gradingSystem.findMany({
      where: {
        scaleGroupId: id,
        grade: { in: grades },
        archived: false
      },
      select: {
        grade: true,
        learningArea: true
      }
    });

    const existingSet = new Set(existingSystems.map(s => `${s.grade}|${s.learningArea}`));
    const systemsToCreate: any[] = [];

    for (const grade of grades) {
      const areasToUse = OFFICIAL_CBC_MAPPING[grade as string] || [];

      for (const learningArea of areasToUse) {
        if (!existingSet.has(`${grade}|${learningArea}`)) {
          systemsToCreate.push({
            name: `${grade.replace('_', ' ')} - ${learningArea}`,
            type: 'SUMMATIVE',
            scaleGroupId: id,
            grade,
            learningArea,
            active: true
          });
        }
      }
    }

    if (systemsToCreate.length === 0) {
      return res.json({
        success: true,
        message: 'All grading systems already exist.'
      });
    }

    const createdCount = await prisma.$transaction(async (tx) => {
      await tx.gradingSystem.createMany({
        data: systemsToCreate
      });

      const systemsNeedingRanges = await tx.gradingSystem.findMany({
        where: {
          scaleGroupId: id,
          grade: { in: grades },
          archived: false,
          ranges: {
            none: {}
          }
        },
        select: { id: true }
      });

      if (systemsNeedingRanges.length === 0) return systemsToCreate.length;

      const rangesToCreate: any[] = [];
      const templateRanges = ranges.map((r: any) => ({
        label: r.label || r.rating,
        minPercentage: parseFloat(r.minPercentage || r.mark || 0),
        maxPercentage: parseFloat(r.maxPercentage || 100),
        points: parseInt(r.points || r.score || 0),
        description: r.description || r.desc || '',
        rubricRating: r.rubricRating || r.rating || null
      }));

      for (const system of systemsNeedingRanges) {
        for (const template of templateRanges) {
          rangesToCreate.push({
            ...template,
            systemId: system.id
          });
        }
      }

      if (rangesToCreate.length > 0) {
        await tx.gradingRange.createMany({
          data: rangesToCreate
        });
      }

      return systemsToCreate.length;
    });

    res.json({
      success: true,
      message: `Successfully created ${createdCount} grading systems`
    });

  } catch (error: any) {
    logger.error('Error generating grades for scale group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate grading systems',
      error: error.message
    });
  }
};

/**
 * Get grading scale for a test
 */
export const getScaleForTest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { grade, learningArea } = req.query;

    if (!grade) {
      return res.status(400).json({
        success: false,
        message: 'Grade parameter is required'
      });
    }

    let scale = await prisma.gradingSystem.findFirst({
      where: {
        scaleGroupId: id,
        grade: grade as any,
        learningArea: learningArea as string,
        active: true,
        archived: false
      },
      include: {
        ranges: {
          orderBy: { minPercentage: 'desc' }
        }
      }
    });

    if (!scale) {
      scale = await prisma.gradingSystem.findFirst({
        where: {
          scaleGroupId: id,
          grade: grade as any,
          learningArea: null,
          active: true,
          archived: false
        },
        include: {
          ranges: {
            orderBy: { minPercentage: 'desc' }
          }
        }
      });
    }

    if (!scale) {
      return res.status(404).json({
        success: false,
        message: 'No grading scale found'
      });
    }

    res.json({
      success: true,
      data: scale
    });

  } catch (error: any) {
    logger.error('Error fetching scale for test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grading scale',
      error: error.message
    });
  }
};
