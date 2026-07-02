import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Idempotent seed function that upserts the two LMS App records.
 * Safe to call multiple times — uses slug as the unique key.
 */
export async function seedLmsApps(): Promise<void> {
  console.log('\n📦 Seeding LMS app packages...');

  // ─── Professional tier ──────────────────────────────────────────────────────
  const professional = await prisma.app.upsert({
    where: { slug: 'lms-professional' },
    create: {
      slug: 'lms-professional',
      name: 'Learning Hub',
      description:
        'Core Digital Learning Hub: assignments, lessons, revision library, progress tracking',
      category: 'Learning',
      icon: 'BookOpen',
      sortOrder: 40,
      dependencies: [],
      isSystem: false,
    },
    update: {
      name: 'Learning Hub',
      description:
        'Core Digital Learning Hub: assignments, lessons, revision library, progress tracking',
      category: 'Learning',
      icon: 'BookOpen',
      sortOrder: 40,
      dependencies: [],
      isSystem: false,
    },
  });

  console.log(`   ✅ Upserted App: ${professional.name} (slug: ${professional.slug})`);

  // ─── Enterprise tier ─────────────────────────────────────────────────────────
  const enterprise = await prisma.app.upsert({
    where: { slug: 'lms-enterprise' },
    create: {
      slug: 'lms-enterprise',
      name: 'Learning Hub — Enterprise',
      description:
        'AI Learning Assistant, Marketplace, Advanced Analytics, Learning API',
      category: 'Learning',
      icon: 'Sparkles',
      sortOrder: 41,
      dependencies: ['lms-professional'],
      isSystem: false,
    },
    update: {
      name: 'Learning Hub — Enterprise',
      description:
        'AI Learning Assistant, Marketplace, Advanced Analytics, Learning API',
      category: 'Learning',
      icon: 'Sparkles',
      sortOrder: 41,
      dependencies: ['lms-professional'],
      isSystem: false,
    },
  });

  console.log(`   ✅ Upserted App: ${enterprise.name} (slug: ${enterprise.slug})`);

  console.log('✨ LMS app packages seeded!');
}

// Allow running as a standalone script: `npx ts-node server/prisma/seed-lms-apps.ts`
if (require.main === module) {
  seedLmsApps()
    .catch((error) => {
      console.error('❌ LMS app seed error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
