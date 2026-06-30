import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import {
  PRODUCT_TEMP_PASSWORD_PREFIX,
  PRODUCT_PARENT_PORTAL_URL,
} from '../config/productIdentity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliverStudentPasswordParams {
  learnerId: string;
  studentUserId: string;
  admissionNumber: string;
  firstName: string;
  tempPassword: string;
  parentPhone?: string | null;
  guardianPhone?: string | null;
  studentPhone?: string | null;
  parentEmail?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the channel value is a non-null, non-empty string. */
const isAvailable = (channel: string | null | undefined): channel is string =>
  typeof channel === 'string' && channel.trim().length > 0;

/**
 * Generate a temporary password in the same format used by
 * `ensureStudentAccountForLearner` in studentAccount.service.ts.
 *   e.g. "TrendScore@A1B2C3"
 */
const generateTemporaryPassword = (): string => {
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${PRODUCT_TEMP_PASSWORD_PREFIX}@${rand}`;
};

/**
 * Derive the base username from an admission number — mirrors the logic in
 * studentAccount.service.ts so we can reverse-lookup a learner from a
 * student User record.
 */
const normalizeBaseUsername = (admissionNumber: string): string => {
  const normalized = String(admissionNumber || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `STUDENT-${Date.now()}`;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StudentPasswordIssuanceService {
  /**
   * Build the message delivered to the parent/guardian/student.
   *
   * Format: "Hello, [firstName]'s TrendSCORE login is ready.
   *          Phone: [phone]. Password: [tempPassword].
   *          Change it on first login at [PRODUCT_URL]."
   */
  private buildMessage(firstName: string, phone: string, tempPassword: string): string {
    return (
      `Hello, ${firstName}'s TrendSCORE login is ready. ` +
      `Phone: ${phone}. Password: ${tempPassword}. ` +
      `Change it on first login at ${PRODUCT_PARENT_PORTAL_URL}.`
    );
  }

  // -------------------------------------------------------------------------
  // issueInitialPassword
  // -------------------------------------------------------------------------

  /**
   * Attempt delivery of the temporary password through available channels in
   * order: parentPhone → guardianPhone → studentPhone → parentEmail.
   *
   * Stops after the first successful delivery. If no channel is available,
   * logs a warning but does NOT throw. If a channel fails, logs a warning
   * and tries the next one.
   */
  async issueInitialPassword(params: DeliverStudentPasswordParams): Promise<void> {
    const { admissionNumber, firstName, tempPassword } = params;

    // Build the ordered list of delivery attempts
    const channels: Array<() => Promise<void>> = [];

    // SMS channels (parentPhone, guardianPhone, studentPhone)
    for (const phone of [params.parentPhone, params.guardianPhone, params.studentPhone]) {
      if (!isAvailable(phone)) continue;

      const capturedPhone = phone; // close over the current value
      channels.push(async () => {
        const message = this.buildMessage(firstName, capturedPhone, tempPassword);
        const result = await SmsService.sendSms(capturedPhone, message);
        if (!result.success) {
          throw new Error(result.error ?? 'SMS delivery failed');
        }
      });
    }

    // Email channel (parentEmail)
    if (isAvailable(params.parentEmail)) {
      const capturedEmail = params.parentEmail;
      channels.push(async () => {
        const text = this.buildMessage(firstName, capturedEmail, tempPassword);
        await EmailService.sendNotificationEmail({
          to: capturedEmail,
          subject: `${firstName}'s TrendSCORE Login Credentials`,
          text,
          html: `<p>${text}</p>`,
        });
      });
    }

    if (channels.length === 0) {
      console.warn(
        `[StudentPasswordIssuanceService] No delivery channel available for student ${admissionNumber}`,
      );
      return;
    }

    for (const attempt of channels) {
      try {
        await attempt();
        return; // first successful delivery — stop
      } catch (err: any) {
        console.warn(
          `[StudentPasswordIssuanceService] Delivery attempt failed for student ${admissionNumber}:`,
          err?.message ?? err,
        );
        // continue to the next channel
      }
    }

    // All channels exhausted without success — log but don't throw
    console.warn(
      `[StudentPasswordIssuanceService] All delivery channels failed for student ${admissionNumber}`,
    );
  }

  // -------------------------------------------------------------------------
  // resetStudentPassword
  // -------------------------------------------------------------------------

  /**
   * Regenerate a temporary password for the given student, persist the new
   * bcrypt hash + reset token, then re-deliver via available channels.
   *
   * @param studentUserId  User.id of the student whose password is being reset
   * @param triggeredBy    User.id (or label) of whoever triggered the reset
   */
  async resetStudentPassword(studentUserId: string, triggeredBy: string): Promise<void> {
    // 1. Generate new credentials
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 11);
    const passwordResetToken = randomBytes(32).toString('hex');
    const passwordResetExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    // 2. Persist the new hash + reset token
    const updatedUser = await prisma.user.update({
      where: { id: studentUserId },
      data: {
        password: hashedPassword,
        passwordResetToken,
        passwordResetExpiry,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
      },
    });

    console.log(
      `[StudentPasswordIssuanceService] Password reset for student ${studentUserId} triggered by ${triggeredBy}`,
    );

    // 3. Locate the learner linked to this student user so we can read
    //    delivery-channel phone / email fields.
    //
    //    The student User.username is derived from admissionNumber via
    //    normalizeBaseUsername() — optionally with a "-N" uniqueness suffix.
    //    Strip any trailing "-<digits>" suffix to recover the base username,
    //    then find the learner whose normalized admission number matches.
    const baseUsername = (updatedUser.username ?? '')
      .replace(/-\d+$/, '') // strip uniqueness suffix e.g. "ADM-001-1" → "ADM-001"
      .toUpperCase();

    // Narrow the search: the admission number, when normalized, must start
    // with the same characters as the base username. We use a contains filter
    // to avoid a full table scan — Prisma will use the admissionNumber index.
    // The final match is confirmed in-memory via normalizeBaseUsername().
    const candidates = await prisma.learner.findMany({
      where: {
        archived: false,
        admissionNumber: {
          // The base username is the normalized admission number (uppercase,
          // non-alphanumeric replaced with '-'). A case-insensitive search
          // for the first segment of the base username is a reasonable filter.
          contains: baseUsername.split('-')[0],
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        guardianPhone: true,
        fatherPhone: true,
        motherPhone: true,
        primaryContactPhone: true,
        primaryContactEmail: true,
        guardianEmail: true,
        parent: {
          select: {
            phone: true,
            email: true,
          },
        },
      },
    });

    const learner = candidates.find(
      (l) => normalizeBaseUsername(l.admissionNumber) === baseUsername,
    );

    if (!learner) {
      console.warn(
        `[StudentPasswordIssuanceService] Could not locate learner for student user ${studentUserId} (base username: ${baseUsername}). Skipping delivery.`,
      );
      return;
    }

    // 4. Build delivery channels from the learner's contact data
    //    Priority order: parentPhone → guardianPhone → studentPhone → parentEmail
    const parentPhone = learner.parent?.phone ?? null;
    const guardianPhone = learner.guardianPhone ?? learner.fatherPhone ?? learner.motherPhone ?? learner.primaryContactPhone ?? null;
    // No dedicated "studentPhone" on the Learner model — pass null
    const studentPhone: string | null = null;
    const parentEmail =
      learner.parent?.email ??
      learner.guardianEmail ??
      learner.primaryContactEmail ??
      null;

    // 5. Deliver
    await this.issueInitialPassword({
      learnerId: learner.id,
      studentUserId,
      admissionNumber: learner.admissionNumber,
      firstName: updatedUser.firstName ?? learner.firstName,
      tempPassword, // plain-text — never stored, discarded after this call
      parentPhone,
      guardianPhone,
      studentPhone,
      parentEmail,
    });
  }
}

export const studentPasswordIssuanceService = new StudentPasswordIssuanceService();
