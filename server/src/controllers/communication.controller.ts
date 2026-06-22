import { Request, Response } from 'express';
import prisma from '../config/database';
import { decrypt, encrypt } from '../utils/encryption.util';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email-resend.service';
import messageService from '../services/message.service';
import { AuthRequest } from '../middleware/permissions.middleware';
import { whatsappService } from '../services/whatsapp.service';
import { ApiError } from '../utils/error.util';
import { COMMUNICATION_CONFIG, ERROR_MESSAGES, SMS_MESSAGES } from '../config/communication.messages';

import logger from '../utils/logger';

const sanitizeGeneratedEmailHtml = (html: string) =>
    html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[\s\S]*?>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .trim();

const extractJsonObject = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not include JSON');
    return JSON.parse(match[0]);
};

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';

const getTemplateConfig = (templates: unknown): Record<string, any> =>
    templates && typeof templates === 'object' ? { ...(templates as Record<string, any>) } : {};

const getPublicEmailTemplates = (templates: unknown) => {
    const publicTemplates = getTemplateConfig(templates);
    delete publicTemplates.__ai;
    delete publicTemplates.__birthday;
    return publicTemplates;
};

const getPublicBirthdayConfig = (templates: unknown) => {
    const b = getTemplateConfig(templates).__birthday || {};
    return {
        enabled: b.enabled !== undefined ? !!b.enabled : false,
        persona: b.persona || 'Enthusiastic Principal',
        customInstructions: b.customInstructions || '',
        channelStrategy: b.channelStrategy || 'Smart Fallback'
    };
};

const getPublicAiConfig = (templates: unknown) => {
    const ai = getTemplateConfig(templates).__ai || {};
    const hasEnvKey = !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
    const hasSavedKey = !!ai.apiKey;

    return {
        enabled: ai.enabled !== undefined ? !!ai.enabled : hasEnvKey,
        provider: ai.provider || 'openai',
        model: ai.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || OPENAI_DEFAULT_MODEL,
        apiUrl: ai.apiUrl || process.env.OPENAI_API_URL || OPENAI_DEFAULT_API_URL,
        hasApiKey: hasSavedKey || hasEnvKey,
        source: hasSavedKey ? 'settings' : hasEnvKey ? 'environment' : 'none'
    };
};

const mergeEmailTemplatePatch = (base: Record<string, any>, patch: Record<string, any>) => {
    const cleanedPatch = { ...patch };
    delete cleanedPatch.__ai;
    // Carry through __birthday from patch if provided, otherwise preserve existing
    const birthdayFromPatch = patch.__birthday;
    delete cleanedPatch.__birthday;
    return {
        ...base,
        ...cleanedPatch,
        ...(base.__ai ? { __ai: base.__ai } : {}),
        ...(birthdayFromPatch ? { __birthday: birthdayFromPatch } : (base.__birthday ? { __birthday: base.__birthday } : {}))
    };
};

const normalizeOptionalString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const encryptSetting = (label: string, value: string): string => {
    try {
        return encrypt(value);
    } catch (error: any) {
        logger.error({ label, message: error?.message }, '[CommunicationController] Failed to encrypt communication setting');
        throw new ApiError(500, `${label} could not be saved because server encryption is not configured correctly.`)
            .withCode('COMMUNICATION_ENCRYPTION_FAILED');
    }
};

const resolveAiDraftConfig = async () => {
    const config = await prisma.communicationConfig.findFirst({ select: { emailTemplates: true } });
    const ai = getTemplateConfig(config?.emailTemplates).__ai || {};
    const envKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

    let savedKey: string | undefined;
    if (ai.enabled !== false && ai.apiKey) {
        try {
            savedKey = decrypt(ai.apiKey);
        } catch (error: any) {
            logger.warn('[CommunicationController] Saved AI API key could not be decrypted; falling back to environment key.', {
                message: error?.message
            });
        }
    }

    return {
        apiKey: savedKey || envKey,
        model: (ai.enabled !== false ? ai.model : undefined) || process.env.OPENAI_MODEL || process.env.AI_MODEL || OPENAI_DEFAULT_MODEL,
        apiUrl: (ai.enabled !== false ? ai.apiUrl : undefined) || process.env.OPENAI_API_URL || OPENAI_DEFAULT_API_URL
    };
};

/**
 * Get Communication Configuration
 * GET /api/communication/config
 */
export const getCommunicationConfig = async (req: AuthRequest, res: Response) => {
    const config = await prisma.communicationConfig.findFirst();
    const otpEnabled = (config?.emailTemplates as any)?.__security?.otpEnabled !== false;

    if (!config) {
        return res.status(200).json({
            success: true,
            data: {
                sms: {
                    enabled: false,
                    provider: COMMUNICATION_CONFIG.sms.provider,
                    hasApiKey: false,
                    senderId: ''
                },
                email: {
                    enabled: false,
                    provider: COMMUNICATION_CONFIG.email.provider,
                    hasApiKey: false
                },
                mpesa: {
                    enabled: false,
                    provider: 'intasend',
                    hasSecretKey: false
                },
                birthdays: {
                    enabled: false,
                    template: SMS_MESSAGES.birthdayStandard('{learnerName}', '{schoolName}', '{gradeName}')
                },
                whatsapp: {
                    enabled: false,
                    provider: 'ultramsg',
                    hasApiKey: false,
                    instanceId: ''
                },
                otp: {
                    enabled: true
                },
                ai: {
                    enabled: !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY),
                    provider: 'openai',
                    model: process.env.OPENAI_MODEL || process.env.AI_MODEL || OPENAI_DEFAULT_MODEL,
                    apiUrl: process.env.OPENAI_API_URL || OPENAI_DEFAULT_API_URL,
                    hasApiKey: !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY),
                    source: (process.env.OPENAI_API_KEY || process.env.AI_API_KEY) ? 'environment' : 'none'
                }
            }
        });
    }

    res.status(200).json({
        success: true,
        data: {
            id: config.id,
            sms: {
                enabled: config.smsEnabled,
                provider: config.smsProvider,
                baseUrl: config.smsBaseUrl,
                senderId: config.smsSenderId,
                hasApiKey: !!config.smsApiKey,
                customName: config.smsCustomName,
                customUrl: config.smsCustomBaseUrl,
                customAuthHeader: config.smsCustomAuthHeader,
                hasCustomToken: !!config.smsCustomToken,
                username: (config as any).smsUsername
            },
            email: {
                enabled: config.emailEnabled,
                provider: config.emailProvider,
                fromEmail: config.emailFrom,
                fromName: config.emailFromName,
                hasApiKey: !!config.emailApiKey,
                emailTemplates: getPublicEmailTemplates(config.emailTemplates)
            },
            mpesa: {
                enabled: config.mpesaEnabled,
                provider: config.mpesaProvider,
                publicKey: config.mpesaPublicKey,
                businessNumber: config.mpesaBusinessNo,
                hasSecretKey: !!config.mpesaSecretKey,
                hasApiKey: !!config.mpesaApiKey,
                sandbox: config.mpesaSandbox
            },
            birthdays: {
                enabled: config.birthdayEnabled,
                template: config.birthdayMessageTemplate || SMS_MESSAGES.birthdayStandard('{learnerName}', '{schoolName}', '{gradeName}')
            },
            whatsapp: {
                enabled: config.whatsappEnabled,
                provider: config.whatsappProvider,
                hasApiKey: !!config.whatsappApiKey,
                instanceId: config.whatsappInstanceId || ''
            },
            otp: {
                enabled: otpEnabled
            },
            ai: getPublicAiConfig(config.emailTemplates),
            birthdayAi: getPublicBirthdayConfig(config.emailTemplates),
            createdAt: config.createdAt,
            updatedAt: config.updatedAt
        }
    });
};

/**
 * Save Communication Configuration
 * POST /api/communication/config
 */
export const saveCommunicationConfig = async (req: AuthRequest, res: Response) => {
    const { sms, email, mpesa, birthdays, whatsapp, otp, ai } = req.body;
    const data: any = {};
    const existingConfig = await prisma.communicationConfig.findFirst();
    const existingTemplates = getTemplateConfig(existingConfig?.emailTemplates);

    if (sms) {
        logger.info(`[CommunicationController] SMS Config Update:`, {
            provider: sms.provider,
            hasApiKey: !!sms.apiKey,
            hasUsername: !!sms.username,
            hasSenderId: !!sms.senderId
        });

        data.smsProvider = sms.provider || 'mobilesasa';
        data.smsBaseUrl = normalizeOptionalString(sms.baseUrl) || 'https://api.mobilesasa.com';
        data.smsEnabled = sms.enabled !== undefined ? sms.enabled : true;
        data.smsSenderId = normalizeOptionalString(sms.senderId);

        const smsApiKey = normalizeOptionalString(sms.apiKey);
        if (smsApiKey) {
            logger.info(`[CommunicationController] Encrypting SMS API Key for provider: ${sms.provider}`);
            data.smsApiKey = encryptSetting('SMS API key', smsApiKey);
        }

        data.smsUsername = normalizeOptionalString(sms.username);

        if (sms.provider === 'custom') {
            data.smsCustomName = normalizeOptionalString(sms.customName);
            data.smsCustomBaseUrl = normalizeOptionalString(sms.customBaseUrl);
            data.smsCustomAuthHeader = normalizeOptionalString(sms.customAuthHeader) || 'Authorization';
            const smsCustomToken = normalizeOptionalString(sms.customToken);
            if (smsCustomToken) data.smsCustomToken = encryptSetting('Custom SMS token', smsCustomToken);
        }
    }

    if (email) {
        data.emailProvider = email.provider || 'resend';
        data.emailFrom = email.fromEmail || null;
        data.emailFromName = email.fromName || null;
        data.emailEnabled = email.enabled !== undefined ? email.enabled : false;
        const emailApiKey = normalizeOptionalString(email.apiKey);
        if (emailApiKey) data.emailApiKey = encryptSetting('Email API key', emailApiKey);
        if (email.emailTemplates) data.emailTemplates = mergeEmailTemplatePatch(existingTemplates, email.emailTemplates);
    }

    if (mpesa) {
        data.mpesaProvider = mpesa.provider || 'intasend';
        data.mpesaPublicKey = mpesa.publicKey || null;
        data.mpesaBusinessNo = mpesa.businessNumber || null;
        data.mpesaEnabled = mpesa.enabled !== undefined ? mpesa.enabled : false;
        data.mpesaSandbox = mpesa.sandbox !== undefined ? mpesa.sandbox : false;
        
        const mpesaSecretKey = normalizeOptionalString(mpesa.secretKey);
        const mpesaApiKey = normalizeOptionalString(mpesa.apiKey);
        if (mpesaSecretKey) data.mpesaSecretKey = encryptSetting('M-Pesa secret key', mpesaSecretKey);
        if (mpesaApiKey) data.mpesaApiKey = encryptSetting('M-Pesa API key', mpesaApiKey);
    }

    if (birthdays) {
        data.birthdayEnabled = birthdays.enabled !== undefined ? birthdays.enabled : false;
        data.birthdayMessageTemplate = birthdays.template || null;
    }

    if (whatsapp) {
        data.whatsappProvider = whatsapp.provider || 'ultramsg';
        data.whatsappEnabled = whatsapp.enabled !== undefined ? whatsapp.enabled : false;
        const whatsappApiKey = normalizeOptionalString(whatsapp.apiKey);
        if (whatsappApiKey) data.whatsappApiKey = encryptSetting('WhatsApp API key', whatsappApiKey);
        if (whatsapp.instanceId !== undefined) data.whatsappInstanceId = whatsapp.instanceId;
    }

    if (otp && typeof otp.enabled === 'boolean') {
        const baseTemplates = (data.emailTemplates && typeof data.emailTemplates === 'object')
            ? data.emailTemplates
            : existingTemplates;
        data.emailTemplates = {
            ...baseTemplates,
            __security: {
                ...(baseTemplates?.__security || {}),
                otpEnabled: otp.enabled
            }
        };
    }

    if (ai) {
        const baseTemplates = (data.emailTemplates && typeof data.emailTemplates === 'object')
            ? data.emailTemplates
            : existingTemplates;
        const existingAi = baseTemplates.__ai || {};
        const nextAi = {
            ...existingAi,
            enabled: ai.enabled !== undefined ? !!ai.enabled : existingAi.enabled !== false,
            provider: 'openai',
            model: ai.model || existingAi.model || OPENAI_DEFAULT_MODEL,
            apiUrl: ai.apiUrl || existingAi.apiUrl || OPENAI_DEFAULT_API_URL
        };

        if (ai.apiKey && String(ai.apiKey).trim()) {
            nextAi.apiKey = encryptSetting('AI API key', String(ai.apiKey).trim());
        }

        data.emailTemplates = {
            ...baseTemplates,
            __ai: nextAi
        };
    }

    let config;
    try {
        config = existingConfig
            ? await prisma.communicationConfig.update({ where: { id: existingConfig.id }, data })
            : await prisma.communicationConfig.create({ data });
    } catch (error: any) {
        logger.error({
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            fields: Object.keys(data)
        }, '[CommunicationController] Failed to persist communication config');
        throw error;
    }

    // Clear SMS config cache so changes take effect immediately
    const { SmsService: SmsServiceImport } = await import('../services/sms.service');
    (SmsServiceImport as any).clearConfigCache();
    logger.info(`✅ Communication config saved and cache cleared`);

    res.status(200).json({
        success: true,
        message: 'Configuration saved successfully',
        data: { id: config.id, updatedAt: config.updatedAt }
    });
};

/**
 * Send Test SMS
 * POST /api/communication/test/sms
 */
export const sendTestSms = async (req: AuthRequest, res: Response) => {
    const { phoneNumber, message, scheduledFor } = req.body;

    if (!phoneNumber || !message) {
        throw new ApiError(400, 'phoneNumber and message are required');
    }

    const senderId = req.user?.userId || 'system';
    const senderType = (req.user?.role || 'ADMIN') as any;

    const result = await messageService.createAndDispatchMessage({
        senderId,
        senderType,
        recipientType: 'INDIVIDUAL',
        recipients: [{ recipientPhone: phoneNumber }],
        subject: undefined,
        body: message,
        messageType: 'SMS',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
    });

    if (!result.success) {
        throw new ApiError(400, (result as any).error || 'Failed to send SMS');
    }

    res.status(200).json({
        success: true,
        message: result.scheduled ? 'SMS scheduled successfully' : 'SMS sent successfully',
        data: {
            messageId: result.message?.id,
            scheduled: !!result.scheduled
        }
    });
};

/**
 * Send Test Email
 * POST /api/communication/test/email
 */
export const sendTestEmail = async (req: AuthRequest, res: Response) => {
    const { email, template = 'welcome' } = req.body;

    if (!email) throw new ApiError(400, 'Email is required');

    const school = await prisma.school.findFirst({ select: { name: true } });
    const schoolName = school?.name || 'Your School';
    const adminName = req.user?.userId
        ? (await prisma.user.findUnique({ where: { id: req.user.userId } }))?.firstName || 'Admin'
        : 'Admin';

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login`;

    if (template === 'onboarding') {
        await EmailService.sendOnboardingEmail({ to: email, schoolName, adminName, loginUrl });
    } else if (template === 'welcome') {
        await EmailService.sendWelcomeEmail({ to: email, schoolName, adminName, loginUrl });
    } else {
        await EmailService.sendNotificationEmail({
            to: email,
            subject: `Test ${template} email`,
            templateKey: template,
            variables: {
                schoolName,
                adminName,
                parentName: 'Parent/Guardian',
                learnerName: 'Sample Learner',
                invoiceNumber: 'INV-TEST-001',
                term: 'Term 1 2026',
                amount: '12,500',
                dueDate: new Date().toLocaleDateString(),
                messageText: 'This is a test email generated from Communication Settings.',
                remarks: 'Reviewed and ready for action.',
                status: 'approved',
                loginUrl
            },
            html: `
                <p>This is a test email generated from Communication Settings.</p>
                <p><strong>School:</strong> ${schoolName}</p>
                <p><strong>Template:</strong> ${template}</p>
            `,
            text: `This is a test email generated from Communication Settings. School: ${schoolName}. Template: ${template}.`
        });
    }

    res.status(200).json({
        success: true,
        message: `Test email (${template}) sent successfully to ${email}`,
        data: { provider: 'resend' }
    });
};

/**
 * Draft Email Template with AI
 * POST /api/communication/email/draft
 */
export const draftEmailTemplate = async (req: AuthRequest, res: Response) => {
    const {
        templateType = 'announcement',
        goal,
        audience = 'parents and guardians',
        tone = 'professional, warm, and concise',
        existingHeading,
        existingBody
    } = req.body;

    const { apiKey, model, apiUrl } = await resolveAiDraftConfig();
    if (!apiKey) {
        throw new ApiError(400, 'AI drafting is not configured. Add an OpenAI key in Communication Settings or set OPENAI_API_KEY on the server.');
    }

    const school = await prisma.school.findFirst({ select: { name: true } });
    const schoolName = school?.name || 'Your School';

    const prompt = [
        `School: ${schoolName}`,
        `Template type: ${templateType}`,
        `Audience: ${audience}`,
        `Tone: ${tone}`,
        `Goal: ${goal || `Improve the ${templateType} email template for school communication.`}`,
        existingHeading ? `Existing heading: ${existingHeading}` : '',
        existingBody ? `Existing body: ${existingBody}` : '',
        'Return only JSON with keys "heading" and "body".',
        'The body may use simple email-safe HTML tags only: p, strong, em, ul, ol, li, br.',
        'Do not include scripts, styles, external images, forms, tracking pixels, or placeholders that require unavailable data.'
    ].filter(Boolean).join('\n');

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You write safe, parent-friendly school communication emails. Return valid JSON only.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('[CommunicationController] AI draft failed:', errorText);
        throw new ApiError(502, 'AI drafting failed. Check the AI API key, model, and server logs.');
    }

    const payload: any = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new ApiError(502, 'AI drafting returned an empty response.');

    const parsed = extractJsonObject(content);
    const heading = String(parsed.heading || '').replace(/<[^>]+>/g, '').trim().slice(0, 140);
    const body = sanitizeGeneratedEmailHtml(String(parsed.body || '')).slice(0, 5000);

    if (!heading || !body) {
        throw new ApiError(502, 'AI drafting did not return usable template content.');
    }

    res.status(200).json({
        success: true,
        message: 'AI email draft generated successfully',
        data: { heading, body, model }
    });
};

/**
 * Get Learners with Birthdays Today
 * GET /api/communication/birthdays/today
 */
export const getBirthdaysToday = async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const monthDay = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const learners = await prisma.learner.findMany({
        where: { status: 'ACTIVE' },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            guardianPhone: true,
            emergencyPhone: true,
            grade: true,
            stream: true,
            admissionNumber: true
        }
    });

    const birthdaysToday = learners
        .filter(l => {
            if (!l.dateOfBirth) return false;
            const dob = new Date(l.dateOfBirth);
            const dobMonthDay = `${(dob.getMonth() + 1).toString().padStart(2, '0')}-${dob.getDate().toString().padStart(2, '0')}`;
            return dobMonthDay === monthDay;
        })
        .map(l => ({
            ...l,
            name: `${l.firstName} ${l.lastName}`,
            guardianPhone: l.guardianPhone || l.emergencyPhone
        }));

    res.status(200).json({ success: true, data: birthdaysToday });
};

/**
 * Send Birthday Wishes
 * POST /api/communication/birthdays/send
 */
export const sendBirthdayWishes = async (req: AuthRequest, res: Response) => {
    const { learnerIds, template, channel = 'sms' } = req.body;

    if (!learnerIds || !Array.isArray(learnerIds)) {
        throw new ApiError(400, 'learnerIds array is required');
    }

    const school = await prisma.school.findFirst({ select: { name: true } });
    const schoolName = school?.name || 'Your School';
    const learners = await prisma.learner.findMany({ where: { id: { in: learnerIds } } });

    const calculateAge = (dob: Date) => {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        return age;
    };

    const formatTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const formatDate = (date: Date) =>
        date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });

    const results = [];

    for (const learner of learners) {
        const phoneNumber = learner.guardianPhone || learner.emergencyPhone;
        if (!phoneNumber) {
            results.push({ learnerId: learner.id, success: false, error: 'No phone number' });
            continue;
        }

        const age = calculateAge(new Date(learner.dateOfBirth));
        const ageOrdinal = getOrdinal(age);
        const bdayDate = formatDate(new Date(learner.dateOfBirth));
        const gradeName = formatTitleCase(learner.grade);
        const firstName = formatTitleCase(learner.firstName);
        const lastName = formatTitleCase(learner.lastName);
        const fullName = `${firstName} ${lastName}`;

        try {
            let result;
            if (channel === 'whatsapp') {
                const finalMessage = !template
                    ? SMS_MESSAGES.birthdayPremium({ learnerName: firstName, schoolName, gradeName, ageOrdinal, bdayDate })
                    : template
                        .replace(/{learnerName}/g, fullName)
                        .replace(/{firstName}/g, firstName)
                        .replace(/{lastName}/g, lastName)
                        .replace(/{schoolName}/g, schoolName)
                        .replace(/{grade}/g, gradeName)
                        .replace(/{age}/g, age.toString())
                        .replace(/{ageOrdinal}/g, ageOrdinal)
                        .replace(/{birthdayDate}/g, bdayDate);

                result = await whatsappService.sendMessage({ to: phoneNumber, message: finalMessage } as any);
            } else {
                const smsMessage = template
                    ? template
                        .replace(/{learnerName}/g, fullName)
                        .replace(/{firstName}/g, firstName)
                        .replace(/{lastName}/g, lastName)
                        .replace(/{schoolName}/g, schoolName)
                        .replace(/{grade}/g, gradeName)
                        .replace(/{age}/g, age.toString())
                        .replace(/{ageOrdinal}/g, ageOrdinal)
                        .replace(/{birthdayDate}/g, bdayDate)
                    : SMS_MESSAGES.birthdayStandard(firstName, schoolName, gradeName);

                result = await SmsService.sendSms(phoneNumber, smsMessage);
            }

            results.push({ learnerId: learner.id, success: result.success, messageId: result.messageId, error: result.error });
        } catch (err: any) {
            results.push({ learnerId: learner.id, success: false, error: err.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    res.status(200).json({
        success: true,
        message: `Processed ${results.length} birthday messages. ${successCount} sent, ${failCount} failed.`,
        data: { results }
    });
};

/**
 * Get Inbox Messages
 * GET /api/communication/messages/inbox
 */
export const getInboxMessages = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const messages = await messageService.getInboxMessages(userId);
    res.status(200).json({ success: true, data: messages });
};

/**
 * Mark a message receipt as read
 * PATCH /api/communication/messages/receipts/:id/read
 */
export const markMessageRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const receipt = await messageService.markReceiptRead(id, userId);
    res.status(200).json({ success: true, data: receipt });
};

/**
 * Get Broadcast Recipients
 * GET /api/communication/recipients
 */
export const getBroadcastRecipients = async (req: AuthRequest, res: Response) => {
    const { grade } = req.query;
    let whereClause: any = { status: 'ACTIVE' };

    if (grade && grade !== 'All Grades') {
        let targetGrade = String(grade);
        if (targetGrade.match(/^Grade \d+$/i)) {
            targetGrade = targetGrade.toUpperCase().replace(' ', '_');
        } else if (targetGrade.match(/^PP\d+$/i)) {
            targetGrade = targetGrade.toUpperCase();
        }
        whereClause.grade = targetGrade;
    }

    const contactSelect = {
        id: true, firstName: true, lastName: true, grade: true,
        guardianName: true, guardianPhone: true,
        fatherName: true, fatherPhone: true, fatherDeceased: true,
        motherName: true, motherPhone: true, motherDeceased: true,
        primaryContactName: true, primaryContactPhone: true,
        parent: { select: { id: true, firstName: true, lastName: true, phone: true } }
    };

    let learners = await prisma.learner.findMany({ where: whereClause, select: contactSelect });

    if (learners.length === 0 && grade && grade !== 'All Grades') {
        const allLearners = await prisma.learner.findMany({ where: { status: 'ACTIVE' }, select: contactSelect });
        const normalize = (g: string) => String(g).toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        const target = normalize(String(grade));
        learners = allLearners.filter(l => normalize(l.grade) === target);
    }

    const uniqueContacts = new Map();
    learners.forEach(learner => {
        let phone = learner.primaryContactPhone;
        let name = learner.primaryContactName;

        if (!phone) {
            if (learner.fatherPhone && !learner.fatherDeceased) { phone = learner.fatherPhone; name = learner.fatherName || 'Father'; }
            else if (learner.motherPhone && !learner.motherDeceased) { phone = learner.motherPhone; name = learner.motherName || 'Mother'; }
            else if (learner.guardianPhone) { phone = learner.guardianPhone; name = learner.guardianName || 'Guardian'; }
            else if (learner.parent?.phone) { phone = learner.parent.phone; name = `${learner.parent.firstName} ${learner.parent.lastName}`; }
        }

        if (phone) {
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);
            if (cleanPhone.length === 9) cleanPhone = '254' + cleanPhone;

            if (!uniqueContacts.has(cleanPhone)) {
                uniqueContacts.set(cleanPhone, {
                    id: learner.id, name: name || 'Parent', phone: cleanPhone,
                    studentName: `${learner.firstName} ${learner.lastName}`, grade: learner.grade
                });
            } else {
                const existing = uniqueContacts.get(cleanPhone);
                if (!existing.studentName.includes(learner.firstName)) {
                    existing.studentName += `, ${learner.firstName}`;
                }
            }
        }
    });

    const recipients = Array.from(uniqueContacts.values());
    res.status(200).json({ success: true, count: recipients.length, data: recipients });
};

/**
 * Get Staff Contacts
 * GET /api/communication/staff
 */
export const getStaffContacts = async (req: AuthRequest, res: Response) => {
    const staff = await prisma.user.findMany({
        where: {
            status: 'ACTIVE',
            phone: { not: null },
            role: { in: ['TEACHER', 'HEAD_TEACHER', 'ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE'] }
        },
        select: { id: true, firstName: true, lastName: true, phone: true, role: true, email: true }
    });

    const contacts = staff.map(s => ({
        id: s.id, name: `${s.firstName} ${s.lastName}`,
        phone: s.phone, role: s.role, email: s.email, type: 'staff' as const
    }));

    res.status(200).json({ success: true, count: contacts.length, data: contacts });
};

/**
 * Create Contact Group
 * POST /api/communication/groups
 */
export const createContactGroup = async (req: AuthRequest, res: Response) => {
    const { name, description, recipients } = req.body;
    const createdById = req.user?.userId;

    if (!createdById) throw new ApiError(401, 'Authentication required');
    if (!name || !recipients || !Array.isArray(recipients)) {
        throw new ApiError(400, 'Name and recipients array are required');
    }

    const group = await prisma.contactGroup.create({
        data: { name, description: description || null, createdById, recipients }
    });

    res.status(201).json({ success: true, message: 'Contact group created successfully', data: group });
};

/**
 * Get All Contact Groups
 * GET /api/communication/groups
 */
export const getContactGroups = async (req: AuthRequest, res: Response) => {
    const groups = await prisma.contactGroup.findMany({
        where: {},
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' }
    });

    const groupsWithCount = groups.map(g => ({
        ...g,
        recipientCount: Array.isArray(g.recipients) ? (g.recipients as any[]).length : 0
    }));

    res.status(200).json({ success: true, count: groups.length, data: groupsWithCount });
};

/**
 * Get Contact Group by ID
 * GET /api/communication/groups/:id
 */
export const getContactGroupById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Fallback for older frontend that might send a Grade string
    if (id.startsWith('GRADE_') || id.startsWith('PP') || id === 'PLAYGROUP') {
        let targetGrade = String(id);
        if (targetGrade.match(/^Grade \d+$/i)) {
            targetGrade = targetGrade.toUpperCase().replace(' ', '_');
        }

        const learners = await prisma.learner.findMany({
            where: { grade: targetGrade as any, status: 'ACTIVE' },
            select: {
                id: true, firstName: true, lastName: true, grade: true,
                guardianPhone: true, guardianName: true,
                fatherPhone: true, fatherName: true,
                motherPhone: true, motherName: true,
                primaryContactPhone: true, primaryContactName: true
            }
        });

        const members = learners.map(l => {
            const phone = l.primaryContactPhone || l.fatherPhone || l.motherPhone || l.guardianPhone;
            const name = l.primaryContactName || l.fatherName || l.motherName || l.guardianName || 'Parent';
            let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
            if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);
            if (cleanPhone.length === 9) cleanPhone = '254' + cleanPhone;
            return { id: l.id, name, phone: cleanPhone, studentName: `${l.firstName} ${l.lastName}`, grade: l.grade };
        }).filter(m => m.phone);

        return res.status(200).json({
            success: true,
            data: { id, name: id.replace(/_/g, ' '), members }
        });
    }

    const group = await prisma.contactGroup.findFirst({
        where: { id },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });

    if (!group) throw new ApiError(404, 'Contact group not found');

    res.status(200).json({ success: true, data: group });
};

/**
 * Update Contact Group
 * PUT /api/communication/groups/:id
 */
export const updateContactGroup = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, description, recipients } = req.body;

    const existing = await prisma.contactGroup.findFirst({ where: { id } });
    if (!existing) throw new ApiError(404, 'Contact group not found');

    const updated = await prisma.contactGroup.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(recipients && { recipients })
        }
    });

    res.status(200).json({ success: true, message: 'Contact group updated successfully', data: updated });
};

/**
 * Delete Contact Group
 * DELETE /api/communication/groups/:id
 */
export const deleteContactGroup = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.contactGroup.findFirst({ where: { id } });
    if (!existing) throw new ApiError(404, 'Contact group not found');

    await prisma.contactGroup.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Contact group deleted successfully' });
};

/**
 * Get SMS Balance
 * GET /api/communication/balance
 */
export const getSmsBalance = async (req: AuthRequest, res: Response) => {
    const config = await prisma.communicationConfig.findFirst();

    if (!config || !config.smsEnabled || !config.smsApiKey) {
        return res.status(200).json({
            success: true,
            data: { balance: null, provider: config?.smsProvider || 'none' }
        });
    }

    if (config.smsProvider === 'africastalking') {
        try {
            const { decrypt } = await import('../utils/encryption.util');
            const axios = (await import('axios')).default;

            const apiKey = decrypt(config.smsApiKey);
            const username = (config as any).smsUsername;

            if (!username || !apiKey) {
                return res.status(200).json({
                    success: true,
                    data: { balance: null, provider: 'africastalking', available: false, reason: 'Missing username or API key' }
                });
            }

            const response = await axios.get(
                `https://api.africastalking.com/version1/user?username=${encodeURIComponent(username)}`,
                {
                    headers: { apikey: apiKey, Accept: 'application/json' },
                    timeout: 10000
                }
            );

            const data = response.data;
            if (data?.UserData?.balance) {
                return res.status(200).json({
                    success: true,
                    data: { balance: data.UserData.balance, provider: 'africastalking', available: true }
                });
            }

            return res.status(200).json({
                success: true,
                data: { balance: null, provider: 'africastalking', available: false, reason: 'Balance not returned by provider' }
            });
        } catch (error: any) {
            logger.warn('[Communication] Failed to fetch SMS balance from Africa\'s Talking', {
                status: error?.response?.status,
                message: error?.message
            });

            return res.status(200).json({
                success: true,
                data: {
                    balance: null,
                    provider: 'africastalking',
                    available: false,
                    reason: error?.response?.data?.errorMessage || error?.message || 'Provider request failed'
                }
            });
        }
    }

    if (config.smsProvider === 'mobilesasa') {
        try {
            const { SmsService } = await import('../services/sms.service');
            const result = await SmsService.getMobileSasaBalance(config);
            if (result.success) {
                return res.status(200).json({
                    success: true,
                    data: {
                        balance: result.balance,
                        internationalBalance: result.internationalBalance,
                        smsRate: result.smsRate,
                        postpaidLimit: result.postpaidLimit,
                        remainingPostpaid: result.remainingPostpaid,
                        walletBalance: result.walletBalance,
                        currency: result.currency,
                        localAccountNumber: result.localAccountNumber,
                        internationalAccountNumber: result.internationalAccountNumber,
                        emailAccountNumber: result.emailAccountNumber,
                        walletAccountNumber: result.walletAccountNumber,
                        ussdAccount: result.ussdAccount,
                        paymentDetails: result.paymentDetails,
                        provider: 'mobilesasa',
                        available: true
                    }
                });
            }
            return res.status(200).json({
                success: true,
                data: { balance: null, provider: 'mobilesasa', available: false, reason: result.error }
            });
        } catch (error: any) {
            logger.warn('[Communication] Failed to fetch SMS balance from MobileSasa', { message: error?.message });
            return res.status(200).json({
                success: true,
                data: { balance: null, provider: 'mobilesasa', available: false, reason: error?.message || 'Provider request failed' }
            });
        }
    }

    res.status(200).json({
        success: true,
        data: {
            balance: null,
            provider: config.smsProvider,
            available: false,
            reason: 'Balance lookup not supported for this provider yet'
        }
    });
};

export const initiateSmsTopUp = async (req: AuthRequest, res: Response) => {
    const config = await prisma.communicationConfig.findFirst();
    if (!config || config.smsProvider !== 'mobilesasa' || !config.smsEnabled) {
        throw new ApiError(400, 'MobileSasa SMS must be enabled before purchasing a top-up.');
    }

    const result = await SmsService.initiateMobileSasaTopUp(config, req.body);
    if (!result.success) {
        throw new ApiError(400, result.error || 'Failed to initiate MobileSasa top-up.');
    }

    res.status(200).json({
        success: true,
        message: result.message,
        data: { responseCode: result.responseCode }
    });
};
