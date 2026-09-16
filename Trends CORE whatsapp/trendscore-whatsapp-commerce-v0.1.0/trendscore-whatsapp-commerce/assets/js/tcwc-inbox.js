(function () {
    if (typeof TCWC_INBOX === 'undefined') return;

    var listEl = document.getElementById('tcwc-inbox-list');
    var threadEl = document.getElementById('tcwc-inbox-thread');
    if (!listEl || !threadEl) return;

    var activeId = null;
    var threadTimer = null;

    function postAjax(action, extra) {
        var body = new URLSearchParams(Object.assign({ action: action, nonce: TCWC_INBOX.nonce }, extra || {}));
        return fetch(TCWC_INBOX.ajax, { method: 'POST', body: body }).then(function (r) { return r.json(); });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // Server timestamps are site-local (current_time('mysql')); Date() here
    // parses them as local time too since no timezone suffix is appended —
    // good enough for a relative "Xm ago" label, not used for anything exact.
    function timeAgo(mysqlDate) {
        if (!mysqlDate) return '';
        var then = new Date(mysqlDate.replace(' ', 'T'));
        var diff = Math.floor((Date.now() - then.getTime()) / 1000);
        if (diff < 5) return 'just now';
        if (diff < 60) return diff + 's ago';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function renderList(conversations) {
        if (!conversations.length) {
            listEl.innerHTML = '<p class="tcwc-inbox-empty">No conversations yet — they\'ll show up here as soon as a customer messages you.</p>';
            return;
        }

        listEl.innerHTML = conversations.map(function (c) {
            var claimTag = c.claimed_by
                ? '<span class="tcwc-inbox-claim-tag' + (c.is_mine ? ' tcwc-inbox-claim-mine' : '') + '">' + escapeHtml(c.claimed_by_name) + '</span>'
                : '<span class="tcwc-inbox-claim-tag tcwc-inbox-unclaimed">Unclaimed</span>';
            var unread = c.unread ? '<span class="tcwc-inbox-unread">' + c.unread + '</span>' : '';
            var dirMark = c.direction === 'out' ? '<span class="tcwc-inbox-dir-out">You: </span>' : '';

            return '<div class="tcwc-inbox-list-item' + (c.id === activeId ? ' active' : '') + '" data-id="' + c.id + '">' +
                '<div class="tcwc-inbox-list-top"><strong>' + escapeHtml(c.name) + '</strong>' + unread + '</div>' +
                '<div class="tcwc-inbox-list-preview">' + dirMark + escapeHtml(c.preview) + '</div>' +
                '<div class="tcwc-inbox-list-bottom">' + claimTag + '<span class="tcwc-inbox-time">' + timeAgo(c.last_message_at) + '</span></div>' +
                '</div>';
        }).join('');

        Array.prototype.forEach.call(listEl.querySelectorAll('.tcwc-inbox-list-item'), function (el) {
            el.addEventListener('click', function () {
                openThread(parseInt(el.getAttribute('data-id'), 10));
            });
        });
    }

    function refreshList() {
        postAjax('tcwc_inbox_list').then(function (r) {
            if (r.success) renderList(r.data.conversations);
        });
    }

    function senderLabel(m) {
        if (m.direction !== 'out') return '';
        if (m.sender_type === 'ai') return 'AI · ';
        if (m.sender_type === 'automation' || m.sender_type === 'system') return 'Automated · ';
        return '';
    }

    function renderThread(data, preserveDraft) {
        var conv = data.conversation;
        var draft = preserveDraft ? (document.getElementById('tcwc-inbox-input') || {}).value : '';

        var claimHtml = conv.claimed_by
            ? (String(TCWC_INBOX.currentUser) === String(conv.claimed_by)
                ? escapeHtml(conv.claimed_by_name) + ' (you) &middot; <button type="button" class="button-link" id="tcwc-inbox-unclaim">release</button>'
                : 'Claimed by ' + escapeHtml(conv.claimed_by_name))
            : '<button type="button" class="button button-small" id="tcwc-inbox-claim">Claim</button>';

        var bubbles = data.messages.map(function (m) {
            var cls = m.direction === 'out' ? 'tcwc-bubble-out' : 'tcwc-bubble-in';
            var tick = m.direction === 'out' && m.status === 'read' ? ' ✓✓' : (m.direction === 'out' && m.status === 'delivered' ? ' ✓✓' : (m.direction === 'out' && m.status === 'sent' ? ' ✓' : ''));
            return '<div class="tcwc-bubble ' + cls + '"><div class="tcwc-bubble-meta">' + senderLabel(m) + timeAgo(m.created_at) + tick + '</div>' + escapeHtml(m.body) + '</div>';
        }).join('');

        var inputHtml = data.within_window
            ? '<textarea id="tcwc-inbox-input" placeholder="Type a reply…" rows="2"></textarea><button type="button" class="button button-primary" id="tcwc-inbox-send">Send</button>'
            : '<p class="tcwc-inbox-window-closed">It\u2019s been over 24 hours since ' + escapeHtml(conv.name) + ' last messaged \u2014 only a pre-approved template can be sent now, not a free-form reply.</p>';

        threadEl.innerHTML =
            '<div class="tcwc-inbox-thread-header"><div><strong>' + escapeHtml(conv.name) + '</strong> <span class="tcwc-inbox-phone">' + escapeHtml(conv.phone) + '</span></div>' +
            '<span class="tcwc-inbox-claim-area">' + claimHtml + '</span></div>' +
            '<div class="tcwc-inbox-messages" id="tcwc-inbox-messages">' + bubbles + '</div>' +
            '<div class="tcwc-inbox-composer">' + inputHtml + '</div>';

        var msgsEl = document.getElementById('tcwc-inbox-messages');
        if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

        var input = document.getElementById('tcwc-inbox-input');
        if (input && draft) input.value = draft;

        var sendBtn = document.getElementById('tcwc-inbox-send');
        if (sendBtn) {
            var send = function () {
                var box = document.getElementById('tcwc-inbox-input');
                var text = box.value.trim();
                if (!text) return;
                sendBtn.disabled = true;
                postAjax('tcwc_inbox_send', { conversation_id: activeId, message: text }).then(function (r) {
                    sendBtn.disabled = false;
                    if (!r.success) {
                        alert((r.data && r.data.message) || 'Could not send that message.');
                        return;
                    }
                    postAjax('tcwc_inbox_thread', { conversation_id: activeId }).then(function (r2) {
                        if (r2.success) renderThread(r2.data, false);
                    });
                    refreshList();
                });
            };
            sendBtn.addEventListener('click', send);
            document.getElementById('tcwc-inbox-input').addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                }
            });
        }

        var claimBtn = document.getElementById('tcwc-inbox-claim');
        if (claimBtn) claimBtn.addEventListener('click', function () {
            postAjax('tcwc_inbox_claim', { conversation_id: activeId }).then(function () {
                postAjax('tcwc_inbox_thread', { conversation_id: activeId }).then(function (r) {
                    if (r.success) renderThread(r.data, true);
                });
                refreshList();
            });
        });

        var unclaimBtn = document.getElementById('tcwc-inbox-unclaim');
        if (unclaimBtn) unclaimBtn.addEventListener('click', function () {
            postAjax('tcwc_inbox_unclaim', { conversation_id: activeId }).then(function () {
                postAjax('tcwc_inbox_thread', { conversation_id: activeId }).then(function (r) {
                    if (r.success) renderThread(r.data, true);
                });
                refreshList();
            });
        });
    }

    function openThread(id) {
        activeId = id;
        clearInterval(threadTimer);

        postAjax('tcwc_inbox_thread', { conversation_id: id }).then(function (r) {
            if (!r.success) {
                threadEl.innerHTML = '<p class="tcwc-inbox-empty">' + escapeHtml((r.data && r.data.message) || 'Could not load this conversation.') + '</p>';
                return;
            }
            renderThread(r.data, false);
            refreshList();
        });

        threadTimer = setInterval(function () {
            postAjax('tcwc_inbox_thread', { conversation_id: id }).then(function (r) {
                if (r.success) renderThread(r.data, true);
            });
        }, 5000);
    }

    refreshList();
    setInterval(refreshList, 6000);
})();
