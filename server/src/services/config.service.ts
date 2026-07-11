/**
 * Configuration Service
 * Manages term configurations and aggregation rules
 * Handles defaults, validation, and configuration retrieval
 */

import { Term, FormativeAssessmentType, AggregationStrategy, Grade } from '@prisma/client';
import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CreateTermConfigInput {
  academicYear: number;
  term: Term;
  startDate: Date;
  endDate: Date;
  formativeWeight: number;
  summativeWeight: number;
  isActive?: boolean;
  createdBy: string;
}

interface UpdateTermConfigInput {
  startDate?: Date;
  endDate?: Date;
  formativeWeight?: number;
  summativeWeight?: number;
  isActive?: boolean;
  isClosed?: boolean;
}

interface CreateAggregationConfigInput {
  grade?: Grade | null;
  learningArea?: string;
  type: FormativeAssessmentType;
  strategy: AggregationStrategy;
  nValue?: number;
  weight?: number;
  createdBy: string;
}

interface UpdateAggregationConfigInput {
  strategy?: AggregationStrategy;
  nValue?: number;
  weight?: number;
}

interface StreamConfigInput {
  id?: string;
  name: string;
  active?: boolean;
}

interface UpsertClassInput {
  id?: string;
  name: string;
  grade: string;
  stream?: string | null;
  teacherId?: string | null;
  capacity?: number;
  room?: string | null;
  academicYear?: number;
  term?: Term;
  active?: boolean;
}

interface TermConfiguration {
  termConfig: any;
  aggregationConfigs: any[];
}

// ============================================
// CONFIG SERVICE
// ============================================

export class ConfigService {
  private normalizeClassCapacity(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 40;
  }

  private async generateClassCode(): Promise<string> {
    const existingCodes = await prisma.class.findMany({
      where: { classCode: { startsWith: 'CLS-' } },
      select: { classCode: true }
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
        select: { id: true }
      });

      if (!existing) return classCode;
      counter++;
    }
  }


  /**
   * Get term configuration
   * Creates default if it doesn't exist
   */
  async getTermConfig(params: {
    term: Term;
    academicYear: number;
  }): Promise<any> {
    const { term, academicYear } = params;

    let config = await prisma.termConfig.findUnique({
      where: {
        academicYear_term: {
          academicYear,
          term
        }
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Create default if doesn't exist
    if (!config) {
      config = await this.createDefaultTermConfig(term, academicYear);
    }

    return config;
  }

  /**
   * Create default term configuration
   */
  private async createDefaultTermConfig(
    term: Term,
    academicYear: number
  ): Promise<any> {
    // Calculate default dates based on term
    const dates = this.getDefaultTermDates(term, academicYear);

    // Find a system user or admin to assign as creator
    const adminUser = await prisma.user.findFirst({
      where: {
        role: { in: ['ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'] }
      }
    });

    if (!adminUser) {
      throw new Error('No admin user found to create default configuration');
    }

    return await prisma.termConfig.create({
      data: {
        academicYear,
        term,
        startDate: dates.startDate,
        endDate: dates.endDate,
        formativeWeight: 30.0,
        summativeWeight: 70.0,
        isActive: false,
        isClosed: false,
        createdBy: adminUser.id
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  /**
   * Get default term dates based on Kenyan school calendar
   */
  private getDefaultTermDates(term: Term, academicYear: number): {
    startDate: Date;
    endDate: Date;
  } {
    const year = academicYear;

    switch (term) {
      case 'TERM_1':
        return {
          startDate: new Date(year, 0, 5),   // Early Jan
          endDate: new Date(year, 3, 15)     // Mid April
        };
      case 'TERM_2':
        return {
          startDate: new Date(year, 4, 1),   // May
          endDate: new Date(year, 7, 15)     // Mid August
        };
      case 'TERM_3':
        return {
          startDate: new Date(year, 8, 1),   // September
          endDate: new Date(year, 10, 30)    // November
        };
      default:
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31)
        };
    }
  }

  /**
   * Create or update term configuration
   */
  async upsertTermConfig(
    data: CreateTermConfigInput
  ): Promise<any> {
    this.validateWeights(data.formativeWeight, data.summativeWeight);

    const { academicYear, term, createdBy, ...updateData } = data;

    if (data.isActive) {
      await this.deactivateOtherTerms();
    }

    const result = await prisma.termConfig.upsert({
      where: {
        academicYear_term: {
          academicYear,
          term
        }
      },
      update: updateData,
      create: {
        academicYear,
        term,
        ...updateData,
        createdBy
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Invalidate cache
    await redisCacheService.clear();
    return result;
  }

  /**
   * Update existing term configuration
   */
  async updateTermConfig(
    id: string,
    data: UpdateTermConfigInput
  ): Promise<any> {
    if (data.formativeWeight !== undefined || data.summativeWeight !== undefined) {
      const config = await prisma.termConfig.findUnique({ where: { id } });
      if (!config) throw new Error('Term configuration not found');

      const formativeWeight = data.formativeWeight ?? config.formativeWeight;
      const summativeWeight = data.summativeWeight ?? config.summativeWeight;
      this.validateWeights(formativeWeight, summativeWeight);
    }

    if (data.isActive) {
      await this.deactivateOtherTerms();
    }

    const result = await prisma.termConfig.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Invalidate cache
    await redisCacheService.clear();
    return result;
  }

  private async deactivateOtherTerms(): Promise<void> {
    await prisma.termConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
  }

  private validateWeights(formativeWeight: number, summativeWeight: number): void {
    const total = formativeWeight + summativeWeight;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Weights must sum to 100%. Current sum: ${total}%`);
    }
  }

  async getTermConfigs(): Promise<any[]> {
    const cacheKey = 'term_configs';
    const cached = await redisCacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const configs = await prisma.termConfig.findMany({
      orderBy: [
        { academicYear: 'desc' },
        { term: 'desc' }
      ],
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    await redisCacheService.set(cacheKey, configs, 600); // 10 minutes
    return configs;
  }

  async getActiveTermConfig(): Promise<any | null> {
    const cacheKey = 'active_term_config';
    const cached = await redisCacheService.get<any>(cacheKey);
    if (cached) return cached;

    const config = await prisma.termConfig.findFirst({
      where: { isActive: true },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (config) {
      await redisCacheService.set(cacheKey, config, 600);
    }
    return config;
  }

  async getAggregationConfig(params: {
    assessmentType: FormativeAssessmentType;
    grade?: Grade | null;
    learningArea?: string;
  }): Promise<any> {
    const { assessmentType, grade, learningArea } = params;

    return await prisma.aggregationConfig.findFirst({
      where: {
        type: assessmentType,
        OR: [
          { grade, learningArea },
          { grade, learningArea: null },
          { grade: null, learningArea },
          { grade: null, learningArea: null }
        ]
      },
      orderBy: [
        { grade: 'desc' },
        { learningArea: 'desc' }
      ],
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async getClasses(institutionType?: 'PRIMARY_CBC' | 'SECONDARY'): Promise<any[]> {
    return await prisma.class.findMany({
      where: {
        archived: false,
        ...(institutionType ? { institutionType } : {}),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [
        { academicYear: 'desc' },
        { grade: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  async upsertClass(data: any): Promise<any> {
    const { id, ...classData } = data;
    const parsedAcademicYear = Number(classData.academicYear);

    const normalizedData = {
      ...classData,
      name: typeof classData.name === 'string' ? classData.name.trim() : classData.name,
      stream: typeof classData.stream === 'string' ? (classData.stream.trim() || null) : (classData.stream || null),
      teacherId: typeof classData.teacherId === 'string' ? (classData.teacherId.trim() || null) : (classData.teacherId || null),
      room: typeof classData.room === 'string' ? (classData.room.trim() || null) : (classData.room || null),
      academicYear: Number.isFinite(parsedAcademicYear) ? parsedAcademicYear : new Date().getFullYear(),
      capacity: this.normalizeClassCapacity(classData.capacity),
      term: classData.term || 'TERM_1',
      active: typeof classData.active === 'boolean' ? classData.active : true
    };

    if (id) {
      return await prisma.class.update({
        where: { id },
        data: normalizedData,
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } }
        }
      });
    } else {
      const classCode = await this.generateClassCode();

      return await prisma.class.create({
        data: {
          classCode,
          ...normalizedData
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } }
        }
      });
    }
  }

  async deleteClass(id: string): Promise<void> {
    const enrollmentCount = await prisma.classEnrollment.count({ where: { classId: id } });
    if (enrollmentCount > 0) throw new Error('Cannot delete class with enrolled learners.');
    await prisma.class.delete({ where: { id } });
  }

  private validateAggregationStrategy(strategy: AggregationStrategy, nValue?: number | null, weight?: number | null): void {
    if ((strategy === 'BEST_N' || strategy === 'DROP_LOWEST_N') && (!nValue || nValue <= 0)) {
      throw new Error(`Strategy ${strategy} requires a positive nValue`);
    }
  }

  async getStreamConfigs(): Promise<any[]> {
    return await prisma.stream.findMany({
      where: { archived: false },
      orderBy: { name: 'asc' }
    });
  }

  async upsertStreamConfig(data: any): Promise<any> {
    const { name } = data;
    return await prisma.stream.upsert({
      where: { name },
      update: { active: true, archived: false },
      create: { name, active: true }
    });
  }

  async deleteStreamConfig(id: string): Promise<void> {
    await prisma.stream.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() }
    });
  }

  async getAggregationConfigs(): Promise<any[]> {
    const cacheKey = 'aggregation_configs';
    const cached = await redisCacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const configs = await prisma.aggregationConfig.findMany({
      where: { archived: false },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    await redisCacheService.set(cacheKey, configs, 600);
    return configs;
  }

  async getSpecificAggregationConfig(params: { type: FormativeAssessmentType; grade?: Grade | null }): Promise<any> {
    const { type, grade } = params;
    return await prisma.aggregationConfig.findFirst({
      where: {
        type,
        grade,
        archived: false
      }
    });
  }

  async createAggregationConfig(data: any): Promise<any> {
    this.validateAggregationStrategy(data.strategy, data.nValue, data.weight);
    return await prisma.aggregationConfig.create({
      data,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
  }

  async updateAggregationConfig(id: string, data: any): Promise<any> {
    if (data.strategy) {
      this.validateAggregationStrategy(data.strategy, data.nValue, data.weight);
    }
    return await prisma.aggregationConfig.update({
      where: { id },
      data,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
  }

  async deleteAggregationConfig(id: string): Promise<void> {
    await prisma.aggregationConfig.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() }
    });
  }

  async getTermConfigurations(params: { term: Term; academicYear: number }): Promise<TermConfiguration> {
    const termConfig = await this.getTermConfig(params);
    const aggregationConfigs = await this.getAggregationConfigs();
    return { termConfig, aggregationConfigs };
  }
}

export const configService = new ConfigService();
