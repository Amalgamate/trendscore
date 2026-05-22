import { PrismaClient } from '@prisma/client';
import {
  OFFICIAL_COMBINATION_RULES,
  OFFICIAL_LEARNING_AREA_ALIASES,
  OFFICIAL_LEARNING_AREAS,
  OFFICIAL_PATHWAYS,
  OFFICIAL_TRACKS,
} from './senior-pathway-catalog.data';
import { seedSeniorPathways } from './ss-pathways.seed';

type SeedResult = {
  pathways: number;
  tracks: number;
  learningAreas: number;
  aliases: number;
  combinationRules: number;
};

export async function seedSeniorOfficialCatalog(prisma: PrismaClient): Promise<SeedResult> {
  await seedSeniorPathways(prisma);

  const pathwayIds = new Map<string, string>();
  const trackIds = new Map<string, string>();
  const officialAreaIds = new Map<string, string>();

  for (const pathway of OFFICIAL_PATHWAYS) {
    const row = await prisma.pathway.upsert({
      where: { code: pathway.code },
      update: { name: pathway.name, description: pathway.description, active: true },
      create: {
        code: pathway.code,
        name: pathway.name,
        description: pathway.description,
        active: true,
      },
      select: { id: true, code: true },
    });
    pathwayIds.set(row.code, row.id);
  }

  for (const track of OFFICIAL_TRACKS) {
    const pathwayId = pathwayIds.get(track.pathwayCode);
    if (!pathwayId) continue;

    const row = await prisma.pathwayTrack.upsert({
      where: { pathwayId_code: { pathwayId, code: track.code } },
      update: { name: track.name, description: track.description ?? null, active: true },
      create: {
        pathwayId,
        code: track.code,
        name: track.name,
        description: track.description ?? null,
        active: true,
      },
      select: { id: true },
    });
    trackIds.set(`${track.pathwayCode}::${track.code}`, row.id);
  }

  for (const area of OFFICIAL_LEARNING_AREAS) {
    const pathwayId = area.pathwayCode ? pathwayIds.get(area.pathwayCode) : undefined;
    const trackId = area.pathwayCode && area.trackCode ? trackIds.get(`${area.pathwayCode}::${area.trackCode}`) : undefined;

    const row = await prisma.officialLearningArea.upsert({
      where: { officialCode: area.officialCode },
      update: {
        officialName: area.officialName,
        subjectType: area.subjectType as any,
        pathwayId: pathwayId ?? null,
        trackId: trackId ?? null,
        examinable: area.examinable ?? area.subjectType !== 'SUPPORT_SUBJECT',
        active: true,
      },
      create: {
        officialCode: area.officialCode,
        officialName: area.officialName,
        subjectType: area.subjectType as any,
        pathwayId: pathwayId ?? null,
        trackId: trackId ?? null,
        examinable: area.examinable ?? area.subjectType !== 'SUPPORT_SUBJECT',
        active: true,
      },
      select: { id: true, officialCode: true },
    });
    officialAreaIds.set(row.officialCode, row.id);
  }

  for (const alias of OFFICIAL_LEARNING_AREA_ALIASES) {
    const officialLearningAreaId = officialAreaIds.get(alias.officialCode);
    if (!officialLearningAreaId) continue;

    await prisma.learningAreaAlias.upsert({
      where: { alias: alias.alias },
      update: { officialLearningAreaId, source: alias.source ?? null, active: true },
      create: {
        officialLearningAreaId,
        alias: alias.alias,
        source: alias.source ?? null,
        active: true,
      },
    });
  }

  for (const rule of OFFICIAL_COMBINATION_RULES) {
    const pathwayId = pathwayIds.get(rule.pathwayCode);
    const trackId = trackIds.get(`${rule.pathwayCode}::${rule.trackCode}`);
    if (!pathwayId || !trackId) continue;

    const row = await prisma.subjectCombinationRule.upsert({
      where: { code: rule.code },
      update: {
        pathwayId,
        trackId,
        name: rule.name,
        officialSource: rule.officialSource ?? null,
        active: true,
      },
      create: {
        pathwayId,
        trackId,
        code: rule.code,
        name: rule.name,
        officialSource: rule.officialSource ?? null,
        active: true,
      },
      select: { id: true },
    });

    await prisma.subjectCombinationRuleItem.deleteMany({ where: { ruleId: row.id } });
    await prisma.subjectCombinationRuleItem.createMany({
      data: rule.subjects
        .map((officialCode, index) => {
          const officialLearningAreaId = officialAreaIds.get(officialCode);
          if (!officialLearningAreaId) return null;
          return { ruleId: row.id, officialLearningAreaId, position: index + 1 };
        })
        .filter(Boolean) as Array<{ ruleId: string; officialLearningAreaId: string; position: number }>,
      skipDuplicates: true,
    });
  }

  return {
    pathways: OFFICIAL_PATHWAYS.length,
    tracks: OFFICIAL_TRACKS.length,
    learningAreas: OFFICIAL_LEARNING_AREAS.length,
    aliases: OFFICIAL_LEARNING_AREA_ALIASES.length,
    combinationRules: OFFICIAL_COMBINATION_RULES.length,
  };
}
