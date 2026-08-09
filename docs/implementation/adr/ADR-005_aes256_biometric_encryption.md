# ADR-005 — AES-256-GCM for Biometric Template Encryption

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §17, SEC-001 §4, DB-001 M-001/M-002

---

## Context

The forensic audit found that `biometric_credentials.template` is stored as a plaintext string. Biometric templates are the most sensitive data in the system — they are an irreversible representation of a person's physical identity. If stolen, they cannot be changed.

This is a P0 security gap that must be closed before any other biometric work proceeds.

---

## Decision

All biometric templates are **encrypted with AES-256-GCM** before storage. The encryption key is stored in `BIOMETRIC_ENCRYPTION_KEY` environment variable (32-byte hex). A `key_version` field enables key rotation without re-enrollment. Templates are stored as binary (`Bytes` Prisma type) — not as strings.

---

## Alternatives Considered

### Option A — Hashing (bcrypt / SHA-256)

Hash the template before storage so the original cannot be recovered.

**Rejected:** Biometric templates must be compared for verification. A one-way hash destroys the template — the device cannot verify a scan against a hashed template. Hashing is appropriate for passwords, not biometric templates.

### Option B — Database-Level Encryption (Supabase / pgcrypto)

Use Supabase's transparent data encryption or PostgreSQL's `pgcrypto` extension for column-level encryption.

**Pros:** Encryption managed at the database layer, no application code changes

**Cons:**
- Supabase TDE encrypts the entire database uniformly — it does not provide field-level key isolation (the database encryption key protects everything, including the template)
- `pgcrypto` column encryption uses keys that must be stored somewhere accessible to the database — if the database is breached, the key is often breachable too
- Key rotation requires database-level operations, not application operations
- Less portable if database is migrated off Supabase

### Option C — Envelope Encryption with AWS KMS / HashiCorp Vault

Use a dedicated Key Management Service (KMS). Data is encrypted with a Data Encryption Key (DEK); the DEK itself is encrypted with a Key Encryption Key (KEK) stored in KMS.

**Pros:** Industry best practice for highest-security requirements. Key material never touches the application server.

**Cons:**
- Adds AWS KMS or HashiCorp Vault as a required infrastructure dependency
- Each template read requires a KMS decrypt call (latency + cost)
- Significantly higher operational complexity
- Premature for the current deployment scale and compliance requirements

### Option D — AES-256-GCM with Environment Key (Chosen)

Encrypt in the application layer using Node.js built-in `crypto`. Key from environment variable. IV is random per encryption. Auth tag prevents ciphertext tampering.

**Pros:**
- Authenticated encryption — GCM auth tag detects any tampering
- Random IV per encryption — same plaintext produces different ciphertext each time
- Key rotation implemented via `key_version` field and re-encrypt script
- Uses Node.js built-in `crypto` — no additional dependency
- Key stored in environment variables, not in the database
- Portable: works regardless of hosting provider

**Cons:**
- Key stored in environment means the application process has access to the encryption key
- A compromised application server can potentially decrypt templates
- Not as secure as a dedicated HSM/KMS

---

## Consequences

- All new `BiometricCredential` writes encrypt the template before storage
- All reads decrypt on demand (server-side only — templates never leave the server)
- A `BiometricEncryptionService` class encapsulates all encryption/decryption
- Key rotation procedure: generate new key → run batch re-encrypt script → update env → increment `key_version`
- The `template` column type changes from `String` to `Bytes` (migration M-002)
- Existing plaintext templates require a one-time migration script (backup required before running)

---

## Revisit Trigger

- A compliance requirement (e.g. Kenyan Data Protection Act audit) mandates dedicated HSM
- The team scales to a size where a dedicated secrets management infrastructure (Vault) is justified
- A cloud-native deployment emerges where AWS KMS / GCP Cloud KMS adds minimal operational overhead
