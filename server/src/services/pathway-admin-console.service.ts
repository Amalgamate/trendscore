import { createHash } from 'crypto';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

type ReferenceType = 'PATHWAY' | 'TRACK' | 'COMBINATION' | 'CAREER';
const allowedTypes = new Set<ReferenceType>(['PATHWAY', 'TRACK', 'COMBINATION', 'CAREER']);

function assertType(value: string): ReferenceType {
  const type = value.toUpperCase() as ReferenceType;
  if (!allowedTypes.has(type)) throw new ApiError(400, 'Unsupported reference type');
  return type;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new ApiError(400, 'CSV must include a header and at least one data row');
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

const list = (value?: string) => String(value ?? '').split(/[;|]/).map((item) => item.trim()).filter(Boolean);

async function referenceRecord(type: ReferenceType, id: string) {
  if (type === 'PATHWAY') return prisma.pathway.findUnique({ where: { id } });
  if (type === 'TRACK') return prisma.pathwayTrack.findUnique({ where: { id } });
  if (type === 'COMBINATION') return prisma.subjectCombinationRule.findUnique({ where: { id }, include: { items: true } });
  return prisma.career.findUnique({ where: { id } });
}

async function createVersion(type: ReferenceType, id: string, status: string, actorId?: string, reason?: string) {
  const record = await referenceRecord(type, id);
  if (!record) throw new ApiError(404, 'Reference record not found');
  const latest = await prisma.pathwayContentVersion.findFirst({ where: { entityType: type, entityId: id }, orderBy: { version: 'desc' } });
  return prisma.pathwayContentVersion.create({
    data: { entityType: type, entityId: id, version: (latest?.version ?? 0) + 1, status, snapshot: record as any, createdById: actorId, reason },
  });
}

export const pathwayAdminConsoleService = {
  dashboard: async () => {
    const [pathways, tracks, combinations, careers, schools, pendingCorrections, imports, lowConfidence, decisions] = await Promise.all([
      prisma.pathway.count({ where: { active: true } }), prisma.pathwayTrack.count({ where: { active: true } }),
      prisma.subjectCombinationRule.count({ where: { active: true } }), prisma.career.count({ where: { active: true } }),
      prisma.seniorSchool.count({ where: { active: true } }), prisma.schoolCorrection.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.pathwayImportJob.count({ where: { status: { in: ['READY_FOR_REVIEW', 'VALIDATION_FAILED', 'FAILED'] } } }),
      prisma.schoolMatchScore.count({ where: { score: { lt: 55 } } }), prisma.decisionPlan.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { pathways, tracks, combinations, careers, schools, pendingCorrections, imports, lowConfidence, decisions };
  },

  listReferences: async (rawType: string) => {
    const type = assertType(rawType);
    if (type === 'PATHWAY') return prisma.pathway.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { tracks: true, combinationRules: true } } } });
    if (type === 'TRACK') return prisma.pathwayTrack.findMany({ orderBy: { name: 'asc' }, include: { pathway: { select: { id: true, code: true, name: true } } } });
    if (type === 'COMBINATION') return prisma.subjectCombinationRule.findMany({ orderBy: { name: 'asc' }, include: { pathway: { select: { id: true, name: true } }, track: { select: { id: true, name: true } }, items: { include: { officialLearningArea: true } } } });
    return prisma.career.findMany({ orderBy: { title: 'asc' }, include: { family: true } });
  },

  referenceImpact: async (rawType: string, id: string) => {
    const type = assertType(rawType);
    const record = await referenceRecord(type, id) as any;
    if (!record) throw new ApiError(404, 'Reference record not found');
    if (type === 'PATHWAY') {
      const [tracks, combinations, learnerSelections, schools] = await Promise.all([
        prisma.pathwayTrack.count({ where: { pathwayId: id } }),
        prisma.subjectCombinationRule.count({ where: { pathwayId: id } }),
        prisma.learnerPathwaySelection.count({ where: { pathwayId: id } }),
        prisma.seniorSchool.count({ where: { active: true, pathwayCodes: { has: record.code } } }),
      ]);
      return { entity: { type, id, code: record.code, name: record.name }, affected: { tracks, combinations, learnerSelections, schools } };
    }
    if (type === 'TRACK') {
      const [combinations, learnerSelections, schools] = await Promise.all([
        prisma.subjectCombinationRule.count({ where: { trackId: id } }),
        prisma.learnerPathwaySelection.count({ where: { trackId: id } }),
        prisma.seniorSchool.count({ where: { active: true, trackCodes: { has: record.code } } }),
      ]);
      return { entity: { type, id, code: record.code, name: record.name }, affected: { combinations, learnerSelections, schools } };
    }
    if (type === 'COMBINATION') {
      const [learnerSelections, schools] = await Promise.all([
        prisma.learnerPathwaySelection.count({ where: { combinationRuleId: id } }),
        prisma.seniorSchool.count({ where: { active: true, combinationCodes: { has: record.code } } }),
      ]);
      return { entity: { type, id, code: record.code, name: record.name }, affected: { learnerSelections, schools, subjects: record.items?.length ?? 0 } };
    }
    const [learnerSaves, learnerMatches] = await Promise.all([
      prisma.learnerCareerSave.count({ where: { careerId: id } }),
      prisma.learnerCareerMatch.count({ where: { careerId: id } }),
    ]);
    return { entity: { type, id, code: record.code, name: record.title }, affected: { learnerSaves, learnerMatches } };
  },

  saveReference: async (rawType: string, data: any, actorId?: string) => {
    const type = assertType(rawType);
    if (!data.code?.trim()) throw new ApiError(400, 'code is required');
    if (data.id) await createVersion(type, data.id, (await referenceRecord(type, data.id) as any)?.active ? 'PUBLISHED' : 'DRAFT', actorId, 'Snapshot before edit');
    if (type === 'PATHWAY') {
      if (!data.name?.trim()) throw new ApiError(400, 'name is required');
      return data.id ? prisma.pathway.update({ where: { id: data.id }, data: { code: data.code, name: data.name, description: data.description ?? null } }) : prisma.pathway.create({ data: { code: data.code, name: data.name, description: data.description ?? null, active: false } });
    }
    if (type === 'TRACK') {
      if (!data.pathwayId || !data.name?.trim()) throw new ApiError(400, 'pathwayId and name are required');
      return data.id ? prisma.pathwayTrack.update({ where: { id: data.id }, data: { pathwayId: data.pathwayId, code: data.code, name: data.name, description: data.description ?? null } }) : prisma.pathwayTrack.create({ data: { pathwayId: data.pathwayId, code: data.code, name: data.name, description: data.description ?? null, active: false } });
    }
    if (type === 'COMBINATION') {
      if (!data.pathwayId || !data.trackId || !data.name?.trim()) throw new ApiError(400, 'pathwayId, trackId and name are required');
      const subjectIds: string[] | null = Array.isArray(data.subjectIds)
        ? Array.from(new Set<string>(data.subjectIds.map((value: unknown) => String(value)).filter(Boolean)))
        : null;
      return prisma.$transaction(async (tx) => {
        const rule = data.id
          ? await tx.subjectCombinationRule.update({ where: { id: data.id }, data: { pathwayId: data.pathwayId, trackId: data.trackId, code: data.code, name: data.name, officialSource: data.officialSource ?? null } })
          : await tx.subjectCombinationRule.create({ data: { pathwayId: data.pathwayId, trackId: data.trackId, code: data.code, name: data.name, officialSource: data.officialSource ?? null, active: false } });
        if (subjectIds) {
          await tx.subjectCombinationRuleItem.deleteMany({ where: { ruleId: rule.id } });
          if (subjectIds.length > 0) {
            await tx.subjectCombinationRuleItem.createMany({
              data: subjectIds.map((officialLearningAreaId, position) => ({ ruleId: rule.id, officialLearningAreaId, position: position + 1 })),
            });
          }
        }
        return tx.subjectCombinationRule.findUnique({ where: { id: rule.id }, include: { items: { include: { officialLearningArea: true }, orderBy: { position: 'asc' } } } });
      });
    }
    if (!data.title?.trim()) throw new ApiError(400, 'title is required');
    return data.id ? prisma.career.update({ where: { id: data.id }, data: { code: data.code, title: data.title, shortSummary: data.shortSummary ?? null, recommendedPathway: data.recommendedPathway ?? null, recommendedTrackCode: data.recommendedTrackCode ?? null, source: data.source ?? null } }) : prisma.career.create({ data: { code: data.code, title: data.title, shortSummary: data.shortSummary ?? null, recommendedPathway: data.recommendedPathway ?? null, recommendedTrackCode: data.recommendedTrackCode ?? null, source: data.source ?? null, active: false, verificationStatus: 'DRAFT' } });
  },

  transitionReference: async (rawType: string, id: string, status: 'PUBLISHED' | 'RETIRED', actorId?: string, reason?: string) => {
    const type = assertType(rawType);
    const record = await referenceRecord(type, id);
    if (!record) throw new ApiError(404, 'Reference record not found');
    if (status === 'PUBLISHED' && type === 'CAREER' && !(record as any).source) throw new ApiError(400, 'Career source is required before publishing');
    const active = status === 'PUBLISHED';
    if (type === 'PATHWAY') await prisma.pathway.update({ where: { id }, data: { active } });
    else if (type === 'TRACK') await prisma.pathwayTrack.update({ where: { id }, data: { active } });
    else if (type === 'COMBINATION') await prisma.subjectCombinationRule.update({ where: { id }, data: { active } });
    else await prisma.career.update({ where: { id }, data: { active, verificationStatus: active ? 'SOURCE_VERIFIED' : 'RETIRED', publishedAt: active ? new Date() : undefined, retiredAt: active ? null : new Date() } });
    return createVersion(type, id, status, actorId, reason);
  },

  listVersions: async (rawType?: string, entityId?: string) => prisma.pathwayContentVersion.findMany({
    where: { ...(rawType ? { entityType: assertType(rawType) } : {}), ...(entityId ? { entityId } : {}) }, orderBy: { createdAt: 'desc' }, take: 100,
  }),

  rollbackVersion: async (versionId: string, actorId?: string, reason?: string) => {
    const version = await prisma.pathwayContentVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new ApiError(404, 'Version not found');
    const type = assertType(version.entityType);
    const snapshot = version.snapshot as any;
    const existing = await referenceRecord(type, version.entityId) as any;
    if (!existing) throw new ApiError(404, 'Reference record no longer exists');
    const restored = await pathwayAdminConsoleService.saveReference(type, {
      ...snapshot,
      id: version.entityId,
      subjectIds: type === 'COMBINATION' ? (snapshot.items || []).map((item: any) => item.officialLearningAreaId).filter(Boolean) : undefined,
    }, actorId);
    await createVersion(type, version.entityId, existing.active ? 'PUBLISHED' : 'DRAFT', actorId, reason || `Restored from version ${version.version}`);
    return { restored, sourceVersion: version.version };
  },

  listRules: async () => prisma.pathwayRuleSet.findMany({ orderBy: [{ domain: 'asc' }, { version: 'desc' }] }),
  createRule: async (data: any, actorId?: string) => {
    if (!data.domain || !data.name || !data.config || typeof data.config !== 'object') throw new ApiError(400, 'domain, name and config are required');
    const latest = await prisma.pathwayRuleSet.findFirst({ where: { domain: data.domain }, orderBy: { version: 'desc' } });
    return prisma.pathwayRuleSet.create({ data: { domain: String(data.domain), name: String(data.name), version: (latest?.version ?? 0) + 1, config: data.config, reason: data.reason ?? null, createdById: actorId } });
  },
  publishRule: async (id: string) => prisma.$transaction(async (tx) => {
    const rule = await tx.pathwayRuleSet.findUnique({ where: { id } });
    if (!rule) throw new ApiError(404, 'Rule set not found');
    const config = rule.config as any;
    const weights = config?.weights && typeof config.weights === 'object' ? Object.values(config.weights) : [];
    if (weights.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) throw new ApiError(400, 'Rule weights must be non-negative numbers');
    if (weights.length && weights.reduce<number>((sum, value) => sum + Number(value), 0) <= 0) throw new ApiError(400, 'At least one rule weight must be greater than zero');
    await tx.pathwayRuleSet.updateMany({ where: { domain: rule.domain, status: 'PUBLISHED' }, data: { status: 'RETIRED' } });
    return tx.pathwayRuleSet.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  }),

  createImport: async (data: { domain?: string; fileName?: string; csv?: string; idempotencyKey?: string }, actorId?: string) => {
    const domain = String(data.domain ?? '').toUpperCase();
    if (!['SCHOOLS', 'CAREERS', 'PATHWAYS'].includes(domain)) throw new ApiError(400, 'domain must be SCHOOLS, CAREERS or PATHWAYS');
    if (!data.csv?.trim()) throw new ApiError(400, 'CSV content is required');
    const rows = parseCsv(data.csv);
    const required = domain === 'SCHOOLS' ? ['name', 'county'] : ['code', domain === 'CAREERS' ? 'title' : 'name'];
    const errors = rows.flatMap((row, index) => required.filter((field) => !row[field]).map((field) => ({ row: index + 2, field, message: `${field} is required` })));
    const duplicateKeys = new Set<string>();
    const seen = new Set<string>();
    rows.forEach((row) => { const key = domain === 'SCHOOLS' ? (row.knecCode || `${row.name}:${row.county}`).toUpperCase() : String(row.code || '').toUpperCase(); if (!key) return; if (seen.has(key)) duplicateKeys.add(key); seen.add(key); });
    duplicateKeys.forEach((key) => errors.push({ row: 0, field: 'duplicate', message: `Duplicate key ${key}` }));
    let existingRecords = 0;
    if (domain === 'SCHOOLS') {
      const conditions = rows.filter((row) => row.name && row.county).map((row) => row.knecCode
        ? { knecCode: row.knecCode }
        : { name: { equals: row.name, mode: 'insensitive' as const }, county: { equals: row.county, mode: 'insensitive' as const } });
      existingRecords = conditions.length ? await prisma.seniorSchool.count({ where: { OR: conditions } }) : 0;
    } else {
      const codes = rows.map((row) => row.code).filter(Boolean);
      existingRecords = domain === 'CAREERS'
        ? await prisma.career.count({ where: { code: { in: codes } } })
        : await prisma.pathway.count({ where: { code: { in: codes } } });
    }
    const impact = { creates: Math.max(0, rows.length - existingRecords), updates: existingRecords, duplicates: duplicateKeys.size, invalidRows: new Set(errors.filter((error) => error.row > 0).map((error) => error.row)).size };
    const idempotencyKey = data.idempotencyKey || createHash('sha256').update(`${domain}:${data.csv}`).digest('hex');
    return prisma.pathwayImportJob.create({ data: { domain, fileName: data.fileName || `${domain.toLowerCase()}.csv`, status: errors.length ? 'VALIDATION_FAILED' : 'READY_FOR_REVIEW', payload: rows as any, preview: { rows: rows.slice(0, 20), impact } as any, errors: errors as any, totalRows: rows.length, failedRows: impact.invalidRows, idempotencyKey, createdById: actorId } });
  },
  listImports: async () => prisma.pathwayImportJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  approveImport: async (id: string, actorId?: string) => {
    const job = await prisma.pathwayImportJob.findUnique({ where: { id } });
    if (!job) throw new ApiError(404, 'Import not found');
    if (job.status !== 'READY_FOR_REVIEW') throw new ApiError(409, 'Only validated imports can be approved');
    const rows = job.payload as Array<Record<string, string>>;
    let processed = 0;
    const rowErrors: Array<{ row: number; message: string }> = [];
    await prisma.pathwayImportJob.update({ where: { id }, data: { status: 'PROCESSING', approvedById: actorId, approvedAt: new Date() } });
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        if (job.domain === 'SCHOOLS') await prisma.seniorSchool.upsert({ where: { knecCode: row.knecCode || `IMPORT-${id}-${index}` }, update: { name: row.name, county: row.county, subCounty: row.subCounty || null, schoolType: row.schoolType || 'DAY', gender: row.gender || 'MIXED', pathwayCodes: list(row.pathwayCodes), dataSource: `CSV:${job.fileName}` }, create: { knecCode: row.knecCode || `IMPORT-${id}-${index}`, name: row.name, county: row.county, subCounty: row.subCounty || null, schoolType: row.schoolType || 'DAY', gender: row.gender || 'MIXED', pathwayCodes: list(row.pathwayCodes), dataSource: `CSV:${job.fileName}` } });
        else if (job.domain === 'CAREERS') await prisma.career.upsert({ where: { code: row.code }, update: { title: row.title, shortSummary: row.shortSummary || null, recommendedPathway: row.recommendedPathway || null, source: row.source || `CSV:${job.fileName}` }, create: { code: row.code, title: row.title, shortSummary: row.shortSummary || null, recommendedPathway: row.recommendedPathway || null, source: row.source || `CSV:${job.fileName}`, verificationStatus: 'UNVERIFIED' } });
        else await prisma.pathway.upsert({ where: { code: row.code }, update: { name: row.name, description: row.description || null }, create: { code: row.code, name: row.name, description: row.description || null, active: false } });
        processed += 1;
      } catch (error: any) { rowErrors.push({ row: index + 2, message: error?.message || 'Import failed' }); }
    }
    return prisma.pathwayImportJob.update({ where: { id }, data: { status: rowErrors.length ? (processed ? 'PARTIALLY_COMPLETED' : 'FAILED') : 'COMPLETED', processedRows: processed, failedRows: rowErrors.length, errors: rowErrors as any, completedAt: new Date() } });
  },

  dataQuality: async () => {
    const now = Date.now();
    const staleBefore = new Date(now - 365 * 24 * 60 * 60 * 1000);
    const [missingSchoolCodes, missingCombinations, unverifiedSchools, staleSchools, careersWithoutSources, careersWithoutMappings, duplicateSchools, lowConfidence] = await Promise.all([
      prisma.seniorSchool.count({ where: { knecCode: null, active: true } }), prisma.seniorSchool.count({ where: { combinationCodes: { isEmpty: true }, active: true } }),
      prisma.seniorSchool.count({ where: { verified: false, active: true } }), prisma.seniorSchool.count({ where: { active: true, OR: [{ verifiedAt: null }, { verifiedAt: { lt: staleBefore } }] } }),
      prisma.career.count({ where: { active: true, OR: [{ source: null }, { source: '' }] } }), prisma.career.count({ where: { active: true, recommendedPathway: null } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM (SELECT lower(name), lower(county), COUNT(*) FROM senior_schools WHERE active = true GROUP BY lower(name), lower(county) HAVING COUNT(*) > 1) d`,
      prisma.schoolMatchScore.count({ where: { score: { lt: 55 } } }),
    ]);
    return { generatedAt: new Date(), checks: [
      { key: 'missingSchoolCodes', label: 'Schools missing official codes', count: missingSchoolCodes }, { key: 'missingCombinations', label: 'Schools missing combination data', count: missingCombinations },
      { key: 'unverifiedSchools', label: 'Unverified schools', count: unverifiedSchools }, { key: 'staleSchools', label: 'Stale school records', count: staleSchools },
      { key: 'careersWithoutSources', label: 'Careers without sources', count: careersWithoutSources }, { key: 'careersWithoutMappings', label: 'Careers without pathway mappings', count: careersWithoutMappings },
      { key: 'duplicateSchools', label: 'Possible duplicate schools', count: Number(duplicateSchools[0]?.count ?? 0) }, { key: 'lowConfidence', label: 'Low-fit school matches', count: lowConfidence },
    ] };
  },

  analytics: async () => {
    const [pathways, careers, schools, decisions, parentReviews, counsellorNotes, revisions] = await Promise.all([
      prisma.learnerPathwaySelection.groupBy({ by: ['pathwayId'], _count: { _all: true } }), prisma.learnerCareerSave.groupBy({ by: ['supportStatus'], _count: { _all: true } }),
      prisma.learnerSchoolPreference.groupBy({ by: ['schoolId'], _count: { _all: true }, orderBy: { _count: { schoolId: 'desc' } }, take: 10 }),
      prisma.decisionPlan.groupBy({ by: ['status'], _count: { _all: true } }), prisma.decisionPlan.count({ where: { parentReviewedAt: { not: null } } }),
      prisma.counsellorNote.count(), prisma.decisionPlanRevision.count(),
    ]);
    return { pathways, careerSupport: careers, popularSchools: schools, decisions, participation: { parentReviews, counsellorNotes }, revisions };
  },

  auditLogs: async (query?: string) => prisma.auditLog.findMany({
    where: { AND: [
      { OR: [{ action: { contains: 'PATHWAY', mode: 'insensitive' } }, { action: { contains: 'CAREER', mode: 'insensitive' } }, { action: { contains: 'SCHOOL', mode: 'insensitive' } }] },
      ...(query ? [{ OR: [{ action: { contains: query, mode: 'insensitive' as const } }, { userEmail: { contains: query, mode: 'insensitive' as const } }] }] : []),
    ] }, orderBy: { createdAt: 'desc' }, take: 250,
  }),
};
