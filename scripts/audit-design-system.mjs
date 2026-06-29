#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const shouldFail = args.has('--fail');
const maxExamples = Number.parseInt([...args].find((arg) => arg.startsWith('--max='))?.split('=')[1] || '12', 10);

const includeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const scanRoots = ['src'];
const extraFiles = ['tailwind.config.js', 'index.html'];

const ignoredPathParts = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}build${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}coverage${path.sep}`,
];

const allowTokenPaths = [
  path.normalize('src/design-system/colors.ts'),
  path.normalize('src/design-system/tokens.ts'),
  path.normalize('src/design-system/typography.css'),
  path.normalize('src/design-system/radius.ts'),
  path.normalize('src/design-system/spacing.ts'),
  path.normalize('src/index.css'),
  path.normalize('tailwind.config.js'),
];

const allowReportOrPrintPaths = [
  path.normalize('src/utils/simplePdfGenerator.js'),
  path.normalize('src/styles/receipt-print.css'),
];

const duplicateComponentNames = [
  'Button',
  'Card',
  'Input',
  'Select',
  'Textarea',
  'Toast',
  'EmptyState',
  'StatusBadge',
  'StatsCard',
  'KpiCard',
  'Skeleton',
  'Pagination',
  'SearchFilter',
  'SearchBar',
  'Table',
];

const canonicalComponentDefinitions = new Map([
  ['Button', [path.normalize('src/components/ui/button.jsx')]],
  ['Card', [path.normalize('src/components/ui/card.jsx')]],
  ['Input', [path.normalize('src/components/ui/input.jsx')]],
  ['Select', [path.normalize('src/components/ui/select.jsx')]],
  ['Textarea', [path.normalize('src/components/ui/textarea.jsx')]],
  ['Skeleton', [path.normalize('src/components/ui/skeleton.jsx')]],
  ['EmptyState', [path.normalize('src/design-system/components/EmptyState.tsx')]],
  ['KpiCard', [path.normalize('src/design-system/components/KpiCard.tsx')]],
  ['Table', [path.normalize('src/components/ui/table.jsx')]],
]);

const checks = [
  {
    id: 'hardcoded-colors',
    label: 'Hardcoded colors outside token/global style files',
    severity: 'warn',
    pattern: /#[0-9a-fA-F]{3,8}\b|rgba?\([^)\n]+\)/g,
    skip: (rel) => allowTokenPaths.includes(rel) || allowReportOrPrintPaths.includes(rel),
  },
  {
    id: 'arbitrary-tailwind',
    label: 'Arbitrary Tailwind values that may need tokens',
    severity: 'warn',
    pattern: /\b(?:text|bg|border|rounded|shadow|p|px|py|m|mx|my|gap|w|h|min-w|max-w|min-h|max-h|top|right|bottom|left|translate-x|translate-y|grid-cols)-\[[^\]\n]+\]/g,
    skip: (rel) => allowReportOrPrintPaths.includes(rel),
  },
  {
    id: 'inline-style',
    label: 'Inline style props outside token/global/report contexts',
    severity: 'warn',
    pattern: /\bstyle=\{\{/g,
    skip: (rel) => rel.startsWith(path.normalize('src/design-system/components')) || allowReportOrPrintPaths.includes(rel),
  },
  {
    id: 'raw-checkbox-radio',
    label: 'Raw checkbox/radio controls outside primitives',
    severity: 'warn',
    pattern: /type=["'](?:checkbox|radio)["']/g,
    skip: (rel) => rel.startsWith(path.normalize('src/design-system')) || rel.startsWith(path.normalize('src/components/ui')),
  },
  {
    id: 'shadow-utilities',
    label: 'Shadow utilities in app code',
    severity: 'info',
    pattern: /\bshadow(?:-(?:sm|md|lg|xl|2xl|inner|\[[^\]]+\]))?\b/g,
    skip: (rel) => allowTokenPaths.includes(rel) || allowReportOrPrintPaths.includes(rel),
  },
  {
    id: 'local-skeletons',
    label: 'Local skeleton/loading placeholder patterns',
    severity: 'info',
    pattern: /\b(?:function|const)\s+Skeleton\b|\bSkeletonCard\b|\banimate-pulse\b/g,
    skip: (rel) => rel.startsWith(path.normalize('src/design-system')) || rel.startsWith(path.normalize('src/components/ui')),
  },
  {
    id: 'local-toasts',
    label: 'Toast patterns outside the intended notification layer',
    severity: 'info',
    pattern: /\breact-hot-toast\b|\btoast\.(?:success|error|loading|dismiss)\b|<Toast\b/g,
    skip: (rel) => rel === path.normalize('src/App.jsx') || rel.startsWith(path.normalize('src/design-system')),
  },
];

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignoredPathParts.some((part) => full.includes(part))) continue;
    if (entry.isDirectory()) {
      walk(full, output);
      continue;
    }
    if (includeExtensions.has(path.extname(entry.name))) {
      output.push(full);
    }
  }
  return output;
}

function lineForIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function normalizedRelative(file) {
  return path.relative(root, file).replaceAll('/', path.sep);
}

const files = [
  ...scanRoots.flatMap((scanRoot) => walk(path.join(root, scanRoot))),
  ...extraFiles.map((file) => path.join(root, file)).filter((file) => fs.existsSync(file)),
];

const results = checks.map((check) => ({
  ...check,
  count: 0,
  files: new Map(),
  examples: [],
}));

const componentDefinitions = new Map();

for (const file of files) {
  const rel = normalizedRelative(file);
  const content = fs.readFileSync(file, 'utf8');

  for (const result of results) {
    if (result.skip?.(rel)) continue;
    for (const match of content.matchAll(result.pattern)) {
      const line = lineForIndex(content, match.index ?? 0);
      result.count += 1;
      result.files.set(rel, (result.files.get(rel) || 0) + 1);
      if (result.examples.length < maxExamples) {
        result.examples.push({ file: rel, line, value: match[0] });
      }
    }
  }

  for (const name of duplicateComponentNames) {
    const definitionPattern = new RegExp(`\\b(?:function|const)\\s+${name}\\b|\\bexport\\s+const\\s+${name}\\b`, 'g');
    for (const match of content.matchAll(definitionPattern)) {
      const line = lineForIndex(content, match.index ?? 0);
      const entries = componentDefinitions.get(name) || [];
      entries.push({ file: rel, line });
      componentDefinitions.set(name, entries);
    }
  }
}

const duplicateDefinitions = [...componentDefinitions.entries()]
  .map(([name, definitions]) => {
    const canonicalPaths = canonicalComponentDefinitions.get(name) || [];
    const nonCanonicalDefinitions = definitions.filter((definition) => !canonicalPaths.includes(definition.file));
    return { name, definitions: nonCanonicalDefinitions };
  })
  .filter(({ definitions }) => definitions.length > 1);

const totalWarnings = results
  .filter((result) => result.severity === 'warn')
  .reduce((sum, result) => sum + result.count, 0);

console.log('TrendSCORE Design System Audit');
console.log('================================');
console.log(`Files scanned: ${files.length}`);
console.log(`Mode: ${shouldFail ? 'fail on warnings' : 'report only'}`);
console.log('');

for (const result of results) {
  const status = result.count ? result.severity.toUpperCase() : 'PASS';
  console.log(`${status} ${result.label}`);
  console.log(`  id: ${result.id}`);
  console.log(`  matches: ${result.count}`);
  console.log(`  files: ${result.files.size}`);
  for (const example of result.examples) {
    console.log(`  - ${example.file}:${example.line} ${example.value}`);
  }
  console.log('');
}

console.log(`${duplicateDefinitions.length ? 'WARN' : 'PASS'} Duplicate component definitions`);
console.log('  id: duplicate-component-definitions');
console.log(`  component names: ${duplicateDefinitions.length}`);
for (const entry of duplicateDefinitions.slice(0, maxExamples)) {
  const locations = entry.definitions
    .slice(0, 6)
    .map((definition) => `${definition.file}:${definition.line}`)
    .join(', ');
  console.log(`  - ${entry.name}: ${locations}`);
}
console.log('');

if (shouldFail && (totalWarnings > 0 || duplicateDefinitions.length > 0)) {
  console.error('Design-system audit failed. Run without --fail for a report-only baseline.');
  process.exit(1);
}
