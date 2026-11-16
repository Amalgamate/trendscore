(() => {
  const $ = id => document.getElementById(id);
  const table = $('applications-table');
  const overlay = $('application-review-overlay');
  const errorBox = $('applications-error');
  let currentApplication = null;
  let activeAgents = [];
  let provisionPollTimeout = null;
  let provisionClockInterval = null;
  let provisionStartedAt = null;
  let currentProvisionProgress = null;
  let allApplications = [];

  const packageNames = { starter: 'Starter', standard: 'Standard', professional: 'Professional' };
  const statusNames = {
    submitted: 'Submitted',
    under_review: 'Under review',
    approved: 'Approved',
    provisioning: 'Installing',
    ready: 'Installed',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  };
  const isPrimary = application => String(application.schoolType || '').endsWith('PRIMARY');

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      const error = new Error(payload.error || 'The application request failed.');
      error.code = payload.code || '';
      error.domain = payload.domain || '';
      error.requiredAddress = payload.requiredAddress || '';
      error.details = payload.details || '';
      throw error;
    }
    return payload;
  }

  function setError(target, message) {
    target.replaceChildren();
    target.textContent = message || '';
    target.hidden = !message;
  }

  function appendTechnicalDetails(parent, label, text) {
    if (!text) return;
    const details = document.createElement('details');
    details.className = 'application-technical-details';
    const summary = document.createElement('summary');
    summary.textContent = label;
    const pre = document.createElement('pre');
    pre.textContent = text;
    details.append(summary, pre);
    parent.append(details);
  }

  function compactInstallerMessage(message) {
    const text = String(message || '');
    const portCollision = /port is already allocated|address already in use|failed to bind/i.test(text);
    const summary = portCollision
      ? 'Installation stopped because a server port was already in use.'
      : 'Installation did not complete. Open technical details to review the installer output.';
    const technicalDetails = text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !/^Command failed:/i.test(line) && !/"applicationId"\s*:/.test(line))
      .slice(-12)
      .join('\n')
      .slice(-1600);
    return { summary, technicalDetails };
  }

  function renderActionError(target, error) {
    target.replaceChildren();
    const summary = document.createElement('div');
    summary.className = 'application-error-summary';
    summary.textContent = error.message || 'The application request failed.';
    target.append(summary);
    appendTechnicalDetails(target, 'Technical details', error.details);
    target.hidden = false;
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function provisionStageIndex(percent) {
    if (percent < 25) return 0;
    if (percent < 47) return 1;
    if (percent < 77) return 2;
    if (percent < 90) return 3;
    return 4;
  }

  function renderProvisionProgress(progress = {}) {
    const panel = $('application-provision-status');
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    const status = progress.status || 'running';
    const startedAt = progress.startedAt || provisionStartedAt;
    const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)) : 0;
    const stageIndex = provisionStageIndex(percent);

    panel.hidden = false;
    panel.dataset.status = status;
    $('application-provision-step').textContent = progress.step || 'Preparing the school workspace';
    $('application-provision-message').textContent = progress.message || 'Preparing the school services.';
    $('application-provision-percent').textContent = `${percent}%`;
    $('application-provision-fill').style.width = `${percent}%`;
    $('application-provision-bar').setAttribute('aria-valuenow', String(percent));
    $('application-provision-spinner').hidden = status !== 'running';
    $('application-provision-elapsed').textContent = `Elapsed ${formatDuration(elapsed)}`;

    const eta = $('application-provision-eta');
    if (status === 'complete') {
      eta.textContent = 'Setup complete';
    } else if (status === 'failed') {
      eta.textContent = 'Review the note below';
    } else if (elapsed > 240) {
      eta.textContent = 'Taking longer than usual';
    } else {
      const remaining = Math.max(0, Math.ceil((240 * (1 - percent / 100)) - elapsed));
      eta.textContent = remaining < 60
        ? 'Estimated: under 1 min left'
        : `Estimated: about ${Math.ceil(remaining / 60)} min left`;
    }

    document.querySelectorAll('#application-provision-steps [data-progress-step]').forEach((step, index) => {
      step.classList.toggle('is-complete', status === 'complete' || index < stageIndex);
      step.classList.toggle('is-current', status === 'running' && index === stageIndex);
      step.classList.toggle('is-failed', status === 'failed' && index === stageIndex);
    });
  }

  function stopProvisionProgressWatch() {
    if (provisionPollTimeout) window.clearTimeout(provisionPollTimeout);
    if (provisionClockInterval) window.clearInterval(provisionClockInterval);
    provisionPollTimeout = null;
    provisionClockInterval = null;
  }

  function watchProvisionProgress(applicationId) {
    stopProvisionProgressWatch();
    const poll = async () => {
      try {
        const payload = await request(`/api/applications/${encodeURIComponent(applicationId)}/provision-progress`);
        if (payload.progress) {
          currentProvisionProgress = payload.progress;
          renderProvisionProgress(currentProvisionProgress);
          if (['complete', 'failed'].includes(currentProvisionProgress.status)) {
            stopProvisionProgressWatch();
            const applicationPayload = await request(`/api/applications/${encodeURIComponent(applicationId)}`);
            currentApplication = applicationPayload.application;
            renderEvents(applicationPayload.events);
            setReviewControls(currentApplication);
            document.querySelectorAll('.application-review-actions button').forEach(button => { button.disabled = false; });
            await loadApplications();
          }
        }
      } catch {
        // The installation request still reports its final result if polling is interrupted.
      }
      if (!currentProvisionProgress || !['complete', 'failed'].includes(currentProvisionProgress.status)) {
        provisionPollTimeout = window.setTimeout(poll, 1200);
      }
    };
    provisionPollTimeout = window.setTimeout(poll, 350);
    provisionClockInterval = window.setInterval(() => {
      renderProvisionProgress(currentProvisionProgress || {
        status: 'running', percent: 6, step: 'Checking the school address',
        message: 'Confirming the school subdomain is ready before installation starts.',
        startedAt: provisionStartedAt,
      });
    }, 1000);
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
      const canInstall = application.applicationStatus === 'approved';
      if (canInstall) button.classList.add('application-install-now');
      button.textContent = canInstall ? 'Install Now' : 'Review';
      button.setAttribute('aria-label', `${canInstall ? 'Install' : 'Review'} ${application.school || 'school application'}`);
      button.addEventListener('click', () => openApplication(application.id));
      action.append(button);
    }
  }

  function renderFilteredApplications() {
    const query = $('application-search').value.trim().toLocaleLowerCase();
    const filtered = query
      ? allApplications.filter(application => [
        application.id,
        application.school,
        application.schoolType,
        application.agentName,
        application.applicationEmail,
      ].some(value => String(value || '').toLocaleLowerCase().includes(query)))
      : allApplications;
    renderApplications(filtered);
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
      allApplications = payload.applications || [];
      renderFilteredApplications();
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
    $('application-provision').textContent = 'Start installation';
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
      const item = document.createElement('li');
      addText(item, 'div', `${formatDate(event.createdAt)} · ${event.eventType.replaceAll('_', ' ')}${event.actor ? ` by ${event.actor}` : ''}`, 'application-event-heading');
      const values = event.details || {};
      const legacyMessage = String(values.message || '');
      const compacted = legacyMessage.length > 240 ? compactInstallerMessage(legacyMessage) : null;
      if (legacyMessage) {
        addText(item, 'div', compacted?.summary || legacyMessage, 'application-event-message');
      }
      const otherValues = Object.entries(values)
        .filter(([key]) => !['message', 'technicalDetails'].includes(key))
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
      if (otherValues.length) addText(item, 'div', otherValues.join('; '), 'application-event-meta');
      appendTechnicalDetails(item, 'Technical details', values.technicalDetails || compacted?.technicalDetails);
      list.append(item);
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
      if (currentApplication.applicationStatus === 'provisioning') {
        document.querySelectorAll('.application-review-actions button').forEach(button => { button.disabled = true; });
        watchProvisionProgress(currentApplication.id);
      } else {
        stopProvisionProgressWatch();
      }
      await updatePackageIncludes();
    } catch (error) {
      setError($('application-review-error'), error.message);
    }
  }

  function closeModal() {
    stopProvisionProgressWatch();
    overlay.style.display = 'none';
    $('application-provision-status').hidden = true;
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
    let installationStillRunning = false;
    const provisionStatus = $('application-provision-status');
    if (action === 'provision') {
      provisionStartedAt = new Date().toISOString();
      currentProvisionProgress = null;
      renderProvisionProgress({
        status: 'running', percent: 6, step: 'Checking the school address',
        message: 'Confirming the school subdomain is ready before installation starts.',
        startedAt: provisionStartedAt,
      });
      watchProvisionProgress(currentApplication.id);
      $('application-provision').textContent = 'Installing…';
    }
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
      renderActionError(error, requestError);
      if (action === 'provision' && requestError.code === 'DNS_NOT_READY') {
        $('application-provision').textContent = 'Check DNS and try again';
        provisionStatus.hidden = true;
      } else if (action === 'provision') {
        $('application-provision').textContent = 'Retry installation';
        if (currentProvisionProgress?.status === 'running') {
          installationStillRunning = true;
          renderActionError(error, {
            message: 'The server is still installing this school, but the response took too long. Progress will continue here; please wait before retrying.',
          });
          $('application-provision').textContent = 'Installation still running…';
        } else if (currentProvisionProgress?.status !== 'failed') {
          currentProvisionProgress = {
            ...(currentProvisionProgress || {}),
            status: 'failed', step: 'Installation needs attention', message: requestError.message,
          };
          renderProvisionProgress(currentProvisionProgress);
        }
      }
    } finally {
      if (action === 'provision' && !installationStillRunning) stopProvisionProgressWatch();
      buttons.forEach(button => { button.disabled = false; });
      if (installationStillRunning) buttons.forEach(button => { button.disabled = true; });
    }
  }

  $('refresh-applications').addEventListener('click', loadApplications);
  $('application-status-filter').addEventListener('change', loadApplications);
  $('application-search').addEventListener('input', renderFilteredApplications);
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
      $('copy-application-link-label').textContent = 'Link copied';
      window.setTimeout(() => { $('copy-application-link-label').textContent = 'Copy application link'; }, 1800);
    } catch {
      setError(errorBox, 'Could not copy the application link. Use this URL: ' + `${window.location.origin}/apply`);
    }
  });
  document.querySelector('.nav-item[data-section="applications"]')?.addEventListener('click', loadApplications);
})();
