import { Request, Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { InstitutionType } from '@prisma/client';
import { gradingService } from '../services/grading.service';
import { EmailService } from '../services/email-resend.service';
import { SmsService } from '../services/sms.service';
import { encrypt } from '../utils/encryption.util';

import logger from '../utils/logger';

function mapSchoolTypeToInstitution(schoolType?: string): InstitutionType {
  const s = String(schoolType || '').toLowerCase();
  if (s.includes('secondary')) return 'SECONDARY';
  if (s.includes('tertiary') || s.includes('college') || s.includes('university')) return 'TERTIARY';
  return 'PRIMARY_CBC';
}

export class OnboardingController {
  /**
   * Full system registration — creates school, super-admin, and seeds defaults.
   * Allowed only on empty installs unless ALLOW_PUBLIC_REGISTRATION=true.
   * POST /api/onboarding/register
   */
  async registerFull(req: Request, res: Response) {
    try {
      const {
        fullName,
        email,
        phone,
        address,
        county,
        subCounty,
        ward,
        schoolName,
        schoolType,
        password,
        passwordConfirm,
      } = req.body;

      if (!fullName || fullName.length < 2 || fullName.length > 100) {
        return res.status(400).json({ success: false, error: 'Invalid full name' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email' });
      }

      const phoneRegex = /^(\+?[1-9]\d{1,14}|0[1-9]\d{8})$/;
      if (!phone || !phoneRegex.test(phone.replace(/\s+/g, ''))) {
        return res.status(400).json({ success: false, error: 'Invalid phone format' });
      }

      if (!address || !county || !schoolName || !password || !passwordConfirm) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      if (password !== passwordConfirm) {
        return res.status(400).json({ success: false, error: 'Passwords do not match' });
      }

      const strong =
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password);

      if (!strong) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
        });
      }

      const allowPublic = process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
      const [userCount, schoolCount] = await Promise.all([
        prisma.user.count(),
        prisma.school.count({ where: { archived: false } }),
      ]);

      if ((userCount > 0 || schoolCount > 0) && !allowPublic) {
        return res.status(403).json({
          success: false,
          error: 'Registration is closed for this installation. Contact your administrator.',
        });
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone }] },
        select: { id: true },
      });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Email or phone already exists' });
      }

      const institutionType = mapSchoolTypeToInstitution(schoolType);

      const result = await prisma.$transaction(async (tx) => {
        const year = new Date().getFullYear();
        const existingSeq = await tx.admissionSequence.findUnique({ where: { academicYear: year } });
        if (!existingSeq) {
          await tx.admissionSequence.create({
            data: { academicYear: year, currentValue: 0 },
          });
        }

        for (const name of ['A', 'B', 'C', 'D']) {
          await tx.stream.upsert({
            where: { name },
            update: { active: true, archived: false },
            create: { name, active: true },
          });
        }

        const existingComm = await tx.communicationConfig.findFirst({ select: { id: true } });
        if (!existingComm) {
          await tx.communicationConfig.create({
            data: {
              smsEnabled: true,
              smsProvider: 'mobilesasa',
              smsBaseUrl: 'https://api.mobilesasa.com',
              smsApiKey: process.env.MOBILESASA_API_KEY
                ? encrypt(process.env.MOBILESASA_API_KEY)
                : null,
              hasApiKey: !!process.env.MOBILESASA_API_KEY,
            },
          });
        }

        const school = await tx.school.create({
          data: {
            name: schoolName.trim(),
            address: address.trim(),
            county: county.trim(),
            subCounty: subCounty?.trim() || null,
            ward: ward?.trim() || null,
            schoolType: schoolType?.trim() || null,
            email: email.trim(),
            phone: phone.replace(/\s+/g, ''),
            institutionType,
            institutionTypeLocked: false,
          },
          select: { id: true, name: true, institutionType: true },
        });

        const [firstName, ...rest] = fullName.trim().split(' ');
        const lastName = rest.join(' ') || ' ';
        const hashed = await bcrypt.hash(password, 12);
        const token = randomUUID();

        const user = await tx.user.create({
          data: {
            email,
            password: hashed,
            firstName,
            lastName,
            role: 'SUPER_ADMIN',
            roles: ['SUPER_ADMIN'],
            phone: phone.replace(/\s+/g, ''),
            institutionType,
            emailVerified: true,
            emailVerificationToken: token,
            emailVerificationSentAt: new Date(),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            roles: true,
            phone: true,
            institutionType: true,
            createdAt: true,
          },
        });

        return { user, token, school };
      });

      try {
        await gradingService.getGradingSystem('SUMMATIVE');
        await gradingService.getGradingSystem('CBC');
      } catch (err) {
        logger.warn('Warning: Failed to initialise grading systems:', err);
      }

      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/auth/login`;

      EmailService.sendOnboardingEmail({
        to: result.user.email,
        schoolName: result.school.name,
        adminName: `${result.user.firstName} ${result.user.lastName}`,
        loginUrl,
      }).catch((err) => logger.error('Failed to send onboarding email:', err));

      if (result.user.phone) {
        SmsService.sendWelcomeSms(result.user.phone, result.school.name).catch((err) =>
          logger.error('Failed to send welcome SMS:', err)
        );
      }

      res.status(201).json({
        success: true,
        data: {
          user: {
            ...result.user,
            requiresInstitutionSetup: true,
            institutionTypeLocked: false,
            schoolId: result.school.id,
          },
          school: result.school,
        },
        meta: {
          emailVerificationToken:
            process.env.NODE_ENV === 'development' ? result.token : undefined,
        },
      });
    } catch (error: any) {
      logger.error('Onboarding registerFull error:', error);
      if (error?.code === 'P2002') {
        return res.status(400).json({ success: false, error: 'School or user already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to register' });
    }
  }

  /**
   * Verify email address via token
   * GET /api/onboarding/verify-email?token=...
   */
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.query as any;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Missing token' });
      }
      const user = await prisma.user.findFirst({
        where: { emailVerificationToken: String(token) },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: 'Invalid token' });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: 'ACTIVE', emailVerificationToken: null },
      });
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Verification failed' });
    }
  }

  /**
   * Verify phone OTP
   * POST /api/onboarding/verify-phone
   */
  async verifyPhone(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Missing email or code' });
      }
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, phoneVerificationCode: true },
      });
      if (!user || user.phoneVerificationCode !== code) {
        return res.status(400).json({ success: false, error: 'Invalid code' });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerificationCode: null,
          phoneVerificationSentAt: null,
          emailVerified: true,
        },
      });
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Phone verification failed' });
    }
  }
}
