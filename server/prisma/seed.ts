import { PrismaClient, UserRole, UserStatus, AdmissionFormatType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedFeeTypes } from './seed-fee-types';
import { seedLMSCourses } from './seeders/seed-lms-courses';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  console.log('\n🏫 Ensuring TrendScore Template school exists...');
  const templateSchoolData = {
    name: 'TrendScore Template',
    registrationNo: 'TRENDSCORE-TEMPLATE-001',
    address: 'Nairobi, Kenya',
    county: 'Nairobi',
    subCounty: 'Westlands',
    phone: '+254712345678',
    email: 'template@trendscore.co.ke',
    principalName: 'Template Principal',
    principalPhone: '+254712345678',
    active: true,
    status: 'TEMPLATE',
    admissionFormatType: AdmissionFormatType.BRANCH_PREFIX_START,
    branchSeparator: '-'
  };

  // Try find by name first
  let templateSchool = await prisma.school.findFirst({
    where: { name: 'TrendScore Template' }
  });

  // If not found by name, try find by registration number
  if (!templateSchool) {
    templateSchool = await prisma.school.findFirst({
      where: { registrationNo: 'TRENDSCORE-TEMPLATE-001' }
    });
  }

  if (!templateSchool) {
    templateSchool = await prisma.school.create({
      data: templateSchoolData
    });
    console.log(`   ✅ Created template school: ${templateSchool.name} (ID: ${templateSchool.id})`);
  } else {
    // Optional: Update details if needed, or just log existence
    console.log(`   ℹ️  Template school already exists: ${templateSchool.name} (ID: ${templateSchool.id})`);
  }

  const users: Array<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    phone: string;
    institutionType?: 'PRIMARY_CBC' | 'SECONDARY';
  }> = [
      {
        email: 'superadmin@template.test', // Updated to match user preference
        password: process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeNow123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        phone: '+254713612141',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'admin@local.test',
        password: 'Admin123!',
        firstName: 'School',
        lastName: 'Admin',
        role: 'ADMIN',
        phone: '+254712345002',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'headteacher@local.test',
        password: 'HeadTeacher123!',
        firstName: 'Head',
        lastName: 'Teacher',
        role: 'HEAD_TEACHER',
        phone: '+254712345003',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'teacher@local.test',
        password: 'Teacher123!',
        firstName: 'John',
        lastName: 'Teacher',
        role: 'TEACHER',
        phone: '+254712345004',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'parent@local.test',
        password: 'Parent123!',
        firstName: 'Jane',
        lastName: 'Parent',
        role: 'PARENT',
        phone: '+254712345005',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'accountant@local.test',
        password: 'Accountant123!',
        firstName: 'Finance',
        lastName: 'Officer',
        role: 'ACCOUNTANT',
        phone: '+254712345006',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'receptionist@local.test',
        password: 'Receptionist123!',
        firstName: 'Front',
        lastName: 'Desk',
        role: 'RECEPTIONIST',
        phone: '+254712345007',
        institutionType: 'PRIMARY_CBC',
      },
      {
        email: 'admin.ss@local.test',
        password: 'Admin123!',
        firstName: 'Senior',
        lastName: 'Admin',
        role: 'ADMIN',
        phone: '+254712345008',
        institutionType: 'SECONDARY',
      },
      {
        email: 'teacher.ss@local.test',
        password: 'Teacher123!',
        firstName: 'Senior',
        lastName: 'Teacher',
        role: 'TEACHER',
        phone: '+254712345009',
        institutionType: 'SECONDARY',
      }
    ];

  console.log('👥 Creating development users...');

  for (const userData of users) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        // Keep seeded users aligned with expected portal scoping (institutionType).
        const expectedInstitutionType = userData.institutionType || 'PRIMARY_CBC';
        if ((existingUser as any).institutionType !== expectedInstitutionType) {
          try {
            await prisma.user.update({
              where: { email: userData.email },
              data: { institutionType: expectedInstitutionType as any },
            });
            console.log(`   🔁 Updated ${userData.email} institutionType -> ${expectedInstitutionType}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            console.error(`   ❌ Error updating institutionType for ${userData.email}:`, msg);
          }
        } else {
          console.log(`   ⏭️  User ${userData.email} already exists, skipping...`);
        }
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          phone: userData.phone,
          institutionType: userData.institutionType || 'PRIMARY_CBC',
          status: 'ACTIVE' as UserStatus,
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true
        }
      });

      console.log(`   ✅ Created ${user.role}: ${user.email}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Error creating ${userData.email}:`, errorMessage);
    }
  }

  // Subscription plans have been removed from schema
  console.log('\n💳 Subscription plans disabled in this version');

  // Seed streams for all schools
  console.log('\n📚 Seeding streams A-D...');
  const schools = await prisma.school.findMany({ where: { active: true } });

  if (schools.length > 0) {
    const streamNames = ['A', 'B', 'C', 'D'];

    for (const school of schools) {
      console.log(`   📝 Creating streams for ${school.name}...`);

      for (const streamName of streamNames) {
        try {
          // Check if stream already exists
          const existingStream = await prisma.streamConfig.findFirst({
            where: {
              name: streamName
            }
          });

          if (existingStream) {
            console.log(`      ⏭️  Stream ${streamName} already exists, skipping...`);
            continue;
          }

          // Create the stream
          const stream = await prisma.streamConfig.create({
            data: {
              name: streamName,
              active: true
            }
          });

          console.log(`      ✅ Created stream: ${stream.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`      ❌ Error creating stream ${streamName}:`, errorMessage);
        }
      }
    }
  } else {
    console.log('   ⚠️  No active schools found, skipping stream seeding');
  }

  // Seed fee types
  await seedFeeTypes(prisma);

  // Seed Senior High Grading System (EE2-BE1)
  const { seedSeniorGrading } = await import('./seeders/seed-senior-grading');
  await seedSeniorGrading(prisma);

  // Seed LMS courses
  await seedLMSCourses();

  console.log('\n✨ Database seed completed!');
  console.log('\n📋 Development User Credentials:');
  console.log('━'.repeat(60));
  users.forEach(user => {
    console.log(`   ${user.role.padEnd(20)} | ${user.email.padEnd(25)} | ${user.password}`);
  });
  console.log('━'.repeat(60));
  console.log('\n💡 Use these credentials to log in to the application.');
  console.log('⚠️  Remember to change the SUPER_ADMIN password in production!');

  console.log('\n\n📚 SEEDING DEPENDENCY CHAIN:');
  console.log('━'.repeat(60));
  console.log('Run these commands in order to fully seed your database:');
  console.log('');
  console.log('1️⃣  npm run seed');
  console.log('   └─ Creates: School, Branch, Users, Fee Types, Streams');
  console.log('');
  console.log('2️⃣  npm run seed:classes');
  console.log('   └─ Creates: Classes for each grade (GRADE_1, GRADE_2, etc.)');
  console.log('   └─ ⚠️  MUST run after npm run seed');
  console.log('');
  console.log('3️⃣  npm run seed:learning-areas');
  console.log('   └─ Creates: Learning areas for existing grade levels');
  console.log('   └─ ⚠️  MUST run after npm run seed:classes');
  console.log('   └─ 🔗 Validates that classes exist before seeding areas');
  console.log('━'.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
