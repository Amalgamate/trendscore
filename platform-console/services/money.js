'use strict';

// L2C-1-15 — Money utilities for KES (Kenya Shillings).
// All monetary values are integers representing whole shillings — KES has no cents.

/**
 * Assert val is a safe whole-shilling integer.
 * Throws TypeError if not.
 *
 * @param {*} val
 * @returns {number}
 */
function toKES(val) {
  if (typeof val !== 'number' || !Number.isSafeInteger(val) || val % 1 !== 0) {
    throw new TypeError(`Expected a whole-shilling integer, got ${val}`);
  }
  return val;
}

/**
 * Sum multiple KES amounts.
 *
 * @param {...number} amounts
 * @returns {number}
 */
function addKES(...amounts) {
  return amounts.reduce((sum, a) => sum + toKES(a), 0);
}

/**
 * Format a KES integer as a human-readable string.
 * e.g. formatKES(115500) → 'KSh 115,500'
 *
 * @param {number} n
 * @returns {string}
 */
function formatKES(n) {
  return 'KSh ' + n.toLocaleString('en-KE');
}

/**
 * Assert val has no fractional part; throw a descriptive error if it does.
 *
 * @param {number} val
 * @param {string} label
 */
function assertNoFloat(val, label) {
  if (val % 1 !== 0) {
    throw new TypeError(`${label} must be a whole-shilling integer, got ${val}`);
  }
}

module.exports = { toKES, addKES, formatKES, assertNoFloat };
