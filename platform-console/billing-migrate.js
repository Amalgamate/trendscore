'use strict';

// Versioned migration runner for the platform billing database (L2C-1-01).
//
// A migration is { version, name, notes, up(db), foreignKeys? }:
//   version      consecutive integers starting at 1
//   name         short label, stored with the record
//   notes        how to undo it by hand (required, "down" notes for the runbook)
//   up(db)       does the change using the open DatabaseSync handle; it runs inside BEGIN IMMEDIATE
//   foreignKeys  set to false for table rebuilds: enforcement is switched off for the run,
//                PRAGMA foreign_key_check must come back empty before COMMIT, then enforcement is restored
//
// Safety rules, enforced here:
//   - a consistent backup (VACUUM INTO) is written before every migration when dataDir is given
//   - each migration is one transaction: on any error everything it did is rolled back and an error is thrown
//     (the caller must let it stop the console from starting)
//   - an applied migration whose code changed afterwards, or a database newer than this build, stops the run

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function checksum(migration) {
  return crypto.createHash('sha256').update(`${migration.version}:${migration.name}:${migration.up.toString()}`).digest('hex');
}

function validate(migrations) {
  migrations.forEach((m, index) => {
    if (!Number.isInteger(m.version)) throw new Error(`Migration at position ${index + 1} has no integer version`);
    if (m.version !== index + 1) throw new Error(`Migration versions must be consecutive from 1 (found ${m.version} at position ${index + 1})`);
    if (typeof m.name !== 'string' || !m.name.trim()) throw new Error(`Migration ${m.version} needs a name`);
    if (typeof m.notes !== 'string' || !m.notes.trim()) throw new Error(`Migration ${m.version} (${m.name}) needs rollback notes`);
    if (typeof m.up !== 'function') throw new Error(`Migration ${m.version} (${m.name}) needs an up(db) function`);
  });
}

function listApplied(db) {
  return db.prepare('SELECT version, name, checksum, applied_at AS appliedAt FROM schema_migrations ORDER BY version').all();
}

function backupBeforeMigration(db, dataDir, migration) {
  if (!dataDir) return null;
  const backupDir = path.join(dataDir, 'billing-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre-migration-v${migration.version}-${stamp}.sqlite`);
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  return backupPath;
}

function runMigrations(db, { migrations, dataDir = '', log = () => {} }) {
  validate(migrations);

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const applied = listApplied(db);
  const known = new Map(migrations.map(m => [m.version, m]));

  for (const row of applied) {
    const migration = known.get(row.version);
    if (!migration) {
      throw new Error(`The database is newer than this build: migration ${row.version} (${row.name}) is applied but unknown here. Deploy a newer build or restore a backup.`);
    }
    if (checksum(migration) !== row.checksum) {
      throw new Error(`Migration ${row.version} (${row.name}) changed after it was applied. Never edit an applied migration; add a new one.`);
    }
  }

  const appliedVersions = new Set(applied.map(r => r.version));
  const result = { applied: [], backups: [] };

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;

    const backupPath = backupBeforeMigration(db, dataDir, migration);
    if (backupPath) result.backups.push(backupPath);

    const enforcementWasOn = Number(db.prepare('PRAGMA foreign_keys').get().foreign_keys) === 1;
    if (migration.foreignKeys === false && enforcementWasOn) db.exec('PRAGMA foreign_keys = OFF');

    try {
      db.exec('BEGIN IMMEDIATE');
      migration.up(db);
      const violations = db.prepare('PRAGMA foreign_key_check').all();
      if (violations.length) throw new Error(`foreign key check found ${violations.length} violation(s), first in table ${violations[0].table}`);
      db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
        .run(migration.version, migration.name, checksum(migration), new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* no open transaction */ }
      const where = backupPath ? ` Backup taken before it: ${backupPath}.` : '';
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${error.message}. Nothing from it was kept.${where}`);
    } finally {
      if (migration.foreignKeys === false && enforcementWasOn) db.exec('PRAGMA foreign_keys = ON');
    }

    result.applied.push(migration.version);
    log(`migration ${migration.version} (${migration.name}) applied`);
  }

  return result;
}

module.exports = { runMigrations, listApplied };
