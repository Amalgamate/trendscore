import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { EmailService } from './email-resend.service';
import { applyModulePackageToSchool, normalizePackageId } from './moduleCatalog.service';

export interface SchoolProvisioningData {
  schoolName: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
  registrationNo?: string;
  address?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  phone?: string;
  email?: string;
  website?: string;
  principalName?: string;
  principalPhone?: string;
  motto?: string;
  vision?: string;
  mission?: string;
  packageId?: string;
}

export interface ProvisioningResult {
  school: any;
  adminUser: any;
  admissionSequence: any;
  tempPassword: string;
  loginUrl: string;
}

export async function provisionNewSchool(data: SchoolProvisioningData): Promise<ProvisioningResult> {
  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const packageId = normalizePackageId(data.packageId || 'starter');

  const result = await prisma.$transaction(async (tx) => {
    const existingSchool = await tx.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (existingSchool) throw new Error('School already provisioned');

    const school = await tx.school.create({
      data: {
        name: data.schoolName,
        admissionFormatType: 'NO_BRANCH',
        registrationNo: data.registrationNo,
        address: data.address,
        county: data.county,
        subCounty: data.subCounty,
        ward: data.ward,
        phone: data.phone,
        email: data.email || data.adminEmail,
        website: data.website,
        principalName: data.principalName,
        principalPhone: data.principalPhone,
        motto: data.motto,
        vision: data.vision,
        mission: data.mission,
        active: true,
        status: 'ACTIVE',
        curriculumType: 'CBC_AND_EXAM',
        assessmentMode: 'MIXED',
      },
    });

    const adminUser = await tx.user.create({
      data: {
        email: data.adminEmail,
        username: data.adminEmail.split('@')[0],
        password: hashedPassword,
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        phone: data.adminPhone,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: false,
      },
    });

    const currentYear = new Date().getFullYear();

    const admissionSequence = await tx.admissionSequence.create({
      data: { academicYear: currentYear, currentValue: 0 },
    });

    const termDates = [
      { term: 'TERM_1', start: new Date(currentYear, 0, 15), end: new Date(currentYear, 3, 15) },
      { term: 'TERM_2', start: new Date(currentYear, 4, 15), end: new Date(currentYear, 7, 15) },
      { term: 'TERM_3', start: new Date(currentYear, 8, 15), end: new Date(currentYear, 11, 15) },
    ];
    for (const { term, start, end } of termDates) {
      await tx.termConfig.create({
        data: {
          academicYear: currentYear,
          term: term as any,
          startDate: start,
          endDate: end,
          formativeWeight: 30.0,
          summativeWeight: 70.0,
          isActive: term === 'TERM_1',
          isClosed: false,
          createdBy: adminUser.id,
        },
      });
    }

    const aggStrategies = [
      { type: 'OPENER',     strategy: 'DROP_LOWEST_N' as const, nValue: 1    },
      { type: 'WEEKLY',     strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'MONTHLY',    strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'CAT',        strategy: 'BEST_N' as const,         nValue: 3    },
      { type: 'MID_TERM',   strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'ASSIGNMENT', strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'PROJECT',    strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'PRACTICAL',  strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'QUIZ',       strategy: 'DROP_LOWEST_N' as const, nValue: 1    },
      { type: 'OBSERVATION',strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'ORAL',       strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'EXAM',       strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
      { type: 'OTHER',      strategy: 'SIMPLE_AVERAGE' as const, nValue: null },
    ];
    for (const { type, strategy, nValue } of aggStrategies) {
      await tx.aggregationConfig.create({
        data: { type: type as any, strategy, nValue, weight: 1.0, createdBy: adminUser.id },
      });
    }

    const feeTypes = [
      { code: 'TUITION',    name: 'Tuition',           category: 'ACADEMIC'         },
      { code: 'ACTIVITY',   name: 'Activity Fee',      category: 'EXTRA_CURRICULAR' },
      { code: 'TRANSPORT',  name: 'Transport',         category: 'TRANSPORT'        },
      { code: 'MEALS',      name: 'Meals',             category: 'BOARDING'         },
      { code: 'EXAM',       name: 'Examination Fee',   category: 'ACADEMIC'         },
      { code: 'LIBRARY',    name: 'Library',           category: 'ACADEMIC'         },
      { code: 'SPORTS',     name: 'Sports Fee',        category: 'EXTRA_CURRICULAR' },
      { code: 'TECHNOLOGY', name: 'Technology Fee',    category: 'ACADEMIC'         },
      { code: 'MISC',       name: 'Miscellaneous',     category: 'OTHER'            },
    ];
    for (const ft of feeTypes) {
      await tx.feeType.create({
        data: { code: ft.code, name: ft.name, category: ft.category as any, isActive: true },
      });
    }

    await applyModulePackageToSchool(school.id, packageId, tx, adminUser.id);

    return { school, adminUser, admissionSequence };
  });

  try {
    await EmailService.sendWelcomeEmail({
      to: data.adminEmail,
      schoolName: data.schoolName,
      adminName: `${data.adminFirstName} ${data.adminLastName}`,
      tempPassword,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }

  return { ...result, tempPassword, loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000' };
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = 'Aa1!';
  for (let i = 4; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
