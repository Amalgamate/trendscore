/**
 * Learning Area Controller
 * Handles CRUD operations for learning areas
 */

import { Request, Response, Router } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import prisma from '../config/database';
import { seedSeniorPathways } from '../services/ss-pathways.seed';
import { ApiError } from '../utils/error.util';

import logger from '../utils/logger';
const router = Router();

const resolveInstitutionType = (req: AuthRequest): 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY' =>
  (req.resolvedInstitutionType || req.school?.institutionType || 'PRIMARY_CBC') as 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

const normalizeGradeLevel = (value?: string | null): string => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  return raw.replace(/^GRADE_(\d+)$/, 'GRADE$1');
};

/**
 * GET /api/learning-areas
 * Get all learning areas for a school
 */
export const getLearningAreas = async (req: AuthRequest, res: Response) => {
  try {
    const institutionType = resolveInstitutionType(req);
    const { gradeLevel, pathway, category } = (req.query || {}) as { gradeLevel?: string; pathway?: string; category?: string };
    const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);

    const learningAreas = await prisma.learningArea.findMany({
      where: {
        institutionType,
        ...(normalizedGradeLevel
          ? {
              OR: [
                { gradeLevel: normalizedGradeLevel },
                { gradeLevel: normalizedGradeLevel.replace(/^GRADE(\d+)$/, 'GRADE_$1') },
              ],
            }
          : {}),
        ...(pathway ? { pathway: String(pathway) } : {}),
        ...(category ? { category: String(category) } : {}),
      },
      orderBy: [
        { gradeLevel: 'asc' },
        { name: 'asc' }
      ]
    });

    return res.json({ success: true, data: learningAreas });
  } catch (error: any) {
    logger.error('Error fetching learning areas:', error);
    throw new ApiError(500, error.message || 'Failed to fetch learning areas');
  }
};

/**
 * GET /api/learning-areas/:id
 * Get a specific learning area
 */
export const getLearningArea = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const learningArea = await prisma.learningArea.findUnique({
      where: { id }
    });

    if (!learningArea) {
      throw new ApiError(404, 'Learning area not found');
    }

    return res.json({ success: true, data: learningArea });
  } catch (error: any) {
    logger.error('Error fetching learning area:', error);
    throw new ApiError(500, error.message || 'Failed to fetch learning area');
  }
};

/**
 * POST /api/learning-areas
 * Create a new learning area
 */
export const createLearningArea = async (req: AuthRequest, res: Response) => {
  try {
    const { name, shortName, gradeLevel, icon, color, description, isCore, pathway, category, pathwayId, categoryId } = req.body;
    const institutionType = resolveInstitutionType(req);

    if (!name || !gradeLevel) {
      throw new ApiError(400, 'Name and grade level are required');
    }

    // Check for duplicates
    const existing = await prisma.learningArea.findFirst({
      where: {
        name,
        gradeLevel,
        institutionType,
      }
    });

    if (existing) {
      throw new ApiError(409, 'Learning area already exists');
    }

    const learningArea = await prisma.learningArea.create({
      data: {
        name,
        shortName: shortName || name.split(' ')[0],
        gradeLevel,
        institutionType,
        isCore: Boolean(isCore),
        pathway: pathway || null,
        category: category || null,
        pathwayId: pathwayId || null,
        categoryId: categoryId || null,
        icon: icon || '📚',
        color: color || '#3b82f6',
        description
      }
    });

    return res.status(201).json({ success: true, data: learningArea });
  } catch (error: any) {
    logger.error('Error creating learning area:', error);
    throw new ApiError(500, error.message || 'Failed to create learning area');
  }
};

/**
 * PUT /api/learning-areas/:id
 * Update a learning area
 */
export const updateLearningArea = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, shortName, gradeLevel, icon, color, description, isCore, pathway, category, pathwayId, categoryId } = req.body;
    const institutionType = resolveInstitutionType(req);

    const learningArea = await prisma.learningArea.findUnique({
      where: { id }
    });

    if (!learningArea) {
      throw new ApiError(404, 'Learning area not found');
    }

    // Check if name already exists (excluding current record)
    if (name && name !== learningArea.name) {
      const existing = await prisma.learningArea.findFirst({
        where: {
          name,
          gradeLevel: gradeLevel || learningArea.gradeLevel,
          institutionType,
          NOT: { id }
        }
      });

      if (existing) {
        throw new ApiError(409, 'Learning area name already exists');
      }
    }

    const updated = await prisma.learningArea.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortName && { shortName }),
        ...(gradeLevel && { gradeLevel }),
        ...(isCore !== undefined && { isCore: Boolean(isCore) }),
        ...(pathway !== undefined && { pathway: pathway || null }),
        ...(category !== undefined && { category: category || null }),
        ...(pathwayId !== undefined && { pathwayId: pathwayId || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(icon && { icon }),
        ...(color && { color }),
        ...(description !== undefined && { description })
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating learning area:', error);
    throw new ApiError(500, error.message || 'Failed to update learning area');
  }
};

/**
 * DELETE /api/learning-areas/:id
 * Delete a learning area
 */
export const deleteLearningArea = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const institutionType = resolveInstitutionType(req);

    const learningArea = await prisma.learningArea.findUnique({
      where: { id }
    });

    if (!learningArea) {
      throw new ApiError(404, 'Learning area not found');
    }

    if (learningArea.institutionType !== institutionType) {
      throw new ApiError(404, 'Learning area not found');
    }

    await prisma.learningArea.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Learning area deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting learning area:', error);
    throw new ApiError(500, error.message || 'Failed to delete learning area');
  }
};

/**
 * POST /api/learning-areas/seed
 * Seed learning areas from constants (for initial setup)
 */
export const seedLearningAreas = async (req: AuthRequest, res: Response) => {
  try {
    const institutionType = resolveInstitutionType(req) as 'PRIMARY_CBC' | 'SECONDARY';

    // Official CBC Per-Grade Mapping
    const primaryCbcGradeMappings: { [key: string]: string[] } = {
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

    // Senior School (Grade 10–12) subject mappings (SECONDARY)
    // Note: This is a starter mapping and can be expanded/adjusted to your SS curriculum.
    const secondaryGradeMappings: { [key: string]: string[] } = {
      'GRADE10': [],
      'GRADE11': [],
      'GRADE12': [],
    };

    // CBC Senior Secondary structure (Kenya): seed a broad catalog.
    const SS_CORE = [
      'English',
      'Kiswahili',
      'Kenya Sign Language',
      'Community Service Learning',
      'Physical Education',
    ];

    const SS_STEM = [
      // Pure Sciences
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      // Applied Sciences
      'Agriculture',
      'Computer Science',
      'Foods & Nutrition',
      'Home Management',
      // Technical & Engineering Studies
      'Electrical Technology',
      'Mechanical Technology',
      'Electronics Technology',
      'Construction Technology',
      'Wood Technology',
      'Aviation Technology',
      'Marine & Fisheries Technology',
      'Mechatronics',
      'Media Technology',
      // Career & Technology Studies (CTS)
      'Hairdressing & Beauty',
      'Culinary Arts',
      'Plumbing',
      'Welding & Fabrication',
      'Motor Vehicle Mechanics',
      'Graphic Design & Animation',
      'Photography',
      'Tourism & Travel',
      'Carpentry & Joinery',
      'Fashion & Garment Making',
      'Electrical Installation',
    ];

    const SS_SOCIAL = [
      // Humanities
      'History & Citizenship',
      'Geography',
      'CRE',
      'IRE',
      'HRE',
      // Business & Economics
      'Business Studies',
      'Economics',
      // Languages
      'Literature in English',
      'Fasihi ya Kiswahili',
      'Indigenous Languages',
      'French',
      'German',
      'Arabic',
      'Mandarin',
    ];

    const SS_ARTS_SPORTS = [
      // Arts
      'Fine Art',
      'Applied Art',
      'Crafts',
      'Film & Digital Media',
      // Performing Arts
      'Music',
      'Dance',
      'Theatre & Elocution',
      // Sports Science
      'Human Physiology',
      'Anatomy & Nutrition',
      'Sports Ethics',
      // Sports Options
      'Athletics',
      'Ball Games',
      'Gymnastics',
      'Water Sports',
      'Martial Arts',
      'Boxing',
      'Outdoor Pursuits',
    ];

    for (const g of ['GRADE10', 'GRADE11', 'GRADE12'] as const) {
      secondaryGradeMappings[g] = Array.from(
        new Set([...SS_CORE, ...SS_STEM, ...SS_SOCIAL, ...SS_ARTS_SPORTS])
      );
    }

    const gradeMappings =
      institutionType === 'SECONDARY' ? secondaryGradeMappings : primaryCbcGradeMappings;

    if (institutionType === 'SECONDARY') {
      // Ensure Pathway and SubjectCategory tables are populated before linking.
      await seedSeniorPathways(prisma as any);
    }

    const colors: { [key: string]: string } = {
      'Pre-Primary': '#8b5cf6',
      'Lower Primary': '#3b82f6',
      'Upper Primary': '#2563eb',
      'Junior School': '#10b981',
      'Senior School': '#6366f1',
    };

    const icons: { [key: string]: string } = {
      'Pre-Primary': '🎨',
      'Lower Primary': '📘',
      'Upper Primary': '🧪',
      'Junior School': '📗',
      'Senior School': '🎓',
    };

    const shortNameMapping: { [key: string]: string } = {
      'English': 'ENG',
      'Kiswahili': 'KISW',
      'Kenya Sign Language': 'KSL',
      'Community Service Learning': 'CSL',
      'Physical Education': 'PE',
      'Mathematics': 'MATH',
      'Mathematical Activities': 'MATH',
      'Language Activities': 'LANG',
      'Environmental Activities': 'ENV',
      'Creative Activities': 'CREA',
      'Religious Education': 'RE',
      'Religious Activities': 'REL',
      'Science and Technology': 'SCI',
      'Social Studies': 'SOC',
      'Agriculture': 'AGRI',
      'Creative Arts': 'ARTS',
      'Integrated Science': 'INT_SCI',
      'Pre-Technical Studies': 'PRE-TECH',
      'Creative Arts & Sports': 'ARTS',
      'Biology': 'BIO',
      'Chemistry': 'CHEM',
      'Physics': 'PHY',
      'History': 'HIST',
      'History & Citizenship': 'HIST',
      'Geography': 'GEO',
      'CRE': 'CRE',
      'IRE': 'IRE',
      'HRE': 'HRE',
      'Business Studies': 'BST',
      'Economics': 'ECON',
      'Computer Studies': 'COMP',
      'Computer Science': 'CS',
      'Foods & Nutrition': 'FN',
      'Home Management': 'HM',
      'Electrical Technology': 'ELT',
      'Mechanical Technology': 'MECH',
      'Electronics Technology': 'ELX',
      'Construction Technology': 'CONST',
      'Wood Technology': 'WOOD',
      'Aviation Technology': 'AVN',
      'Marine & Fisheries Technology': 'MFT',
      'Mechatronics': 'MECHTR',
      'Media Technology': 'MEDIA',
      'Hairdressing & Beauty': 'HDB',
      'Culinary Arts': 'CULA',
      'Plumbing': 'PLMB',
      'Welding & Fabrication': 'WELD',
      'Motor Vehicle Mechanics': 'MVM',
      'Graphic Design & Animation': 'GDA',
      'Photography': 'PHOTO',
      'Tourism & Travel': 'TOUR',
      'Carpentry & Joinery': 'CJ',
      'Fashion & Garment Making': 'FGM',
      'Electrical Installation': 'ELI',
      'Literature in English': 'LIT',
      'Fasihi ya Kiswahili': 'FAS',
      'Indigenous Languages': 'IL',
      'French': 'FRE',
      'German': 'GER',
      'Arabic': 'ARB',
      'Mandarin': 'MAN',
      'Fine Art': 'ART',
      'Applied Art': 'AART',
      'Crafts': 'CRFT',
      'Film & Digital Media': 'FDM',
      'Music': 'MUS',
      'Dance': 'DAN',
      'Theatre & Elocution': 'THE',
      'Human Physiology': 'HPHY',
      'Anatomy & Nutrition': 'ANUT',
      'Sports Ethics': 'SETH',
      'Athletics': 'ATH',
      'Ball Games': 'BALL',
      'Gymnastics': 'GYM',
      'Water Sports': 'WATR',
      'Martial Arts': 'MART',
      'Boxing': 'BOX',
      'Outdoor Pursuits': 'OUT',
    };

    const rowsToSeed: Array<{
      name: string;
      shortName: string;
      gradeLevel: string;
      institutionType: 'PRIMARY_CBC' | 'SECONDARY';
      isCore?: boolean;
      pathway?: string;
      category?: string;
      pathwayId?: string;
      categoryId?: string;
      icon: string;
      color: string;
    }> = [];

    let pathwayIds: Record<string, string> = {};
    let categoryIds: Record<string, string> = {};
    if (institutionType === 'SECONDARY') {
      const pathways = await prisma.pathway.findMany({ where: { active: true }, select: { id: true, code: true } });
      pathwayIds = pathways.reduce((a, p) => { a[p.code] = p.id; return a; }, {} as any);
      const categories = await prisma.subjectCategory.findMany({
        where: { active: true },
        select: { id: true, code: true, pathway: { select: { code: true } } },
      });
      categoryIds = categories.reduce((a, c) => {
        a[`${c.pathway.code}::${c.code}`] = c.id;
        return a;
      }, {} as any);
    }

    for (const [grade, areas] of Object.entries(gradeMappings)) {
      let visualGroup = 'Lower Primary';
      if (['PLAYGROUP', 'PP1', 'PP2'].includes(grade)) visualGroup = 'Pre-Primary';
      if (['GRADE_4', 'GRADE_5', 'GRADE_6'].includes(grade)) visualGroup = 'Upper Primary';
      if (['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(grade)) visualGroup = 'Junior School';
      if (['GRADE10', 'GRADE11', 'GRADE12'].includes(grade)) visualGroup = 'Senior School';

      for (const area of areas) {
        const isSecondary = institutionType === 'SECONDARY';
        const isCore = isSecondary && SS_CORE.includes(area);
        const pathway =
          !isSecondary ? undefined :
          SS_STEM.includes(area) ? 'STEM' :
          SS_SOCIAL.includes(area) ? 'SOCIAL_SCIENCES' :
          SS_ARTS_SPORTS.includes(area) ? 'ARTS_SPORTS' :
          isCore ? 'CORE' : undefined;

        const categoryCode = (() => {
          if (!isSecondary) return undefined;
          if (isCore) return 'CORE';

          // STEM buckets
          if (['Mathematics', 'Physics', 'Chemistry', 'Biology'].includes(area)) return 'PURE_SCIENCES';
          if (['Agriculture', 'Computer Science', 'Foods & Nutrition', 'Home Management', 'Computer Studies'].includes(area)) return 'APPLIED_SCIENCES';
          if ([
            'Electrical Technology',
            'Mechanical Technology',
            'Electronics Technology',
            'Construction Technology',
            'Wood Technology',
            'Aviation Technology',
            'Marine & Fisheries Technology',
            'Mechatronics',
            'Media Technology',
          ].includes(area)) return 'TECH_ENGINEERING';
          if ([
            'Hairdressing & Beauty',
            'Culinary Arts',
            'Plumbing',
            'Welding & Fabrication',
            'Motor Vehicle Mechanics',
            'Graphic Design & Animation',
            'Photography',
            'Tourism & Travel',
            'Carpentry & Joinery',
            'Fashion & Garment Making',
            'Electrical Installation',
          ].includes(area)) return 'CTS';

          // Social Sciences buckets
          if (['History & Citizenship', 'Geography', 'CRE', 'IRE', 'HRE', 'History'].includes(area)) return 'HUMANITIES';
          if (['Business Studies', 'Economics'].includes(area)) return 'BUSINESS_ECONOMICS';
          if ([
            'Literature in English',
            'Fasihi ya Kiswahili',
            'Indigenous Languages',
            'French',
            'German',
            'Arabic',
            'Mandarin',
            'Kenya Sign Language',
            'Kiswahili',
            'English',
          ].includes(area)) return 'LANGUAGES';

          // Arts & Sports buckets
          if (['Fine Art', 'Applied Art', 'Crafts', 'Film & Digital Media'].includes(area)) return 'ARTS';
          if (['Music', 'Dance', 'Theatre & Elocution'].includes(area)) return 'PERFORMING';
          if (['Human Physiology', 'Anatomy & Nutrition', 'Sports Ethics'].includes(area)) return 'SPORTS_SCIENCE';
          if (['Athletics', 'Ball Games', 'Gymnastics', 'Water Sports', 'Martial Arts', 'Boxing', 'Outdoor Pursuits', 'Physical Education'].includes(area)) return 'SPORTS_OPTIONS';

          return undefined;
        })();

        const category =
          !isSecondary ? undefined :
          isCore ? 'CORE' :
          SS_STEM.includes(area) ? 'STEM' :
          SS_SOCIAL.includes(area) ? 'SOCIAL_SCIENCES' :
          SS_ARTS_SPORTS.includes(area) ? 'ARTS_SPORTS' :
          undefined;

        const pathwayId = isSecondary && pathway ? pathwayIds[pathway] : undefined;
        const categoryId =
          isSecondary && pathway && categoryCode ? categoryIds[`${pathway}::${categoryCode}`] : undefined;

        rowsToSeed.push({
          name: area,
          shortName: shortNameMapping[area] || area.substring(0, 5).toUpperCase(),
          gradeLevel: grade,
          institutionType,
          ...(isSecondary ? { isCore, pathway, category, pathwayId, categoryId } : {}),
          icon: icons[visualGroup] || '📚',
          color: colors[visualGroup] || '#3b82f6'
        });
      }
    }

    const total = rowsToSeed.length;
    const result = await prisma.learningArea.createMany({
      data: rowsToSeed,
      skipDuplicates: true
    });

    const created = result.count;
    const skipped = Math.max(total - created, 0);

    return res.json({
      success: true,
      message: 'Learning areas seeded successfully',
      created,
      skipped
    });
  } catch (error: any) {
    logger.error('Error seeding learning areas:', error);
    throw new ApiError(500, error.message || 'Failed to seed learning areas');
  }
};

export default router;
