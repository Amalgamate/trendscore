const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { Writable } = require('stream');
const Docker = require('dockerode');
const si = require('systeminformation');
const { createBillingStore } = require('./billing-store');
const { quotePdfBuffer, invoicePdfBuffer, paymentReceiptPdfBuffer } = require('./billing-documents');

const execFileAsync = promisify(execFile);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitAt = trimmed.indexOf('=');
    if (splitAt === -1) continue;
    const key = trimmed.slice(0, splitAt).trim();
    const rawValue = trimmed.slice(splitAt + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const { USERS, JWT_SECRET, JWT_EXPIRES_IN, ROLE_ACCESS } = require('./auth-config');

const app = express();
const PORT = process.env.PORT || 3100;
const CONSOLE_ENV_FILE = path.resolve(process.env.CONSOLE_ENV_FILE || '/srv/zawadi/apps/.env.console');
const COOKIE_NAME = 'trends_core_token';
const COOKIE_SECURE = process.env.CONSOLE_COOKIE_SECURE === 'true';
const docker = process.env.DOCKER_HOST
  ? new Docker({ host: 'localhost', port: 2375, protocol: 'http' })
  : new Docker();

const APP_VERSION = process.env.CONSOLE_APP_VERSION || 'live';
const INSTANCE_PROVISION_SCRIPT = process.env.CONSOLE_INSTANCE_PROVISION_SCRIPT || '';
const NGINX_SITES_DIR = process.env.CONSOLE_NGINX_SITES_DIR || '/etc/nginx/sites-enabled';
const DEFAULT_DOMAIN_SUFFIX = process.env.CONSOLE_DEFAULT_DOMAIN_SUFFIX || 'trendscore.co.ke';

// ── Persistent stores ─────────────────────────────────────────────────────
const CONSOLE_DATA_DIR = process.env.CONSOLE_DATA_DIR || __dirname;
fs.mkdirSync(CONSOLE_DATA_DIR, { recursive: true });
const LEADS_STORE_FILE = path.join(CONSOLE_DATA_DIR, 'leads.store.json');
const AUDIT_STORE_FILE = path.join(CONSOLE_DATA_DIR, 'audit.store.json');
const billingStore = createBillingStore(CONSOLE_DATA_DIR);
const MAX_AUDIT_ENTRIES = 2000;
const ASSESSMENT_ACTIVITY_CACHE_MS = 60 * 1000;
let assessmentActivityCache = { fetchedAt: 0, activities: [] };

function captureDockerStream(stream) {
  let stdout = '';
  let stderr = '';
  const out = new Writable({ write(chunk, _encoding, callback) { stdout += chunk.toString('utf8'); callback(); } });
  const err = new Writable({ write(chunk, _encoding, callback) { stderr += chunk.toString('utf8'); callback(); } });
  const completed = new Promise((resolve, reject) => {
    stream.once('end', resolve);
    stream.once('error', reject);
  });
  docker.modem.demuxStream(stream, out, err);
  return completed.then(() => ({ stdout, stderr }));
}

async function readSchoolAssessmentActivity(dbContainer) {
  const sql = `SELECT json_build_object(
      'active_test_count', (
        SELECT COUNT(*)::int
        FROM public.summative_tests active_test
        WHERE active_test.archived = false AND active_test.active = true
      ),
      'tests', COALESCE((
        SELECT json_agg(to_jsonb(activity) ORDER BY activity.activity_at DESC)
        FROM (
          SELECT st.id, st.title, st."learningArea" AS learning_area, st.grade,
            st.term::text AS term, st."academicYear" AS academic_year,
            st."testDate" AS test_date, st.active, st.status::text AS status,
            st."updatedAt" AS updated_at, COUNT(sr.id)::int AS result_count,
            MAX(sr."updatedAt") AS last_result_at,
            GREATEST(st."updatedAt", COALESCE(MAX(sr."updatedAt"), st."updatedAt")) AS activity_at
          FROM (
            SELECT * FROM public.summative_tests
            WHERE archived = false
            ORDER BY "updatedAt" DESC
            LIMIT 8
          ) st
          LEFT JOIN public.summative_results sr ON sr."testId" = st.id AND sr.archived = false
          GROUP BY st.id
          ORDER BY activity_at DESC
        ) activity
      ), '[]'::json)
    )::text`;
  const command = `psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c ${shellQuote(sql)}`;
  const exec = await docker.getContainer(dbContainer.Id).exec({
    Cmd: ['sh', '-lc', command], AttachStdout: true, AttachStderr: true, Tty: false,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const captured = await captureDockerStream(stream);
  const state = await exec.inspect();
  if (state.ExitCode !== 0) throw new Error(captured.stderr.trim() || `psql exited ${state.ExitCode}`);
  const parsed = JSON.parse(captured.stdout.trim() || '{}');
  return {
    activeTestCount: Math.max(0, Number(parsed.active_test_count) || 0),
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
  };
}

// In-memory deployment log (ephemeral — only tracks this process session)
const deploymentLog = [];
const DEPLOY_STORE_FILE = path.join(CONSOLE_DATA_DIR, 'deployments.store.json');
const CONSOLE_MANIFEST_PATH = resolveDeployAssetPath('manifest', [
  process.env.CONSOLE_MANIFEST_PATH,
  '/srv/zawadi/apps/deploy/instances.manifest.json',
  '/tmp/trendscore-instances.manifest.json',
  '/srv/zawadi/apps/zawadijrn/deploy/instances.manifest.json',
  path.join(__dirname, 'deploy', 'instances.manifest.json'),
]);
const CONSOLE_DEPLOY_SCRIPT = resolveDeployAssetPath('script', [
  process.env.CONSOLE_DEPLOY_SCRIPT,
  '/srv/zawadi/apps/deploy/deploy-release.sh',
  '/tmp/trendscore-deploy-release.sh',
  '/srv/zawadi/apps/scripts/deploy-release.sh',
  '/srv/zawadi/apps/zawadijrn/scripts/deploy-release.sh',
  path.join(__dirname, 'deploy', 'deploy-release.sh'),
]);
const FRONTEND_IMAGE_REPO = process.env.CONSOLE_FRONTEND_IMAGE || 'ghcr.io/amalgamate/zawadi-frontend';
const CONSOLE_IMAGE_REPO = process.env.CONSOLE_CONSOLE_IMAGE || 'ghcr.io/amalgamate/zawadi-console';

function resolveDeployAssetPath(kind, candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates.find(Boolean) || '';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function deployExecOutput(error) {
  return `${String(error?.stdout || '')}\n${String(error?.stderr || '')}`.trim();
}

function deployFailureMessage(stdout, stderr, fallback) {
  const text = `${stdout || ''}\n${stderr || ''}`;
  const deployLines = text.split(/\r?\n/).filter(line => line.includes('[deploy]'));
  if (deployLines.length) {
    return deployLines.slice(-6).join('\n');
  }
  return fallback || 'Deploy failed';
}

function shouldRunDeployOnHost(scriptPath) {
  return scriptPath.startsWith('/srv/zawadi/') || scriptPath.startsWith('/tmp/trendscore-');
}

function readDeployStore() {
  if (!fs.existsSync(DEPLOY_STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(DEPLOY_STORE_FILE, 'utf8') || '{}');
    return Array.isArray(parsed.deployments) ? parsed.deployments : [];
  } catch {
    return [];
  }
}

function writeDeployStore(deployments) {
  fs.writeFileSync(DEPLOY_STORE_FILE, JSON.stringify({ deployments: deployments.slice(0, 100) }, null, 2), 'utf8');
}

function pushDeployment(entry) {
  const deployments = readDeployStore();
  const record = {
    id: `D${Date.now()}`,
    time: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) + ' EAT',
    isoTime: new Date().toISOString(),
    ...entry,
  };
  deployments.unshift(record);
  if (deployments.length > 100) deployments.length = 100;
  writeDeployStore(deployments);
  deploymentLog.unshift({
    time: record.time,
    title: record.title,
    copy: record.copy,
    status: record.status,
  });
  if (deploymentLog.length > 50) deploymentLog.length = 50;
  return record;
}

function loadDeployManifest() {
  if (!fs.existsSync(CONSOLE_MANIFEST_PATH)) {
    return { instances: [], defaults: {}, discovery: { enabled: true } };
  }
  return JSON.parse(fs.readFileSync(CONSOLE_MANIFEST_PATH, 'utf8'));
}

function slugFromComposeProject(project = '') {
  const p = String(project || '').trim();
  if (p === 'zawadijrn') return 'jrn';
  return p.replace(/^zawadi-/, '');
}

/** Compose slugs that map to manifest id "demo" (QA canary URL only). */
const CANARY_SLUG_ALIASES = new Set(['demoschool', 'demo-school']);

/** Main zawadijrn stack — live JRN at zawadi.trendscore.co.ke */
const JRN_MAIN_ALIASES = new Set(['zawadijrn', 'jrn']);

function normalizeDeploySchoolId(slugOrId = '') {
  const slug = slugifyName(slugOrId);
  if (!slug || CANARY_SLUG_ALIASES.has(slug)) return 'demo';
  if (JRN_MAIN_ALIASES.has(slug)) return 'jrn';
  return slug;
}

function buildManifestDomainIndex(manifest = {}) {
  const byId = new Map();
  const byProject = new Map();
  for (const inst of manifest.instances || []) {
    const domain = String(inst.public_domain || '').trim().toLowerCase();
    if (!domain) continue;
    byId.set(inst.id, domain);
    const project = inst.compose_project
      || (inst.kind === 'main' ? 'zawadijrn' : `zawadi-${inst.id}`);
    // Shared main stack: production (JRN) domain wins for compose project lookup.
    if (inst.tier !== 'demo' || !byProject.has(project)) {
      byProject.set(project, domain);
      byProject.set(slugFromComposeProject(project), domain);
    }
  }
  return { byId, byProject };
}

function buildManifestDisplayNameIndex(manifest = {}) {
  const byId = new Map();
  const byProject = new Map();
  for (const inst of manifest.instances || []) {
    const displayName = String(inst.label || inst.id || '')
      .replace(/^zawadi[\s_-]+/i, '')
      .replace(/\s*[—–-]\s*zawadi$/i, '')
      .trim();
    if (!displayName) continue;
    byId.set(String(inst.id || '').toLowerCase(), displayName);
    for (const alias of inst.aliases || []) byId.set(String(alias).toLowerCase(), displayName);
    const project = inst.compose_project
      || (inst.kind === 'main' ? 'zawadijrn' : `zawadi-${inst.id}`);
    byProject.set(String(project).toLowerCase(), displayName);
  }
  return { byId, byProject };
}

function resolveRuntimeDisplayName(instance, displayNames) {
  const project = String(instance.composeProject || instance.key || '').trim().toLowerCase();
  const slug = slugifyName(slugFromComposeProject(project) || instance.key || instance.name);
  return displayNames.byProject.get(project)
    || displayNames.byId.get(normalizeDeploySchoolId(slug))
    || displayNames.byId.get(slug)
    || humanizeInstanceName(project || instance.name);
}

function resolveRuntimeDomain(instance, nginxMap, manifestIndex) {
  const project = String(instance.composeProject || instance.key || '').trim();
  const slug = slugifyName(slugFromComposeProject(project) || instance.key || instance.name);

  const fromNginx = (instance.fe && nginxMap.byFePort[instance.fe])
    || (instance.be && nginxMap.byBePort[instance.be])
    || '';
  if (fromNginx) return String(fromNginx).trim().toLowerCase();

  const fromManifest = manifestIndex.byProject.get(project)
    || manifestIndex.byId.get(normalizeDeploySchoolId(slug))
    || manifestIndex.byId.get(slug)
    || '';
  if (fromManifest) return fromManifest;

  return getSchoolDomainOverride(slug) || '';
}

async function listImageTags(imageRepo, limit = 12) {
  try {
    const { stdout } = await execFileAsync('docker', [
      'images', imageRepo,
      '--format', '{{.Tag}}\t{{.CreatedAt}}',
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });
    const rows = String(stdout || '').split(/\r?\n/).filter(Boolean).map(line => {
      const [tag, ...rest] = line.split('\t');
      return { tag: String(tag || '').trim(), createdAt: rest.join('\t').trim() };
    }).filter(row => row.tag && row.tag !== '<none>');

    const shaTags = rows.filter(r => r.tag.startsWith('sha-'));
    const latestRow = rows.find(r => r.tag === 'latest');
    const otherTags = rows.filter(r => !r.tag.startsWith('sha-') && r.tag !== 'latest' && r.tag !== 'main');
    const ordered = [];
    if (latestRow) ordered.push(latestRow);
    ordered.push(...shaTags);
    for (const row of otherTags) {
      if (!ordered.some(r => r.tag === row.tag)) ordered.push(row);
    }
    return ordered.slice(0, limit);
  } catch {
    return [{ tag: 'latest', createdAt: '' }];
  }
}

async function listFrontendImageTags(limit = 12) {
  return listImageTags(FRONTEND_IMAGE_REPO, limit);
}

async function buildDeployTargets() {
  const manifest = loadDeployManifest();
  const manifestDomains = buildManifestDomainIndex(manifest);
  const { instances: runtimeInstances } = await collectRuntime();
  const byId = new Map();

  const upsertDemoFromRuntime = inst => {
    const existing = byId.get('demo');
    const domain = inst?.domain
      || existing?.domain
      || manifestDomains.byId.get('demo')
      || getSchoolDomainOverride('demo')
      || 'demoschool.trendscore.co.ke';
    byId.set('demo', {
      id: 'demo',
      label: existing?.label || 'Canary — Demo School',
      tier: 'demo',
      kind: 'main',
      domain,
      composeProject: inst?.composeProject || existing?.composeProject || 'zawadijrn',
      inManifest: existing?.inManifest ?? false,
      discovered: existing?.discovered || Boolean(inst),
      selectable: true,
    });
  };

  const upsertJrnFromRuntime = inst => {
    const existing = byId.get('jrn');
    const domain = inst?.domain
      || existing?.domain
      || manifestDomains.byId.get('jrn')
      || getSchoolDomainOverride('jrn')
      || 'zawadi.trendscore.co.ke';
    byId.set('jrn', {
      id: 'jrn',
      label: existing?.label || 'JRN — Zawadi',
      tier: existing?.tier || 'production',
      kind: existing?.kind || 'main',
      domain,
      composeProject: inst?.composeProject || existing?.composeProject || 'zawadijrn',
      inManifest: existing?.inManifest ?? false,
      discovered: existing?.discovered || Boolean(inst),
      selectable: true,
    });
  };

  for (const inst of manifest.instances || []) {
    byId.set(inst.id, {
      id: inst.id,
      label: inst.label || inst.id,
      tier: inst.tier || 'production',
      kind: inst.kind || 'stack',
      domain: inst.public_domain || manifestDomains.byId.get(inst.id) || getSchoolDomainOverride(inst.id) || '',
      composeProject: inst.compose_project || (inst.kind === 'main' ? 'zawadijrn' : `zawadi-${inst.id}`),
      inManifest: true,
      selectable: true,
    });
  }

  for (const inst of runtimeInstances) {
    if (!inst.hasFrontend || !inst.hasBackend) continue;
    const rawSlug = slugFromComposeProject(inst.composeProject || inst.key)
      || slugifyName(inst.composeProject || inst.key || '');
    const slug = normalizeDeploySchoolId(rawSlug);
    if (slug === 'demo') {
      upsertDemoFromRuntime(inst);
      continue;
    }
    if (slug === 'jrn') {
      upsertJrnFromRuntime(inst);
      continue;
    }
    if (byId.has(slug)) {
      const existing = byId.get(slug);
      if (!existing.domain && inst.domain) existing.domain = inst.domain;
      if (!existing.composeProject && inst.composeProject) existing.composeProject = inst.composeProject;
      continue;
    }
    byId.set(slug, {
      id: slug,
      label: inst.name || slug,
      tier: 'production',
      kind: 'stack',
      domain: inst.domain || manifestDomains.byId.get(slug) || getSchoolDomainOverride(slug) || '',
      composeProject: inst.composeProject || `zawadi-${slug}`,
      inManifest: false,
      discovered: true,
      selectable: true,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.tier === 'demo') return -1;
    if (b.tier === 'demo') return 1;
    return String(a.label).localeCompare(String(b.label));
  });
}

async function assertSchoolPromotable(schoolId) {
  const id = String(schoolId || '').trim();
  if (!id || id === 'demo') return;
  const targets = await buildDeployTargets();
  const target = targets.find(t => t.id === id);
  if (!target) {
    throw new Error(
      `School "${id}" is not on this server. Run Deploy Demo (main) to sync the manifest, or pick a discovered stack.`,
    );
  }
}

async function runDeployRelease({ deployTarget, imageTag, schoolId }) {
  const scriptPath = CONSOLE_DEPLOY_SCRIPT;
  const manifestPath = CONSOLE_MANIFEST_PATH;
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    throw new Error(
      `Deploy script not found. Expected at /srv/zawadi/apps/deploy/deploy-release.sh `
      + `(install via CI or set CONSOLE_DEPLOY_SCRIPT). Tried: ${scriptPath || 'none'}`,
    );
  }
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error(
      `Deploy manifest not found. Expected at /srv/zawadi/apps/deploy/instances.manifest.json `
      + `(install via CI or set CONSOLE_MANIFEST_PATH). Tried: ${manifestPath || 'none'}`,
    );
  }

  const env = {
    ...process.env,
    DEPLOY_TARGET: deployTarget,
    IMAGE_TAG: imageTag,
    MANIFEST_PATH: manifestPath,
  };
  if (schoolId) env.SCHOOL_ID = schoolId;

  const scriptArgs = [scriptPath];
  if (deployTarget === 'school' && schoolId) scriptArgs.push(schoolId);

  if (shouldRunDeployOnHost(scriptPath)) {
    return runDeployReleaseOnHost(scriptPath, env, scriptArgs.slice(1));
  }

  const { stdout, stderr } = await execFileAsync('bash', scriptArgs, {
    env,
    timeout: 45 * 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: String(stdout || ''), stderr: String(stderr || '') };
}

async function runDeployReleaseOnHost(scriptPath, env, extraScriptArgs = []) {
  const envPairs = Object.entries(env)
    .filter(([key]) => ['DEPLOY_TARGET', 'IMAGE_TAG', 'MANIFEST_PATH', 'SCHOOL_ID', 'DEPLOY_CONSOLE', 'DEPLOY_CONSOLE_ONLY'].includes(key))
    .filter(([, value]) => value != null && String(value).length > 0);

  const envArgs = envPairs.map(([key, value]) => `${key}=${shellQuote(value)}`).join(' ');
  const bashArgs = [shellQuote(scriptPath), ...extraScriptArgs.map(shellQuote)].join(' ');
  const chrootCmd = `chroot /host /usr/bin/env ${envArgs} /bin/bash ${bashArgs}`;

  const dockerArgs = [
    'run', '--rm',
    '--privileged',
    '--pid', 'host',
    '-v', '/:/host',
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    'alpine:3.20',
    'sh', '-c', chrootCmd,
  ];

  try {
    const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
      timeout: 45 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { stdout: String(stdout || ''), stderr: String(stderr || '') };
  } catch (error) {
    const stdout = String(error.stdout || '');
    const stderr = String(error.stderr || '');
    const deployError = new Error(deployFailureMessage(stdout, stderr, error.message));
    deployError.stdout = stdout;
    deployError.stderr = stderr;
    throw deployError;
  }
}

async function runDeployConsoleOnly(imageTag) {
  const scriptPath = CONSOLE_DEPLOY_SCRIPT;
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    throw new Error(`Deploy script not found: ${scriptPath || 'none'}`);
  }
  const env = {
    ...process.env,
    DEPLOY_CONSOLE_ONLY: 'true',
    IMAGE_TAG: imageTag,
    MANIFEST_PATH: CONSOLE_MANIFEST_PATH,
  };
  if (shouldRunDeployOnHost(scriptPath)) {
    return runDeployReleaseOnHost(scriptPath, env);
  }
  const { stdout, stderr } = await execFileAsync('bash', [scriptPath], {
    env,
    timeout: 20 * 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: String(stdout || ''), stderr: String(stderr || '') };
}

// ── Audit log helpers (file-backed, survives restarts) ────────────────────
function ensureAuditStore() {
  if (!fs.existsSync(AUDIT_STORE_FILE)) {
    fs.writeFileSync(AUDIT_STORE_FILE, JSON.stringify({ logs: [] }, null, 2), 'utf8');
  }
}

function readAuditStore() {
  ensureAuditStore();
  try {
    const raw = fs.readFileSync(AUDIT_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return Array.isArray(parsed.logs) ? parsed.logs : [];
  } catch {
    return [];
  }
}

function writeAuditStore(logs) {
  try {
    fs.writeFileSync(AUDIT_STORE_FILE, JSON.stringify({ logs }, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal: log to stderr but don't crash the request
    console.error('[audit] Failed to persist audit log:', err.message);
  }
}

function pushAudit(action, instance, by, details, status = 'Success') {
  const entry = {
    time: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) + ' EAT',
    isoTime: new Date().toISOString(),
    action,
    instance,
    by,
    details,
    status,
  };

  // Read current log, prepend new entry, cap at MAX_AUDIT_ENTRIES, write back
  const logs = readAuditStore();
  logs.unshift(entry);
  if (logs.length > MAX_AUDIT_ENTRIES) logs.length = MAX_AUDIT_ENTRIES;
  writeAuditStore(logs);
}

// ── Leads store helpers ───────────────────────────────────────────────────
function ensureLeadsStore() {
  if (!fs.existsSync(LEADS_STORE_FILE)) {
    fs.writeFileSync(LEADS_STORE_FILE, JSON.stringify({ leads: [] }, null, 2), 'utf8');
  }
}

function readLeadsStore() {
  ensureLeadsStore();
  try {
    const raw = fs.readFileSync(LEADS_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return Array.isArray(parsed.leads) ? parsed.leads : [];
  } catch {
    return [];
  }
}

function writeLeadsStore(leads) {
  fs.writeFileSync(LEADS_STORE_FILE, JSON.stringify({ leads }, null, 2), 'utf8');
}

// ── App catalog & port ranges ─────────────────────────────────────────────
const APP_TYPE_METADATA = [
  { id: 'school', label: 'School', category: 'Education', categoryIcon: '🎓', categoryOrder: 1, description: 'School management platform with frontend, backend, and database.', provisionable: true, inProvisionPicker: true },
  { id: 'sacco', label: 'SACCO', category: 'Financial services', categoryIcon: '🏦', categoryOrder: 2, description: 'Member, savings, and lending management.', provisionable: false, inProvisionPicker: true },
  { id: 'hospital', label: 'Hospital', category: 'Healthcare', categoryIcon: '🏥', categoryOrder: 3, description: 'Hospital operations and patient management.', provisionable: false, inProvisionPicker: true },
  { id: 'hotel', label: 'Hotel', category: 'Hospitality', categoryIcon: '🏨', categoryOrder: 4, description: 'Hotel and guest operations.', provisionable: false, inProvisionPicker: true },
  { id: 'organization', label: 'Organization', category: 'Organizations', categoryIcon: '🏢', categoryOrder: 5, description: 'General organization management.', provisionable: false, inProvisionPicker: true },
  { id: 'odoo', label: 'Odoo', category: 'Business applications', categoryIcon: '🧩', categoryOrder: 6, description: 'Odoo ERP with PostgreSQL.', provisionable: true, inProvisionPicker: true },
  { id: 'wordpress', label: 'WordPress', category: 'Business applications', categoryIcon: '🧩', categoryOrder: 6, description: 'WordPress site with MySQL.', provisionable: true, inProvisionPicker: true },
  { id: 'platform', label: 'Platform services', category: 'Platform', categoryIcon: '⚙️', categoryOrder: 7, description: 'TrendSCORE administration and shared services.', provisionable: false, inProvisionPicker: false },
  { id: 'other', label: 'Other / unclassified', category: 'Other', categoryIcon: '📦', categoryOrder: 8, description: 'An instance that does not match a known application image.', provisionable: false, inProvisionPicker: false },
];
const APP_TYPE_SET = new Set(APP_TYPE_METADATA.filter(type => type.id !== 'platform').map(type => type.id));
const PROVISIONING_READY_APP_TYPES = new Set(APP_TYPE_METADATA.filter(type => type.provisionable).map(type => type.id));

const DEFAULT_IMAGE_CATALOG = {
  school: [
    { value: 'latest', label: 'Latest stable', image: 'ghcr.io/amalgamate/zawadi-frontend:latest' },
    { value: 'v1.0.x', label: 'v1.0.x LTS', image: 'ghcr.io/amalgamate/zawadi-frontend:v1.0.x' },
  ],
  odoo: [
    { value: '18.0', label: 'Odoo 18.0', image: 'odoo:18.0' },
    { value: '17.0', label: 'Odoo 17.0', image: 'odoo:17.0' },
    { value: '16.0', label: 'Odoo 16.0', image: 'odoo:16.0' },
  ],
  wordpress: [
    { value: 'latest', label: 'WordPress latest', image: 'wordpress:latest' },
    { value: '6.5', label: 'WordPress 6.5', image: 'wordpress:6.5' },
    { value: '6.4', label: 'WordPress 6.4', image: 'wordpress:6.4' },
  ],
  sacco: [
    { value: 'latest', label: 'Sacco latest', image: 'ghcr.io/amalgamate/sacco-app:latest' },
    { value: 'v1.0', label: 'Sacco v1.0', image: 'ghcr.io/amalgamate/sacco-app:v1.0' },
  ],
  hospital: [
    { value: 'latest', label: 'Hospital latest', image: 'ghcr.io/amalgamate/hospital-app:latest' },
    { value: 'v1.0', label: 'Hospital v1.0', image: 'ghcr.io/amalgamate/hospital-app:v1.0' },
  ],
  hotel: [
    { value: 'latest', label: 'Hotel latest', image: 'ghcr.io/amalgamate/hotel-app:latest' },
    { value: 'v1.0', label: 'Hotel v1.0', image: 'ghcr.io/amalgamate/hotel-app:v1.0' },
  ],
  organization: [
    { value: 'latest', label: 'Organization latest', image: 'ghcr.io/amalgamate/organization-app:latest' },
    { value: 'v1.0', label: 'Organization v1.0', image: 'ghcr.io/amalgamate/organization-app:v1.0' },
  ],
};

const APP_PORT_RANGES = {
  school: { fe: [3000, 3499], be: [5000, 5499], requireBe: true },
  odoo: { fe: [3500, 3999], be: [0, 0], requireBe: false },
  wordpress: { fe: [3000, 4499], be: [0, 0], requireBe: false },
  sacco: { fe: [4500, 4799], be: [5500, 5799], requireBe: true },
  hospital: { fe: [4800, 5099], be: [5800, 6099], requireBe: true },
  hotel: { fe: [5100, 5399], be: [6100, 6399], requireBe: true },
  organization: { fe: [5400, 5699], be: [6400, 6699], requireBe: true },
};

const PORT_RANGES = Object.values(APP_PORT_RANGES);
function isLikelyFrontendPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && PORT_RANGES.some(range => n >= range.fe[0] && n <= range.fe[1]);
}
function isLikelyBackendPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && PORT_RANGES.some(range => range.requireBe && n >= range.be[0] && n <= range.be[1]);
}

if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET) throw new Error('CONSOLE_JWT_SECRET is required in production.');
  if (USERS.length === 0) throw new Error('At least one console user must be configured in production.');
}

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'trendscore-platform-console' });
});

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied for your role.' });
    }
    next();
  };
}

// ── Login hardening (F-04): constant-time password compare + lockout ──────
// This does not require the Stage-2 console database: it's an in-memory,
// per-process mitigation for the two concrete weaknesses in the current
// env-file auth (timing side-channel + unlimited brute force). Full P1-03
// (personal DB accounts, argon2id hashes, TOTP MFA, revocable sessions)
// still depends on the Postgres console DB (D-01, Stage 2) and is not done
// here — bolting MFA/session tables onto env-file auth now would be
// throwaway work once that DB exists.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
// Fixed-length target so a lookup for an unknown email takes the same
// branch (and roughly the same time) as a lookup for a known one.
const DUMMY_PASSWORD_COMPARE_TARGET = 'trends-core-unknown-account-dummy-compare-target';
const loginAttempts = new Map(); // normalized email -> { count, firstAttemptAt, lockedUntil }

function timingSafeStringsEqual(a, b) {
  const aHash = crypto.createHash('sha256').update(String(a)).digest();
  const bHash = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function isLoginLockedOut(normalizedEmail) {
  const state = loginAttempts.get(normalizedEmail);
  return Boolean(state && state.lockedUntil && Date.now() < state.lockedUntil);
}

function recordFailedLogin(normalizedEmail) {
  const now = Date.now();
  const prev = loginAttempts.get(normalizedEmail);
  const windowExpired = prev && now - prev.firstAttemptAt > LOGIN_LOCKOUT_MS;
  const next = (!prev || windowExpired)
    ? { count: 1, firstAttemptAt: now, lockedUntil: 0 }
    : { count: prev.count + 1, firstAttemptAt: prev.firstAttemptAt, lockedUntil: prev.lockedUntil };
  if (next.count >= LOGIN_MAX_ATTEMPTS) {
    next.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  loginAttempts.set(normalizedEmail, next);
}

function clearLoginAttempts(normalizedEmail) {
  loginAttempts.delete(normalizedEmail);
}

app.post('/api/login', (req, res) => {
  if (!JWT_SECRET || USERS.length === 0) {
    return res.status(503).json({ error: 'Console authentication is not configured.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (isLoginLockedOut(normalizedEmail)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }

  const user = USERS.find(u => u.email.toLowerCase() === normalizedEmail);
  // Always run the comparison, even for an unknown email, against a
  // same-shape dummy target — avoids both the string-compare timing
  // side-channel and an early-return timing tell for "account exists".
  const passwordMatches = timingSafeStringsEqual(password, user ? user.password : DUMMY_PASSWORD_COMPARE_TARGET);

  if (!user || !passwordMatches) {
    recordFailedLogin(normalizedEmail);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  clearLoginAttempts(normalizedEmail);

  const payload = { email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const tokenClaims = jwt.decode(token);
  const sessionExpiresAt = Number(tokenClaims?.exp) * 1000;
  if (!Number.isFinite(sessionExpiresAt)) {
    return res.status(500).json({ error: 'Could not determine the console session expiry.' });
  }

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: COOKIE_SECURE,
    maxAge: Math.max(0, sessionExpiresAt - Date.now()),
  });

  pushAudit('LOGIN', 'Console', user.email, `User logged in`, 'Success');
  return res.json({ ok: true, user: { email: user.email, role: user.role, name: user.name }, access: ROLE_ACCESS[user.role] || [], sessionExpiresAt });
});

app.post('/api/logout', requireAuth, (req, res) => {
  pushAudit('LOGOUT', 'Console', req.user.email, `User logged out`, 'Success');
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  return res.json({
    user: { email: req.user.email, role: req.user.role, name: req.user.name },
    access: ROLE_ACCESS[req.user.role] || [],
    sessionExpiresAt: Number.isFinite(Number(req.user.exp)) ? Number(req.user.exp) * 1000 : null,
  });
});

function humanizeInstanceName(raw) {
  if (!raw) return 'Unknown Instance';
  const clean = raw.replace(/^\//, '').replace(/^trends[-_]?core[-_]?/i, '').replace(/^zawadi[-_]?/i, '');
  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || raw;
}

function inferAppTypeFromImage(image = '') {
  const normalized = String(image).toLowerCase();
  if (/(zawadi[-_]console|trendscore[-_]console|console-app)/.test(normalized)) return 'platform';
  if (/(^|[/:_-])school([/:_-]|$)/.test(normalized)) return 'school';
  if (/(^|[/:_-])odoo([/:_-]|$)/.test(normalized)) return 'odoo';
  if (/(^|[/:_-])wordpress([/:_-]|$)/.test(normalized)) return 'wordpress';
  for (const type of ['sacco', 'hospital', 'hotel', 'organization']) {
    if (normalized.includes(`${type}-app`) || normalized.includes(`/${type}:`) || normalized.includes(`/${type}-`)) return type;
  }
  if (/zawadi-(frontend|backend)|trendscore-school/.test(normalized)) return 'school';
  return '';
}

function mapContainersToInstances(containers) {
  const grouped = new Map();

  for (const c of containers) {
    const cname = (c.Names?.[0] || c.Id || '').replace(/^\//, '');
    const composeProject = c.Labels?.['com.docker.compose.project'] || '';
    const matched = cname.match(/(.*?)(?:[-_])?(frontend|backend|db|database|redis|worker)(?:[-_]?\d+)?$/i);
    const keyBase = composeProject || (matched ? matched[1].replace(/[-_]+$/, '') : cname);
    const key = keyBase || cname;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: humanizeInstanceName(key),
        appType: '',
        domain: '',
        status: 'Online',
        created: new Date((c.Created || Date.now() / 1000) * 1000).toISOString().slice(0, 10),
        version: (c.Image || '').split(':').pop() || APP_VERSION,
        fe: null,
        be: null,
        db: key,
        storage: 0,
        dbGb: 0,
        uploads: 0,
        backups: 0,
        containers: 0,
        runningContainers: 0,
        containerIds: [],
        composeProject: composeProject || key,
        hasFrontend: false,
        hasBackend: false,
        hasDatabase: false,
      });
    }

    const inst = grouped.get(key);
    const detectedAppType = inferAppTypeFromImage(c.Image || '');
    if (detectedAppType && (!inst.appType || inst.appType === 'other')) inst.appType = detectedAppType;
    const descriptor = `${cname} ${c.Image || ''}`.toLowerCase();
    inst.containers += 1;
    inst.containerIds.push(c.Id);
    if (c.State === 'running') inst.runningContainers += 1;
    if (c.State !== 'running') inst.status = inst.runningContainers === 0 ? 'Offline' : 'Degraded';

    if (/(^|[-_])(frontend|fe|web|ui)($|[-_])/.test(descriptor)) inst.hasFrontend = true;
    if (/(^|[-_])(backend|be|api|server)($|[-_])/.test(descriptor)) inst.hasBackend = true;
    if (/(^|[-_])(db|database|postgres|mysql|mariadb)($|[-_])/.test(descriptor)) inst.hasDatabase = true;

    const likelyFrontendContainer = /(^|[-_])(frontend|fe|web|ui|wordpress|odoo|apache|nginx)($|[-_])/.test(descriptor);
    const likelyBackendContainer = /(^|[-_])(backend|be|api|server)($|[-_])/.test(descriptor);
    const ports = c.Ports || [];
    for (const p of ports) {
      const publicPort = Number(p.PublicPort);
      if (!Number.isInteger(publicPort) || publicPort <= 0) continue;

      if (!inst.fe && isLikelyFrontendPort(publicPort) && (likelyFrontendContainer || !likelyBackendContainer)) {
        inst.fe = publicPort;
      }
      if (!inst.be && isLikelyBackendPort(publicPort) && likelyBackendContainer) {
        inst.be = publicPort;
      }
    }

    const sizeBytes = Math.max(0, Number(c.SizeRw || 0));
    inst.storage += sizeBytes / (1024 ** 3);
    if (/db|postgres|mysql|mariadb/i.test(c.Image || cname)) inst.dbGb += sizeBytes / (1024 ** 3);
    else if (/upload|file|storage/i.test(c.Image || cname)) inst.uploads += sizeBytes / (1024 ** 3);
    else inst.backups += sizeBytes / (1024 ** 3);
  }

  const list = Array.from(grouped.values()).map(i => ({
    ...i,
    appType: i.appType || 'other',
    typeLabel: APP_TYPE_METADATA.find(type => type.id === i.appType)?.label || (i.appType === 'other' ? 'Other / unclassified' : 'Platform services'),
    storage: Number(i.storage.toFixed(2)),
    dbGb: Number(i.dbGb.toFixed(2)),
    uploads: Number(i.uploads.toFixed(2)),
    backups: Number(i.backups.toFixed(2)),
  }));

  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function parseNginxDomainMap() {
  const mapping = { byFePort: {}, byBePort: {} };
  if (!fs.existsSync(NGINX_SITES_DIR)) return mapping;

  const files = fs.readdirSync(NGINX_SITES_DIR);
  for (const name of files) {
    const filePath = path.join(NGINX_SITES_DIR, name);
    let text = '';
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const serverMatch = text.match(/server_name\s+([^;]+);/);
    if (!serverMatch) continue;
    const domain = (serverMatch[1] || '')
      .split(/\s+/)
      .map(x => x.trim())
      .find(x => x && !x.startsWith('www.'));
    if (!domain) continue;

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const hit = line.match(/proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/);
      if (!hit) continue;
      const p = Number(hit[1]);
      if (isLikelyBackendPort(p)) mapping.byBePort[p] = domain;
      else if (isLikelyFrontendPort(p)) mapping.byFePort[p] = domain;
    }
  }
  return mapping;
}

function listKnownDomains(runtimeInstances = []) {
  const known = new Set();
  for (const instance of runtimeInstances) {
    const domain = String(instance?.domain || '').trim().toLowerCase();
    if (domain) known.add(domain);
  }
  const nginxMap = parseNginxDomainMap();
  Object.values(nginxMap.byFePort || {}).forEach(domain => {
    const normalized = String(domain || '').trim().toLowerCase();
    if (normalized) known.add(normalized);
  });
  Object.values(nginxMap.byBePort || {}).forEach(domain => {
    const normalized = String(domain || '').trim().toLowerCase();
    if (normalized) known.add(normalized);
  });
  return known;
}

function isPortValid(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isPortInRange(value, range) {
  if (!Array.isArray(range) || range.length !== 2) return false;
  const port = Number(value);
  const min = Number(range[0]);
  const max = Number(range[1]);
  return Number.isInteger(port) && port >= min && port <= max;
}

function isDomainLike(value) {
  const domain = String(value || '').trim().toLowerCase();
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

function slugifyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SCHOOL_DOMAIN_OVERRIDES = {
  amalgamate: 'amalgamate.trendscore.co.ke',
  console: 'admin.trendscore.co.ke',
  admin: 'admin.trendscore.co.ke',
  demo: 'demoschool.trendscore.co.ke',
  demoschool: 'demoschool.trendscore.co.ke',
  'demo-school': 'demoschool.trendscore.co.ke',
  ighs: 'ighs.trendscore.co.ke',
  jrn: 'zawadi.trendscore.co.ke',
  zawadijrn: 'zawadi.trendscore.co.ke',
  'kambigarba-cs': 'kambigarba-cs.trendscore.co.ke',
  'kambi-garba-cs': 'kambigarba-cs.trendscore.co.ke',
  'kambi-garba': 'kambigarba-cs.trendscore.co.ke',
  kambigarba: 'kambigarba-cs.trendscore.co.ke',
  lionscomplex: 'lionscomplex.trendscore.co.ke',
  'lions-complex': 'lionscomplex.trendscore.co.ke',
  lions: 'lionscomplex.trendscore.co.ke',
  mck: 'mck.trendscore.co.ke',
  'merti-cs': 'merti-cs.trendscore.co.ke',
  mertics: 'merti-cs.trendscore.co.ke',
  merti: 'merti-cs.trendscore.co.ke',
  'waso-cs': 'waso-cs.trendscore.co.ke',
  waso: 'waso-cs.trendscore.co.ke',
  'daawa-cs': 'daawa-cs.trendscore.co.ke',
  daawa: 'daawa-cs.trendscore.co.ke',
  naet: 'naet.trendscore.co.ke',
  'zayan-electricals': 'zayan.trendscore.co.ke',
  zayan: 'zayan.trendscore.co.ke',
  zawadi: 'zawadi.trendscore.co.ke',
};

function getSchoolDomainOverride(name) {
  const key = slugifyName(name);
  return SCHOOL_DOMAIN_OVERRIDES[key] || null;
}

function nextAvailablePort(min, max, usedPorts) {
  for (let p = Number(min); p <= Number(max); p += 1) {
    if (!usedPorts.has(p)) return p;
  }
  return null;
}

function nextAvailableDomain(baseSlug, knownDomains) {
  const safeBase = baseSlug || 'school';
  let attempt = `${safeBase}.${DEFAULT_DOMAIN_SUFFIX}`;
  if (!knownDomains.has(attempt)) return attempt;
  let n = 2;
  while (n < 10000) {
    attempt = `${safeBase}-${n}.${DEFAULT_DOMAIN_SUFFIX}`;
    if (!knownDomains.has(attempt)) return attempt;
    n += 1;
  }
  return null;
}

async function getUsedPublishedPorts() {
  const containers = await docker.listContainers({ all: true });
  const usedPorts = new Set();
  for (const container of containers) {
    for (const p of (container.Ports || [])) {
      const publicPort = Number(p.PublicPort);
      if (Number.isInteger(publicPort) && publicPort > 0) usedPorts.add(publicPort);
    }
  }
  return usedPorts;
}

async function buildAutoAllocation({ name, appType, appRange, instances, preferredDomain = '' }) {
  const usedPorts = await getUsedPublishedPorts();

  const fePort = nextAvailablePort(appRange.fe[0], appRange.fe[1], usedPorts);
  if (!fePort) throw new Error(`No available frontend port in range ${appRange.fe[0]}-${appRange.fe[1]}.`);
  usedPorts.add(fePort);

  let bePort = 0;
  if (appRange.requireBe) {
    bePort = nextAvailablePort(appRange.be[0], appRange.be[1], usedPorts);
    if (!bePort) throw new Error(`No available backend port in range ${appRange.be[0]}-${appRange.be[1]}.`);
    usedPorts.add(bePort);
  }

  const knownDomains = listKnownDomains(instances);
  const baseSlug = slugifyName(name || appType || 'school');
  const normalizedPreferredDomain = String(preferredDomain || '').trim().toLowerCase();
  const domain = normalizedPreferredDomain || getSchoolDomainOverride(baseSlug) || nextAvailableDomain(baseSlug, knownDomains);
  if (!domain) throw new Error('No available subdomain could be generated.');

  return { domain, fePort, bePort };
}

function validateImageForAppType(appType, image) {
  const normalized = String(image || '').toLowerCase();
  if (!normalized) return false;
  if (appType === 'odoo') return normalized.includes('odoo');
  if (appType === 'wordpress') return normalized.includes('wordpress') && !normalized.includes('fpm');
  if (appType === 'sacco') return normalized.includes('sacco');
  if (appType === 'hospital') return normalized.includes('hospital');
  if (appType === 'hotel') return normalized.includes('hotel');
  if (appType === 'organization') return normalized.includes('organization');
  if (appType === 'school') return normalized.includes('zawadi') || normalized.includes('trends') || normalized.includes('ghcr.io/amalgamate');
  return false;
}

async function fetchDockerHubTags(repo, limit = 6) {
  const url = `https://registry.hub.docker.com/v2/repositories/${repo}/tags?page_size=${limit}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) throw new Error(`dockerhub ${repo} ${response.status}`);
  const body = await response.json();
  return (body?.results || [])
    .map(tag => String(tag?.name || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

async function buildImageCatalog() {
  const catalog = JSON.parse(JSON.stringify(DEFAULT_IMAGE_CATALOG));
  try {
    const [odooTags, wordpressTags] = await Promise.all([
      fetchDockerHubTags('library/odoo', 8),
      fetchDockerHubTags('library/wordpress', 8),
    ]);

    if (odooTags.length) {
      catalog.odoo = odooTags.map(tag => ({
        value: tag,
        label: `Odoo ${tag}`,
        image: `odoo:${tag}`,
      }));
    }
    const webReadyWordpressTags = wordpressTags.filter(tag => {
      const normalized = String(tag || '').toLowerCase();
      return normalized && !normalized.includes('fpm') && !normalized.includes('cli');
    });
    if (webReadyWordpressTags.length) {
      catalog.wordpress = webReadyWordpressTags.map(tag => ({
        value: tag,
        label: `WordPress ${tag}`,
        image: `wordpress:${tag}`,
      }));
    }
  } catch (_) {
    // fall back to defaults silently
  }
  return catalog;
}

async function collectRuntime() {
  const [containers, mem, disk, load, dockerDf] = await Promise.all([
    docker.listContainers({ all: true, size: true }),
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    docker.df().catch(() => null),
  ]);

  const instances = mapContainersToInstances(containers);
  const nginxMap = parseNginxDomainMap();
  const manifest = loadDeployManifest();
  const manifestDomains = buildManifestDomainIndex(manifest);
  const manifestDisplayNames = buildManifestDisplayNameIndex(manifest);
  for (const i of instances) {
    i.domain = resolveRuntimeDomain(i, nginxMap, manifestDomains);
    i.displayName = resolveRuntimeDisplayName(i, manifestDisplayNames);
  }

  if (dockerDf && Array.isArray(dockerDf.Volumes)) {
    const volumeBytesByProject = {};
    for (const v of dockerDf.Volumes) {
      const project = v?.Labels?.['com.docker.compose.project'] || '';
      const size = Number(v?.UsageData?.Size || 0);
      if (!project || !Number.isFinite(size) || size <= 0) continue;
      volumeBytesByProject[project] = (volumeBytesByProject[project] || 0) + size;
    }

    for (const i of instances) {
      const bytes = volumeBytesByProject[i.composeProject] || 0;
      if (bytes > 0) {
        i.storage = Number((bytes / (1024 ** 3)).toFixed(2));
        i.dbGb = i.storage;
        i.uploads = 0;
        i.backups = 0;
      }
    }
  }

  // Capacity should reflect the primary filesystem available to deployed services,
  // not the sum of every mounted filesystem on the host.
  const rootFs =
    disk.find(d => String(d.mount || '').trim() === '/') ||
    disk.find(d => String(d.fs || '').trim() === '/dev/sda2') ||
    disk.reduce((max, d) => (Number(d.size || 0) > Number(max?.size || 0) ? d : max), null);

  const totalDiskBytes = Number(rootFs?.size || 0);
  const usedDiskBytes = Number(rootFs?.used || 0);

  const imageBytes = Number(dockerDf?.LayersSize || 0);
  const dockerVolumes = Array.isArray(dockerDf?.Volumes) ? dockerDf.Volumes : [];
  const dockerBuildCache = Array.isArray(dockerDf?.BuildCache) ? dockerDf.BuildCache : [];
  const volumeBytes = dockerVolumes.reduce((s, v) => {
    const size = Number(v?.UsageData?.Size);
    return Number.isFinite(size) && size > 0 ? s + size : s;
  }, 0);
  const managedComposeProjects = new Set(instances.map(instance => String(instance.composeProject || '')).filter(Boolean));
  const managedInstanceVolumeBytes = dockerVolumes.reduce((sum, volume) => {
    const project = String(volume?.Labels?.['com.docker.compose.project'] || '');
    const size = Number(volume?.UsageData?.Size);
    return managedComposeProjects.has(project) && Number.isFinite(size) && size > 0 ? sum + size : sum;
  }, 0);
  const containerWritableBytes = containers.reduce((sum, container) => {
    const size = Number(container?.SizeRw);
    return Number.isFinite(size) && size > 0 ? sum + size : sum;
  }, 0);
  const buildCacheBytes = dockerBuildCache.reduce((sum, cacheEntry) => {
    const size = Number(cacheEntry?.Size);
    return Number.isFinite(size) && size > 0 ? sum + size : sum;
  }, 0);
  const dockerStorageBytes = imageBytes + volumeBytes + containerWritableBytes + buildCacheBytes;
  const dockerUsageAvailable = Boolean(dockerDf)
    && Number.isFinite(Number(dockerDf?.LayersSize)) && Number(dockerDf?.LayersSize) >= 0
    && Array.isArray(dockerDf?.Volumes)
    && Array.isArray(dockerDf?.BuildCache)
    && dockerVolumes.every(volume => Number.isFinite(Number(volume?.UsageData?.Size)) && Number(volume?.UsageData?.Size) >= 0)
    && dockerBuildCache.every(cacheEntry => Number.isFinite(Number(cacheEntry?.Size)) && Number(cacheEntry?.Size) >= 0)
    && containers.every(container => Number.isFinite(Number(container?.SizeRw)) && Number(container?.SizeRw) >= 0);

  const metrics = {
    liveInstances: instances.length,
    liveSchools: instances.filter(i => i.appType === 'school' && i.hasFrontend && i.hasBackend && i.hasDatabase).length,
    containersHealthy: `${containers.filter(container => container.State === 'running').length}/${containers.length}`,
    dockerUsageAvailable,
    storageUsedGb: Number((dockerStorageBytes / (1024 ** 3)).toFixed(2)),
    imagesGb: Number((imageBytes / (1024 ** 3)).toFixed(2)),
    volumesGb: Number((volumeBytes / (1024 ** 3)).toFixed(2)),
    managedInstanceVolumesGb: Number((managedInstanceVolumeBytes / (1024 ** 3)).toFixed(2)),
    unassignedVolumesGb: Number((Math.max(0, volumeBytes - managedInstanceVolumeBytes) / (1024 ** 3)).toFixed(2)),
    containerWritableGb: Number((containerWritableBytes / (1024 ** 3)).toFixed(2)),
    buildCacheGb: Number((buildCacheBytes / (1024 ** 3)).toFixed(2)),
    cpuLoadPercent: Math.round(load.currentLoad || 0),
    memoryUsedPercent: Math.round((mem.used / Math.max(mem.total, 1)) * 100),
    diskTotalGb: Number((totalDiskBytes / (1024 ** 3)).toFixed(1)),
    diskUsedGb: Number((usedDiskBytes / (1024 ** 3)).toFixed(1)),
  };

  return { instances, metrics };
}

app.get('/api/runtime', requireAuth, async (_req, res) => {
  try {
    const runtime = await collectRuntime();
    res.json({
      ok: true,
      ...runtime,
      appTypes: APP_TYPE_METADATA,
      deployments: readDeployStore().slice(0, 50),
      auditLogs: readAuditStore().slice(0, 200),
      mode: 'live',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: `Runtime fetch failed: ${error.message}` });
  }
});

app.get('/api/instances/assessment-activity', requireAuth, requireRole('super_admin'), async (_req, res) => {
  if (Date.now() - assessmentActivityCache.fetchedAt < ASSESSMENT_ACTIVITY_CACHE_MS) {
    return res.json({ ok: true, generatedAt: new Date(assessmentActivityCache.fetchedAt).toISOString(), activities: assessmentActivityCache.activities });
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const schools = mapContainersToInstances(containers).filter(instance => instance.appType === 'school');
    const databases = new Map();
    for (const container of containers) {
      if (container.State !== 'running') continue;
      const service = String(container.Labels?.['com.docker.compose.service'] || '').toLowerCase();
      const project = container.Labels?.['com.docker.compose.project'];
      const isPostgresDbService = ['db', 'database', 'postgres', 'postgresql'].includes(service)
        || (/(^|[-_])(db|database|postgres|postgresql)([-_0-9]|$)/.test(service) && /postgres/i.test(container.Image || ''));
      if (project && isPostgresDbService) databases.set(project, container);
    }

    const activities = [];
    for (let offset = 0; offset < schools.length; offset += 4) {
      const batch = schools.slice(offset, offset + 4);
      const results = await Promise.all(batch.map(async school => {
        const key = school.composeProject || school.key;
        const dbContainer = databases.get(school.composeProject || school.key);
        if (!dbContainer) return { key, name: school.name, state: 'unavailable', reason: 'School database is not running.' };
        try {
          const activity = await readSchoolAssessmentActivity(dbContainer);
          return { key, name: school.name, state: 'available', ...activity };
        } catch (error) {
          console.warn(`[assessment-activity] Could not read ${key}: ${error.message}`);
          return { key, name: school.name, state: 'unavailable', reason: 'Assessment data could not be read.' };
        }
      }));
      activities.push(...results);
    }

    assessmentActivityCache = { fetchedAt: Date.now(), activities };
    return res.json({ ok: true, generatedAt: new Date(assessmentActivityCache.fetchedAt).toISOString(), activities });
  } catch (error) {
    return res.status(502).json({ ok: false, error: `Could not load assessment activity: ${error.message}` });
  }
});

app.get('/api/catalog/images', requireAuth, requireRole('super_admin', 'platform_owner'), async (req, res) => {
  const appType = String(req.query.appType || '').toLowerCase();
  const catalog = await buildImageCatalog();
  if (appType) {
    if (!APP_TYPE_SET.has(appType)) {
      return res.status(400).json({ error: 'Unsupported appType.' });
    }
    return res.json({ ok: true, appType, versions: catalog[appType] || [] });
  }
  return res.json({ ok: true, catalog });
});

app.post('/api/instances/suggest', requireAuth, requireRole('super_admin'), async (req, res) => {
  const {
    appType = 'school',
    name = '',
    domain = '',
  } = req.body || {};

  const normalizedAppType = String(appType || 'school').toLowerCase();
  const appRange = APP_PORT_RANGES[normalizedAppType] || APP_PORT_RANGES.school;

  if (!APP_TYPE_SET.has(normalizedAppType)) {
    return res.status(400).json({ error: 'Unsupported appType.' });
  }

  try {
    const { instances } = await collectRuntime();
    const autoAssigned = await buildAutoAllocation({
      name: String(name || '').trim() || normalizedAppType,
      appType: normalizedAppType,
      appRange,
      instances,
      preferredDomain: isDomainLike(domain) ? String(domain).trim().toLowerCase() : '',
    });
    return res.json({ ok: true, autoAssigned });
  } catch (error) {
    return res.status(400).json({ error: `Auto-assignment failed: ${error.message}` });
  }
});

app.get('/api/instances/types', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  res.json({ ok: true, types: APP_TYPE_METADATA });
});

app.post('/api/instances/preflight', requireAuth, requireRole('super_admin'), async (req, res) => {
  const {
    appType = 'school',
    name = '',
    image = '',
    domain = '',
  } = req.body || {};

  const normalizedAppType = String(appType || 'school').toLowerCase();
  const appRange = APP_PORT_RANGES[normalizedAppType] || APP_PORT_RANGES.school;
  const issues = [];
  const warnings = [];

  if (!APP_TYPE_SET.has(normalizedAppType)) {
    issues.push('Unsupported app type.');
  } else if (!PROVISIONING_READY_APP_TYPES.has(normalizedAppType)) {
    issues.push(`Provisioning for ${normalizedAppType} is not available yet because its deployment recipe is not configured.`);
  }

  if (!String(name || '').trim()) issues.push('Instance name is required.');

  const requestedDomain = String(domain || '').trim().toLowerCase();
  if (requestedDomain && !isDomainLike(requestedDomain)) {
    issues.push('Domain is invalid.');
  }

  if (APP_TYPE_SET.has(normalizedAppType) && image && !validateImageForAppType(normalizedAppType, image)) {
    issues.push(`Image "${image}" does not look valid for app type "${normalizedAppType}".`);
  }

  let suggested = null;
  try {
    const { instances } = await collectRuntime();
    if (!issues.length) {
      suggested = await buildAutoAllocation({
        name,
        appType: normalizedAppType,
        appRange,
        instances,
        preferredDomain: requestedDomain,
      });
      if (!isDomainLike(suggested.domain)) {
        issues.push('Auto-generated domain is invalid.');
      }
      if (!isPortInRange(suggested.fePort, appRange.fe)) {
        issues.push('Auto-generated frontend port is outside allowed range.');
      }
      if (appRange.requireBe && !isPortInRange(suggested.bePort, appRange.be)) {
        issues.push('Auto-generated backend port is outside allowed range.');
      }
    }
  } catch (error) {
    warnings.push(`Live runtime preflight unavailable: ${error.message}`);
  }

  return res.json({
    ok: true,
    valid: issues.length === 0,
    issues,
    warnings,
    autoAssigned: suggested,
  });
});

app.get('/api/instances/:key/logs', requireAuth, requireRole('super_admin', 'platform_owner'), async (req, res) => {
  try {
    const { instances } = await collectRuntime();
    const target = instances.find(i => i.key === req.params.key || i.name === req.params.key);
    if (!target) return res.status(404).json({ error: 'Instance not found' });

    const chunks = [];
    for (const cid of target.containerIds.slice(0, 5)) {
      const container = docker.getContainer(cid);
      const raw = await container.logs({ stdout: true, stderr: true, tail: 120, timestamps: true });
      chunks.push(raw.toString('utf8'));
    }
    res.json({ ok: true, logs: chunks.join('\n') });
  } catch (error) {
    res.status(500).json({ error: `Unable to fetch logs: ${error.message}` });
  }
});

async function applyInstanceAction(instanceKey, action) {
  const { instances } = await collectRuntime();
  const target = instances.find(i => i.key === instanceKey || i.name === instanceKey);
  if (!target) {
    const err = new Error('Instance not found');
    err.code = 404;
    throw err;
  }

  for (const cid of target.containerIds) {
    const container = docker.getContainer(cid);
    if (action === 'start') await container.start();
    if (action === 'stop') await container.stop({ t: 10 });
    if (action === 'drop') {
      const err = new Error('Direct container removal is disabled. Use the reviewed school decommission workflow.');
      err.code = 501;
      throw err;
    }
    if (action === 'restart' || action === 'redeploy') await container.restart({ t: 10 });
  }

  return target;
}

app.post('/api/instances/:key/:action', requireAuth, requireRole('super_admin'), async (req, res) => {
  const action = String(req.params.action || '').toLowerCase();
  if (!['start', 'stop', 'drop', 'restart', 'redeploy', 'health'].includes(action)) {
    return res.status(400).json({ error: 'Unsupported action' });
  }

  try {
    const target = action === 'health'
      ? (await collectRuntime()).instances.find(i => i.key === req.params.key || i.name === req.params.key)
      : await applyInstanceAction(req.params.key, action);
    if (!target) return res.status(404).json({ error: 'Instance not found' });

    pushAudit(action.toUpperCase(), target.name, req.user.email, `Action ${action} executed on ${target.name}`, action === 'stop' || action === 'drop' ? 'Warning' : 'Success');
    res.json({ ok: true, target: target.name, action });
  } catch (error) {
    const code = error.code || 500;
    res.status(code).json({ error: error.message || 'Action failed' });
  }
});

app.post('/api/instances/create', requireAuth, requireRole('super_admin'), async (req, res) => {
  const {
    appType = 'school',
    name,
    type,
    institutionType,
    planId,
    version = 'latest',
    image = '',
    adminEmail = '',
    notes = '',
    domain = '',
    db,
  } = req.body || {};

  const normalizedAppType = String(appType || 'school').toLowerCase();
  const appRange = APP_PORT_RANGES[normalizedAppType] || APP_PORT_RANGES.school;
  if (!APP_TYPE_SET.has(normalizedAppType)) {
    return res.status(400).json({ error: 'Unsupported appType.' });
  }

  if (!PROVISIONING_READY_APP_TYPES.has(normalizedAppType)) {
    return res.status(409).json({ error: `Provisioning for ${normalizedAppType} is not available yet because its deployment recipe is not configured.` });
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const requestedDomain = String(domain || '').trim().toLowerCase();
  if (requestedDomain && !isDomainLike(requestedDomain)) {
    return res.status(400).json({ error: 'Domain is invalid.' });
  }

  if (!INSTANCE_PROVISION_SCRIPT) {
    return res.status(501).json({
      error: 'Instance provisioning script not configured',
      hint: 'Set CONSOLE_INSTANCE_PROVISION_SCRIPT on the server to enable real provisioning.',
    });
  }

  let autoAssigned;
  try {
    const { instances } = await collectRuntime();
    autoAssigned = await buildAutoAllocation({
      name,
      appType: normalizedAppType,
      appRange,
      instances,
      preferredDomain: requestedDomain,
    });
  } catch (error) {
    return res.status(400).json({ error: `Auto-assignment failed: ${error.message}` });
  }

  const payload = JSON.stringify({
    appType: normalizedAppType,
    name,
    domain: autoAssigned.domain,
    type: type || institutionType || 'PRIMARY_CBC',
    planId: planId || 'professional',
    version,
    image,
    adminEmail,
    notes,
    fePort: autoAssigned.fePort,
    bePort: appRange.requireBe ? autoAssigned.bePort : 0,
    db,
    requestedBy: req.user.email,
  });

  try {
    const { stdout, stderr } = await execFileAsync(INSTANCE_PROVISION_SCRIPT, [payload], { timeout: 8 * 60 * 1000 });
    pushAudit('PROVISION', name, req.user.email, `Provision script executed for ${name} (${normalizedAppType})`, 'Warning');
    res.json({ ok: true, output: stdout?.trim(), warning: stderr?.trim() || null });
  } catch (error) {
    res.status(500).json({ error: `Provision failed: ${error.message}` });
  }
});

app.post('/api/controls/:action', requireAuth, requireRole('super_admin'), async (req, res) => {
  const action = String(req.params.action || '').toLowerCase();
  return res.status(501).json({
    ok: false,
    action,
    error: 'Bulk controls are disabled until they use an explicit school target and approved workflow.',
  });
});

// ── Audit log endpoint (now reads from file) ──────────────────────────────
app.get('/api/audit-logs', requireAuth, (req, res) => {
  const logs = readAuditStore();
  const limit = Math.min(Number(req.query.limit) || 200, MAX_AUDIT_ENTRIES);
  res.json({ ok: true, logs: logs.slice(0, limit), total: logs.length });
});

app.get('/api/deploy/targets', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const targets = await buildDeployTargets();
    res.json({
      ok: true,
      targets,
      manifestPath: CONSOLE_MANIFEST_PATH,
      deployScriptPath: CONSOLE_DEPLOY_SCRIPT,
      deployReady: Boolean(CONSOLE_DEPLOY_SCRIPT && fs.existsSync(CONSOLE_DEPLOY_SCRIPT)),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/deploy/releases', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const segment = String(req.query.segment || 'school').toLowerCase();
    const imageRepo = segment === 'console' ? CONSOLE_IMAGE_REPO : FRONTEND_IMAGE_REPO;
    const tags = await listImageTags(imageRepo);
    res.json({ ok: true, tags, imageRepo, segment });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/deploy/console', requireAuth, requireRole('super_admin'), async (req, res) => {
  const imageTag = String(req.body?.imageTag || '').trim();
  if (!imageTag) {
    return res.status(400).json({ error: 'imageTag is required' });
  }
  try {
    const started = Date.now();
    const { stdout, stderr } = await runDeployConsoleOnly(imageTag);
    const durationSec = Math.round((Date.now() - started) / 1000);
    pushAudit('DEPLOY', 'Platform console', req.user.email, `Console ${imageTag} (${durationSec}s)`, 'Success');
    pushDeployment({
      title: `Console ${imageTag}`,
      copy: `Platform admin panel only. By ${req.user.email}.`,
      status: 'Success',
      imageTag,
      targets: ['platform-console'],
    });
    return res.json({
      ok: true,
      imageTag,
      results: [{
        target: 'Platform console',
        ok: true,
        durationSec,
        log: `${stdout}\n${stderr}`.trim(),
      }],
    });
  } catch (error) {
    const deployLog = deployExecOutput(error);
    const message = deployFailureMessage(error.stdout, error.stderr, error.message);
    pushAudit('DEPLOY', 'Console failed', req.user.email, message, 'Warning');
    return res.status(500).json({ ok: false, error: message, log: deployLog });
  }
});

app.post('/api/deploy/promote', requireAuth, requireRole('super_admin'), async (req, res) => {
  const imageTag = String(req.body?.imageTag || '').trim();
  const allSchools = Boolean(req.body?.allSchools);
  const includeDemo = Boolean(req.body?.includeDemo);
  const schoolIds = Array.isArray(req.body?.schoolIds)
    ? req.body.schoolIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];

  if (!imageTag) {
    return res.status(400).json({ error: 'imageTag is required' });
  }
  if (!allSchools && !includeDemo && schoolIds.length === 0) {
    return res.status(400).json({ error: 'Select at least one school, include canary, or choose all production schools' });
  }

  const results = [];
  const jobs = [];

  if (allSchools) {
    jobs.push({ deployTarget: 'all_schools', label: 'All production school apps' });
  } else {
    if (includeDemo && !schoolIds.includes('demo')) {
      jobs.push({ deployTarget: 'demo', label: 'Canary (demo school)' });
    }
    for (const id of schoolIds) {
      if (id === 'demo') {
        jobs.push({ deployTarget: 'demo', label: 'Canary (demo school)' });
      } else {
        jobs.push({ deployTarget: 'school', schoolId: id, label: id });
      }
    }
  }

  const seen = new Set();
  const uniqueJobs = jobs.filter(job => {
    const key = `${job.deployTarget}:${job.schoolId || 'all'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  try {
    for (const job of uniqueJobs) {
      if (job.deployTarget === 'school' && job.schoolId) {
        await assertSchoolPromotable(job.schoolId);
      }
      const started = Date.now();
      const { stdout, stderr } = await runDeployRelease({
        deployTarget: job.deployTarget,
        imageTag,
        schoolId: job.schoolId,
      });
      const durationSec = Math.round((Date.now() - started) / 1000);
      results.push({
        target: job.label,
        deployTarget: job.deployTarget,
        schoolId: job.schoolId || null,
        ok: true,
        durationSec,
        log: `${stdout}\n${stderr}`.trim(),
      });
      pushAudit('DEPLOY', job.label, req.user.email, `Promoted ${imageTag} (${durationSec}s)`, 'Success');
    }

    const targetSummary = uniqueJobs.map(j => j.label).join(', ');
    pushDeployment({
      title: `Promoted ${imageTag}`,
      copy: `Targets: ${targetSummary}. By ${req.user.email}.`,
      status: 'Success',
      imageTag,
      targets: uniqueJobs.map(j => j.label),
    });

    return res.json({ ok: true, imageTag, results });
  } catch (error) {
    const deployLog = deployExecOutput(error);
    const failedJob = uniqueJobs[results.length] || uniqueJobs[uniqueJobs.length - 1];
    if (deployLog) {
      results.push({
        target: failedJob?.label || 'deploy',
        deployTarget: failedJob?.deployTarget || null,
        schoolId: failedJob?.schoolId || null,
        ok: false,
        log: deployLog,
      });
    }
    const message = deployFailureMessage(error.stdout, error.stderr, error.message);
    pushAudit('DEPLOY', 'Promote failed', req.user.email, message, 'Warning');
    pushDeployment({
      title: `Deploy failed (${imageTag})`,
      copy: message,
      status: 'Failed',
      imageTag,
    });
    return res.status(500).json({
      ok: false,
      error: message,
      log: deployLog,
      results,
    });
  }
});

app.get('/api/deployments', requireAuth, (_req, res) => {
  res.json({ ok: true, deployments: readDeployStore().slice(0, 50) });
});

// ── Leads endpoints ───────────────────────────────────────────────────────
app.get('/api/leads', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  const leads = readLeadsStore();
  res.json({ ok: true, leads });
});

app.post('/api/leads', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const school = String(body.school || '').trim();
  if (!name || !school) {
    return res.status(400).json({ error: 'name and school are required' });
  }

  const leads = readLeadsStore();
  const lead = {
    id: String(body.id || `L${Date.now()}`),
    name,
    school,
    phone: String(body.phone || '').trim(),
    stage: String(body.stage || 'new').trim() || 'new',
    priority: String(body.priority || '1').trim() || '1',
    students: Number(body.students || 0) || 0,
    tags: Array.isArray(body.tags) ? body.tags : [],
    systems: {
      assessment: String(body?.systems?.assessment || 'None'),
      fees: String(body?.systems?.fees || 'None'),
      lms: String(body?.systems?.lms || 'None'),
    },
    notes: String(body.notes || '').trim(),
    nextActivity: String(body.nextActivity || 'New lead added').trim(),
    created: String(body.created || new Date().toISOString().slice(0, 10)),
  };

  leads.push(lead);
  writeLeadsStore(leads);
  pushAudit('LEAD_CREATE', lead.school, req.user.email, `Created lead ${lead.name}`, 'Success');
  return res.json({ ok: true, lead });
});

app.put('/api/leads/:id', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });

  const leads = readLeadsStore();
  const idx = leads.findIndex(l => String(l.id) === id);
  if (idx < 0) return res.status(404).json({ error: 'Lead not found' });

  const prev = leads[idx];
  const body = req.body || {};
  const updated = {
    ...prev,
    ...body,
    id: prev.id,
    systems: {
      assessment: String(body?.systems?.assessment ?? prev?.systems?.assessment ?? 'None'),
      fees: String(body?.systems?.fees ?? prev?.systems?.fees ?? 'None'),
      lms: String(body?.systems?.lms ?? prev?.systems?.lms ?? 'None'),
    },
  };
  leads[idx] = updated;
  writeLeadsStore(leads);
  pushAudit('LEAD_UPDATE', updated.school, req.user.email, `Updated lead ${updated.name}`, 'Success');
  return res.json({ ok: true, lead: updated });
});

app.delete('/api/leads/:id', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });

  const leads = readLeadsStore();
  const idx = leads.findIndex(l => String(l.id) === id);
  if (idx < 0) return res.status(404).json({ error: 'Lead not found' });

  const [removed] = leads.splice(idx, 1);
  writeLeadsStore(leads);
  pushAudit('LEAD_DELETE', removed.school, req.user.email, `Deleted lead ${removed.name}`, 'Warning');
  return res.json({ ok: true });
});

// ── Platform customer and contract registry ────────────────────────────────
const BILLING_CADENCES = new Set(['one_off', 'monthly', 'termly', 'annual', 'custom']);
const CONTRACT_STATUSES = new Set(['draft', 'active', 'ended', 'cancelled']);

function billingText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeBillingCustomer(body = {}) {
  const status = billingText(body.status || 'active', 20).toLowerCase();
  const currency = billingText(body.currency || 'KES', 3).toUpperCase();
  if (!['active', 'inactive'].includes(status)) throw new Error('status must be active or inactive');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a three-letter code');
  const tenantKey = billingText(body.tenantKey, 160).toLowerCase();
  if (tenantKey && !/^[a-z0-9][a-z0-9._-]*$/.test(tenantKey)) throw new Error('tenant key may contain only lowercase letters, numbers, dots, underscores, and hyphens');
  const billingEmail = billingText(body.billingEmail, 254).toLowerCase();
  if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) throw new Error('billing email is invalid');
  return {
    name: billingText(body.name, 160),
    legalName: billingText(body.legalName, 200),
    tenantKey,
    billingEmail,
    billingPhone: billingText(body.billingPhone, 40),
    billingAddress: billingText(body.billingAddress, 1000),
    taxIdentifier: billingText(body.taxIdentifier, 100),
    currency,
    paymentTerms: billingText(body.paymentTerms, 160),
    status,
  };
}

function normalizeBillingContract(body = {}, customerId) {
  const cadence = billingText(body.cadence, 20).toLowerCase();
  const status = billingText(body.status || 'draft', 20).toLowerCase();
  if (!BILLING_CADENCES.has(cadence)) throw new Error(`cadence must be one of: ${[...BILLING_CADENCES].join(', ')}`);
  if (!CONTRACT_STATUSES.has(status)) throw new Error(`status must be one of: ${[...CONTRACT_STATUSES].join(', ')}`);
  return {
    customerId,
    reference: billingText(body.reference, 120),
    serviceDescription: billingText(body.serviceDescription, 500),
    cadence,
    startDate: billingText(body.startDate, 10),
    endDate: billingText(body.endDate, 10),
    renewalDate: billingText(body.renewalDate, 10),
    termsNote: billingText(body.termsNote, 3000),
    status,
  };
}

function validateBillingDates(contract) {
  for (const key of ['startDate', 'endDate', 'renewalDate']) {
    const value = contract[key];
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)) {
      throw new Error(`${key} must be a valid date in YYYY-MM-DD format`);
    }
  }
  if (contract.startDate && contract.endDate && contract.endDate < contract.startDate) throw new Error('endDate cannot be before startDate');
}

const STUDENT_RATE_BANDS = [
  { min: 1, max: 300, rate: 50 },
  { min: 301, max: 500, rate: 40 },
  { min: 501, max: 1000, rate: 35 },
  { min: 1001, max: Infinity, rate: 30 },
];
const QUOTE_CADENCES = new Set(['monthly', 'termly', 'annual']);

function calculateQuote(body = {}) {
  const enrollmentCount = Number(body.enrollmentCount);
  if (!Number.isInteger(enrollmentCount) || enrollmentCount < 1 || enrollmentCount > 100000) {
    throw new Error('Student count must be a whole number between 1 and 100,000');
  }
  const pricingModel = billingText(body.pricingModel || 'rate_by_band', 30);
  if (!['rate_by_band', 'progressive'].includes(pricingModel)) throw new Error('Choose a supported student pricing model');
  const billingCadence = billingText(body.billingCadence || 'termly', 20);
  if (!QUOTE_CADENCES.has(billingCadence)) throw new Error('Choose a supported student billing cadence');
  if (body.setupFeeKsh === undefined || body.setupFeeKsh === null || body.setupFeeKsh === '') {
    throw new Error('Enter the one-off school setup fee, or enter 0 if it is waived');
  }
  const setupFeeKsh = Number(body.setupFeeKsh);
  if (!Number.isSafeInteger(setupFeeKsh) || setupFeeKsh < 0 || setupFeeKsh > 100000000) {
    throw new Error('Setup fee must be a whole KSh amount');
  }
  const extraCadence = billingText(body.extraModuleCadence || 'termly', 20);
  if (!['one_off', 'termly'].includes(extraCadence)) throw new Error('Extra modules can be one-off or termly');
  const extraModules = (Array.isArray(body.extraModules) ? body.extraModules : [])
    .map(value => billingText(value, 100))
    .filter(Boolean);
  if (extraModules.length > 20) throw new Error('A quote can include up to 20 extra modules');
  if (new Set(extraModules.map(value => value.toLowerCase())).size !== extraModules.length) {
    throw new Error('Remove duplicate extra module names');
  }

  const lines = [];
  const addLine = (description, quantity, unitPriceKsh, cadence) => lines.push({
    description, quantity, unitPriceKsh, amountKsh: quantity * unitPriceKsh, cadence,
  });
  let pricingDescription;
  if (pricingModel === 'rate_by_band') {
    const band = STUDENT_RATE_BANDS.find(item => enrollmentCount >= item.min && enrollmentCount <= item.max);
    addLine(`Student platform service (${billingCadence})`, enrollmentCount, band.rate, billingCadence);
    pricingDescription = `${enrollmentCount} students x KSh ${band.rate}/student (${band.min}-${Number.isFinite(band.max) ? band.max : 'above'} enrollment tier)`;
  } else {
    let remaining = enrollmentCount;
    const tierParts = [];
    for (const band of STUDENT_RATE_BANDS) {
      if (remaining <= 0) break;
      const width = Number.isFinite(band.max) ? band.max - band.min + 1 : remaining;
      const quantity = Math.min(remaining, width);
      if (quantity > 0) {
        addLine(`Student service ${band.min}-${Number.isFinite(band.max) ? band.max : 'above'} tier (${billingCadence})`, quantity, band.rate, billingCadence);
        tierParts.push(`${quantity} x KSh ${band.rate}`);
        remaining -= quantity;
      }
    }
    pricingDescription = `Progressive bands: ${tierParts.join(' + ')}`;
  }
  addLine('School setup (one-off)', 1, setupFeeKsh, 'one_off');
  const communicationsIncluded = body.communicationsIncluded === true;
  if (communicationsIncluded) addLine('Communications module (per term; 1,000 SMS included)', 1, 10000, 'termly');
  for (const moduleName of extraModules) addLine(`Extra module: ${moduleName} (${extraCadence === 'one_off' ? 'one-off' : 'per term'})`, 1, 5000, extraCadence);

  const subtotalKsh = lines.reduce((sum, item) => sum + item.amountKsh, 0);
  if (!Number.isSafeInteger(subtotalKsh) || subtotalKsh > 1000000000) throw new Error('Quoted total exceeds the supported limit');
  const expiresOn = billingText(body.expiresOn, 10);
  if (expiresOn) validateBillingDates({ startDate: '', endDate: '', renewalDate: expiresOn });
  const notes = billingText(body.notes, 3000);
  return {
    enrollmentCount, pricingModel, pricingDescription, billingCadence,
    billingCadenceLabel: billingCadence.charAt(0).toUpperCase() + billingCadence.slice(1),
    setupFeeKsh, communicationsIncluded, communicationsSmsPerTerm: communicationsIncluded ? 1000 : 0,
    extraCadence, extraModules, lines, subtotalKsh, expiresOn, notes,
    taxNote: 'Tax treatment is not included in this quotation and must be reviewed before issuing a tax invoice.',
  };
}

const BILLING_EMAIL_LOGO_URL = process.env.BILLING_EMAIL_LOGO_URL || 'https://trendscore.co.ke/splash/new/TrendsCORE-Logo.png';

function billingEmailEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function billingEmailDraft(kind, record) {
  const quote = kind === 'quote';
  const draftInvoice = !quote && record.status === 'draft';
  const customer = quote ? record.customerSnapshot || {} : record.invoiceSnapshot?.customerSnapshot || {};
  const documentNumber = quote ? record.quoteNumber : record.invoiceNumber;
  const amountKsh = quote ? record.subtotalKsh : record.amountKsh;
  const customerName = customer.name || 'Customer';
  const subject = quote ? `Your TrendSCORE quotation ${documentNumber}` : draftInvoice ? `Draft invoice for your review · ${documentNumber}` : `Invoice ${documentNumber} from TrendSCORE`;
  const message = quote
    ? `Hello ${customerName},\n\nPlease find quotation ${documentNumber} attached for your review. It is based on an enrollment snapshot of ${Number(record.enrollmentCount || 0).toLocaleString('en-KE')} students${record.expiresOn ? ` and is valid until ${record.expiresOn}` : ''}.\n\n${record.quoteSnapshot?.taxNote || 'Tax treatment is not included in this quotation and should be reviewed before invoicing.'} This quotation is not a tax invoice.\n\nPlease reply to this email if you have any questions or would like to proceed.\n\nWarm regards,\nTrendSCORE Billing Team`
    : draftInvoice
      ? `Hello ${customerName},\n\nPlease review the attached draft invoice ${documentNumber} for KSh ${Number(amountKsh || 0).toLocaleString('en-KE')}.\n\nThis is a review copy only. It is not an issued invoice, payment request, or tax invoice. Please reply with any corrections or approval.\n\nWarm regards,\nTrendSCORE Billing Team`
      : `Hello ${customerName},\n\nPlease find invoice ${documentNumber} attached for KSh ${Number(amountKsh || 0).toLocaleString('en-KE')}.${record.invoiceSnapshot?.dueDate ? ` Payment is due by ${record.invoiceSnapshot.dueDate}.` : ' Payment is due upon receipt.'}\n\nPlease include the invoice number as your payment reference. This commercial invoice is not an eTIMS tax invoice.\n\nWarm regards,\nTrendSCORE Billing Team`;
  return {
    kind, customerName, documentNumber, recipient: customer.billingEmail || '',
    subject, message, amountKsh, logoUrl: BILLING_EMAIL_LOGO_URL,
    isDraftInvoice: draftInvoice,
    documentName: `${String(documentNumber || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
    pdfUrl: quote ? `/api/billing/quotes/${encodeURIComponent(record.id)}/pdf?preview=1` : `/api/billing/invoices/${encodeURIComponent(record.id)}/pdf?preview=1`,
    senderName: process.env.BILLING_FROM_NAME || process.env.EMAIL_FROM_NAME || 'TrendSCORE',
    senderEmail: process.env.BILLING_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_FROM || '',
  };
}

function renderBillingEmailHtml(draft) {
  const safe = billingEmailEscape;
  const message = String(draft.message || '').split(/\r?\n/).map(line => line ? `<p style="margin:0 0 14px">${safe(line)}</p>` : '<div style="height:8px"></div>').join('');
  const isQuote = draft.kind === 'quote';
  const label = isQuote ? 'QUOTATION' : draft.isDraftInvoice ? 'DRAFT INVOICE · REVIEW COPY' : 'COMMERCIAL INVOICE';
  const attachment = `${safe(draft.documentName)} · PDF`;
  const amount = `KSh ${Number(draft.amountKsh || 0).toLocaleString('en-KE')}`;
  return `<!doctype html><html><body style="margin:0;background:#f1f4f9;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f4f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#fff;border:1px solid #dce3ee;border-radius:14px;overflow:hidden"><tr><td style="padding:24px 32px;border-bottom:1px solid #e7ebf2"><img src="${safe(draft.logoUrl)}" alt="TrendSCORE" width="150" style="display:block;max-width:150px;height:auto"><div style="margin-top:10px;color:#61708b;font-size:12px;letter-spacing:1.4px;font-weight:bold">BUSINESS SERVICES</div></td></tr><tr><td style="padding:30px 32px 12px"><span style="display:inline-block;padding:7px 10px;background:#eef2ff;color:#18258b;font-size:11px;font-weight:bold;letter-spacing:1px;border-radius:4px">${label}</span><h1 style="margin:16px 0 5px;color:#101b36;font-size:22px;line-height:1.3">${safe(draft.documentNumber)}</h1><div style="color:#66748d;font-size:13px">Prepared for ${safe(draft.customerName)}</div></td></tr><tr><td style="padding:8px 32px 24px;color:#34415a;font-size:14px;line-height:1.75">${message}</td></tr><tr><td style="padding:0 32px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f9fc;border:1px solid #e5eaf2;border-radius:8px"><tr><td style="padding:14px 16px;color:#60708b;font-size:12px">${attachment}</td><td align="right" style="padding:14px 16px;color:#111c39;font-size:14px;font-weight:bold">${amount}</td></tr></table></td></tr><tr><td style="padding:21px 32px;background:#f7f9fc;color:#172033;border-top:1px solid #e7ebf2"><img src="${safe(draft.logoUrl)}" alt="TrendSCORE" width="112" style="display:block;max-width:112px;height:auto;margin-bottom:12px"><div style="font-size:13px;font-weight:bold">${safe(draft.senderName || 'TrendSCORE')}</div><div style="font-size:12px;color:#5f6f89;margin-top:5px">Questions? Reply to this email or reach us at ${safe(draft.senderEmail || 'billing@trendscore.co.ke')}.</div><div style="font-size:11px;color:#7a879b;margin-top:14px">TrendSCORE · School operations, made clearer.</div></td></tr></table><div style="max-width:620px;padding:14px 8px;color:#7a879b;font-size:11px;line-height:1.5;text-align:center">This message and its attached document were prepared for ${safe(draft.customerName)}.</div></td></tr></table></body></html>`;
}

function normalizeBillingEmailDraft(req, defaults) {
  const body = req.body || {};
  const recipient = billingText(Object.prototype.hasOwnProperty.call(body, 'recipient') ? body.recipient : defaults.recipient, 254).toLowerCase();
  const subject = billingText(Object.prototype.hasOwnProperty.call(body, 'subject') ? body.subject : defaults.subject, 180);
  const message = String(req.body?.message ?? defaults.message).replace(/\r\n/g, '\n').trim().slice(0, 5000);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) throw new Error('Enter a valid recipient email address');
  if (!subject) throw new Error('Email subject is required');
  if (!message) throw new Error('Email message is required');
  return { ...defaults, recipient, subject, message };
}

async function deliverQuoteEmail(quote, actor, draftInput = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BILLING_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!apiKey || !fromEmail) throw new Error('Quote email is not configured. Set RESEND_API_KEY and BILLING_FROM_EMAIL (or EMAIL_FROM).');
  const customer = quote.customerSnapshot || {};
  if (!customer.billingEmail && !draftInput.recipient) throw new Error('Add a billing email to this customer before sending the quote');
  const draft = normalizeBillingEmailDraft({ body: draftInput }, billingEmailDraft('quote', quote));
  const pdf = quotePdfBuffer(quote);
  let providerMessageId = '';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${process.env.BILLING_FROM_NAME || process.env.EMAIL_FROM_NAME || 'TrendSCORE'} <${fromEmail}>`,
        to: [draft.recipient], reply_to: process.env.BILLING_REPLY_TO || fromEmail,
        subject: draft.subject,
        text: draft.message,
        html: renderBillingEmailHtml(draft),
        attachments: [{ filename: draft.documentName, content: pdf.toString('base64') }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Email provider returned ${response.status}`);
    providerMessageId = String(payload.id || '');
    billingStore.recordQuoteDelivery({ id: crypto.randomUUID(), quoteId: quote.id, recipient: draft.recipient, actor, providerMessageId, status: 'sent', error: '' });
    return providerMessageId;
  } catch (error) {
    billingStore.recordQuoteDelivery({ id: crypto.randomUUID(), quoteId: quote.id, recipient: draft.recipient, actor, providerMessageId: '', status: 'failed', error: billingText(error.message, 500) });
    throw error;
  }
}

async function deliverDraftInvoiceEmail(invoice, actor, draftInput = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BILLING_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!apiKey || !fromEmail) throw new Error('Invoice email is not configured. Set the server-side Resend key and billing sender address.');
  const customer = invoice.invoiceSnapshot?.customerSnapshot || {};
  if (!customer.billingEmail && !draftInput.recipient) throw new Error('Add a billing email to this customer before sending the draft');
  const draft = normalizeBillingEmailDraft({ body: draftInput }, billingEmailDraft('invoice', invoice));
  const pdf = invoicePdfBuffer(invoice);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${process.env.BILLING_FROM_NAME || process.env.EMAIL_FROM_NAME || 'TrendSCORE'} <${fromEmail}>`,
        to: [draft.recipient], reply_to: process.env.BILLING_REPLY_TO || fromEmail, subject: draft.subject,
        text: draft.message, html: renderBillingEmailHtml(draft), attachments: [{ filename: draft.documentName, content: pdf.toString('base64') }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Email provider returned ${response.status}`);
    const providerMessageId = String(payload.id || '');
    billingStore.recordInvoiceDelivery({ id: crypto.randomUUID(), invoiceId: invoice.id, recipient: draft.recipient, actor, providerMessageId, status: 'sent', error: '' });
    return providerMessageId;
  } catch (error) {
    billingStore.recordInvoiceDelivery({ id: crypto.randomUUID(), invoiceId: invoice.id, recipient: draft.recipient, actor, providerMessageId: '', status: 'failed', error: billingText(error.message, 500) });
    throw error;
  }
}

app.get('/api/billing/customers', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  res.json({ ok: true, customers: billingStore.listCustomers() });
});

app.get('/api/billing/schools', requireAuth, requireRole('super_admin', 'platform_owner'), async (_req, res) => {
  try {
    const manifest = loadDeployManifest();
    const manifestById = new Map((manifest.instances || []).map(instance => [instance.id, instance]));
    const schools = (await buildDeployTargets())
      .filter(target => ['stack', 'main'].includes(target.kind))
      .filter(target => target.tier === 'production')
      .filter(target => {
        const instance = manifestById.get(target.id);
        return !instance || (instance.archived !== true && instance.active !== false
          && !['inactive', 'disabled'].includes(String(instance.status || '').toLowerCase()));
      })
      .map(target => ({ id: target.id, name: target.label, tenantKey: target.id, domain: target.domain || '' }));
    res.json({ ok: true, schools });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Could not load provisioned schools' });
  }
});

app.post('/api/billing/customers', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const customer = normalizeBillingCustomer(req.body);
    if (!customer.name) return res.status(400).json({ error: 'Customer name is required' });
    customer.id = crypto.randomUUID();
    const created = billingStore.createCustomer(customer);
    pushAudit('BILLING_CUSTOMER_CREATE', created.name, req.user.email, `Created billing customer ${created.name}`);
    return res.status(201).json({ ok: true, customer: created });
  } catch (error) {
    const duplicate = String(error.message).includes('UNIQUE constraint failed');
    return res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'That tenant key is already linked to a billing customer' : error.message });
  }
});

app.put('/api/billing/customers/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const customer = normalizeBillingCustomer(req.body);
    if (!customer.name) return res.status(400).json({ error: 'Customer name is required' });
    const updated = billingStore.updateCustomer(req.params.id, customer);
    if (!updated) return res.status(404).json({ error: 'Billing customer not found' });
    pushAudit('BILLING_CUSTOMER_UPDATE', updated.name, req.user.email, `Updated billing customer ${updated.name}`);
    return res.json({ ok: true, customer: updated });
  } catch (error) {
    const duplicate = String(error.message).includes('UNIQUE constraint failed');
    return res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'That tenant key is already linked to a billing customer' : error.message });
  }
});

app.get('/api/billing/contracts', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const customerId = billingText(req.query.customerId, 80);
  res.json({ ok: true, contracts: billingStore.listContracts(customerId) });
});

function writeConsoleEmailSettings(values) {
  const envFilePath = CONSOLE_ENV_FILE;
  if (!fs.existsSync(envFilePath)) {
    throw new Error('The persistent console environment file is unavailable. Ask an operator to check the production console mount.');
  }
  if (fs.lstatSync(envFilePath).isSymbolicLink()) {
    throw new Error('The console environment file must not be a symbolic link.');
  }

  let lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const nextLine = `${key}=${value}`;
    lines = lines.filter(line => !new RegExp(`^\\s*${key}\\s*=`).test(line));
    lines.push(nextLine);
  }

  const temporaryPath = `${envFilePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${lines.join('\n').replace(/\n+$/, '')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, envFilePath);
    fs.chmodSync(envFilePath, 0o600);
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) process.env[key] = value;
    }
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw error;
  }
}

function currentEmailSettings() {
  return {
    keyConfigured: Boolean(process.env.RESEND_API_KEY),
    fromEmail: process.env.BILLING_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_FROM || '',
    fromName: process.env.BILLING_FROM_NAME || process.env.EMAIL_FROM_NAME || 'TrendSCORE',
  };
}

app.get('/api/settings/communications/email', requireAuth, requireRole('super_admin'), (_req, res) => {
  return res.json({ ok: true, ...currentEmailSettings() });
});

app.put('/api/settings/communications/email', requireAuth, requireRole('super_admin'), (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim();
  const fromEmail = String(req.body?.fromEmail || '').trim();
  const fromName = String(req.body?.fromName || 'TrendSCORE').trim();
  if (apiKey && (!/^re_[A-Za-z0-9_-]{8,250}$/.test(apiKey) || /[\r\n]/.test(apiKey))) {
    return res.status(400).json({ ok: false, error: 'Enter a validly formatted Resend API key beginning with re_.' });
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromEmail) || fromEmail.length > 254) {
    return res.status(400).json({ ok: false, error: 'Enter a valid sender email address.' });
  }
  if (/[\r\n]/.test(fromName) || fromName.length > 120) {
    return res.status(400).json({ ok: false, error: 'Sender name must be 120 characters or fewer on one line.' });
  }
  if (!apiKey && !process.env.RESEND_API_KEY) {
    return res.status(400).json({ ok: false, error: 'Paste a Resend API key before saving the first email configuration.' });
  }

  try {
    const values = {
      ...(apiKey ? { RESEND_API_KEY: apiKey } : {}),
      BILLING_FROM_EMAIL: fromEmail,
      BILLING_FROM_NAME: fromName || 'TrendSCORE',
    };
    writeConsoleEmailSettings(values);
    pushAudit('COMMUNICATIONS_EMAIL_SETTINGS', 'Communications', req.user.email, `Updated Resend sender settings for ${fromEmail}`);
    return res.json({ ok: true, ...currentEmailSettings() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Could not save email settings on the server.' });
  }
});

app.post('/api/settings/communications/email/test', requireAuth, requireRole('super_admin'), async (_req, res) => {
  const { keyConfigured, fromEmail } = currentEmailSettings();
  if (!keyConfigured || !fromEmail) return res.status(400).json({ ok: false, error: 'Save a Resend API key and sender address first.' });
  try {
    const response = await fetch('https://api.resend.com/domains?limit=100', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = response.status === 401 || response.status === 403
        ? 'Resend rejected this API key. Replace it with a valid key.'
        : `Resend connection check failed (HTTP ${response.status}).`;
      return res.status(502).json({ ok: false, error });
    }
    const senderDomain = fromEmail.split('@').pop().toLowerCase();
    const domainEntry = (Array.isArray(payload.data) ? payload.data : []).find(item => {
      const domain = String(item.name || '').toLowerCase();
      return senderDomain === domain || senderDomain.endsWith(`.${domain}`);
    });
    const verified = domainEntry?.status === 'verified'
      && (!domainEntry.capabilities?.sending || domainEntry.capabilities.sending === 'enabled');
    pushAudit('COMMUNICATIONS_EMAIL_TEST', 'Communications', 'system', `Checked Resend configuration for ${fromEmail}: ${verified ? 'verified' : 'domain needs verification'}`);
    return res.json({ ok: true, verified, fromEmail, domain: domainEntry?.name || senderDomain, domainStatus: domainEntry?.status || 'not found' });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.name === 'TimeoutError' ? 'Resend validation timed out.' : 'Could not reach Resend to validate the saved configuration.' });
  }
});

app.get('/api/billing/email-status', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  const config = currentEmailSettings();
  res.json({ ok: true, configured: Boolean(config.keyConfigured && config.fromEmail) });
});

app.get('/api/billing/quotes', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  res.json({ ok: true, quotes: billingStore.listQuotes(), deliveries: billingStore.listQuotes().map(quote => ({ quoteId: quote.id, attempts: billingStore.listQuoteDeliveries(quote.id) })) });
});

app.post('/api/billing/quotes/preview', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const quote = calculateQuote(req.body);
    return res.json({ ok: true, subtotalKsh: quote.subtotalKsh, lines: quote.lines, pricingDescription: quote.pricingDescription, taxNote: quote.taxNote });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.post('/api/billing/quotes', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const customerId = billingText(req.body.customerId, 80);
    const customer = billingStore.getCustomer(customerId);
    if (!customer) return res.status(404).json({ ok: false, error: 'Select a saved billing customer first' });
    if (customer.currency !== 'KES') return res.status(400).json({ ok: false, error: 'The approved school rate card is in KSh. Set this customer currency to KES before quoting.' });
    const quoteSnapshot = calculateQuote(req.body);
    const quote = billingStore.createQuote({
      id: crypto.randomUUID(),
      quoteNumber: `Q-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      customerId,
      customerSnapshot: {
        name: customer.name, legalName: customer.legalName, tenantKey: customer.tenantKey,
        billingEmail: customer.billingEmail, billingPhone: customer.billingPhone,
        billingAddress: customer.billingAddress, taxIdentifier: customer.taxIdentifier, currency: customer.currency,
      },
      quoteSnapshot,
      enrollmentCount: quoteSnapshot.enrollmentCount,
      pricingModel: quoteSnapshot.pricingModel,
      billingCadence: quoteSnapshot.billingCadence,
      subtotalKsh: quoteSnapshot.subtotalKsh,
      expiresOn: quoteSnapshot.expiresOn,
      notes: quoteSnapshot.notes,
      createdBy: req.user.email,
    });
    pushAudit('BILLING_QUOTE_CREATE', customer.name, req.user.email, `Created ${quote.quoteNumber} for KSh ${quote.subtotalKsh}`);
    return res.status(201).json({ ok: true, quote });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.put('/api/billing/quotes/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const existing = billingStore.getQuote(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Quote not found' });
    if (existing.status !== 'draft' || existing.sentAt || existing.cancelledAt) return res.status(409).json({ ok: false, error: 'Only an unsent draft quote can be edited. Create a revision for a quote already sent.' });
    const customerId = billingText(req.body.customerId, 80);
    const customer = billingStore.getCustomer(customerId);
    if (!customer) return res.status(404).json({ ok: false, error: 'Select a saved billing customer first' });
    if (customer.currency !== 'KES') return res.status(400).json({ ok: false, error: 'The approved school rate card is in KSh. Set this customer currency to KES before quoting.' });
    const quoteSnapshot = calculateQuote(req.body);
    const updated = billingStore.updateQuote(existing.id, {
      customerId,
      customerSnapshot: { name: customer.name, legalName: customer.legalName, tenantKey: customer.tenantKey,
        billingEmail: customer.billingEmail, billingPhone: customer.billingPhone, billingAddress: customer.billingAddress,
        taxIdentifier: customer.taxIdentifier, currency: customer.currency },
      quoteSnapshot, enrollmentCount: quoteSnapshot.enrollmentCount, pricingModel: quoteSnapshot.pricingModel,
      billingCadence: quoteSnapshot.billingCadence, subtotalKsh: quoteSnapshot.subtotalKsh,
      expiresOn: quoteSnapshot.expiresOn, notes: quoteSnapshot.notes,
    });
    if (!updated) return res.status(409).json({ ok: false, error: 'This quote can no longer be edited' });
    pushAudit('BILLING_QUOTE_UPDATE', customer.name, req.user.email, `Updated unsent draft ${updated.quoteNumber}`);
    return res.json({ ok: true, quote: updated });
  } catch (error) { return res.status(400).json({ ok: false, error: error.message }); }
});

app.delete('/api/billing/quotes/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  if (!billingStore.deleteDraftQuote(quote.id)) return res.status(409).json({ ok: false, error: 'Only an unsent draft with no email attempts or invoice can be deleted. Cancel sent or accepted quotes to preserve their history.' });
  pushAudit('BILLING_QUOTE_DELETE', quote.customerSnapshot?.name || quote.customerId, req.user.email, `Deleted unsent draft ${quote.quoteNumber}`, 'Warning');
  return res.json({ ok: true });
});

app.post('/api/billing/quotes/:id/cancel', requireAuth, requireRole('super_admin'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  const reason = billingText(req.body.reason, 500);
  if (!reason) return res.status(400).json({ ok: false, error: 'Enter a reason for cancelling this quote' });
  const cancelled = billingStore.cancelQuote(quote.id, req.user.email, reason);
  if (!cancelled) return res.status(409).json({ ok: false, error: 'This quote cannot be cancelled after an invoice exists or after it reached a final state' });
  pushAudit('BILLING_QUOTE_CANCEL', quote.customerSnapshot?.name || quote.customerId, req.user.email, `Cancelled ${quote.quoteNumber}: ${reason}`, 'Warning');
  return res.json({ ok: true, quote: cancelled });
});

app.get('/api/billing/quotes/:id/pdf', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  const pdf = quotePdfBuffer(quote);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.preview === '1' ? 'inline' : 'attachment'}; filename="${quote.quoteNumber}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
});

app.get('/api/billing/quotes/:id/email-preview', requireAuth, requireRole('super_admin'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  if (!['draft', 'sent'].includes(quote.status) || quote.cancelledAt) return res.status(409).json({ ok: false, error: 'Only active draft or sent quotes can be emailed' });
  const draft = billingEmailDraft('quote', quote);
  return res.json({ ok: true, draft: { ...draft, html: renderBillingEmailHtml(draft) } });
});

app.post('/api/billing/quotes/:id/send', requireAuth, requireRole('super_admin'), async (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  if (!['draft', 'sent'].includes(quote.status) || quote.cancelledAt) return res.status(409).json({ ok: false, error: 'Only active draft or sent quotes can be emailed' });
  try {
    const deliveredTo = billingText(req.body?.recipient || quote.customerSnapshot.billingEmail, 254).toLowerCase();
    await deliverQuoteEmail(quote, req.user.email, req.body || {});
    pushAudit('BILLING_QUOTE_SEND', quote.customerSnapshot.name, req.user.email, `Emailed ${quote.quoteNumber} to ${deliveredTo}`);
    return res.json({ ok: true, quote: billingStore.getQuote(quote.id), deliveries: billingStore.listQuoteDeliveries(quote.id) });
  } catch (error) {
    pushAudit('BILLING_QUOTE_SEND_FAILED', quote.customerSnapshot.name, req.user.email, `Email attempt failed for ${quote.quoteNumber}: ${billingText(error.message, 300)}`, 'Warning');
    return res.status(502).json({ ok: false, error: error.message || 'Could not send quote email', deliveries: billingStore.listQuoteDeliveries(quote.id) });
  }
});

app.post('/api/billing/quotes/:id/accept', requireAuth, requireRole('super_admin'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  if (!['draft', 'sent'].includes(quote.status) || quote.cancelledAt) return res.status(409).json({ ok: false, error: `Quote is ${quote.status} and cannot be marked accepted` });
  if (quote.expiresOn && quote.expiresOn < new Date().toISOString().slice(0, 10)) {
    billingStore.setQuoteStatus(quote.id, 'expired');
    return res.status(409).json({ ok: false, error: 'This quote has expired. Create a new quote before recording acceptance.' });
  }
  const updated = billingStore.setQuoteStatus(quote.id, 'accepted');
  pushAudit('BILLING_QUOTE_ACCEPT', quote.customerSnapshot.name, req.user.email, `Recorded acceptance of ${quote.quoteNumber}`);
  return res.json({ ok: true, quote: updated });
});

app.post('/api/billing/quotes/:id/convert', requireAuth, requireRole('super_admin'), (req, res) => {
  const quote = billingStore.getQuote(req.params.id);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found' });
  if (quote.status !== 'accepted' && quote.status !== 'converted') return res.status(409).json({ ok: false, error: 'Record customer acceptance before creating a draft invoice' });
  const existing = billingStore.getInvoiceForQuote(quote.id);
  if (existing) {
    billingStore.setQuoteStatus(quote.id, 'converted');
    return res.json({ ok: true, invoice: existing, alreadyCreated: true });
  }
  try {
    const invoice = billingStore.createDraftInvoice({
      id: crypto.randomUUID(), invoiceNumber: `DRAFT-${quote.quoteNumber}`, quoteId: quote.id,
      customerId: quote.customerId, invoiceSnapshot: {
        source: 'accepted_quote', quoteNumber: quote.quoteNumber, enrollmentCount: quote.enrollmentCount,
        customerSnapshot: quote.customerSnapshot, quoteSnapshot: quote.quoteSnapshot,
        acceptedAt: new Date().toISOString(), taxNote: quote.quoteSnapshot.taxNote,
      }, amountKsh: quote.subtotalKsh, createdBy: req.user.email,
    });
    billingStore.setQuoteStatus(quote.id, 'converted');
    pushAudit('BILLING_INVOICE_DRAFT', quote.customerSnapshot.name, req.user.email, `Created draft invoice from ${quote.quoteNumber}`);
    return res.status(201).json({ ok: true, invoice });
  } catch (error) {
    const recovered = billingStore.getInvoiceForQuote(quote.id);
    if (recovered) return res.json({ ok: true, invoice: recovered, alreadyCreated: true });
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/billing/invoices', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  const invoices = billingStore.listInvoices();
  res.json({ ok: true, invoices, deliveries: invoices.map(invoice => ({ invoiceId: invoice.id, attempts: billingStore.listInvoiceDeliveries(invoice.id) })) });
});

app.get('/api/billing/payments', requireAuth, requireRole('super_admin', 'platform_owner'), (_req, res) => {
  return res.json({ ok: true, payments: billingStore.listPayments() });
});

app.get('/api/billing/payments/:id/receipt', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const payment = billingStore.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ ok: false, error: 'Payment record not found' });
  const invoice = billingStore.getInvoice(payment.invoiceId);
  if (!invoice) return res.status(404).json({ ok: false, error: 'Linked invoice was not found' });
  const receiptNumber = `RCPT-${String(payment.paymentDate || '').replace(/-/g, '')}-${String(payment.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const pdf = paymentReceiptPdfBuffer({ ...payment, receiptNumber }, invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${receiptNumber}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
});

app.post('/api/billing/payments', requireAuth, requireRole('super_admin'), (req, res) => {
  const invoiceId = billingText(req.body?.invoiceId, 80);
  const amountKsh = Number(req.body?.amountKsh);
  const paymentDate = billingText(req.body?.paymentDate, 10);
  const method = billingText(req.body?.method, 30);
  const reference = billingText(req.body?.reference, 120);
  const notes = billingText(req.body?.notes, 500);
  if (!invoiceId) return res.status(400).json({ ok: false, error: 'Select an issued invoice' });
  if (!Number.isSafeInteger(amountKsh) || amountKsh <= 0) return res.status(400).json({ ok: false, error: 'Enter a whole amount in KSh greater than zero' });
  const parsedPaymentDate = new Date(`${paymentDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !Number.isFinite(parsedPaymentDate.getTime()) || parsedPaymentDate.toISOString().slice(0, 10) !== paymentDate) return res.status(400).json({ ok: false, error: 'Enter a valid payment date' });
  if (!['mpesa', 'bank_transfer', 'cash', 'cheque', 'other'].includes(method)) return res.status(400).json({ ok: false, error: 'Choose a supported payment method' });
  try {
    const payment = billingStore.recordPayment({ id: crypto.randomUUID(), invoiceId, amountKsh, paymentDate, method, reference, notes, recordedBy: req.user.email });
    const invoice = billingStore.getInvoice(invoiceId);
    pushAudit('BILLING_PAYMENT_RECORD', invoice?.customerId || invoiceId, req.user.email, `Recorded KSh ${amountKsh.toLocaleString('en-KE')} payment against ${invoice?.invoiceNumber || invoiceId}${reference ? ` · reference ${reference}` : ''}`);
    return res.status(201).json({ ok: true, payment, invoice });
  } catch (error) {
    return res.status(409).json({ ok: false, error: error.message || 'Could not record payment' });
  }
});

app.put('/api/billing/invoices/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const dueDate = billingText(req.body.dueDate, 10); const termsNote = billingText(req.body.termsNote, 1000);
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || new Date(`${dueDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== dueDate)) return res.status(400).json({ ok: false, error: 'Due date must be a valid date in YYYY-MM-DD format' });
  const invoice = billingStore.updateDraftInvoice(req.params.id, { dueDate, termsNote });
  if (!invoice) return res.status(409).json({ ok: false, error: 'Only draft invoices can be edited' });
  pushAudit('BILLING_INVOICE_UPDATE', invoice.customerId, req.user.email, `Updated draft invoice details ${invoice.invoiceNumber}`);
  return res.json({ ok: true, invoice });
});

app.post('/api/billing/invoices/:id/issue', requireAuth, requireRole('super_admin'), (req, res) => {
  const existing = billingStore.getInvoice(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Invoice not found' });
  if (existing.status !== 'draft') return res.status(409).json({ ok: false, error: 'Only a draft invoice can be issued' });
  const invoiceNumber = `INV-${String(existing.invoiceSnapshot?.quoteNumber || existing.invoiceNumber.replace(/^DRAFT-/, '')).replace(/^Q-/, '')}`;
  try {
    const invoice = billingStore.issueDraftInvoice(existing.id, invoiceNumber, new Date().toISOString());
    if (!invoice) return res.status(409).json({ ok: false, error: 'This invoice has already been issued or changed' });
    pushAudit('BILLING_INVOICE_ISSUE', invoice.customerId, req.user.email, `Issued commercial invoice ${invoice.invoiceNumber}; tax invoice/eTIMS is not represented`);
    return res.json({ ok: true, invoice });
  } catch (error) {
    return res.status(409).json({ ok: false, error: error.message || 'Could not issue invoice' });
  }
});

app.post('/api/billing/invoices/:id/cancel', requireAuth, requireRole('super_admin'), (req, res) => {
  const reason = billingText(req.body.reason, 500);
  if (!reason) return res.status(400).json({ ok: false, error: 'Enter a reason for cancelling this draft invoice' });
  const invoice = billingStore.cancelDraftInvoice(req.params.id, req.user.email, reason);
  if (!invoice) return res.status(409).json({ ok: false, error: 'Only draft invoices can be cancelled' });
  pushAudit('BILLING_INVOICE_CANCEL', invoice.customerId, req.user.email, `Cancelled draft ${invoice.invoiceNumber}: ${reason}`, 'Warning');
  return res.json({ ok: true, invoice });
});

app.get('/api/billing/invoices/:id/email-preview', requireAuth, requireRole('super_admin'), (req, res) => {
  const invoice = billingStore.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
  if (!['draft', 'issued', 'sent', 'paid'].includes(invoice.status)) return res.status(409).json({ ok: false, error: 'This invoice cannot be emailed in its current status' });
  const draft = billingEmailDraft('invoice', invoice);
  return res.json({ ok: true, draft: { ...draft, html: renderBillingEmailHtml(draft) } });
});

app.post('/api/billing/invoices/:id/send-review-email', requireAuth, requireRole('super_admin'), async (req, res) => {
  const invoice = billingStore.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
  if (!['draft', 'issued', 'sent', 'paid'].includes(invoice.status)) return res.status(409).json({ ok: false, error: 'This invoice cannot be emailed in its current status' });
  try {
    const deliveredTo = billingText(req.body?.recipient || invoice.invoiceSnapshot?.customerSnapshot?.billingEmail, 254).toLowerCase();
    await deliverDraftInvoiceEmail(invoice, req.user.email, req.body || {});
    pushAudit(invoice.status === 'draft' ? 'BILLING_INVOICE_REVIEW_SEND' : 'BILLING_INVOICE_SEND', invoice.customerId, req.user.email, `Emailed ${invoice.status === 'draft' ? 'draft review copy' : 'commercial invoice'} ${invoice.invoiceNumber} to ${deliveredTo}`);
    return res.json({ ok: true, deliveries: billingStore.listInvoiceDeliveries(invoice.id) });
  } catch (error) {
    pushAudit('BILLING_INVOICE_SEND_FAILED', invoice.customerId, req.user.email, `Invoice email failed for ${invoice.invoiceNumber}: ${billingText(error.message, 300)}`, 'Warning');
    return res.status(502).json({ ok: false, error: error.message || 'Could not send invoice email', deliveries: billingStore.listInvoiceDeliveries(invoice.id) });
  }
});

app.get('/api/billing/invoices/:id/pdf', requireAuth, requireRole('super_admin', 'platform_owner'), (req, res) => {
  const invoice = billingStore.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
  const pdf = invoicePdfBuffer(invoice);
  const filename = String(invoice.invoiceNumber || 'draft-invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.preview === '1' ? 'inline' : 'attachment'}; filename="${filename}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
});

app.post('/api/billing/customers/:id/contracts', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    if (!billingStore.getCustomer(req.params.id)) return res.status(404).json({ error: 'Billing customer not found' });
    const contract = normalizeBillingContract(req.body, req.params.id);
    validateBillingDates(contract);
    if (!contract.serviceDescription) return res.status(400).json({ error: 'Service description is required' });
    contract.id = crypto.randomUUID();
    const created = billingStore.createContract(contract);
    pushAudit('BILLING_CONTRACT_CREATE', req.params.id, req.user.email, `Created contract ${created.reference || created.id}`);
    return res.status(201).json({ ok: true, contract: created });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.put('/api/billing/contracts/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const existing = billingStore.listContracts().find(item => item.id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contract not found' });
    const contract = normalizeBillingContract(req.body, existing.customerId);
    validateBillingDates(contract);
    if (!contract.serviceDescription) return res.status(400).json({ error: 'Service description is required' });
    const updated = billingStore.updateContract(req.params.id, contract);
    pushAudit('BILLING_CONTRACT_UPDATE', existing.customerId, req.user.email, `Updated contract ${updated.reference || updated.id}`);
    return res.json({ ok: true, contract: updated });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Only the public/ dir is served statically — server.js, auth-config.js, .env,
// data/*.store.json and everything else in __dirname stay unreachable over HTTP.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Trends CORE Control Panel  →  http://localhost:${PORT}`);
  console.log(`Users configured: ${USERS.map(u => `${u.email} (${u.role})`).join(', ') || 'none'}`);
  console.log(`JWT expires: ${JWT_EXPIRES_IN} · Secure cookie: ${COOKIE_SECURE}`);
  console.log(`Host metrics: ${os.hostname()} · docker host ${process.env.DOCKER_HOST ? 'tcp://localhost:2375' : '/var/run/docker.sock'}`);
  console.log(`Audit log: ${AUDIT_STORE_FILE} (persisted, max ${MAX_AUDIT_ENTRIES} entries)`);
});

module.exports = { requireAuth, requireRole };
