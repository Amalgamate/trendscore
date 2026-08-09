/**
 * Biometric Template Encryption Service
 *
 * Encrypts and decrypts biometric templates using AES-256-GCM.
 * This is the ONLY place in the codebase that handles raw template material.
 *
 * Key rules:
 *  - Templates are encrypted before any DB write
 *  - Decrypted templates never appear in logs or API responses
 *  - Key rotation is supported via keyVersion field
 *
 * Required env vars:
 *  BIOMETRIC_ENCRYPTION_KEY   — 64-char hex string (32 bytes)
 *  BIOMETRIC_KEY_VERSION      — integer, default 1
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

function loadKey(version: number): Buffer {
  // Key for version 1: BIOMETRIC_ENCRYPTION_KEY
  // Key for version N: BIOMETRIC_ENCRYPTION_KEY_VN  (e.g. BIOMETRIC_ENCRYPTION_KEY_V2)
  const envVar = version === 1
    ? 'BIOMETRIC_ENCRYPTION_KEY'
    : `BIOMETRIC_ENCRYPTION_KEY_V${version}`;

  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(
      `[BiometricEncryption] Missing env var "${envVar}" — cannot encrypt/decrypt biometric templates`
    );
  }

  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `[BiometricEncryption] "${envVar}" must be a 64-character hex string (32 bytes). Got ${key.length} bytes.`
    );
  }

  return key;
}

export const CURRENT_KEY_VERSION = parseInt(process.env.BIOMETRIC_KEY_VERSION || '1', 10);

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

export interface EncryptedTemplate {
  /** Hex-encoded ciphertext payload: iv:ciphertext:authTag */
  encrypted: string;
  /** Which key version was used — stored alongside the ciphertext */
  keyVersion: number;
}

/**
 * Encrypt a biometric template buffer.
 * Always uses the current key version.
 * Returns a string safe for BYTEA storage as hex.
 */
export function encryptTemplate(plaintext: Buffer): EncryptedTemplate {
  const key = loadKey(CURRENT_KEY_VERSION);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertextParts = [cipher.update(plaintext), cipher.final()];
  const ciphertext = Buffer.concat(ciphertextParts);
  const authTag = cipher.getAuthTag();

  // Pack as iv:ciphertext:authTag — all hex-encoded, colon-delimited
  const packed = `${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;

  return {
    encrypted: packed,
    keyVersion: CURRENT_KEY_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypt a biometric template.
 * Accepts any supported key version to allow reading old records after rotation.
 */
export function decryptTemplate(encrypted: string, keyVersion: number): Buffer {
  const key = loadKey(keyVersion);
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error(
      '[BiometricEncryption] Malformed encrypted template — expected iv:ciphertext:authTag format'
    );
  }

  const [ivHex, ciphertextHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`[BiometricEncryption] Invalid IV length: ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`[BiometricEncryption] Invalid auth tag length: ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      '[BiometricEncryption] Decryption failed — template may be corrupted or wrong key version'
    );
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Convert a plaintext string template (legacy) to a Buffer for encryption.
 * Used only during the one-time migration of existing records.
 */
export function legacyStringToBuffer(template: string): Buffer {
  return Buffer.from(template, 'utf8');
}

/**
 * Validate that a string looks like a valid encrypted template
 * without decrypting it (cheap pre-check).
 */
export function isEncryptedTemplate(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  if (parts[0].length !== IV_LENGTH * 2) return false;       // 32 hex chars = 16 bytes
  if (parts[2].length !== AUTH_TAG_LENGTH * 2) return false; // 32 hex chars = 16 bytes
  return /^[0-9a-f]+$/i.test(parts.join(''));
}
