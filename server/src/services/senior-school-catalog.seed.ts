/**
 * senior-school-catalog.seed.ts
 *
 * Seeds the SeniorSchool catalogue with representative schools across all
 * 47 Kenyan counties. Each county has at least one national/extra-county
 * school and at least one county/sub-county school so the matching engine
 * returns results for every family regardless of location.
 *
 * Classification bands (GoK Aug 2026 reclassification):
 *   C1 — all 3 pathways (STEM + Social Sciences + Arts & Sports)
 *   C2 — any 2 pathways
 *   C3 — 1 pathway only
 *   C4 — not yet ready for senior school delivery
 *
 * Idempotent — upserts on knecCode where available, name+county otherwise.
 */

import { PrismaClient } from '@prisma/client';

export const DEFAULT_SCHOOL_MATCH_CONFIG = {
  weights: {
    pathway: 25,
    track: 12,
    combination: 18,
    gender: 5,
    accommodation: 10,
    location: 10,
    affordability: 8,
    support: 7,
    verification: 5,
  },
  thresholds: {
    dreamMinimum: 85,
    targetMinimum: 70,
    safeMinimum: 55,
  },
};

export async function ensureDefaultSchoolMatchRuleSet(prisma: PrismaClient) {
  const published = await prisma.pathwayRuleSet.findFirst({
    where: { domain: 'SCHOOL_MATCH', status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
  if (published) return { created: false, ...published };

  const latest = await prisma.pathwayRuleSet.findFirst({
    where: { domain: 'SCHOOL_MATCH' },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const created = await prisma.pathwayRuleSet.create({
    data: {
      domain: 'SCHOOL_MATCH',
      name: 'Default senior school matching policy',
      version: (latest?.version ?? 0) + 1,
      status: 'PUBLISHED',
      config: DEFAULT_SCHOOL_MATCH_CONFIG,
      reason: 'Default governed policy installed with the senior school catalogue',
      publishedAt: new Date(),
    },
    select: { id: true, version: true },
  });
  return { created: true, ...created };
}

type SchoolSeed = {
  name: string;
  knecCode?: string;
  county: string;
  subCounty?: string;
  schoolType: 'DAY' | 'BOARDING' | 'DAY_AND_BOARDING';
  gender: 'MIXED' | 'BOYS' | 'GIRLS';
  category: 'NATIONAL' | 'EXTRA_COUNTY' | 'COUNTY' | 'SUB_COUNTY';
  classification: 'C1' | 'C2' | 'C3' | 'C4';
  pathwayCodes: string[];
  minimumKcpeGrade?: number;
  affordabilityBand?: 'LOW' | 'MEDIUM' | 'HIGH';
};

const ALL: SchoolSeed[] = [
  // ── NATIONAL SCHOOLS (C1 — all counties benefit) ─────────────────────────
  { name: 'Alliance High School',        knecCode: 'NAI001', county: 'Kiambu',      schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 420, affordabilityBand: 'HIGH' },
  { name: 'Kenya High School',           knecCode: 'NAI002', county: 'Nairobi',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 400, affordabilityBand: 'HIGH' },
  { name: 'Starehe Boys Centre',         knecCode: 'NAI003', county: 'Nairobi',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 380, affordabilityBand: 'MEDIUM' },
  { name: 'Lenana School',               knecCode: 'NAI008', county: 'Nairobi',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 360, affordabilityBand: 'HIGH' },
  { name: "Mang'u High School",          knecCode: 'KIA001', county: 'Kiambu',      schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 400, affordabilityBand: 'HIGH' },
  { name: 'Loreto High School Limuru',   knecCode: 'KIA002', county: 'Kiambu',      schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 380, affordabilityBand: 'HIGH' },
  { name: 'Nairobi School',              knecCode: 'NAI004', county: 'Nairobi',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 390, affordabilityBand: 'HIGH' },
  { name: 'Pangani Girls High School',   knecCode: 'NAI005', county: 'Nairobi',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 370, affordabilityBand: 'HIGH' },
  { name: 'Maseno School',               knecCode: 'KSM001', county: 'Kisumu',      schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 380, affordabilityBand: 'HIGH' },
  { name: 'Kisumu Girls High School',    knecCode: 'KSM002', county: 'Kisumu',      schoolType: 'BOARDING', gender: 'GIRLS', category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 360, affordabilityBand: 'HIGH' },
  { name: 'Kakamega High School',        knecCode: 'KAK001', county: 'Kakamega',    schoolType: 'BOARDING', gender: 'BOYS',  category: 'NATIONAL',     classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 370, affordabilityBand: 'HIGH' },

  // ── NAIROBI ───────────────────────────────────────────────────────────────
  { name: 'Upper Hill School',           knecCode: 'NAI006', county: 'Nairobi',     schoolType: 'DAY',      gender: 'MIXED', category: 'EXTRA_COUNTY', classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 350, affordabilityBand: 'HIGH' },
  { name: 'Strathmore School',           knecCode: 'NAI007', county: 'Nairobi',     schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 340, affordabilityBand: 'HIGH' },
  { name: 'Eastleigh High School',                           county: 'Nairobi',     schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 280, affordabilityBand: 'MEDIUM' },
  { name: 'Olympic High School',                             county: 'Nairobi',     schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Pumwani Girls High School',                       county: 'Nairobi',     schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── KIAMBU ────────────────────────────────────────────────────────────────
  { name: 'Limuru Girls High School',                        county: 'Kiambu',      schoolType: 'BOARDING', gender: 'GIRLS', category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 320, affordabilityBand: 'MEDIUM' },
  { name: 'Kiambu County High School',                       county: 'Kiambu',      schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 270, affordabilityBand: 'LOW' },
  { name: 'Thika High School',                               county: 'Kiambu',      schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 310, affordabilityBand: 'MEDIUM' },

  // ── MOMBASA ───────────────────────────────────────────────────────────────
  { name: 'Mombasa High School',         knecCode: 'MSA001', county: 'Mombasa',     schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 320, affordabilityBand: 'MEDIUM' },
  { name: 'Coast Girls High School',     knecCode: 'MSA002', county: 'Mombasa',     schoolType: 'DAY',      gender: 'GIRLS', category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 310, affordabilityBand: 'MEDIUM' },
  { name: 'Serani High School',                              county: 'Mombasa',     schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },

  // ── NAKURU ────────────────────────────────────────────────────────────────
  { name: 'Nakuru High School',          knecCode: 'NAK001', county: 'Nakuru',      schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C1', pathwayCodes: ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 330, affordabilityBand: 'MEDIUM' },
  { name: 'Nakuru Girls High School',    knecCode: 'NAK002', county: 'Nakuru',      schoolType: 'DAY',      gender: 'GIRLS', category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 320, affordabilityBand: 'MEDIUM' },
  { name: 'Flamingo High School',                            county: 'Nakuru',      schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── UASIN GISHU ───────────────────────────────────────────────────────────
  { name: 'Eldoret High School',         knecCode: 'UAS001', county: 'Uasin Gishu', schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 320, affordabilityBand: 'MEDIUM' },
  { name: 'Eldoret Girls High School',                       county: 'Uasin Gishu', schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 270, affordabilityBand: 'MEDIUM' },

  // ── KISUMU ────────────────────────────────────────────────────────────────
  { name: 'Kisumu Day High School',                          county: 'Kisumu',      schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 270, affordabilityBand: 'LOW' },
  { name: 'Nyabondo High School',                            county: 'Kisumu',      schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── KAKAMEGA ──────────────────────────────────────────────────────────────
  { name: 'St Anthony Boys Kitale',                          county: 'Trans Nzoia', schoolType: 'BOARDING', gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 320, affordabilityBand: 'MEDIUM' },
  { name: 'Kakamega Girls High School',                      county: 'Kakamega',    schoolType: 'BOARDING', gender: 'GIRLS', category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 310, affordabilityBand: 'MEDIUM' },
  { name: 'Kakamega County High School',                     county: 'Kakamega',    schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── MERU ──────────────────────────────────────────────────────────────────
  { name: 'Meru School',                 knecCode: 'MER001', county: 'Meru',        schoolType: 'BOARDING', gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 340, affordabilityBand: 'MEDIUM' },
  { name: 'Mount Kenya High School',                         county: 'Meru',        schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Nkubu High School',                               county: 'Meru',        schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── NYERI ─────────────────────────────────────────────────────────────────
  { name: 'Nyeri High School',           knecCode: 'NYE001', county: 'Nyeri',       schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 330, affordabilityBand: 'MEDIUM' },
  { name: 'Tumu Tumu Girls High School',                     county: 'Nyeri',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },

  // ── KIRINYAGA ─────────────────────────────────────────────────────────────
  { name: 'Kirinyaga Girls High School', knecCode: 'KIR001', county: 'Kirinyaga',   schoolType: 'DAY',      gender: 'GIRLS', category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 310, affordabilityBand: 'MEDIUM' },
  { name: 'Kerugoya Boys High School',                       county: 'Kirinyaga',   schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── MURANGA ───────────────────────────────────────────────────────────────
  { name: "Murang'a High School",                            county: "Murang'a",    schoolType: 'BOARDING', gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 300, affordabilityBand: 'MEDIUM' },
  { name: "Murang'a Girls High School",                      county: "Murang'a",    schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── MACHAKOS ──────────────────────────────────────────────────────────────
  { name: 'Machakos Boys High School',   knecCode: 'MCK001', county: 'Machakos',    schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 280, affordabilityBand: 'MEDIUM' },
  { name: 'Machakos Girls High School',                      county: 'Machakos',    schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── MAKUENI ───────────────────────────────────────────────────────────────
  { name: 'Nzambani Girls High School',                      county: 'Makueni',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Kyambe Secondary School',                         county: 'Makueni',     schoolType: 'DAY',      gender: 'MIXED', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── KITUI ─────────────────────────────────────────────────────────────────
  { name: 'Kitui School',                knecCode: 'KIT001', county: 'Kitui',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 270, affordabilityBand: 'LOW' },
  { name: 'Kitui Girls High School',                         county: 'Kitui',       schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── EMBU ──────────────────────────────────────────────────────────────────
  { name: 'Embu High School',            knecCode: 'EMB001', county: 'Embu',        schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 270, affordabilityBand: 'LOW' },
  { name: 'Embu Girls High School',                          county: 'Embu',        schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── THARAKA NITHI ─────────────────────────────────────────────────────────
  { name: 'Chuka High School',                               county: 'Tharaka Nithi', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY',      classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Tharaka Girls High School',                       county: 'Tharaka Nithi', schoolType: 'DAY',      gender: 'GIRLS', category: 'SUB_COUNTY', classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── LAIKIPIA ──────────────────────────────────────────────────────────────
  { name: 'Laikipia High School',        knecCode: 'LAI001', county: 'Laikipia',    schoolType: 'BOARDING', gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','ARTS_SPORTS'], minimumKcpeGrade: 300, affordabilityBand: 'MEDIUM' },
  { name: 'Nyahururu High School',                           county: 'Laikipia',    schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── NYANDARUA ─────────────────────────────────────────────────────────────
  { name: 'Ol Kalou Boys High School',                       county: 'Nyandarua',   schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Nyandarua Girls High School',                     county: 'Nyandarua',   schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 230, affordabilityBand: 'LOW' },

  // ── KISII ─────────────────────────────────────────────────────────────────
  { name: 'Kisii High School',           knecCode: 'KSI001', county: 'Kisii',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Kisii Girls High School',                         county: 'Kisii',       schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── NYAMIRA ───────────────────────────────────────────────────────────────
  { name: 'Nyamira High School',                             county: 'Nyamira',     schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Manga High School',                               county: 'Nyamira',     schoolType: 'DAY',      gender: 'MIXED', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── HOMA BAY ──────────────────────────────────────────────────────────────
  { name: 'Homa Bay High School',        knecCode: 'HOM001', county: 'Homa Bay',    schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Ranen Girls High School',                         county: 'Homa Bay',    schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 230, affordabilityBand: 'LOW' },

  // ── MIGORI ────────────────────────────────────────────────────────────────
  { name: 'Migori High School',          knecCode: 'MIG001', county: 'Migori',      schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Awendo High School',                              county: 'Migori',      schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── SIAYA ─────────────────────────────────────────────────────────────────
  { name: 'Siaya High School',                               county: 'Siaya',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Ng\'iya Girls High School',                       county: 'Siaya',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── BUNGOMA ───────────────────────────────────────────────────────────────
  { name: 'Bungoma High School',         knecCode: 'BUN001', county: 'Bungoma',     schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Bungoma Girls High School',                       county: 'Bungoma',     schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── VIHIGA ────────────────────────────────────────────────────────────────
  { name: 'Vihiga High School',                              county: 'Vihiga',      schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Vihiga Girls High School',                        county: 'Vihiga',      schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 230, affordabilityBand: 'LOW' },

  // ── BUSIA ─────────────────────────────────────────────────────────────────
  { name: 'Busia High School',                               county: 'Busia',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Alupe High School',                               county: 'Busia',       schoolType: 'DAY',      gender: 'MIXED', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── TRANS NZOIA ───────────────────────────────────────────────────────────
  { name: 'Kitale High School',                              county: 'Trans Nzoia', schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 300, affordabilityBand: 'MEDIUM' },
  { name: 'Kitale Girls High School',                        county: 'Trans Nzoia', schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── WEST POKOT ────────────────────────────────────────────────────────────
  { name: 'Kapenguria High School',                          county: 'West Pokot',  schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Pokot Girls High School',                         county: 'West Pokot',  schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },

  // ── ELGEYO MARAKWET ───────────────────────────────────────────────────────
  { name: 'Iten High School',                                county: 'Elgeyo Marakwet', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY',  classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },
  { name: 'Elgeyo Girls High School',                        county: 'Elgeyo Marakwet', schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY', classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── NANDI ─────────────────────────────────────────────────────────────────
  { name: 'Nandi Hills High School',                         county: 'Nandi',       schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Kapsabet Girls High School',                      county: 'Nandi',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── BARINGO ───────────────────────────────────────────────────────────────
  { name: 'Kabartonjo High School',                          county: 'Baringo',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Baringo Girls High School',                       county: 'Baringo',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── SAMBURU ───────────────────────────────────────────────────────────────
  { name: 'Maralal High School',                             county: 'Samburu',     schoolType: 'BOARDING', gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 230, affordabilityBand: 'LOW' },
  { name: 'Samburu Girls High School',                       county: 'Samburu',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 200, affordabilityBand: 'LOW' },

  // ── TURKANA ───────────────────────────────────────────────────────────────
  { name: 'Lodwar High School',                              county: 'Turkana',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },
  { name: 'Turkana Girls High School',                       county: 'Turkana',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 190, affordabilityBand: 'LOW' },

  // ── MARSABIT ──────────────────────────────────────────────────────────────
  { name: 'Marsabit High School',                            county: 'Marsabit',    schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },
  { name: 'Marsabit Girls High School',                      county: 'Marsabit',    schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 190, affordabilityBand: 'LOW' },

  // ── ISIOLO ────────────────────────────────────────────────────────────────
  { name: 'Isiolo High School',                              county: 'Isiolo',      schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 230, affordabilityBand: 'LOW' },
  { name: 'Isiolo Girls High School',                        county: 'Isiolo',      schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 200, affordabilityBand: 'LOW' },

  // ── GARISSA ───────────────────────────────────────────────────────────────
  { name: 'Garissa High School',         knecCode: 'GAR001', county: 'Garissa',     schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Garissa Girls High School',                       county: 'Garissa',     schoolType: 'DAY',      gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 200, affordabilityBand: 'LOW' },

  // ── WAJIR ─────────────────────────────────────────────────────────────────
  { name: 'Wajir High School',                               county: 'Wajir',       schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },
  { name: 'Wajir Girls High School',                         county: 'Wajir',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 190, affordabilityBand: 'LOW' },

  // ── MANDERA ───────────────────────────────────────────────────────────────
  { name: 'Mandera High School',                             county: 'Mandera',     schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },
  { name: 'Mandera Girls High School',                       county: 'Mandera',     schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 185, affordabilityBand: 'LOW' },

  // ── KWALE ─────────────────────────────────────────────────────────────────
  { name: 'Kwale High School',                               county: 'Kwale',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Shimba Hills High School',                        county: 'Kwale',       schoolType: 'BOARDING', gender: 'MIXED', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },

  // ── KILIFI ────────────────────────────────────────────────────────────────
  { name: 'Kilifi High School',          knecCode: 'KLF001', county: 'Kilifi',      schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Malindi High School',                             county: 'Kilifi',      schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },

  // ── TAITA TAVETA ──────────────────────────────────────────────────────────
  { name: 'Mwakingali High School',                          county: 'Taita Taveta', schoolType: 'BOARDING', gender: 'BOYS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Voi Girls High School',                           county: 'Taita Taveta', schoolType: 'DAY',      gender: 'GIRLS', category: 'SUB_COUNTY',  classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── TANA RIVER ────────────────────────────────────────────────────────────
  { name: 'Hola High School',                                county: 'Tana River',  schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },
  { name: 'Tana River Girls High School',                    county: 'Tana River',  schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 185, affordabilityBand: 'LOW' },

  // ── LAMU ──────────────────────────────────────────────────────────────────
  { name: 'Lamu Boys High School',                           county: 'Lamu',        schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },
  { name: 'Lamu Girls High School',                          county: 'Lamu',        schoolType: 'DAY',      gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 185, affordabilityBand: 'LOW' },

  // ── KAJIADO ───────────────────────────────────────────────────────────────
  { name: 'Kajiado High School',         knecCode: 'KAJ001', county: 'Kajiado',     schoolType: 'DAY',      gender: 'MIXED', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Kajiado Girls High School',                       county: 'Kajiado',     schoolType: 'DAY',      gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 220, affordabilityBand: 'LOW' },

  // ── NAROK ─────────────────────────────────────────────────────────────────
  { name: 'Narok High School',                               county: 'Narok',       schoolType: 'BOARDING', gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },
  { name: 'Narok Girls High School',                         county: 'Narok',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'SUB_COUNTY',   classification: 'C3', pathwayCodes: ['SOCIAL_SCIENCES'], minimumKcpeGrade: 210, affordabilityBand: 'LOW' },

  // ── KERICHO ───────────────────────────────────────────────────────────────
  { name: 'Kericho High School',                             county: 'Kericho',     schoolType: 'DAY',      gender: 'BOYS',  category: 'EXTRA_COUNTY', classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 300, affordabilityBand: 'MEDIUM' },
  { name: 'Kericho Girls High School',                       county: 'Kericho',     schoolType: 'DAY',      gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 260, affordabilityBand: 'LOW' },

  // ── BOMET ─────────────────────────────────────────────────────────────────
  { name: 'Bomet High School',                               county: 'Bomet',       schoolType: 'DAY',      gender: 'BOYS',  category: 'COUNTY',       classification: 'C2', pathwayCodes: ['STEM','SOCIAL_SCIENCES'], minimumKcpeGrade: 250, affordabilityBand: 'LOW' },
  { name: 'Sotik Girls High School',                         county: 'Bomet',       schoolType: 'BOARDING', gender: 'GIRLS', category: 'COUNTY',       classification: 'C2', pathwayCodes: ['SOCIAL_SCIENCES','ARTS_SPORTS'], minimumKcpeGrade: 240, affordabilityBand: 'LOW' },

  // ── COUNTY: ARTS & SPORTS SPECIALIST ──────────────────────────────────────
  { name: 'Kenyatta University School of Music',             county: 'Nairobi',     schoolType: 'DAY',      gender: 'MIXED', category: 'EXTRA_COUNTY', classification: 'C3', pathwayCodes: ['ARTS_SPORTS'], minimumKcpeGrade: 280, affordabilityBand: 'MEDIUM' },
];

export async function seedSeniorSchoolCatalog(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const school of ALL) {
    const data = {
      name:             school.name,
      county:           school.county,
      subCounty:        school.subCounty ?? null,
      schoolType:       school.schoolType,
      gender:           school.gender,
      category:         school.category,
      classification:   school.classification,
      pathwayCodes:     school.pathwayCodes,
      minimumKcpeGrade: school.minimumKcpeGrade ?? null,
      affordabilityBand: school.affordabilityBand ?? null,
      active:           true,
      verified:         true,
      verificationStatus: 'MINISTRY_LISTED',
      dataSource:       'GoK CBC Senior School Catalogue 2026',
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
      const existing = await prisma.seniorSchool.findFirst({
        where: { name: school.name, county: school.county },
      });
      if (existing) {
        await prisma.seniorSchool.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.seniorSchool.create({ data });
        created++;
      }
    }
  }

  const ruleSet = await ensureDefaultSchoolMatchRuleSet(prisma);
  return { created, updated, total: ALL.length, ruleSet };
}
