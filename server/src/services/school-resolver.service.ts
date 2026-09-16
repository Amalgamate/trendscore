/**
 * Canonical "current school" resolver for TrendSCORE's single-tenant
 * deployment model (confirmed Decision D1, TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md
 * ER-009: provisionNewSchool() hard-fails if a second non-archived School row
 * is ever created, so there is only ever one to resolve).
 *
 * Before this file existed, three independent copies of this exact query had
 * drifted out of sync:
 *   - school.controller.ts and school-provisioning.service.ts both ordered by
 *     [active desc, updatedAt desc, createdAt desc]
 *   - reportEngine.service.ts ordered by [updatedAt desc, createdAt desc]
 *     only \u2014 missing `active`.
 * In a clean single-row install these resolve identically, but if a second,
 * inactive School row ever existed (a soft-deactivated one, a bad import),
 * the eReport engine could silently read its configuration from a different
 * row than the one the School Settings UI writes to \u2014 a confusing, silent
 * failure. One shared implementation removes that possibility by construction.
 *
 * Accepts an optional Prisma client so it works both with the plain
 * singleton (`prisma`) and inside a `prisma.$transaction(async (tx) => ...)`
 * block (e.g. school-provisioning.service.ts's provisionNewSchool()).
 */
import prisma from '../config/database';

type SchoolQueryable = { school: { findFirst: (args: any) => Promise<any> } };

export async function resolveCurrentSchool(client: SchoolQueryable = prisma as unknown as SchoolQueryable) {
  return client.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}
