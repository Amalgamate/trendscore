import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the initial `Template` rows for the eReport engine.
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 6 (Initial Report Templates)
 *
 * Idempotent — upserts on `key` (the unique field a `Template` row is keyed
 * on, per checklist §2.2), so this is safe to re-run. Mirrors the existing
 * `seed-lms-apps.ts` convention (App.upsert on `slug`) for the same reason:
 * the `Template` model was deliberately modeled on the same
 * App/SchoolAppConfig pattern (checklist §1.1/2.2).
 *
 * These two keys must match `REPORT_TEMPLATE_REGISTRY` in
 * `src/components/CBCGrading/templates/reportTemplates/registry.js` exactly
 * — the `key` column is the pointer the frontend registry resolves against
 * (Decision D2). Adding a template = add it here AND in the registry; the
 * two are not auto-synced.
 */
export async function seedReportTemplates(): Promise<void> {
  console.log('\n📄 Seeding report templates...');

  const classic = await prisma.template.upsert({
    where: { key: 'classic' },
    create: { key: 'classic', name: 'Classic (Corporate Edition)', version: 1, isActive: true },
    update: { name: 'Classic (Corporate Edition)', isActive: true },
  });
  console.log(`   ✅ Upserted Template: ${classic.name} (key: ${classic.key})`);

  const modern = await prisma.template.upsert({
    where: { key: 'modern' },
    create: { key: 'modern', name: 'Modern', version: 1, isActive: true },
    update: { name: 'Modern', isActive: true },
  });
  console.log(`   ✅ Upserted Template: ${modern.name} (key: ${modern.key})`);

  console.log('✨ Report templates seeded!');
}

// Allow running as a standalone script: `npx ts-node server/prisma/seed-report-templates.ts`
if (require.main === module) {
  seedReportTemplates()
    .catch((error) => {
      console.error('❌ Report template seed error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
