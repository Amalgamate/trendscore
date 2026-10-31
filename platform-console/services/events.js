'use strict';

// L2C-1-09 — Domain event store.
// Appends immutable domain events to the domain_events table.
// All DB operations are synchronous (node:sqlite DatabaseSync).

const crypto = require('node:crypto');

/**
 * Append a domain event.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ type: string, aggregateType?: string, aggregateId?: string,
 *           payload?: object, actor?: string, idempotencyKey?: string|null }} opts
 * @returns {object} The inserted row fields.
 */
function appendEvent(db, { type, aggregateType = '', aggregateId = '', payload = {}, actor = '', idempotencyKey }) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);
  // idempotencyKey may be undefined or null — store NULL in both cases.
  const ikey = (idempotencyKey == null) ? null : idempotencyKey;

  db.prepare(
    `INSERT INTO domain_events
       (id, type, aggregate_type, aggregate_id, payload, actor, created_at, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, type, aggregateType, aggregateId, payloadJson, actor, createdAt, ikey);

  return { id, type, aggregateType, aggregateId, payload: payloadJson, actor, createdAt, idempotencyKey: ikey };
}

const SYSTEM_ACTOR = 'system';

module.exports = { appendEvent, SYSTEM_ACTOR };
