/**
 * seed-senior-schools.ts
 *
 * Seeds a representative set of Kenyan national and county secondary schools
 * into the SeniorSchool catalogue table.
 *
 * Run:  npx ts-node src/scripts/seed-senior-schools.ts
 *
 * Data sourced from publicly available KNEC / MoE records.
 * Only idempotent upserts — safe to re-run.
 *
 * Phase 4, Pathway Planner.
 */

import prisma from '../config/database';

type SchoolSeed = {
  name: string;
  knecCode?: string;
  county: string;
  subCounty?: string;
  schoolType: string;
  gender: string;
  category: string;
  pathwayCodes: string[];
  minimumKcpeGrade?: number;
};

const SCHOOLS: SchoolSeed[] = [
  // ── National Schools ────────────────────────────────────────────────────────
  { name: 'Alliance High School', knecCode: 'N001', county: 'Kiambu', subCounty: 'Kikuyu', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 400 },
  { name: 'Kenya High School',    knecCode: 'N002', county: 'Nairobi', subCounty: 'Westlands', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 395 },
  { name: 'Mangu High School',    knecCode: 'N003', county: 'Kiambu', subCounty: 'Thika', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 390 },
  { name: 'Starehe Boys Centre',  knecCode: 'N004', county: 'Nairobi', subCounty: 'Starehe', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 385 },
  { name: 'Loreto High School Limuru', knecCode: 'N005', county: 'Kiambu', subCounty: 'Limuru', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 390 },
  { name: 'Nairobi School',       knecCode: 'N006', county: 'Nairobi', subCounty: 'Nairobi Central', schoolType: 'BOARDING', gender: 'BOYS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 388 },
  { name: 'Moi Girls School Nairobi', knecCode: 'N007', county: 'Nairobi', subCounty: 'Embakasi', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 385 },
  { name: "Saint Mary's School",  knecCode: 'N008', county: 'Nairobi', subCounty: 'Langata', schoolType: 'BOARDING', gender: 'BOYS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 390 },
  { name: 'Kisumu Girls High School', knecCode: 'N009', county: 'Kisumu', subCounty: 'Kisumu Central', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 375 },
  { name: 'Maseno School',        knecCode: 'N010', county: 'Kisumu', subCounty: 'Maseno', schoolType: 'BOARDING', gender: 'BOYS', category: 'NATIONAL', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 385 },

  // ── Extra-County Schools ────────────────────────────────────────────────────
  { name: "Moi Forces Academy Lanet", knecCode: 'EC001', county: 'Nakuru', subCounty: 'Nakuru East', schoolType: 'BOARDING', gender: 'MIXED', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 360 },
  { name: 'Kagumo High School',   knecCode: 'EC002', county: 'Kirinyaga', subCounty: 'Gichugu', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 350 },
  { name: 'Nyeri High School',    knecCode: 'EC003', county: 'Nyeri', subCounty: 'Nyeri Central', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 345 },
  { name: 'Pangani Girls High School', knecCode: 'EC004', county: 'Nairobi', subCounty: 'Kamukunji', schoolType: 'BOARDING', gender: 'GIRLS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 355 },
  { name: 'Upper Hill School',    knecCode: 'EC005', county: 'Nairobi', subCounty: 'Langata', schoolType: 'DAY', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 350 },
  { name: 'Mombasa Technical Training Institute', knecCode: 'EC006', county: 'Mombasa', subCounty: 'Mvita', schoolType: 'DAY', gender: 'MIXED', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM'], minimumKcpeGrade: 330 },
  { name: 'Nakuru High School',   knecCode: 'EC007', county: 'Nakuru', subCounty: 'Nakuru East', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 345 },
  { name: 'Eldoret Polytechnic Secondary School', knecCode: 'EC008', county: 'Uasin Gishu', subCounty: 'Kapseret', schoolType: 'DAY', gender: 'MIXED', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM'], minimumKcpeGrade: 320 },
  { name: 'Kakamega High School', knecCode: 'EC009', county: 'Kakamega', subCounty: 'Lurambi', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 350 },
  { name: "Kisii High School",    knecCode: 'EC010', county: 'Kisii', subCounty: 'Kisii Central', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 340 },

  // ── County Schools (diverse counties + pathways) ────────────────────────────
  { name: 'Lenana School',        knecCode: 'C001', county: 'Nairobi', subCounty: 'Dagoretti', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 320 },
  { name: 'Precious Blood Riruta',knecCode: 'C002', county: 'Nairobi', subCounty: 'Riruta', schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 310 },
  { name: 'Meru High School',     knecCode: 'C003', county: 'Meru', subCounty: 'Imenti Central', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 305 },
  { name: 'Moi High School Kabarak', knecCode: 'C004', county: 'Nakuru', subCounty: 'Rongai', schoolType: 'BOARDING', gender: 'MIXED', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 315 },
  { name: 'Kilifi High School',   knecCode: 'C005', county: 'Kilifi', subCounty: 'Kilifi North', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 290 },
  { name: 'Machakos Girls High School', knecCode: 'C006', county: 'Machakos', subCounty: 'Machakos Town', schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 300 },
  { name: 'Kitui School',         knecCode: 'C007', county: 'Kitui', subCounty: 'Kitui Central', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 295 },
  { name: 'Bungoma High School',  knecCode: 'C008', county: 'Bungoma', subCounty: 'Kanduyi', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 300 },
  { name: 'Murang\'a High School',knecCode: 'C009', county: 'Murang\'a', subCounty: 'Kahuro', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 298 },
  { name: 'Laikipia High School', knecCode: 'C010', county: 'Laikipia', subCounty: 'Nanyuki', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 285 },
  { name: 'Ruiru High School',    knecCode: 'C011', county: 'Kiambu', subCounty: 'Ruiru', schoolType: 'DAY', gender: 'MIXED', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 280 },
  { name: 'Kwanthanze Girls',     knecCode: 'C012', county: 'Makueni', subCounty: 'Kibwezi East', schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 275 },
  { name: 'Homa Bay High School', knecCode: 'C013', county: 'Homa Bay', subCounty: 'Homa Bay Town', schoolType: 'DAY_AND_BOARDING', gender: 'MIXED', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 270 },
  { name: 'Siaya High School',    knecCode: 'C014', county: 'Siaya', subCounty: 'Gem', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 275 },
  { name: 'Iten High School',     knecCode: 'C015', county: 'Elgeyo-Marakwet', subCounty: 'Keiyo North', schoolType: 'DAY_AND_BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','ARTS_SPORTS'], minimumKcpeGrade: 270 },
  { name: 'Kapsabet High School', knecCode: 'C016', county: 'Nandi', subCounty: 'Kapsabet', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 295 },
  { name: 'Thika High School',    knecCode: 'C017', county: 'Kiambu', subCounty: 'Thika Town', schoolType: 'DAY', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 280 },
  { name: 'Mwea Tebere High School', knecCode: 'C018', county: 'Kirinyaga', subCounty: 'Mwea East', schoolType: 'DAY_AND_BOARDING', gender: 'MIXED', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 265 },
  { name: 'Kericho High School',  knecCode: 'C019', county: 'Kericho', subCounty: 'Ainamoi', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 280 },
  { name: 'Mumias High School',   knecCode: 'C020', county: 'Kakamega', subCounty: 'Mumias East', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 260 },
];

async function main() {
  console.log(`Seeding ${SCHOOLS.length} senior schools…`);
  let created = 0;
  let skipped = 0;

  for (const school of SCHOOLS) {
    const existing = school.knecCode
      ? await prisma.seniorSchool.findUnique({ where: { knecCode: school.knecCode } })
      : await prisma.seniorSchool.findFirst({ where: { name: school.name } });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.seniorSchool.create({
      data: {
        name:              school.name,
        knecCode:          school.knecCode ?? null,
        county:            school.county,
        subCounty:         school.subCounty ?? null,
        schoolType:        school.schoolType,
        gender:            school.gender,
        category:          school.category,
        pathwayCodes:      school.pathwayCodes,
        minimumKcpeGrade:  school.minimumKcpeGrade ?? null,
        active:            true,
        verified:          true,
      },
    });
    created++;
  }

  console.log(`Done — created: ${created}, skipped (already exist): ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
