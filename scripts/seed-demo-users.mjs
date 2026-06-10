/**
 * seed-demo-users.mjs
 * Seeds demo accounts for Phase 2 verification.
 * 
 * Run with: node scripts/seed-demo-users.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Demo@2024';

const schools = [
  { name: 'TrendScore CBC Academy', institutionType: 'PRIMARY_CBC' },
  { name: 'TrendScore Secondary School', institutionType: 'SECONDARY' },
  { name: 'TrendScore University', institutionType: 'TERTIARY' },
];

const demoUsers = [
  { 
    email: 'admin@cbc-demo.trendscore.co.ke',
    firstName: 'CBC', 
    lastName: 'Admin', 
    role: 'ADMIN', 
    institutionType: 'PRIMARY_CBC' 
  },
  { 
    email: 'admin@secondary-demo.trendscore.co.ke',
    firstName: 'Secondary', 
    lastName: 'Admin', 
    role: 'ADMIN', 
    institutionType: 'SECONDARY' 
  },
  { 
    email: 'teacher@secondary-demo.trendscore.co.ke',
    firstName: 'Secondary', 
    lastName: 'Teacher', 
    role: 'TEACHER', 
    institutionType: 'SECONDARY' 
  },
  { 
    email: 'admin@tertiary-demo.trendscore.co.ke',
    firstName: 'Tertiary', 
    lastName: 'Admin', 
    role: 'ADMIN', 
    institutionType: 'TERTIARY' 
  },
  { 
    email: 'lecturer@tertiary-demo.trendscore.co.ke',
    firstName: 'Tertiary', 
    lastName: 'Lecturer', 
    role: 'TEACHER', 
    institutionType: 'TERTIARY' 
  },
];

async function main() {
  console.log('🌱 Seeding Phase 2 demo accounts...\n');

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 11);

  // 1. Ensure Schools exist
  // Note: schoolContextMiddleware currently picks the first active school.
  // We seed multiple to have them ready for when we add full schoolId linking.
  for (const school of schools) {
    const existing = await prisma.school.findFirst({ where: { name: school.name } });
    if (!existing) {
      await prisma.school.create({
        data: {
          name: school.name,
          institutionType: school.institutionType,
          status: 'ACTIVE',
          active: true,
        }
      });
      console.log(`  ✅ Created School: ${school.name} (${school.institutionType})`);
    } else {
      await prisma.school.update({
        where: { id: existing.id },
        data: { institutionType: school.institutionType, active: true }
      });
      console.log(`  🔄 Updated School: ${school.name} (${school.institutionType})`);
    }
  }

  // 2. Ensure Users exist
  for (const user of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { 
          institutionType: user.institutionType, 
          role: user.role, 
          status: 'ACTIVE',
          password: hashedPassword
        }
      });
      console.log(`  🔄 Updated User: ${user.email} (${user.institutionType})`);
      continue;
    }

    await prisma.user.create({
      data: {
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        institutionType: user.institutionType,
        status: 'ACTIVE',
        emailVerified: true,
      }
    });
    console.log(`  ✅ Created User: ${user.email} (${user.institutionType})`);
  }

  console.log(`\n✅ Done. Password for all demo accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => { 
    console.error('❌ Seed failed:', e); 
    process.exit(1); 
  })
  .finally(() => prisma.$disconnect());
