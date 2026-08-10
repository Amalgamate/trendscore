/**
 * career-seed.service.ts
 * Idempotent seeder for Career Explorer data.
 * Called by the /api/careers/seed admin endpoint.
 */

import prisma from '../config/database';
import { CAREER_FAMILIES, CAREERS } from './career-seed.data';

export async function seedCareers(): Promise<{ families: number; careers: number; routes: number }> {
  let familyCount = 0;
  let careerCount = 0;
  let routeCount  = 0;

  // 1. Upsert families
  const familyMap = new Map<string, string>(); // code → id
  for (const f of CAREER_FAMILIES) {
    const row = await prisma.careerFamily.upsert({
      where:  { code: f.code },
      update: { name: f.name, description: f.description ?? null, active: true },
      create: { code: f.code, name: f.name, description: f.description ?? null, active: true },
    });
    familyMap.set(f.code, row.id);
    familyCount++;
  }

  // 2. Upsert careers
  for (const c of CAREERS) {
    const familyId = c.familyCode ? familyMap.get(c.familyCode) ?? null : null;

    const career = await prisma.career.upsert({
      where:  { code: c.code },
      update: {
        title:              c.title,
        alternativeTitles:  c.alternativeTitles ?? [],
        familyId,
        shortSummary:       c.shortSummary,
        fullDescription:    c.fullDescription ?? null,
        recommendedPathway: c.recommendedPathway,
        recommendedTrackCode: c.recommendedTrackCode ?? null,
        typicalActivities:  c.typicalActivities,
        keySkills:          c.keySkills,
        workEnvironments:   c.workEnvironments,
        futureSkills:       c.futureSkills ?? [],
        labourMarketNotes:  c.labourMarketNotes ?? null,
        salaryRangeNotes:   c.salaryRangeNotes ?? null,
        successStory:       c.successStory ?? null,
        source:             c.source ?? null,
        verificationStatus: 'SOURCE_VERIFIED',
        publishedAt:        new Date(),
        active:             true,
      },
      create: {
        code:               c.code,
        title:              c.title,
        alternativeTitles:  c.alternativeTitles ?? [],
        familyId,
        shortSummary:       c.shortSummary,
        fullDescription:    c.fullDescription ?? null,
        recommendedPathway: c.recommendedPathway,
        recommendedTrackCode: c.recommendedTrackCode ?? null,
        typicalActivities:  c.typicalActivities,
        keySkills:          c.keySkills,
        workEnvironments:   c.workEnvironments,
        futureSkills:       c.futureSkills ?? [],
        labourMarketNotes:  c.labourMarketNotes ?? null,
        salaryRangeNotes:   c.salaryRangeNotes ?? null,
        successStory:       c.successStory ?? null,
        source:             c.source ?? null,
        verificationStatus: 'SOURCE_VERIFIED',
        publishedAt:        new Date(),
        active:             true,
      },
    });
    careerCount++;

    // 3. Upsert education routes (delete-recreate per career for simplicity)
    if (c.routes?.length) {
      await prisma.careerEducationRoute.deleteMany({ where: { careerId: career.id } });
      await prisma.careerEducationRoute.createMany({
        data: c.routes.map(r => ({
          careerId:            career.id,
          routeType:           r.routeType,
          qualificationTitle:  r.qualificationTitle,
          minSubjectNotes:    r.minSubjectNotes ?? null,
          exampleInstitutions: r.exampleInstitutions,
          durationYears:       r.durationYears,
          progressionOptions:  r.progressionOptions ?? [],
          source:              r.source ?? c.source ?? null,
          verificationStatus:  'SOURCE_VERIFIED',
          active:              true,
        })),
      });
      routeCount += c.routes.length;
    }
  }

  return { families: familyCount, careers: careerCount, routes: routeCount };
}
