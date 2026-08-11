import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { PRODUCT_EMAIL_DOMAIN, PRODUCT_TEMP_PASSWORD_PREFIX } from '../config/productIdentity';
import { studentPasswordIssuanceService } from './studentPasswordIssuance.service';

type EnsureStudentAccountInput = {
  learnerId?: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  // Optional delivery channels for password issuance
  deliveryChannels?: {
    parentPhone?: string | null;
    guardianPhone?: string | null;
    studentPhone?: string | null;
    parentEmail?: string | null;
  } | null;
};

const STUDENT_EMAIL_DOMAIN = PRODUCT_EMAIL_DOMAIN;

const normalizeBaseUsername = (admissionNumber: string): string => {
  const normalized = String(admissionNumber || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `STUDENT-${Date.now()}`;
};

const buildStudentEmail = (username: string): string => `${username}@${STUDENT_EMAIL_DOMAIN}`;

const generateTemporaryPassword = (): string => {
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${PRODUCT_TEMP_PASSWORD_PREFIX}@${rand}`;
};

const findExistingStudentByIdentity = async (username: string, email: string) => {
  return prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }]
    },
    select: {
      id: true,
      role: true,
      username: true,
      email: true
    }
  });
};

const reserveUniqueStudentIdentity = async (baseUsername: string): Promise<{ username: string; email: string }> => {
  let candidate = baseUsername;
  let suffix = 0;

  // Keep trying deterministic variants until one is free.
  while (true) {
    const email = buildStudentEmail(candidate);
    const existing = await findExistingStudentByIdentity(candidate, email);
    if (!existing) return { username: candidate, email };

    suffix += 1;
    candidate = `${baseUsername}-${suffix}`;
  }
};

export const ensureStudentAccountForLearner = async (input: EnsureStudentAccountInput): Promise<{ created: boolean; userId: string | null }> => {
  const baseUsername = normalizeBaseUsername(input.admissionNumber);
  const canonicalEmail = buildStudentEmail(baseUsername);

  const linkAccount = async (userId: string) => {
    if (!input.learnerId) return;
    await prisma.learner.update({
      where: { id: input.learnerId },
      data: { studentUserId: userId },
    });
  };

  // The explicit learner link is the durable source of truth. It prevents a
  // changed admission number or a formatted legacy username from producing a
  // second student account for the same learner.
  if (input.learnerId) {
    const linkedLearner = await prisma.learner.findUnique({
      where: { id: input.learnerId },
      select: { studentUserId: true },
    });
    if (linkedLearner?.studentUserId) {
      const linkedUser = await prisma.user.findUnique({
        where: { id: linkedLearner.studentUserId },
        select: { id: true, role: true },
      });
      if (linkedUser?.role === 'STUDENT') {
        await prisma.user.update({
          where: { id: linkedUser.id },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            middleName: input.middleName ?? null,
            phone: input.phone ?? null,
            status: 'ACTIVE',
          },
        });
        return { created: false, userId: linkedUser.id };
      }
    }
  }

  const existing = await findExistingStudentByIdentity(baseUsername, canonicalEmail);
  if (existing?.role === 'STUDENT') {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName ?? null,
        phone: input.phone ?? null,
        status: 'ACTIVE'
      }
    });
    await linkAccount(existing.id);
    return { created: false, userId: existing.id };
  }

  const { username, email } = existing
    ? await reserveUniqueStudentIdentity(baseUsername)
    : { username: baseUsername, email: canonicalEmail };

  const tempPassword = generateTemporaryPassword();
  const passwordResetToken = randomBytes(32).toString('hex');
  const passwordResetExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const createdUser = await prisma.user.create({
    data: {
      username,
      email,
      password: await bcrypt.hash(tempPassword, 11),
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName ?? null,
      phone: input.phone ?? null,
      role: 'STUDENT',
      status: 'ACTIVE',
      passwordResetToken,
      passwordResetExpiry
    },
    select: { id: true }
  });
  await linkAccount(createdUser.id);

  // Attempt password delivery if delivery channels were provided.
  // Failures must never block account creation — they are caught and logged.
  if (input.deliveryChannels) {
    try {
      await studentPasswordIssuanceService.issueInitialPassword({
        learnerId: '', // not available here — only used for logging
        studentUserId: createdUser.id,
        admissionNumber: input.admissionNumber,
        firstName: input.firstName,
        tempPassword, // plain-text — still in scope, discarded after this call
        parentPhone: input.deliveryChannels.parentPhone ?? null,
        guardianPhone: input.deliveryChannels.guardianPhone ?? null,
        studentPhone: input.deliveryChannels.studentPhone ?? null,
        parentEmail: input.deliveryChannels.parentEmail ?? null,
      });
    } catch (err: any) {
      console.warn(
        `[ensureStudentAccountForLearner] Password delivery failed for student ${input.admissionNumber}:`,
        err?.message ?? err,
      );
    }
  }

  return { created: true, userId: createdUser.id };
};
