'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Mirrors billing-store.js's shape: node:sqlite DatabaseSync, one file in
// CONSOLE_DATA_DIR, camelCase projections out of the DB, plain functions
// (no class) exported from a factory.
//
// Includes TOTP/MFA support (secret storage + hashed backup codes) as part
// of Phase 0 — see TRENDSCORE_ERP_ADMIN_PLAN.md Phase 0: the codebase's own
// prior comment in server.js already anticipated MFA landing alongside the
// DB-backed user store, so it isn't bolted on separately here.

function createUsersStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'platform-users.sqlite'));
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS console_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('super_admin', 'platform_owner')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      totp_secret TEXT NOT NULL DEFAULT '',
      totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS console_users_email_unique
      ON console_users(email);

    CREATE TABLE IF NOT EXISTS console_user_backup_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES console_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS console_user_backup_codes_user_idx
      ON console_user_backup_codes(user_id);
  `);

  const nowIso = () => new Date().toISOString();

  const userColumns = `id, email, password_hash AS passwordHash, name, role, active,
    totp_secret AS totpSecret, totp_enabled AS totpEnabled,
    created_at AS createdAt, updated_at AS updatedAt, last_login_at AS lastLoginAt`;

  const decodeUser = row => row && ({
    ...row,
    active: Boolean(row.active),
    totpEnabled: Boolean(row.totpEnabled),
  });

  // ── Users ─────────────────────────────────────────────────────────────
  function listUsers() {
    const rows = db.prepare(`SELECT ${userColumns} FROM console_users ORDER BY created_at ASC`).all();
    return rows.map(decodeUser);
  }

  function getUser(id) {
    const row = db.prepare(`SELECT ${userColumns} FROM console_users WHERE id = ?`).get(String(id));
    return decodeUser(row);
  }

  function getUserByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const row = db.prepare(`SELECT ${userColumns} FROM console_users WHERE lower(email) = ?`).get(normalized);
    return decodeUser(row);
  }

  function createUser({ email, passwordHash, name = '', role, active = true }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('email is required');
    if (!passwordHash) throw new Error('passwordHash is required');
    if (!['super_admin', 'platform_owner'].includes(role)) throw new Error('role must be super_admin or platform_owner');

    const id = crypto.randomUUID();
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO console_users (id, email, password_hash, name, role, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, normalizedEmail, passwordHash, String(name || ''), role, active ? 1 : 0, timestamp, timestamp);

    return getUser(id);
  }

  function updateUser(id, patch = {}) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');

    const next = {
      name: patch.name !== undefined ? String(patch.name) : existing.name,
      role: patch.role !== undefined ? patch.role : existing.role,
      active: patch.active !== undefined ? Boolean(patch.active) : existing.active,
    };
    if (!['super_admin', 'platform_owner'].includes(next.role)) throw new Error('role must be super_admin or platform_owner');

    db.prepare(`
      UPDATE console_users SET name = ?, role = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(next.name, next.role, next.active ? 1 : 0, nowIso(), String(id));

    return getUser(id);
  }

  function setUserActive(id, active) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');
    db.prepare(`UPDATE console_users SET active = ?, updated_at = ? WHERE id = ?`)
      .run(active ? 1 : 0, nowIso(), String(id));
    return getUser(id);
  }

  function setPassword(id, passwordHash) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');
    if (!passwordHash) throw new Error('passwordHash is required');
    db.prepare(`UPDATE console_users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .run(passwordHash, nowIso(), String(id));
    return getUser(id);
  }

  function recordLogin(id) {
    db.prepare(`UPDATE console_users SET last_login_at = ? WHERE id = ?`).run(nowIso(), String(id));
  }

  function countActiveByRole(role) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM console_users WHERE role = ? AND active = 1`).get(role);
    return Number(row?.n || 0);
  }

  // ── TOTP / MFA ────────────────────────────────────────────────────────
  // Secret is stored as given by the caller (base32) — encrypting it at
  // rest is a deployment-level decision (e.g. via SQLCipher or an OS
  // keychain) not made here; this store just persists whatever secret the
  // caller generated and asks to save.
  function setTotpSecret(id, secret) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');
    db.prepare(`UPDATE console_users SET totp_secret = ?, updated_at = ? WHERE id = ?`)
      .run(String(secret || ''), nowIso(), String(id));
    return getUser(id);
  }

  function setTotpEnabled(id, enabled) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');
    if (enabled && !existing.totpSecret) throw new Error('Cannot enable TOTP without a secret set first');
    db.prepare(`UPDATE console_users SET totp_enabled = ?, updated_at = ? WHERE id = ?`)
      .run(enabled ? 1 : 0, nowIso(), String(id));
    return getUser(id);
  }

  function disableTotp(id) {
    const existing = getUser(id);
    if (!existing) throw new Error('User not found');
    db.prepare(`UPDATE console_users SET totp_secret = '', totp_enabled = 0, updated_at = ? WHERE id = ?`)
      .run(nowIso(), String(id));
    db.prepare(`DELETE FROM console_user_backup_codes WHERE user_id = ?`).run(String(id));
    return getUser(id);
  }

  // Backup codes are stored as SHA-256 hashes, never plaintext. Caller is
  // responsible for generating the plaintext codes, showing them to the
  // user exactly once, and passing the hashes here.
  function replaceBackupCodes(userId, codeHashes = []) {
    const existing = getUser(userId);
    if (!existing) throw new Error('User not found');
    db.prepare(`DELETE FROM console_user_backup_codes WHERE user_id = ?`).run(String(userId));
    const insert = db.prepare(`
      INSERT INTO console_user_backup_codes (id, user_id, code_hash, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const timestamp = nowIso();
    for (const hash of codeHashes) {
      insert.run(crypto.randomUUID(), String(userId), String(hash), timestamp);
    }
    return countUnusedBackupCodes(userId);
  }

  function countUnusedBackupCodes(userId) {
    const row = db.prepare(`
      SELECT COUNT(*) AS n FROM console_user_backup_codes
      WHERE user_id = ? AND used_at = ''
    `).get(String(userId));
    return Number(row?.n || 0);
  }

  // Consumes a backup code by its hash (caller hashes the plaintext code
  // the user submitted, same algorithm used in replaceBackupCodes, and
  // passes the hash in). Returns true if it matched an unused code and
  // was consumed; false otherwise. Single-use is enforced by only
  // matching rows where used_at is still empty.
  function consumeBackupCode(userId, codeHash) {
    const row = db.prepare(`
      SELECT id FROM console_user_backup_codes
      WHERE user_id = ? AND code_hash = ? AND used_at = ''
    `).get(String(userId), String(codeHash));
    if (!row) return false;
    db.prepare(`UPDATE console_user_backup_codes SET used_at = ? WHERE id = ?`)
      .run(nowIso(), row.id);
    return true;
  }

  return {
    listUsers,
    getUser,
    getUserByEmail,
    createUser,
    updateUser,
    setUserActive,
    setPassword,
    recordLogin,
    countActiveByRole,
    setTotpSecret,
    setTotpEnabled,
    disableTotp,
    replaceBackupCodes,
    countUnusedBackupCodes,
    consumeBackupCode,
    close: () => db.close(),
  };
}

module.exports = { createUsersStore };
