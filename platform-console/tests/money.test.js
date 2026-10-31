'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toKES, addKES, formatKES, assertNoFloat } = require('../services/money');

test('toKES(10000) returns 10000', () => {
  assert.equal(toKES(10000), 10000);
});

test('toKES(10000.50) throws', () => {
  assert.throws(() => toKES(10000.50), TypeError);
});

test("toKES('abc') throws", () => {
  assert.throws(() => toKES('abc'), TypeError);
});

test('addKES(1000, 2000) returns 3000', () => {
  assert.equal(addKES(1000, 2000), 3000);
});

test("formatKES(115500) returns 'KSh 115,500'", () => {
  assert.equal(formatKES(115500), 'KSh 115,500');
});

test("assertNoFloat(10.5, 'amount') throws", () => {
  assert.throws(
    () => assertNoFloat(10.5, 'amount'),
    /amount must be a whole-shilling integer, got 10\.5/
  );
});
