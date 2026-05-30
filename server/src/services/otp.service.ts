import { SmsService } from './sms.service';
import prisma from '../config/database';
import { SMS_MESSAGES, OTP_CONFIG } from '../config/communication.messages';
import crypto from 'crypto';

interface OtpResult {
    success: boolean;
    message: string;
    expiresAt?: Date;
}

interface OtpVerifyResult {
    success: boolean;
    message: string;
    user?: any;
}

export class OtpService {
    // OTP Configuration
    private static readonly OTP_LENGTH = 6;
    private static readonly OTP_EXPIRY_MINUTES = 10;

    private static shouldSkipOtp(): boolean {
        return process.env.NODE_ENV !== 'production' && process.env.SKIP_OTP === 'true';
    }

    /**
     * Generate a 6-digit OTP code
     */
    private static generateOTP(): string {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Send OTP to user's phone
     */
    static async sendOTP(email: string): Promise<OtpResult> {
        try {
            console.log(`📱 OTP request received`);

            // 1. Find user by email
            const user = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    status: true
                }
            });

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            if (user.status !== 'ACTIVE') {
                return { success: false, message: 'Account is not active' };
            }

            // Skip OTP for super admins
            if (user.role === 'SUPER_ADMIN') {
                console.log(`\n🔑 OTP bypassed for super admin: ${user.email}\n`);
                return {
                    success: true,
                    message: 'OTP not required for super admins',
                    expiresAt: new Date()
                };
            }

            if (!user.phone) {
                return { success: false, message: 'No phone number registered' };
            }

            // 2. Generate OTP
            const otpCode = this.generateOTP();
            const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000);

            if (this.shouldSkipOtp()) {
                console.log(`\n🔑 DEV SKIP OTP enabled for ${user.email}. No SMS will be sent.\n`);
                return {
                    success: true,
                    message: 'OTP skipped in development environment',
                    expiresAt
                };
            }

            // Dev-mode safety valve: print OTP to console when SMS may not be configured
            if (process.env.NODE_ENV !== 'production') {
                console.log(`\n🔑 ============================================`);
                console.log(`   DEV MODE OTP for ${user.email}: ${otpCode}`);
                console.log(`   Phone: ${user.phone} | Expires in ${OTP_CONFIG.expiryMinutes}min`);
                console.log(`🔑 ============================================\n`);
            }

            // 3. Store OTP in database
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    phoneVerificationCode: otpCode,
                    phoneVerificationSentAt: new Date()
                }
            });

            // 4. Send SMS (async — failure does NOT fail the request)
            const message = SMS_MESSAGES.otp(otpCode, OTP_CONFIG.expiryMinutes);

            SmsService.sendSms(
                user.phone,
                message
            ).catch((error: any) => {
                console.warn(`⚠️ OTP SMS delivery failed: ${error.message}`);
            });

            return {
                success: true,
                message: `OTP sent to ${this.maskPhoneNumber(user.phone)}.`,
                expiresAt
            };

        } catch (error: any) {
            console.error('OTP Send Error:', error);
            return { success: false, message: 'Failed to send OTP' };
        }
    }

    /**
     * Verify OTP and return user data
     */
    static async verifyOTP(email: string, otp: string): Promise<OtpVerifyResult> {
        try {
            // 1. Find user
            const user = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    roles: true,
                    status: true,
                    phone: true,
                    institutionType: true,
                    phoneVerificationCode: true,
                    phoneVerificationSentAt: true,
                },
            });

            if (!user) return { success: false, message: 'User not found' };

            // Skip OTP verification for super admins (still mark account verified)
            if (user.role === 'SUPER_ADMIN') {
                console.log(`\n🔑 OTP verification bypassed for super admin: ${user.email}\n`);
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        phoneVerificationCode: null,
                        phoneVerificationSentAt: null,
                    },
                });
                return {
                    success: true,
                    message: 'OTP verification not required for super admins',
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        roles: user.roles?.length ? user.roles : [user.role],
                        status: user.status,
                        phone: user.phone,
                        institutionType: user.institutionType,
                        emailVerified: true,
                    }
                };
            }

            if (this.shouldSkipOtp()) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        phoneVerificationCode: null,
                        phoneVerificationSentAt: null,
                    },
                });
                return {
                    success: true,
                    message: 'OTP skipped in development environment',
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        roles: user.roles?.length ? user.roles : [user.role],
                        status: user.status,
                        phone: user.phone,
                        institutionType: user.institutionType,
                        emailVerified: true,
                    }
                };
            }

            // 2. Check if OTP exists
            if (!user.phoneVerificationCode || !user.phoneVerificationSentAt) {
                return { success: false, message: 'No OTP sent' };
            }

            // 3. Check if OTP has expired
            const sentAt = new Date(user.phoneVerificationSentAt);
            const expiryTime = new Date(sentAt.getTime() + OTP_CONFIG.expiryMinutes * 60 * 1000);

            if (new Date() > expiryTime) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { phoneVerificationCode: null, phoneVerificationSentAt: null }
                });
                return { success: false, message: 'OTP has expired' };
            }

            // 4. Verify OTP
            if (user.phoneVerificationCode !== otp) {
                return { success: false, message: 'Invalid OTP code' };
            }

            // 5. Clear OTP
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    phoneVerificationCode: null,
                    phoneVerificationSentAt: null,
                    emailVerified: true
                }
            });

            // 6. Return user data
            return {
                success: true,
                message: 'OTP verified successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    roles: user.roles?.length ? user.roles : [user.role],
                    status: user.status,
                    institutionType: user.institutionType,
                    emailVerified: true,
                    phone: user.phone
                }
            };

        } catch (error: any) {
            console.error('OTP Verify Error:', error);
            return { success: false, message: 'Verification failed' };
        }
    }

    private static maskPhoneNumber(phone: string): string {
        if (!phone || phone.length < 8) return phone;
        const start = phone.substring(0, 3);
        const end = phone.substring(phone.length - 4);
        return `${start}****${end}`;
    }

    static async canRequestOTP(email: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
        try {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { phoneVerificationSentAt: true }
            });
            if (!user || !user.phoneVerificationSentAt) return { allowed: true };
            const COOLDOWN_SECONDS = 60;
            const timeSinceLastOTP = (Date.now() - new Date(user.phoneVerificationSentAt).getTime()) / 1000;
            if (timeSinceLastOTP < COOLDOWN_SECONDS) {
                return { allowed: false, waitSeconds: Math.ceil(COOLDOWN_SECONDS - timeSinceLastOTP) };
            }
            return { allowed: true };
        } catch (error) {
            return { allowed: true };
        }
    }
}
