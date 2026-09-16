document.addEventListener('DOMContentLoaded', function () {
    if (typeof TCWC_MPESA_ADMIN === 'undefined') return;

    var btn = document.getElementById('tcwc-mpesa-recheck');
    if (!btn) return;

    btn.addEventListener('click', function () {
        var resultEl = document.getElementById('tcwc-mpesa-recheck-result');
        var orderId = btn.getAttribute('data-order-id');

        btn.disabled = true;
        btn.textContent = 'Checking…';
        if (resultEl) resultEl.textContent = '';

        var body = new URLSearchParams({
            action: 'tcwc_mpesa_recheck_order',
            nonce: TCWC_MPESA_ADMIN.nonce,
            order_id: orderId
        });

        fetch(TCWC_MPESA_ADMIN.ajax, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (r) {
                btn.disabled = false;
                btn.textContent = 'Recheck payment status';
                if (resultEl) {
                    var msg = (r.data && (r.data.detail || r.data.status)) || (r.success ? 'Updated.' : 'Check failed.');
                    resultEl.textContent = msg;
                    resultEl.style.color = r.success ? '#0a7c4a' : '#a02222';
                }
                // A status change is easiest to see by just reloading the panel.
                if (r.success && r.data && r.data.status === 'success') {
                    setTimeout(function () { window.location.reload(); }, 900);
                }
            })
            .catch(function () {
                btn.disabled = false;
                btn.textContent = 'Recheck payment status';
                if (resultEl) { resultEl.textContent = 'Network error.'; resultEl.style.color = '#a02222'; }
            });
    });
});
