/**
 * senior-school-catalog.seed.ts
 *
 * Seeds a starter catalogue of Kenyan Senior Secondary schools into the
 * SeniorSchool table.  Idempotent — uses upsert on knecCode.
 *
 * Data covers a representative cross-section: national, extra-county,
 * county, and sub-county schools across all 8 provinces.
 * Expand this list or pull from a CSV import for production.
 *
 * Phase 4, Pathway Planner.
 */

import { PrismaClient } from '@prisma/client';

type SchoolSeed = {
  name: string;
  knecCode?: string;
  county: string;
  subCounty?: string;
  schoolType: 'DAY' | 'BOARDING' | 'DAY_AND_BOARDING';
  gender: 'MIXED' | 'BOYS' | 'GIRLS';
  category: 'NATIONAL' | 'EXTRA_COUNTY' | 'COUNTY' | 'SUB_COUNTY';
  pathwayCodes: string[];
  minimumKcpeGrade?: number;
};

const SCHOOLS: SchoolSeed[] = [
  // ── NATIONAL SCHOOLS ────────────────────────────────────────────────────────
  { name: 'Alliance High School',        knecCode: 'NAI001', county: 'Kiambu',  schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 420 },
  { name: 'Kenya High School',           knecCode: 'NAI002', county: 'Nairobi', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 400 },
  { name: 'Starehe Boys Centre',         knecCode: 'NAI003', county: 'Nairobi', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 380 },
  { name: 'Mang\'u High School',         knecCode: 'KIA001', county: 'Kiambu',  schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 400 },
  { name: 'Loreto High School Limuru',   knecCode: 'KIA002', county: 'Kiambu',  schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 380 },
  { name: 'Nairobi School',              knecCode: 'NAI004', county: 'Nairobi', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 390 },
  { name: 'Pangani Girls High School',   knecCode: 'NAI005', county: 'Nairobi', schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 370 },
  { name: 'Maseno School',               knecCode: 'KSM001', county: 'Kisumu',  schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 380 },
  { name: 'Kisumu Girls High School',    knecCode: 'KSM002', county: 'Kisumu',  schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 360 },
  { name: 'Kakamega High School',        knecCode: 'KAK001', county: 'Kakamega',schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 370 },
  // ── EXTRA-COUNTY SCHOOLS ─────────────────────────────────────────────────────
  { name: 'Upper Hill School',           knecCode: 'NAI006', county: 'Nairobi', schoolType: 'DAY',      gender: 'MIXED', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 350 },
  { name: 'Strathmore School',           knecCode: 'NAI007', county: 'Nairobi', schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 340 },
  { name: 'Mombasa High School',         knecCode: 'MSA001', county: 'Mombasa', schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 320 },
  { name: 'Coast Girls High School',     knecCode: 'MSA002', county: 'Mombasa', schoolType: 'DAY',      gender: 'GIRLS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 310 },
  { name: 'Nakuru High School',          knecCode: 'NAK001', county: 'Nakuru',  schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 330 },
  { name: 'Nakuru Girls High School',    knecCode: 'NAK002', county: 'Nakuru',  schoolType: 'DAY',      gender: 'GIRLS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 320 },
  { name: 'Eldoret High School',         knecCode: 'UAS001', county: 'Uasin Gishu', schoolType: 'DAY', gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 320 },
  { name: 'Meru School',                 knecCode: 'MER001', county: 'Meru',    schoolType: 'BOARDING', gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 340 },
  { name: 'Nyeri High School',           knecCode: 'NYE001', county: 'Nyeri',   schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 330 },
  { name: 'Kirinyaga Girls High School', knecCode: 'KIR001', county: 'Kirinyaga', schoolType: 'DAY',   gender: 'GIRLS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 310 },
  // ── COUNTY SCHOOLS ───────────────────────────────────────────────────────────
  { name: 'Machakos Boys High School',   knecCode: 'MCK001', county: 'Machakos', schoolType: 'DAY',    gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 280 },
  { name: 'Kitui School',                knecCode: 'KIT001', county: 'Kitui',   schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 270 },
  { name: 'Embu High School',            knecCode: 'EMB001', county: 'Embu',    schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 270 },
  { name: 'Bungoma High School',         knecCode: 'BUN001', county: 'Bungoma', schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 260 },
  { name: 'Kisii High School',           knecCode: 'KSI001', county: 'Kisii',   schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 260 },
  { name: 'Homa Bay High School',        knecCode: 'HOM001', county: 'Homa Bay', schoolType: 'DAY',    gender: 'MIXED', category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250 },
  { name: 'Migori High School',          knecCode: 'MIG001', county: 'Migori',  schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'],        minimumKcpeGrade: 240 },
  { name: 'Garissa High School',         knecCode: 'GAR001', county: 'Garissa', schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 240 },
  { name: 'Kajiado High School',         knecCode: 'KAJ001', county: 'Kajiado', schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       pathwayCodes: ['STEM','SOCIAL_SCIENCES'],               minimumKcpeGrade: 250 },
  { name: 'Kilifi High School',          knecCode: 'KLF001', county: 'Kilifi',  schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'],        minimumKcpeGrade: 240 },
  // ── ARTS & SPORTS SPECIALIST ──────────────────────────────────────────────────
  { name: 'Kenyatta University School of Music', knecCode: 'KUM001', county: 'Nairobi', schoolType: 'DAY', gender: 'MIXED', category: 'EXTRA_COUNTY', pathwayCodes: ['ARTS_SPORTS'], minimumKcpeGrade: 280 },
  { name: 'Lenana School',               knecCode: 'NAI008', county: 'Nairobi', schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 360 },
  { name: 'Laikipia High School',        knecCode: 'LAI001', county: 'Laikipia', schoolType: 'BOARDING', gender: 'BOYS', category: 'EXTRA_COUNTY', pathwayCodes: ['STEM','ARTS_SPORTS'],                  minimumKcpeGrade: 300 },
];

export async function seedSeniorSchoolCatalog(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const school of SCHOOLS) {
    const data = {
      name:               school.name,
      county:             school.county,
      subCounty:          school.subCounty ?? null,
      schoolType:         school.schoolType,
      gender:             school.gender,
      category:           school.category,
      pathwayCodes:       school.pathwayCodes,
      minimumKcpeGrade:   school.minimumKcpeGrade ?? null,
      active:             true,
      verified:           true,
    };

    if (school.knecCode) {
      const existing = await prisma.seniorSchool.findUnique({ where: { knecCode: school.knecCode } });
      if (existing) {
        await prisma.seniorSchool.update({ where: { knecCode: school.knecCode }, data });
        updated++;
      } else {
        await prisma.seniorSchool.create({ data: { ...data, knecCode: school.knecCode } });
        created++;
      }
    } else {
      const existing = await prisma.seniorSchool.findFirst({ where: { name: school.name, county: school.county } });
      if (!existing) {
        await prisma.seniorSchool.create({ data });
        created++;
      }
    }
  }

  return { created, updated, total: SCHOOLS.length };
}
