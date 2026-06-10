/**
 * Links existing "Demo Learner" row(s) to the demo parent account.
 *
 * Resolves parent by DEMO_PARENT_EMAIL, then parent@demo.trendscore, parent@local.test, parent@demo.com.
 *
 * Run:  cd server && npx ts-node scripts/link-demo-learner-to-demo-parent.ts
 *   or: npm run demo:link-parent
 */

import 'dotenv/config';
import prisma from '../src/config/database';

const FALLBACK_PARENT_EMAILS = [
  process.env.DEMO_PARENT_EMAIL,
  'parent@demo.trendscore',
  'parent@local.test',
  'parent@demo.com'
].filter((e): e is string => Boolean(e));

async function resolveDemoParent() {
  for (const email of FALLBACK_PARENT_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.role === 'PARENT') return user;
  }
  return null;
}

async function main() {
  const parent = await resolveDemoParent();
  if (!parent) {
    console.error(
      'No PARENT user found. Create one first, e.g.:\n' +
        '  node ../scripts/seed-demo-users.mjs\n' +
        '  or npm run seed (parent@local.test)\n' +
        'Or set DEMO_PARENT_EMAIL to an existing parent user.'
    );
    process.exit(1);
  }

  const learners = await prisma.learner.findMany({
    where: {
      firstName: 'Demo',
      lastName: 'Learner',
      status: 'ACTIVE'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (learners.length === 0) {
    console.log('No active learners named "Demo Learner" found. Run: npm run demo:create-student');
    process.exit(0);
  }

  const guardianName = `${parent.firstName} ${parent.lastName}`.trim();
  const guardianPhone = parent.phone ?? undefined;
  const guardianEmail = parent.email;

  for (const l of learners) {
    await prisma.learner.update({
      where: { id: l.id },
      data: {
        parentId: parent.id,
        guardianName,
        guardianPhone,
        guardianEmail
      }
    });
    console.log(`Linked ${l.admissionNumber} (${l.firstName} ${l.lastName}) → ${parent.email}`);
  }

  console.log(`\nDone. Updated ${learners.length} learner(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
