#!/usr/bin/env node
const fs = require('node:fs');

const source = process.argv[2] || 'school-db-audit.jsonl';
if (!fs.existsSync(source)) {
  console.log('## School database audit\n\nNo audit output was produced. Check the workflow logs for SSH or host errors.');
  process.exit(0);
}
const rows = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean)
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line));
const count = (status) => rows.filter((row) => row.status === status).length;
const lines = [
  '## School database health audit',
  '',
  `Audited **${rows.length}** active instances: **${count('OK')} OK**, **${count('WARN')} warning**, **${rows.length - count('OK') - count('WARN')} failed/error**.`,
  '',
  '| School | Tier | Image | Status | Latest backup | Migrations | Schema | Key row counts |',
  '|---|---|---|---|---|---|---|---|',
];
for (const row of rows) {
  const migrations = row.migrations ? `${row.migrations.applied}/${row.migrations.expected} applied; ${row.migrations.pending} pending; ${row.migrations.failed} failed` : 'unavailable';
  const schema = row.schema ? `${row.schema.models} models; ${row.schema.missingTables} tables, ${row.schema.missingColumns} columns missing; ${row.schema.missingForeignKeys} FKs and ${row.schema.missingPrimaryOrUniqueIndexes} unique indexes missing` : 'unavailable';
  const counts = row.rowCounts ? Object.entries(row.rowCounts).map(([name, value]) => `${name}=${value}`).join(', ') : 'unavailable';
  lines.push(`| ${row.school} | ${row.tier || '—'} | ${row.image || '—'} | **${row.status}** | ${row.latestBackup || 'unknown'} | ${migrations} | ${schema} | ${counts} |`);
  const details = [...(row.issues?.critical || []), ...(row.issues?.warnings || []), ...(row.issues?.info || []), ...(row.error ? [row.error] : [])];
  for (const detail of details) lines.push(`  - **${row.school}:** ${detail}`);
}
lines.push('', 'This check does not change school databases. It compares the live schema and migration checksums to the deployed backend image, checks database constraints and known class-teacher backfill consistency, and reports aggregate row counts without exporting student or staff records.');
console.log(lines.join('\n'));
