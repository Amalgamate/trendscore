'use strict';

// L2C-1-10 — Append-only audit chain with SHA-256 hash linkage.
// Each row commits to the previous row's hash, so any tampering breaks the chain.
// All DB operations are synchronous (node:sqlite DatabaseSync).

const crypto = require('node:crypto');

/**
 * Compute the row_hash for an audit event.
 * Input: prev_hash + event_type + aggregate_id + actor + payload (JSON string) + created_at
 */
function computeHash(prevHash, eventType, aggregateId, actor, payloadStr, createdAt) {
  return crypto.createHash('sha256')
    .update(prevHash + eventType + aggregateId + actor + payloadStr + createdAt)
    .digest('hex');
}

/**
 * Append an audit event to the chain.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ eventType: string, aggregateType?: string, aggregateId?: string,
 *           actor?: string, payload?: object }} opts
 * @returns {object} The inserted row.
 */
function appendAuditEvent(db, { eventType, aggregateType = '', aggregateId = '', actor = '', payload = {} }) {
  const createdAt = new Date().toISOString();
  const payloadStr = JSON.stringify(payload);

  // Get the last row's hash to chain from.
  const lastRow = db.prepare('SELECT row_hash FROM audit_events ORDER BY id DESC LIMIT 1').get();
  const prevHash = lastRow ? lastRow.row_hash : '';

  const rowHash = computeHash(prevHash, eventType, aggregateId, actor, payloadStr, createdAt);

  const result = db.prepare(
    `INSERT INTO audit_events
       (event_type, aggregate_type, aggregate_id, actor, payload, created_at, prev_hash, row_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(eventType, aggregateType, aggregateId, actor, payloadStr, createdAt, prevHash, rowHash);

  return {
    id: result.lastInsertRowid,
    eventType,
    aggregateType,
    aggregateId,
    actor,
    payload: payloadStr,
    createdAt,
    prevHash,
    rowHash,
  };
}

/**
 * Verify the integrity of the entire audit chain.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ ok: boolean, firstBadId: number|null }}
 */
function verifyChain(db) {
  const rows = db.prepare('SELECT * FROM audit_events ORDER BY id').all();

  for (const row of rows) {
    const expected = computeHash(row.prev_hash, row.event_type, row.aggregate_id, row.actor, row.payload, row.created_at);
    if (expected !== row.row_hash) {
      return { ok: false, firstBadId: row.id };
    }
  }

  return { ok: true, firstBadId: null };
}

module.exports = { appendAuditEvent, verifyChain };
