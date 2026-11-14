(() => {
  const $ = id => document.getElementById(id);
  const table = $('applications-table');
  const overlay = $('application-review-overlay');
  const errorBox = $('applications-error');
  let currentApplication = null;
  let activeAgents = [];

  const packageNames = { starter: 'Starter', standard: 'Standard', professional: 'Professional' };
  const statusNames = {
    submitted: 'Submitted',
    under_review: 'Under review',
    approved: 'Approved',
    provisioning: 'Installing',
    ready: 'Ready',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  };
  const isPrimary = application => String(application.schoolType || '').endsWith('PRIMARY');

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'The application request failed.');
    return payload;
  }

  function setError(target, message) {
    target.textContent = message || '';
    target.hidden = !message;
  }

  function addText(parent, tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text || '—';
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function renderApplications(applications) {
    table.replaceChildren();
    if (!applications.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 8;
      cell.textContent = 'No school applications match this filter.';
      return;
    }
    for (const application of applications) {
      const row = table.insertRow();
      for (const value of [
        application.id,
        application.school,
        application.schoolType.replaceAll('_', ' '),
        packageNames[application.approvedPackageId || application.requestedPackageId] || (isPrimary(application) ? 'Needs review' : 'Deferred'),
        statusNames[application.applicationStatus] || application.applicationStatus,
        application.agentName || 'Unassigned',
        formatDate(application.applicationSubmittedAt),
      ]) {
        row.insertCell().textContent = value || '—';
      }
      const action = row.insertCell();
      const button = document.createElement('button');
      button.className = 'btn';
      button.type = 'button';
      button.textContent = 'Review';
      button.addEventListener('click', () => openApplication(application.id));
      action.append(button);
    }
  }

  async function loadApplications() {
    setError(errorBox, '');
    table.replaceChildren();
    const loading = table.insertRow().insertCell();
    loading.colSpan = 8;
    loading.textContent = 'Loading applications…';
    try {
      const status = $('application-status-filter').value;
      const payload = await request(`/api/applications${status ? `?status=${encodeURIComponent(status)}` : ''}`);
      renderApplications(payload.applications || []);
    } catch (error) {
      table.replaceChildren();
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 8;
      cell.textContent = 'Could not load applications.';
      setError(errorBox, error.message);
    }
  }

  async function loadAgents() {
    const payload = await request('/api/public/agents');
    activeAgents = payload.agents || [];
  }

  async function updatePackageIncludes() {
    const summary = $('application-package-includes');
    const packageId = $('application-review-package').value;
    if (!currentApplication || !isPrimary(currentApplication) || !packageId) {
      summary.textContent = isPrimary(currentApplication || {}) ? '' : 'Secondary applications do not have a package selection yet.';
      return;
    }
    const payload = await request(`/api/public/application-catalog?schoolType=${encodeURIComponent(currentApplication.schoolType)}`);
    const selected = (payload.packages || []).find(pack => pack.id === packageId);
    summary.textContent = selected
      ? `Included modules: ${selected.modules.map(module => module.name).join(', ')}`
      : 'Package details are unavailable.';
  }

  function populateAgents(selectedId) {
    const select = $('application-review-agent');
    select.replaceChildren(new Option('Unassigned', ''));
    for (const agent of activeAgents) {
      const label = [agent.name, agent.serviceArea || agent.county].filter(Boolean).join(' · ');
      select.add(new Option(label, agent.id));
    }
    select.value = activeAgents.some(agent => agent.id === selectedId) ? selectedId : '';
  }

  function renderDetails(application) {
    const details = $('application-review-details');
    details.replaceChildren();
    const entries = [
      ['School', application.school],
      ['School type', application.schoolType.replaceAll('_', ' ')],
      ['Education level', application.educationLevel],
      ['Accommodation', application.accommodationType.replaceAll('_', ' ')],
      ['Transport requested', application.transportNeeded ? 'Yes — review before enabling' : 'No'],
      ['Administrator', application.name],
      ['Email', application.applicationEmail],
      ['Phone', application.phone],
      ['Address', application.schoolAddress],
      ['County', application.county],
      ['Sub-county / ward', [application.subCounty, application.ward].filter(Boolean).join(' / ')],
      ['Requested package', packageNames[application.requestedPackageId] || 'None'],
      ['Status', statusNames[application.applicationStatus] || application.applicationStatus],
      ['Submitted', formatDate(application.applicationSubmittedAt)],
      ['Installation ready', formatDate(application.readyAt)],
      ['Provisioned school', application.provisionedSchoolId],
      ['Subscription starts', application.readyAt ? new Date(application.readyAt).toLocaleDateString() : 'Not started'],
      ['Activation email', application.activationEmailStatus || 'Not sent'],
      ['Review notes', application.reviewNotes],
    ];
    for (const [label, value] of entries) {
      const item = document.createElement('div');
      addText(item, 'dt', label);
      addText(item, 'dd', value || '—');
      details.append(item);
    }
  }

  function setReviewControls(application) {
    const reviewable = ['submitted', 'under_review'].includes(application.applicationStatus);
    const primary = isPrimary(application);
    const packageSelect = $('application-review-package');
    packageSelect.value = primary
      ? (application.approvedPackageId || application.requestedPackageId || '')
      : '';
    packageSelect.disabled = !reviewable || !primary;
    $('application-review-agent').disabled = !reviewable;
    $('application-review-notes').value = application.reviewNotes || '';
    $('application-review-notes').disabled = !reviewable;
    $('application-rejection-reason').value = '';
    $('application-rejection-reason').disabled = !reviewable;
    const transportRequested = Boolean(application.transportNeeded);
    $('application-transport-confirm-row').hidden = !transportRequested;
    $('application-transport-confirm').checked = (application.approvedModuleSlugs || []).includes('transport');
    $('application-transport-confirm').disabled = !reviewable || !transportRequested;
    $('application-save-review').hidden = !reviewable;
    $('application-approve').hidden = !reviewable;
    $('application-reject').hidden = !reviewable;
    $('application-provision').hidden = application.applicationStatus !== 'approved';
    $('application-retry-activation').hidden = !(application.applicationStatus === 'ready' && application.activationEmailStatus === 'failed');
  }

  function renderEvents(events) {
    const list = $('application-review-events');
    list.replaceChildren();
    if (!events?.length) {
      addText(list, 'li', 'No history recorded.');
      return;
    }
    for (const event of events) {
      const details = event.details && Object.keys(event.details).length
        ? ` — ${Object.entries(event.details).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ')}`
        : '';
      addText(list, 'li', `${formatDate(event.createdAt)} · ${event.eventType.replaceAll('_', ' ')}${event.actor ? ` by ${event.actor}` : ''}${details}`);
    }
  }

  async function openApplication(id) {
    setError($('application-review-error'), '');
    $('application-review-reference').textContent = id;
    $('application-review-details').replaceChildren();
    $('application-review-events').replaceChildren();
    overlay.style.display = 'flex';
    try {
      const [, payload] = await Promise.all([
        activeAgents.length ? Promise.resolve() : loadAgents(),
        request(`/api/applications/${encodeURIComponent(id)}`),
      ]);
      currentApplication = payload.application;
      renderDetails(currentApplication);
      renderEvents(payload.events);
      populateAgents(currentApplication.agentId || currentApplication.requestedAgentId);
      setReviewControls(currentApplication);
      await updatePackageIncludes();
    } catch (error) {
      setError($('application-review-error'), error.message);
    }
  }

  function closeModal() {
    overlay.style.display = 'none';
    currentApplication = null;
  }

  async function saveReview() {
    if (!currentApplication) return;
    const primary = isPrimary(currentApplication);
    if (primary && !$('application-review-package').value) {
      throw new Error('Choose a Primary package before saving this review.');
    }
    const moduleSlugs = $('application-transport-confirm').checked ? ['transport'] : [];
    const payload = await request(`/api/applications/${encodeURIComponent(currentApplication.id)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: primary ? $('application-review-package').value : '',
        agentId: $('application-review-agent').value,
        moduleSlugs,
        reviewNotes: $('application-review-notes').value.trim(),
      }),
    });
    currentApplication = payload.application;
    return payload.application;
  }

  async function runAction(action) {
    if (!currentApplication) return;
    const error = $('application-review-error');
    setError(error, '');
    const buttons = [...document.querySelectorAll('.application-review-actions button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (action === 'save' || action === 'approve') {
        await saveReview();
        if (action === 'approve') {
          const result = await request(`/api/applications/${encodeURIComponent(currentApplication.id)}/approve`, { method: 'POST' });
          currentApplication = result.application;
        }
      } else if (action === 'reject') {
        const reason = $('application-rejection-reason').value.trim();
        if (!reason) throw new Error('Enter a reason before rejecting this application.');
        const result = await request(`/api/applications/${encodeURIComponent(currentApplication.id)}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        currentApplication = result.application;
      } else if (action === 'provision') {
        const result = await request(`/api/applications/${encodeURIComponent(currentApplication.id)}/provision`, { method: 'POST' });
        currentApplication = result.application;
      } else if (action === 'retry-activation') {
        const result = await request(`/api/applications/${encodeURIComponent(currentApplication.id)}/retry-activation`, { method: 'POST' });
        currentApplication = result.application;
      }
      if (action === 'save') {
        await openApplication(currentApplication.id);
      } else {
        closeModal();
      }
      await loadApplications();
    } catch (requestError) {
      setError(error, requestError.message);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  $('refresh-applications').addEventListener('click', loadApplications);
  $('application-status-filter').addEventListener('change', loadApplications);
  $('application-review-close').addEventListener('click', closeModal);
  $('application-review-package').addEventListener('change', () => {
    updatePackageIncludes().catch(error => setError($('application-review-error'), error.message));
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
  $('application-save-review').addEventListener('click', () => runAction('save'));
  $('application-approve').addEventListener('click', () => runAction('approve'));
  $('application-reject').addEventListener('click', () => runAction('reject'));
  $('application-provision').addEventListener('click', () => runAction('provision'));
  $('application-retry-activation').addEventListener('click', () => runAction('retry-activation'));
  $('copy-application-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply`);
      $('copy-application-link').textContent = 'Link copied';
      window.setTimeout(() => { $('copy-application-link').textContent = 'Copy application link'; }, 1800);
    } catch {
      setError(errorBox, 'Could not copy the application link. Use this URL: ' + `${window.location.origin}/apply`);
    }
  });
  document.querySelector('.nav-item[data-section="applications"]')?.addEventListener('click', loadApplications);
})();
