jQuery(function ($) {
    'use strict';

    /* ----------------------------------------------------------------
       Modal shell — injected once, reused for both product & cart flows
       ---------------------------------------------------------------- */

    var $overlay = null;
    var pollTimer = null;
    var pollAttempts = 0;
    var MAX_POLL_ATTEMPTS = 20; // ~60s at 3s intervals — Daraja STK prompts commonly time out around then anyway
    var POLL_INTERVAL_MS = 3000;

    function ensureModal() {
        if ($overlay && $overlay.length) return $overlay;

        var html =
            '<div class="tcwc-overlay" id="tcwc-overlay" aria-hidden="true">' +
                '<div class="tcwc-modal" role="dialog" aria-modal="true" aria-labelledby="tcwc-modal-title">' +
                    '<div class="tcwc-modal-header">' +
                        '<button type="button" class="tcwc-modal-close" aria-label="Close">&times;</button>' +
                        '<h3 id="tcwc-modal-title">WhatsApp Checkout</h3>' +
                        '<p>Share your details and we\'ll create your order, then open WhatsApp so you can confirm it with us.</p>' +
                    '</div>' +
                    '<div class="tcwc-modal-body">' +
                        '<div class="tcwc-form-state">' +
                            '<div class="tcwc-field">' +
                                '<label for="tcwc-name">Your name</label>' +
                                '<input id="tcwc-name" type="text" autocomplete="name" placeholder="e.g. Jane Wanjiru">' +
                                '<div class="tcwc-field-error">Please enter your name.</div>' +
                            '</div>' +
                            '<div class="tcwc-field">' +
                                '<label for="tcwc-phone">Phone number</label>' +
                                '<input id="tcwc-phone" type="tel" autocomplete="tel" placeholder="e.g. 0712 345 678">' +
                                '<div class="tcwc-field-error">Please enter a valid phone number.</div>' +
                            '</div>' +
                            '<div class="tcwc-field">' +
                                '<label for="tcwc-email">Email <span style="text-transform:none;font-weight:400;">(optional)</span></label>' +
                                '<input id="tcwc-email" type="email" autocomplete="email" placeholder="you@example.com">' +
                            '</div>' +
                            '<div class="tcwc-field">' +
                                '<label for="tcwc-address">Delivery address / area</label>' +
                                '<textarea id="tcwc-address" placeholder="Estate, town, landmark…"></textarea>' +
                            '</div>' +
                            '<div class="tcwc-field tcwc-payment-choice" id="tcwc-payment-choice" style="display:none;">' +
                                '<label>How would you like to pay?</label>' +
                                '<div class="tcwc-payment-options">' +
                                    '<label class="tcwc-radio-option">' +
                                        '<input type="radio" name="tcwc-payment-method" value="whatsapp" checked> Confirm on WhatsApp' +
                                    '</label>' +
                                    '<label class="tcwc-radio-option">' +
                                        '<input type="radio" name="tcwc-payment-method" value="mpesa"> Pay with M-Pesa now' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="tcwc-note" id="tcwc-modal-note"></div>' +
                            '<button type="button" class="tcwc-modal-submit" id="tcwc-submit-checkout">' +
                                '<span class="tcwc-spinner"></span>' +
                                '<span class="tcwc-submit-label">Create Order &amp; Open WhatsApp</span>' +
                            '</button>' +
                            '<p class="tcwc-modal-footnote">Your order is saved in our shop first, so nothing is lost if WhatsApp doesn\'t open immediately.</p>' +
                        '</div>' +
                        '<div class="tcwc-success" id="tcwc-success-state">' +
                            '<div class="tcwc-success-check"></div>' +
                            '<h4>Order created!</h4>' +
                            '<p id="tcwc-success-copy">Opening WhatsApp so you can confirm your order…</p>' +
                        '</div>' +
                        '<div class="tcwc-mpesa-wait" id="tcwc-mpesa-wait-state">' +
                            '<div class="tcwc-spinner tcwc-spinner-lg"></div>' +
                            '<h4 id="tcwc-mpesa-wait-title">Check your phone</h4>' +
                            '<p id="tcwc-mpesa-wait-copy">Enter your M-Pesa PIN on the prompt sent to your phone…</p>' +
                            '<div id="tcwc-mpesa-wait-actions" style="display:none;">' +
                                '<button type="button" class="button" id="tcwc-mpesa-retry">Try again</button> ' +
                                '<button type="button" class="button" id="tcwc-mpesa-fallback">Continue via WhatsApp instead</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        $('body').append(html);
        $overlay = $('#tcwc-overlay');

        $overlay.on('click', function (e) {
            if (e.target === this) closeModal();
        });
        $overlay.find('.tcwc-modal-close').on('click', closeModal);
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && $overlay.hasClass('tcwc-open')) closeModal();
        });

        return $overlay;
    }

    function openModal() {
        var $m = ensureModal();
        $m.find('.tcwc-form-state').show();
        $m.find('#tcwc-success-state').removeClass('tcwc-show');
        $m.find('#tcwc-mpesa-wait-state').removeClass('tcwc-show');
        $m.find('#tcwc-modal-note').empty();
        $m.find('.tcwc-field').removeClass('tcwc-invalid');
        $m.find('#tcwc-submit-checkout').removeClass('tcwc-loading').prop('disabled', false);
        $m.find('input[name="tcwc-payment-method"][value="whatsapp"]').prop('checked', true);
        if (typeof TCWC !== 'undefined' && TCWC.mpesaEnabled) {
            $m.find('#tcwc-payment-choice').show();
        }
        $('body').addClass('tcwc-modal-locked');
        $m.attr('aria-hidden', 'false');
        requestAnimationFrame(function () { $m.addClass('tcwc-open'); });
    }

    function closeModal() {
        if (!$overlay) return;
        $overlay.removeClass('tcwc-open').attr('aria-hidden', 'true');
        $('body').removeClass('tcwc-modal-locked');
    }

    function showNote(message) {
        var $m = ensureModal();
        $m.find('#tcwc-modal-note').html(
            '<div class="tcwc-note-error">' + escapeHtml(message) + '</div>'
        );
    }

    function escapeHtml(str) {
        return $('<div>').text(str || '').html();
    }

    function markInvalid($field, invalid) {
        $field.toggleClass('tcwc-invalid', !!invalid);
    }

    function validateForm($m) {
        var ok = true;
        var name = $.trim($m.find('#tcwc-name').val());
        var phone = $.trim($m.find('#tcwc-phone').val());

        var $nameField = $m.find('#tcwc-name').closest('.tcwc-field');
        var $phoneField = $m.find('#tcwc-phone').closest('.tcwc-field');

        markInvalid($nameField, !name);
        if (!name) ok = false;

        var phoneDigits = phone.replace(/\D+/g, '');
        markInvalid($phoneField, phoneDigits.length < 9);
        if (phoneDigits.length < 9) ok = false;

        return ok;
    }

    function submitCheckout(onSuccess) {
        var $m = ensureModal();
        if (!validateForm($m)) {
            showNote('Please check the highlighted fields.');
            return;
        }

        var data = {
            name: $.trim($m.find('#tcwc-name').val()),
            phone: $.trim($m.find('#tcwc-phone').val()),
            email: $.trim($m.find('#tcwc-email').val()),
            address: $.trim($m.find('#tcwc-address').val())
        };

        var $btn = $m.find('#tcwc-submit-checkout');
        $btn.addClass('tcwc-loading').prop('disabled', true);
        $m.find('#tcwc-modal-note').empty();

        $.post(TCWC.ajax, {
            action: 'tcwc_create_order',
            nonce: TCWC.nonce,
            name: data.name,
            phone: data.phone,
            email: data.email,
            address: data.address
        }).done(function (r) {
            if (r.success) {
                var paymentMethod = $m.find('input[name="tcwc-payment-method"]:checked').val();

                if (paymentMethod === 'mpesa' && typeof TCWC !== 'undefined' && TCWC.mpesaEnabled) {
                    runMpesaFlow(r.data, data.phone);
                } else {
                    $m.find('.tcwc-form-state').hide();
                    $m.find('#tcwc-success-state').addClass('tcwc-show');
                    $m.find('#tcwc-success-copy').text(
                        'Order #' + r.data.order_number + ' created. Opening WhatsApp now…'
                    );
                    setTimeout(function () {
                        window.open(r.data.whatsapp_url, '_blank', 'noopener');
                        setTimeout(closeModal, 600);
                    }, 700);
                }
                if (typeof onSuccess === 'function') onSuccess(r.data);
            } else {
                showNote((r.data && r.data.message) || 'Could not create your order. Please try again.');
            }
        }).fail(function () {
            showNote('Could not create your order. Please check your connection and try again.');
        }).always(function () {
            $btn.removeClass('tcwc-loading').prop('disabled', false);
        });
    }

    function stopPolling() {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    }

    /**
     * After the order is created, if the customer chose M-Pesa this fires the
     * STK Push and polls order status until Safaricom's callback lands (or the
     * customer bails out to the WhatsApp fallback). Payment happens without
     * ever leaving this modal.
     */
    function runMpesaFlow(orderData, phone) {
        var $m = ensureModal();
        $m.find('.tcwc-form-state').hide();
        $m.find('#tcwc-mpesa-wait-state').addClass('tcwc-show');
        $m.find('#tcwc-mpesa-wait-title').text('Check your phone');
        $m.find('#tcwc-mpesa-wait-copy').text('Sending the M-Pesa prompt\u2026');
        $m.find('#tcwc-mpesa-wait-actions').hide();

        $.post(TCWC.ajax, {
            action: 'tcwc_mpesa_stkpush',
            nonce: TCWC.nonce,
            order_id: orderData.order_id,
            phone: phone
        }).done(function (r) {
            if (!r.success) {
                showMpesaFailure((r.data && r.data.message) || 'Could not start the M-Pesa payment.', orderData, phone);
                return;
            }
            $m.find('#tcwc-mpesa-wait-copy').text(r.data.message || 'Enter your M-Pesa PIN on the prompt sent to your phone\u2026');
            pollAttempts = 0;
            pollMpesaStatus(orderData, phone);
        }).fail(function () {
            showMpesaFailure('Could not reach the payment service. Please try again.', orderData, phone);
        });
    }

    function pollMpesaStatus(orderData, phone) {
        var $m = ensureModal();
        pollAttempts++;

        $.post(TCWC.ajax, {
            action: 'tcwc_mpesa_status',
            nonce: TCWC.nonce,
            order_id: orderData.order_id
        }).done(function (r) {
            if (!r.success) { stopPolling(); return; }

            var status = r.data.status;

            if (status === 'success') {
                stopPolling();
                $m.find('#tcwc-mpesa-wait-state').removeClass('tcwc-show');
                $m.find('#tcwc-success-state').addClass('tcwc-show');
                $m.find('#tcwc-success-copy').text(
                    'Payment received' + (r.data.receipt ? ' — receipt ' + r.data.receipt : '') + '. Opening WhatsApp for your receipt\u2026'
                );
                setTimeout(function () {
                    window.open(orderData.whatsapp_url, '_blank', 'noopener');
                    setTimeout(closeModal, 600);
                }, 900);
                return;
            }

            if (status === 'failed') {
                stopPolling();
                showMpesaFailure(r.data.detail || 'The M-Pesa payment was not completed.', orderData, phone);
                return;
            }

            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                stopPolling();
                $m.find('#tcwc-mpesa-wait-title').text('Still waiting');
                $m.find('#tcwc-mpesa-wait-copy').text('This is taking longer than usual. You can keep waiting, or confirm your order on WhatsApp instead — your order is already saved.');
                $m.find('#tcwc-mpesa-wait-actions').show();
                return;
            }

            pollTimer = setTimeout(function () { pollMpesaStatus(orderData, phone); }, POLL_INTERVAL_MS);
        }).fail(function () {
            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                stopPolling();
                showMpesaFailure('Lost connection while waiting for payment confirmation.', orderData, phone);
                return;
            }
            pollTimer = setTimeout(function () { pollMpesaStatus(orderData, phone); }, POLL_INTERVAL_MS);
        });
    }

    function showMpesaFailure(message, orderData, phone) {
        var $m = ensureModal();
        stopPolling();
        $m.find('#tcwc-mpesa-wait-title').text('Payment not completed');
        $m.find('#tcwc-mpesa-wait-copy').text(message);
        $m.find('#tcwc-mpesa-wait-actions').show();
        $m.data('tcwc-order-data', orderData);
        $m.data('tcwc-phone', phone);
    }

    /* ----------------------------------------------------------------
       Product page — add to cart, then open modal
       ---------------------------------------------------------------- */

    $(document).on('click', '#tcwc-product-btn', function () {
        var $btn = $(this);
        var $inlineNote = $('#tcwc-product-note');
        var $form = $('form.cart');

        $inlineNote.empty();

        if (!$form.length) {
            $inlineNote.html('<div class="tcwc-note-error">Product form not found.</div>');
            return;
        }

        var productId = parseInt($btn.data('product-id') || 0, 10);
        var qty = parseInt($form.find('input.qty').val() || 1, 10);
        var variationId = parseInt($form.find('input[name="variation_id"]').val() || 0, 10);

        if ($form.hasClass('variations_form') && !variationId) {
            $inlineNote.html('<div class="tcwc-note-error">Please select all product options first.</div>');
            return;
        }

        var originalLabel = $btn.find('span').length ? $btn.html() : $btn.text();
        $btn.prop('disabled', true);
        var $label = $btn.contents().filter(function () { return this.nodeType === 3 || this.nodeName !== 'SPAN'; });
        $btn.data('original-html', $btn.html());
        $btn.text('Adding…');

        $.post(TCWC.ajax, {
            action: 'tcwc_add_to_cart',
            nonce: TCWC.nonce,
            product_id: productId,
            variation_id: variationId,
            quantity: qty
        }).done(function (r) {
            if (!r.success) {
                $inlineNote.html(
                    '<div class="tcwc-note-error">' +
                    escapeHtml((r.data && r.data.message) || 'That product is not currently available.') +
                    '</div>'
                );
                return;
            }
            openModal();
        }).fail(function () {
            $inlineNote.html('<div class="tcwc-note-error">Could not add the product to your cart. Please try again.</div>');
        }).always(function () {
            $btn.prop('disabled', false);
            $btn.html($btn.data('original-html') || (TCWC.buttonText || 'Order on WhatsApp'));
        });
    });

    /* ----------------------------------------------------------------
       Cart page — open modal directly
       ---------------------------------------------------------------- */

    $(document).on('click', '#tcwc-cart-btn', function () {
        openModal();
    });

    /* ----------------------------------------------------------------
       Out-of-stock product page — "notify me" capture (v0.6 milestone 5)
       ---------------------------------------------------------------- */

    $(document).on('submit', '#tcwc-notify-form', function (e) {
        e.preventDefault();
        var $form = $(this);
        var $note = $('#tcwc-notify-note');
        var $btn = $form.find('.tcwc-notify-btn');
        var phone = $.trim($form.find('input[name="phone"]').val());
        var productId = parseInt($form.data('product-id') || 0, 10);

        $note.empty();

        if (phone.replace(/\D+/g, '').length < 9) {
            $note.html('<div class="tcwc-note-error">Please enter a valid phone number.</div>');
            return;
        }

        $btn.prop('disabled', true).text('Sending…');

        $.post(TCWC.ajax, {
            action: 'tcwc_subscribe_back_in_stock',
            nonce: TCWC.nonce,
            product_id: productId,
            phone: phone
        }).done(function (r) {
            if (r.success) {
                $form.replaceWith('<p class="tcwc-notify-confirmed">' + escapeHtml(r.data.message) + '</p>');
            } else {
                $note.html('<div class="tcwc-note-error">' + escapeHtml((r.data && r.data.message) || 'Could not save your request. Please try again.') + '</div>');
                $btn.prop('disabled', false).text('Notify me when back in stock');
            }
        }).fail(function () {
            $note.html('<div class="tcwc-note-error">Could not save your request. Please check your connection and try again.</div>');
            $btn.prop('disabled', false).text('Notify me when back in stock');
        });
    });

    /* ----------------------------------------------------------------
       Modal submit
       ---------------------------------------------------------------- */

    $(document).on('click', '#tcwc-submit-checkout', function () {
        submitCheckout();
    });

    $(document).on('keydown', '#tcwc-overlay input, #tcwc-overlay textarea', function (e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            submitCheckout();
        }
    });

    $(document).on('input', '#tcwc-overlay .tcwc-field.tcwc-invalid input, #tcwc-overlay .tcwc-field.tcwc-invalid textarea', function () {
        $(this).closest('.tcwc-field').removeClass('tcwc-invalid');
    });

    /* ----------------------------------------------------------------
       M-Pesa wait-state fallback actions
       ---------------------------------------------------------------- */

    $(document).on('click', '#tcwc-mpesa-retry', function () {
        var $m = ensureModal();
        var orderData = $m.data('tcwc-order-data');
        var phone = $m.data('tcwc-phone');
        if (orderData) runMpesaFlow(orderData, phone);
    });

    $(document).on('click', '#tcwc-mpesa-fallback', function () {
        var $m = ensureModal();
        var orderData = $m.data('tcwc-order-data');
        stopPolling();
        if (orderData && orderData.whatsapp_url) {
            window.open(orderData.whatsapp_url, '_blank', 'noopener');
        }
        closeModal();
    });

    /* ----------------------------------------------------------------
       Self-healing fallback injection

       The PHP side renders the button via the classic
       woocommerce_after_add_to_cart_button / woocommerce_after_cart hooks.
       Plenty of real-world setups never fire those hooks at all — a theme's
       page-builder product template (e.g. WoodMart's Elementor "Single
       Product" template), a fully custom product-summary layout, or
       WooCommerce's newer block-based Cart page (the [woocommerce_cart]
       shortcode's hooks don't exist in the Cart block). In every one of
       those cases the PHP runs correctly but nothing on the page ever
       calls it, so the button/box silently never appears.

       Rather than depend on knowing which theme/template is in play, we
       check after the page (and, for block templates, their async render)
       has settled: if the button is supposed to show and isn't there,
       inject it next to the best anchor we can find. The click handlers
       above are delegated on `document`, so an injected button works
       identically to a hook-rendered one — no separate wiring needed.
       ---------------------------------------------------------------- */

    function injectProductButtonFallback() {
        if (typeof TCWC === 'undefined') return;
        if (!$('body').hasClass('single-product')) return;

        // Out of stock: render the "notify me" capture form instead of the
        // order button, if that milestone is enabled and neither the hook
        // nor the shortcode already put one on the page.
        if (TCWC.productInStock === false) {
            if (!TCWC.backInStockEnabled) return;
            if ($('#tcwc-notify-form, .tcwc-notify-confirmed').length) return;

            var $stockAnchor = $('form.cart').last();
            if (!$stockAnchor.length) $stockAnchor = $('.wp-block-woocommerce-add-to-cart-form').last();
            if (!$stockAnchor.length) $stockAnchor = $('.summary.entry-summary').last();
            if (!$stockAnchor.length) return;

            $stockAnchor.after(
                '<form class="tcwc-notify-form" id="tcwc-notify-form" data-product-id="' +
                (parseInt(TCWC.currentProductId, 10) || 0) + '">' +
                    '<input type="tel" name="phone" class="tcwc-notify-input" placeholder="Your phone number" required>' +
                    '<button type="submit" class="button tcwc-notify-btn">Notify me when back in stock</button>' +
                '</form>' +
                '<div id="tcwc-notify-note" class="tcwc-note" aria-live="polite"></div>'
            );
            return;
        }

        if (!TCWC.showProductButton) return;
        if ($('#tcwc-product-btn').length) return; // hook already rendered it

        var $anchor = $('form.cart').last();
        if (!$anchor.length) $anchor = $('.wp-block-woocommerce-add-to-cart-form').last();
        if (!$anchor.length) $anchor = $('.summary.entry-summary').last();
        if (!$anchor.length) return;

        $anchor.after(
            '<button type="button" class="button tcwc-product-btn" id="tcwc-product-btn" data-product-id="' +
            (parseInt(TCWC.currentProductId, 10) || 0) + '">' +
            escapeHtml(TCWC.buttonText || 'Order on WhatsApp') +
            '</button>' +
            '<div id="tcwc-product-note" class="tcwc-note" aria-live="polite"></div>'
        );
    }

    function injectCartButtonFallback() {
        if (typeof TCWC === 'undefined' || !TCWC.showCartButton) return;
        if (!$('body').hasClass('woocommerce-cart')) return;
        if ($('#tcwc-cart-btn').length) return; // hook already rendered it
        if ($('.wc-empty-cart-message, .cart-empty').length) return; // cart is empty

        // Prefer the end of the totals/order-summary block (works for both
        // the classic shortcode cart and the newer Cart block), falling back
        // to just before the closing wrapper of whatever cart container exists.
        var $anchor = $('.wc-block-cart__totals-title').first().closest('.wp-block-woocommerce-cart-order-summary-block, .wc-block-cart__sidebar');
        if (!$anchor || !$anchor.length) $anchor = $('.cart-collaterals').last();
        if (!$anchor || !$anchor.length) $anchor = $('.wc-block-cart, .woocommerce-cart-form').last();
        if (!$anchor || !$anchor.length) return;

        var html =
            '<div class="tcwc-cart-box">' +
                '<button type="button" class="button alt tcwc-cart-btn" id="tcwc-cart-btn">Checkout on WhatsApp</button>' +
                '<div id="tcwc-cart-note" class="tcwc-note" aria-live="polite"></div>' +
            '</div>';

        if ($anchor.is('.wp-block-woocommerce-cart-order-summary-block, .wc-block-cart__sidebar, .cart-collaterals')) {
            $anchor.append(html);
        } else {
            $anchor.after(html);
        }
    }

    function runFallbackInjection() {
        injectProductButtonFallback();
        injectCartButtonFallback();
    }

    // Run immediately for classic (server-rendered) templates...
    runFallbackInjection();
    // ...and again shortly after, since block-based Cart/Product templates
    // mount via client-side React after the initial DOM is ready.
    setTimeout(runFallbackInjection, 600);
    setTimeout(runFallbackInjection, 1500);
});
