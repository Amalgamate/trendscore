import { Request, Response } from 'express';
import { OtpService } from '../services/otp.service';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import prisma from '../config/database';
import fs from 'fs';

import logger from '../utils/logger';
/**
 * Send OTP to user's phone
 * POST /api/auth/otp/send
 */
export const sendOTP = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const logMsg = `[${new Date().toISOString()}] CONTROLLER: OTP Request for: ${email}\n`;
        fs.appendFileSync('otp-debug.log', logMsg);

        if (!email) {
            fs.appendFileSync('otp-debug.log', `[${new Date().toISOString()}] CONTROLLER ERROR: Email is required\n`);
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check rate limiting
        const canRequest = await OtpService.canRequestOTP(email);
        if (!canRequest.allowed) {
            return res.status(429).json({
                success: false,
                message: `Please wait ${canRequest.waitSeconds} seconds before requesting a new OTP`
            });
        }

        // Send OTP
        const result = await OtpService.sendOTP(email);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json(result);

    } catch (error: any) {
        logger.error('Send OTP Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send OTP'
        });
    }
};

/**
 * Verify OTP and login user
 * POST /api/auth/otp/verify
 */
export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Verify OTP
        const result = await OtpService.verifyOTP(email, otp);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        const schoolConfig = await prisma.school.findFirst({
            where: { archived: false },
            orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: { id: true, institutionType: true, institutionTypeLocked: true, name: true },
        });

        const userRoles = (result.user?.roles?.length ? result.user.roles : [result.user?.role]) as string[];
        const requiresInstitutionSetup =
            userRoles.includes('SUPER_ADMIN') && !(schoolConfig?.institutionTypeLocked === true);

        const userPayload = {
            ...result.user,
            roles: userRoles,
            schoolId: schoolConfig?.id || null,
            institutionType:
                result.user?.institutionType || schoolConfig?.institutionType || 'PRIMARY_CBC',
            institutionTypeLocked: schoolConfig?.institutionTypeLocked === true,
            requiresInstitutionSetup,
            school: schoolConfig ? { id: schoolConfig.id, name: schoolConfig.name } : null,
        };

        const token = generateAccessToken(userPayload);
        const refreshToken = generateRefreshToken(userPayload);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            refreshToken,
            user: userPayload,
        });

    } catch (error: any) {
        logger.error('Verify OTP Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify OTP'
        });
    }
};
