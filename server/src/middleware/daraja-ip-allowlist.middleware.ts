import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Safaricom Daraja IP Allowlist Middleware
 *
 * Defence-in-depth alongside the HMAC signature verification. Even if an
 * attacker discovers the consumer secret, they cannot forge callbacks from
 * outside Safaricom's network.
 *
 * Safaricom's Daraja API sends callbacks from a known set of IP ranges.
 * In production, we verify the source IP. In sandbox/development, we log
 * the inbound headers and IP for observability but do not block.
 *
 * The IP ranges are configurable via the MPESA_ALLOWED_IPS env var
 * (comma-separated). If not set, sensible Safaricom defaults are used.
 *
 * Reference: Safaricom Daraja API documentation and community-confirmed
 * callback source IPs.
 */

// Known Safaricom Daraja callback source IPs/ranges.
// These are the IPs Safaricom uses to send STK Push, C2B, and B2C callbacks.
// Updated based on community documentation and production observations.
const SAFARICOM_IP_RANGES: string[] = [
    '196.201.214.200',
    '196.201.213.114',
    '196.201.214.206',
    '196.201.213.44',
    '41.90.0.0/16',     // Safaricom general range
    '197.232.0.0/16',   // Safaricom general range
    '154.0.0.0/16',     // Safaricom general range
];

function isIPInRanges(ip: string, ranges: string[]): boolean {
    // Exact match
    if (ranges.includes(ip)) return true;

    // CIDR match
    for (const range of ranges) {
        if (range.includes('/')) {
            const [network, prefixStr] = range.split('/');
            const prefix = parseInt(prefixStr, 10);
            if (isIPInCIDR(ip, network, prefix)) return true;
        }
    }
    return false;
}

function ipToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return -1;
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isIPInCIDR(ip: string, network: string, prefix: number): boolean {
    const ipInt = ipToInt(ip);
    const networkInt = ipToInt(network);
    if (ipInt < 0 || networkInt < 0) return false;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (networkInt & mask);
}

/**
 * Extract the client IP from the request, accounting for proxies.
 * Checks X-Forwarded-For (first IP), X-Real-IP, then falls back to
 * req.socket.remoteAddress.
 */
function getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
    }
    const realIP = req.headers['x-real-ip'];
    if (typeof realIP === 'string') return realIP;

    return req.socket?.remoteAddress?.replace(/^::ffff:/, '') || '';
}

export const verifyDarajaIP = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = getClientIP(req);
    const isProduction = process.env.NODE_ENV === 'production';

    // In sandbox/dev, log all inbound headers for debugging and observability.
    // This helps confirm what Safaricom actually sends without blocking.
    if (!isProduction) {
        const headerKeys = Object.keys(req.headers).sort();
        const headerSummary: Record<string, string> = {};
        for (const key of headerKeys) {
            // Skip long values that would flood the log
            const val = req.headers[key];
            if (typeof val === 'string' && val.length < 200) {
                headerSummary[key] = val;
            } else if (Array.isArray(val)) {
                headerSummary[key] = val.map(v => String(v).slice(0, 50)).join(', ');
            }
        }
        logger.info(
            `[DarajaIP] Sandbox mode — client IP: ${clientIP}, headers: ${JSON.stringify(headerSummary)}`
        );
    }

    // Get configured allowed IPs (env override or Safaricom defaults)
    const configuredIPs = process.env.MPESA_ALLOWED_IPS;
    const allowedRanges = configuredIPs
        ? configuredIPs.split(',').map(ip => ip.trim()).filter(Boolean)
        : SAFARICOM_IP_RANGES;

    // Always allow localhost (for testing and proxy scenarios)
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';

    if (isLocalhost || isIPInRanges(clientIP, allowedRanges)) {
        next();
        return;
    }

    // In production, reject unknown IPs. In sandbox, log and allow (for testing).
    if (isProduction) {
        logger.warn(`[DarajaIP] Rejected callback from unrecognised IP: ${clientIP}`);
        res.status(403).json({ error: 'Callback source IP not allowed' });
        return;
    }

    logger.warn(`[DarajaIP] Sandbox: allowed callback from unrecognised IP: ${clientIP}`);
    next();
};
