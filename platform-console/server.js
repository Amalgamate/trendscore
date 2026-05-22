const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { execFile } = require('child_process');
const Docker = require('dockerode');
const si = require('systeminformation');

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
const COOKIE_NAME = 'trends_core_token';
const COOKIE_SECURE = process.env.CONSOLE_COOKIE_SECURE === 'true';
const docker = process.env.DOCKER_HOST
  ? new Docker({ host: 'localhost', port: 2375, protocol: 'http' })
  : new Docker();

const APP_VERSION = process.env.CONSOLE_APP_VERSION || 'live';
const INSTANCE_PROVISION_SCRIPT = process.env.CONSOLE_INSTANCE_PROVISION_SCRIPT || '';
const NGINX_SITES_DIR = process.env.CONSOLE_NGINX_SITES_DIR || '/etc/nginx/sites-enabled';
const DEFAULT_DOMAIN_SUFFIX = process.env.CONSOLE_DEFAULT_DOMAIN_SUFFIX || 'elimcrown.co.ke';

// ── Persistent stores ─────────────────────────────────────────────────────
const CONSOLE_DATA_DIR = process.env.CONSOLE_DATA_DIR || __dirname;
fs.mkdirSync(CONSOLE_DATA_DIR, { recursive: true });
const LEADS_STORE_FILE = path.join(CONSOLE_DATA_DIR, 'leads.store.json');
const AUDIT_STORE_FILE = path.join(CONSOLE_DATA_DIR, 'audit.store.json');
const MAX_AUDIT_ENTRIES = 2000;

// In-memory deployment log (ephemeral — only tracks this process session)
const deploymentLog = [];

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
const APP_TYPE_SET = new Set(['school', 'odoo', 'wordpress', 'sacco', 'hospital', 'hotel', 'organization']);

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
  res.json({ ok: true, service: 'zawadi-platform-console' });
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

app.post('/api/login', (req, res) => {
  if (!JWT_SECRET || USERS.length === 0) {
    return res.status(503).json({ error: 'Console authentication is not configured.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const payload = { email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: COOKIE_SECURE,
    maxAge: 8 * 60 * 60 * 1000,
  });

  pushAudit('LOGIN', 'Console', user.email, `User logged in`, 'Success');
  return res.json({ ok: true, user: { email: user.email, role: user.role, name: user.name }, access: ROLE_ACCESS[user.role] || [] });
});

app.post('/api/logout', requireAuth, (req, res) => {
  pushAudit('LOGOUT', 'Console', req.user.email, `User logged out`, 'Success');
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  return res.json({ user: { email: req.user.email, role: req.user.role, name: req.user.name }, access: ROLE_ACCESS[req.user.role] || [] });
});

function humanizeInstanceName(raw) {
  if (!raw) return 'Unknown Instance';
  const clean = raw.replace(/^\//, '').replace(/^trends[-_]?core[-_]?/i, '').replace(/^zawadi[-_]?/i, '');
  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || raw;
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

async function buildAutoAllocation({ name, appType, appRange, instances }) {
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
  const domain = nextAvailableDomain(baseSlug, knownDomains);
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
  for (const i of instances) {
    i.domain = (i.fe && nginxMap.byFePort[i.fe]) || (i.be && nginxMap.byBePort[i.be]) || i.domain || '';
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
  const volumeBytes = Array.isArray(dockerDf?.Volumes)
    ? dockerDf.Volumes.reduce((s, v) => s + Number(v?.UsageData?.Size || 0), 0)
    : 0;

  const metrics = {
    liveSchools: instances.filter(i => i.hasFrontend && i.hasBackend && i.hasDatabase).length,
    containersHealthy: `${instances.reduce((s, i) => s + i.runningContainers, 0)}/${Math.max(1, instances.reduce((s, i) => s + i.containers, 0))}`,
    storageUsedGb: dockerDf
      ? Number((((imageBytes + volumeBytes) / (1024 ** 3))).toFixed(2))
      : Number(instances.reduce((s, i) => s + i.storage, 0).toFixed(2)),
    imagesGb: Number((imageBytes / (1024 ** 3)).toFixed(2)),
    volumesGb: Number((volumeBytes / (1024 ** 3)).toFixed(2)),
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
      deployments: deploymentLog.slice(0, 50),
      auditLogs: readAuditStore().slice(0, 200),
      mode: 'live',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: `Runtime fetch failed: ${error.message}` });
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
    });
    return res.json({ ok: true, autoAssigned });
  } catch (error) {
    return res.status(400).json({ error: `Auto-assignment failed: ${error.message}` });
  }
});

app.post('/api/instances/preflight', requireAuth, requireRole('super_admin'), async (req, res) => {
  const {
    appType = 'school',
    name = '',
    image = '',
  } = req.body || {};

  const normalizedAppType = String(appType || 'school').toLowerCase();
  const appRange = APP_PORT_RANGES[normalizedAppType] || APP_PORT_RANGES.school;
  const issues = [];
  const warnings = [];

  if (!APP_TYPE_SET.has(normalizedAppType)) {
    issues.push('Unsupported app type.');
  }

  if (!String(name || '').trim()) issues.push('Instance name is required.');

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
    if (action === 'start') await container.start().catch(() => undefined);
    if (action === 'stop') await container.stop({ t: 10 }).catch(() => undefined);
    if (action === 'drop') await container.remove({ force: true }).catch(() => undefined);
    if (action === 'restart' || action === 'redeploy') await container.restart({ t: 10 }).catch(() => undefined);
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
    db,
  } = req.body || {};

  const normalizedAppType = String(appType || 'school').toLowerCase();
  const appRange = APP_PORT_RANGES[normalizedAppType] || APP_PORT_RANGES.school;
  if (!APP_TYPE_SET.has(normalizedAppType)) {
    return res.status(400).json({ error: 'Unsupported appType.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
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
  if (action === 'start-all' || action === 'stop-all' || action === 'redeploy-all') {
    try {
      const { instances } = await collectRuntime();
      for (const i of instances) {
        if (action === 'start-all') await applyInstanceAction(i.key, 'start');
        if (action === 'stop-all') await applyInstanceAction(i.key, 'stop');
        if (action === 'redeploy-all') await applyInstanceAction(i.key, 'redeploy');
      }
      pushAudit(action.toUpperCase(), 'All Instances', req.user.email, `Bulk action ${action} completed`, 'Warning');
      return res.json({ ok: true, action, status: 'done' });
    } catch (error) {
      return res.status(500).json({ error: `Bulk action failed: ${error.message}` });
    }
  }

  return res.json({ ok: true, action, status: 'accepted' });
});

// ── Audit log endpoint (now reads from file) ──────────────────────────────
app.get('/api/audit-logs', requireAuth, (req, res) => {
  const logs = readAuditStore();
  const limit = Math.min(Number(req.query.limit) || 200, MAX_AUDIT_ENTRIES);
  res.json({ ok: true, logs: logs.slice(0, limit), total: logs.length });
});

app.get('/api/deployments', requireAuth, (_req, res) => {
  res.json({ ok: true, deployments: deploymentLog.slice(0, 50) });
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

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Trends CORE Control Panel  →  http://localhost:${PORT}`);
  console.log(`Users configured: ${USERS.map(u => `${u.email} (${u.role})`).join(', ') || 'none'}`);
  console.log(`JWT expires: ${JWT_EXPIRES_IN} · Secure cookie: ${COOKIE_SECURE}`);
  console.log(`Host metrics: ${os.hostname()} · docker host ${process.env.DOCKER_HOST ? 'tcp://localhost:2375' : '/var/run/docker.sock'}`);
  console.log(`Audit log: ${AUDIT_STORE_FILE} (persisted, max ${MAX_AUDIT_ENTRIES} entries)`);
});

module.exports = { requireAuth, requireRole };
