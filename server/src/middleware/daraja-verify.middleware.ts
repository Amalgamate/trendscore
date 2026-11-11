import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption.util';

/**
 * Daraja Callback Signature Verification Middleware
 *
 * Daraja sends an `Authorization` header on STK Push callbacks:
 *   Authorization: Bearer <base64(HMAC-SHA256(callbackUrl + requestBody, consumerSecret))>
 *
 * Without this check, anyone could POST a forged "Success" payload to the
 * callback endpoint and reduce a learner's invoice balance with no money
 * actually received — the most critical security gap in the payment flow.
 *
 * This middleware:
 * 1. Extracts the HMAC from the Authorization header.
 * 2. Recomputes HMAC-SHA256 over (callbackUrl + rawRequestBody).
 * 3. Compares the two in constant time.
 * 4. Rejects mismatches with 401.
 *
 * In development (no MPESA_CONSUMER_SECRET set), verification is skipped
 * with a loud warning so local testing still works.
 */
export const verifyDarajaCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let consumerSecret: string;
    let schoolCallbackUrl: string;
    try {
        // Each school is served from its own database/deployment. Read the
        // matching encrypted secret from that school's communication config.
        const config = await prisma.communicationConfig.findFirst();
        consumerSecret = config?.mpesaSecretKey ? decrypt(config.mpesaSecretKey) : '';
        schoolCallbackUrl = process.env.MPESA_CALLBACK_URL || 'https://zawadi.trendscore.co.ke/api/mpesa/callback';
    } catch (error: any) {
        logger.error('[DarajaVerify] Could not load school callback credentials:', error?.message);
        res.status(401).json({ error: 'Callback verification not configured' });
        return;
    }

    // Only retain the explicit local development bypass. Production callback
    // validation must fail closed if this school's secret is absent.
    if (!consumerSecret) {
        if (process.env.NODE_ENV === 'production') {
            logger.error('[DarajaVerify] School Daraja consumer secret is not configured — rejecting callback');
            res.status(401).json({ error: 'Callback verification not configured' });
            return;
        }
        logger.warn('[DarajaVerify] School Daraja consumer secret not set — skipping verification (dev mode only)');
        next();
        return;
    }

    const authHeader = req.headers['authorization'];

    // ── No Authorization header ──────────────────────────────────────────────
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('[DarajaVerify] Missing or malformed Authorization header on callback');
        res.status(401).json({ error: 'Missing callback signature' });
        return;
    }

    const providedHmac = authHeader.slice(7); // strip "Bearer "

    // ── Retrieve the callback URL configured for Daraja ──────────────────────
    // This must match exactly what was sent in the STK Push CallBackURL field.
    const callbackUrl = schoolCallbackUrl;

    // ── Retrieve the raw request body ────────────────────────────────────────
    // Express's JSON parser consumes the stream, so we need the raw body.
    // The express.json() middleware must be configured with `verify` to
    // attach req.rawBody. If rawBody is missing we fall back to re-serialising
    // req.body (Daraja tolerates this because the body is canonical JSON from
    // their servers, but rawBody is preferred for exactness).
    const rawBody: string =
        (req as any).rawBody?.toString('utf-8') ||
        JSON.stringify(req.body);

    // ── Compute expected HMAC ────────────────────────────────────────────────
    // Daraja's algorithm: HMAC-SHA256(key=consumerSecret, data=callbackUrl + rawBody)
    // The result is base64-encoded and sent as the Bearer token.
    const expectedHmac = crypto
        .createHmac('sha256', consumerSecret)
        .update(callbackUrl + rawBody)
        .digest('base64');

    // ── Constant-time comparison to prevent timing attacks ───────────────────
    const providedBuffer = Buffer.from(providedHmac);
    const expectedBuffer = Buffer.from(expectedHmac);

    if (providedBuffer.length !== expectedBuffer.length) {
        logger.warn('[DarajaVerify] HMAC length mismatch — rejecting callback');
        res.status(401).json({ error: 'Invalid callback signature' });
        return;
    }

    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        logger.warn('[DarajaVerify] HMAC signature mismatch — rejecting callback');
        res.status(401).json({ error: 'Invalid callback signature' });
        return;
    }

    logger.info('[DarajaVerify] Callback signature verified successfully');
    next();
};
