/**
 * Unit tests for BiometricEncryptionService
 * These tests run without a database — pure crypto logic only.
 */

import {
  encryptTemplate,
  decryptTemplate,
  isEncryptedTemplate,
  legacyStringToBuffer,
  CURRENT_KEY_VERSION,
} from './biometric.encryption';

// Set a test encryption key before any import side-effects
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes — valid AES-256 key
const TEST_KEY_V2 = 'b'.repeat(64);

beforeAll(() => {
  process.env.BIOMETRIC_ENCRYPTION_KEY = TEST_KEY;
  process.env.BIOMETRIC_ENCRYPTION_KEY_V2 = TEST_KEY_V2;
  process.env.BIOMETRIC_KEY_VERSION = '1';
});

afterAll(() => {
  delete process.env.BIOMETRIC_ENCRYPTION_KEY;
  delete process.env.BIOMETRIC_ENCRYPTION_KEY_V2;
  delete process.env.BIOMETRIC_KEY_VERSION;
});

// ---------------------------------------------------------------------------
// Core encrypt/decrypt round-trip
// ---------------------------------------------------------------------------

describe('encryptTemplate / decryptTemplate', () => {
  it('round-trips a binary template buffer correctly', () => {
    const original = Buffer.from([0x01, 0x02, 0x03, 0xfe, 0xff, 0xaa]);
    const { encrypted, keyVersion } = encryptTemplate(original);
    const decrypted = decryptTemplate(encrypted, keyVersion);
    expect(decrypted).toEqual(original);
  });

  it('round-trips a realistic fingerprint template (512 bytes)', () => {
    const original = Buffer.alloc(512);
    for (let i = 0; i < 512; i++) original[i] = i % 256;
    const { encrypted, keyVersion } = encryptTemplate(original);
    const decrypted = decryptTemplate(encrypted, keyVersion);
    expect(decrypted).toEqual(original);
  });

  it('round-trips a string-derived template (legacy migration path)', () => {
    const legacy = 'base64encodedtemplatestring==';
    const original = legacyStringToBuffer(legacy);
    const { encrypted, keyVersion } = encryptTemplate(original);
    const decrypted = decryptTemplate(encrypted, keyVersion);
    expect(decrypted.toString('utf8')).toBe(legacy);
  });

  it('produces different ciphertext for same plaintext on each call (random IV)', () => {
    const plain = Buffer.from('same template data');
    const { encrypted: enc1 } = encryptTemplate(plain);
    const { encrypted: enc2 } = encryptTemplate(plain);
    // Same plaintext → different ciphertext (different IV)
    expect(enc1).not.toBe(enc2);
    // But both decrypt correctly
    expect(decryptTemplate(enc1, 1)).toEqual(plain);
    expect(decryptTemplate(enc2, 1)).toEqual(plain);
  });

  it('uses current key version by default', () => {
    const plain = Buffer.from('template');
    const { keyVersion } = encryptTemplate(plain);
    expect(keyVersion).toBe(CURRENT_KEY_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('decryptTemplate error handling', () => {
  it('throws on malformed encrypted string (wrong separator count)', () => {
    expect(() => decryptTemplate('notvalid', 1)).toThrow('Malformed encrypted template');
  });

  it('throws when auth tag is tampered with', () => {
    const plain = Buffer.from('sensitive');
    const { encrypted, keyVersion } = encryptTemplate(plain);
    // Flip last byte of auth tag
    const parts = encrypted.split(':');
    const tag = parts[2];
    parts[2] = tag.slice(0, -2) + (tag.slice(-2) === 'ff' ? '00' : 'ff');
    const tampered = parts.join(':');
    expect(() => decryptTemplate(tampered, keyVersion)).toThrow('Decryption failed');
  });

  it('throws when wrong key version is specified', () => {
    const plain = Buffer.from('data');
    const { encrypted } = encryptTemplate(plain);
    // Version 99 has no key — should throw missing env var
    expect(() => decryptTemplate(encrypted, 99)).toThrow();
  });

  it('throws when BIOMETRIC_ENCRYPTION_KEY is not set', () => {
    const saved = process.env.BIOMETRIC_ENCRYPTION_KEY;
    delete process.env.BIOMETRIC_ENCRYPTION_KEY;
    expect(() => encryptTemplate(Buffer.from('test'))).toThrow('Missing env var');
    process.env.BIOMETRIC_ENCRYPTION_KEY = saved;
  });

  it('throws when key is wrong length', () => {
    process.env.BIOMETRIC_ENCRYPTION_KEY = 'tooshort';
    expect(() => encryptTemplate(Buffer.from('test'))).toThrow('must be a 64-character hex string');
    process.env.BIOMETRIC_ENCRYPTION_KEY = TEST_KEY;
  });
});

// ---------------------------------------------------------------------------
// isEncryptedTemplate
// ---------------------------------------------------------------------------

describe('isEncryptedTemplate', () => {
  it('returns true for a valid encrypted template', () => {
    const { encrypted } = encryptTemplate(Buffer.from('template data'));
    expect(isEncryptedTemplate(encrypted)).toBe(true);
  });

  it('returns false for a plaintext legacy string', () => {
    expect(isEncryptedTemplate('base64encodedlegacytemplate==')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isEncryptedTemplate('')).toBe(false);
  });

  it('returns false for a string with wrong part count', () => {
    expect(isEncryptedTemplate('aabbcc:ddeeff')).toBe(false);
  });
});
