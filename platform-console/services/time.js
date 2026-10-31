'use strict';

// L2C-1-15 — Time utilities.
// Uses Intl.DateTimeFormat with 'en-CA' locale for YYYY-MM-DD formatting in Africa/Nairobi.
// Pattern mirrors the todayNairobi() already in billing-store.js.

/**
 * Current UTC instant as ISO 8601 string.
 * @returns {string} e.g. '2026-01-30T14:22:01.000Z'
 */
function nowUtc() {
  return new Date().toISOString();
}

/**
 * Today's date in the Africa/Nairobi timezone, formatted as YYYY-MM-DD.
 * 'en-CA' locale gives the YYYY-MM-DD layout.
 * @returns {string} e.g. '2026-01-30'
 */
function todayNairobi() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}

/**
 * Convert a UTC ISO string to a YYYY-MM-DD date in the Africa/Nairobi timezone.
 * @param {string} utcIso - ISO 8601 UTC string
 * @returns {string} e.g. '2026-01-30'
 */
function toNairobi(utcIso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(utcIso));
}

module.exports = { nowUtc, todayNairobi, toNairobi };
