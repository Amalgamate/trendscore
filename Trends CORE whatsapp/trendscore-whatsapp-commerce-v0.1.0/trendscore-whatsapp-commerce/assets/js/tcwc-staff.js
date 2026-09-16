document.addEventListener('DOMContentLoaded', function () {
    if (typeof TCWC_STAFF === 'undefined') return;

    function post(action, extra, onDone) {
        var body = new URLSearchParams(Object.assign({ action: action, nonce: TCWC_STAFF.nonce }, extra || {}));
        fetch(TCWC_STAFF.ajax, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(onDone)
            .catch(function () { onDone({ success: false, data: { message: 'Network error. Please try again.' } }); });
    }

    function row(orderId) {
        return document.querySelector('#tcwc-orders-table tr[data-order-id="' + orderId + '"]');
    }

    function withBusy(btn, fn) {
        var original = btn.textContent;
        btn.disabled = true;
        btn.textContent = '\u2026';
        fn(function () {
            btn.disabled = false;
            btn.textContent = original;
        });
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;

        // Claim
        if (btn.classList.contains('tcwc-claim')) {
            var orderId = btn.getAttribute('data-order-id');
            withBusy(btn, function (reset) {
                post('tcwc_order_claim', { order_id: orderId }, function (r) {
                    if (r.success) {
                        var cell = row(orderId).querySelector('.tcwc-claimed-cell');
                        cell.innerHTML = r.data.claimed_by + ' <button type="button" class="button-link tcwc-unclaim" data-order-id="' + orderId + '">(release)</button>';
                    } else {
                        alert((r.data && r.data.message) || 'Could not claim this order.');
                        reset();
                    }
                });
            });
            return;
        }

        // Release / unclaim
        if (btn.classList.contains('tcwc-unclaim')) {
            var uOrderId = btn.getAttribute('data-order-id');
            post('tcwc_order_unclaim', { order_id: uOrderId }, function (r) {
                if (r.success) {
                    var cell = row(uOrderId).querySelector('.tcwc-claimed-cell');
                    cell.innerHTML = '<button type="button" class="button button-small tcwc-claim" data-order-id="' + uOrderId + '">Claim</button>';
                }
            });
            return;
        }

        // Mark complete
        if (btn.classList.contains('tcwc-mark-complete')) {
            if (!confirm('Mark this order as Completed?')) return;
            var cOrderId = btn.getAttribute('data-order-id');
            withBusy(btn, function (reset) {
                post('tcwc_order_complete', { order_id: cOrderId }, function (r) {
                    if (r.success) {
                        window.location.reload();
                    } else {
                        alert((r.data && r.data.message) || 'Could not update this order.');
                        reset();
                    }
                });
            });
            return;
        }

        // Recheck M-Pesa payment (reuses the same endpoint as the order-screen panel)
        if (btn.classList.contains('tcwc-recheck-mpesa')) {
            var mOrderId = btn.getAttribute('data-order-id');
            withBusy(btn, function (reset) {
                post('tcwc_mpesa_recheck_order', { order_id: mOrderId }, function (r) {
                    reset();
                    if (r.success) {
                        window.location.reload();
                    } else {
                        alert((r.data && r.data.message) || 'Could not check payment status.');
                    }
                });
            });
            return;
        }

        // Resolve a hand-off (AI assistant queue)
        if (btn.classList.contains('tcwc-resolve-handoff')) {
            var phone = btn.getAttribute('data-phone');
            withBusy(btn, function () {
                post('tcwc_resolve_handoff', { phone: phone }, function (r) {
                    if (r.success) {
                        window.location.reload();
                    }
                });
            });
            return;
        }
    });
});
