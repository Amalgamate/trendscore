/**
 * LMSSettingsService
 *
 * Manages per-school LMS configuration with Redis-backed caching.
 *
 * Cache strategy:
 *   - GET:    read from `lms:settings:{schoolId}` (TTL 10 min);
 *             on miss, query DB (create default record if none exists),
 *             populate cache, and return.
 *   - UPDATE: upsert settings in DB, delete cache key, return updated record.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 22.1
 *
 * @module services/lms-settings.service
 */

import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';
import type { LMSSettings } from '@prisma/client';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Redis cache TTL for LMS settings: 10 minutes */
const SETTINGS_TTL_SECONDS = 10 * 60;

/** Build the cache key for a school's LMS settings */
const cacheKey = (schoolId: string) => `lms:settings:${schoolId}`;

// ─── Updateable fields type ───────────────────────────────────────────────────

/**
 * All 23 configurable fields that may be supplied in a PUT body.
 * Every field is optional — callers supply only the subset they want to change.
 */
export type LMSSettingsUpdateInput = {
  enableLearning?: boolean;
  enableMarketplace?: boolean;
  enableAI?: boolean;
  enableRevisionLibrary?: boolean;
  allowLateSubmission?: boolean;
  allowResubmission?: boolean;
  maxUploadSizeMB?: number;
  allowedFileTypes?: string[];
  assignmentDueTime?: string;
  enableComments?: boolean;
  enableStudentQuestions?: boolean;
  enableDownloads?: boolean;
  enableGamification?: boolean;
  enableXP?: boolean;
  enableBadges?: boolean;
  enableLeaderboards?: boolean;
  enableStreaks?: boolean;
  notifyParents?: boolean;
  showFeedbackToParents?: boolean;
  showProgressToParents?: boolean;
  marketplaceRevenuePct?: number;
  requireApproval?: boolean;
  allowFreeContent?: boolean;
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSSettingsService {
  /**
   * Retrieve the LMS settings for a school.
   *
   * Checks the Redis cache first (key: `lms:settings:{schoolId}`).
   * On a cache miss, queries the database. If no record exists yet,
   * creates a default record (all Prisma defaults apply) and caches it.
   *
   * @param schoolId  The authenticated school's ID
   * @returns         The LMSSettings record (always non-null)
   */
  static async getSettings(schoolId: string): Promise<LMSSettings> {
    // 1. Try cache
    const cached = await redisCacheService.get<LMSSettings>(cacheKey(schoolId));
    if (cached) return cached;

    // 2. Query DB
    let settings = await prisma.lMSSettings.findUnique({
      where: { schoolId },
    });

    // 3. Create default record if none exists (Req 16.1)
    if (!settings) {
      settings = await prisma.lMSSettings.create({
        data: { schoolId },
      });
    }

    // 4. Populate cache
    await redisCacheService.set(cacheKey(schoolId), settings, SETTINGS_TTL_SECONDS);

    return settings;
  }

  /**
   * Update LMS settings for a school.
   *
   * Upserts the record (creates if missing), deletes the stale cache entry,
   * and returns the updated settings.
   *
   * @param schoolId  The authenticated school's ID
   * @param data      Partial set of the 23 configurable fields
   * @returns         The updated LMSSettings record
   */
  static async updateSettings(
    schoolId: string,
    data: LMSSettingsUpdateInput,
  ): Promise<LMSSettings> {
    // Upsert — creates if record doesn't exist, updates if it does
    const updated = await prisma.lMSSettings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        ...data,
      },
      update: data,
    });

    // Invalidate cache so next GET reads fresh data (Req 16.4)
    await redisCacheService.delete(cacheKey(schoolId));

    return updated;
  }
}
