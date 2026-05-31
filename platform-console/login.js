// ── Trends CORE Control Panel — Login UI Logic ────────────────────────────
// Handles: session check on load, login form, logout confirmation modal,
//          session countdown timer, role-based UI locking.

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours (matches server JWT)
  const EXPIRY_WARN_MS      = 30 * 60 * 1000;      // warn when < 30 min remain

  // ── State ────────────────────────────────────────────────────────────────
  let currentUser     = null;
  let sessionStart    = null;   // Date when we logged in / restored session
  let selectedRole    = 'super_admin';
  let sessionTimerRAF = null;   // requestAnimationFrame handle

  // ── Element refs ─────────────────────────────────────────────────────────
  const overlay    = document.getElementById('login-overlay');
  const shell      = document.getElementById('app-shell');
  const emailInput = document.getElementById('lg-email');
  const passInput  = document.getElementById('lg-password');
  const passToggle = document.getElementById('lg-password-toggle');
  const submitBtn  = document.getElementById('lg-submit');
  const errorBox   = document.getElementById('lg-error');
  const userChip   = document.getElementById('user-chip');
  const chipLabel  = document.getElementById('user-chip-label');
  const chipRole   = document.getElementById('user-chip-role');
  const chipAvatar = document.getElementById('user-chip-avatar');
  const logoutBtn  = document.getElementById('btn-logout');
  const roleBtns   = document.querySelectorAll('.lg-role-btn');

  // Session timer pill
  const timerPill  = document.getElementById('session-timer-pill');
  const timerLabel = document.getElementById('session-timer-label');

  // Logout modal
  const logoutOverlay   = document.getElementById('logout-overlay');
  const logoutCancelBtn = document.getElementById('logout-cancel-btn');
  const logoutConfirmBtn= document.getElementById('logout-confirm-btn');
  const logoutUserDisplay  = document.getElementById('logout-user-display');
  const logoutRoleDisplay  = document.getElementById('logout-role-display');
  const logoutTimerDisplay = document.getElementById('logout-timer-display');

  // ── Helpers ──────────────────────────────────────────────────────────────
  function showError(msg, type = 'error') {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
    errorBox.classList.toggle('session-expired', type === 'session');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('show', 'session-expired');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Signing in…' : 'Sign in to control panel';
  }

  function initialsForUser(user) {
    const source = String(user?.name || user?.email || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }

  function roleLabel(role) {
    return role === 'super_admin' ? 'Super Admin' : 'Platform Owner';
  }

  function formatDuration(ms) {
    if (ms <= 0) return 'Expired';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m remaining`;
  }

  if (passToggle && passInput) {
    passToggle.addEventListener('click', () => {
      const isVisible = passInput.type === 'text';
      passInput.type = isVisible ? 'password' : 'text';
      passToggle.classList.toggle('is-visible', !isVisible);
      passToggle.setAttribute('aria-pressed', String(!isVisible));
      passToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
      passInput.focus();
    });
  }

  // ── Session countdown timer ──────────────────────────────────────────────
  function startSessionTimer() {
    if (!timerPill || !timerLabel) return;
    timerPill.hidden = false;

    function tick() {
      const elapsed = Date.now() - sessionStart;
      const remaining = SESSION_DURATION_MS - elapsed;

      timerLabel.textContent = formatDuration(remaining);
      timerPill.classList.toggle('is-warning', remaining < EXPIRY_WARN_MS);

      // Update logout modal timer display if it's open
      if (logoutTimerDisplay) {
        logoutTimerDisplay.textContent = formatDuration(remaining);
      }

      if (remaining <= 0) {
        stopSessionTimer();
        // Server will return 401 on the next API call; the fetch interceptor
        // handles the re-lock. We just show the pill as expired.
        timerLabel.textContent = 'Expired';
        return;
      }

      sessionTimerRAF = requestAnimationFrame(tick);
    }

    sessionTimerRAF = requestAnimationFrame(tick);
  }

  function stopSessionTimer() {
    if (sessionTimerRAF) cancelAnimationFrame(sessionTimerRAF);
    sessionTimerRAF = null;
    if (timerPill) timerPill.hidden = true;
  }

  // ── Show / hide overlay ──────────────────────────────────────────────────
  function lockConsole(reason) {
    overlay.classList.remove('hidden');
    shell.classList.add('auth-locked');
    userChip.classList.remove('visible');

    // Hide Sign Out button
    if (logoutBtn) {
      logoutBtn.classList.remove('visible');
    }

    stopSessionTimer();
    currentUser  = null;
    sessionStart = null;

    // Restore all nav items on lock (clean slate for next login)
    document.querySelectorAll('.nav-item').forEach(el => {
      el.style.display = '';
      el.style.opacity = '';
      el.style.pointerEvents = '';
    });

    if (reason === 'expired') {
      showError('Your session has expired. Please sign in again.', 'session');
    }
  }

  function unlockConsole(user, access) {
    currentUser  = user;
    sessionStart = Date.now();

    overlay.classList.add('hidden');
    shell.classList.remove('auth-locked');

    const roleText = roleLabel(user.role);
    if (chipLabel) chipLabel.textContent = user.name || user.email || roleText;
    if (chipRole) chipRole.textContent = roleText;
    if (chipAvatar) chipAvatar.textContent = initialsForUser(user);
    userChip.classList.add('visible');

    // Show Sign Out button with the .visible class
    if (logoutBtn) {
      logoutBtn.classList.add('visible');
    }

    startSessionTimer();
    applyRoleRestrictions(user.role, access);
  }

  // ── Role-based UI restrictions ───────────────────────────────────────────
  function applyRoleRestrictions(role, access) {
    const allSections = ['overview', 'instances', 'storage', 'deployments', 'controls', 'pricing', 'logs'];

    allSections.forEach(section => {
      const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
      const panel   = document.getElementById(`section-${section}`);
      const allowed = !access || access.includes(section);

      if (navItem) {
        if (!allowed) {
          navItem.style.display = 'none';
        } else {
          navItem.style.display = '';
          navItem.style.opacity = '';
          navItem.style.pointerEvents = '';
        }
      }

      if (panel) {
        if (!allowed) {
          panel.classList.add('access-locked');
        } else {
          panel.classList.remove('access-locked');
        }
      }
    });

    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.style.display === 'none') {
      if (typeof showSection === 'function') showSection('overview');
    }
  }

  // ── Role toggle buttons ──────────────────────────────────────────────────
  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
      clearError();
    });
  });

  // ── Login submit ─────────────────────────────────────────────────────────
  async function attemptLogin() {
    clearError();
    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      showError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res  = await _origFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Login failed. Please try again.');
        return;
      }

      if (data.user.role !== selectedRole) {
        showError(
          `This account is a ${data.user.role === 'super_admin' ? 'Super Admin' : 'Platform Owner'}, ` +
          `not a ${selectedRole === 'super_admin' ? 'Super Admin' : 'Platform Owner'}.`
        );
        return;
      }

      unlockConsole(data.user, data.access);

    } catch (err) {
      showError('Network error — is the Trends CORE server running?');
    } finally {
      setLoading(false);
    }
  }

  submitBtn.addEventListener('click', attemptLogin);

  [emailInput, passInput].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') attemptLogin();
    });
  });

  // ── Logout confirmation modal ────────────────────────────────────────────
  function openLogoutModal() {
    if (!logoutOverlay || !currentUser) return;

    // Populate session summary
    if (logoutUserDisplay) logoutUserDisplay.textContent = currentUser.email || '—';
    if (logoutRoleDisplay) {
      logoutRoleDisplay.textContent = currentUser.role === 'super_admin' ? 'Super Admin' : 'Platform Owner';
    }
    if (logoutTimerDisplay && sessionStart) {
      const remaining = SESSION_DURATION_MS - (Date.now() - sessionStart);
      logoutTimerDisplay.textContent = formatDuration(remaining);
    }

    logoutOverlay.classList.add('open');
    // Focus the cancel button so Escape / Enter are handled cleanly
    if (logoutCancelBtn) setTimeout(() => logoutCancelBtn.focus(), 50);
  }

  function closeLogoutModal() {
    if (logoutOverlay) logoutOverlay.classList.remove('open');
  }

  async function executeLogout() {
    closeLogoutModal();
    try {
      await _origFetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {
      // If the server is unreachable we still clear the local session
    }
    emailInput.value = '';
    passInput.value  = '';
    clearError();
    lockConsole();
  }

  // Sign Out button → open modal
  if (logoutBtn) {
    logoutBtn.addEventListener('click', openLogoutModal);
  }

  // Modal cancel
  if (logoutCancelBtn) {
    logoutCancelBtn.addEventListener('click', closeLogoutModal);
  }

  // Modal confirm → actually log out
  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener('click', executeLogout);
  }

  // Click outside modal to cancel
  if (logoutOverlay) {
    logoutOverlay.addEventListener('click', e => {
      if (e.target === logoutOverlay) closeLogoutModal();
    });
  }

  // Escape key closes the modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && logoutOverlay?.classList.contains('open')) {
      closeLogoutModal();
    }
  });

  // ── Global 401 interceptor ────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _origFetch(...args);
    if (response.status === 401 && currentUser !== null) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (!url.includes('/api/login')) {
        closeLogoutModal(); // close modal if open
        emailInput.value = '';
        passInput.value  = '';
        lockConsole('expired');
      }
    }
    return response;
  };

  // ── Session check on page load ───────────────────────────────────────────
  async function checkSession() {
    try {
      const res = await _origFetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        unlockConsole(data.user, data.access);
        return;
      }
    } catch (_) {}
    lockConsole();
  }

  checkSession();

})();
