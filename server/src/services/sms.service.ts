import axios from 'axios';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption.util';
import { SMS_MESSAGES, LEARNING_AREA_ABBREVIATIONS } from '../config/communication.messages';

interface SendSmsResult {
    success: boolean;
    messageId?: string;
    error?: string;
    provider?: string;
}

interface AssessmentReportData {
    learnerId: string;
    learnerName: string;
    learnerGrade: string;
    parentPhone: string;
    parentName?: string;
    term: string;
    totalTests: number;
    averageScore?: string;
    overallGrade?: string;
    totalMarks?: number;
    maxPossibleMarks?: number;
    subjects?: Record<string, string | { score: number, grade: string }>;
    pathwayPrediction?: { predictedPathway: string, confidence: number };
    sentByUserId?: string;
}

const CACHE_KEY = 'global_config';
let cachedConfig: { data: any, timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SmsService {
    /**
     * Normalize phone number to 254 format
     */
    private static formatPhoneNumber(phone: string): string {
        // Remove all non-digits except leading +
        const hasPlus = phone.trim().startsWith('+');
        let p = phone.replace(/\D/g, '');

        // Handle standard Kenyan formats
        if (p.startsWith('07') || p.startsWith('01')) {
            return '+254' + p.substring(1);
        }

        // Already 254...
        if (p.startsWith('254') && p.length === 12) {
            return '+' + p;
        }

        // 9-digit local number (e.g. 712345678) — assume Kenyan
        if (p.length === 9) {
            return '+254' + p;
        }

        // International number already had a + prefix — keep as-is
        if (hasPlus) {
            return '+' + p;
        }

        return '+' + p;
    }

    /**
     * Send welcome SMS to new school admin
     */
    static async sendWelcomeSms(phone: string, schoolName: string): Promise<SendSmsResult> {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            const message = SMS_MESSAGES.welcome(schoolName);

            console.log(`📱 SMS Service: Sending welcome SMS to ${formattedPhone}`);
            return await this.sendSms(formattedPhone, message);
        } catch (error: any) {
            console.error('Welcome SMS Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send assessment report SMS to parent
     */
    static async sendAssessmentReport(data: AssessmentReportData): Promise<SendSmsResult> {
        try {
            // Format phone number
            const formattedPhone = this.formatPhoneNumber(data.parentPhone);

            // 1. Get School Details for Header
            const school = await prisma.school.findFirst({
                select: { name: true }
            });

            const schoolName = (school?.name || 'Your School').toUpperCase();

            // 2. Build Subject Breakdown with Standard Abbreviations
            let subjectsSummary = '';
            if (data.subjects && Object.keys(data.subjects).length > 0) {
                const subArray = Object.entries(data.subjects).map(([name, detail]) => {
                    const upper = name.toUpperCase().trim();
                    const code = LEARNING_AREA_ABBREVIATIONS[upper] || (name.length > 8 ? name.substring(0, 8).toUpperCase() : name.toUpperCase());

                    if (typeof detail === 'string') {
                        return `${code}: ${detail}`;
                    } else {
                        return `${code}: ${detail.score} ${detail.grade}`;
                    }
                });
                subjectsSummary = `\n\n${subArray.join('\n')}`;
            }

            const pathwaySnippet = data.pathwayPrediction ? `\n\nAI Insight: ${data.pathwayPrediction.predictedPathway} (${data.pathwayPrediction.confidence}% confidence)` : '';

            // 3. Construct the message using config template
            const message = SMS_MESSAGES.assessmentReport({
                schoolName,
                parentName: data.parentName,
                learnerName: data.learnerName,
                learnerGrade: data.learnerGrade,
                term: data.term,
                overallGrade: data.overallGrade,
                averageScore: data.averageScore,
                totalMarks: data.totalMarks,
                maxPossibleMarks: data.maxPossibleMarks
            }) + subjectsSummary + pathwaySnippet;

            console.log(`📱 SMS Service: Sending structured multiline SMS to ${formattedPhone}`);
            console.log(`📝 Message:\n${message}`);

            // Send SMS
            const result = await this.sendSms(formattedPhone, message);

            // Create audit record
            await prisma.assessmentSmsAudit.create({
                data: {
                    learnerId: data.learnerId,
                    assessmentType: 'SUMMATIVE',
                    term: data.term,
                    academicYear: new Date().getFullYear(), // Default to current year if not provided
                    parentPhone: formattedPhone,
                    parentName: data.parentName || 'Unknown',
                    learnerName: data.learnerName,
                    learnerGrade: data.learnerGrade,
                    templateType: 'SUMMATIVE_TERM',
                    messageContent: message,
                    channel: 'SMS',
                    smsMessageId: result.messageId,
                    smsStatus: result.success ? 'SENT' : 'FAILED',
                    failureReason: result.error,
                    sentByUserId: data.sentByUserId
                }
            });

            return result;

        } catch (error: any) {
            console.error('Assessment Report SMS Error:', error);

            // Log failed attempt
            try {
                await prisma.assessmentSmsAudit.create({
                    data: {
                        learnerId: data.learnerId,
                        assessmentType: 'SUMMATIVE',
                        parentPhone: this.formatPhoneNumber(data.parentPhone),
                        parentName: data.parentName || 'Unknown',
                        learnerName: data.learnerName,
                        learnerGrade: data.learnerGrade,
                        templateType: 'SUMMATIVE_TERM',
                        messageContent: 'Failed to send',
                        smsStatus: 'FAILED',
                        failureReason: error.message,
                        sentByUserId: data.sentByUserId
                    }
                });
            } catch (auditError) {
                console.error('Failed to create audit record:', auditError);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send bulk SMS with batching
     */
    static async sendBulkSms(recipients: Array<{ phone: string, message: string }>): Promise<{
        success: boolean;
        results: Array<{ phone: string, success: boolean, messageId?: string, error?: string }>;
        sent: number;
        failed: number;
    }> {
        const results = [];
        let sent = 0;
        let failed = 0;

        console.log(`📱 [SmsService] Starting bulk SMS send to ${recipients.length} recipients`);

        for (const recipient of recipients) {
            try {
                const result = await this.sendSms(recipient.phone, recipient.message);
                results.push({
                    phone: recipient.phone,
                    success: result.success,
                    messageId: result.messageId,
                    error: result.error
                });
                if (result.success) sent++;
                else failed++;

                // Small delay to prevent overwhelming the local rate limiter if any, 
                // and to be kind to the provider API
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err: any) {
                results.push({ phone: recipient.phone, success: false, error: err.message });
                failed++;
            }
        }

        return {
            success: sent > 0,
            results,
            sent,
            failed
        };
    }

    /**
     * Send fee invoice notification to parent
     */
    static async sendFeeInvoiceNotification(data: {
        parentPhone: string;
        parentName: string;
        learnerName: string;
        invoiceNumber: string;
        term: string;
        amount: number;
        dueDate: string;
    }): Promise<SendSmsResult> {
        try {
            const formattedPhone = this.formatPhoneNumber(data.parentPhone);
            const school = await prisma.school.findFirst({
                select: { name: true }
            });
            const schoolName = (school?.name || 'School').toUpperCase();

            // Short, concise message for SMS
            const message = `Dear ${data.parentName}, an invoice (${data.invoiceNumber}) of KES ${data.amount.toLocaleString()} for ${data.learnerName} (${data.term}) has been generated. Due: ${data.dueDate}. Please ensure timely payment. - ${schoolName}`;

            console.log(`📱 SMS Service: Sending Fee Invoice SMS to ${formattedPhone}`);
            return await this.sendSms(formattedPhone, message);
        } catch (error: any) {
            console.error('Fee Invoice SMS Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send SMS using the configured provider.
     * This is the central method for dispatching SMS.
     */
    static async sendSms(phone: string, message: string): Promise<SendSmsResult> {
        console.log(`[SmsService] Initiating SMS send`);
        try {
            if (!phone || !message) {
                console.error('[SmsService] Validation Error: Missing required parameters.', { phone: !!phone, message: !!message });
                throw new Error('Missing required parameters for sending SMS.');
            }

            // 1. Get Communication Configuration (cached)
            let config = null;

            // Check cache first
            if (cachedConfig && (Date.now() - cachedConfig.timestamp) < CACHE_TTL_MS) {
                config = cachedConfig.data;
                console.log(`[SmsService] Using cached config`);
            } else {
                // Fetch from DB and cache it
                config = await prisma.communicationConfig.findFirst();
                if (config) {
                    cachedConfig = { data: config, timestamp: Date.now() };
                    console.log(`[SmsService] Fetched and cached config`);
                }
            }

            if (!config) {
                // Env-var fallback — allows OTP SMS to work even after a DB reset,
                // without requiring the admin to log in and reconfigure first.
                const atApiKey = process.env.AT_API_KEY || process.env.AFRICASTALKING_API_KEY;
                const atUsername = process.env.AT_USERNAME || process.env.AFRICASTALKING_USERNAME;
                const msApiKey = process.env.MOBILESASA_API_KEY;

                if (atApiKey && atUsername) {
                    console.warn('[SmsService] No DB config found — using Africa\'s Talking env-var fallback.');
                    // Build a synthetic config — encrypt is not needed when value comes from env
                    const { encrypt } = await import('../utils/encryption.util');
                    const syntheticConfig = {
                        smsEnabled: true,
                        smsProvider: 'africastalking',
                        smsApiKey: encrypt(atApiKey),
                        smsUsername: atUsername,
                        smsSenderId: process.env.AT_SENDER_ID || null,
                    };
                    return this.sendViaAfricasTalking(syntheticConfig, this.formatPhoneNumber(phone), message);
                } else if (msApiKey) {
                    console.warn('[SmsService] No DB config found — using MobileSasa env-var fallback.');
                    const { encrypt } = await import('../utils/encryption.util');
                    const syntheticConfig = {
                        smsEnabled: true,
                        smsProvider: 'mobilesasa',
                        smsApiKey: encrypt(msApiKey),
                        smsSenderId: process.env.MOBILESASA_SENDER_ID || 'MOBILESASA',
                        smsBaseUrl: process.env.MOBILESASA_BASE_URL || 'https://api.mobilesasa.com',
                    };
                    return this.sendViaMobileSasa(syntheticConfig, this.formatPhoneNumber(phone), message);
                }

                console.error(`[SmsService] Configuration Error: SMS not configured (no DB config, no env vars).`);
                return { success: false, error: 'SMS service is not configured.' };
            }

            if (!config.smsEnabled) {
                console.warn(`[SmsService] SMS is disabled.`);
                return { success: false, error: 'SMS service is disabled.' };
            }

            // 2. Format phone number
            const formattedPhone = this.formatPhoneNumber(phone);
            console.log(`[SmsService] Phone number ${phone} formatted to ${formattedPhone}.`);

            // 3. Route to the appropriate provider
            const provider = config.smsProvider?.toLowerCase();
            console.log(`[SmsService] Routing to SMS provider: ${provider}`);

            switch (provider) {
                case 'africastalking':
                    return this.sendViaAfricasTalking(config, formattedPhone, message);
                case 'mobilesasa':
                    return this.sendViaMobileSasa(config, formattedPhone, message);
                default:
                    console.error(`[SmsService] Configuration Error: Unknown or unsupported SMS provider "${provider}".`);
                    return { success: false, error: `SMS provider "${provider}" is not supported.` };
            }
        } catch (error: any) {
            console.error(`[SmsService] Critical Error in sendSms: ${error.message}`, {
                stack: error.stack
            });
            return {
                success: false,
                error: 'A server error occurred while attempting to send the SMS.'
            };
        }
    }

    /**
     * Send SMS via MobileSasa
     */
    private static async sendViaMobileSasa(config: any, phone: string, message: string): Promise<SendSmsResult> {
        console.log(`[SmsService] Sending via MobileSasa to ${phone}.`);
        try {
            if (!config.smsApiKey) {
                console.error('[SmsService-MobileSasa] Missing API Key.');
                return { success: false, error: "MobileSasa API key is not configured." };
            }

            const apiKey = decrypt(config.smsApiKey);
            const senderId = config.smsSenderId || 'MOBILESASA';
            const baseUrl = config.smsBaseUrl || 'https://api.mobilesasa.com';

            const response = await axios.post(
                `${baseUrl}/v1/send/bulk`,
                {
                    senderID: senderId,
                    message: message,
                    phones: phone.replace(/^\+/, '')
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('[SmsService-MobileSasa] API Response:', response.data);

            // Assuming a successful response contains a messageId or similar identifier
            if (response.data && response.status === 200) {
                return {
                    success: true,
                    messageId: response.data.messageId || 'N/A',
                    provider: 'mobilesasa'
                };
            } else {
                throw new Error(response.data.message || 'Unknown error from MobileSasa');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message;
            console.error(`[SmsService-MobileSasa] Failed to send SMS: ${errorMessage}`, {
                status: error.response?.status,
                data: error.response?.data
            });
            return { success: false, error: `MobileSasa: ${errorMessage}` };
        }
    }

    /**
     * Send SMS via Africa's Talking
     */
    private static async sendViaAfricasTalking(config: any, phone: string, message: string): Promise<SendSmsResult> {
        console.log(`[SmsService] Sending via Africa's Talking to ${phone}.`);
        try {
            const apiKey = config.smsApiKey ? decrypt(config.smsApiKey) : null;
            const username = config.smsUsername; // This is the AT username stored in DB

            if (!apiKey || !username) {
                console.error("[SmsService-AT] Missing credentials.", {
                    hasApiKey: !!apiKey,
                    hasUsername: !!username,
                    dbFields: { smsApiKey: config.smsApiKey ? 'present' : 'missing', smsUsername: config.smsUsername }
                });
                return { success: false, error: "Africa's Talking API Key and Username are required." };
            }

            // For Africa's Talking, the senderId/from is often a shortcode or alphanumeric, managed on their platform
            const from = config.smsSenderId; // This should be your AT Sender ID

            const params = new URLSearchParams();
            params.append('username', username);
            params.append('to', phone);
            params.append('message', message);
            if (from) {
                params.append('from', from);
            }

            console.log("[SmsService-AT] Request parameters:", {
                username,
                to: phone,
                from: from || 'not set',
                messageLength: message.length
            });

            const response = await axios.post(
                'https://api.africastalking.com/version1/messaging',
                params.toString(),
                {
                    headers: {
                        'apikey': apiKey,
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log("[SmsService-AT] API Response:", response.data);

            const smsData = response.data?.SMSMessageData;
            if (smsData && smsData.Recipients?.[0]?.status === 'Success') {
                console.log("[SmsService-AT] ✅ SMS sent successfully");
                return {
                    success: true,
                    messageId: smsData.Recipients[0].messageId,
                    provider: 'africastalking'
                };
            } else {
                const reason = smsData?.Recipients?.[0]?.status || smsData?.Message || 'Unknown reason';
                console.error(`[SmsService-AT] Send failed with status: ${reason}`);
                throw new Error(`Failed to send. Reason: ${reason}`);
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.SMSMessageData?.Message || error.message;
            console.error(`[SmsService-AT] Failed to send SMS: ${errorMessage}`, {
                status: error.response?.status,
                data: error.response?.data
            });
            return { success: false, error: `Africa's Talking: ${errorMessage}` };
        }
    }

    /**
     * Clear cached configuration
     */
    static clearConfigCache(): void {
        cachedConfig = null;
        console.log(`[SmsService] Cleared config cache`);
    }
}
