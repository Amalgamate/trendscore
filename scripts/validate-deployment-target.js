#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(`[validate-deployment-target] ERROR: ${message}`);
  process.exit(1);
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function parseArgs(argv) {
  const args = {
    schoolSlug: '',
    environment: '',
    branch: '',
    manifestPath: 'deploy/instances.manifest.json',
    githubOutput: process.env.GITHUB_OUTPUT || '',
    githubSummary: process.env.GITHUB_STEP_SUMMARY || '',
  };

  const rest = [...argv];
  while (rest.length) {
    const token = rest.shift();
    if (!token) continue;

    if (!token.startsWith('--') && !args.schoolSlug) {
      args.schoolSlug = token;
      continue;
    }

    switch (token) {
      case '--environment':
        args.environment = rest.shift() || '';
        break;
      case '--branch':
        args.branch = rest.shift() || '';
        break;
      case '--manifest':
        args.manifestPath = rest.shift() || args.manifestPath;
        break;
      case '--github-output':
        args.githubOutput = rest.shift() || '';
        break;
      case '--summary':
        args.githubSummary = rest.shift() || '';
        break;
      default:
        fail(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function canonicalEnvironment(value) {
  const env = normalize(value);
  if (!env) return '';

  const aliases = new Map([
    ['deploy-demo', 'demo'],
    ['demo', 'demo'],
    ['canary', 'demo'],
    ['deploy-pilot', 'pilot'],
    ['pilot', 'pilot'],
    ['deploy-production-school', 'production'],
    ['production', 'production'],
    ['prod', 'production'],
  ]);

  return aliases.get(env) || env;
}

function githubEnvironmentName(environment) {
  switch (environment) {
    case 'demo':
      return 'deploy-demo';
    case 'pilot':
      return 'deploy-pilot';
    case 'production':
      return 'deploy-production-school';
    default:
      return `deploy-${environment}`;
  }
}

function valueList(instance) {
  const domainSlug = instance.public_domain ? String(instance.public_domain).split('.')[0] : '';
  return [
    instance.id,
    instance.slug,
    instance.school_slug,
    instance.compose_project,
    domainSlug,
    ...(Array.isArray(instance.aliases) ? instance.aliases : []),
  ]
    .filter(Boolean)
    .map(normalize);
}

function instanceIsActive(instance) {
  return (
    instance.active !== false &&
    instance.archived !== true &&
    normalize(instance.status || 'active') !== 'inactive' &&
    normalize(instance.status || 'active') !== 'disabled'
  );
}

function deploymentAllowed(instance) {
  return (
    instance.deploy_allowed !== false &&
    instance.deployment_allowed !== false &&
    (!instance.deploy || instance.deploy.allowed !== false)
  );
}

function writeOutput(file, values) {
  if (!file) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value ?? '')}`);
  fs.appendFileSync(file, `${lines.join('\n')}\n`);
}

function writeSummary(file, details) {
  if (!file) return;
  fs.appendFileSync(
    file,
    [
      '## Deployment target validated',
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| School name | \`${details.schoolName}\` |`,
      `| School slug | \`${details.schoolId}\` |`,
      `| Domain | \`${details.domain || 'n/a'}\` |`,
      `| Server/container name | \`${details.composeProject}\` |`,
      `| Environment | \`${details.environment}\` |`,
      `| GitHub environment | \`${details.githubEnvironment}\` |`,
      `| Branch | \`${details.branch}\` |`,
      '',
    ].join('\n')
  );
}

const args = parseArgs(process.argv.slice(2));
const schoolSlug = normalize(args.schoolSlug);
const environment = canonicalEnvironment(args.environment);
const branch = String(args.branch || '').trim();

if (!schoolSlug) fail('school_slug is required');
if (!environment) fail('environment is required');
if (!branch) fail('branch is required');

const rawSlug = String(args.schoolSlug || '').trim().toLowerCase();
const BATCH_SLUGS = new Set(['all_schools', 'all-schools', 'pilot']);
if (BATCH_SLUGS.has(rawSlug)) {
  const isPilot = rawSlug === 'pilot';
  const batchEnv = isPilot ? 'pilot' : 'production';
  const deployTarget = isPilot ? 'pilot' : 'all_schools';
  const details = {
    schoolId: deployTarget,
    schoolName: isPilot ? 'Pilot Tier Schools' : 'All Schools',
    domain: '',
    composeProject: '',
    environment: batchEnv,
    githubEnvironment: githubEnvironmentName(batchEnv),
    branch,
    kind: '',
    tier: batchEnv,
    envFile: '',
  };

  console.log(`Batch deployment target: ${details.schoolName}`);
  console.log(`  Environment          : ${details.environment}`);
  console.log(`  Branch               : ${details.branch}`);
  console.log('');
  console.log(JSON.stringify(details, null, 2));

  writeOutput(args.githubOutput, {
    school_id: details.schoolId,
    school_name: details.schoolName,
    domain: '',
    compose_project: '',
    environment: details.environment,
    github_environment: details.githubEnvironment,
    branch: details.branch,
    deploy_target: deployTarget,
  });

  writeSummary(args.githubSummary, details);
  process.exit(0);
}

const manifestPath = path.resolve(args.manifestPath);
if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const instances = Array.isArray(manifest.instances) ? manifest.instances : [];
const match = instances.find((instance) => valueList(instance).includes(schoolSlug));

if (!match) {
  fail(`school_slug not found in deployment manifest: ${args.schoolSlug}`);
}

if (!instanceIsActive(match)) {
  fail(`school is not active: ${match.label || match.id}`);
}

if (!deploymentAllowed(match)) {
  fail(`deployment is not allowed for school: ${match.label || match.id}`);
}

const targetEnvironment = canonicalEnvironment(match.environment || match.tier || '');
if (targetEnvironment && targetEnvironment !== environment) {
  fail(
    `environment mismatch for ${match.id}: requested ${environment}, manifest has ${targetEnvironment}`
  );
}

const details = {
  schoolId: match.id,
  schoolName: match.label || match.name || match.id,
  domain: match.public_domain || '',
  composeProject: match.compose_project || match.container_name || match.id,
  environment,
  githubEnvironment: githubEnvironmentName(environment),
  branch,
  kind: match.kind || '',
  tier: match.tier || '',
  envFile: match.env_file || '',
};

console.log('Matched deployment target:');
console.log(`  School name          : ${details.schoolName}`);
console.log(`  Domain               : ${details.domain || 'n/a'}`);
console.log(`  Server/container name: ${details.composeProject}`);
console.log(`  Environment          : ${details.environment}`);
console.log(`  Branch               : ${details.branch}`);
console.log('');
console.log(JSON.stringify(details, null, 2));

writeOutput(args.githubOutput, {
  school_id: details.schoolId,
  school_name: details.schoolName,
  domain: details.domain,
  compose_project: details.composeProject,
  environment: details.environment,
  github_environment: details.githubEnvironment,
  branch: details.branch,
  deploy_target: 'school',
});

writeSummary(args.githubSummary, details);
