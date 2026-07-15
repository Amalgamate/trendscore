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
      update: { name: f.name },
      create: { code: f.code, name: f.name },
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
        familyId,
        shortSummary:       c.shortSummary,
        recommendedPathway: c.recommendedPathway,
        recommendedTrackCode: c.recommendedTrackCode ?? null,
        typicalActivities:  c.typicalActivities,
        keySkills:          c.keySkills,
        workEnvironments:   c.workEnvironments,
        futureSkills:       ['Digital fluency', 'Communication', 'Adaptability'],
        verificationStatus: 'SOURCE_VERIFIED',
        active:             true,
      },
      create: {
        code:               c.code,
        title:              c.title,
        familyId,
        shortSummary:       c.shortSummary,
        recommendedPathway: c.recommendedPathway,
        recommendedTrackCode: c.recommendedTrackCode ?? null,
        typicalActivities:  c.typicalActivities,
        keySkills:          c.keySkills,
        workEnvironments:   c.workEnvironments,
        futureSkills:       ['Digital fluency', 'Communication', 'Adaptability'],
        verificationStatus: 'SOURCE_VERIFIED',
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
          exampleInstitutions: r.exampleInstitutions,
          durationYears:       r.durationYears,
          verificationStatus:  'SOURCE_VERIFIED',
          active:              true,
        })),
      });
      routeCount += c.routes.length;
    }
  }

  return { families: familyCount, careers: careerCount, routes: routeCount };
}
