import axios from 'axios';
import crypto from 'crypto';
import prisma from '../config/database';
import { MpesaStatus, MpesaTransactionType } from '@prisma/client';
import { PRODUCT_NAME } from '../config/productIdentity';
import logger from '../utils/logger';

class DarajaService {
    private sandboxUrl = 'https://sandbox.safaricom.co.ke';
    private liveUrl = 'https://api.safaricom.co.ke';

    private get baseUrl() {
        return process.env.NODE_ENV === 'production' ? this.liveUrl : this.sandboxUrl;
    }

    private get consumerKey() {
        return process.env.MPESA_CONSUMER_KEY || '';
    }

    private get consumerSecret() {
        return process.env.MPESA_CONSUMER_SECRET || '';
    }

    private get shortCode() {
        return process.env.MPESA_SHORTCODE || '174379';
    }

    // B2C — organisation shortcode that initiates the payout (may differ from
    // the C2B collection shortcode). Falls back to the same shortcode.
    private get b2cShortCode() {
        return process.env.MPESA_B2C_SHORTCODE || this.shortCode;
    }

    private get b2cInitiatorName() {
        return process.env.MPESA_B2C_INITIATOR_NAME || '';
    }

    private get b2cSecurityCredential() {
        return process.env.MPESA_B2C_SECURITY_CREDENTIAL || '';
    }

    private get passKey() {
        return process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    }

    private get callbackUrl() {
        return process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/tertiary/mpesa/callback';
    }

    // B2C result + timeout URLs — these differ from the STK callback URL.
    // Daraja posts the B2C result to the ResultURL and a timeout notification
    // to the QueueTimeOutURL.
    private get b2cResultUrl() {
        return process.env.MPESA_B2C_RESULT_URL || 'https://yourdomain.com/api/tertiary/mpesa/b2c/result';
    }

    private get b2cTimeoutUrl() {
        return process.env.MPESA_B2C_TIMEOUT_URL || 'https://yourdomain.com/api/tertiary/mpesa/b2c/timeout';
    }

    // C2B confirmation + validation URLs. Daraja posts C2B (paybill/till)
    // transactions to the ConfirmationURL for completed payments and the
    // ValidationURL for real-time account reference validation.
    private get c2bConfirmationUrl() {
        return process.env.MPESA_C2B_CONFIRMATION_URL || 'https://yourdomain.com/api/tertiary/mpesa/c2b/confirmation';
    }

    private get c2bValidationUrl() {
        return process.env.MPESA_C2B_VALIDATION_URL || 'https://yourdomain.com/api/tertiary/mpesa/c2b/validation';
    }

    async getAccessToken() {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        try {
            const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            });
            return response.data.access_token;
        } catch (error: any) {
            logger.error('[Daraja] Access Token Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with M-Pesa Daraja API');
        }
    }

    async initiateStkPush(params: {
        phoneNumber: string;
        amount: number;
        studentId?: string;
        invoiceId?: string;
    }) {
        const token = await this.getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');

        let phone = params.phoneNumber.replace('+', '');
        if (phone.startsWith('0')) phone = '254' + phone.slice(1);
        if (!phone.startsWith('254')) phone = '254' + phone;

        // ── AccountReference: admission number when a learner is linked ───────
        // Parents paying via STK push should see the child's admission number
        // on the M-Pesa prompt. When organic paybill payments come in, the
        // same admission number is used as the AccountReference — so this
        // ensures STK-initiated and organic payments use the same identifier
        // and can both be auto-matched.
        let accountReference = PRODUCT_NAME;
        if (params.studentId) {
            try {
                const learner = await prisma.learner.findUnique({
                    where: { id: params.studentId },
                    select: { admissionNumber: true },
                });
                if (learner?.admissionNumber) {
                    // Daraja AccountReference max 12 chars — trim if needed
                    accountReference = learner.admissionNumber.slice(0, 12);
                }
            } catch {
                // Fall back to product name if learner lookup fails
            }
        }

        const payload = {
            BusinessShortCode: this.shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(params.amount),
            PartyA: phone,
            PartyB: this.shortCode,
            PhoneNumber: phone,
            CallBackURL: this.callbackUrl,
            AccountReference: accountReference,
            TransactionDesc: 'Fee Payment'
        };

        try {
            const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            await prisma.mpesaTransaction.create({
                data: {
                    type: MpesaTransactionType.COLLECTION,
                    merchantRequestId: response.data.MerchantRequestID,
                    checkoutRequestId: response.data.CheckoutRequestID,
                    amount: params.amount,
                    phoneNumber: phone,
                    status: 'PENDING',
                    studentId: params.studentId,
                    invoiceId: params.invoiceId
                }
            });

            return {
                success: true,
                message: response.data.CustomerMessage,
                checkoutRequestId: response.data.CheckoutRequestID
            };
        } catch (error: any) {
            logger.error('[Daraja] STK Push Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.errorMessage || 'Failed to initiate STK Push',
                error: error.response?.data
            };
        }
    }

    async queryStkStatus(checkoutRequestId: string) {
        const token = await this.getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');

        const payload = {
            BusinessShortCode: this.shortCode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId
        };

        try {
            const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/query`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error: any) {
            logger.error('[Daraja] Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query M-Pesa transaction status');
        }
    }

    // ─── B2C Payout ──────────────────────────────────────────────────────────
    /**
     * Initiate a Business-to-Customer (B2C) disbursement via Daraja.
     *
     * Used for:
     *  - Salary payouts (payroll disbursement)
     *  - Refund returns (when a refund is approved, the money is sent back to
     *    the parent's M-Pesa account via B2C)
     *
     * Requires the following env vars:
     *  - MPESA_B2C_INITIATOR_NAME: the organisation's Daraja B2C initiator name
     *  - MPESA_B2C_SECURITY_CREDENTIAL: encrypted security credential from Daraja portal
     *  - MPESA_B2C_SHORTCODE: the B2C organisation shortcode (falls back to MPESA_SHORTCODE)
     *
     * CommandID determines the transaction type:
     *  - 'SalaryPayment' for payroll
     *  - 'BusinessPayment' for general B2C
     *  - 'PromotionPayment' for promotional disbursements
     *
     * The result arrives asynchronously at the B2C ResultURL. The caller should
     * store the ConversationID to match the result to the originating request.
     */
    async initiateB2cPayout(params: {
        phoneNumber: string;
        amount: number;
        occasion?: string;          // Short description (e.g. "Salary Jan 2027" or "Refund INV-001")
        commandId?: string;         // 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment'
        originatorConversationId?: string; // Caller's tracking ID (stored in metadata)
    }): Promise<{
        success: boolean;
        conversationId?: string;
        originatorConversationId?: string;
        message?: string;
        error?: any;
    }> {
        const initiatorName = this.b2cInitiatorName;
        const securityCredential = this.b2cSecurityCredential;

        if (!initiatorName || !securityCredential) {
            const msg = 'Daraja B2C is not configured. Set MPESA_B2C_INITIATOR_NAME and MPESA_B2C_SECURITY_CREDENTIAL.';
            logger.warn(`[DarajaB2C] ${msg}`);
            return { success: false, message: msg };
        }

        const token = await this.getAccessToken();

        let phone = params.phoneNumber.replace('+', '');
        if (phone.startsWith('0')) phone = '254' + phone.slice(1);
        if (!phone.startsWith('254')) phone = '254' + phone;

        const originatorConvId = params.originatorConversationId || crypto.randomUUID();

        const payload = {
            InitiatorName: initiatorName,
            SecurityCredential: securityCredential,
            CommandID: params.commandId || 'BusinessPayment',
            Amount: Math.round(params.amount),
            PartyA: this.b2cShortCode,
            PartyB: phone,
            Remarks: params.occasion || 'B2C Disbursement',
            AccountReference: originatorConvId.slice(0, 12),
            QueueTimeOutURL: this.b2cTimeoutUrl,
            ResultURL: this.b2cResultUrl,
            Occasion: params.occasion || 'B2C Disbursement',
            OriginatorConversationID: originatorConvId,
        };

        try {
            const response = await axios.post(`${this.baseUrl}/mpesa/b2c/v1/paymentrequest`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = response.data;

            // Daraja returns ConversationID and OriginatorConversationID
            // The actual result arrives at the ResultURL asynchronously
            return {
                success: true,
                conversationId: data.ConversationID,
                originatorConversationId: data.OriginatorConversationID || originatorConvId,
                message: data.ResponseDescription || 'B2C request accepted',
            };
        } catch (error: any) {
            logger.error('[DarajaB2C] Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.errorMessage || 'Failed to initiate B2C payout',
                error: error.response?.data,
            };
        }
    }

    // ─── C2B URL Registration ────────────────────────────────────────────────
    /**
     * Register C2B confirmation and validation URLs with Daraja.
     *
     * This is a one-time setup call (per shortcode) that tells Daraja where to
     * post organic paybill/till payments. After registration, Daraja sends:
     *  - ValidationURL: real-time validation of the AccountReference (can accept
     *    or reject the payment based on whether the admission number exists)
     *  - ConfirmationURL: the completed payment notification (contains amount,
     *    receipt, MSISDN, and the AccountReference used)
     *
     * This should be called once during deployment or when the callback URLs change.
     */
    async registerC2bUrls(): Promise<{ success: boolean; message: string }> {
        const token = await this.getAccessToken();

        const payload = {
            ShortCode: this.shortCode,
            ResponseType: 'Completed', // Accept all payments — validation can still reject
            ConfirmationURL: this.c2bConfirmationUrl,
            ValidationURL: this.c2bValidationUrl,
        };

        try {
            const response = await axios.post(`${this.baseUrl}/mpesa/c2b/v1/registerurl`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            logger.info('[DarajaC2B] URLs registered:', response.data?.ResponseDescription);
            return {
                success: true,
                message: response.data?.ResponseDescription || 'C2B URLs registered',
            };
        } catch (error: any) {
            logger.error('[DarajaC2B] Registration Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.errorMessage || 'Failed to register C2B URLs',
            };
        }
    }
}

export const darajaService = new DarajaService();
