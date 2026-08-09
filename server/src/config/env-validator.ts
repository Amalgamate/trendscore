import 'dotenv/config';

interface EnvRequirement {
    key: string;
    required: boolean;
    description: string;
    example?: string;
    validation?: (value: string) => boolean | string; // Returns true if valid, or error message
}

const REQUIREMENTS: EnvRequirement[] = [
    { 
        key: 'PORT', 
        required: true, 
        description: 'Server port (e.g., 5000)',
        validation: (val) => /^\d+$/.test(val) || 'PORT must be a number'
    },
    { 
        key: 'NODE_ENV', 
        required: true, 
        description: 'Environment (development/production)',
        validation: (val) => ['development', 'production', 'test'].includes(val) || 'NODE_ENV must be development, production, or test'
    },
    { 
        key: 'DATABASE_URL', 
        required: true, 
        description: 'Prisma database connection string',
        validation: (val) => val.includes('postgresql://') || val.includes('mysql://') || 'DATABASE_URL must be a valid database connection string'
    },
    { 
        key: 'JWT_SECRET', 
        required: true, 
        description: 'Secret key for signing tokens',
        validation: (val) => val.length >= 32 || 'JWT_SECRET must be at least 32 characters long'
    },
    { 
        key: 'JWT_REFRESH_SECRET', 
        required: true, 
        description: 'Secret key for refresh tokens',
        validation: (val) => val.length >= 32 || 'JWT_REFRESH_SECRET must be at least 32 characters long'
    },
    { 
        key: 'FRONTEND_URL', 
        required: true, 
        description: 'URL of the frontend application',
        validation: (val) => /^https?:\/\//.test(val) || 'FRONTEND_URL must start with http:// or https://'
    },
    { 
        key: 'API_URL', 
        required: false, 
        description: 'API base URL for frontend consumption'
    },
    { 
        key: 'RESEND_API_KEY', 
        required: false, 
        description: 'API key for Resend email delivery' 
    },
    { 
        key: 'EMAIL_FROM', 
        required: false, 
        description: 'Default sender email address for Resend delivery' 
    },
    {
        key: 'OPENAI_API_KEY',
        required: false,
        description: 'API key for optional AI-assisted email template drafting'
    },
    { 
        key: 'SMTP_HOST', 
        required: false, 
        description: 'Legacy SMTP host (deprecated; Resend is used for app email delivery)' 
    },
    { 
        key: 'SMTP_USER', 
        required: false, 
        description: 'SMTP username' 
    },
    { 
        key: 'SMTP_PASS', 
        required: false, 
        description: 'SMTP password' 
    },
    { 
        key: 'SMTP_FROM', 
        required: false, 
        description: 'SMTP sender address' 
    },
    {
        key: 'RATE_LIMIT_ENABLED',
        required: false,
        description: 'Enable rate limiting (true/false)',
        validation: (val) => ['true', 'false'].includes(val.toLowerCase()) || 'RATE_LIMIT_ENABLED must be true or false'
    },
    {
        key: 'SECURE_COOKIES',
        required: false,
        description: 'Use secure cookies (true/false)',
        validation: (val) => ['true', 'false'].includes(val.toLowerCase()) || 'SECURE_COOKIES must be true or false'
    },
    {
        key: 'SKIP_OTP',
        required: false,
        description: 'Skip OTP verification in development (true/false)',
        validation: (val) => ['true', 'false'].includes(val.toLowerCase()) || 'SKIP_OTP must be true or false'
    },
    {
        key: 'ENCRYPTION_KEY',
        required: true,
        description: 'Key for sensitive data encryption (32 chars hex)',
        validation: (val) => val.length >= 32 || 'ENCRYPTION_KEY must be at least 32 characters long'
    },
    {
        key: 'BIOMETRIC_ENCRYPTION_KEY',
        required: process.env.NODE_ENV === 'production',
        description: 'Dedicated AES-256 key for biometric templates (64 hex characters)',
        validation: (val) => /^[0-9a-fA-F]{64}$/.test(val) || 'BIOMETRIC_ENCRYPTION_KEY must be exactly 64 hexadecimal characters'
    },
    {
        key: 'BIOMETRIC_KEY_VERSION',
        required: false,
        description: 'Positive integer identifying the active biometric encryption key version',
        validation: (val) => /^[1-9]\d*$/.test(val) || 'BIOMETRIC_KEY_VERSION must be a positive integer'
    }
];

/**
 * Validates that all required environment variables are set and properly formatted.
 * Exits the process with an error message if any are missing or invalid.
 */
export function validateEnvironment(): void {
    console.log('🔍 Validating environment variables...');
    const missing: string[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];

    for (const req of REQUIREMENTS) {
        const val = process.env[req.key];
        
        if (!val) {
            if (req.required) {
                missing.push(`   ❌ ${req.key.padEnd(25)} | ${req.description}`);
            } else {
                warnings.push(`   ⚠️ ${req.key.padEnd(25)} | ${req.description} (Recommended)`);
            }
        } else if (req.validation) {
            const result = req.validation(val);
            if (result !== true) {
                invalid.push(`   ❌ ${req.key.padEnd(25)} | ${result}`);
            }
        }
    }

    const httpsOnly =
        (process.env.HTTPS_ONLY || '').toLowerCase() === 'true';

    // Security checks for production
    if (process.env.NODE_ENV === 'production') {
        if (httpsOnly && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('https://')) {
            invalid.push('   ❌ FRONTEND_URL must use HTTPS when HTTPS_ONLY=true in production');
        }
        if (httpsOnly && process.env.API_URL && !process.env.API_URL.startsWith('https://')) {
            invalid.push('   ❌ API_URL must use HTTPS when HTTPS_ONLY=true in production');
        }
        if (!process.env.SECURE_COOKIES || process.env.SECURE_COOKIES !== 'true') {
            warnings.push('   ⚠️ SECURE_COOKIES should be true in production');
        }
        if (!process.env.RATE_LIMIT_ENABLED || process.env.RATE_LIMIT_ENABLED !== 'true') {
            warnings.push('   ⚠️ RATE_LIMIT_ENABLED should be true in production');
        }
    }

    if (warnings.length > 0) {
        console.warn('\n--- ENVIRONMENT WARNINGS ---');
        warnings.forEach(w => console.warn(w));
        console.warn('---------------------------');
    }

    if (invalid.length > 0) {
        console.error('\n' + '!'.repeat(60));
        console.error('❌ INVALID CONFIGURATION VALUES');
        console.error('!'.repeat(60));
        console.error('The following environment variables have invalid values:');
        invalid.forEach(i => console.error(i));
        console.error('!'.repeat(60) + '\n');
        process.exit(1);
    }

    if (missing.length > 0) {
        console.error('\n' + '!'.repeat(60));
        console.error('❌ CRITICAL CONFIGURATION ERROR');
        console.error('!'.repeat(60));
        console.error('The following environment variables are MISSING:');
        missing.forEach(m => console.error(m));
        console.error('\nPlease check your .env file or deployment portal.');
        console.error('Refer to .env.example for details.');
        console.error('!'.repeat(60) + '\n');
        process.exit(1);
    }

    console.log('✅ Environment validation passed');
    console.log('');
}
