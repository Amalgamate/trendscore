#!/usr/bin/env node
/** Build the universal TrendsCORE driver APK. */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'apps', 'driver_app');
const output = join(root, 'build', 'driver-apps');
const debug = process.argv.includes('--debug');
const dryRun = process.argv.includes('--dry-run');
const keystore = process.env.TRENDS_KEYSTORE_PATH;

if (!debug && !keystore) {
  console.error('Release builds require TRENDS_KEYSTORE_PATH and the release signing credentials. Use --debug for a debug APK.');
  process.exit(1);
}
if (!debug && !existsSync(keystore)) {
  console.error(`Keystore not found: ${keystore}`);
  process.exit(1);
}

const args = ['build', 'apk', debug ? '--debug' : '--release'];
const artifact = join(app, 'build', 'app', 'outputs', 'flutter-apk', debug ? 'app-debug.apk' : 'app-release.apk');
const destination = join(output, debug ? 'driver-debug.apk' : 'driver-release.apk');
console.log(`Building universal app id co.trendscore.driver (${debug ? 'debug' : 'release'})`);
if (dryRun) {
  console.log(`Would run: flutter ${args.join(' ')}`);
  console.log(`Would copy ${artifact} to ${destination}`);
  process.exit(0);
}

execFileSync('flutter', args, { cwd: app, stdio: 'inherit', env: process.env });
if (!existsSync(artifact)) throw new Error(`Flutter did not produce ${artifact}`);
mkdirSync(output, { recursive: true });
copyFileSync(artifact, destination);
console.log(`Created ${destination}`);
