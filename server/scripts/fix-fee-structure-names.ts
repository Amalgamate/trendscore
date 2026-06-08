/**
 * Fix fee structure names that were seeded as "Parent Dashboard GRADE X".
 * Renames them to proper grade labels: "Grade 2", "Grade 4", etc.
 * Run: npx ts-node scripts/fix-fee-structure-names.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GRADE_LABELS: Record<string, string> = {
  PLAYGROUP: 'Play Group',
  PLAY_GROUP: 'Play Group',
  PP1: 'PP 1',
  PP2: 'PP 2',
  GRADE_1: 'Grade 1', GRADE_2: 'Grade 2', GRADE_3: 'Grade 3',
  GRADE_4: 'Grade 4', GRADE_5: 'Grade 5', GRADE_6: 'Grade 6',
  GRADE_7: 'Grade 7', GRADE_8: 'Grade 8', GRADE_9: 'Grade 9',
};

async function main() {
  const bad = await prisma.feeStructure.findMany({
    where: { name: { startsWith: 'Parent Dashboard' } },
    select: { id: true, name: true, grade: true },
  });

  if (!bad.length) {
    console.log('✅ No "Parent Dashboard" fee structures found — nothing to fix.');
    return;
  }

  console.log(`Found ${bad.length} bad fee structure name(s):`);

  for (const s of bad) {
    const gradeKey = String(s.grade ?? '').toUpperCase().replace(/\s+/g, '_');
    const newName  = GRADE_LABELS[gradeKey] ?? s.grade ?? s.name;
    await prisma.feeStructure.update({
      where: { id: s.id },
      data:  { name: newName },
    });
    console.log(`  "${s.name}" → "${newName}"`);
  }

  console.log('✅ Done. Refresh the dashboard to see clean grade names.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
