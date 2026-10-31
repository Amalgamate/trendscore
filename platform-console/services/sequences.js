'use strict';

// L2C-1-04 — Number sequence allocator.
// Allocates unique, consecutive, gap-free numbers per (prefix, year).
// All DB operations are synchronous (node:sqlite DatabaseSync).

const ALLOWED_PREFIXES = new Set(['INV', 'CN', 'RCT', 'QTE']);

/**
 * Allocate the next number for the given prefix and year.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} prefix  - one of INV, CN, RCT, QTE
 * @param {number} year    - four-digit year, e.g. 2026
 * @returns {string}  e.g. 'INV-2026-000001'
 */
function allocateNumber(db, prefix, year) {
  if (!ALLOWED_PREFIXES.has(prefix)) {
    throw new Error(`Unknown sequence prefix '${prefix}'. Allowed: ${[...ALLOWED_PREFIXES].join(', ')}.`);
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    // If the row doesn't exist yet, insert with last_seq = 0.
    db.prepare(
      'INSERT OR IGNORE INTO number_sequences (prefix, year, last_seq) VALUES (?, ?, 0)'
    ).run(prefix, year);

    // If the year rolled over, reset last_seq to 0 for the new year.
    db.prepare(
      'UPDATE number_sequences SET year = ?, last_seq = 0 WHERE prefix = ? AND year < ?'
    ).run(year, prefix, year);

    // Increment.
    db.prepare(
      'UPDATE number_sequences SET last_seq = last_seq + 1 WHERE prefix = ? AND year = ?'
    ).run(prefix, year);

    const row = db.prepare(
      'SELECT last_seq FROM number_sequences WHERE prefix = ? AND year = ?'
    ).get(prefix, year);

    db.exec('COMMIT');
    return `${prefix}-${year}-${String(row.last_seq).padStart(6, '0')}`;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* no open tx */ }
    throw err;
  }
}

module.exports = { allocateNumber };
