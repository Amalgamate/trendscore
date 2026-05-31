// Trends CORE Control Panel demo shell.
// This file keeps the current console interactive while the real control API is
// still being built. No Docker or billing action is executed from this demo UI.

// Demo data
let INSTANCES = [
  {
    name: 'Trends CORE Main',
    domain: 'core.trendscore.co.ke',
    status: 'Online',
    type: 'PRIMARY_CBC',
    typeLabel: 'Junior CBC',
    created: '2026-04-27',
    version: '91a4982',
    fe: 3000,
    be: 5000,
    db: 'trends_core_main',
    storage: 2.1,
    dbGb: 0.42,
    uploads: 1.2,
    backups: 0.48,
    containers: 3,
    planId: 'professional',
    billingCycle: 'Monthly',
    nextRenewal: '2026-05-29',
    billingStatus: 'Active',
  },
  {
    name: 'School B',
    domain: 'schoolb.trendscore.co.ke',
    status: 'Online',
    type: 'SECONDARY',
    typeLabel: 'Senior CBC',
    created: '2026-04-28',
    version: '91a4982',
    fe: 3001,
    be: 5001,
    db: 'trends_core_school_b',
    storage: 1.3,
    dbGb: 0.18,
    uploads: 0.61,
    backups: 0.51,
    containers: 3,
    planId: 'standard',
    billingCycle: 'Termly',
    nextRenewal: '2026-06-12',
    billingStatus: 'Active',
  },
  {
    name: 'School C',
    domain: 'schoolc.trendscore.co.ke',
    status: 'Degraded',
    type: 'TERTIARY',
    typeLabel: 'Tertiary',
    created: '2026-04-28',
    version: '91a4982',
    fe: 3002,
    be: 5002,
    db: 'trends_core_school_c',
    storage: 1.6,
    dbGb: 0.21,
    uploads: 0.76,
    backups: 0.63,
    containers: 2,
    planId: 'starter',
    billingCycle: 'Monthly',
    nextRenewal: '2026-05-08',
    billingStatus: 'Due Soon',
  },
];

const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    badge: 'Entry',
    monthly: 8000,
    termly: 22000,
    annual: 84000,
    maxStudents: '250',
    storageLimit: '5 GB',
    status: 'active',
    featured: false,
    features: ['Core school setup', 'Learner records', 'Basic fee tracking', 'Attendance', 'Email support'],
  },
  {
    id: 'standard',
    name: 'Standard',
    badge: 'Core',
    monthly: 14000,
    termly: 38000,
    annual: 145000,
    maxStudents: '600',
    storageLimit: '12 GB',
    status: 'active',
    featured: false,
    features: ['Core school setup', 'Learner records', 'Fee tracking', 'Attendance', 'Assessments', 'Parent portal', 'SMS notifications'],
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Most Popular',
    monthly: 25000,
    termly: 68000,
    annual: 260000,
    maxStudents: '1,500',
    storageLimit: '30 GB',
    status: 'active',
    featured: true,
    features: ['Everything in Standard', 'Advanced dashboards', 'Inventory', 'HR overview', 'Custom domain', 'Priority support', 'Audit logs'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    badge: 'Scale',
    monthly: 45000,
    termly: 125000,
    annual: 480000,
    maxStudents: 'Unlimited',
    storageLimit: 'Custom',
    status: 'draft',
    featured: false,
    features: ['Everything in Professional', 'Multi-campus reporting', 'Dedicated onboarding', 'Custom storage', 'SLA support', 'API access'],
  },
];

const PLATFORM_MODULES = [
  { id: 'admissions', name: 'Admissions', desc: 'Student registration and enrollment', enabled: true },
  { id: 'fees', name: 'Fees & Billing', desc: 'Invoices, balances and payments', enabled: true },
  { id: 'attendance', name: 'Attendance', desc: 'Daily attendance tracking', enabled: true },
  { id: 'assessments', name: 'Assessments', desc: 'CBC assessment workflows', enabled: true },
  { id: 'inventory', name: 'Inventory', desc: 'Stock and asset records', enabled: true },
  { id: 'hr', name: 'HR Overview', desc: 'Staff and payroll overview', enabled: false },
  { id: 'ai', name: 'AI Smart Insights', desc: 'Automated school insights', enabled: true },
];

let DEPLOYMENTS = [
  { time: '10:47 EAT', title: 'Trends CORE v1 - initial release', copy: 'Frontend + backend images published, all live instances redeployed.' },
  { time: '10:36 EAT', title: 'Health check retries enabled', copy: 'Deploy script now waits for services to warm up before failing.' },
  { time: '10:20 EAT', title: 'All instances moved to GHCR images', copy: 'Main, School B, and School C use the shared latest images.' },
  { time: '09:55 EAT', title: 'Institution setup wizard shipped', copy: 'After factory reset, super admin is redirected to institution picker.' },
  { time: '09:30 EAT', title: 'Core apps auto-activation on lock', copy: 'PRIMARY_CBC, SECONDARY, TERTIARY each activate 9 core modules on confirm.' },
];

let AUDIT_LOGS = [
  { time: '10:47 EAT', action: 'Redeploy', instance: 'All Instances', by: 'system@trendscore.app', details: 'Latest GHCR images deployed', status: 'Success' },
  { time: '10:36 EAT', action: 'Config Update', instance: 'Trends CORE Main', by: 'admin@trendscore.app', details: 'Health retry window changed', status: 'Success' },
  { time: '10:20 EAT', action: 'Image Pull', instance: 'School B', by: 'system@trendscore.app', details: 'Frontend and backend image pull', status: 'Success' },
  { time: '09:55 EAT', action: 'Restart', instance: 'School C', by: 'admin@trendscore.app', details: 'Manual restart after degraded check', status: 'Warning' },
];

const FEATURE_MATRIX = [
  'Core school setup',
  'Learner records',
  'Fee tracking',
  'Attendance',
  'Assessments',
  'Parent portal',
  'SMS notifications',
  'Advanced dashboards',
  'Inventory',
  'HR overview',
  'Custom domain',
  'Audit logs',
  'API access',
];

const DEFAULT_LEADS = [
  { id: 'L1', name: 'Mary Wanjiku', phone: '+254 712 345 678', school: 'Sunshine Academy', stage: 'new', priority: '2', students: 350, tags: ['CBC'], systems: { assessment: 'Manual', fees: 'Excel', lms: 'None' }, nextActivity: 'Call tomorrow', notes: 'Interested in core modules.', created: '2026-05-15' },
  { id: 'L2', name: 'John Doe', phone: '+254 799 123 456', school: 'Pioneer High', stage: 'contacted', priority: '3', students: 800, tags: ['Large School', 'Urgent'], systems: { assessment: 'Zeraki', fees: 'Manual', lms: 'Google Classroom' }, nextActivity: 'Demo scheduled', notes: 'Looking to replace Zeraki.', created: '2026-05-16' },
  { id: 'L3', name: 'Sarah Musyoka', phone: '+254 722 000 111', school: 'Greenfield Primary', stage: 'interested', priority: '2', students: 200, tags: ['Follow-up'], systems: { assessment: 'None', fees: 'None', lms: 'None' }, nextActivity: 'Send quote', notes: 'Wants the Starter plan.', created: '2026-05-10' },
  { id: 'L4', name: 'Peter Omondi', phone: '+254 700 999 888', school: 'Nairobi Heights', stage: 'converted', priority: '3', students: 1200, tags: ['Client'], systems: { assessment: 'Trends CORE', fees: 'Trends CORE', lms: 'Trends CORE' }, nextActivity: 'Onboarding', notes: 'Signed 1 year contract.', created: '2026-04-20' },
  { id: 'L5', name: 'Jane Kamau', phone: '+254 733 444 555', school: 'Hilltop Secondary', stage: 'new', priority: '1', students: 150, tags: [], systems: { assessment: 'Manual', fees: 'Manual', lms: 'None' }, nextActivity: 'Initial contact', notes: 'Found us via web search.', created: '2026-05-17' }
];
let LEADS = [...DEFAULT_LEADS];

// Helpers
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));
const fmt = value => parseFloat(value).toFixed(1).replace(/\.0$/, '');
const money = value => new Intl.NumberFormat('en-KE').format(value);
const slugify = value => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nowLabel = () => new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) + ' EAT';
const fmtDate = value => new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00'));
const statusCls = status => status === 'Online' || status === 'Active' || status === 'Success' ? 'online' : status === 'Degraded' || status === 'Warning' || status === 'Due Soon' ? 'warn' : 'offline';
const findPlan = id => PRICING_PLANS.find(plan => plan.id === id) || PRICING_PLANS[0];

let toastTimer;
let installProgressTimer = null;
let runtimePollTimer = null;
let runtimePollBusy = false;
let pendingProvisionLeadId = null;
let selectedInstanceName = INSTANCES[0]?.name || '';
let pendingConfirm = null;
let editingPlanId = null;
let liveMode = false;
let RUNTIME_METRICS = null;
const DOMAIN_OVERRIDES = {
  amalgamate: 'amalgamate.trendscore.co.ke',
  console: 'console.trendscore.co.ke',
  demo: 'demoschool.trendscore.co.ke',
  demoschool: 'demoschool.trendscore.co.ke',
  'demo-school': 'demoschool.trendscore.co.ke',
  ighs: 'ighs.trendscore.co.ke',
  jrn: 'jrn.trendscore.co.ke',
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
  naet: 'naet.trendscore.co.ke',
  zawadi: 'zawadi.trendscore.co.ke',
};

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function addAudit({ action, instance, details, status = 'Success' }) {
  AUDIT_LOGS.unshift({
    time: nowLabel(),
    action,
    instance,
    by: 'admin@trendscore.app',
    details,
    status,
  });
  renderAuditLog();
}

function selectedInstance() {
  return INSTANCES.find(instance => instance.name === selectedInstanceName) || INSTANCES[0];
}

function nextPortInLine(basePort, usedPorts = []) {
  const used = new Set(usedPorts.filter(Number.isFinite));
  let port = basePort;
  while (used.has(port)) port += 1;
  return port;
}

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    if (payload?.error) {
      return payload.hint ? `${payload.error} ${payload.hint}` : payload.error;
    }
  } catch (_) {}
  return fallback;
}

function setProvisionSubmitBusy(isBusy) {
  const btn = $('modal-submit');
  if (!btn) return;
  if (isBusy) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent || 'Provision';
    btn.disabled = true;
    btn.textContent = 'Provisioning...';
    return;
  }
  btn.disabled = false;
  btn.textContent = btn.dataset.label || btn.textContent || 'Provision';
}

async function loadLeadsFromApi() {
  try {
    const response = await fetch('/api/leads', { credentials: 'same-origin' });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    if (data?.ok && Array.isArray(data.leads)) {
      LEADS = data.leads;
      return true;
    }
  } catch (_) {}
  return false;
}

async function createLeadApi(lead) {
  const response = await fetch('/api/leads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Create lead failed');
  const data = await response.json();
  return data.lead;
}

async function updateLeadApi(id, lead) {
  const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Update lead failed');
  const data = await response.json();
  return data.lead;
}

async function deleteLeadApi(id) {
  const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Delete lead failed');
}

function setInstallProgress(value) {
  const wrap = $('install-progress');
  const line = $('install-progress-line');
  if (!wrap || !line) return;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  line.style.width = `${pct}%`;
}

function startInstallProgress() {
  const wrap = $('install-progress');
  if (!wrap) return;
  wrap.classList.add('active');
  wrap.setAttribute('aria-hidden', 'false');
  setInstallProgress(8);
  clearInterval(installProgressTimer);
  installProgressTimer = setInterval(() => {
    const line = $('install-progress-line');
    if (!line) return;
    const current = parseFloat(String(line.style.width || '0').replace('%', '')) || 0;
    if (current < 90) setInstallProgress(current + 4);
  }, 450);
}

function finishInstallProgress(ok = true) {
  const wrap = $('install-progress');
  if (!wrap) return;
  clearInterval(installProgressTimer);
  installProgressTimer = null;
  setInstallProgress(ok ? 100 : 0);
  setTimeout(() => {
    wrap.classList.remove('active');
    wrap.setAttribute('aria-hidden', 'true');
    if (ok) setInstallProgress(0);
  }, ok ? 350 : 150);
}

const APP_PORT_RANGES = {
  school: { fe: [3000, 3499], be: [5000, 5499], requireBe: true },
  odoo: { fe: [3500, 3999], be: [0, 0], requireBe: false },
  wordpress: { fe: [3000, 4499], be: [0, 0], requireBe: false },
  sacco: { fe: [4500, 4799], be: [5500, 5799], requireBe: true },
  hospital: { fe: [4800, 5099], be: [5800, 6099], requireBe: true },
  hotel: { fe: [5100, 5399], be: [6100, 6399], requireBe: true },
  organization: { fe: [5400, 5699], be: [6400, 6699], requireBe: true },
};

function suggestNextPorts(appKey = 'school') {
  const range = APP_PORT_RANGES[appKey] || APP_PORT_RANGES.school;
  const usedFe = INSTANCES.map(i => Number(i.fe)).filter(Number.isFinite);
  const usedBe = INSTANCES.map(i => Number(i.be)).filter(Number.isFinite);
  const fe = nextPortInLine(range.fe[0], usedFe);
  const be = range.requireBe ? nextPortInLine(range.be[0], usedBe) : 0;
  return { fe, be };
}

const APP_PROVISIONING_CATALOG = {
  school: {
    label: 'School',
    nameLabel: 'School Name',
    namePlaceholder: 'e.g. Sunshine Academy',
    modalTitle: 'Provision New School',
    submitLabel: 'Provision School',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'Frontend Port',
    beLabel: 'Backend Port',
    versions: [
      { value: 'latest', label: 'Latest stable', image: 'ghcr.io/amalgamate/zawadi-frontend:latest' },
      { value: 'v1.0.x', label: 'v1.0.x LTS', image: 'ghcr.io/amalgamate/zawadi-frontend:v1.0.x' },
    ],
    showInstitutionFields: true,
    showAdminEmail: false,
  },
  odoo: {
    label: 'Odoo',
    nameLabel: 'Company Name',
    namePlaceholder: 'e.g. Acme Limited',
    modalTitle: 'Provision Odoo Instance',
    submitLabel: 'Provision Odoo',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'Longpolling Port',
    versions: [
      { value: '18.0', label: 'Odoo 18.0', image: 'odoo:18.0' },
      { value: '17.0', label: 'Odoo 17.0', image: 'odoo:17.0' },
      { value: '16.0', label: 'Odoo 16.0', image: 'odoo:16.0' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
  wordpress: {
    label: 'WordPress',
    nameLabel: 'Organization Name',
    namePlaceholder: 'e.g. Acme Foundation',
    modalTitle: 'Provision WordPress Instance',
    submitLabel: 'Provision WordPress',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'PHP-FPM/Admin Port',
    versions: [
      { value: 'latest', label: 'WordPress latest', image: 'wordpress:latest' },
      { value: '6.5', label: 'WordPress 6.5', image: 'wordpress:6.5' },
      { value: '6.4', label: 'WordPress 6.4', image: 'wordpress:6.4' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
  sacco: {
    label: 'Sacco',
    nameLabel: 'Sacco Name',
    namePlaceholder: 'e.g. Umoja Sacco',
    modalTitle: 'Provision New Sacco',
    submitLabel: 'Provision Sacco',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'API Port',
    versions: [
      { value: 'latest', label: 'Sacco latest', image: 'ghcr.io/amalgamate/sacco-app:latest' },
      { value: 'v1.0', label: 'Sacco v1.0', image: 'ghcr.io/amalgamate/sacco-app:v1.0' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
  hospital: {
    label: 'Hospital',
    nameLabel: 'Hospital Name',
    namePlaceholder: 'e.g. St. Mary Hospital',
    modalTitle: 'Provision New Hospital',
    submitLabel: 'Provision Hospital',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'API Port',
    versions: [
      { value: 'latest', label: 'Hospital latest', image: 'ghcr.io/amalgamate/hospital-app:latest' },
      { value: 'v1.0', label: 'Hospital v1.0', image: 'ghcr.io/amalgamate/hospital-app:v1.0' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
  hotel: {
    label: 'Hotel',
    nameLabel: 'Hotel Name',
    namePlaceholder: 'e.g. Skyline Hotel',
    modalTitle: 'Provision New Hotel',
    submitLabel: 'Provision Hotel',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'API Port',
    versions: [
      { value: 'latest', label: 'Hotel latest', image: 'ghcr.io/amalgamate/hotel-app:latest' },
      { value: 'v1.0', label: 'Hotel v1.0', image: 'ghcr.io/amalgamate/hotel-app:v1.0' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
  organization: {
    label: 'Organization',
    nameLabel: 'Organization Name',
    namePlaceholder: 'e.g. Bright Future NGO',
    modalTitle: 'Provision New Organization',
    submitLabel: 'Provision Organization',
    defaultDomainSuffix: 'trendscore.co.ke',
    feLabel: 'HTTP Port',
    beLabel: 'API Port',
    versions: [
      { value: 'latest', label: 'Organization latest', image: 'ghcr.io/amalgamate/organization-app:latest' },
      { value: 'v1.0', label: 'Organization v1.0', image: 'ghcr.io/amalgamate/organization-app:v1.0' },
    ],
    showInstitutionFields: false,
    showAdminEmail: true,
  },
};

let currentProvisionApp = 'school';
const provisionCatalogCache = {};
let provisionSuggestRequestId = 0;

function selectedProvisionVersion(appKey) {
  const app = APP_PROVISIONING_CATALOG[appKey] || APP_PROVISIONING_CATALOG.school;
  const versions = provisionCatalogCache[appKey] || app.versions;
  const selected = $('f-version')?.value;
  return versions.find(v => v.value === selected) || versions[0];
}

function renderProvisionVersionOptions(appKey) {
  const app = APP_PROVISIONING_CATALOG[appKey] || APP_PROVISIONING_CATALOG.school;
  const versions = provisionCatalogCache[appKey] || app.versions;
  const select = $('f-version');
  if (!select) return;
  select.innerHTML = versions.map(version => `<option value="${esc(version.value)}">${esc(version.label)}</option>`).join('');
}

function syncProvisionImage() {
  const version = selectedProvisionVersion(currentProvisionApp);
  if ($('f-image')) $('f-image').value = version?.image || '';
  renderComposePreview();
}

async function refreshProvisionAutoAssignment() {
  const requestId = ++provisionSuggestRequestId;
  const app = APP_PROVISIONING_CATALOG[currentProvisionApp] || APP_PROVISIONING_CATALOG.school;
  const name = $('f-name')?.value.trim() || `${app.label} Instance`;

  try {
    const response = await fetch('/api/instances/suggest', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appType: currentProvisionApp,
        name,
      }),
    });
    if (!response.ok || requestId !== provisionSuggestRequestId) return;
    const data = await response.json().catch(() => null);
    const assigned = data?.autoAssigned;
    if (!assigned) return;

    if ($('f-domain') && !$('f-domain').dataset.userEdited) {
      $('f-domain').value = assigned.domain || '';
    }
    if ($('f-port-fe')) $('f-port-fe').value = Number(assigned.fePort || 0) || '';
    if ($('f-port-be')) $('f-port-be').value = Number(assigned.bePort || 0) || '';
    renderComposePreview();
  } catch (_) {
    // The create endpoint performs the same allocation again; this only improves the modal preview.
  }
}

function composeServiceName(rawName) {
  const base = slugify(rawName || currentProvisionApp || 'instance');
  return base || 'instance';
}

function renderComposePreview() {
  const app = APP_PROVISIONING_CATALOG[currentProvisionApp] || APP_PROVISIONING_CATALOG.school;
  const name = $('f-name')?.value.trim() || `${app.label} Instance`;
  const domain = $('f-domain')?.value.trim() || `${slugify(name || app.label)}.${app.defaultDomainSuffix}`;
  const version = selectedProvisionVersion(currentProvisionApp);
  const image = $('f-image')?.value.trim() || version?.image || '';
  const fePort = Number($('f-port-fe')?.value || 0) || 0;
  const bePort = Number($('f-port-be')?.value || 0) || 0;
  const adminEmail = $('f-admin-email')?.value.trim() || 'admin@example.com';
  const service = composeServiceName(name);
  const dbService = `${service}-db`;
  const dbName = `${currentProvisionApp}_${slugify(name).replace(/-/g, '_') || 'instance'}`;

  let preview = '';
  if (currentProvisionApp === 'school') {
    preview = [
      'version: "3.9"',
      'services:',
      `  ${service}-frontend:`,
      `    image: ${image}`,
      '    restart: unless-stopped',
      `    ports: ["${fePort}:3000"]`,
      `    environment: [APP_DOMAIN=${domain}]`,
      `  ${service}-backend:`,
      '    image: ghcr.io/amalgamate/zawadi-backend:latest',
      '    restart: unless-stopped',
      `    ports: ["${bePort}:5000"]`,
      `    environment: [DATABASE_URL=postgres://${dbName}:${dbName}@${dbService}:5432/${dbName}]`,
      `  ${dbService}:`,
      '    image: postgres:16',
      '    restart: unless-stopped',
      `    environment: [POSTGRES_DB=${dbName}, POSTGRES_USER=${dbName}, POSTGRES_PASSWORD=${dbName}]`,
      `    volumes: ["${service}-db-data:/var/lib/postgresql/data"]`,
      'volumes:',
      `  ${service}-db-data: {}`,
    ].join('\n');
  } else if (currentProvisionApp === 'odoo') {
    preview = [
      'version: "3.9"',
      'services:',
      `  ${service}:`,
      `    image: ${image}`,
      '    restart: unless-stopped',
      `    ports: ["${fePort}:8069"]`,
      `    environment: [HOST=${dbService}, USER=${dbName}, PASSWORD=${dbName}, ADMIN_EMAIL=${adminEmail}]`,
      `    depends_on: [${dbService}]`,
      `  ${dbService}:`,
      '    image: postgres:16',
      '    restart: unless-stopped',
      `    environment: [POSTGRES_DB=postgres, POSTGRES_USER=${dbName}, POSTGRES_PASSWORD=${dbName}]`,
      `    volumes: ["${service}-db-data:/var/lib/postgresql/data"]`,
      'volumes:',
      `  ${service}-db-data: {}`,
    ].join('\n');
  } else if (currentProvisionApp === 'wordpress') {
    preview = [
      'version: "3.9"',
      'services:',
      `  ${service}:`,
      `    image: ${image}`,
      '    restart: unless-stopped',
      `    ports: ["${fePort}:80"]`,
      `    environment: [WORDPRESS_DB_HOST=${dbService}:3306, WORDPRESS_DB_USER=${dbName}, WORDPRESS_DB_PASSWORD=${dbName}, WORDPRESS_DB_NAME=${dbName}, WP_ADMIN_EMAIL=${adminEmail}]`,
      `    depends_on: [${dbService}]`,
      `  ${dbService}:`,
      '    image: mysql:8.0',
      '    restart: unless-stopped',
      `    environment: [MYSQL_DATABASE=${dbName}, MYSQL_USER=${dbName}, MYSQL_PASSWORD=${dbName}, MYSQL_ROOT_PASSWORD=${dbName}]`,
      `    volumes: ["${service}-db-data:/var/lib/mysql"]`,
      'volumes:',
      `  ${service}-db-data: {}`,
    ].join('\n');
  } else {
    preview = [
      'version: "3.9"',
      'services:',
      `  ${service}:`,
      `    image: ${image}`,
      '    restart: unless-stopped',
      `    ports: ["${fePort}:80", "${bePort}:8080"]`,
      `    environment: [APP_DOMAIN=${domain}, ADMIN_EMAIL=${adminEmail}]`,
      `  ${dbService}:`,
      '    image: postgres:16',
      '    restart: unless-stopped',
      `    environment: [POSTGRES_DB=${dbName}, POSTGRES_USER=${dbName}, POSTGRES_PASSWORD=${dbName}]`,
      `    volumes: ["${service}-db-data:/var/lib/postgresql/data"]`,
      'volumes:',
      `  ${service}-db-data: {}`,
    ].join('\n');
  }
  if ($('f-compose-preview')) $('f-compose-preview').textContent = preview;
}

function applyProvisionMode(appKey) {
  currentProvisionApp = APP_PROVISIONING_CATALOG[appKey] ? appKey : 'school';
  const app = APP_PROVISIONING_CATALOG[currentProvisionApp];
  const appRange = APP_PORT_RANGES[currentProvisionApp] || APP_PORT_RANGES.school;
  if ($('f-app')) $('f-app').value = currentProvisionApp;
  if ($('modal-title')) $('modal-title').textContent = app.modalTitle;
  if ($('modal-submit')) $('modal-submit').textContent = app.submitLabel;
  if ($('f-name-label')) $('f-name-label').textContent = app.nameLabel || `${app.label} Name`;
  if ($('f-name')) $('f-name').placeholder = app.namePlaceholder || `e.g. ${app.label} Name`;
  if ($('f-port-fe-label')) $('f-port-fe-label').textContent = app.feLabel;
  if ($('f-port-be-label')) $('f-port-be-label').textContent = app.beLabel;
  if ($('f-port-be-row')) $('f-port-be-row').style.display = appRange.requireBe ? '' : 'none';
  if ($('f-type-row')) $('f-type-row').style.display = app.showInstitutionFields ? '' : 'none';
  if ($('f-plan-row')) $('f-plan-row').style.display = app.showInstitutionFields ? '' : 'none';
  if ($('f-admin-email-row')) $('f-admin-email-row').style.display = app.showAdminEmail ? '' : 'none';
  renderProvisionVersionOptions(currentProvisionApp);
  syncProvisionImage();
  renderComposePreview();
}

async function loadProvisionCatalog(appKey) {
  try {
    const response = await fetch(`/api/catalog/images?appType=${encodeURIComponent(appKey)}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) return;
    const data = await response.json();
    const versions = Array.isArray(data?.versions) ? data.versions : [];
    if (versions.length > 0) {
      provisionCatalogCache[appKey] = versions;
      if (currentProvisionApp === appKey) {
        renderProvisionVersionOptions(appKey);
        syncProvisionImage();
      }
    }
  } catch (_) {
    // fallback to static defaults
  }
}

function prepareProvisionDefaults(appKey = 'school') {
  applyProvisionMode(appKey);
  loadProvisionCatalog(currentProvisionApp);
  if ($('f-port-fe')) $('f-port-fe').value = '';
  if ($('f-port-be')) $('f-port-be').value = '';
  if (!$('f-domain')?.value.trim() && $('f-name')?.value.trim()) {
    $('f-domain').value = `${slugify($('f-name').value)}.${APP_PROVISIONING_CATALOG[currentProvisionApp].defaultDomainSuffix}`;
  }
  renderComposePreview();
  refreshProvisionAutoAssignment();
}

async function fetchRuntimeData() {
  const response = await fetch('/api/runtime', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`runtime http ${response.status}`);
  return response.json();
}

async function refreshFromRuntime() {
  try {
    const runtime = await fetchRuntimeData();
    if (runtime?.ok && Array.isArray(runtime.instances)) {
      INSTANCES = runtime.instances.map(item => ({
        ...item,
        domain: DOMAIN_OVERRIDES[inferGroupKey(item)] || item.domain || `${slugify(item.name).replace(/-(frontend|backend|db|database)-?\d*$/i, '')}.trendscore.co.ke`,
        type: item.type || 'PRIMARY_CBC',
        typeLabel: item.typeLabel || 'Managed',
        planId: item.planId || 'professional',
        billingCycle: item.billingCycle || 'Monthly',
        nextRenewal: item.nextRenewal || '2026-12-31',
        billingStatus: item.billingStatus || 'Active',
      }));
      selectedInstanceName = INSTANCES.find(i => i.name === selectedInstanceName)?.name || INSTANCES[0]?.name || '';
    }
    RUNTIME_METRICS = runtime?.metrics || null;
    if (Array.isArray(runtime?.deployments)) DEPLOYMENTS = runtime.deployments;
    if (Array.isArray(runtime?.auditLogs)) AUDIT_LOGS = runtime.auditLogs;
    liveMode = runtime?.mode === 'live';
  } catch (_) {
    RUNTIME_METRICS = null;
    liveMode = false;
  }
}

function renderRuntimeStamp(label = liveMode ? 'Live' : 'Fallback') {
  if ($('last-updated')) $('last-updated').textContent = `${label} · ${nowLabel()}`;
}

async function pollRuntimeAndRender() {
  if (runtimePollBusy) return;
  runtimePollBusy = true;
  try {
    await refreshFromRuntime();
    renderEverything();
    renderRuntimeStamp();
  } catch (_) {
    renderRuntimeStamp('Retrying');
  } finally {
    runtimePollBusy = false;
  }
}

function startRuntimePolling(intervalMs = 20000) {
  if (runtimePollTimer) clearInterval(runtimePollTimer);
  runtimePollTimer = setInterval(() => {
    pollRuntimeAndRender();
  }, intervalMs);
}

// ── Running Instances panel ───────────────────────────────────────────────
function containerRows(instance) {
  const isOnline = instance.status === 'Online';
  const isDegraded = instance.status === 'Degraded';
  const containers = [
    { name: 'Frontend', port: instance.fe, status: isOnline ? 'running' : isDegraded ? 'running' : 'stopped' },
    { name: 'Backend',  port: instance.be, status: isOnline ? 'running' : 'stopped' },
    { name: 'Database', port: null,        status: isOnline ? 'running' : isDegraded ? 'running' : 'stopped' },
  ];
  if (isDegraded) containers[1].status = 'unhealthy';
  return containers;
}

function renderRunningInstances() {
  const el = $('running-instances-grid');
  if (!el) return;

  el.innerHTML = INSTANCES.map(instance => {
    const containers = containerRows(instance);
    const overallCls = instance.status === 'Online' ? 'online' : instance.status === 'Degraded' ? 'warn' : 'offline';
    const plan = findPlan(instance.planId);
    const uptime = instance.status === 'Online' ? '99.9%' : instance.status === 'Degraded' ? '71.2%' : '0%';
    const runningCount = containers.filter(c => c.status === 'running').length;

    const containerDots = containers.map(c => {
      const dot = c.status === 'running' ? 'ri-dot-green' : c.status === 'unhealthy' ? 'ri-dot-amber' : 'ri-dot-red';
      return `<span class="ri-container-dot ${dot}" title="${esc(c.name)}: ${esc(c.status)}${c.port ? ' (:' + c.port + ')' : ''}"></span>`;
    }).join('');

    const containerList = containers.map(c => {
      const sCls = c.status === 'running' ? 'online' : c.status === 'unhealthy' ? 'warn' : 'offline';
      return `<div class="ri-container-row">
        <span class="ri-c-name">${esc(c.name)}</span>
        ${c.port ? `<span class="ri-c-port">:${c.port}</span>` : '<span class="ri-c-port">—</span>'}
        <span class="badge ${sCls}" style="font-size:10px;padding:1px 6px">${esc(c.status)}</span>
      </div>`;
    }).join('');

    return `<div class="ri-card">
      <div class="ri-card-head">
        <div class="ri-card-title-row">
          <div>
            <div class="ri-name">${esc(instance.name)}</div>
            <div class="ri-domain">${esc(instance.domain)}</div>
          </div>
          <span class="badge ${overallCls}">${esc(instance.status)}</span>
        </div>
        <div class="ri-dots-row">
          ${containerDots}
          <span class="ri-dots-label">${runningCount}/${containers.length} running</span>
        </div>
      </div>
      <div class="ri-container-list">
        ${containerList}
      </div>
      <div class="ri-card-footer">
        <div class="ri-meta-row">
          <span class="ri-meta-label">Plan</span>
          <span class="ri-meta-val">${esc(plan.name)}</span>
        </div>
        <div class="ri-meta-row">
          <span class="ri-meta-label">Uptime</span>
          <span class="ri-meta-val" style="font-family:var(--mono)">${uptime}</span>
        </div>
        <div class="ri-meta-row">
          <span class="ri-meta-label">Version</span>
          <span class="ri-meta-val" style="font-family:var(--mono)">${esc(instance.version)}</span>
        </div>
        <div class="ri-actions">
          <button class="tbl-btn primary" data-action="Restart" data-school="${esc(instance.name)}">Restart</button>
          <button class="tbl-btn" data-action="Logs" data-school="${esc(instance.name)}">Logs</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Space & Usage panel ───────────────────────────────────────────────────
const TOTAL_DISK = 80;
function totalDiskGb() {
  return Number(RUNTIME_METRICS?.diskTotalGb || TOTAL_DISK);
}

function renderSpaceUsage() {
  const el = $('space-usage-panel');
  if (!el) return;

  const diskTotal = totalDiskGb();
  const totalSchoolDb = INSTANCES.reduce((s, i) => s + i.dbGb, 0);
  const totalUploads  = INSTANCES.reduce((s, i) => s + i.uploads, 0);
  const totalBackups  = INSTANCES.reduce((s, i) => s + i.backups, 0);
  const schoolData    = INSTANCES.reduce((s, i) => s + i.storage, 0);
  const runtimeUsed   = Number(RUNTIME_METRICS?.storageUsedGb || 0);
  const appStack      = Math.max(0, runtimeUsed - schoolData);
  const usedTotal     = appStack + schoolData;
  const freeSpace     = Math.max(0, diskTotal - usedTotal);
  const usedPct       = Math.round(usedTotal / Math.max(diskTotal, 1) * 100);

  const segments = [
    { label: 'Platform Stack', value: appStack, color: '#030b82' },
    { label: 'School DBs', value: totalSchoolDb, color: '#059669' },
    { label: 'Uploads', value: totalUploads, color: '#f59e0b' },
    { label: 'Backups', value: totalBackups, color: '#8b5cf6' },
    { label: 'Free', value: freeSpace, color: '#e8ebf4' },
  ];

  el.innerHTML = `
    <div class="su-summary-row">
      <div class="su-summary-stat">
        <div class="su-stat-val">${fmt(usedTotal)} <span class="su-stat-unit">GB</span></div>
        <div class="su-stat-label">Used of ${fmt(diskTotal)} GB</div>
      </div>
      <div class="su-summary-stat">
        <div class="su-stat-val">${fmt(freeSpace)} <span class="su-stat-unit">GB</span></div>
        <div class="su-stat-label">Free Space</div>
      </div>
      <div class="su-summary-stat">
        <div class="su-stat-val">${usedPct}<span class="su-stat-unit">%</span></div>
        <div class="su-stat-label">Disk Utilisation</div>
      </div>
      <div class="su-summary-stat">
        <div class="su-stat-val">${fmt(schoolData)} <span class="su-stat-unit">GB</span></div>
        <div class="su-stat-label">School Data</div>
      </div>
    </div>

    <div class="su-stacked-bar">
      ${segments.filter(s => s.value > 0).map(s =>
        `<div class="su-seg" style="width:${(s.value / Math.max(diskTotal, 1) * 100).toFixed(2)}%;background:${s.color}" title="${s.label}: ${fmt(s.value)} GB"></div>`
      ).join('')}
    </div>
    <div class="su-legend">
      ${segments.filter(s => s.label !== 'Free').map(s =>
        `<div class="su-legend-item">
          <span class="su-legend-dot" style="background:${s.color}"></span>
          <span class="su-legend-label">${esc(s.label)}</span>
          <span class="su-legend-val">${fmt(s.value)} GB</span>
        </div>`
      ).join('')}
    </div>

    <div class="su-breakdown-grid">
      ${segments.filter(s => s.label !== 'Free').map(s => {
        const pct = Math.round(s.value / Math.max(diskTotal, 1) * 100);
        return `<div class="su-breakdown-item">
          <div class="su-b-row">
            <span class="su-b-label">${esc(s.label)}</span>
            <span class="su-b-val">${fmt(s.value)} GB</span>
          </div>
          <div class="su-meter"><div class="su-meter-fill" style="width:${pct}%;background:${s.color}"></div></div>
          <div class="su-b-pct">${pct}% of ${fmt(diskTotal)} GB disk</div>
        </div>`;
      }).join('')}
    </div>

    <div class="su-per-instance-section">
      <div class="su-section-label">Per-Instance Breakdown</div>
      <div class="su-per-instance-grid">
        ${INSTANCES.map(inst => {
          const instPct = Math.round(inst.storage / Math.max(diskTotal, 1) * 100);
          return `<div class="su-pi-card">
            <div class="su-pi-head">
              <span class="su-pi-name">${esc(inst.name)}</span>
              <span class="su-pi-total">${fmt(inst.storage)} GB</span>
            </div>
            <div class="su-meter" style="margin:6px 0 4px"><div class="su-meter-fill" style="width:${instPct}%;background:var(--brand)"></div></div>
            <div class="su-pi-rows">
              <div class="su-pi-row"><span>Database</span><span>${fmt(inst.dbGb)} GB</span></div>
              <div class="su-pi-row"><span>Uploads</span><span>${fmt(inst.uploads)} GB</span></div>
              <div class="su-pi-row"><span>Backups</span><span>${fmt(inst.backups)} GB</span></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// Rendering

function renderPipeline() {
  const pipeline = $('kanban-board');
  if (!pipeline) return;

  const stages = [
    { id: 'new', label: 'New' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'interested', label: 'Interested' },
    { id: 'converted', label: 'Converted' },
    { id: 'lost', label: 'Lost' }
  ];

  pipeline.innerHTML = stages.map(stage => {
    const stageLeads = LEADS.filter(l => l.stage === stage.id);
    const totalStudents = stageLeads.reduce((sum, l) => sum + (Number(l.students) || 0), 0);
    
    return `<div class="kanban-column" data-stage="${stage.id}">
      <div class="k-col-head">
        <div class="k-col-title">
          <span class="k-stage-name">${stage.label}</span>
          <span class="k-stage-count">${stageLeads.length}</span>
        </div>
        <div class="k-col-sub">${fmt(totalStudents)} expected students</div>
        <button class="k-quick-add" onclick="openLeadModal('${stage.id}')" title="Quick Add">+</button>
      </div>
      <div class="k-col-body" id="k-col-${stage.id}">
        ${stageLeads.map(lead => {
          const prioStars = '★'.repeat(lead.priority) + '☆'.repeat(3 - lead.priority);
          return `<div class="k-card ${lead.stage}" data-id="${lead.id}">
            <div class="k-card-color"></div>
            <div class="k-card-top">
              <span class="k-priority p${lead.priority}">${prioStars}</span>
              ${lead.tags.map(t => `<span class="k-tag">${esc(t)}</span>`).join('')}
            </div>
            <div class="k-card-title">${esc(lead.school)}</div>
            <div class="k-card-sub">${esc(lead.name)} • ${esc(lead.phone)}</div>
            <div class="k-card-foot">
              <span class="k-activity" title="Next Activity">📅 ${esc(lead.nextActivity || 'No planned activity')}</span>
              <span class="k-students">👤 ${lead.students}</span>
            </div>
            <button class="k-card-edit" onclick="openLeadModal(null, '${lead.id}')">Edit</button>
            <button class="k-card-edit" style="right:46px" onclick="convertLeadToProvision('${lead.id}')">Convert</button>
            <button class="k-card-edit" style="right:112px" onclick="deleteLead('${lead.id}')">Delete</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  if (typeof Sortable !== 'undefined') {
    stages.forEach(stage => {
      const col = $('k-col-' + stage.id);
      if (col) {
        new Sortable(col, {
          group: 'pipeline',
          animation: 150,
          ghostClass: 'k-card-ghost',
          onEnd: function (evt) {
            const itemEl = evt.item;
            const toCol = evt.to;
            const leadId = itemEl.dataset.id;
            const newStage = toCol.closest('.kanban-column').dataset.stage;
            
            const lead = LEADS.find(l => l.id === leadId);
            if (lead && lead.stage !== newStage) {
              lead.stage = newStage;
              addAudit({ action: 'Lead Stage Changed', instance: lead.school, details: `Moved to ${newStage}` });
              renderEverything();
              toast(`Moved ${lead.school} to ${newStage}`);
            }
          }
        });
      }
    });
  }
}

let activeLeadFilter = null;
function renderLeadsList() {
  const table = $('leads-table');
  if (!table) return;

  const filteredLeads = activeLeadFilter ? LEADS.filter(l => l.stage === activeLeadFilter) : LEADS;

  table.innerHTML = filteredLeads.map(lead => `
    <tr>
      <td><strong>${esc(lead.name)}</strong></td>
      <td>${esc(lead.phone)}</td>
      <td><div class="cell-school"><strong>${esc(lead.school)}</strong></div></td>
      <td><span class="lead-badge ${lead.stage}">${esc(lead.stage)}</span></td>
      <td>
        <div class="sys-chips">
          <span class="sys-chip ${lead.systems.assessment !== 'None' ? 'filled' : ''}" title="Assessment">A: ${esc(lead.systems.assessment)}</span>
          <span class="sys-chip ${lead.systems.fees !== 'None' ? 'filled' : ''}" title="Fees">F: ${esc(lead.systems.fees)}</span>
          <span class="sys-chip ${lead.systems.lms !== 'None' ? 'filled' : ''}" title="LMS">L: ${esc(lead.systems.lms)}</span>
        </div>
      </td>
      <td>${esc(lead.nextActivity)}</td>
      <td style="max-width:200px;font-size:12px;color:var(--muted);white-space:normal">${esc(lead.notes)}</td>
      <td>
        <div class="action-row">
          <button class="tbl-btn" onclick="openLeadModal(null, '${lead.id}')">Edit</button>
          <button class="tbl-btn primary" onclick="convertLeadToProvision('${lead.id}')">Convert & Provision</button>
          <button class="tbl-btn danger" onclick="deleteLead('${lead.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  if ($('crm-m-total')) $('crm-m-total').textContent = LEADS.length;
  const contactedWeek = LEADS.filter(l => l.stage !== 'new').length;
  if ($('crm-m-week')) $('crm-m-week').textContent = contactedWeek;
  const converted = LEADS.filter(l => l.stage === 'converted').length;
  if ($('crm-m-converted')) $('crm-m-converted').textContent = converted;
  if ($('crm-m-rate')) $('crm-m-rate').textContent = LEADS.length ? Math.round((converted / LEADS.length) * 100) + '%' : '0%';
}

window.deleteLead = async function(leadId) {
  const lead = LEADS.find(l => l.id === leadId);
  if (!lead) return;
  const ok = window.confirm(`Delete lead "${lead.school}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await deleteLeadApi(leadId);
    LEADS = LEADS.filter(l => l.id !== leadId);
  } catch (error) {
    toast(error.message || 'Delete failed');
    return;
  }
  addAudit({ action: 'Lead Deleted', instance: lead.school, details: `Deleted lead record for ${lead.name}` });
  renderEverything();
  toast('Lead deleted.');
};

window.convertLeadToProvision = function(leadId) {
  const lead = LEADS.find(l => l.id === leadId);
  if (!lead) return;

  openModal('school', leadId);

  const schoolName = (lead.school || '').trim() || `${lead.name || 'School'} Instance`;
  if ($('f-name')) $('f-name').value = schoolName;
  if ($('f-domain')) {
    $('f-domain').value = `${slugify(schoolName)}.${APP_PROVISIONING_CATALOG.school.defaultDomainSuffix}`;
    delete $('f-domain').dataset.userEdited;
  }

  const studentCount = Number(lead.students || 0);
  const inferredPlan = studentCount >= 1000
    ? 'enterprise'
    : studentCount >= 500
      ? 'professional'
      : studentCount >= 250
        ? 'standard'
        : 'starter';
  if ($('f-plan')) $('f-plan').value = inferredPlan;

  const source = `Lead source: ${lead.name}${lead.phone ? ` (${lead.phone})` : ''}`;
  const existingNotes = (lead.notes || '').trim();
  if ($('f-notes')) $('f-notes').value = existingNotes ? `${existingNotes}\n${source}` : source;

  renderComposePreview();
  refreshProvisionAutoAssignment();
  addAudit({ action: 'Lead Convert Initiated', instance: schoolName, details: `Provision form opened from CRM lead ${lead.id}` });
  toast(`Provision form prefilled from ${schoolName}.`);
};

function toggleCrmMetrics() {
  const panel = $('crm-metrics-panel');
  const btn = $('btn-toggle-crm-metrics');
  if (!panel || !btn) return;
  const nextHidden = !panel.hidden ? true : false;
  panel.hidden = nextHidden;
  btn.textContent = nextHidden ? 'Show Metrics' : 'Hide Metrics';
}

// Rendering
function renderInstanceRow(instance, mode = 'compact') {
  const plan = findPlan(instance.planId);
  const extraCols = mode === 'full'
    ? `<td><span class="version-chip">${esc(instance.typeLabel)}</span></td>
       <td><span class="version-chip">${esc(plan.name)}</span></td>`
    : '';

  return `<tr>
    <td><div class="cell-school"><strong>${esc(instance.name)}</strong><div class="cell-domain">${esc(instance.domain)}</div></div></td>
    <td><span class="badge ${statusCls(instance.status)}">${esc(instance.status)}</span></td>
    ${extraCols}
    <td>${fmtDate(instance.created)}</td>
    <td><span class="version-chip">${esc(instance.version)}</span></td>
    <td><div class="port-list">FE :${instance.fe}<br>BE :${instance.be}<br>${esc(instance.db)}</div></td>
    <td>
      <strong>${fmt(instance.storage)} GB</strong><br>
      <span style="font-size:11px;color:var(--muted)">DB ${fmt(instance.dbGb)} · Up ${fmt(instance.uploads)} · Bkp ${fmt(instance.backups)}</span>
    </td>
    <td>
      <div class="action-row">
        <button class="tbl-btn primary" data-action="Restart" data-school="${esc(instance.name)}">Restart</button>
        <button class="tbl-btn" data-action="Logs" data-school="${esc(instance.name)}">Logs</button>
        <button class="tbl-btn" data-action="Redeploy" data-school="${esc(instance.name)}">Redeploy</button>
        <button class="tbl-btn danger" data-action="Stop" data-school="${esc(instance.name)}">Stop</button>
        <button class="tbl-btn danger" data-action="Drop" data-school="${esc(instance.name)}">Drop</button>
      </div>
    </td>
  </tr>`;
}

function inferComponent(instance) {
  const probe = `${instance.name || ''} ${instance.domain || ''} ${instance.db || ''}`.toLowerCase();
  if (/(^|[-_ ])(frontend|fe|web|ui)([-_ 0-9]|$)/.test(probe)) return 'frontend';
  if (/(^|[-_ ])(backend|be|api|server)([-_ 0-9]|$)/.test(probe)) return 'backend';
  if (/(^|[-_ ])(db|database|postgres|mysql|mariadb)([-_ 0-9]|$)/.test(probe)) return 'database';
  if (Number.isFinite(Number(instance.fe)) && !Number.isFinite(Number(instance.be))) return 'frontend';
  if (Number.isFinite(Number(instance.be)) && !Number.isFinite(Number(instance.fe))) return 'backend';
  return 'unknown';
}

function inferGroupKey(instance) {
  const fromDomain = String(instance.domain || '').split('.')[0].toLowerCase();
  const fromName = slugify(instance.name || '');
  const base = (fromDomain || fromName)
    .replace(/^zawadi-/, '')
    .replace(/-(frontend|backend|db|database)(-\d+)?$/, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || fromName || slugify(instance.name || 'instance');
}

function prettyGroupName(groupKey) {
  return groupKey
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function groupInstances(instances) {
  const map = new Map();
  const asPort = value => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  for (const instance of instances) {
    const groupKey = inferGroupKey(instance);
    if (!map.has(groupKey)) {
      map.set(groupKey, {
        key: groupKey,
        name: prettyGroupName(groupKey),
        items: [],
        hasFrontend: false,
        hasBackend: false,
        hasDatabase: false,
        storage: 0,
      });
    }
    const group = map.get(groupKey);
    group.items.push(instance);
    group.storage += Number(instance.storage || 0);
    const component = inferComponent(instance);
    if (component === 'frontend') group.hasFrontend = true;
    if (component === 'backend') group.hasBackend = true;
    if (component === 'database') group.hasDatabase = true;
    const fe = asPort(instance.fe);
    const be = asPort(instance.be);
    if (!Number.isFinite(group.fePort) && Number.isFinite(fe)) group.fePort = fe;
    if (!Number.isFinite(group.bePort) && Number.isFinite(be)) group.bePort = be;
  }

  return Array.from(map.values())
    .map(group => ({ ...group, complete: group.hasFrontend && group.hasBackend && group.hasDatabase }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveServerIp() {
  const rows = Array.from(document.querySelectorAll('.sb-footer-row'));
  for (const row of rows) {
    const label = row.querySelector('.sb-footer-label')?.textContent?.trim().toLowerCase();
    if (label === 'server') {
      const value = row.querySelector('.sb-footer-val')?.textContent?.trim();
      if (value) return value;
    }
  }
  return '185.127.16.124';
}

function renderInstances() {
  const groups = groupInstances(INSTANCES);
  const serverIp = resolveServerIp();

  const renderGroupHeader = group => {
    const primary = group.items.find(item => Number(item.fe) > 0) || group.items[0] || {};
    const domain = DOMAIN_OVERRIDES[group.key] || primary.domain || `${slugify(group.name).replace(/-(frontend|backend|db|database)-?\d*$/i, '')}.trendscore.co.ke`;
    const feLabel = Number.isFinite(group.fePort) ? `${serverIp}:${group.fePort}` : '-';
    const openIpUrl = Number.isFinite(group.fePort) ? `http://${serverIp}:${group.fePort}` : '';
    const openDomainUrl = domain ? `https://${domain}` : '';
    const domainLink = openDomainUrl ? `<a class="group-open-link group-open-domain-link" href="${esc(openDomainUrl)}" target="_blank" rel="noopener noreferrer" title="Open domain" style="margin-left:8px;display:inline-flex;align-items:center;text-decoration:none;">↗</a>` : '';
    const ipLink = openIpUrl ? `<a class="group-open-link group-open-ip-link" href="${esc(openIpUrl)}" target="_blank" rel="noopener noreferrer" title="Open IP endpoint" style="margin-left:8px;display:inline-flex;align-items:center;text-decoration:none;">↗</a>` : '';
    return `<tr class="group-head" data-group="${esc(group.key)}" style="background:#f6f8ff;cursor:pointer">
      <td colspan="7">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <strong>${esc(group.name)}</strong>
            <span style="margin-left:14px;color:var(--muted);font-size:12px">${esc(domain)}</span>${domainLink}
            <span style="margin-left:12px;color:var(--muted);font-size:12px">|</span>
            <span style="margin-left:12px;font-family:var(--mono);font-size:12px;color:var(--muted)">FE ${esc(feLabel)}</span>${ipLink}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="group-chevron" style="font-size:16px;line-height:1">▸</span>
          </div>
        </div>
      </td>
    </tr>`;
  };

  const renderGroupedBody = mode => groups.map(group => {
    const rows = group.items.map(instance =>
      renderInstanceRow(instance, mode).replace('<tr>', `<tr class="group-row" data-group="${esc(group.key)}" style="display:none">`)
    ).join('');
    return `${renderGroupHeader(group)}${rows}`;
  }).join('');

  const overview = $('instance-table');
  if (overview) overview.innerHTML = renderGroupedBody('compact');

  const full = $('instance-table-full');
  if (full) full.innerHTML = renderGroupedBody('full');
}

function renderMetrics() {
  const totalStorage = INSTANCES.reduce((sum, instance) => sum + instance.storage, 0);
  const healthy = INSTANCES.filter(instance => instance.status === 'Online').reduce((sum, instance) => sum + instance.containers, 0);
  const total = INSTANCES.reduce((sum, instance) => sum + instance.containers, 0);
  const schoolGroups = groupInstances(INSTANCES).filter(group => group.complete).length;

  if ($('m-schools')) $('m-schools').textContent = Number.isFinite(Number(RUNTIME_METRICS?.liveSchools)) ? RUNTIME_METRICS.liveSchools : schoolGroups;
  if ($('m-containers')) $('m-containers').textContent = RUNTIME_METRICS?.containersHealthy || `${healthy}/${total}`;
  if ($('m-storage')) $('m-storage').textContent = `${fmt(Number(RUNTIME_METRICS?.storageUsedGb ?? totalStorage))} GB`;

  const latestDeploy = DEPLOYMENTS[0];
  if ($('m-deploy')) {
    $('m-deploy').textContent = latestDeploy?.imageTag || latestDeploy?.title?.replace(/^Promoted /, '')?.slice(0, 12) || '—';
  }
  if ($('m-deploy-sub')) {
    $('m-deploy-sub').textContent = latestDeploy?.copy || 'Promote tested demo build to schools';
  }
  if ($('m-deploy-badge')) {
    $('m-deploy-badge').textContent = latestDeploy?.time ? latestDeploy.time : 'Promote →';
  }
  if ($('overview-sub')) {
    $('overview-sub').textContent = liveMode
      ? 'Live snapshot of all managed school instances'
      : 'Live snapshot of all managed school instances · waiting for live metrics';
  }
}

function renderTimeline(elId, maxItems = 99) {
  const el = $(elId);
  if (!el) return;
  el.innerHTML = DEPLOYMENTS.slice(0, maxItems).map(item => `
    <div class="tl-item">
      <div class="tl-time">${esc(item.time)}</div>
      <div class="tl-body">
        <div class="tl-title">${esc(item.title)}</div>
        <div class="tl-copy">${esc(item.copy)}</div>
      </div>
    </div>`).join('');
}

function renderCapacity() {
  const diskTotal = totalDiskGb();
  const capacitySub = $('capacity-sub');
  if (capacitySub) capacitySub.textContent = `VPS disk allocation \u00b7 ${fmt(diskTotal)} GB total`;
  const totalStorage = INSTANCES.reduce((sum, instance) => sum + instance.storage, 0);
  const imagesUsed = Number(RUNTIME_METRICS?.imagesGb || 0);
  const volumesUsed = Number(RUNTIME_METRICS?.volumesGb || 0);
  const runtimeUsed = Number(RUNTIME_METRICS?.storageUsedGb || 0);
  const stackUsed = Math.max(0, runtimeUsed - totalStorage);
  const freeUsed = Math.max(0, diskTotal - runtimeUsed);
  const items = [
    { label: 'Images', used: imagesUsed, total: diskTotal, color: 'brand', meta: 'Docker images stored on this server' },
    { label: 'Volumes', used: volumesUsed, total: diskTotal, color: 'teal', meta: 'Persistent Docker volumes' },
    { label: 'Platform Stack', used: stackUsed, total: diskTotal, color: 'amber', meta: 'Containers and shared runtime layers' },
    { label: 'School Data', used: totalStorage, total: diskTotal, color: 'teal', meta: 'DB + uploads + backups across all instances' },
    { label: 'Free Space', used: freeUsed, total: diskTotal, color: 'green', meta: 'Available for new instances' },
  ];
  const el = $('capacity-items');
  if (!el) return;
  el.innerHTML = items.map(item => {
    const pct = Math.round(Math.max(0, item.used) / Math.max(item.total, 1) * 100);
    return `<div class="capacity-item">
      <div class="cap-row"><span class="cap-name">${esc(item.label)}</span><span class="cap-val">${fmt(item.used)} GB</span></div>
      <div class="meter"><div class="meter-fill ${item.color}" style="width:${pct}%"></div></div>
      <div class="cap-meta">${esc(item.meta)} · ${pct}% of ${fmt(item.total)} GB</div>
    </div>`;
  }).join('');
}

function renderStorageSection() {
  const total = INSTANCES.reduce((sum, instance) => sum + instance.storage, 0);
  if ($('s-total')) $('s-total').textContent = fmt(total) + ' GB';

  const disk = $('disk-breakdown');
  if (disk) {
    const diskTotal = totalDiskGb();
    const runtimeUsed = Number(RUNTIME_METRICS?.storageUsedGb || 0);
    const platformUsed = Math.max(0, runtimeUsed - total);
    const rows = [
      { label: 'Platform Stack', used: platformUsed, total: diskTotal, color: 'brand' },
      { label: 'School Databases', used: INSTANCES.reduce((sum, instance) => sum + instance.dbGb, 0), total: diskTotal, color: 'green' },
      { label: 'Uploaded Files', used: INSTANCES.reduce((sum, instance) => sum + instance.uploads, 0), total: diskTotal, color: 'amber' },
      { label: 'Backups', used: INSTANCES.reduce((sum, instance) => sum + instance.backups, 0), total: diskTotal, color: 'brand' },
    ];
    disk.innerHTML = rows.map(row => {
      const pct = Math.round(row.used / row.total * 100);
      return `<div class="capacity-item">
        <div class="cap-row"><span class="cap-name">${esc(row.label)}</span><span class="cap-val">${fmt(row.used)} GB</span></div>
        <div class="meter"><div class="meter-fill ${row.color}" style="width:${pct}%"></div></div>
        <div class="cap-meta">${pct}% of ${row.total} GB total disk</div>
      </div>`;
    }).join('');
  }

  const perInstance = $('per-instance-storage');
  if (perInstance) {
    perInstance.innerHTML = INSTANCES.map(instance => `
      <div class="storage-item">
        <div class="sto-row"><span class="sto-name">${esc(instance.name)}</span><span class="sto-size">${fmt(instance.storage)} GB</span></div>
        <div class="sto-meta">DB ${fmt(instance.dbGb)} GB · Uploads ${fmt(instance.uploads)} GB · Backups ${fmt(instance.backups)} GB</div>
      </div>`).join('');
  }
}

function renderAuditLog() {
  const query = ($('log-search')?.value || '').trim().toLowerCase();
  const logs = query
    ? AUDIT_LOGS.filter(log => Object.values(log).join(' ').toLowerCase().includes(query))
    : AUDIT_LOGS;

  const el = $('audit-table');
  if (!el) return;
  el.innerHTML = logs.map(log => `
    <tr>
      <td style="font-family:var(--mono);font-size:11px">${esc(log.time)}</td>
      <td><strong>${esc(log.action)}</strong></td>
      <td>${esc(log.instance)}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(log.by)}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(log.details || '-')}</td>
      <td><span class="badge ${statusCls(log.status)}">${esc(log.status)}</span></td>
    </tr>`).join('');
}

function renderControlInstances() {
  const tabs = $('ctrl-instance-tabs');
  if (tabs) {
    tabs.innerHTML = INSTANCES.map(instance => `
      <button class="inst-tab ${instance.name === selectedInstanceName ? 'active' : ''}" type="button" data-instance="${esc(instance.name)}">
        ${esc(instance.name)}
      </button>`).join('');
  }

  const info = $('ctrl-instance-info');
  const instance = selectedInstance();
  if (!info || !instance) return;
  const plan = findPlan(instance.planId);
  info.innerHTML = `
    <span class="ctrl-info-chip"><span class="ctrl-info-label">Status</span><span class="badge ${statusCls(instance.status)}">${esc(instance.status)}</span></span>
    <span class="ctrl-info-chip"><span class="ctrl-info-label">Domain</span>${esc(instance.domain)}</span>
    <span class="ctrl-info-chip"><span class="ctrl-info-label">Ports</span><span class="port-list">FE :${instance.fe} · BE :${instance.be}</span></span>
    <span class="ctrl-info-chip"><span class="ctrl-info-label">Plan</span>${esc(plan.name)}</span>
    <span class="ctrl-info-chip"><span class="ctrl-info-label">Storage</span>${fmt(instance.storage)} GB</span>`;
}

function renderModuleToggles() {
  const el = $('module-toggle-list');
  if (!el) return;
  el.innerHTML = PLATFORM_MODULES.map(module => `
    <div class="module-toggle-item">
      <div>
        <div class="module-toggle-name">${esc(module.name)}</div>
        <div class="module-toggle-desc">${esc(module.desc)}</div>
      </div>
      <label class="toggle-switch" title="${esc(module.name)}">
        <input type="checkbox" data-module="${esc(module.id)}" ${module.enabled ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>
    </div>`).join('');
}

function renderLogs(lines = []) {
  const el = $('log-viewer');
  if (!el) return;
  if (!lines.length) {
    el.innerHTML = '<span class="log-placeholder">Select an instance and click Fetch Logs -></span>';
    return;
  }
  el.innerHTML = lines.map(line => `<span class="log-line ${esc(line.type || '')}">${esc(line.text)}</span>`).join('');
}

function renderPricingPlans() {
  const grid = $('plans-grid');
  if (grid) {
    grid.innerHTML = PRICING_PLANS.map(plan => `
      <div class="plan-card ${plan.featured ? 'featured' : ''}">
        <div class="plan-card-top">
          <div class="plan-name">${esc(plan.name)}</div>
          <span class="plan-badge">${esc(plan.badge || plan.status)}</span>
          <div class="plan-price">
            <span class="plan-price-main">KES ${money(plan.monthly)}</span>
            <span class="plan-price-period">/mo</span>
          </div>
          <div class="plan-price-alt">KES ${money(plan.termly)} termly · KES ${money(plan.annual)} annual</div>
        </div>
        <div class="plan-card-body">
          <div class="plan-limit">Up to ${esc(plan.maxStudents)} learners · ${esc(plan.storageLimit)} storage</div>
          <ul class="plan-feature-list">
            ${plan.features.slice(0, 7).map(feature => `<li>${esc(feature)}</li>`).join('')}
          </ul>
        </div>
        <div class="plan-card-footer">
          <button class="tbl-btn primary" type="button" data-plan-edit="${esc(plan.id)}">Edit</button>
          <button class="tbl-btn" type="button" data-plan-assign="${esc(plan.id)}">Assign</button>
          <span class="badge ${statusCls(plan.status === 'active' ? 'Active' : plan.status === 'draft' ? 'Warning' : 'Offline')}">
            <span class="plan-status-dot ${esc(plan.status)}"></span>${esc(plan.status)}
          </span>
        </div>
      </div>`).join('');
  }

  const assignedInstances = INSTANCES.filter(instance => instance.planId).length;
  const monthlyRevenue = INSTANCES.reduce((sum, instance) => sum + findPlan(instance.planId).monthly, 0);
  const renewalsDue = INSTANCES.filter(instance => new Date(instance.nextRenewal) <= new Date('2026-05-29T00:00:00')).length;

  if ($('p-active-plans')) $('p-active-plans').textContent = PRICING_PLANS.filter(plan => plan.status === 'active').length;
  if ($('p-assigned')) $('p-assigned').textContent = assignedInstances;
  if ($('p-revenue')) $('p-revenue').textContent = `KES ${Math.round(monthlyRevenue / 1000)}K`;
  if ($('p-renewals')) $('p-renewals').textContent = renewalsDue;

  const table = $('plan-assignment-table');
  if (table) {
    table.innerHTML = INSTANCES.map(instance => {
      const plan = findPlan(instance.planId);
      const amount = instance.billingCycle === 'Annual' ? plan.annual : instance.billingCycle === 'Termly' ? plan.termly : plan.monthly;
      return `<tr>
        <td><div class="cell-school"><strong>${esc(instance.name)}</strong><div class="cell-domain">${esc(instance.domain)}</div></div></td>
        <td><span class="version-chip">${esc(plan.name)}</span></td>
        <td>${esc(instance.billingCycle)}</td>
        <td><strong>KES ${money(amount)}</strong></td>
        <td>${fmtDate(instance.nextRenewal)}</td>
        <td><span class="badge ${statusCls(instance.billingStatus)}">${esc(instance.billingStatus)}</span></td>
        <td>
          <div class="action-row">
            <button class="tbl-btn primary" type="button" data-billing-edit="${esc(instance.name)}">Change Plan</button>
            <button class="tbl-btn" type="button" data-billing-renew="${esc(instance.name)}">Mark Paid</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  renderFeatureMatrix();
}

function renderFeatureMatrix() {
  const head = $('feature-matrix-head');
  const body = $('feature-matrix-body');
  if (!head || !body) return;

  head.innerHTML = `<tr><th>Feature</th>${PRICING_PLANS.map(plan => `<th class="feat-plan-head">${esc(plan.name)}</th>`).join('')}</tr>`;
  body.innerHTML = FEATURE_MATRIX.map(feature => `
    <tr>
      <td><strong>${esc(feature)}</strong></td>
      ${PRICING_PLANS.map(plan => {
        const included = plan.features.some(item => item.toLowerCase().includes(feature.toLowerCase().replace('fee tracking', 'fee')));
        return `<td style="text-align:center"><span class="${included ? 'feat-check' : 'feat-cross'}">${included ? 'Yes' : '-'}</span></td>`;
      }).join('')}
    </tr>`).join('');
}

// Promote release (admin panel deploy)
let DEPLOY_TARGETS = [];

function instanceToDeployId(instanceName) {
  const inst = INSTANCES.find(item => item.name === instanceName);
  if (!inst) return slugify(instanceName).replace(/^zawadi-/, '');
  const project = inst.composeProject || inst.key || inferGroupKey(inst);
  return String(project).replace(/^zawadi-/, '') || slugify(instanceName);
}

function selectedDeployImageTag() {
  const custom = $('deploy-image-tag-custom')?.value.trim();
  if (custom) return custom;
  return $('deploy-image-tag')?.value.trim() || '';
}

function appendDeployLogLine(text, type = 'info') {
  const el = $('deploy-progress-log');
  if (!el) return;
  if (el.querySelector('.log-placeholder')) el.innerHTML = '';
  const line = document.createElement('div');
  line.className = `log-line${type === 'error' ? ' log-error' : ''}`;
  line.textContent = text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function clearDeployLog(message = 'Select schools and click Promote release.') {
  const el = $('deploy-progress-log');
  if (!el) return;
  el.innerHTML = `<span class="log-placeholder">${esc(message)}</span>`;
}

function renderDeployTargets(selectedIds = new Set()) {
  const list = $('deploy-target-list');
  if (!list) return;
  if (!DEPLOY_TARGETS.length) {
    list.innerHTML = '<div class="deploy-target-empty">No school stacks found on this server.</div>';
    return;
  }

  list.innerHTML = DEPLOY_TARGETS.map(target => {
    const checked = selectedIds.has(target.id) ? 'checked' : '';
    const badge = target.tier === 'demo'
      ? '<span class="deploy-target-badge">demo</span>'
      : (target.discovered && !target.inManifest ? '<span class="deploy-target-badge">discovered</span>' : '');
    return `<label class="deploy-target-item">
      <input type="checkbox" class="deploy-target-cb" value="${esc(target.id)}" ${checked} />
      <span>
        <strong>${esc(target.label)}</strong>${badge}
        <div class="deploy-target-meta">${esc(target.domain || target.composeProject || target.id)} · ${esc(target.tier || 'production')}</div>
      </span>
    </label>`;
  }).join('');
}

function getSelectedDeploySchoolIds() {
  return Array.from(document.querySelectorAll('.deploy-target-cb:checked')).map(el => el.value);
}

async function refreshDeployPanel(prefill = null) {
  try {
    const [targetsResp, releasesResp] = await Promise.all([
      fetch('/api/deploy/targets', { credentials: 'same-origin' }),
      fetch('/api/deploy/releases', { credentials: 'same-origin' }),
    ]);

    if (targetsResp.ok) {
      const data = await targetsResp.json();
      DEPLOY_TARGETS = Array.isArray(data.targets) ? data.targets.filter(t => t.selectable !== false) : [];
    }

    if (releasesResp.ok) {
      const data = await releasesResp.json();
      const select = $('deploy-image-tag');
      if (select) {
        const tags = Array.isArray(data.tags) ? data.tags : [];
        select.innerHTML = tags.map(row => {
          const tag = row.tag || row;
          const label = row.createdAt ? `${tag} (${row.createdAt})` : tag;
          return `<option value="${esc(tag)}">${esc(label)}</option>`;
        }).join('');
      }
    }

    const selected = new Set();
    if (prefill?.schoolIds) prefill.schoolIds.forEach(id => selected.add(id));
    if (prefill?.includeDemo) selected.add('demo');

    if ($('deploy-all-schools')) {
      $('deploy-all-schools').checked = Boolean(prefill?.allSchools);
    }
    if ($('deploy-include-demo')) {
      $('deploy-include-demo').checked = Boolean(prefill?.includeDemo);
    }

    renderDeployTargets(selected);
  } catch (error) {
    renderDeployTargets(new Set());
    toast(`Could not load deploy targets: ${error.message}`);
  }
}

function openPromoteDeploy(options = {}) {
  showSection('deployments', { deployPrefill: options, skipDeployLoad: true });
  refreshDeployPanel(options);
}

async function runPromoteDeploy() {
  const imageTag = selectedDeployImageTag();
  const allSchools = Boolean($('deploy-all-schools')?.checked);
  const includeDemo = Boolean($('deploy-include-demo')?.checked);
  const schoolIds = getSelectedDeploySchoolIds().filter(id => id !== 'demo');

  if (!imageTag) {
    toast('Choose or paste an image tag.');
    return;
  }
  if (!allSchools && !includeDemo && schoolIds.length === 0) {
    toast('Select at least one school, include demo, or choose all production schools.');
    return;
  }

  const summary = allSchools
    ? 'all production schools'
    : [...(includeDemo ? ['demo'] : []), ...schoolIds].join(', ');

  openConfirm({
    title: 'Promote release',
    body: `Deploy ${imageTag} to: ${summary}. Each target runs backup, migrate, and health check.`,
    confirmLabel: 'Promote now',
    onConfirm: () => executePromoteDeploy({ imageTag, allSchools, includeDemo, schoolIds }),
  });
}

async function executePromoteDeploy({ imageTag, allSchools, includeDemo, schoolIds }) {
  clearDeployLog('');
  appendDeployLogLine(`[${nowLabel()}] Promoting ${imageTag}…`);
  const btn = $('deploy-promote-btn');
  if (btn) btn.disabled = true;

  try {
    const response = await fetch('/api/deploy/promote', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageTag, allSchools, includeDemo, schoolIds }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      appendDeployLogLine(data.error || `Deploy failed (HTTP ${response.status})`, 'error');
      if (Array.isArray(data.results)) {
        data.results.forEach(result => {
          appendDeployLogLine(`— ${result.target}: ${result.ok ? 'ok' : 'failed'}`, result.ok ? 'info' : 'error');
          if (result.log) appendDeployLogLine(result.log);
        });
      }
      toast(data.error || 'Promote failed.');
      return;
    }

    (data.results || []).forEach(result => {
      appendDeployLogLine(`✓ ${result.target} (${result.durationSec || '?'}s)`);
      if (result.log) appendDeployLogLine(result.log);
    });
    appendDeployLogLine(`[${nowLabel()}] Promote complete.`);

    await refreshFromRuntime();
    renderEverything();
    toast(`Promoted ${imageTag} successfully.`);
  } catch (error) {
    appendDeployLogLine(error.message || 'Network error', 'error');
    toast('Promote request failed.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Navigation
const SECTIONS = ['overview', 'instances', 'storage', 'deployments', 'controls', 'pricing', 'logs', 'leads'];
const SECTION_LABELS = {
  overview: 'Overview',
  instances: 'Instances',
  storage: 'Storage',
  deployments: 'Promote Release',
  controls: 'Controls',
  pricing: 'Pricing Plans',
  logs: 'Audit Log',
  leads: 'Leads & CRM',
};

function sectionFromHash() {
  const raw = decodeURIComponent(window.location.hash || '').replace(/^#\/?/, '');
  return SECTIONS.includes(raw) ? raw : 'overview';
}

function showSection(id, options = {}) {
  const targetSection = SECTIONS.includes(id) ? id : 'overview';
  SECTIONS.forEach(section => {
    const el = $(`section-${section}`);
    if (el) el.className = section === targetSection ? 'section-visible' : 'section-hidden';
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === targetSection);
  });
  if ($('breadcrumb-active')) $('breadcrumb-active').textContent = SECTION_LABELS[targetSection] || targetSection;

  if (targetSection === 'deployments' && !options.skipDeployLoad) {
    refreshDeployPanel(options.deployPrefill || null);
  }

  if (!options.skipHashUpdate) {
    const nextHash = `#${targetSection}`;
    if (window.location.hash !== nextHash) {
      history.pushState(null, '', nextHash);
    }
  }
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', event => {
    event.preventDefault();
    showSection(el.dataset.section);
  });
});

window.addEventListener('hashchange', () => {
  showSection(sectionFromHash(), { skipHashUpdate: true });
});

function setSidebarCollapsed(collapsed) {
  const shell = $('app-shell');
  const toggle = $('sidebar-toggle');
  if (!shell || !toggle) return;
  shell.classList.toggle('sidebar-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  try {
    window.localStorage.setItem('console.sidebar.collapsed', collapsed ? '1' : '0');
  } catch (_) {}
}

function initSidebarToggle() {
  const toggle = $('sidebar-toggle');
  if (!toggle) return;
  let collapsed = false;
  try {
    collapsed = window.localStorage.getItem('console.sidebar.collapsed') === '1';
  } catch (_) {}
  setSidebarCollapsed(collapsed);
  toggle.addEventListener('click', () => {
    const isCollapsed = $('app-shell')?.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(!isCollapsed);
  });
}

// Modals
function openModal(appKey = 'school', sourceLeadId = null) {
  pendingProvisionLeadId = sourceLeadId;
  if ($('f-domain')) {
    $('f-domain').value = '';
    delete $('f-domain').dataset.userEdited;
  }
  if ($('f-name')) $('f-name').value = '';
  if ($('f-notes')) $('f-notes').value = '';
  prepareProvisionDefaults(appKey);
  $('modal-overlay')?.classList.add('open');
}

function closeModal() {
  pendingProvisionLeadId = null;
  $('modal-overlay')?.classList.remove('open');
}

function openPlanModal(plan = null) {
  editingPlanId = plan?.id || null;
  if ($('plan-modal-title')) $('plan-modal-title').textContent = plan ? `Edit ${plan.name}` : 'New Pricing Plan';
  if ($('p-name')) $('p-name').value = plan?.name || '';
  if ($('p-badge')) $('p-badge').value = plan?.badge || '';
  if ($('p-monthly')) $('p-monthly').value = plan?.monthly || '';
  if ($('p-termly')) $('p-termly').value = plan?.termly || '';
  if ($('p-annual')) $('p-annual').value = plan?.annual || '';
  if ($('p-students')) $('p-students').value = plan?.maxStudents || '';
  if ($('p-storage-limit')) $('p-storage-limit').value = plan?.storageLimit || '';
  if ($('p-features')) $('p-features').value = plan?.features?.join('\n') || '';
  if ($('p-status')) $('p-status').value = plan?.status || 'active';
  $('plan-modal-overlay')?.classList.add('open');
}

function closePlanModal() {
  editingPlanId = null;
  $('plan-modal-overlay')?.classList.remove('open');
}

function openConfirm({ title, body, requireText = '', confirmLabel = 'Confirm', onConfirm }) {
  pendingConfirm = { requireText, onConfirm };
  if ($('confirm-title')) $('confirm-title').textContent = title;
  if ($('confirm-body')) $('confirm-body').textContent = body;
  if ($('confirm-ok')) $('confirm-ok').textContent = confirmLabel;
  if ($('confirm-input')) {
    $('confirm-input').value = '';
    $('confirm-input').placeholder = requireText;
  }
  if ($('confirm-input-row')) $('confirm-input-row').style.display = requireText ? '' : 'none';
  $('confirm-overlay')?.classList.add('open');
}

function closeConfirm() {
  pendingConfirm = null;
  $('confirm-overlay')?.classList.remove('open');
}

function savePlan() {
  const name = $('p-name')?.value.trim();
  if (!name) {
    toast('Please enter a plan name.');
    return;
  }

  const plan = {
    id: editingPlanId || slugify(name),
    name,
    badge: $('p-badge')?.value.trim() || 'Plan',
    monthly: Number($('p-monthly')?.value || 0),
    termly: Number($('p-termly')?.value || 0),
    annual: Number($('p-annual')?.value || 0),
    maxStudents: $('p-students')?.value.trim() || 'Custom',
    storageLimit: $('p-storage-limit')?.value.trim() || 'Custom',
    status: $('p-status')?.value || 'active',
    featured: false,
    features: ($('p-features')?.value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean),
  };

  const existingIndex = PRICING_PLANS.findIndex(item => item.id === plan.id);
  if (existingIndex >= 0) {
    PRICING_PLANS[existingIndex] = { ...PRICING_PLANS[existingIndex], ...plan };
    addAudit({ action: 'Pricing Plan Updated', instance: plan.name, details: 'Demo plan edited locally' });
  } else {
    PRICING_PLANS.push(plan);
    addAudit({ action: 'Pricing Plan Created', instance: plan.name, details: 'Demo plan added locally' });
  }

  renderPricingPlans();
  closePlanModal();
  toast(`${plan.name} saved in demo mode.`);
}

// Controls
async function callControlStub(action, instanceKey = '') {
  try {
    const endpoint = instanceKey
      ? `/api/instances/${encodeURIComponent(instanceKey)}/${encodeURIComponent(action)}`
      : `/api/controls/${encodeURIComponent(action)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) return { ok: false };
    const data = await response.json().catch(() => ({}));
    return { ok: true, data };
  } catch (_) {
    return { ok: false };
  }
}

function controlLogLines(action, instance) {
  const target = instance?.name || 'All Instances';
  return [
    { type: 'info', text: `[${nowLabel()}] queued ${action} for ${target}` },
    { text: `[${nowLabel()}] checking container state and latest image tag` },
    { text: `[${nowLabel()}] writing audit event to console activity log` },
    { type: 'warn', text: `[${nowLabel()}] demo mode: no production container was changed` },
  ];
}

async function runControl(action, label, options = {}) {
  const instance = selectedInstance();
  const target = options.global ? 'All Instances' : instance.name;

  if (options.confirm) {
    openConfirm({
      title: label,
      body: `${label} will be recorded for ${target}. This demo does not change production, but the real version will require this confirmation before continuing.`,
      requireText: options.requireText ? instance.name : '',
      confirmLabel: label,
      onConfirm: () => runControl(action, label, { ...options, confirm: false }),
    });
    return;
  }

  const actionMap = { redeploy: 'redeploy', restart: 'restart', stop: 'stop', drop: 'drop', start: 'start', health: 'health' };
  const mappedAction = actionMap[action] || action;
  const result = await callControlStub(mappedAction, options.global ? '' : instance.key || instance.name);
  if (!result.ok) {
    toast('Control API is not available or your role is not allowed.');
  }

  await refreshFromRuntime();

  renderLogs(controlLogLines(action, options.global ? null : instance));
  addAudit({
    action: label,
    instance: target,
    details: result.ok ? 'Live control endpoint executed request' : 'Control failed or denied',
    status: action.includes('stop') || action.includes('reset') || action.includes('purge') || action.includes('remove') ? 'Warning' : 'Success',
  });
  renderEverything();
  toast(`${label} recorded for ${target}.`);
}

async function handleControlButton(btn) {
  const action = btn.dataset.ctrl;
  const label = btn.dataset.label || action;
  const global = action?.endsWith('-all');

  if (action === 'redeploy' || action === 'redeploy-all') {
    if (global) {
      openPromoteDeploy({ allSchools: true });
    } else {
      const active = selectedInstance();
      openPromoteDeploy({ schoolIds: [instanceToDeployId(active.name)] });
    }
    return;
  }

  const destructive = ['stop', 'drop', 'stop-all', 'restore', 'reset', 'purge', 'remove'].includes(action);
  const requireText = ['drop', 'reset', 'purge', 'remove'].includes(action);

  if (action === 'logs') {
    const active = selectedInstance();
    try {
      const response = await fetch(`/api/instances/${encodeURIComponent(active.key || active.name)}/logs`, {
        credentials: 'same-origin',
      });
      if (response.ok) {
        const data = await response.json();
        const lines = String(data.logs || '').split(/\r?\n/).filter(Boolean).slice(-120).map(text => ({ text }));
        renderLogs(lines);
        addAudit({ action: 'Fetch Logs', instance: active.name, details: 'Live logs fetched from server containers' });
        toast('Live logs loaded.');
        return;
      }
    } catch (_) {}
    renderLogs(controlLogLines('logs', active));
    addAudit({ action: 'Fetch Logs', instance: active.name, details: 'Fallback demo logs shown', status: 'Warning' });
    toast('Could not fetch live logs. Showing fallback.');
    return;
  }

  runControl(action, label, { global, confirm: destructive, requireText });
}

function exportLogsCsv() {
  const rows = [['Time', 'Action', 'Instance', 'Performed By', 'Details', 'Status'], ...AUDIT_LOGS.map(log => [
    log.time,
    log.action,
    log.instance,
    log.by,
    log.details || '',
    log.status,
  ])];
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trends-core-audit-log.csv';
  link.click();
  URL.revokeObjectURL(url);
  toast('Audit CSV prepared.');
}

// Event wiring
document.body.addEventListener('click', event => {
  if (event.target.closest('.group-open-link')) {
    return;
  }

  const groupHead = event.target.closest('.group-head');
  if (groupHead) {
    const groupKey = groupHead.dataset.group;
    const rows = document.querySelectorAll(`.group-row[data-group="${groupKey}"]`);
    const chevron = groupHead.querySelector('.group-chevron');
    const isClosed = Array.from(rows).every(row => row.style.display === 'none');
    rows.forEach(row => {
      row.style.display = isClosed ? '' : 'none';
    });
    if (chevron) chevron.textContent = isClosed ? '▾' : '▸';
    return;
  }

  const btn = event.target.closest('button');
  if (!btn) return;

  const id = btn.id;
  const createButtonMap = {
    'btn-create-school': 'school',
    'btn-create2-school': 'school',
    'btn-create3-school': 'school',
    'btn-create2-odoo': 'odoo',
    'btn-create3-odoo': 'odoo',
    'btn-create2-wordpress': 'wordpress',
    'btn-create3-wordpress': 'wordpress',
    'btn-create2-sacco': 'sacco',
    'btn-create3-sacco': 'sacco',
    'btn-create2-hospital': 'hospital',
    'btn-create3-hospital': 'hospital',
    'btn-create2-hotel': 'hotel',
    'btn-create3-hotel': 'hotel',
    'btn-create2-organization': 'organization',
    'btn-create3-organization': 'organization',
  };

  if (createButtonMap[id]) {
    openModal(createButtonMap[id]);
    return;
  }

  if (id === 'btn-refresh') {
    (async () => {
      await refreshFromRuntime();
      if ($('last-updated')) $('last-updated').textContent = `Refreshed ${nowLabel()}${liveMode ? ' · live' : ' · fallback'}`;
      renderEverything();
      toast(liveMode ? 'Live metrics refreshed.' : 'Could not refresh live metrics; fallback data shown.');
    })();
    return;
  }

  if (id === 'btn-clear-logs') {
    renderLogs();
    return;
  }

  if (id === 'btn-new-plan') {
    openPlanModal();
    return;
  }

  if (id === 'btn-export-logs') {
    exportLogsCsv();
    return;
  }

  if (id === 'btn-filter-logs') {
    $('log-search')?.focus();
    return;
  }

  const instanceTab = btn.dataset.instance;
  if (instanceTab) {
    selectedInstanceName = instanceTab;
    renderControlInstances();
    renderLogs();
    return;
  }

  const planEdit = btn.dataset.planEdit;
  if (planEdit) {
    openPlanModal(PRICING_PLANS.find(plan => plan.id === planEdit));
    return;
  }

  const planAssign = btn.dataset.planAssign;
  if (planAssign) {
    const plan = findPlan(planAssign);
    toast(`Choose a school from the assignment table to move it to ${plan.name}.`);
    return;
  }

  const billingEdit = btn.dataset.billingEdit;
  if (billingEdit) {
    const instance = INSTANCES.find(item => item.name === billingEdit);
    selectedInstanceName = instance?.name || selectedInstanceName;
    toast('Plan assignment editing will connect to billing workflows in Phase 2.');
    showSection('pricing');
    return;
  }

  const billingRenew = btn.dataset.billingRenew;
  if (billingRenew) {
    const instance = INSTANCES.find(item => item.name === billingRenew);
    if (instance) {
      instance.billingStatus = 'Active';
      addAudit({ action: 'Billing Renewal Marked', instance: instance.name, details: 'Demo renewal status updated locally' });
      renderPricingPlans();
      toast(`${instance.name} marked as paid in demo mode.`);
    }
    return;
  }

  const action = btn.dataset.action;
  const school = btn.dataset.school;
  if (action === 'Redeploy' && school) {
    openPromoteDeploy({ schoolIds: [instanceToDeployId(school)] });
    return;
  }
  if (action && school) {
    selectedInstanceName = school;
    handleControlButton({ dataset: { ctrl: action.toLowerCase(), label: action } });
    return;
  }

  if (btn.dataset.ctrl) {
    handleControlButton(btn);
  }
});

document.body.addEventListener('change', event => {
  const toggle = event.target.closest('input[data-module]');
  if (!toggle) return;
  const module = PLATFORM_MODULES.find(item => item.id === toggle.dataset.module);
  if (!module) return;
  module.enabled = toggle.checked;
  addAudit({
    action: toggle.checked ? 'Module Enabled' : 'Module Disabled',
    instance: selectedInstance().name,
    details: `${module.name} toggled in demo mode`,
    status: 'Success',
  });
  toast(`${module.name} ${toggle.checked ? 'enabled' : 'disabled'} for ${selectedInstance().name}.`);
});

function bindModalEvents() {
  $('modal-close')?.addEventListener('click', closeModal);
  $('modal-cancel')?.addEventListener('click', closeModal);
  $('modal-overlay')?.addEventListener('click', event => { if (event.target === $('modal-overlay')) closeModal(); });
  $('f-version')?.addEventListener('change', syncProvisionImage);
  $('f-name')?.addEventListener('input', () => {
    const name = $('f-name')?.value.trim();
    if (!name) return;
    if ($('f-domain') && !$('f-domain').value.trim()) {
      $('f-domain').dataset.userEdited = '';
      $('f-domain').value = `${slugify(name)}.${APP_PROVISIONING_CATALOG[currentProvisionApp].defaultDomainSuffix}`;
    }
    renderComposePreview();
    refreshProvisionAutoAssignment();
  });
  $('f-domain')?.addEventListener('input', () => {
    if ($('f-domain')) $('f-domain').dataset.userEdited = 'true';
  });
  ['f-domain', 'f-port-fe', 'f-port-be', 'f-admin-email', 'f-notes', 'f-type', 'f-plan', 'f-image'].forEach(id => {
    $(id)?.addEventListener('input', renderComposePreview);
    $(id)?.addEventListener('change', renderComposePreview);
  });

  $('modal-submit')?.addEventListener('click', () => {
    (async () => {
      const app = APP_PROVISIONING_CATALOG[currentProvisionApp] || APP_PROVISIONING_CATALOG.school;
      const name = $('f-name')?.value.trim();
      if (!name) {
        toast(`Please enter a ${app.label} instance name.`);
        return;
      }

      const version = selectedProvisionVersion(currentProvisionApp);
      const appRange = APP_PORT_RANGES[currentProvisionApp] || APP_PORT_RANGES.school;
      const domainWasUserEdited = $('f-domain')?.dataset.userEdited === 'true';
      const payload = {
        appType: currentProvisionApp,
        name,
        domain: $('f-domain')?.value.trim() || '',
        version: version?.value || 'latest',
        image: version?.image || '',
        fePort: Number($('f-port-fe')?.value || 0) || 0,
        bePort: appRange.requireBe ? (Number($('f-port-be')?.value || 0) || 0) : 0,
        institutionType: $('f-type')?.value || 'PRIMARY_CBC',
        planId: $('f-plan')?.value || 'professional',
        adminEmail: $('f-admin-email')?.value.trim() || '',
        notes: $('f-notes')?.value.trim() || '',
        db: `${currentProvisionApp}_${slugify(name).replace(/-/g, '_')}`,
      };

      try {
        setProvisionSubmitBusy(true);
        startInstallProgress();
        setInstallProgress(20);
        const preflightResponse = await fetch('/api/instances/preflight', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setInstallProgress(45);
        if (preflightResponse.ok) {
          const preflight = await preflightResponse.json().catch(() => null);
          if (preflight && preflight.valid === false) {
            finishInstallProgress(false);
            const msg = Array.isArray(preflight.issues) && preflight.issues.length
              ? preflight.issues.join(' ')
              : 'Preflight check failed.';
            addAudit({
              action: `Provision ${app.label} Blocked`,
              instance: payload.name,
              details: msg,
              status: 'Warning',
            });
            toast(msg);
            return;
          }
          if (preflight?.autoAssigned) {
            if (!domainWasUserEdited) {
              payload.domain = preflight.autoAssigned.domain || payload.domain;
            }
            payload.fePort = Number(preflight.autoAssigned.fePort || payload.fePort || 0);
            payload.bePort = appRange.requireBe
              ? Number(preflight.autoAssigned.bePort || payload.bePort || 0)
              : 0;
            if (!domainWasUserEdited && $('f-domain')) $('f-domain').value = payload.domain || '';
            if ($('f-port-fe')) $('f-port-fe').value = payload.fePort || '';
            if ($('f-port-be') && appRange.requireBe) $('f-port-be').value = payload.bePort || '';
            renderComposePreview();
          }
          if (preflight && Array.isArray(preflight.warnings) && preflight.warnings.length) {
            toast(`Preflight warning: ${preflight.warnings[0]}`);
          }
        } else {
          finishInstallProgress(false);
          const preflightError = await readApiError(preflightResponse, 'Preflight request failed.');
          addAudit({
            action: `Provision ${app.label} Failed`,
            instance: payload.name,
            details: `Preflight failed: ${preflightError}`,
            status: 'Warning',
          });
          toast(preflightError);
          return;
        }

        const response = await fetch('/api/instances/create', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setInstallProgress(92);

        if (!response.ok) {
          finishInstallProgress(false);
          const message = await readApiError(response, `Create ${app.label} instance failed.`);
          addAudit({
            action: `Provision ${app.label} Failed`,
            instance: payload.name,
            details: message,
            status: 'Warning',
          });
          toast(message);
          return;
        }

        addAudit({
          action: `Provision ${app.label}`,
          instance: payload.name,
          details: `${app.label} ${payload.version} requested (${payload.image})`,
          status: 'Warning',
        });
        if (pendingProvisionLeadId) {
          const leadIdx = LEADS.findIndex(l => l.id === pendingProvisionLeadId);
          if (leadIdx >= 0) {
            const updatedLead = {
              ...LEADS[leadIdx],
              stage: 'converted',
              nextActivity: `Provisioning ${app.label} (${payload.version})`,
              notes: [LEADS[leadIdx].notes, `Provision requested for ${payload.name} (${payload.domain})`]
                .filter(Boolean)
                .join(' | '),
            };
            try {
              LEADS[leadIdx] = await updateLeadApi(updatedLead.id, updatedLead);
              addAudit({
                action: 'Lead Converted',
                instance: updatedLead.school,
                details: `Lead linked to provisioning request for ${payload.name}`,
                status: 'Success',
              });
            } catch (_) {
              // Keep provisioning success even if lead update fails.
            }
          }
        }
        await refreshFromRuntime();
        renderEverything();
        closeModal();
        finishInstallProgress(true);
        toast(`Provisioning "${name}" (${app.label}) started.`);
        return;
      } catch (error) {
        finishInstallProgress(false);
        const message = error?.message || 'Provision endpoint unreachable.';
        addAudit({
          action: `Provision ${app.label} Failed`,
          instance: payload.name,
          details: message,
          status: 'Warning',
        });
        toast(message);
      } finally {
        setProvisionSubmitBusy(false);
      }
    })();
  });

  $('plan-modal-close')?.addEventListener('click', closePlanModal);
  $('plan-modal-cancel')?.addEventListener('click', closePlanModal);
  $('plan-modal-submit')?.addEventListener('click', savePlan);
  $('plan-modal-overlay')?.addEventListener('click', event => { if (event.target === $('plan-modal-overlay')) closePlanModal(); });

  $('confirm-close')?.addEventListener('click', closeConfirm);
  $('confirm-cancel')?.addEventListener('click', closeConfirm);
  $('confirm-overlay')?.addEventListener('click', event => { if (event.target === $('confirm-overlay')) closeConfirm(); });
  $('confirm-ok')?.addEventListener('click', () => {
    if (!pendingConfirm) return;
    const required = pendingConfirm.requireText;
    if (required && $('confirm-input')?.value.trim() !== required) {
      toast('Confirmation text does not match.');
      return;
    }
    const onConfirm = pendingConfirm.onConfirm;
    closeConfirm();
    onConfirm?.();
  });

  $('log-search')?.addEventListener('input', renderAuditLog);
}

function renderEverything() {
  renderMetrics();
  renderInstances();
  renderRunningInstances();
  renderCapacity();
  renderTimeline('timeline-mini', 3);
  renderTimeline('timeline-full');
  renderStorageSection();
  renderSpaceUsage();
  renderAuditLog();
  renderControlInstances();
  renderModuleToggles();
  renderPricingPlans();
  if(typeof renderPipeline === 'function') renderPipeline();
  if(typeof renderLeadsList === 'function') renderLeadsList();
}

// CRM View Toggles
$('btn-view-pipeline')?.addEventListener('click', () => {
  if($('kanban-board')) $('kanban-board').style.display = '';
  if($('leads-list-panel')) $('leads-list-panel').style.display = 'none';
  $('btn-view-pipeline')?.classList.add('active');
  $('btn-view-list')?.classList.remove('active');
  $('btn-view-clients')?.classList.remove('active');
});

$('btn-view-list')?.addEventListener('click', () => {
  if($('kanban-board')) $('kanban-board').style.display = 'none';
  if($('leads-list-panel')) $('leads-list-panel').style.display = 'block';
  if($('leads-panel-title')) $('leads-panel-title').textContent = 'All Leads';
  if($('crm-table-sub')) $('crm-table-sub').textContent = 'Showing all pipeline stages';
  activeLeadFilter = null;
  renderLeadsList();
  $('btn-view-pipeline')?.classList.remove('active');
  $('btn-view-list')?.classList.add('active');
  $('btn-view-clients')?.classList.remove('active');
});

$('btn-view-clients')?.addEventListener('click', () => {
  if($('kanban-board')) $('kanban-board').style.display = 'none';
  if($('leads-list-panel')) $('leads-list-panel').style.display = 'block';
  if($('leads-panel-title')) $('leads-panel-title').textContent = 'Client Base';
  if($('crm-table-sub')) $('crm-table-sub').textContent = 'Showing converted clients only';
  activeLeadFilter = 'converted';
  renderLeadsList();
  $('btn-view-pipeline')?.classList.remove('active');
  $('btn-view-list')?.classList.remove('active');
  $('btn-view-clients')?.classList.add('active');
});

window.openLeadModal = function(defaultStage = 'new', editLeadId = null) {
  const lead = editLeadId ? LEADS.find(l => l.id === editLeadId) : null;
  
  if($('lead-modal-title')) $('lead-modal-title').textContent = lead ? 'Edit Lead' : 'Add New Lead';
  if($('lead-modal-submit')) $('lead-modal-submit').dataset.editId = editLeadId || '';

  if($('l-name')) $('l-name').value = lead?.name || '';
  if($('l-phone')) $('l-phone').value = lead?.phone || '';
  if($('l-school')) $('l-school').value = lead?.school || '';
  if($('l-stage')) $('l-stage').value = lead?.stage || defaultStage;
  if($('l-priority')) $('l-priority').value = lead?.priority || '1';
  if($('l-students')) $('l-students').value = lead?.students || '';
  if($('l-tags')) $('l-tags').value = (lead?.tags || []).join(', ');
  
  if($('l-sys-assessment')) $('l-sys-assessment').value = lead?.systems?.assessment || '';
  if($('l-sys-fees')) $('l-sys-fees').value = lead?.systems?.fees || '';
  if($('l-sys-lms')) $('l-sys-lms').value = lead?.systems?.lms || '';
  if($('l-notes')) $('l-notes').value = lead?.notes || '';

  $('lead-modal-overlay')?.classList.add('open');
};

$('lead-modal-close')?.addEventListener('click', () => $('lead-modal-overlay')?.classList.remove('open'));
$('lead-modal-cancel')?.addEventListener('click', () => $('lead-modal-overlay')?.classList.remove('open'));
$('btn-new-lead')?.addEventListener('click', () => openLeadModal('new', null));
$('btn-toggle-crm-metrics')?.addEventListener('click', toggleCrmMetrics);

$('lead-modal-submit')?.addEventListener('click', async () => {
  const name = $('l-name').value?.trim();
  const school = $('l-school').value?.trim();
  if (!name || !school) {
    toast('Name and School are required.');
    return;
  }

  const editId = $('lead-modal-submit').dataset.editId;
  const newLead = {
    id: editId || 'L' + Date.now(),
    name,
    school,
    phone: $('l-phone').value?.trim(),
    stage: $('l-stage').value,
    priority: $('l-priority').value,
    students: Number($('l-students').value) || 0,
    tags: ($('l-tags').value || '').split(',').map(t => t.trim()).filter(Boolean),
    systems: {
      assessment: $('l-sys-assessment').value?.trim() || 'None',
      fees: $('l-sys-fees').value?.trim() || 'None',
      lms: $('l-sys-lms').value?.trim() || 'None',
    },
    notes: $('l-notes').value?.trim(),
    nextActivity: editId ? (LEADS.find(l=>l.id===editId)?.nextActivity) : 'New lead added'
  };

  try {
    if (editId) {
      const updated = await updateLeadApi(editId, newLead);
      const idx = LEADS.findIndex(l => l.id === editId);
      if (idx >= 0) LEADS[idx] = updated;
    } else {
      const created = await createLeadApi(newLead);
      LEADS.push(created);
    }
  } catch (error) {
    toast(error.message || 'Save failed');
    return;
  }

  addAudit({ action: editId ? 'Lead Updated' : 'Lead Added', instance: school, details: `Stage: ${newLead.stage}` });
  
  $('lead-modal-overlay')?.classList.remove('open');
  renderEverything();
  toast(editId ? 'Lead updated' : 'Lead added successfully');
});

function bindDeployEvents() {
  const openPromote = () => openPromoteDeploy();
  $('deploy-promote-btn')?.addEventListener('click', runPromoteDeploy);
  $('btn-deploy-open-promote')?.addEventListener('click', runPromoteDeploy);
  $('btn-header-promote')?.addEventListener('click', openPromote);
  $('btn-overview-promote')?.addEventListener('click', openPromote);
  $('metric-last-deploy')?.addEventListener('click', openPromote);
  $('metric-last-deploy')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPromote();
    }
  });
  $('btn-deploy-refresh')?.addEventListener('click', () => refreshDeployPanel());
  $('btn-deploy-clear-log')?.addEventListener('click', () => clearDeployLog());
  $('deploy-select-all')?.addEventListener('click', () => {
    document.querySelectorAll('.deploy-target-cb').forEach(cb => {
      const target = DEPLOY_TARGETS.find(t => t.id === cb.value);
      if (target?.tier !== 'demo') cb.checked = true;
    });
  });
  $('deploy-select-none')?.addEventListener('click', () => {
    document.querySelectorAll('.deploy-target-cb').forEach(cb => { cb.checked = false; });
    if ($('deploy-include-demo')) $('deploy-include-demo').checked = false;
    if ($('deploy-all-schools')) $('deploy-all-schools').checked = false;
  });
  $('deploy-all-schools')?.addEventListener('change', event => {
    const disabled = event.target.checked;
    document.querySelectorAll('.deploy-target-cb').forEach(cb => { cb.disabled = disabled; });
    if ($('deploy-include-demo')) $('deploy-include-demo').disabled = disabled;
  });
}

async function init() {
  bindModalEvents();
  bindDeployEvents();
  initSidebarToggle();
  showSection(sectionFromHash(), { skipHashUpdate: true });
  await loadLeadsFromApi();
  await refreshFromRuntime();
  renderEverything();
  renderLogs();
  renderRuntimeStamp();
  startRuntimePolling(20000);
}

init();
