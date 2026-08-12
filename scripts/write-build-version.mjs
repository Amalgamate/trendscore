import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function resolveCommit() {
  const suppliedCommit = process.env.BUILD_SHA?.trim();
  if (suppliedCommit) {
    return suppliedCommit.slice(0, 12);
  }

  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const version = `${resolveCommit()}-${Date.now()}`;

writeFileSync(
  'public/sw-version.js',
  `self.__TS_SW_VERSION__ = ${JSON.stringify(version)};\n`,
  'utf8'
);

writeFileSync(
  'public/version.json',
  `${JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2)}\n`,
  'utf8'
);

console.log(`[build] Service worker version: ${version}`);
