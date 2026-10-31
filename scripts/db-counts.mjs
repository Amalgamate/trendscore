#!/usr/bin/env node
/**
 * Prints row counts and money sums for every table in a SQLite file.
 * Used as evidence for backup/restore proofs and migrations (L2C-0-01, L2C-1-02):
 * run it on the original and on the copy, the two outputs must be identical.
 *
 * Usage (from repo root):
 *   node --experimental-sqlite scripts/db-counts.mjs <path-to.sqlite> [--json]
 *
 * Opens the file read-only. Money columns are detected by name (contains
 * "ksh" or "amount") and summed as integers.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node --experimental-sqlite scripts/db-counts.mjs <path-to.sqlite> [--json]');
  process.exit(2);
}

const db = new DatabaseSync(file, { readOnly: true });
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

const out = {};
for (const t of tables) {
  const q = `"${t.replace(/"/g, '""')}"`;
  const rows = db.prepare(`SELECT COUNT(*) AS c FROM ${q}`).get().c;
  const sums = {};
  for (const col of db.prepare(`PRAGMA table_info(${q})`).all()) {
    if (/ksh|amount/i.test(col.name) && /INT|REAL|NUM/i.test(col.type || '')) {
      sums[col.name] = db.prepare(`SELECT COALESCE(SUM("${col.name}"), 0) AS s FROM ${q}`).get().s;
    }
  }
  out[t] = { rows, sums };
}
db.close();

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`File: ${file}\n`);
  for (const [t, v] of Object.entries(out)) {
    const s = Object.entries(v.sums).map(([k, n]) => `${k}=${n}`).join('  ');
    console.log(`${t.padEnd(34)} ${String(v.rows).padStart(7)} rows  ${s}`);
  }
}
