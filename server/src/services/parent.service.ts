import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { UserStatus } from '@prisma/client';
import { PRODUCT_EMAIL_DOMAIN, PRODUCT_PARENT_PORTAL_URL } from '../config/productIdentity';

export interface CreateOrGetParentArgs {
  phone?: string;
  name?: string;
  email?: string;
  status?: UserStatus;
  skipNotifications?: boolean;
}

export class ParentService {
  /**
   * Generates a secure random 8-character password.
   * Format: 3 uppercase + 3 digits + 2 lowercase.
   */
  public generateTemporaryPassword(): string {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const rand   = (charset: string) => charset[randomBytes(1)[0] % charset.length];
    return [rand(upper), rand(upper), rand(upper), rand(digits), rand(digits), rand(digits), rand(lower), rand(lower)].join('');
  }

  /**
   * Safe helper to find an existing parent by phone, or completely onboard
   * a brand new parent securely with generated passwords and credentials.
   */
  public async getOrCreateParent(args: CreateOrGetParentArgs) {
    if (!args.phone && !args.email) return null;

    // Check by phone first if provided
    if (args.phone) {
      const existingParent = await prisma.user.findFirst({
        where: { phone: args.phone, role: 'PARENT' }
      });
      if (existingParent) return existingParent;
    }

    // Prepare default values
    const phone = args.phone || null;
    const pName = args.name || 'Parent';
    const nameParts = pName.split(' ');
    const firstName = nameParts[0] || 'Parent';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Guardian';
    
    // Deduplicate Email collisions securely
    let finalEmail = args.email || null;
    if (finalEmail) {
      const existingEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
      if (existingEmail && phone) {
        finalEmail = `${phone.replace(/\D/g, '')}-${Date.now()}@${PRODUCT_EMAIL_DOMAIN}`;
      }
    } else if (phone) {
      finalEmail = `${phone.replace(/\D/g, '')}@${PRODUCT_EMAIL_DOMAIN}`;
    } else {
      finalEmail = `parent-${Date.now()}@${PRODUCT_EMAIL_DOMAIN}`;
    }

    // Force secure temporary credentials
    const parentPassword = this.generateTemporaryPassword();
    const forceResetToken = randomBytes(32).toString('hex');
    const forceResetExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const parent = await prisma.user.create({
      data: {
        username: finalEmail,
        email: finalEmail,
        firstName,
        lastName,
        phone,
        password: await bcrypt.hash(parentPassword, 11),
        role: 'PARENT',
        status: args.status || 'ACTIVE',
        passwordResetToken: forceResetToken,
        passwordResetExpiry: forceResetExpiry,
      }
    });

    const skipNotifications = args.skipNotifications || process.env.SKIP_PARENT_PORTAL_NOTIFICATIONS === 'true' || process.env.NODE_ENV === 'test';

    // Ship welcome notifications
    if (!skipNotifications) {
      const portalUrl = PRODUCT_PARENT_PORTAL_URL;
      const credentialsMessage = `Hello ${firstName}, your Parent Portal account is ready. Login at ${portalUrl} with email: ${finalEmail} and temporary password: ${parentPassword}. You will be prompted to set a new password on first login.`;

      if (phone) {
        try {
          await SmsService.sendSms(phone, credentialsMessage);
        } catch (smsError: any) {
          console.warn('[ParentService] Parent portal SMS setup failed:', smsError?.message || smsError);
        }
      }

      if (finalEmail.includes('@') && !finalEmail.endsWith(`@${PRODUCT_EMAIL_DOMAIN}`)) {
        try {
          await EmailService.sendNotificationEmail({
            to: finalEmail,
            subject: 'Your Parent Portal Login Credentials',
            text: credentialsMessage,
            html: `<p>${credentialsMessage}</p>`
          });
        } catch (emailError: any) {
          console.warn('[ParentService] Parent portal email setup failed:', emailError?.message || emailError);
        }
      }
    }

    return parent;
  }
}

export const parentService = new ParentService();
