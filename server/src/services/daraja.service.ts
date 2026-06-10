import axios from 'axios';
import prisma from '../config/database';
import { MpesaStatus, MpesaTransactionType } from '@prisma/client';
import { PRODUCT_NAME } from '../config/productIdentity';

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

    private get passKey() {
        return process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    }

    private get callbackUrl() {
        return process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/tertiary/mpesa/callback';
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
            console.error('[Daraja] Access Token Error:', error.response?.data || error.message);
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
            AccountReference: params.studentId || PRODUCT_NAME,
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
            console.error('[Daraja] STK Push Error:', error.response?.data || error.message);
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
            console.error('[Daraja] Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query M-Pesa transaction status');
        }
    }
}

export const darajaService = new DarajaService();
