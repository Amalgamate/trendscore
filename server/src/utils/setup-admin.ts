import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { invalidateAuthLookupCache } from '../services/auth-cache.service';
import {
    applyModulePackageToSchool,
    enableOptionalSchoolModules,
    initializeUnassignedSchoolModules,
} from '../services/moduleCatalog.service';

/**
 * Ensures initial users exist in the database for testing and administration.
 */
export async function ensureSuperAdmin() {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@trendscore.app';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123!';
    const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'System';
    const superAdminLastName = process.env.SUPER_ADMIN_LAST_NAME || 'Administrator';
    const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '0713612141';
    const activationToken = process.env.SUPER_ADMIN_ACTIVATION_TOKEN || '';
    const applicationId = process.env.APPLICATION_ID?.trim() || '';
    const institutionType = process.env.SCHOOL_INSTITUTION_TYPE === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY_CBC';
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
            firstName: superAdminFirstName,
            lastName: superAdminLastName,
            role: 'SUPER_ADMIN' as const,
            phone: superAdminPhone
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
        if (applicationId && existingActiveSchool?.provisioningApplicationId
            && existingActiveSchool.provisioningApplicationId !== applicationId) {
            throw new Error('This tenant is already linked to a different application');
        }
        const issueApplicationActivation = Boolean(
            applicationId && activationToken
            && existingActiveSchool?.provisioningApplicationId !== applicationId,
        );

        const hashRounds = process.env.NODE_ENV === 'production' ? 12 : 10;

        for (const userData of usersToCreate) {
            const existing = await prisma.user.findUnique({
                where: { email: userData.email },
                select: { id: true, role: true, status: true }
            });

            if (existing) {
                await prisma.user.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        role: userData.role,
                        ...((existing.role !== userData.role || existing.status !== 'ACTIVE' || issueApplicationActivation)
                            ? { authVersion: { increment: 1 } }
                            : {}),
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        phone: userData.phone,
                        ...(applicationId ? { institutionType } : {}),
                        ...(issueApplicationActivation ? {
                            emailVerified: false,
                            passwordResetToken: activationToken,
                            passwordResetExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        } : {}),
                    }
                });
                if (existing.role !== userData.role || existing.status !== 'ACTIVE' || issueApplicationActivation) {
                    await invalidateAuthLookupCache();
                }
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
                        phone: userData.phone,
                        institutionType,
                        emailVerified: !activationToken,
                        ...(activationToken ? {
                            passwordResetToken: activationToken,
                            passwordResetExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        } : {}),
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

        let activeSchool = existingActiveSchool;
        if (activeSchool) {
            console.log(`✅ School context ready: ${activeSchool.id} (${activeSchool.name})`);
        } else {
            activeSchool = await prisma.school.upsert({
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

        if (applicationId) {
            const schoolType = process.env.SCHOOL_TYPE || '';
            const accommodationType = process.env.SCHOOL_ACCOMMODATION_TYPE || '';
            const packageId = process.env.APPLICATION_PACKAGE_ID || '';
            let optionalModuleSlugs: string[] = [];
            try {
                const parsed = JSON.parse(process.env.APPLICATION_MODULE_SLUGS || '[]');
                if (!Array.isArray(parsed) || parsed.some(slug => typeof slug !== 'string')) {
                    throw new Error('Invalid approved module list');
                }
                optionalModuleSlugs = parsed;
            } catch (error) {
                throw new Error(`Invalid application module configuration: ${error instanceof Error ? error.message : String(error)}`);
            }
            if (!['PUBLIC_PRIMARY', 'PRIVATE_PRIMARY', 'PUBLIC_SECONDARY', 'PRIVATE_SECONDARY'].includes(schoolType)) {
                throw new Error('Invalid school type in approved application');
            }
            if (!['DAY', 'BOARDING', 'DAY_AND_BOARDING'].includes(accommodationType)) {
                throw new Error('Invalid accommodation type in approved application');
            }
            if ((institutionType === 'PRIMARY_CBC' && !['starter', 'standard', 'professional'].includes(packageId))
                || (institutionType === 'SECONDARY' && packageId)) {
                throw new Error('Invalid package selection in approved application');
            }
            if (optionalModuleSlugs.some(slug => slug !== 'transport')
                || (optionalModuleSlugs.length && process.env.SCHOOL_TRANSPORT_NEEDED !== 'true')) {
                throw new Error('Invalid optional modules in approved application');
            }
            if (activeSchool.provisioningApplicationId !== applicationId) {
                await prisma.$transaction(async tx => {
                    await tx.school.update({
                        where: { id: activeSchool.id },
                        data: {
                            schoolType,
                            accommodationType,
                            institutionType,
                            institutionTypeLocked: true,
                            provisioningApplicationId: applicationId,
                            ...(process.env.SCHOOL_ADDRESS ? { address: process.env.SCHOOL_ADDRESS } : {}),
                            ...(process.env.SCHOOL_COUNTY ? { county: process.env.SCHOOL_COUNTY } : {}),
                            ...(process.env.SCHOOL_SUB_COUNTY ? { subCounty: process.env.SCHOOL_SUB_COUNTY } : {}),
                            ...(process.env.SCHOOL_WARD ? { ward: process.env.SCHOOL_WARD } : {}),
                            ...(process.env.SCHOOL_PHONE ? { phone: process.env.SCHOOL_PHONE } : {}),
                            ...(process.env.SCHOOL_EMAIL ? { email: process.env.SCHOOL_EMAIL } : {}),
                        },
                    });
                    if (institutionType === 'SECONDARY') {
                        await initializeUnassignedSchoolModules(activeSchool.id, tx);
                    } else {
                        await applyModulePackageToSchool(activeSchool.id, packageId as 'starter' | 'standard' | 'professional', tx);
                    }
                    await enableOptionalSchoolModules(activeSchool.id, optionalModuleSlugs, tx);
                });
            }
        }
    } catch (error: any) {
        console.error('❌ Error during user setup:', error.message);
        throw error;
    }
}
