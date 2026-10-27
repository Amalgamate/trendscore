'use strict';

// ── State ─────────────────────────────────────────────────────────────────
let currentAgent = null;
let currentTab = 'dashboard';
const TOKEN_KEY = 'trendscore_agent_jwt';

// ── Utilities ─────────────────────────────────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotice');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast-notice ${isError ? 'error' : ''} show`;
  setTimeout(() => {
    toast.className = 'toast-notice';
  }, 3500);
}

function formatKsh(val) {
  return Number(val || 0).toLocaleString('en-KE');
}

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    clearStoredToken();
    showLoginView();
    throw new Error('Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ── View Management ───────────────────────────────────────────────────────
function showLoginView() {
  document.getElementById('viewLogin').style.display = 'flex';
  document.getElementById('viewApp').style.display = 'none';
  currentAgent = null;
}

function showAppView() {
  document.getElementById('viewLogin').style.display = 'none';
  document.getElementById('viewApp').style.display = 'flex';
  // Ensure pending screen is hidden by default until renderAgent decides
  const pending = document.getElementById('viewPending');
  if (pending) pending.style.display = 'none';
}

function showPendingView(agent) {
  // Fill in registration details
  const el = (id) => document.getElementById(id);
  if (el('pendingAgentName')) el('pendingAgentName').textContent = agent.full_name || '—';
  if (el('pendingAgentPhone')) el('pendingAgentPhone').textContent = `Phone: ${agent.phone || '—'}`;
  if (el('pendingAgentCode')) el('pendingAgentCode').textContent = `Agent Code: ${agent.agent_code || '—'}`;

  // Show pending screen; hide all normal tabs and nav
  const pending = el('viewPending');
  if (pending) pending.style.display = 'block';

  const tabs = ['dashboard', 'schools', 'earnings', 'profile', 'marketplace'];
  tabs.forEach(t => {
    const tab = el(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (tab) tab.style.display = 'none';
  });

  // Hide bottom nav and sidebar nav on pending screen
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) sidebarNav.style.opacity = '0.3';
  const sidebarAction = document.querySelector('.sidebar-action-wrap');
  if (sidebarAction) sidebarAction.style.display = 'none';
}

function switchTab(tab) {
  currentTab = tab;
  const tabs = ['dashboard', 'schools', 'earnings', 'profile', 'marketplace'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const nav = document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const navDesktop = document.getElementById(`navDesktop${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (el) el.style.display = (t === tab) ? 'block' : 'none';
    if (nav) nav.classList.toggle('active', t === tab);
    if (navDesktop) navDesktop.classList.toggle('active', t === tab);
  });
  if (tab === 'marketplace') {
    renderMarketplace();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ── Authentication ────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const authHeading = document.getElementById('authHeading');
  const authSubheading = document.getElementById('authSubheading');

  if (tabBtnLogin) tabBtnLogin.classList.toggle('active', isLogin);
  if (tabBtnRegister) tabBtnRegister.classList.toggle('active', !isLogin);
  if (formLogin) formLogin.style.display = isLogin ? 'block' : 'none';
  if (formRegister) formRegister.style.display = !isLogin ? 'block' : 'none';

  if (authHeading) {
    authHeading.textContent = isLogin ? 'Field Agent Portal' : 'Join Field Agent Network';
  }
  if (authSubheading) {
    authSubheading.textContent = isLogin 
      ? 'Access your school portfolio, commissions, and marketplace'
      : 'Self-register to start onboarding schools and earning 10% commission';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value.trim();
  const pin = document.getElementById('loginPin').value.trim();
  const btn = document.getElementById('btnLogin');

  if (!phone || !pin) {
    showToast('Enter your phone and PIN', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Verifying...</span>';

  try {
    const data = await api('/api/agent/login', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });

    if (data.token) setStoredToken(data.token);
    currentAgent = data.agent;
    showAppView();
    if (data.agent.status === 'pending') {
      showToast('Your account is awaiting approval.');
      showPendingView(data.agent);
    } else {
      showToast(`Welcome back, ${data.agent.full_name}!`);
      renderAgent();
      switchTab('dashboard');
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In to Portal</span>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const county = document.getElementById('regCounty').value.trim();
  const baseLocation = (document.getElementById('regBaseLocation')?.value || '').trim();
  const mpesa = (document.getElementById('regMpesa')?.value || '').trim();
  const email = (document.getElementById('regEmail')?.value || '').trim();
  const pin = document.getElementById('regPin').value.trim();
  const pinConfirm = document.getElementById('regPinConfirm').value.trim();
  const btn = document.getElementById('btnRegister');

  if (!fullName || fullName.length < 2) {
    showToast('Please enter your full name', true);
    return;
  }
  if (!phone || phone.length < 9) {
    showToast('Please enter a valid phone number (e.g. 07... or 01...)', true);
    return;
  }
  if (!county) {
    showToast('Please select your county', true);
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    showToast('Security PIN must be exactly 4 numeric digits', true);
    return;
  }
  if (pin !== pinConfirm) {
    showToast('PINs do not match. Please verify your 4-digit PIN.', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Creating Account...</span>';

  try {
    const data = await api('/api/agent/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        phone,
        county,
        base_location: baseLocation,
        mpesa_number: mpesa || phone,
        email,
        pin,
      }),
    });

    if (data.token) setStoredToken(data.token);
    currentAgent = data.agent;
    showAppView();
    if (data.agent.status === 'pending') {
      showToast('Registration successful! Your application is under review.');
      showPendingView(data.agent);
    } else {
      showToast(data.message || `Welcome to TrendSCORE, ${data.agent.full_name}!`);
      renderAgent();
      switchTab('dashboard');
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Create Account &amp; Start Earning</span>';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/agent/logout', { method: 'POST' });
  } catch {}
  clearStoredToken();
  showToast('Signed out');
  showLoginView();
}

async function fetchAgentData() {
  try {
    const data = await api('/api/agent/me');
    currentAgent = data.agent;
    renderAgent();
    showToast('Updated');
  } catch (err) {
    showToast(err.message, true);
  }
}

function getInitials(name) {
  if (!name) return 'TS';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Avatar Dropdown ────────────────────────────────────────────────────────
function toggleAvatarDropdown(e) {
  if (e) e.stopPropagation();
  const wrap = document.getElementById('avatarDropdownWrap');
  if (wrap) wrap.classList.toggle('open');
}

function closeAvatarDropdown() {
  const wrap = document.getElementById('avatarDropdownWrap');
  if (wrap) wrap.classList.remove('open');
}

function onMenuSelectProfile() {
  closeAvatarDropdown();
  switchTab('profile');
}

function onMenuSelectEarnings() {
  closeAvatarDropdown();
  switchTab('earnings');
}

function onMenuRefreshData() {
  closeAvatarDropdown();
  fetchAgentData();
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('avatarDropdownWrap');
  if (wrap && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
  }
});

// ── Rendering Functions ───────────────────────────────────────────────────
function renderAgent() {
  if (!currentAgent) return;

  // If agent is pending, show the waiting screen instead
  if (currentAgent.status === 'pending') {
    showPendingView(currentAgent);
    return;
  }

  // Restore nav visibility in case it was hidden during pending state
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = '';
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) sidebarNav.style.opacity = '';
  const sidebarAction = document.querySelector('.sidebar-action-wrap');
  if (sidebarAction) sidebarAction.style.display = '';
  const pending = document.getElementById('viewPending');
  if (pending) pending.style.display = 'none';

  // Header Avatar & Dropdown Details
  const avatarInitials = document.getElementById('headerAvatarInitials');
  if (avatarInitials) avatarInitials.textContent = getInitials(currentAgent.full_name);

  const menuName = document.getElementById('menuAgentName');
  if (menuName) menuName.textContent = currentAgent.full_name;

  const menuCode = document.getElementById('menuAgentCode');
  if (menuCode) menuCode.textContent = currentAgent.agent_code;

  const menuPhone = document.getElementById('menuAgentPhone');
  if (menuPhone) menuPhone.textContent = currentAgent.phone || currentAgent.mpesa_number || '';

  const headerName = document.getElementById('headerAgentName');
  if (headerName) {
    headerName.innerHTML = `${escapeHtml(currentAgent.full_name)} <span id="headerAgentCode" class="agent-badge-pill">${escapeHtml(currentAgent.agent_code)}</span>`;
  }

  // Financials
  const fin = currentAgent.financials || {};
  document.getElementById('dashBalanceDue').textContent = formatKsh(fin.balanceDueKsh);
  document.getElementById('dashTotalEarned').textContent = `KES ${formatKsh(fin.totalEarnedKsh)}`;
  document.getElementById('dashTotalPaid').textContent = `KES ${formatKsh(fin.totalPaidKsh)}`;

  // Dashboard status badge
  const dashStatusTag = document.getElementById('dashStatusTag');
  dashStatusTag.textContent = `${currentAgent.commission_rate}${currentAgent.commission_type === 'percentage' ? '%' : ' KES'} Commission`;

  // Desktop Sidebar sync
  const sidebarInitials = document.getElementById('sidebarAvatarInitials');
  if (sidebarInitials) sidebarInitials.textContent = getInitials(currentAgent.full_name);

  const sidebarName = document.getElementById('sidebarAgentName');
  if (sidebarName) sidebarName.textContent = currentAgent.full_name;

  const sidebarCode = document.getElementById('sidebarAgentCode');
  if (sidebarCode) sidebarCode.textContent = currentAgent.agent_code;

  const sidebarBal = document.getElementById('sidebarBalanceDue');
  if (sidebarBal) sidebarBal.textContent = `KES ${formatKsh(fin.balanceDueKsh)}`;

  const sidebarSchools = document.getElementById('sidebarSchoolsCount');
  if (sidebarSchools) sidebarSchools.textContent = (currentAgent.schools || []).length;

  // Render Schools
  renderSchoolsList();

  // Render Earnings Ledger
  renderEarningsList();

  // Render Profile
  renderProfile();
}

function renderSchoolsList() {
  const schools = currentAgent.schools || [];
  document.getElementById('dashSchoolsCount').textContent = schools.length;
  document.getElementById('schoolsTotalBadge').textContent = schools.length;
  const sidebarSchools = document.getElementById('sidebarSchoolsCount');
  if (sidebarSchools) sidebarSchools.textContent = schools.length;

  const dashContainer = document.getElementById('dashSchoolsList');
  const fullContainer = document.getElementById('fullSchoolsList');

  if (schools.length === 0) {
    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-icon">🏫</div>
        <div class="empty-title">No Schools Registered Yet</div>
        <div class="empty-desc">Tap '+ Register School' to add your first school lead.</div>
      </div>
    `;
    dashContainer.innerHTML = emptyHtml;
    fullContainer.innerHTML = emptyHtml;
    return;
  }

  const renderCard = (s) => `
    <div class="school-card">
      <div class="school-card-top">
        <div>
          <div class="school-name">${escapeHtml(s.school_name)}</div>
          ${s.contact_person ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">👤 ${escapeHtml(s.contact_person)}</div>` : ''}
        </div>
        <span class="status-badge ${s.status || 'pitching'}">${escapeHtml(s.status || 'pitching')}</span>
      </div>
      <div class="school-card-meta">
        <span>${escapeHtml(s.notes || s.created_at ? String(s.created_at).slice(0, 10) : 'Registered')}</span>
        ${s.contact_phone ? `<a href="tel:${escapeHtml(s.contact_phone)}" class="school-contact-link">📞 ${escapeHtml(s.contact_phone)}</a>` : ''}
      </div>
    </div>
  `;

  // Dashboard preview (first 3)
  dashContainer.innerHTML = schools.slice(0, 3).map(renderCard).join('');

  // Full tab list
  fullContainer.innerHTML = schools.map(renderCard).join('');
}

function renderEarningsList() {
  const earnings = currentAgent.earnings || [];
  const dashContainer = document.getElementById('dashRecentEarnings');
  const fullContainer = document.getElementById('fullEarningsList');

  if (earnings.length === 0) {
    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <div class="empty-title">No Commissions Earned Yet</div>
        <div class="empty-desc">Commissions are auto-credited when school subscription invoices are paid.</div>
      </div>
    `;
    dashContainer.innerHTML = emptyHtml;
    fullContainer.innerHTML = emptyHtml;
    return;
  }

  const renderItem = (e) => `
    <div class="ledger-item">
      <div class="ledger-info">
        <div class="ledger-title">${escapeHtml(e.school_name || 'School')}</div>
        <div class="ledger-sub">
          <span>${escapeHtml(e.invoice_ref || 'Inv')}</span>
          <span>·</span>
          <span>${escapeHtml(String(e.earned_date || e.created_at || '').slice(0, 10))}</span>
        </div>
      </div>
      <div class="ledger-amount">
        <div class="ledger-val">+KES ${formatKsh(e.earned_amount_ksh)}</div>
        <div class="ledger-status ${e.status}">${escapeHtml(e.status)}</div>
      </div>
    </div>
  `;

  // Dashboard preview (first 3)
  dashContainer.innerHTML = earnings.slice(0, 3).map(renderItem).join('');

  // Full tab list
  fullContainer.innerHTML = earnings.map(renderItem).join('');
}

function renderProfile() {
  if (!currentAgent) return;
  document.getElementById('profFullName').textContent = currentAgent.full_name;
  document.getElementById('profCode').textContent = `Code: ${currentAgent.agent_code}`;
  document.getElementById('profPhone').textContent = `Phone: ${currentAgent.phone}`;
  document.getElementById('profCounty').textContent = `County: ${currentAgent.county || 'Not specified'}`;
  document.getElementById('profTerms').textContent = `Commission Terms: ${currentAgent.commission_rate}${currentAgent.commission_type === 'percentage' ? '% per payment' : ' KES per school'}`;

  const mpesaInput = document.getElementById('profMpesa');
  if (mpesaInput) mpesaInput.value = currentAgent.mpesa_number || currentAgent.phone || '';

  // Render Payouts

// ── Marketplace Functions ───────────────────────────────────────────────────────
let marketCatalog = [
  { id: 1, title: 'Grade 8 Integrated Science Term 1 Exam + Rubrics', grade: 'Grade 8', term: 'Term 1', subject: 'Integrated Science', type: 'Exam & Marking Scheme', price: 150, description: 'Comprehensive exam paper and marking scheme.' },
  { id: 2, title: 'Grade 7 Pre-Technical Studies Term 1 Scheme of Work', grade: 'Grade 7', term: 'Term 1', subject: 'Pre-Technical Studies', type: 'Scheme of Work', price: 250, description: 'Detailed SOW for PT Studies.' },
  { id: 3, title: 'Grade 6 KPSEA Mathematics Revision Notes', grade: 'Grade 6', term: 'Full Year', subject: 'Mathematics', type: 'Revision Notes', price: 100, description: 'Key revision topics for KPSEA.' }
];
let creatorUploads = [];
let marketCurrentView = 'browse';
let marketActiveFilter = 'all';

function renderMarketplace() {
  // Ensure correct subview is shown based on current view
  switchMarketView(marketCurrentView);
  // Populate catalog for browse view
  renderMarketCatalog();
  // Populate creator uploads list
  renderCreatorUploads();
  // Update creator stats
  updateCreatorStats();
}

function switchMarketView(view) {
  marketCurrentView = view;
  const browse = document.getElementById('marketBrowseView');
  const creator = document.getElementById('marketCreatorView');
  const btnBrowse = document.getElementById('btnToggleBrowse');
  const btnCreator = document.getElementById('btnToggleCreator');
  if (browse && creator && btnBrowse && btnCreator) {
    if (view === 'browse') {
      browse.style.display = 'block';
      creator.style.display = 'none';
      btnBrowse.classList.add('active');
      btnCreator.classList.remove('active');
    } else {
      browse.style.display = 'none';
      creator.style.display = 'block';
      btnBrowse.classList.remove('active');
      btnCreator.classList.add('active');
    }
  }
}

function setMarketFilter(category, btn) {
  marketActiveFilter = category;
  // Toggle active chip UI
  document.querySelectorAll('.market-tag-chip').forEach(chip => chip.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterMarketCatalog();
}

function filterMarketCatalog() {
  const query = document.getElementById('marketSearchInput').value.trim().toLowerCase();
  const filtered = marketCatalog.filter(item => {
    const matchesCategory = marketActiveFilter === 'all' ||
      (marketActiveFilter === 'jss' && /Grade [7-9]/.test(item.grade)) ||
      (marketActiveFilter === 'primary' && /Grade [1-6]/.test(item.grade)) ||
      (marketActiveFilter === 'exams' && /Exam/.test(item.type)) ||
      (marketActiveFilter === 'sow' && /Scheme of Work/.test(item.type));
    const matchesQuery = !query ||
      item.title.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.grade.toLowerCase().includes(query) ||
      item.term.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });
  renderMarketCatalog(filtered);
}

function renderMarketCatalog(list = marketCatalog) {
  const container = document.getElementById('marketCatalogList');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-desc">No resources match your criteria.</div></div>`;
    return;
  }
  container.innerHTML = list.map(item => `
    <div class="resource-card">
      <h4 class="resource-title">${escapeHtml(item.title)}</h4>
      <div class="resource-meta">
        <span>${escapeHtml(item.grade)}</span> • <span>${escapeHtml(item.term)}</span> • <span>${escapeHtml(item.subject)}</span>
      </div>
      <div class="resource-type">${escapeHtml(item.type)}</div>
      <div class="resource-price">${item.price === 0 ? 'Free' : 'KES ' + formatKsh(item.price)}</div>
      <button class="chip-btn" onclick="openUploadResourceModal()">Add to My Listings</button>
    </div>`).join('');
}

function openUploadResourceModal() {
  document.getElementById('modalUploadResource').classList.add('active');
  // Reset form fields
  const form = document.getElementById('formUploadResource');
  if (form) form.reset();
  // Reset quick chip active state (optional)
}

function closeUploadResourceModal() {
  document.getElementById('modalUploadResource').classList.remove('active');
}

function setResPrice(val) {
  const priceInput = document.getElementById('resPrice');
  if (priceInput) priceInput.value = val;
}

function onFileSelected(input) {
  const file = input.files[0];
  const nameEl = document.getElementById('fileDropName');
  if (nameEl) nameEl.textContent = file ? file.name : 'Click to browse or drop file here';
}

function handleUploadResource(e) {
  e.preventDefault();
  const title = document.getElementById('resTitle').value.trim();
  const grade = document.getElementById('resGrade').value;
  const term = document.getElementById('resTerm').value;
  const subject = document.getElementById('resSubject').value;
  const type = document.getElementById('resType').value;
  const price = Number(document.getElementById('resPrice').value) || 0;
  const fileInput = document.getElementById('resFileInput');
  if (!title || !grade || !term || !subject || !type) {
    showToast('Please fill in all required fields.', true);
    return;
  }
  // Simulate upload by adding to creatorUploads list
  const newRes = { id: Date.now(), title, grade, term, subject, type, price, fileName: fileInput.files[0]?.name || '' };
  creatorUploads.unshift(newRes);
  closeUploadResourceModal();
  showToast('Resource uploaded to Marketplace');
  renderCreatorUploads();
  updateCreatorStats();
}

function renderCreatorUploads() {
  const container = document.getElementById('creatorUploadsList');
  if (!container) return;
  if (creatorUploads.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-desc">You have not uploaded any resources yet.</div></div>`;
    return;
  }
  container.innerHTML = creatorUploads.map(item => `
    <div class="resource-card">
      <h4 class="resource-title">${escapeHtml(item.title)}</h4>
      <div class="resource-meta">
        <span>${escapeHtml(item.grade)}</span> • <span>${escapeHtml(item.term)}</span> • <span>${escapeHtml(item.subject)}</span>
      </div>
      <div class="resource-type">${escapeHtml(item.type)}</div>
      <div class="resource-price">${item.price === 0 ? 'Free' : 'KES ' + formatKsh(item.price)}</div>
    </div>`).join('');
}

function updateCreatorStats() {
  const listingsCount = document.getElementById('creatorListingsCount');
  const earningsEl = document.getElementById('creatorEarnedDisplay');
  if (listingsCount) listingsCount.textContent = creatorUploads.length;
  // For demo, assume each upload yields a static royalty of 70% of price (if any)
  const totalEarned = creatorUploads.reduce((sum, r) => sum + (r.price * 0.7), 0);
  if (earningsEl) earningsEl.textContent = `KES ${formatKsh(totalEarned)}`;
}

// Ensure marketplace view resets when switching tabs
function onTabChange(tab) {
  if (tab !== 'marketplace') return;
  // Reset to browse view by default
  marketCurrentView = 'browse';
}

  const payouts = currentAgent.payouts || [];
  const payoutsContainer = document.getElementById('profPayoutsList');

  if (payouts.length === 0) {
    payoutsContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-desc">No disbursements recorded yet.</div>
      </div>
    `;
  } else {
    payoutsContainer.innerHTML = payouts.map(p => `
      <div class="ledger-item">
        <div class="ledger-info">
          <div class="ledger-title">Disbursed via ${escapeHtml(p.payout_method || 'mpesa').toUpperCase()}</div>
          <div class="ledger-sub">
            <span>Ref: ${escapeHtml(p.reference || '-')}</span>
            <span>·</span>
            <span>${escapeHtml(String(p.payout_date || p.created_at || '').slice(0, 10))}</span>
          </div>
        </div>
        <div class="ledger-amount">
          <div class="ledger-val" style="color: var(--text-main);">KES ${formatKsh(p.amount_ksh)}</div>
          <div class="ledger-status approved">${escapeHtml(p.status || 'completed')}</div>
        </div>
      </div>
    `).join('');
  }
}

// ── Register School ───────────────────────────────────────────────────────
function openRegisterSchoolModal() {
  document.getElementById('modalRegisterSchool').classList.add('active');
  const nameInput = document.getElementById('regSchoolName');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function closeRegisterSchoolModal() {
  document.getElementById('modalRegisterSchool').classList.remove('active');
  document.getElementById('formRegisterSchool').reset();
}

async function handleRegisterSchool(e) {
  e.preventDefault();
  const school_name = document.getElementById('regSchoolName').value.trim();
  const county = document.getElementById('regCounty').value.trim();
  const contact_person = document.getElementById('regContactPerson').value.trim();
  const contact_phone = document.getElementById('regContactPhone').value.trim();
  const estimated_students = parseInt(document.getElementById('regStudents').value, 10) || 0;
  const notes = document.getElementById('regNotes').value.trim();
  const btn = document.getElementById('btnSubmitSchool');

  if (!school_name) {
    showToast('Enter school name', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Saving...</span>';

  try {
    const data = await api('/api/agent/schools', {
      method: 'POST',
      body: JSON.stringify({
        school_name,
        county,
        contact_person,
        contact_phone,
        estimated_students,
        notes,
      }),
    });

    closeRegisterSchoolModal();
    showToast(`✓ Registered ${school_name} successfully!`);
    await fetchAgentData();
    switchTab('schools');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Save School & Add to Pipeline</span>';
  }
}

async function saveProfileMpesa() {
  const mpesa_number = document.getElementById('profMpesa').value.trim();
  try {
    const data = await api('/api/agent/profile', {
      method: 'PUT',
      body: JSON.stringify({ mpesa_number }),
    });
    currentAgent = data.agent;
    showToast('Payment phone updated successfully');
  } catch (err) {
    showToast(err.message, true);
  }
}

// ── Notifications ─────────────────────────────────────────────────────────
let cachedNotifications = [];

async function fetchNotifications() {
  try {
    const data = await api('/api/agent/notifications');
    cachedNotifications = data.notifications || [];
    const badge = document.getElementById('notifBadge');
    if (badge) {
      const count = Number(data.unreadCount || 0);
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    renderNotifications();
  } catch (err) {
    console.warn('Notifications fetch error:', err);
  }
}

function openNotificationsModal() {
  document.getElementById('modalNotifications').classList.add('active');
  const badge = document.getElementById('notifBadge');
  if (badge) badge.classList.add('hidden');
  fetchNotifications();
}

function closeNotificationsModal() {
  document.getElementById('modalNotifications').classList.remove('active');
}

function renderNotifications() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  if (cachedNotifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-desc">No new notifications.</div>
      </div>
    `;
    return;
  }

  const iconMap = {
    earning: '💰',
    payout: '📲',
    school: '🏫',
    system: '🔔',
  };

  container.innerHTML = cachedNotifications.map(n => `
    <div class="notif-item">
      <div class="notif-icon ${escapeHtml(n.type || 'system')}">
        ${iconMap[n.type] || '🔔'}
      </div>
      <div class="notif-content">
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-msg">${escapeHtml(n.message)}</div>
        <div class="notif-time">${escapeHtml(String(n.time || '').slice(0, 16).replace('T', ' '))}</div>
      </div>
    </div>
  `).join('');
}

// ── Transfer to M-Pesa ───────────────────────────────────────────────────
function openWithdrawModal() {
  if (!currentAgent) return;
  const avail = Number(currentAgent.financials?.balanceDueKsh || 0);
  document.getElementById('withdrawAvailBal').textContent = formatKsh(avail);
  document.getElementById('withdrawPhoneDisplay').textContent = currentAgent.mpesa_number || currentAgent.phone || 'None set';
  
  const amountInput = document.getElementById('withdrawAmount');
  amountInput.value = '';
  document.getElementById('withdrawPin').value = '';

  document.getElementById('modalWithdraw').classList.add('active');
  setTimeout(() => amountInput.focus(), 150);
}

function closeWithdrawModal() {
  document.getElementById('modalWithdraw').classList.remove('active');
}

function setWithdrawAmount(val) {
  const avail = Number(currentAgent?.financials?.balanceDueKsh || 0);
  const input = document.getElementById('withdrawAmount');
  input.value = Math.min(val, avail);
}

function setWithdrawMax() {
  const avail = Number(currentAgent?.financials?.balanceDueKsh || 0);
  const input = document.getElementById('withdrawAmount');
  input.value = avail;
}

async function handleWithdraw(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const pin = document.getElementById('withdrawPin').value.trim();
  const btn = document.getElementById('btnSubmitWithdraw');

  if (isNaN(amount) || amount < 500) {
    showToast('Minimum transfer amount is KES 500', true);
    return;
  }

  if (!pin) {
    showToast('Enter your 4-digit security PIN', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Processing Transfer...</span>';

  try {
    const data = await api('/api/agent/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, pin }),
    });

    closeWithdrawModal();
    showToast(data.message || `Transferred KES ${formatKsh(amount)} to M-Pesa!`);
    await fetchAgentData();
    await fetchNotifications();
  } catch (err) {
    showToast(err.message || 'Transfer failed', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Authorize &amp; Transfer to M-Pesa</span>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Startup ───────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const token = getStoredToken();
  if (!token) {
    showLoginView();
    return;
  }

  try {
    const data = await api('/api/agent/me');
    currentAgent = data.agent;
    showAppView();
    renderAgent();
    switchTab('dashboard');
    fetchNotifications();
  } catch {
    showLoginView();
  }
});
