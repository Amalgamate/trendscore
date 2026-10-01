import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PRODUCT_NAME } from '../config/productIdentity';
import superAdminAccess from '../config/superAdminAccess.json';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting system setup...');

    // 1. Ensure School exists
    const schoolName = `${PRODUCT_NAME.toUpperCase()} DEMO ACADEMY`;
    console.log(`🏫 Ensuring school exists: ${schoolName}...`);
    const school = await prisma.school.upsert({
        where: { name: schoolName },
        update: {},
        create: {
            name: schoolName,
            status: 'ACTIVE',
            active: true,
            curriculumType: 'CBC_AND_EXAM',
        },
    });
    console.log(`✅ School ready: ${school.name} (ID: ${school.id})`);

    // 2. Ensure SuperAdmin exists
    const email = process.env.SUPER_ADMIN_EMAIL || superAdminAccess.email;
    const password = process.env.SUPER_ADMIN_PASSWORD || superAdminAccess.password;
    console.log(`👤 Ensuring SuperAdmin exists: ${email}...`);

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            status: 'ACTIVE',
            role: 'SUPER_ADMIN',
            phone: superAdminAccess.primaryPhone,
        },
        create: {
            email,
            password: hashedPassword,
            firstName: 'System',
            lastName: 'Administrator',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            phone: superAdminAccess.primaryPhone,
        },
    });
    console.log(`✅ SuperAdmin ready: ${admin.email} (ID: ${admin.id})`);

    console.log('\n✨ System setup complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error during setup:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
