'use strict';
// L2C-1-17 — Feature flag reads/writes via the feature_flags table.
// Reads are per-request — no global cache to avoid stale reads across instances.

/**
 * Returns boolean for a flag. Returns false if the flag doesn't exist. Never throws.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} name
 * @returns {boolean}
 */
function getFlag(db, name) {
  try {
    const row = db.prepare('SELECT enabled FROM feature_flags WHERE name = ?').get(name);
    return row ? Boolean(row.enabled) : false;
  } catch {
    return false;
  }
}

/**
 * Upserts a flag. Creates it if it doesn't exist, updates if it does.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} name
 * @param {boolean} enabled
 * @param {string} actor
 */
function setFlag(db, name, enabled, actor) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO feature_flags (name, enabled, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       enabled    = excluded.enabled,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).run(name, enabled ? 1 : 0, now, actor || 'system');
}

/**
 * Returns all rows from feature_flags, with enabled coerced to boolean.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {Array<{name:string, enabled:boolean, description:string, updated_at:string, updated_by:string}>}
 */
function listFlags(db) {
  return db.prepare(
    'SELECT name, enabled, description, updated_at, updated_by FROM feature_flags ORDER BY name'
  ).all().map(row => ({ ...row, enabled: Boolean(row.enabled) }));
}

module.exports = { getFlag, setFlag, listFlags };
