#!/usr/bin/env node
/**
 * Consistent online backup of a SQLite database (works while the console is running).
 * Uses VACUUM INTO, the same method as billingStore.backupNow(), then checks the copy.
 *
 * Usage:
 *   node --experimental-sqlite scripts/backup-db.mjs <source.sqlite> <destination.sqlite>
 *
 * Refuses to overwrite an existing destination. Prints size and integrity_check result.
 * Never writes to the source database.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('Usage: node --experimental-sqlite scripts/backup-db.mjs <source.sqlite> <destination.sqlite>');
  process.exit(2);
}
if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(2);
}
if (fs.existsSync(dest)) {
  console.error(`Destination already exists, refusing to overwrite: ${dest}`);
  process.exit(2);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });

const source = new DatabaseSync(src, { readOnly: true });
source.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
source.close();

const copy = new DatabaseSync(dest, { readOnly: true });
const integrity = copy.prepare('PRAGMA integrity_check').get().integrity_check;
const tables = copy.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'").get().c;
copy.close();

console.log(`Backup written: ${dest}`);
console.log(`Size: ${fs.statSync(dest).size} bytes, tables: ${tables}, integrity_check: ${integrity}`);
process.exit(integrity === 'ok' ? 0 : 1);
