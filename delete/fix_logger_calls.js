/**
 * Safe line-by-line patcher.
 * Only rewrites logger calls that fit entirely on ONE line.
 * Multiline calls are left untouched — they're already valid pino syntax.
 *
 * Fixes:
 *   logger.error('msg', err)   → logger.error({ err: err }, 'msg')
 *   logger.warn('msg', err)    → logger.warn({ err: err }, 'msg')
 *   logger.info('msg', val)    → logger.info({ data: val }, 'msg')
 *   logger.debug('msg', val)   → logger.debug({ data: val }, 'msg')
 */
const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

// Matches a complete single-line logger call with a string first arg and one extra arg.
// Group 1: level, Group 2: quote char, Group 3: message content, Group 4: trailing args
const LINE_RE = /logger\.(error|warn|info|debug)\((['`])([^'"`,]*)\2,\s*([^)]+)\)([;,]?)$/;

function processFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let changed = 0;

  const patched = lines.map((line) => {
    const m = line.match(LINE_RE);
    if (!m) return line;

    const [, level, quote, msg, secondArg, trailingPunct] = m;
    const trimmed = secondArg.trim();

    // Skip if already pino-style: starts with {
    if (trimmed.startsWith('{')) return line;

    // Determine obj key
    const isError = level === 'error' || level === 'warn';
    const key = isError ? 'err' : 'data';

    // Build new call
    const indent = line.match(/^(\s*)/)[1];
    const newCall = `logger.${level}({ ${key}: ${trimmed} }, ${quote}${msg}${quote})${trailingPunct}`;
    changed++;
    return `${indent}${newCall}`;
  });

  if (changed > 0) {
    fs.writeFileSync(filePath, patched.join('\n'), 'utf8');
    console.log(`Patched ${path.relative(__dirname, filePath)} — ${changed} lines fixed`);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.ts')) processFile(full);
  }
}

walk(controllersDir);
console.log('Done.');
