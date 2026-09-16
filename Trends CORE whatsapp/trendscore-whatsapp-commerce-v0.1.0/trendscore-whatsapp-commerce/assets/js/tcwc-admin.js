document.addEventListener('DOMContentLoaded', function () {
    /* ---------------- Live message preview (Messaging tab) ---------------- */

    var phoneInput = document.getElementById('tcwc_phone');
    var introInput = document.getElementById('tcwc_intro');
    var currencyInput = document.getElementById('tcwc_currency');

    var bubble = document.getElementById('tcwc-preview-bubble');
    var phoneStatus = document.getElementById('tcwc-preview-number');

    function sampleMessage() {
        var intro = (introInput && introInput.value.trim()) || 'Hello! I would like to order:';
        var currency = (currencyInput && currencyInput.value) || 'KES ';
        var lines = [
            intro,
            '',
            'Cotton Rope Woven Storage Basket (Natural, Medium) x1 - ' + currency + '2,400',
            '',
            'Order: #10482',
            'Total: ' + currency + '2,400',
            'Name: Jane Wanjiru',
            'Phone: 0712 345 678'
        ];
        return lines.join('\n');
    }

    function renderPreview() {
        if (bubble) bubble.textContent = sampleMessage();
        if (phoneStatus) {
            var digits = (phoneInput && phoneInput.value || '').replace(/\D+/g, '');
            phoneStatus.textContent = digits ? ('wa.me/' + digits) : 'No number set yet';
        }
    }

    [phoneInput, introInput, currencyInput].forEach(function (el) {
        if (el) el.addEventListener('input', renderPreview);
    });

    renderPreview();

    /* ---------------- Cloud API tab: regenerate token / send test ---------------- */

    if (typeof TCWC_ADMIN === 'undefined') return;

    function postAjax(action, extra, onDone) {
        var body = new URLSearchParams(Object.assign({ action: action, nonce: TCWC_ADMIN.nonce }, extra || {}));
        fetch(TCWC_ADMIN.ajax, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (r) { onDone(r); })
            .catch(function () { onDone({ success: false, data: { message: 'Network error. Please try again.' } }); });
    }

    var regenBtn = document.getElementById('tcwc-regenerate-token');
    var tokenField = document.getElementById('tcwc-verify-token-field');
    if (regenBtn) {
        regenBtn.addEventListener('click', function () {
            regenBtn.disabled = true;
            regenBtn.textContent = 'Regenerating…';
            postAjax('tcwc_generate_verify_token', {}, function (r) {
                regenBtn.disabled = false;
                regenBtn.textContent = 'Regenerate';
                if (r.success && tokenField) {
                    tokenField.value = r.data.verify_token;
                    tokenField.select();
                }
            });
        });
    }

    var checkBtn = document.getElementById('tcwc-check-connection');
    var checkResult = document.getElementById('tcwc-connection-result');
    if (checkBtn) {
        checkBtn.addEventListener('click', function () {
            checkBtn.disabled = true;
            checkBtn.textContent = 'Checking…';
            if (checkResult) { checkResult.textContent = ''; }
            postAjax('tcwc_check_connection', {}, function (r) {
                checkBtn.disabled = false;
                checkBtn.textContent = 'Check connection';
                if (checkResult) {
                    checkResult.textContent = (r.data && r.data.message) || (r.success ? 'Connected.' : 'Connection check failed.');
                    checkResult.style.color = r.success ? '#128C7E' : '#E14A4A';
                }
            });
        });
    }

    var testBtn = document.getElementById('tcwc-test-send');
    var testNumber = document.getElementById('tcwc-test-number');
    var testResult = document.getElementById('tcwc-test-result');
    if (testBtn) {
        testBtn.addEventListener('click', function () {
            var to = (testNumber && testNumber.value || '').trim();
            if (!to) {
                if (testResult) { testResult.textContent = 'Enter a WhatsApp number first.'; testResult.style.color = '#E14A4A'; }
                return;
            }
            testBtn.disabled = true;
            testBtn.textContent = 'Sending…';
            if (testResult) { testResult.textContent = ''; }
            postAjax('tcwc_test_cloud_api', { to: to }, function (r) {
                testBtn.disabled = false;
                testBtn.textContent = 'Send test';
                if (testResult) {
                    testResult.textContent = (r.data && r.data.message) || (r.success ? 'Sent.' : 'Something went wrong.');
                    testResult.style.color = r.success ? '#128C7E' : '#E14A4A';
                }
            });
        });
    }

    /* ---------------- Catalogue tab: sync + templates ---------------- */

    var syncBtn = document.getElementById('tcwc-catalog-sync-now');
    var syncResult = document.getElementById('tcwc-catalog-sync-result');
    if (syncBtn) {
        syncBtn.addEventListener('click', function () {
            syncBtn.disabled = true;
            syncBtn.textContent = 'Syncing…';
            if (syncResult) { syncResult.textContent = ''; }
            postAjax('tcwc_catalog_sync_all', {}, function (r) {
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sync all products now';
                if (syncResult) {
                    syncResult.textContent = (r.data && r.data.message) || (r.success ? 'Synced.' : 'Sync failed.');
                    syncResult.style.color = r.success ? '#128C7E' : '#E14A4A';
                }
            });
        });
    }

    var templateListEl = document.getElementById('tcwc-template-list');
    var templateRefreshBtn = document.getElementById('tcwc-template-refresh');

    function renderTemplates(templates) {
        if (!templateListEl) return;
        if (!templates || !templates.length) {
            templateListEl.innerHTML = '<p class="tcwc-hint">No templates yet — submit one below.</p>';
            return;
        }
        var rows = templates.map(function (t) {
            return '<tr><td>' + t.name + '</td><td>' + (t.category || '') + '</td><td>' + (t.language || '') + '</td><td>' + (t.status || '') + '</td></tr>';
        }).join('');
        templateListEl.innerHTML = '<table class="widefat striped"><thead><tr><th>Name</th><th>Category</th><th>Language</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function loadTemplates() {
        if (!templateListEl) return;
        templateListEl.innerHTML = '<p class="tcwc-hint">Loading…</p>';
        postAjax('tcwc_catalog_list_templates', {}, function (r) {
            if (r.success) {
                renderTemplates(r.data.templates);
            } else {
                templateListEl.innerHTML = '<p class="tcwc-hint" style="color:#E14A4A;">' + ((r.data && r.data.message) || 'Could not load templates.') + '</p>';
            }
        });
    }

    if (templateRefreshBtn) {
        templateRefreshBtn.addEventListener('click', loadTemplates);
    }

    var templateSubmitBtn = document.getElementById('tcwc-template-submit');
    var templateResult = document.getElementById('tcwc-template-result');
    if (templateSubmitBtn) {
        templateSubmitBtn.addEventListener('click', function () {
            var name = (document.getElementById('tcwc_template_name') || {}).value || '';
            var category = (document.getElementById('tcwc_template_category') || {}).value || 'UTILITY';
            var language = (document.getElementById('tcwc_template_language') || {}).value || 'en_US';
            var bodyText = (document.getElementById('tcwc_template_body') || {}).value || '';

            if (!name.trim() || !bodyText.trim()) {
                if (templateResult) { templateResult.textContent = 'Name and body text are required.'; templateResult.style.color = '#E14A4A'; }
                return;
            }

            templateSubmitBtn.disabled = true;
            templateSubmitBtn.textContent = 'Submitting…';
            if (templateResult) { templateResult.textContent = ''; }

            postAjax('tcwc_catalog_create_template', { name: name, category: category, language: language, body_text: bodyText }, function (r) {
                templateSubmitBtn.disabled = false;
                templateSubmitBtn.textContent = 'Submit template for review';
                if (templateResult) {
                    templateResult.textContent = (r.data && r.data.message) || (r.success ? 'Submitted.' : 'Submission failed.');
                    templateResult.style.color = r.success ? '#128C7E' : '#E14A4A';
                }
                if (r.success) loadTemplates();
            });
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    /* ---------------- AI Assistant tab: test tool ---------------- */

    if (typeof TCWC_ADMIN === 'undefined') return;

    function postAjaxAI(action, extra, onDone) {
        var body = new URLSearchParams(Object.assign({ action: action, nonce: TCWC_ADMIN.nonce }, extra || {}));
        fetch(TCWC_ADMIN.ajax, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (r) { onDone(r); })
            .catch(function () { onDone({ success: false, data: { message: 'Network error. Please try again.' } }); });
    }

    var aiTestBtn = document.getElementById('tcwc-ai-test-run');
    var aiTestInput = document.getElementById('tcwc-ai-test-input');
    var aiTestResult = document.getElementById('tcwc-ai-test-result');

    if (aiTestBtn) {
        aiTestBtn.addEventListener('click', function () {
            var text = (aiTestInput && aiTestInput.value || '').trim();
            if (!text) {
                if (aiTestResult) aiTestResult.innerHTML = '<p class="tcwc-hint" style="color:#E14A4A;">Enter a sample message first.</p>';
                return;
            }

            aiTestBtn.disabled = true;
            aiTestBtn.textContent = 'Running…';
            if (aiTestResult) aiTestResult.innerHTML = '<p class="tcwc-hint">Running…</p>';

            postAjaxAI('tcwc_ai_test', { text: text }, function (r) {
                aiTestBtn.disabled = false;
                aiTestBtn.textContent = 'Run test';

                if (!aiTestResult) return;

                if (!r.success) {
                    aiTestResult.innerHTML = '<p class="tcwc-hint" style="color:#E14A4A;">' + ((r.data && r.data.message) || 'Test failed.') + '</p>';
                    return;
                }

                var intent = r.data.intent || {};
                var rows = '<tr><td>Intent</td><td>' + (intent.intent || '') + '</td></tr>' +
                    '<tr><td>Reply</td><td>' + (intent.reply || '') + '</td></tr>' +
                    '<tr><td>Keywords</td><td>' + (intent.keywords || '—') + '</td></tr>' +
                    '<tr><td>Category</td><td>' + (intent.category || '—') + '</td></tr>' +
                    '<tr><td>Min price</td><td>' + (intent.min_price != null ? intent.min_price : '—') + '</td></tr>' +
                    '<tr><td>Max price</td><td>' + (intent.max_price != null ? intent.max_price : '—') + '</td></tr>';

                var html = '<table class="widefat striped"><tbody>' + rows + '</tbody></table>';

                if (r.data.matched_products) {
                    html += '<p class="tcwc-hint" style="margin-top:10px;"><strong>Matched products (' + r.data.matched_products.length + '):</strong></p>';
                    if (r.data.matched_products.length) {
                        html += '<ul style="margin:0 0 0 18px;">' + r.data.matched_products.map(function (p) {
                            return '<li>' + p + '</li>';
                        }).join('') + '</ul>';
                    } else {
                        html += '<p class="tcwc-hint">No products matched — this would trigger the "no results" reply.</p>';
                    }
                }

                aiTestResult.innerHTML = html;
            });
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    /* ---------------- Staff tab: add / remove ---------------- */

    if (typeof TCWC_ADMIN === 'undefined') return;

    function postAjaxStaff(action, extra, onDone) {
        var body = new URLSearchParams(Object.assign({ action: action, nonce: TCWC_ADMIN.nonce }, extra || {}));
        fetch(TCWC_ADMIN.ajax, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (r) { onDone(r); })
            .catch(function () { onDone({ success: false, data: { message: 'Network error. Please try again.' } }); });
    }

    var staffAddBtn = document.getElementById('tcwc-staff-add');
    var staffNameInput = document.getElementById('tcwc-staff-name');
    var staffEmailInput = document.getElementById('tcwc-staff-email');
    var staffAddResult = document.getElementById('tcwc-staff-add-result');
    var staffTableBody = document.querySelector('#tcwc-staff-table tbody');

    if (staffAddBtn) {
        staffAddBtn.addEventListener('click', function () {
            var name = (staffNameInput && staffNameInput.value || '').trim();
            var email = (staffEmailInput && staffEmailInput.value || '').trim();

            if (!email) {
                if (staffAddResult) { staffAddResult.textContent = 'Enter an email address first.'; staffAddResult.style.color = '#E14A4A'; }
                return;
            }

            staffAddBtn.disabled = true;
            staffAddBtn.textContent = 'Adding…';
            if (staffAddResult) { staffAddResult.textContent = ''; }

            postAjaxStaff('tcwc_staff_add', { name: name, email: email }, function (r) {
                staffAddBtn.disabled = false;
                staffAddBtn.textContent = 'Add staff';

                if (!r.success) {
                    if (staffAddResult) { staffAddResult.textContent = (r.data && r.data.message) || 'Could not add that staff member.'; staffAddResult.style.color = '#E14A4A'; }
                    return;
                }

                if (staffAddResult) { staffAddResult.textContent = r.data.message || 'Staff member added.'; staffAddResult.style.color = '#128C7E'; }
                if (staffNameInput) staffNameInput.value = '';
                if (staffEmailInput) staffEmailInput.value = '';

                if (staffTableBody) {
                    var emptyCell = staffTableBody.querySelector('td[colspan]');
                    if (emptyCell) staffTableBody.innerHTML = '';

                    var tr = document.createElement('tr');
                    tr.setAttribute('data-user-id', r.data.user_id);

                    var nameCell = document.createElement('td');
                    nameCell.textContent = r.data.name;
                    var emailCell = document.createElement('td');
                    emailCell.textContent = r.data.email;
                    var actionCell = document.createElement('td');
                    actionCell.innerHTML = '<button type="button" class="button-link tcwc-staff-remove" data-user-id="' + r.data.user_id + '" style="color:var(--tcwc-red);">Remove</button>';

                    tr.appendChild(nameCell);
                    tr.appendChild(emailCell);
                    tr.appendChild(actionCell);
                    staffTableBody.appendChild(tr);
                }
            });
        });
    }

    document.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('.tcwc-staff-remove');
        if (!removeBtn) return;

        if (!confirm('Remove this person from WhatsApp Staff? Their WordPress account is not deleted.')) return;

        var userId = removeBtn.getAttribute('data-user-id');
        removeBtn.disabled = true;

        postAjaxStaff('tcwc_staff_remove', { user_id: userId }, function (r) {
            if (!r.success) {
                removeBtn.disabled = false;
                alert((r.data && r.data.message) || 'Could not remove this staff member.');
                return;
            }

            var tr = staffTableBody && staffTableBody.querySelector('tr[data-user-id="' + userId + '"]');
            if (tr) tr.remove();

            if (staffTableBody && !staffTableBody.querySelector('tr')) {
                staffTableBody.innerHTML = '<tr><td colspan="3">No staff added yet.</td></tr>';
            }
        });
    });
});
