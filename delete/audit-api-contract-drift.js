#!/usr/bin/env node
/**
 * API contract drift audit: frontend request paths vs backend mounts in
 * server/src/routes/index.ts (under /api).
 *
 * Default: print findings and exit 0 (warn mode).
 *   node scripts/audit-api-contract-drift.js
 * Strict CI:
 *   node scripts/audit-api-contract-drift.js --fail
 *
 * Output: JSON summary line + human-readable list.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const INDEX_FILE = path.join(ROOT, 'server', 'src', 'routes', 'index.ts');
const SCAN_DIRS = [path.join(ROOT, 'src')];

/** Paths that are not REST API calls (static, dev-only, or checked elsewhere). */
const IGNORE_PREFIXES = [
  '/@', // Vite
  '/logo',
  '/favicon',
  '/sw.js',
  '/manifest',
  '/assets/',
  '/public/',
];

function readMounts() {
  const src = fs.readFileSync(INDEX_FILE, 'utf8');
  const mounts = new Set();

  const useRe = /router\.use\(\s*'([^']+)'/g;
  let m;
  while ((m = useRe.exec(src)) !== null) {
    mounts.add(normalizeMount(m[1]));
  }

  const getRe = /router\.get\(\s*'([^']+)'/g;
  while ((m = getRe.exec(src)) !== null) {
    mounts.add(normalizeMount(m[1]));
  }

  return [...mounts].sort((a, b) => b.length - a.length);
}

function normalizeMount(p) {
  if (!p.startsWith('/')) return `/${p}`;
  return p.replace(/\/+$/, '') || '/';
}

/**
 * Strip duplicate /api if present (some legacy code uses `/api/...` with base already /api).
 */
function normalizeRequestPath(p) {
  let s = p.trim();
  if (!s.startsWith('/')) s = `/${s}`;
  const q = s.indexOf('?');
  if (q !== -1) s = s.slice(0, q);
  while (s.startsWith('/api/')) s = s.slice(4) || '/';
  return s.replace(/\/+$/, '') || '/';
}

function isIgnoredPath(p) {
  const n = normalizeRequestPath(p);
  if (n === '/') return true;
  return IGNORE_PREFIXES.some((pre) => n === pre || n.startsWith(pre));
}

function pathCoveredByMounts(reqPath, mounts) {
  const p = normalizeRequestPath(reqPath);
  if (p === '/' || isIgnoredPath(p)) return true;
  return mounts.some((mount) => p === mount || p.startsWith(`${mount}/`));
}

function walkJsFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'build' || name === 'dist') continue;
      walkJsFiles(full, out);
    } else if (/\.(jsx?|tsx?)$/.test(name)) {
      out.push(full);
    }
  }
}

/**
 * Extract static path literals from API-style calls (best-effort).
 */
function extractPathsFromFile(content, filePath) {
  const found = [];
  /** Exclude `$` so `/classes${queryString}` yields `/classes` only. */
  const pathCap = '(\\/[^`\'"?$\\n]+)';
  const patterns = [
    new RegExp(`fetchWithAuth\\(\\s*[\`'"]${pathCap}`, 'g'),
    new RegExp(
      `fetchCached\\(\\s*[^,]+,\\s*\\(\\)\\s*=>\\s*fetchWithAuth\\(\\s*[\`'"]${pathCap}`,
      'g'
    ),
    new RegExp(`axiosInstance\\.(?:get|post|put|delete|patch)\\(\\s*[\`'"]${pathCap}`, 'g'),
    new RegExp(`axios\\.(?:get|post|put|delete|patch)\\(\\s*[\`'"]${pathCap}`, 'g'),
    new RegExp(`api\\.(?:get|post|put|delete|patch)\\(\\s*[\`'"]${pathCap}`, 'g'),
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const raw = m[1];
      if (!raw || raw.length < 2) continue;
      found.push({ path: raw, file: path.relative(ROOT, filePath) });
    }
  }

  return found;
}

function main() {
  const fail = process.argv.includes('--fail');
  const jsonOut = process.argv.includes('--json');

  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`Missing ${INDEX_FILE}`);
    process.exit(fail ? 1 : 0);
  }

  const mounts = readMounts();
  const files = [];
  for (const d of SCAN_DIRS) walkJsFiles(d, files);

  const allRefs = [];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    allRefs.push(...extractPathsFromFile(content, f));
  }

  const uncovered = [];
  const seen = new Set();
  for (const { path: reqPath, file } of allRefs) {
    if (isIgnoredPath(reqPath)) continue;
    if (!pathCoveredByMounts(reqPath, mounts)) {
      const key = `${reqPath}::${file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uncovered.push({ path: reqPath, file });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    indexFile: path.relative(ROOT, INDEX_FILE),
    mountCount: mounts.length,
    scannedFiles: files.length,
    referenceSamples: allRefs.length,
    uncoveredCount: uncovered.length,
    uncovered,
    mounts,
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[api-contract-drift] mounts=${mounts.length} scannedFiles=${files.length} refs≈${allRefs.length} uncovered=${uncovered.length}`
    );
    if (uncovered.length) {
      console.log('\nPaths not matching any backend mount prefix:');
      for (const u of uncovered) {
        console.log(`  ${u.path}  (${u.file})`);
      }
      console.log('\nWarn mode: exiting 0. Use --fail to fail CI.');
    } else {
      console.log('No drift detected.');
    }
  }

  const outPath = path.join(ROOT, 'tmp', 'contract-drift-report.json');
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    if (!jsonOut) console.log(`\nWrote ${path.relative(ROOT, outPath)}`);
  } catch (e) {
    console.warn('Could not write report file:', e.message);
  }

  process.exit(fail && uncovered.length ? 1 : 0);
}

main();
