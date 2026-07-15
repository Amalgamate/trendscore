/**
 * LMSResourceService
 *
 * Manages the Revision Library: uploading, searching, downloading, and
 * bookmarking learning resources. All operations are school-scoped
 * (multi-tenant safe).
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 22.3
 *
 * @module services/lms-resource.service
 */

import crypto from 'crypto';
import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';
import { documentService } from './document.service';
import { ApiError } from '../utils/error.util';
import type {
  LearningResource,
  LearningBookmark,
  ResourceType,
  DifficultyLevel,
  Prisma,
} from '@prisma/client';

// ─── Cache helpers ────────────────────────────────────────────────────────────

const RESOURCE_CACHE_TTL = 300; // 5 minutes

function resourceCacheKey(schoolId: string, filterHash: string): string {
  return `lms:resources:${schoolId}:${filterHash}`;
}

async function invalidateResourceCache(schoolId: string): Promise<void> {
  await redisCacheService.deleteByPrefix(`lms:resources:${schoolId}:`);
}

async function invalidateAnalyticsCache(schoolId: string): Promise<void> {
  await redisCacheService.deleteByPrefix(`lms:analytics:overview:${schoolId}:`);
}

/**
 * Build a short deterministic hash from a filter object for use as a cache
 * key suffix. Stable across object key ordering.
 */
function hashFilters(filters: ResourceFilters): string {
  const stable = JSON.stringify(
    Object.fromEntries(Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))),
  );
  return crypto.createHash('sha1').update(stable).digest('hex').substring(0, 16);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateResourceInput {
  title: string;
  learningAreaId: string;
  resourceType: ResourceType;
  schoolId: string;
  classId?: string;
  description?: string;
  externalUrl?: string;
  thumbnailUrl?: string;
  topic?: string;
  term?: number | string;
  year?: number | string;
  difficulty?: DifficultyLevel;
  language?: string;
  tags?: string[] | string;
  isPublic?: boolean;
}

export type UpdateResourceInput = Partial<
  Omit<CreateResourceInput, 'schoolId' | 'learningAreaId' | 'resourceType'>
> & {
  learningAreaId?: string;
  resourceType?: ResourceType;
};

export interface ResourceFilters {
  query?: string;
  classId?: string;
  learningAreaId?: string;
  resourceType?: ResourceType;
  topic?: string;
  term?: number;
  year?: number;
  difficulty?: DifficultyLevel;
  language?: string;
  page?: number;
  limit?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSResourceService {
  // ══════════════════════════════════════════════════════════════════════════
  // TASK 15.1 — CRUD
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upload a new learning resource.
   *
   * - Validates required fields: title, learningAreaId, resourceType.
   * - Uploads file to Cloudinary under `lms/resources/{schoolId}/`.
   * - Creates a `LearningResource` record.
   * - Invalidates the resource cache for this school.
   *
   * Requirements: 8.1, 8.2, 8.3, 22.3
   */
  static async createResource(
    data: CreateResourceInput,
    uploaderId: string,
    file?: Express.Multer.File,
  ): Promise<LearningResource> {
    const { title, learningAreaId, resourceType, schoolId } = data;
    const term = LMSResourceService.parseOptionalInteger(data.term, 'Term');
    const year = LMSResourceService.parseOptionalInteger(data.year, 'Year');
    const tags = LMSResourceService.parseOptionalTags(data.tags);

    if (!title || !learningAreaId || !resourceType) {
      throw new ApiError(
        422,
        'Missing required fields: title, learningAreaId, resourceType',
      ).withCode('LMS_RESOURCE_MISSING_FIELDS');
    }

    if (!SUPPORTED_RESOURCE_TYPES.includes(resourceType)) {
      throw new ApiError(422, 'Resource type is invalid').withCode('LMS_RESOURCE_INVALID_TYPE');
    }

    if (data.difficulty && !SUPPORTED_DIFFICULTIES.includes(data.difficulty)) {
      throw new ApiError(422, 'Difficulty is invalid').withCode('LMS_RESOURCE_INVALID_DIFFICULTY');
    }

    // Upload file to Cloudinary when provided
    let fileUrl: string | undefined;
    let fileType: string | undefined;
    let fileSize: number | undefined;

    if (file) {
      const folder = `lms/resources/${schoolId}`;
      const result = await documentService.uploadFile(file, {
        folder,
        resourceType: 'auto',
      });
      fileUrl = result.url;
      fileType = result.format;
      fileSize = result.size;
    }

    const resource = await prisma.learningResource.create({
      data: {
        title,
        learningAreaId,
        resourceType,
        schoolId,
        uploadedById: uploaderId,
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.externalUrl !== undefined && { externalUrl: data.externalUrl }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.topic !== undefined && { topic: data.topic }),
        ...(term !== undefined && { term }),
        ...(year !== undefined && { year }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.language !== undefined && { language: data.language }),
        ...(tags !== undefined && { tags }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileType !== undefined && { fileType }),
        ...(fileSize !== undefined && { fileSize }),
      },
    });

    await invalidateResourceCache(schoolId);
    return resource;
  }

  /**
   * Full-text search over resources for a school.
   *
   * - Searches title, description, and tags with `mode: 'insensitive'`.
   * - Supports filtering by class, subject, resource type, topic, term, year,
   *   difficulty, and language.
   * - Paginated (default: page 1, limit 20).
   * - Results cached per school + filter combination (TTL 5 min).
   *
   * Requirements: 8.4, 8.5, 22.3
   */
  static async searchResources(
    filters: ResourceFilters,
    schoolId: string,
  ): Promise<{ resources: LearningResource[]; pagination: object }> {
    const {
      query,
      classId,
      learningAreaId,
      resourceType,
      topic,
      term,
      year,
      difficulty,
      language,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    // Attempt cache hit
    const filterHash = hashFilters(filters);
    const cacheKey = resourceCacheKey(schoolId, filterHash);
    const cached = await redisCacheService.get<{
      resources: LearningResource[];
      pagination: object;
    }>(cacheKey);
    if (cached) return cached;

    // Build WHERE clause
    const where: Prisma.LearningResourceWhereInput = {
      schoolId,
      archived: false,
      ...(classId && { classId }),
      ...(learningAreaId && { learningAreaId }),
      ...(resourceType && { resourceType }),
      ...(topic && { topic: { contains: topic, mode: 'insensitive' } }),
      ...(term !== undefined && { term }),
      ...(year !== undefined && { year }),
      ...(difficulty && { difficulty }),
      ...(language && { language: { equals: language, mode: 'insensitive' } }),
      // Full-text search across title, description, and tags
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          {
            tags: {
              hasSome: [query],
            },
          },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.learningResource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.learningResource.count({ where }),
    ]);

    const result = {
      resources: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };

    // Populate cache
    await redisCacheService.set(cacheKey, result, RESOURCE_CACHE_TTL);

    return result;
  }

  /**
   * Return full details for a single resource and increment its view count.
   * Requirements: 8.5, 8.8
   */
  static async getResourceDetail(
    id: string,
    schoolId: string,
  ): Promise<LearningResource> {
    const resource = await prisma.learningResource.findUnique({
      where: { id },
    });

    if (!resource || resource.schoolId !== schoolId || resource.archived) {
      throw new ApiError(404, 'Resource not found').withCode('LMS_RESOURCE_NOT_FOUND');
    }

    // Increment viewCount in the background (fire-and-forget)
    void prisma.learningResource
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err: any) =>
        console.error('[LMSResourceService] viewCount increment error:', err?.message),
      );

    return resource;
  }

  /**
   * Partially update a resource's metadata.
   * Invalidates the resource cache for this school.
   * Requirements: 8.9
   */
  static async updateResource(
    id: string,
    schoolId: string,
    data: UpdateResourceInput,
  ): Promise<LearningResource> {
    const existing = await prisma.learningResource.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new ApiError(404, 'Resource not found').withCode('LMS_RESOURCE_NOT_FOUND');
    }

    const term = LMSResourceService.parseOptionalInteger(data.term, 'Term');
    const year = LMSResourceService.parseOptionalInteger(data.year, 'Year');
    const tags = LMSResourceService.parseOptionalTags(data.tags);

    if (data.resourceType && !SUPPORTED_RESOURCE_TYPES.includes(data.resourceType)) {
      throw new ApiError(422, 'Resource type is invalid').withCode('LMS_RESOURCE_INVALID_TYPE');
    }

    if (data.difficulty && !SUPPORTED_DIFFICULTIES.includes(data.difficulty)) {
      throw new ApiError(422, 'Difficulty is invalid').withCode('LMS_RESOURCE_INVALID_DIFFICULTY');
    }

    const updated = await prisma.learningResource.update({
      where: { id, schoolId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.learningAreaId !== undefined && { learningAreaId: data.learningAreaId }),
        ...(data.resourceType !== undefined && { resourceType: data.resourceType }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.externalUrl !== undefined && { externalUrl: data.externalUrl }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.topic !== undefined && { topic: data.topic }),
        ...(term !== undefined && { term }),
        ...(year !== undefined && { year }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.language !== undefined && { language: data.language }),
        ...(tags !== undefined && { tags }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    await invalidateResourceCache(schoolId);
    return updated;
  }

  /**
   * Archive a resource (sets archived=true).
   * Does NOT delete the file from Cloudinary.
   * Invalidates the resource cache for this school.
   * Requirements: 8.9
   */
  static async archiveResource(
    id: string,
    schoolId: string,
  ): Promise<LearningResource> {
    const existing = await prisma.learningResource.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new ApiError(404, 'Resource not found').withCode('LMS_RESOURCE_NOT_FOUND');
    }

    const archived = await prisma.learningResource.update({
      where: { id, schoolId },
      data: { archived: true },
    });

    await invalidateResourceCache(schoolId);
    return archived;
  }

  /**
   * Track a resource download.
   *
   * - Verifies the resource belongs to the requester's school.
   * - Generates a signed Cloudinary delivery URL (1-hour expiry).
   * - Increments `downloadCount` on the resource record.
   * - Returns the signed URL to the caller.
   *
   * Requirements: 8.6, 8.8, 22.3
   */
  static async trackDownload(
    resourceId: string,
    learnerId: string,
    schoolId: string,
  ): Promise<string> {
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || resource.schoolId !== schoolId || resource.archived) {
      throw new ApiError(404, 'Resource not found').withCode('LMS_RESOURCE_NOT_FOUND');
    }

    // Derive the public ID from the stored Cloudinary URL so we can generate a
    // signed URL. If no file URL is available, fall back to the external URL.
    let downloadUrl: string;
    if (resource.fileUrl) {
      // Extract the Cloudinary public_id from the secure_url so we can sign it.
      // Cloudinary secure_url format: https://res.cloudinary.com/<cloud>/.../<public_id>.<ext>
      // We use documentService.generateSignedUrl() for consistency with the rest
      // of the codebase. It accepts a publicId.
      const publicId = extractCloudinaryPublicId(resource.fileUrl);
      if (publicId) {
        downloadUrl = await documentService.generateSignedUrl(publicId, 3600);
      } else {
        // If extraction fails fall back to the raw stored URL
        downloadUrl = resource.fileUrl;
      }
    } else if (resource.externalUrl) {
      downloadUrl = resource.externalUrl;
    } else {
      throw new ApiError(409, 'Resource has no downloadable file').withCode(
        'LMS_RESOURCE_NO_FILE',
      );
    }

    // Increment downloadCount in the background
    void prisma.learningResource
      .update({
        where: { id: resourceId },
        data: { downloadCount: { increment: 1 } },
      })
      .catch((err: any) =>
        console.error('[LMSResourceService] downloadCount increment error:', err?.message),
      );

    await invalidateAnalyticsCache(schoolId);

    return downloadUrl;
  }

  /**
   * Toggle a bookmark on a resource for a learner.
   *
   * - If a bookmark already exists: deletes it, returns `false`.
   * - If no bookmark exists: creates it, returns `true`.
   *
   * Requirements: 8.7
   */
  static async toggleBookmark(
    resourceId: string,
    learnerId: string,
    schoolId: string,
  ): Promise<boolean> {
    // Verify resource exists in this school
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
      select: { schoolId: true, archived: true },
    });

    if (!resource || resource.schoolId !== schoolId || resource.archived) {
      throw new ApiError(404, 'Resource not found').withCode('LMS_RESOURCE_NOT_FOUND');
    }

    const existing = await prisma.learningBookmark.findUnique({
      where: {
        learnerId_resourceId: { learnerId, resourceId },
      },
    });

    if (existing) {
      // Remove bookmark → return false (no longer bookmarked)
      await prisma.learningBookmark.delete({
        where: { id: existing.id },
      });
      return false;
    }

    // Create bookmark → return true (now bookmarked)
    await prisma.learningBookmark.create({
      data: {
        learnerId,
        resourceId,
        schoolId,
      },
    });
    return true;
  }

  private static parseOptionalInteger(
    value: number | string | null | undefined,
    label: string,
  ): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ApiError(422, `${label} must be a positive whole number`);
    }
    return parsed;
  }

  private static parseOptionalTags(value: string[] | string | undefined): string[] | undefined {
    if (value === undefined) return undefined;
    const tags = Array.isArray(value) ? value : value.split(',');
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUPPORTED_RESOURCE_TYPES: string[] = [
  'NOTES', 'PAST_PAPER', 'SCHEME', 'WORKSHEET', 'PROJECT',
  'EXPERIMENT', 'CBC_ACTIVITY', 'HOLIDAY_PACKAGE', 'VIDEO', 'OTHER',
];

const SUPPORTED_DIFFICULTIES: string[] = ['EASY', 'MEDIUM', 'HARD'];

/**
 * Extract a Cloudinary public_id from a secure_url.
 *
 * Example:
 *   https://res.cloudinary.com/mycloud/image/upload/v1234/lms/resources/abc/file_xyz.pdf
 *   → lms/resources/abc/file_xyz
 *
 * Returns `null` if the URL doesn't look like a Cloudinary URL.
 */
function extractCloudinaryPublicId(secureUrl: string): string | null {
  try {
    const url = new URL(secureUrl);
    if (!url.hostname.includes('cloudinary.com')) return null;

    // Path looks like: /<cloud>/image/upload/v<version>/<public_id>.<ext>
    // or without version:           /<cloud>/image/upload/<public_id>.<ext>
    const parts = url.pathname.split('/');
    // Find 'upload' segment index
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;

    // Everything after 'upload' (skip optional version segment v\d+)
    const afterUpload = parts.slice(uploadIdx + 1);
    const filtered = afterUpload.filter((p) => !/^v\d+$/.test(p));

    // Strip extension from the last segment
    const last = filtered[filtered.length - 1];
    const dotIdx = last.lastIndexOf('.');
    if (dotIdx !== -1) {
      filtered[filtered.length - 1] = last.substring(0, dotIdx);
    }

    return filtered.join('/');
  } catch {
    return null;
  }
}
