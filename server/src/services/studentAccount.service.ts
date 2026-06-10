import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { PRODUCT_EMAIL_DOMAIN, PRODUCT_TEMP_PASSWORD_PREFIX } from '../config/productIdentity';

type EnsureStudentAccountInput = {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
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

  return { created: true, userId: createdUser.id };
};
