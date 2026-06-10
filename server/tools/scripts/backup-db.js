#!/usr/bin/env node
/**
 * ============================================================
 * TrendScore — Automated Database Backup Script
 * ============================================================
 *
 * Creates a gzip-compressed PostgreSQL dump and saves it to
 * <project_root>/backups/db/
 *
 * Filename format:
 *   Manual : trendscore_2026-03-24_02-00-00.sql.gz
 *   Auto   : trendscore_auto_2026-03-24_02-00-00.sql.gz
 *             ↑ The UI shows "Auto" badge when "_auto_" is in the name
 *
 * ── Quick start ───────────────────────────────────────────────
 *   node tools/scripts/backup-db.js              # manual, compressed
 *   node tools/scripts/backup-db.js --no-gzip   # manual, plain SQL
 *   node tools/scripts/backup-db.js --auto      # mark as automatic run
 *
 * ── Schedule (Linux / macOS cron) ────────────────────────────
 *   Open crontab:
 *     crontab -e
 *
 *   Add this line — runs every day at 02:00 AM:
 *     0 2 * * * cd /FULL/PATH/TO/server && node tools/scripts/backup-db.js --auto >> logs/backup.log 2>&1
 *
 *   Make sure the logs directory exists:
 *     mkdir -p /FULL/PATH/TO/server/logs
 *
 * ── Schedule (Windows Task Scheduler) ────────────────────────
 *   1. Open Task Scheduler → Create Basic Task
 *   2. Trigger: Daily at 02:00 AM
 *   3. Action: Start a Program
 *        Program : node
 *        Arguments: tools\scripts\backup-db.js --auto
 *        Start in : C:\path\to\TrendScore\server
 *   4. Finish and enable the task.
 *
 * ── pm2 (if you run the server with pm2) ─────────────────────
 *   Add to ecosystem.config.js:
 *     {
 *       name: 'trendscore-backup',
 *       script: 'tools/scripts/backup-db.js',
 *       args: '--auto',
 *       cron_restart: '0 2 * * *',
 *       watch: false,
 *       autorestart: false,
 *     }
 *
 * ── Requirements ─────────────────────────────────────────────
 *   • pg_dump must be installed and in PATH
 *       Ubuntu/Debian : sudo apt-get install postgresql-client
 *       macOS         : brew install libpq && brew link --force libpq
 *       Windows       : included with PostgreSQL install; add bin/ to PATH
 *   • gzip must be available (built-in on Linux/macOS;
 *     on Windows install Git for Windows or use WSL)
 * ============================================================
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKUP_FILE_PREFIX = 'trendscore_';
const LEGACY_BACKUP_FILE_PREFIX = 'zawadi_sms_';

// ── Configuration ─────────────────────────────────────────────────────────────
const config = {
  // Resolves to <project_root>/backups/db  (one level above /server)
  backupDir: path.resolve(__dirname, '../../backups/db'),

  // Delete backups older than this many days (0 = keep forever)
  retentionDays: 14,

  // Compress with gzip? Pass --no-gzip to disable.
  useGzip: !process.argv.includes('--no-gzip'),

  // Tag filename as an automatic backup? Pass --auto flag.
  isAuto: process.argv.includes('--auto'),

  // Override the DB URL here if you don't want to read from .env
  databaseUrl: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  // Write to stdout with timestamp — redirect to a log file in cron
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

/** Minimal .env parser — no external dependencies needed */
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    log('Note: No .env file found — relying on process environment variables.');
    return;
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Don't overwrite variables already set in the process environment
    if (!process.env[key]) process.env[key] = value;
  }
}

/** Parse a postgres:// connection string */
function parseConnectionString(dbUrl) {
  try {
    const url = new URL(dbUrl);
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, '').split('?')[0],
    };
  } catch (e) {
    throw new Error(`Invalid DATABASE_URL: ${e.message}`);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created backup directory: ${dir}`);
  }
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

function checkTool(tool) {
  try {
    execSync(`${tool} --version`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Delete backup files older than retentionDays */
function pruneOldBackups(dir, retentionDays) {
  if (retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs
    .readdirSync(dir)
    .filter((f) => (f.startsWith(BACKUP_FILE_PREFIX) || f.startsWith(LEGACY_BACKUP_FILE_PREFIX)) && (f.endsWith('.sql') || f.endsWith('.sql.gz')));

  let pruned = 0;
  for (const file of files) {
    const fp = path.join(dir, file);
    if (fs.statSync(fp).mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      log(`Pruned: ${file}`);
      pruned++;
    }
  }
  if (pruned === 0) log('Pruning: nothing to remove.');
  else log(`Pruning: removed ${pruned} old backup(s).`);
}

/** Print a summary of what is in the backup folder */
function printSummary(dir) {
  const all = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_FILE_PREFIX) || f.startsWith(LEGACY_BACKUP_FILE_PREFIX))
    .sort()
    .reverse();

  log(`Backup folder now contains ${all.length} file(s):`);
  for (const f of all.slice(0, 8)) {
    const size = (fs.statSync(path.join(dir, f)).size / 1024 / 1024).toFixed(2);
    log(`  • ${f}  (${size} MB)`);
  }
  if (all.length > 8) log(`  ... and ${all.length - 8} more`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(function runBackup() {
  log('======== TrendScore — Database Backup ========');
  log(`Mode: ${config.isAuto ? 'AUTOMATIC (scheduled)' : 'MANUAL'}`);

  // 1. Load .env
  loadEnv();

  // 2. Resolve database URL — prefer DIRECT_URL for local pg_dump (no connection pooler)
  const dbUrl = config.databaseUrl || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    log('ERROR: No DATABASE_URL or DIRECT_URL found. Cannot connect to the database.');
    process.exit(1);
  }

  const conn = parseConnectionString(dbUrl);
  log(`Database  : ${conn.host}:${conn.port}/${conn.database}`);
  log(`DB user   : ${conn.user}`);
  log(`Compress  : ${config.useGzip ? 'yes (gzip)' : 'no (plain SQL)'}`);
  log(`Backup dir: ${config.backupDir}`);
  log(`Retention : ${config.retentionDays} days`);

  // 3. Verify pg_dump is available
  if (!checkTool('pg_dump')) {
    log('ERROR: pg_dump not found in PATH.');
    log('  Ubuntu/Debian : sudo apt-get install postgresql-client');
    log('  macOS         : brew install libpq && brew link --force libpq');
    log('  Windows       : Add PostgreSQL bin folder to PATH');
    log('                  e.g. C:\\Program Files\\PostgreSQL\\16\\bin');
    process.exit(1);
  }

  // 4. If gzip mode, verify gzip is available
  if (config.useGzip && !checkTool('gzip')) {
    log('ERROR: gzip not found in PATH.');
    log('  Windows: Install Git for Windows (includes gzip), or use WSL.');
    log('  Alternatively run with --no-gzip to skip compression.');
    process.exit(1);
  }

  // 5. Ensure backup directory exists
  ensureDir(config.backupDir);

  // 6. Build filename
  const ts = getTimestamp();
  const tag = config.isAuto ? 'auto_' : '';
  const filename = config.useGzip
    ? `${BACKUP_FILE_PREFIX}${tag}${ts}.sql.gz`
    : `${BACKUP_FILE_PREFIX}${tag}${ts}.sql`;
  const outputPath = path.join(config.backupDir, filename);

  // 7. Build pg_dump command
  // PGPASSWORD env var avoids interactive password prompt
  const env = { ...process.env, PGPASSWORD: conn.password };

  const pgDump =
    `pg_dump` +
    ` -h ${conn.host}` +
    ` -p ${conn.port}` +
    ` -U ${conn.user}` +
    ` -d ${conn.database}` +
    ` --no-password` +
    ` --format=plain` +
    ` --no-acl` +
    ` --no-owner`;

  const cmd = config.useGzip
    ? `${pgDump} | gzip > "${outputPath}"`
    : `${pgDump} --file="${outputPath}"`;

  // 8. Execute
  log(`Starting dump → ${filename}`);
  const t0 = Date.now();

  try {
    execSync(cmd, { env, stdio: 'pipe', shell: true });
  } catch (err) {
    log(`ERROR: pg_dump failed — ${err.message}`);
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    if (stderr) log(`  stderr: ${stderr}`);
    // Remove empty/partial output file if it was created
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    process.exit(1);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  log(`✅ Backup complete: ${filename}  (${sizeMB} MB in ${elapsed}s)`);

  // 9. Prune old backups
  pruneOldBackups(config.backupDir, config.retentionDays);

  // 10. Summary
  printSummary(config.backupDir);

  log('======== Backup Done ========');
})();
