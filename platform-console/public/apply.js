(function () {
  'use strict';

  const form = document.getElementById('application-form');
  const ownership = document.getElementById('ownership');
  const educationLevel = document.getElementById('education-level');
  const packageFieldset = document.getElementById('package-fieldset');
  const packageList = document.getElementById('package-list');
  const agentSelect = document.getElementById('agent');
  const submitButton = document.getElementById('submit-application');
  const errorBox = document.getElementById('form-error');
  let selectedPackage = '';

  const fieldValue = id => document.getElementById(id).value.trim();
  const schoolType = () => `${ownership.value}_${educationLevel.value}`;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function updateSummary() {
    document.getElementById('summary-school').textContent = fieldValue('school') || 'Not entered';
    document.getElementById('summary-type').textContent = ownership.value && educationLevel.value
      ? `${ownership.options[ownership.selectedIndex].text} ${educationLevel.options[educationLevel.selectedIndex].text}`
      : 'Not selected';
    const accommodation = document.getElementById('accommodation');
    document.getElementById('summary-accommodation').textContent = accommodation.value
      ? accommodation.options[accommodation.selectedIndex].text
      : 'Not selected';
    const transport = document.getElementById('transport');
    document.getElementById('summary-transport').textContent = transport.value
      ? transport.options[transport.selectedIndex].text
      : 'Not selected';
    const packageInput = packageList.querySelector('input:checked');
    document.getElementById('summary-package').textContent = packageInput?.dataset.name
      || (educationLevel.value === 'SECONDARY' ? 'Our team will recommend a package' : 'Not selected');
    const agent = agentSelect.options[agentSelect.selectedIndex];
    document.getElementById('summary-agent').textContent = agentSelect.value ? agent.textContent : 'Unassigned';
  }

  async function loadAgents() {
    const response = await fetch('/api/public/agents', { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok || !Array.isArray(payload.agents)) {
      throw new Error(payload.error || 'Could not load the current agent list.');
    }
    for (const agent of payload.agents) {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = [agent.name, agent.serviceArea || agent.county].filter(Boolean).join(' · ');
      agentSelect.append(option);
    }
  }

  function renderPackages(packages) {
    packageList.replaceChildren();
    selectedPackage = '';
    for (const pack of packages) {
      const label = document.createElement('label');
      label.className = 'package-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'packageId';
      radio.value = pack.id;
      radio.dataset.name = pack.name;
      radio.required = true;
      radio.addEventListener('change', () => {
        selectedPackage = pack.id;
        updateSummary();
      });

      const content = document.createElement('span');
      const title = document.createElement('span');
      title.className = 'package-title';
      title.textContent = pack.name;
      const description = document.createElement('p');
      description.className = 'package-description';
      description.textContent = pack.description;
      const modules = document.createElement('ul');
      modules.className = 'module-list';
      for (const module of pack.modules) {
        const item = document.createElement('li');
        item.textContent = module.name;
        modules.append(item);
      }
      content.append(title, description, modules);
      label.append(radio, content);
      packageList.append(label);
    }
    packageFieldset.hidden = packages.length === 0;
  }

  async function updatePackages() {
    if (!ownership.value || !educationLevel.value) {
      renderPackages([]);
      updateSummary();
      return;
    }
    const response = await fetch(`/api/public/application-catalog?schoolType=${encodeURIComponent(schoolType())}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok || !Array.isArray(payload.packages)) {
      throw new Error(payload.error || 'Could not load Primary package details.');
    }
    renderPackages(payload.packages);
    updateSummary();
  }

  for (const input of form.querySelectorAll('input, select')) {
    input.addEventListener('input', updateSummary);
    input.addEventListener('change', updateSummary);
  }

  ownership.addEventListener('change', () => {
    updatePackages().catch(error => showError(error.message));
  });
  educationLevel.addEventListener('change', () => {
    updatePackages().catch(error => showError(error.message));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    showError('');
    if (!form.reportValidity()) return;
    if (educationLevel.value === 'PRIMARY' && !selectedPackage) {
      showError('Choose a Primary package before submitting.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    const body = {
      name: fieldValue('contact-name'),
      email: fieldValue('contact-email'),
      phone: fieldValue('contact-phone'),
      school: fieldValue('school'),
      schoolType: schoolType(),
      accommodationType: fieldValue('accommodation'),
      transportNeeded: document.getElementById('transport').value === 'true',
      address: fieldValue('address'),
      county: fieldValue('county'),
      subCounty: fieldValue('sub-county'),
      ward: fieldValue('ward'),
      agentId: fieldValue('agent'),
      packageId: selectedPackage,
    };

    try {
      const response = await fetch('/api/public/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Your application could not be submitted.');
      form.hidden = true;
      document.querySelector('.page-intro').hidden = true;
      document.querySelector('.summary-panel').hidden = true;
      const successPanel = document.getElementById('success-panel');
      document.getElementById('application-reference').textContent = payload.reference;
      document.getElementById('success-message').textContent = payload.possibleDuplicate
        ? 'Your application is with our team for review. We noticed a similar school or contact record, so the team will check it before proceeding.'
        : payload.message;
      successPanel.hidden = false;
    } catch (error) {
      showError(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit application';
    }
  });

  Promise.all([loadAgents(), updatePackages()])
    .catch(error => showError(error.message));
  updateSummary();
}());
