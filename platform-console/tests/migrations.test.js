'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations, listApplied } = require('../billing-migrate');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
  const db = new DatabaseSync(path.join(dir, 'test.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  return { dir, db };
}

function cleanup({ dir, db }) {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

const tableExists = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const migration = (version, name, up, extra = {}) => ({ version, name, notes: `Rollback for ${name}: drop what it created.`, up, ...extra });
const createTable = (name, columns = 'id INTEGER') => db => db.exec(`CREATE TABLE ${name} (${columns})`);

test('applies pending migrations in order and records version, name and checksum', () => {
  const env = setup();
  try {
    const result = runMigrations(env.db, {
      dataDir: env.dir,
      migrations: [migration(1, 'one', createTable('a')), migration(2, 'two', createTable('b'))],
    });
    assert.deepEqual(result.applied, [1, 2]);
    assert.ok(tableExists(env.db, 'a') && tableExists(env.db, 'b'));
    const rows = listApplied(env.db);
    assert.deepEqual(rows.map(r => [r.version, r.name]), [[1, 'one'], [2, 'two']]);
    assert.match(rows[0].checksum, /^[0-9a-f]{64}$/);
  } finally { cleanup(env); }
});

test('a second run applies nothing', () => {
  const env = setup();
  try {
    const migrations = [migration(1, 'one', createTable('a'))];
    runMigrations(env.db, { dataDir: env.dir, migrations });
    const again = runMigrations(env.db, { dataDir: env.dir, migrations });
    assert.deepEqual(again.applied, []);
    assert.equal(listApplied(env.db).length, 1);
  } finally { cleanup(env); }
});

test('a backup is taken before each migration and does not contain that migration', () => {
  const env = setup();
  try {
    const result = runMigrations(env.db, {
      dataDir: env.dir,
      migrations: [migration(1, 'one', createTable('a')), migration(2, 'two', createTable('b'))],
    });
    assert.equal(result.backups.length, 2);
    const backupDir = path.join(env.dir, 'billing-backups');
    const files = fs.readdirSync(backupDir);
    const before2 = files.find(f => f.startsWith('pre-migration-v2-'));
    assert.ok(before2, `expected a pre-migration-v2 backup in ${files.join(', ')}`);
    const copy = new DatabaseSync(path.join(backupDir, before2), { readOnly: true });
    try {
      assert.ok(tableExists(copy, 'a'), 'backup before v2 should hold the result of v1');
      assert.ok(!tableExists(copy, 'b'), 'backup before v2 must not hold the result of v2');
    } finally { copy.close(); }
  } finally { cleanup(env); }
});

test('a failing migration is rolled back, reported, and earlier ones stay applied', () => {
  const env = setup();
  try {
    const migrations = [
      migration(1, 'one', createTable('a')),
      migration(2, 'two', db => { db.exec('CREATE TABLE b (id INTEGER)'); throw new Error('boom'); }),
    ];
    assert.throws(() => runMigrations(env.db, { dataDir: env.dir, migrations }), /Migration 2 \(two\) failed: boom/);
    assert.ok(tableExists(env.db, 'a'));
    assert.ok(!tableExists(env.db, 'b'), 'the half-done change must be rolled back');
    assert.deepEqual(listApplied(env.db).map(r => r.version), [1]);
  } finally { cleanup(env); }
});

test('refuses to run when an already applied migration was edited', () => {
  const env = setup();
  try {
    // Use inline SQL (not the createTable closure) so the function's toString() actually differs.
    const original = [migration(1, 'one', db => db.exec('CREATE TABLE a (id INTEGER)'))];
    const edited   = [migration(1, 'one', db => db.exec('CREATE TABLE a (id INTEGER, extra TEXT)'))];
    runMigrations(env.db, { dataDir: env.dir, migrations: original });
    assert.throws(() => runMigrations(env.db, { dataDir: env.dir, migrations: edited }), /changed after it was applied/);
  } finally { cleanup(env); }
});

test('refuses to run against a database newer than this build', () => {
  const env = setup();
  try {
    const all = [migration(1, 'one', createTable('a')), migration(2, 'two', createTable('b'))];
    runMigrations(env.db, { dataDir: env.dir, migrations: all });
    assert.throws(() => runMigrations(env.db, { dataDir: env.dir, migrations: all.slice(0, 1) }), /newer than this build/);
  } finally { cleanup(env); }
});

test('rejects migrations without rollback notes, or with a gap in the numbering', () => {
  const env = setup();
  try {
    assert.throws(() => runMigrations(env.db, { migrations: [{ version: 1, name: 'x', up() {} }] }), /rollback notes/);
    assert.throws(() => runMigrations(env.db, { migrations: [migration(1, 'one', () => {}), migration(3, 'three', () => {})] }), /consecutive/);
  } finally { cleanup(env); }
});

test('a foreign key violation left by a migration is detected and rolled back', () => {
  const env = setup();
  try {
    const migrations = [
      migration(1, 'tables', db => {
        db.exec('CREATE TABLE p (id INTEGER PRIMARY KEY)');
        db.exec('CREATE TABLE c (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES p(id))');
      }),
      migration(2, 'orphan', db => db.exec('INSERT INTO c (id, p_id) VALUES (1, 99)'), { foreignKeys: false }),
    ];
    assert.throws(() => runMigrations(env.db, { dataDir: env.dir, migrations }), /foreign key/i);
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM c').get().n, 0);
    assert.equal(env.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'enforcement must be switched back on');
  } finally { cleanup(env); }
});

test('a table that other tables point to can be rebuilt safely (the invoice rebuild recipe)', () => {
  const env = setup();
  try {
    const migrations = [
      migration(1, 'tables', db => {
        db.exec('CREATE TABLE p (id INTEGER PRIMARY KEY)');
        db.exec('CREATE TABLE c (id INTEGER PRIMARY KEY, p_id INTEGER NOT NULL REFERENCES p(id) ON DELETE RESTRICT)');
        db.exec('INSERT INTO p (id) VALUES (1), (2)');
        db.exec('INSERT INTO c (id, p_id) VALUES (10, 1)');
      }),
      migration(2, 'rebuild p', db => {
        db.exec("CREATE TABLE p_new (id INTEGER PRIMARY KEY, label TEXT NOT NULL DEFAULT '')");
        db.exec('INSERT INTO p_new (id) SELECT id FROM p');
        db.exec('DROP TABLE p');
        db.exec('ALTER TABLE p_new RENAME TO p');
      }, { foreignKeys: false }),
    ];
    runMigrations(env.db, { dataDir: env.dir, migrations });
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM p').get().n, 2);
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM c').get().n, 1);
    assert.deepEqual(env.db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(env.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.throws(() => env.db.exec('INSERT INTO c (id, p_id) VALUES (11, 99)'), /FOREIGN KEY/i);
  } finally { cleanup(env); }
});
