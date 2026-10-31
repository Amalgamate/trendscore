'use strict';
// L2C-1-19 — Notification service stub.
// In 'shadow' mode all events are logged with [SHADOW] prepended; nothing is sent.
// Phase 2 will replace emit() with real channel dispatching.

function createNotifyService(_db, { mode = 'live' } = {}) {
  const shadow = mode === 'shadow';
  return {
    emit(eventType, payload = {}) {
      const prefix = shadow ? '[SHADOW]' : '[NOTIFY]';
      console.log(`${prefix} ${eventType}`, JSON.stringify(payload));
    },
  };
}

module.exports = { createNotifyService };
