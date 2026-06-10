import axios from 'axios';
import prisma from '../config/database';
import { MpesaStatus, MpesaTransactionType } from '@prisma/client';
import { decrypt } from '../utils/encryption.util';
import { PRODUCT_BRAND_EMAIL, PRODUCT_DISPLAY_NAME } from '../config/productIdentity';

class KopoKopoService {
    private sandboxUrl = 'https://sandbox.kopokopo.com';
    private liveUrl = 'https://api.kopokopo.com';

    private async getConfig() {
        const config = await prisma.communicationConfig.findFirst();
        if (!config) throw new Error('Kopo Kopo configuration not found');
        return config;
    }

    private async getBaseUrl() {
        const config = await this.getConfig();
        return config.mpesaSandbox ? this.sandboxUrl : this.liveUrl;
    }

    private async getCredentials() {
        const config = await this.getConfig();
        return {
            clientId: config.mpesaPublicKey ? config.mpesaPublicKey : '',
            clientSecret: config.mpesaSecretKey ? decrypt(config.mpesaSecretKey) : '',
            apiKey: config.mpesaApiKey ? decrypt(config.mpesaApiKey) : '',
            tillNumber: config.mpesaBusinessNo || ''
        };
    }

    /**
     * Generate OAuth2 Access Token
     */
    async getAccessToken() {
        const baseUrl = await this.getBaseUrl();
        const { clientId, clientSecret } = await this.getCredentials();

        try {
            const response = await axios.post(`${baseUrl}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            });
            return response.data.access_token;
        } catch (error: any) {
            console.error('[KopoKopo] Auth Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Kopo Kopo');
        }
    }

    /**
     * Initiate STK Push (C2B)
     */
    async initiateStkPush(params: {
        phoneNumber: string;
        amount: number;
        firstName?: string;
        lastName?: string;
        studentId?: string;
        invoiceId?: string;
    }) {
        const baseUrl = await this.getBaseUrl();
        const token = await this.getAccessToken();
        const { tillNumber } = await this.getCredentials();

        // Normalize phone number to +254...
        let phone = params.phoneNumber.replace('+', '');
        if (phone.startsWith('0')) phone = '254' + phone.slice(1);
        if (!phone.startsWith('254')) phone = '254' + phone;
        phone = '+' + phone;

        const payload = {
            payment_channel: 'mpesa_cv',
            till_number: tillNumber,
            subscriber: {
                first_name: params.firstName || 'Learner',
                last_name: params.lastName || (params.studentId ? `ID-${params.studentId}` : 'Parent'),
                phone_number: phone,
                email: PRODUCT_BRAND_EMAIL
            },
            amount: {
                currency: 'KES',
                value: params.amount
            },
            metadata: {
                student_id: params.studentId,
                invoice_id: params.invoiceId,
                system: PRODUCT_DISPLAY_NAME
            },
            _links: {
                callback_url: process.env.KOPOKOPO_WEBHOOK_URL || 'https://yourdomain.com/api/mpesa/callback'
            }
        };

        try {
            const response = await axios.post(`${baseUrl}/api/v1/stk_push`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.komatika.v1+json',
                    'Content-Type': 'application/json'
                }
            });

            // Kopo Kopo returns a Location header with the outcome URL, or a resource ID in the body
            const externalId = response.headers.location?.split('/').pop();

            await prisma.mpesaTransaction.create({
                data: {
                    type: MpesaTransactionType.COLLECTION,
                    amount: params.amount,
                    phoneNumber: phone,
                    status: 'PENDING',
                    studentId: params.studentId,
                    invoiceId: params.invoiceId,
                    externalId: externalId || null,
                    metadata: response.data
                }
            });

            return {
                success: true,
                message: 'Payment request sent to phone',
                externalId
            };
        } catch (error: any) {
            console.error('[KopoKopo] STK Push Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.errors?.[0]?.message || 'STK Push failed',
                error: error.response?.data
            };
        }
    }

    /**
     * Initiate Payout (B2C)
     */
    async initiatePayout(params: {
        phoneNumber: string;
        amount: number;
        staffId?: string;
        payrollRecordId?: string;
        reason?: string;
    }) {
        const baseUrl = await this.getBaseUrl();
        const token = await this.getAccessToken();

        // Normalize phone number to +254...
        let phone = params.phoneNumber.replace('+', '');
        if (phone.startsWith('0')) phone = '254' + phone.slice(1);
        if (!phone.startsWith('254')) phone = '254' + phone;
        phone = '+' + phone;

        const payload = {
            destination_type: 'mobile_wallet',
            destination_reference: phone,
            amount: {
                currency: 'KES',
                value: params.amount
            },
            metadata: {
                staff_id: params.staffId,
                payroll_id: params.payrollRecordId,
                reason: params.reason || 'Salary Payment'
            },
            _links: {
                callback_url: process.env.KOPOKOPO_WEBHOOK_URL || 'https://yourdomain.com/api/mpesa/callback'
            }
        };

        try {
            const response = await axios.post(`${baseUrl}/api/v1/payments`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.komatika.v1+json',
                    'Content-Type': 'application/json'
                }
            });

            const externalId = response.headers.location?.split('/').pop();

            await prisma.mpesaTransaction.create({
                data: {
                    type: MpesaTransactionType.PAYOUT,
                    amount: params.amount,
                    phoneNumber: phone,
                    status: 'PENDING',
                    staffId: params.staffId,
                    payrollRecordId: params.payrollRecordId,
                    externalId: externalId || null,
                    metadata: response.data
                }
            });

            return {
                success: true,
                message: 'Payout initiated successfully',
                externalId
            };
        } catch (error: any) {
            console.error('[KopoKopo] Payout Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.errors?.[0]?.message || 'Payout failed',
                error: error.response?.data
            };
        }
    }

    /**
     * Query STK Push Status
     */
    async queryStkStatus(externalId: string) {
        const baseUrl = await this.getBaseUrl();
        const token = await this.getAccessToken();

        try {
            const response = await axios.get(`${baseUrl}/api/v1/stk_push/${externalId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.komatika.v1+json'
                }
            });

            // Status can be: 'Ordered', 'Pending', 'Processing', 'Success', 'Failed'
            return response.data;
        } catch (error: any) {
            console.error('[KopoKopo] Status Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query Kopo Kopo status');
        }
    }
}

export const kopokopoService = new KopoKopoService();
