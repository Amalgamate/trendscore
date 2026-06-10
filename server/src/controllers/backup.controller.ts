import { Request, Response } from 'express';
import { execFile, execFileSync, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';

import logger from '../utils/logger';
import { PRODUCT_STORAGE_PREFIX } from '../config/productIdentity';
const execFileAsync = promisify(execFile);
const BACKUP_FILE_PREFIX = `${PRODUCT_STORAGE_PREFIX}_`;
const LEGACY_BACKUP_FILE_PREFIX = 'zawadi_sms_';
const BACKUP_FILE_PATTERN = new RegExp(`^(${BACKUP_FILE_PREFIX}|${LEGACY_BACKUP_FILE_PREFIX})[\\w-]+(\\.(sql|gz))+$`);
const BACKUP_DATE_PATTERN = new RegExp(`(?:${BACKUP_FILE_PREFIX}|${LEGACY_BACKUP_FILE_PREFIX})(\\d{4}-\\d{2}-\\d{2})_(\\d{2}-\\d{2}-\\d{2})`);

// ── Config ────────────────────────────────────────────────────────────────────
const BACKUP_DIR = path.resolve(process.cwd(), '..', 'backups', 'db');
const RETENTION_DAYS = 14;

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

function parseConnectionString(dbUrl: string) {
  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    throw new Error('Invalid database URL in DIRECT_URL / DATABASE_URL (not a valid URL).');
  }
  const database = url.pathname.replace(/^\//, '').split('?')[0];
  if (!database) {
    throw new Error('Database name missing in connection URL path.');
  }
  const sslmode = url.searchParams.get('sslmode') || undefined;
  return {
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    host: url.hostname,
    port: url.port || '5432',
    database,
    sslmode,
  };
}

/** pg_dump / psql read SSL mode from env; URL ?sslmode=require is not auto-applied to discrete -h/-p args. */
function buildPgToolEnv(conn: ReturnType<typeof parseConnectionString>, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, PGPASSWORD: conn.password };
  if (conn.sslmode) env.PGSSLMODE = conn.sslmode;
  return env;
}

/**
 * pg_dump needs a real server session, not a transaction pooler.
 * Prefer DIRECT_URL (Prisma directUrl); if only DATABASE_URL is pooled, fail with a clear message.
 */
function resolveBackupDatabaseUrl():
  | { ok: true; url: string }
  | { ok: false; error: string; status: number } {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return { ok: true, url: direct };

  const database = process.env.DATABASE_URL?.trim();
  if (!database) {
    return { ok: false, error: 'Set DATABASE_URL or DIRECT_URL in server/.env.', status: 500 };
  }

  const lower = database.toLowerCase();
  const looksPooled =
    lower.includes('pgbouncer=true') ||
    /:6543(\/|\?|$)/.test(lower);

  if (looksPooled) {
    return {
      ok: false,
      status: 400,
      error:
        'Backups require a direct Postgres URL. DATABASE_URL points at a pooler (often port 6543 or pgbouncer=true). Add DIRECT_URL in server/.env using your host direct or session connection string.',
    };
  }

  return { ok: true, url: database };
}

function listBackupFiles() {
  ensureBackupDir();
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => (f.startsWith(BACKUP_FILE_PREFIX) || f.startsWith(LEGACY_BACKUP_FILE_PREFIX)) && (f.endsWith('.sql.gz') || f.endsWith('.sql')))
    .map((f) => {
      const fp = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fp);
      // Parse date from current or legacy backup filename.
      const match = f.match(BACKUP_DATE_PATTERN);
      let createdAt = stat.mtime;
      if (match) {
        const [, datePart, timePart] = match;
        const isoStr = `${datePart}T${timePart.replace(/-/g, ':')}`;
        const parsed = new Date(isoStr);
        if (!Number.isNaN(parsed.getTime())) createdAt = parsed;
      }
      const createdMs = createdAt.getTime();
      const safeCreated = Number.isNaN(createdMs) ? new Date(stat.mtimeMs) : createdAt;
      return {
        id: f,
        filename: f,
        date: safeCreated.toLocaleString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        }),
        size: formatSize(stat.size),
        sizeBytes: stat.size,
        type: f.includes('_auto_') ? 'Auto' : 'Manual',
        createdAt: safeCreated.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return files;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(BACKUP_FILE_PREFIX) || f.startsWith(LEGACY_BACKUP_FILE_PREFIX));
  for (const f of files) {
    const fp = path.join(BACKUP_DIR, f);
    if (fs.statSync(fp).mtimeMs < cutoff) {
      fs.unlinkSync(fp);
    }
  }
}

/** Only cache successful paths so a later PATH / PGBIN fix works after restart (no stale null). */
const resolvedClientCache = new Map<'pg_dump' | 'psql', string>();

function postgresDirVersionScore(dirName: string): number {
  const m = dirName.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Typical Windows install: C:\Program Files\PostgreSQL\<ver>\bin\pg_dump.exe */
function findWindowsPostgresBin(tool: 'pg_dump' | 'psql'): string | null {
  const exe = tool === 'pg_dump' ? 'pg_dump.exe' : 'psql.exe';
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean) as string[];
  let best: { score: number; full: string } | null = null;
  for (const base of bases) {
    const root = path.join(base, 'PostgreSQL');
    if (!fs.existsSync(root)) continue;
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const full = path.join(root, ent.name, 'bin', exe);
      if (!fs.existsSync(full)) continue;
      const score = postgresDirVersionScore(ent.name);
      if (!best || score > best.score) best = { score, full };
    }
  }
  return best?.full ?? null;
}

/**
 * Resolve pg_dump / psql when Node inherits a minimal PATH (IDE terminals, PM2, etc.).
 * Override: PGBIN or PG_BIN (directory), or PG_DUMP / PSQL (full path to executable).
 */
function resolvePostgresClient(tool: 'pg_dump' | 'psql'): string | null {
  const hit = resolvedClientCache.get(tool);
  if (hit) return hit;

  const win = process.platform === 'win32';
  const exe = win ? (tool === 'pg_dump' ? 'pg_dump.exe' : 'psql.exe') : tool;

  const remember = (p: string) => {
    resolvedClientCache.set(tool, p);
    return p;
  };

  const pgBin = process.env.PGBIN || process.env.PG_BIN;
  if (pgBin) {
    const candidate = path.join(pgBin, exe);
    if (fs.existsSync(candidate)) return remember(candidate);
  }

  if (tool === 'pg_dump' && process.env.PG_DUMP && fs.existsSync(process.env.PG_DUMP)) {
    return remember(process.env.PG_DUMP);
  }
  if (tool === 'psql' && process.env.PSQL && fs.existsSync(process.env.PSQL)) {
    return remember(process.env.PSQL);
  }

  try {
    if (win) {
      const out = execSync(`where ${exe}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      const first = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return remember(first);
    } else {
      const out = execSync(`which ${tool}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (out) return remember(out);
    }
  } catch {
    /* not on PATH */
  }

  if (win) {
    const found = findWindowsPostgresBin(tool);
    if (found) return remember(found);
  }

  return null;
}

/** Cross-platform: pg_dump to temp .sql, then gzip with Node (no shell `| gzip` — breaks on Windows). */
async function pgDumpToGzipFile(
  pgDumpPath: string,
  outputGzipPath: string,
  conn: ReturnType<typeof parseConnectionString>,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const tmpSql = `${outputGzipPath}.wip.sql`;
  try {
    await execFileAsync(
      pgDumpPath,
      [
        '-h',
        conn.host,
        '-p',
        String(conn.port),
        '-U',
        conn.user,
        '-d',
        conn.database,
        '--no-password',
        '--format=plain',
        '--no-acl',
        '--no-owner',
        '-f',
        tmpSql,
      ],
      { env }
    );
    await pipeline(
      fs.createReadStream(tmpSql),
      zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }),
      fs.createWriteStream(outputGzipPath)
    );
  } catch (err: unknown) {
    try {
      if (fs.existsSync(outputGzipPath)) fs.unlinkSync(outputGzipPath);
    } catch {
      /* ignore */
    }
    const e = err as { stderr?: Buffer; message?: string };
    const stderr = e.stderr?.toString?.('utf8')?.trim();
    throw new Error(stderr || e.message || 'pg_dump or compression failed');
  } finally {
    try {
      if (fs.existsSync(tmpSql)) fs.unlinkSync(tmpSql);
    } catch {
      /* ignore */
    }
  }
}

async function restoreSqlFile(
  psqlPath: string,
  conn: ReturnType<typeof parseConnectionString>,
  filePath: string,
  isGzip: boolean,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const args = [
    '-h',
    conn.host,
    '-p',
    String(conn.port),
    '-U',
    conn.user,
    '-d',
    conn.database,
    '--no-password',
  ];

  if (!isGzip) {
    await execFileAsync(psqlPath, [...args, '-f', filePath], { env });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(psqlPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `psql exited with code ${code}`));
    });
    const input = fs.createReadStream(filePath);
    const gunzip = zlib.createGunzip();
    input.on('error', reject);
    gunzip.on('error', reject);
    input.pipe(gunzip).pipe(child.stdin!);
  });
}

// ── Controller ────────────────────────────────────────────────────────────────
export class BackupController {
  /**
   * GET /api/backup
   * Returns list of all backup files + summary stats
   */
  async listBackups(_req: Request, res: Response) {
    try {
      const backups = listBackupFiles();
      const lastBackup = backups[0] ?? null;
      res.json({
        success: true,
        data: {
          backups,
          total: backups.length,
          lastBackupDate: lastBackup?.createdAt ?? null,
          lastBackupFormatted: lastBackup?.date ?? 'Never',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/backup
   * Creates a new manual backup
   */
  async createBackup(req: Request, res: Response) {
    try {
      const resolvedDb = resolveBackupDatabaseUrl();
      if (!resolvedDb.ok) {
        return res.status(resolvedDb.status).json({ success: false, error: resolvedDb.error });
      }

      let conn: ReturnType<typeof parseConnectionString>;
      try {
        conn = parseConnectionString(resolvedDb.url);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid database URL';
        return res.status(500).json({ success: false, error: msg });
      }

      const pgDumpPath = resolvePostgresClient('pg_dump');
      if (!pgDumpPath) {
        return res.status(500).json({
          success: false,
          error:
            'pg_dump not found. Add PostgreSQL bin to PATH, or set PGBIN (e.g. C:\\Program Files\\PostgreSQL\\17\\bin) or PG_DUMP to the full path to pg_dump.exe.',
        });
      }

      try {
        execFileSync(pgDumpPath, ['--version'], { stdio: 'pipe' });
      } catch {
        return res.status(500).json({
          success: false,
          error: `pg_dump at "${pgDumpPath}" failed to run. Check PostgreSQL client install.`,
        });
      }

      ensureBackupDir();

      const timestamp = getTimestamp();
      const filename = `${BACKUP_FILE_PREFIX}${timestamp}.sql.gz`;
      const outputPath = path.join(BACKUP_DIR, filename);

      const env = buildPgToolEnv(conn, process.env);
      const t0 = Date.now();

      await pgDumpToGzipFile(pgDumpPath, outputPath, conn, env);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const stat = fs.statSync(outputPath);

      pruneOldBackups();

      const backup = {
        id: filename,
        filename,
        date: new Date().toLocaleString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        }),
        size: formatSize(stat.size),
        sizeBytes: stat.size,
        type: 'Manual',
        createdAt: new Date().toISOString(),
      };

      res.json({ success: true, data: backup, message: `Backup created in ${elapsed}s` });
    } catch (err: unknown) {
      const e = err as { message?: string; stderr?: Buffer | string };
      const stderr =
        typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString?.('utf8');
      const msg = (stderr && stderr.trim()) || e.message || 'Backup failed';
      logger.error('[backup] createBackup failed:', msg);
      res.status(500).json({ success: false, error: msg });
    }
  }

  /**
   * GET /api/backup/download/:filename
   * Streams a backup file to the client
   */
  async downloadBackup(req: Request, res: Response) {
    try {
      const { filename } = req.params;

      // Security: only allow valid backup filenames
      if (!BACKUP_FILE_PATTERN.test(filename)) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Backup file not found' });
      }

      const stat = fs.statSync(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Length', stat.size);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/backup/:filename
   * Deletes a specific backup file
   */
  async deleteBackup(req: Request, res: Response) {
    try {
      const { filename } = req.params;

      if (!BACKUP_FILE_PATTERN.test(filename)) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Backup file not found' });
      }

      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Backup deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/backup/restore
   * Restores from an uploaded .sql or .sql.gz file
   */
  async restoreBackup(req: Request, res: Response) {
    try {
      const resolvedDb = resolveBackupDatabaseUrl();
      if (!resolvedDb.ok) {
        return res.status(resolvedDb.status).json({ success: false, error: resolvedDb.error });
      }

      let conn: ReturnType<typeof parseConnectionString>;
      try {
        conn = parseConnectionString(resolvedDb.url);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid database URL';
        return res.status(500).json({ success: false, error: msg });
      }

      // File is expected to be uploaded via multipart (multer middleware)
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const filePath = file.path;
      const isGzip = file.originalname.endsWith('.gz');

      const psqlPath = resolvePostgresClient('psql');
      if (!psqlPath) {
        return res.status(500).json({
          success: false,
          error:
            'psql not found. Add PostgreSQL bin to PATH, or set PGBIN or PSQL to the full path to psql.exe.',
        });
      }

      const env = buildPgToolEnv(conn, process.env);

      const t0 = Date.now();
      await restoreSqlFile(psqlPath, conn, filePath, isGzip, env);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // Clean up temp upload
      fs.unlinkSync(filePath);

      res.json({ success: true, message: `Database restored successfully in ${elapsed}s` });
    } catch (err: unknown) {
      // Clean up temp file if it exists
      const file = (req as any).file;
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      const e = err as { message?: string; stderr?: Buffer | string };
      const stderr =
        typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString?.('utf8');
      const msg = (stderr && stderr.trim()) || e.message || 'Restore failed';
      logger.error('[backup] restoreBackup failed:', msg);
      res.status(500).json({ success: false, error: msg });
    }
  }
}
