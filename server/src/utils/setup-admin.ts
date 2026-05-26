import bcrypt from 'bcrypt';
import prisma from '../config/database';

/**
 * Ensures initial users exist in the database for testing and administration.
 */
export async function ensureSuperAdmin() {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@trendscore.app';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123!';
    const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'Demo@123!';
    const createExtraDemoUsers = (process.env.CREATE_EXTRA_DEMO_USERS || 'false').toLowerCase() === 'true';

    const usersToCreate: Array<{
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'SUPER_ADMIN' | 'TEACHER' | 'ACCOUNTANT' | 'PARENT';
        phone: string;
    }> = [
        {
            email: superAdminEmail,
            password: superAdminPassword,
            firstName: 'System',
            lastName: 'Administrator',
            role: 'SUPER_ADMIN' as const,
            phone: '0713612141'
        }
    ];

    if (createExtraDemoUsers) {
        usersToCreate.push(
            {
                email: 'teacher@demo.com',
                password: demoUserPassword,
                firstName: 'Demo',
                lastName: 'Teacher',
                role: 'TEACHER',
                phone: '0700000001'
            },
            {
                email: 'accountant@demo.com',
                password: demoUserPassword,
                firstName: 'Demo',
                lastName: 'Accountant',
                role: 'ACCOUNTANT',
                phone: '0700000002'
            },
            {
                email: 'parent@demo.com',
                password: demoUserPassword,
                firstName: 'Demo',
                lastName: 'Parent',
                role: 'PARENT',
                phone: '0700000003'
            }
        );
    }

    try {
        console.log('[SETUP] Checking/Creating initial users...');

        const hashRounds = process.env.NODE_ENV === 'production' ? 12 : 10;

        for (const userData of usersToCreate) {
            const existing = await prisma.user.findUnique({
                where: { email: userData.email },
                select: { id: true }
            });

            if (existing) {
                await prisma.user.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        role: userData.role,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        phone: userData.phone
                    }
                });
            } else {
                const finalHashedPassword = await bcrypt.hash(userData.password, hashRounds);
                await prisma.user.create({
                    data: {
                        email: userData.email,
                        password: finalHashedPassword,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        role: userData.role,
                        status: 'ACTIVE',
                        phone: userData.phone
                    }
                });
            }
            console.log(`✅ User ready: ${userData.email} (${userData.role})`);
        }

        if (!createExtraDemoUsers) {
            console.log('ℹ️ Extra demo users are disabled (CREATE_EXTRA_DEMO_USERS=false).');
        }

        // Ensure every fresh tenant DB has a resolvable active school context
        // without overwriting an already-provisioned school.
        const schoolCode = (process.env.SCHOOL_CODE || 'school').trim().toLowerCase();
        const schoolNameRaw = (process.env.SCHOOL_NAME || '').trim();
        const schoolName = schoolNameRaw || schoolCode
            .split(/[-_]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'School';

        const existingActiveSchool = await prisma.school.findFirst({
            where: {
                active: true,
                archived: false,
            },
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        if (existingActiveSchool) {
            console.log(`✅ School context ready: ${existingActiveSchool.id} (${existingActiveSchool.name})`);
        } else {
            await prisma.school.upsert({
                where: { id: schoolCode },
                create: {
                    id: schoolCode,
                    name: schoolName,
                    active: true,
                    status: 'ACTIVE',
                    archived: false,
                },
                update: {
                    name: schoolName,
                    active: true,
                    status: 'ACTIVE',
                    archived: false,
                },
            });
            console.log(`✅ School context ready: ${schoolCode} (${schoolName})`);
        }
    } catch (error: any) {
        console.error('❌ Error during user setup:', error.message);
    }
}
