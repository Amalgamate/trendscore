/**
 * Learner Controller — single-tenant
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { LearnerStatus, Gender } from '@prisma/client';
import { getInstitutionType } from '../utils/institutionNormalizer';
import { generateAdmissionNumber } from '../services/admissionNumber.service';
import { feeService } from '../services/fee.service';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email.service';
import { parentService } from '../services/parent.service';
import { parentAccessService } from '../services/parent-access.service';
import { ensureStudentAccountForLearner } from '../services/studentAccount.service';
import { auditService } from '../services/audit.service';
import { v2 as cloudinary } from 'cloudinary';
import { PRODUCT_STORAGE_PREFIX } from '../config/productIdentity';

import logger from '../utils/logger';
const SKIP_PARENT_PORTAL_NOTIFICATIONS = process.env.SKIP_PARENT_PORTAL_NOTIFICATIONS === 'true' || process.env.NODE_ENV === 'test';
const SECONDARY_GRADE_CODES = ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3'] as const;

const applyInstitutionGradeScope = (
  institutionType: 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY',
  whereClause: any = {}
) => {
  if (institutionType === 'SECONDARY') {
    whereClause.OR = [
      { grade: { in: [...SECONDARY_GRADE_CODES] as any } },
      { grade: { startsWith: 'FORM' } }
    ];
    return whereClause;
  }
  whereClause.NOT = {
    ...(whereClause.NOT || {}),
    OR: [
      { grade: { in: [...SECONDARY_GRADE_CODES] as any } },
      { grade: { startsWith: 'FORM' } }
    ]
  };
  return whereClause;
};

const ensureLearnerClassEnrollment = async (learner: {
  id: string;
  grade: string;
  stream?: string | null;
  institutionType: 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';
}) => {
  const classCandidates = await prisma.class.findMany({
    where: {
      grade: learner.grade,
      institutionType: learner.institutionType,
      active: true,
      archived: false,
    },
    select: { id: true, stream: true },
    orderBy: [{ academicYear: 'desc' }, { updatedAt: 'desc' }],
  });
  const targetClass = classCandidates.find((item) => item.stream === learner.stream);
  if (!targetClass) {
    logger.warn('[learner enrollment] No active class matches learner grade', {
      learnerId: learner.id,
      grade: learner.grade,
      stream: learner.stream,
    });
    return;
  }

  await prisma.$transaction([
    prisma.classEnrollment.updateMany({
      where: {
        learnerId: learner.id,
        active: true,
        classId: { not: targetClass.id },
      },
      data: { active: false },
    }),
    prisma.classEnrollment.upsert({
      where: {
        classId_learnerId: {
          classId: targetClass.id,
          learnerId: learner.id,
        },
      },
      update: { active: true, archived: false, archivedAt: null, archivedBy: null },
      create: { classId: targetClass.id, learnerId: learner.id, active: true },
    }),
  ]);
};

/**
 * LearnerController handles learner operations in TrendScore.
 */

export class LearnerController {
  async getAllLearners(req: AuthRequest, res: Response) {
    const currentUserRole = req.user!.role;
    const currentUserId = req.user!.userId;
    const institutionType = getInstitutionType(req);
    const { grade, stream, status, search, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    logger.info('📚 [LEARNER] getAllLearners called with filters:', { grade, stream, status, search, page, limit });

    let whereClause: any = { archived: false, institutionType };
    whereClause = applyInstitutionGradeScope(institutionType, whereClause);
    if (currentUserRole === 'PARENT') {
      whereClause.id = { in: await parentAccessService.getAccessibleLearnerIds(currentUserId) };
    }
    if (grade) whereClause.grade = String(grade);
    if (stream) whereClause.stream = String(stream);
    if (status) whereClause.status = String(status).toUpperCase() as LearnerStatus;
    if (search) {
      whereClause.OR = [
        { firstName:       { contains: search as string, mode: 'insensitive' } },
        { lastName:        { contains: search as string, mode: 'insensitive' } },
        { middleName:      { contains: search as string, mode: 'insensitive' } },
        { admissionNumber: { contains: search as string, mode: 'insensitive' } },
        { upiNumber:       { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (status === 'DROPPED_OUT') delete whereClause.archived;

    try {
      const [learners, total] = await Promise.all([
        prisma.learner.findMany({
          where: whereClause,
          select: {
            id: true, firstName: true, lastName: true, middleName: true,
            admissionNumber: true, grade: true, stream: true, dateOfBirth: true,
            gender: true, parentId: true, status: true,
            primaryContactPhone: true, primaryContactName: true,
            primaryContactType: true, primaryContactEmail: true,
            guardianPhone: true, guardianName: true,
            isTransportStudent: true,
            createdBy: true,
            enrollments: {
              where: { active: true },
              select: { class: { select: { teacherId: true } } }
            },
            parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { grade: 'asc' }, { stream: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
          skip, take: Number(limit),
        }),
        prisma.learner.count({ where: whereClause }),
      ]);

      logger.info('📚 [LEARNER] Query results:', {
        learnersCount: learners.length,
        total,
        whereClause,
        uniqueStreams: Array.from(new Set(learners.map(l => l.stream))),
        sampleLearners: learners.slice(0, 3).map(l => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, stream: l.stream }))
      });

      res.json({ success: true, data: learners, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
    } catch (error: any) {
      logger.error('❌ [LEARNER] getAllLearners failed:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
        where: whereClause
      });

      if (error.code === 'P2022') {
        throw new ApiError(500, `Database Schema Mismatch: The column '${error.meta?.column}' is missing in learners table. Please run migrations.`);
      }

      throw new ApiError(500, 'Server error fetching learners: ' + error.message);
    }
  }

  async getLearnerStats(_req: AuthRequest, res: Response) {
    const institutionType = getInstitutionType(_req);
    const whereClause: any = applyInstitutionGradeScope(institutionType, { archived: false, institutionType });
    try {
      const [statusCounts, gradeCounts, genderCounts, total, active] = await Promise.all([
        prisma.learner.groupBy({ by: ['status'], _count: true, where: whereClause }),
        prisma.learner.groupBy({ by: ['grade'],  _count: true, where: { ...whereClause, status: 'ACTIVE' } }),
        prisma.learner.groupBy({ by: ['gender'], _count: true, where: { ...whereClause, status: 'ACTIVE' } }),
        prisma.learner.count({ where: whereClause }),
        prisma.learner.count({ where: { ...whereClause, status: 'ACTIVE' } }),
      ]);

      res.json({
        success: true,
        data: {
          total,
          active,
          byStatus: statusCounts.reduce((a, i) => { a[i.status] = i._count; return a; }, {} as any),
          byGrade:  gradeCounts.reduce((a, i)  => { a[i.grade]  = i._count; return a; }, {} as any),
          byGender: genderCounts.reduce((a, i) => { a[i.gender] = i._count; return a; }, {} as any),
        },
      });
    } catch (error: any) {
      logger.error('❌ [LEARNER] getLearnerStats failed:', {
        code: error.code,
        message: error.message,
        meta: error.meta
      });

      if (error.code === 'P2022') {
        throw new ApiError(500, `Database Schema Mismatch: The column '${error.meta?.column}' is missing in learners table. Please run migrations.`);
      }

      throw new ApiError(500, 'Server error fetching learner statistics: ' + error.message);
    }
  }

  async getLearnerById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const institutionType = getInstitutionType(req);
    const learner = await prisma.learner.findUnique({
      where: { id },
      include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');
    if (learner.institutionType !== institutionType) throw new ApiError(404, 'Learner not found');
    if (req.user!.role === 'PARENT' && !(await parentAccessService.canAccessLearner(req.user!.userId, id))) {
      throw new ApiError(403, 'You can only access your own children');
    }
    res.json({ success: true, data: learner });
  }

  async getLearnerByAdmissionNumber(req: AuthRequest, res: Response) {
    const institutionType = getInstitutionType(req);
    const learner = await prisma.learner.findUnique({
      where: { admissionNumber: req.params.admissionNumber },
      include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');
    if (learner.institutionType !== institutionType) throw new ApiError(404, 'Learner not found');
    res.json({ success: true, data: learner });
  }

  async createLearner(req: AuthRequest, res: Response) {
    const currentUserId = req.user!.userId;
    const institutionType = getInstitutionType(req);
    let {
      admissionNumber, firstName, lastName, middleName, dateOfBirth, gender, grade, stream,
      parentId, guardianName, guardianPhone, guardianEmail, medicalConditions, allergies,
      emergencyContact, emergencyPhone, bloodGroup, address, county, subCounty, previousSchool,
      religion, specialNeeds, isTransportStudent, photo, fatherName, fatherPhone, fatherEmail, fatherDeceased,
      motherName, motherPhone, motherEmail, motherDeceased, guardianRelation,
      primaryContactType, primaryContactName, primaryContactPhone, primaryContactEmail,
      generateInvoice, isScholarshipStudent, scholarshipType, scholarshipAmount,
    } = req.body;

    const defaultStream = await prisma.stream.findFirst({
      where: { active: true, archived: false, isDefault: true },
      select: { name: true },
    });
    const resolvedStream = String(stream || defaultStream?.name || '').trim();
    if (!resolvedStream) {
      throw new ApiError(400, 'Stream is required. Configure streams and select a default before adding learners.');
    }

    const admissionNumberWasProvided = Boolean(String(admissionNumber || '').trim());
    if (!admissionNumberWasProvided) {
      try {
        admissionNumber = await generateAdmissionNumber(resolvedStream, new Date().getFullYear());
      } catch (error: any) {
        if (String(error?.message || '').includes('MANUAL')) {
          throw new ApiError(400, 'Admission number is required when numbering mode is MANUAL.');
        }
        throw new ApiError(500, 'Could not generate admission number: ' + error.message);
      }
    } else {
      admissionNumber = String(admissionNumber).trim();
    }
    if (!firstName || !lastName || !dateOfBirth || !gender || !grade) {
      throw new ApiError(400, 'Missing required fields');
    }
    const configuredStream = await prisma.stream.findFirst({
      where: { name: resolvedStream, active: true, archived: false },
      select: { id: true },
    });
    if (!configuredStream) throw new ApiError(400, `Stream "${resolvedStream}" is not an active configured stream.`);
    const matchingClass = await prisma.class.findFirst({
      where: { grade: String(grade), stream: resolvedStream, institutionType, active: true, archived: false },
      select: { id: true },
    });
    if (!matchingClass) throw new ApiError(400, 'Create the matching active class before adding learners.');
    const existing = await prisma.learner.findUnique({ where: { admissionNumber } });
    if (existing) {
      throw new ApiError(
        409,
        `A learner with admission number ${admissionNumber} already exists. Open the existing learner and use Edit instead.`
      );
    }

    try {
      // ── Automatic Parent Account Registration ────────────────────────────────
      if (!parentId) {
        const pPhone = guardianPhone || primaryContactPhone;
        const pName  = guardianName  || primaryContactName || 'Parent';

        if (pPhone) {
          const parent = await parentService.getOrCreateParent({
            phone: pPhone,
            name: pName
          });
          if (parent) parentId = parent.id;
        }
      }

      let finalPhotoUrl: string | undefined = undefined;
      if (photo && photo.startsWith('data:image')) {
        const cloudName = process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME;
        if (cloudName) {
          try {
            const result = await cloudinary.uploader.upload(photo, { folder: `${PRODUCT_STORAGE_PREFIX}/photos` });
            finalPhotoUrl = result.secure_url;
          } catch (uploadErr: any) {
            logger.warn('Cloudinary upload failed, skipping photo:', uploadErr.message);
          }
        } else {
          logger.warn('[createLearner] Cloudinary not configured, photo skipped.');
        }
      }

      const scholarshipSelected = isScholarshipStudent === true || isScholarshipStudent === 'true';
      const normalizedScholarshipType = scholarshipSelected
        ? (scholarshipType === 'PARTIAL' ? 'PARTIAL' : 'FULL')
        : null;
      const normalizedScholarshipAmount = scholarshipSelected && normalizedScholarshipType === 'PARTIAL' && scholarshipAmount !== undefined && scholarshipAmount !== null && scholarshipAmount !== ''
        ? Number(scholarshipAmount)
        : null;

      const buildLearnerCreateData = (admNo: string, includeScholarshipFields: boolean) => ({
        admissionNumber: admNo, firstName, lastName, middleName,
        dateOfBirth: new Date(dateOfBirth), gender: gender as Gender, grade: String(grade) as any,
        institutionType,
        stream: resolvedStream, guardianName, guardianPhone, guardianEmail,
        medicalConditions, allergies, emergencyContact, emergencyPhone, bloodGroup,
        address, county, subCounty, previousSchool, religion, specialNeeds,
        isTransportStudent: isTransportStudent === true || isTransportStudent === 'true',
        ...(includeScholarshipFields ? {
          isScholarshipStudent: scholarshipSelected,
          scholarshipType: normalizedScholarshipType,
          scholarshipAmount: normalizedScholarshipAmount,
        } : {}),
        photoUrl: finalPhotoUrl,
        fatherName, fatherPhone, fatherEmail, fatherDeceased: fatherDeceased || false,
        motherName, motherPhone, motherEmail, motherDeceased: motherDeceased || false,
        guardianRelation, primaryContactType, primaryContactName, primaryContactPhone, primaryContactEmail,
        parent: parentId ? { connect: { id: parentId } } : undefined,
        status: LearnerStatus.ACTIVE, createdBy: currentUserId,
      });

      const isScholarshipFieldError = (err: any) => {
        const msg = String(err?.message || '');
        return (
          msg.includes('isScholarshipStudent') ||
          msg.includes('scholarshipType') ||
          msg.includes('scholarshipAmount')
        );
      };

      let learner;
      try {
        learner = await prisma.learner.create({
          data: buildLearnerCreateData(admissionNumber, true),
          include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
        });
      } catch (createErr: any) {
        if (isScholarshipFieldError(createErr)) {
          logger.warn('[createLearner] Scholarship fields not supported by runtime Prisma client/schema; retrying create without scholarship columns');
          learner = await prisma.learner.create({
            data: buildLearnerCreateData(admissionNumber, false),
            include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
          });
        } else if (createErr?.code === 'P2002') {
          if (admissionNumberWasProvided) {
            throw new ApiError(
              409,
              `A learner with admission number ${admissionNumber} already exists. Open the existing learner and use Edit instead.`
            );
          }
          // Last-line protection for race conditions: regenerate and retry once.
          const retryAdmissionNumber = await generateAdmissionNumber(resolvedStream, new Date().getFullYear());
          try {
            learner = await prisma.learner.create({
              data: buildLearnerCreateData(retryAdmissionNumber, true),
              include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
            });
          } catch (retryErr: any) {
            if (!isScholarshipFieldError(retryErr)) throw retryErr;
            logger.warn('[createLearner] Scholarship fields not supported on duplicate-retry path; retrying without scholarship columns');
            learner = await prisma.learner.create({
              data: buildLearnerCreateData(retryAdmissionNumber, false),
              include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
            });
          }
          admissionNumber = retryAdmissionNumber;
        } else {
          throw createErr;
        }
      }

      if (primaryContactType && primaryContactPhone && primaryContactName) {
        const primaryParent = await parentService.syncPrimaryParentForLearner({
          learnerId: learner.id,
          admissionNumber,
          phone: primaryContactPhone,
          name: primaryContactName,
          email: primaryContactEmail,
          relationship: primaryContactType,
        });
        learner.parentId = primaryParent.id;
        learner.parent = {
          id: primaryParent.id,
          firstName: primaryParent.firstName,
          lastName: primaryParent.lastName,
          email: primaryParent.email,
          phone: primaryParent.phone,
        };
      }

      // ── Create student system user by default ────────────────────────────────
      try {
        await ensureStudentAccountForLearner({
          learnerId: learner.id,
          admissionNumber,
          firstName,
          lastName,
          middleName: middleName || null,
          phone: null,
          // A student signs in by selecting their account after entering the
          // family's phone number, but has a separate password.  Send that
          // initial password to the responsible adult rather than storing the
          // shared phone on the student User record.
          deliveryChannels: {
            parentPhone: learner.parent?.phone ?? primaryContactPhone ?? null,
            guardianPhone: guardianPhone ?? fatherPhone ?? motherPhone ?? null,
            parentEmail:
              learner.parent?.email ??
              primaryContactEmail ??
              guardianEmail ??
              fatherEmail ??
              motherEmail ??
              null,
          },
        });
      } catch (userError) {
        logger.error('Failed to create student system user:', userError);
      }
      await ensureLearnerClassEnrollment(learner);

      const shouldGenerateInvoice = generateInvoice !== false && generateInvoice !== 'false';

      // ── Generate Initial Fee Invoice ──────────────────────────────────────────
      let invoiceMessage = '';
      if (shouldGenerateInvoice) {
        try {
          const invResult = await feeService.generateInvoiceForLearner(learner.id);
          if (invResult.success) {
            if (invResult.created) {
              invoiceMessage = ` Invoice ${invResult.invoice.invoiceNumber} generated for ${invResult.invoice.term} ${invResult.invoice.academicYear}.`;
            } else {
              invoiceMessage = ' (Invoice already exists for this term).';
            }
          } else {
            invoiceMessage = ` (⚠️ Note: Fee invoice not generated: ${invResult.error})`;
          }
        } catch (e: any) {
          logger.error('Invoice generation failed:', e);
          invoiceMessage = ` (⚠️ Error: Automated invoice failed: ${e.message})`;
        }
      } else {
        invoiceMessage = ' (Automatic invoice disabled).';
      }

      res.status(201).json({
        success: true,
        data: learner,
        message: `Learner created successfully.${invoiceMessage}`
      });
    } catch (createError: any) {
      logger.error('[createLearner] Full error:', createError);
      if (createError instanceof ApiError) throw createError;
      throw new ApiError(500, `Creation failed: ${createError.message || JSON.stringify(createError)}`);
    }
  }

  async updateLearner(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const callerRole = req.user!.role;
      const callerId = req.user!.userId;

      const learner = await prisma.learner.findUnique({ where: { id } });
      if (!learner) throw new ApiError(404, 'Learner not found');

      // ── Parent guard: parents can only update their own children,
      //    and only the display name + photo fields.
      if (callerRole === 'PARENT') {
        if (!(await parentAccessService.canAccessLearner(callerId, id))) {
          throw new ApiError(403, 'You can only update your own child\'s profile');
        }
        const { firstName, lastName, photo } = req.body;
        const parentUpdateData: any = { updatedBy: callerId };
        if (firstName && String(firstName).trim().length >= 2) parentUpdateData.firstName = String(firstName).trim();
        if (lastName && String(lastName).trim().length >= 2) parentUpdateData.lastName = String(lastName).trim();
        if (photo) parentUpdateData.photoUrl = photo;
        if (Object.keys(parentUpdateData).length <= 1) {
          throw new ApiError(400, 'Provide at least one field: firstName, lastName, or photo');
        }
        const updated = await prisma.learner.update({
          where: { id },
          data: parentUpdateData,
          select: { id: true, firstName: true, lastName: true, photoUrl: true, grade: true, stream: true },
        });
        return res.json({ success: true, message: 'Profile updated successfully', data: updated });
      }

      // ── Non-parent update flow continues below ──

      const allowedFields = [
        'firstName', 'lastName', 'middleName',
        'dateOfBirth', 'gender', 'grade', 'stream',
        'upiNumber',
        'parentId',
        'guardianName', 'guardianPhone', 'guardianEmail',
        'fatherName', 'fatherPhone', 'fatherEmail', 'fatherDeceased',
        'motherName', 'motherPhone', 'motherEmail', 'motherDeceased',
        'guardianRelation',
        'primaryContactType', 'primaryContactName', 'primaryContactPhone', 'primaryContactEmail',
        'medicalConditions', 'allergies', 'emergencyContact', 'emergencyPhone',
        'bloodGroup', 'address', 'county', 'subCounty',
        'previousSchool', 'religion', 'specialNeeds', 'isTransportStudent',
        'isScholarshipStudent', 'scholarshipType', 'scholarshipAmount',
        'status', 'exitDate', 'exitReason',
      ];

      const updateData: any = { updatedBy: req.user!.userId };
      const normalizeScalar = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
      };
      const normalizeDateOnly = (value: unknown): string => {
        if (!value) return '';
        const d = new Date(value as string | Date);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
      };

      for (const field of allowedFields) {
        const val = req.body[field];
        if (val === undefined) continue;

        if (field === 'gender') { if (val && val !== '') updateData.gender = val as Gender; continue; }
        if (field === 'grade')  { if (val && val !== '') updateData.grade = String(val); continue; }
        if (field === 'status') { if (val && val !== '') updateData.status = val as LearnerStatus; continue; }

        if (field === 'fatherDeceased' || field === 'motherDeceased' || field === 'isTransportStudent' || field === 'isScholarshipStudent') {
          updateData[field] = val === true || val === 'true'; continue;
        }

        updateData[field] = val === '' ? null : val;
      }

      if (updateData.isScholarshipStudent === false) {
        updateData.scholarshipType = null;
        updateData.scholarshipAmount = null;
      } else if (updateData.scholarshipType === 'FULL') {
        updateData.scholarshipAmount = null;
      } else if (updateData.scholarshipAmount !== undefined && updateData.scholarshipAmount !== null && updateData.scholarshipAmount !== '') {
        updateData.scholarshipAmount = Number(updateData.scholarshipAmount);
      }

      // The contact explicitly marked primary is the authoritative parent.
      // Synchronization happens after the learner fields are saved so the
      // parent account, direct parentId, and family link cannot drift apart.
      const shouldSyncPrimaryParent = Boolean(
        req.body.primaryContactType &&
        req.body.primaryContactPhone &&
        req.body.primaryContactName
      );

      if (req.body.dateOfBirth && req.body.dateOfBirth !== '') updateData.dateOfBirth = new Date(req.body.dateOfBirth);
      if (req.body.dateOfAdmission && req.body.dateOfAdmission !== '') updateData.admissionDate = new Date(req.body.dateOfAdmission);
      if (req.body.exitDate && req.body.exitDate !== '') updateData.exitDate = new Date(req.body.exitDate);

      const sensitiveChanges: string[] = [];
      if (Object.prototype.hasOwnProperty.call(req.body, 'upiNumber')) {
        const oldVal = normalizeScalar(learner.upiNumber);
        const nextVal = normalizeScalar(req.body.upiNumber);
        if (oldVal !== nextVal) sensitiveChanges.push('UPI/NEMIS');
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'dateOfBirth')) {
        const oldVal = normalizeDateOnly(learner.dateOfBirth);
        const nextVal = normalizeDateOnly(req.body.dateOfBirth);
        if (oldVal !== nextVal) sensitiveChanges.push('Date of Birth');
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'grade')) {
        const oldVal = normalizeScalar(learner.grade);
        const nextVal = normalizeScalar(req.body.grade);
        if (oldVal !== nextVal) sensitiveChanges.push('Grade');
      }

      if (sensitiveChanges.length > 0) {
        const changeReason = normalizeScalar(req.body.changeReason);
        if (!changeReason || changeReason.length < 10) {
          throw new ApiError(
            400,
            `Reason for change is required (minimum 10 characters) when updating: ${sensitiveChanges.join(', ')}`
          ).withCode('VALIDATION_ERROR');
        }
      }

      if (req.body.photo && req.body.photo !== '') {
        let finalPhotoUrl = req.body.photo;
        if (req.body.photo.startsWith('data:image')) {
          const cloudName = process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME;
          if (cloudName) {
            try {
              const result = await cloudinary.uploader.upload(req.body.photo, { folder: `${PRODUCT_STORAGE_PREFIX}/photos` });
              finalPhotoUrl = result.secure_url;
            } catch (uploadErr: any) {
              logger.warn('Cloudinary upload failed, keeping base64:', uploadErr.message);
            }
          }
        }
        updateData.photoUrl = finalPhotoUrl;
      }

      const updated = await prisma.learner.update({
        where: { id },
        data: updateData,
        include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      });

      if (shouldSyncPrimaryParent) {
        const parent = await parentService.syncPrimaryParentForLearner({
          learnerId: updated.id,
          admissionNumber: updated.admissionNumber,
          phone: String(updated.primaryContactPhone),
          name: String(updated.primaryContactName),
          email: updated.primaryContactEmail,
          relationship: updated.primaryContactType,
        });
        updated.parentId = parent.id;
        updated.parent = {
          id: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          phone: parent.phone,
        };
      }

      if (sensitiveChanges.length > 0) {
        const reason = normalizeScalar(req.body.changeReason);
        const auditEntries: Array<{ field: string; oldValue: string; newValue: string }> = [];

        const oldUpi = normalizeScalar(learner.upiNumber);
        const newUpi = normalizeScalar(updated.upiNumber);
        if (oldUpi !== newUpi) {
          auditEntries.push({ field: 'upiNumber', oldValue: oldUpi, newValue: newUpi });
        }

        const oldDob = normalizeDateOnly(learner.dateOfBirth);
        const newDob = normalizeDateOnly(updated.dateOfBirth);
        if (oldDob !== newDob) {
          auditEntries.push({ field: 'dateOfBirth', oldValue: oldDob, newValue: newDob });
        }

        const oldGrade = normalizeScalar(learner.grade);
        const newGrade = normalizeScalar(updated.grade);
        if (oldGrade !== newGrade) {
          auditEntries.push({ field: 'grade', oldValue: oldGrade, newValue: newGrade });
        }

        await Promise.all(
          auditEntries.map((entry) =>
            auditService.logChange({
              entityType: 'learner',
              entityId: updated.id,
              action: 'UPDATE',
              userId: req.user!.userId,
              field: entry.field,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              reason,
            })
          )
        );
      }

      // Keep student portal account in sync (and backfill if missing).
      try {
        await ensureStudentAccountForLearner({
          learnerId: updated.id,
          admissionNumber: updated.admissionNumber,
          firstName: updated.firstName,
          lastName: updated.lastName,
          middleName: updated.middleName || null,
          phone: null,
          deliveryChannels: {
            parentPhone: updated.parent?.phone ?? updated.primaryContactPhone ?? null,
            guardianPhone:
              updated.guardianPhone ??
              updated.fatherPhone ??
              updated.motherPhone ??
              null,
            parentEmail:
              updated.parent?.email ??
              updated.primaryContactEmail ??
              updated.guardianEmail ??
              updated.fatherEmail ??
              updated.motherEmail ??
              null,
          },
        });
      } catch (userError) {
        logger.error('Failed to sync student system user:', userError);
      }
      await ensureLearnerClassEnrollment(updated);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('[updateLearner] error:', error?.message || error);
      if (error instanceof ApiError) throw error;
      if (error?.code === 'P2002') throw new ApiError(409, 'A learner with that admission number already exists.');
      throw new ApiError(500, error?.message || 'Failed to update learner');
    }
  }

  async deleteLearner(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { permanent = false } = req.query;
    if (permanent === 'true' && req.user!.role === 'SUPER_ADMIN') {
      await prisma.learner.delete({ where: { id } });
      return res.json({ success: true, message: 'Permanently deleted' });
    }
    await prisma.learner.update({ where: { id }, data: { archived: true, archivedAt: new Date(), archivedBy: req.user!.userId, status: 'DROPPED_OUT', exitDate: new Date() } });
    res.json({ success: true, message: 'Learner archived' });
  }

  async getLearnersByGrade(req: AuthRequest, res: Response) {
    const { grade } = req.params;
    const { stream, status = 'ACTIVE' } = req.query;
    const institutionType = getInstitutionType(req);
    const learners = await prisma.learner.findMany({
      where: {
        grade: String(grade),
        status: String(status).toUpperCase() as LearnerStatus,
        stream: stream ? (stream as string) : undefined,
        archived: false,
        institutionType,
      },
      include: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json({ success: true, data: learners, count: learners.length });
  }

  async uploadLearnerPhoto(req: AuthRequest, res: Response) {
    const updated = await prisma.learner.update({ where: { id: req.params.id }, data: { photoUrl: req.body.photoData, updatedBy: req.user!.userId } });
    res.json({ success: true, data: updated });
  }

  async deleteLearnerPhoto(req: AuthRequest, res: Response) {
    const updated = await prisma.learner.update({ where: { id: req.params.id }, data: { photoUrl: null, updatedBy: req.user!.userId } });
    res.json({ success: true, data: updated });
  }

  async getUpcomingBirthdays(_req: AuthRequest, res: Response) {
    const institutionType = getInstitutionType(_req);
    const activeLearners = await prisma.learner.findMany({
      where: { status: 'ACTIVE', archived: false, institutionType },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, grade: true, stream: true, admissionNumber: true },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
    const upcoming = activeLearners
      .filter(l => { if (!l.dateOfBirth) return false; const d = new Date(l.dateOfBirth); const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate()); return thisYear >= today && thisYear <= nextWeek; })
      .map(l => ({ ...l, name: `${l.firstName} ${l.lastName}`, daysUntil: Math.ceil((new Date(today.getFullYear(), new Date(l.dateOfBirth!).getMonth(), new Date(l.dateOfBirth!).getDate()).getTime() - today.getTime()) / 86400000) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    res.json({ success: true, data: upcoming });
  }

  async promoteLearners(req: AuthRequest, res: Response) {
    const { learnerIds, nextGrade } = req.body;
    const result = await prisma.$transaction(learnerIds.map((id: string) => prisma.learner.update({ where: { id }, data: { grade: String(nextGrade), updatedBy: req.user!.userId } })));
    await Promise.all(result.map((learner) => ensureLearnerClassEnrollment(learner)));
    res.json({ success: true, message: `Promoted ${result.length} learners` });
  }

  /**
   * PATCH /api/learners/:id/parent-update
   * Allows a parent to update ONLY their own child's firstName, lastName, and photo.
   * Scoped to parent role — no EDIT_LEARNER permission required.
   */
  async parentUpdateLearner(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const parentId = req.user!.userId;

    // 1. Verify this learner belongs to the requesting parent
    const learner = await prisma.learner.findUnique({
      where: { id },
      select: { id: true, parentId: true, firstName: true, lastName: true },
    });

    if (!learner) {
      throw new ApiError(404, 'Learner not found');
    }

    if (!(await parentAccessService.canAccessLearner(parentId, id))) {
      throw new ApiError(403, 'You can only update your own child\'s profile');
    }

    // 2. Extract only the allowed fields — parents cannot change grade, class, etc.
    const { firstName, lastName, photo } = req.body;

    const updateData: Record<string, any> = { updatedBy: parentId };

    if (firstName && String(firstName).trim().length >= 2) {
      updateData.firstName = String(firstName).trim();
    }
    if (lastName && String(lastName).trim().length >= 2) {
      updateData.lastName = String(lastName).trim();
    }
    if (photo) {
      // photo is a base64 data URL — store as photoUrl
      updateData.photoUrl = photo;
    }

    if (Object.keys(updateData).length <= 1) {
      throw new ApiError(400, 'Provide at least one field to update: firstName, lastName, or photo');
    }

    const updated = await prisma.learner.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        grade: true,
        stream: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  }
}

export const learnerController = new LearnerController();
