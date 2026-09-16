<?php
if (!defined('ABSPATH')) exit;

/**
 * v0.6: Automation — WhatsApp notifications for order events, sent via
 * approved message templates (see the Catalogue tab in v0.5) so they can
 * reach the customer outside the 24h free-form window.
 *
 * All 5 milestones for v0.6 are implemented here: order confirmation,
 * payment status, delivery notification, abandoned-order recovery, and
 * back-in-stock alerts. v0.6 automation is now feature-complete; v0.7 (AI
 * shopping assistant) is next on the roadmap.
 *
 * Entirely opt-in and additive: requires Cloud API to be configured and at
 * least one Meta-approved template, or nothing sends and every existing
 * flow (click-to-chat, Cloud API notify-admin, M-Pesa) is unaffected.
 */
class TCWC_Automation {

    const SENT_META_KEY = '_tcwc_order_confirmation_sent';
    const PAYMENT_STATUS_META_KEY = '_tcwc_payment_status_notified';
    const DELIVERY_SENT_META_KEY = '_tcwc_delivery_notification_sent';
    const ABANDONED_NUDGE_META_KEY = '_tcwc_abandoned_cart_nudge_sent';
    const BACK_IN_STOCK_META_KEY = '_tcwc_back_in_stock_subscribers';
    const CRON_HOOK = 'tcwc_abandoned_cart_check';

    public static function init() {
        // Fires whenever an order transitions INTO on-hold — the status the
        // WhatsApp checkout flow (class-tcwc-order.php) always sets on a new
        // order, so this is the right moment for "we received your order".
        add_action('woocommerce_order_status_on-hold', [__CLASS__, 'maybe_send_order_confirmation']);

        // v0.6 milestone 2: fired by class-tcwc-mpesa.php after every callback
        // (and every manual "recheck payment status"), independent of whether
        // that resulted in an order status change — so payment failures still
        // reach the customer even when the order stays On hold.
        add_action('tcwc_mpesa_payment_result', [__CLASS__, 'maybe_send_payment_status'], 10, 3);

        // v0.6 milestone 3: WooCommerce has no universal "shipped" status out of
        // the box, so "completed" is the practical, always-available hook —
        // the point at which the store has genuinely finished the order.
        add_action('woocommerce_order_status_completed', [__CLASS__, 'maybe_send_delivery_notification']);

        // v0.6 milestone 4: abandoned-order recovery. This plugin's checkout
        // creates a real on-hold WooCommerce order the instant the customer
        // submits the WhatsApp-checkout modal — there is no separate
        // pre-order "cart + contact info" stage to capture, unlike a classic
        // storefront. So "abandoned" here means "created, still on-hold, and
        // nothing has happened since" — the customer never sent the WhatsApp
        // message, or opened it and went quiet, or bailed on the M-Pesa PIN
        // prompt. A self-healing hourly cron (scheduled below on every
        // request rather than only on activation, since this plugin is
        // typically updated by overwriting files via FTP, which does not
        // re-fire register_activation_hook) checks for those and sends one
        // reminder each.
        add_action(self::CRON_HOOK, [__CLASS__, 'run_abandoned_cart_check']);
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 300, 'hourly', self::CRON_HOOK);
        }

        // v0.6 milestone 5: back-in-stock alerts. Capture happens via AJAX
        // from the "notify me" form (class-tcwc-storefront.php renders it in
        // place of the order button whenever a product is out of stock), the
        // send happens the moment WooCommerce reports the product back in
        // stock. Scoped to simple products / the parent product's own stock
        // status only — variation-level back-in-stock (a specific size/colour
        // coming back while others stay out) is not covered in this pass.
        add_action('wp_ajax_tcwc_subscribe_back_in_stock', [__CLASS__, 'subscribe_back_in_stock']);
        add_action('wp_ajax_nopriv_tcwc_subscribe_back_in_stock', [__CLASS__, 'subscribe_back_in_stock']);
        add_action('woocommerce_product_set_stock_status', [__CLASS__, 'maybe_notify_back_in_stock'], 10, 3);
    }

    /** @param string $template_key Which template setting to require, so each milestone can be configured independently. */
    private static function is_configured($template_key) {
        return (bool) (
            TCWC_Settings::get('cloud_api_access_token')
            && TCWC_Settings::get('cloud_api_phone_number_id')
            && TCWC_Settings::get($template_key)
        );
    }

    private static function customer_name($order) {
        return trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()) ?: 'there';
    }

    public static function maybe_send_order_confirmation($order_id) {
        if (TCWC_Settings::get('automation_order_confirmation_enabled', 'no') !== 'yes') return;
        if (!self::is_configured('automation_order_confirmation_template')) return;
        if (!class_exists('TCWC_Cloud_API')) return;

        $order = wc_get_order($order_id);
        if (!$order) return;

        // Idempotency: an order can re-enter on-hold (e.g. a manual status
        // change back) without us re-sending the same confirmation.
        if ($order->get_meta(self::SENT_META_KEY) === 'yes') return;

        $phone = $order->get_billing_phone();
        if (!$phone) return;

        $name = self::customer_name($order);
        $total = wp_strip_all_tags(wc_price($order->get_total(), ['currency' => $order->get_currency()]));

        $result = self::send_template(
            $phone,
            TCWC_Settings::get('automation_order_confirmation_template'),
            TCWC_Settings::get('automation_order_confirmation_language', 'en_US'),
            [$name, (string) $order->get_order_number(), $total]
        );

        if (is_wp_error($result)) {
            $order->add_order_note("Trends CORE: order-confirmation WhatsApp template failed to send \u2014 " . $result->get_error_message());
            self::log_send('order_confirmation', $order_id, 'failed', $result->get_error_message());
            return;
        }

        $order->update_meta_data(self::SENT_META_KEY, 'yes');
        $order->save();
        $order->add_order_note('Trends CORE: order-confirmation WhatsApp template sent to ' . $phone . '.');
        self::log_send('order_confirmation', $order_id, 'sent', '');
    }

    /**
     * v0.6 milestone 2: payment status notification.
     *
     * Fired from class-tcwc-mpesa.php's tcwc_mpesa_payment_result action
     * after every callback AND every manual "recheck payment status" — so a
     * customer who abandons the STK prompt still hears back from us even
     * though the order itself stays On hold rather than changing status.
     *
     * @param WC_Order $order
     * @param string   $status       'success' or 'failed'
     * @param string   $result_desc  Daraja's human-readable result description
     */
    public static function maybe_send_payment_status($order, $status, $result_desc) {
        if (TCWC_Settings::get('automation_payment_status_enabled', 'no') !== 'yes') return;
        if (!self::is_configured('automation_payment_status_template')) return;
        if (!class_exists('TCWC_Cloud_API')) return;
        if (!$order instanceof WC_Order) return;

        // Idempotency keyed on the status itself, not just "sent once": a
        // failed attempt followed by a successful retry should still notify
        // for both, but a repeat callback/recheck for the *same* result
        // (Safaricom retries, an admin clicking recheck twice) should not
        // re-send the identical message.
        if ($order->get_meta(self::PAYMENT_STATUS_META_KEY) === $status) return;

        $phone = $order->get_billing_phone();
        if (!$phone) return;

        $name = self::customer_name($order);

        $status_text = $status === 'success'
            ? 'Payment received' . ($order->get_meta('_tcwc_mpesa_receipt_number') ? ' — receipt ' . $order->get_meta('_tcwc_mpesa_receipt_number') : '') . '. Thank you!'
            : 'Payment was not completed (' . ($result_desc ?: 'please try again') . ').';

        $result = self::send_template(
            $phone,
            TCWC_Settings::get('automation_payment_status_template'),
            TCWC_Settings::get('automation_payment_status_language', 'en_US'),
            [$name, (string) $order->get_order_number(), $status_text]
        );

        if (is_wp_error($result)) {
            $order->add_order_note("Trends CORE: payment-status WhatsApp template failed to send \u2014 " . $result->get_error_message());
            self::log_send('payment_status', $order->get_id(), 'failed', $result->get_error_message());
            return;
        }

        $order->update_meta_data(self::PAYMENT_STATUS_META_KEY, $status);
        $order->save();
        $order->add_order_note('Trends CORE: payment-status (' . $status . ') WhatsApp template sent to ' . $phone . '.');
        self::log_send('payment_status', $order->get_id(), 'sent', $status_text);
    }

    /**
     * v0.6 milestone 3: delivery notification.
     *
     * Fires on the order reaching "completed" — WooCommerce has no
     * dedicated "shipped" status out of the box, so this is the practical,
     * always-available point at which the store has genuinely finished
     * fulfilling the order.
     */
    public static function maybe_send_delivery_notification($order_id) {
        if (TCWC_Settings::get('automation_delivery_enabled', 'no') !== 'yes') return;
        if (!self::is_configured('automation_delivery_template')) return;
        if (!class_exists('TCWC_Cloud_API')) return;

        $order = wc_get_order($order_id);
        if (!$order) return;

        if ($order->get_meta(self::DELIVERY_SENT_META_KEY) === 'yes') return;

        $phone = $order->get_billing_phone();
        if (!$phone) return;

        $name = self::customer_name($order);

        $result = self::send_template(
            $phone,
            TCWC_Settings::get('automation_delivery_template'),
            TCWC_Settings::get('automation_delivery_language', 'en_US'),
            [$name, (string) $order->get_order_number()]
        );

        if (is_wp_error($result)) {
            $order->add_order_note("Trends CORE: delivery WhatsApp template failed to send \u2014 " . $result->get_error_message());
            self::log_send('delivery', $order_id, 'failed', $result->get_error_message());
            return;
        }

        $order->update_meta_data(self::DELIVERY_SENT_META_KEY, 'yes');
        $order->save();
        $order->add_order_note('Trends CORE: delivery WhatsApp template sent to ' . $phone . '.');
        self::log_send('delivery', $order_id, 'sent', '');
    }

    /**
     * v0.6 milestone 4: abandoned-order recovery (cron entry point).
     *
     * Batches to 20 orders per run to keep each hourly cron tick cheap;
     * anything missed just gets picked up on the next run.
     */
    public static function run_abandoned_cart_check() {
        if (TCWC_Settings::get('automation_abandoned_cart_enabled', 'no') !== 'yes') return;
        if (!self::is_configured('automation_abandoned_cart_template')) return;
        if (!class_exists('TCWC_Cloud_API')) return;

        $hours = max(1, absint(TCWC_Settings::get('automation_abandoned_cart_hours', 6)));
        $cutoff = time() - ($hours * HOUR_IN_SECONDS);

        $orders = wc_get_orders([
            'status' => 'on-hold',
            'limit'  => 20,
            'orderby' => 'date',
            'order'  => 'ASC',
            'date_created' => '<' . $cutoff,
            'return' => 'objects',
        ]);

        foreach ($orders as $order) {
            self::maybe_send_abandoned_nudge($order);
        }
    }

    /**
     * @param WC_Order $order
     */
    private static function maybe_send_abandoned_nudge($order) {
        // Only orders this plugin itself created — never nudge orders placed
        // through the normal WooCommerce checkout or any other channel.
        if ($order->get_created_via() !== 'trendscore_whatsapp') return;

        if ($order->get_meta(self::ABANDONED_NUDGE_META_KEY) === 'yes') return;

        // Extra safety on top of the on-hold status filter: if a payment
        // result already came back successful, don't nudge even if the
        // order status hasn't been manually advanced yet.
        if ($order->get_meta(self::PAYMENT_STATUS_META_KEY) === 'success') return;

        $phone = $order->get_billing_phone();
        if (!$phone) return;

        $name = self::customer_name($order);
        $pay_url = $order->get_checkout_payment_url();

        $result = self::send_template(
            $phone,
            TCWC_Settings::get('automation_abandoned_cart_template'),
            TCWC_Settings::get('automation_abandoned_cart_language', 'en_US'),
            [$name, (string) $order->get_order_number(), $pay_url]
        );

        if (is_wp_error($result)) {
            $order->add_order_note("Trends CORE: abandoned-order WhatsApp template failed to send \u2014 " . $result->get_error_message());
            self::log_send('abandoned_cart', $order->get_id(), 'failed', $result->get_error_message());
            return;
        }

        $order->update_meta_data(self::ABANDONED_NUDGE_META_KEY, 'yes');
        $order->save();
        $order->add_order_note('Trends CORE: abandoned-order WhatsApp reminder sent to ' . $phone . '.');
        self::log_send('abandoned_cart', $order->get_id(), 'sent', '');
    }

    /**
     * v0.6 milestone 5: back-in-stock alerts — AJAX capture endpoint.
     *
     * Called from the "notify me" form (class-tcwc-storefront.php) rendered
     * in place of the order button on out-of-stock products.
     */
    public static function subscribe_back_in_stock() {
        check_ajax_referer('tcwc_nonce', 'nonce');

        $product_id = absint($_POST['product_id'] ?? 0);
        $phone = sanitize_text_field($_POST['phone'] ?? '');

        if (!$product_id || !$phone) {
            wp_send_json_error(['message' => 'A phone number is required.'], 400);
        }

        $product = wc_get_product($product_id);
        if (!$product) {
            wp_send_json_error(['message' => 'Product not found.'], 404);
        }

        if ($product->is_in_stock()) {
            wp_send_json_error(['message' => 'This product is already back in stock.'], 400);
        }

        $normalized_phone = preg_replace('/\D+/', '', $phone);
        if (!$normalized_phone) {
            wp_send_json_error(['message' => 'That phone number doesn\'t look right.'], 400);
        }

        $subscribers = get_post_meta($product_id, self::BACK_IN_STOCK_META_KEY, true);
        if (!is_array($subscribers)) $subscribers = [];

        // Dedupe by normalized phone so re-submitting the form doesn't queue
        // the same person twice.
        foreach ($subscribers as $existing) {
            if (($existing['phone'] ?? '') === $normalized_phone) {
                wp_send_json_success(['message' => "You're already on the list — we'll message you the moment it's back."]);
            }
        }

        $subscribers[] = [
            'phone' => $normalized_phone,
            'requested' => current_time('mysql'),
        ];
        update_post_meta($product_id, self::BACK_IN_STOCK_META_KEY, $subscribers);

        wp_send_json_success(['message' => "Got it — we'll message you on WhatsApp the moment it's back in stock."]);
    }

    /**
     * v0.6 milestone 5: back-in-stock alerts — send trigger.
     *
     * Fires on every stock-status change; only acts when the new status is
     * 'instock' and there are pending subscribers. One-shot per subscriber:
     * the list is cleared after this pass whether or not every send
     * succeeded, to avoid re-notifying on a later unrelated stock toggle.
     *
     * @param int    $product_id
     * @param string $status  'instock', 'outofstock', or 'onbackorder'
     */
    public static function maybe_notify_back_in_stock($product_id, $status, $product = null) {
        if ($status !== 'instock') return;
        if (TCWC_Settings::get('automation_back_in_stock_enabled', 'no') !== 'yes') return;
        if (!self::is_configured('automation_back_in_stock_template')) return;
        if (!class_exists('TCWC_Cloud_API')) return;

        $subscribers = get_post_meta($product_id, self::BACK_IN_STOCK_META_KEY, true);
        if (empty($subscribers) || !is_array($subscribers)) return;

        if (!$product) $product = wc_get_product($product_id);
        $product_name = $product ? $product->get_name() : get_the_title($product_id);
        $product_url = get_permalink($product_id);

        $sent = 0;
        $failed = 0;

        foreach ($subscribers as $subscriber) {
            $phone = $subscriber['phone'] ?? '';
            if (!$phone) continue;

            $result = self::send_template(
                $phone,
                TCWC_Settings::get('automation_back_in_stock_template'),
                TCWC_Settings::get('automation_back_in_stock_language', 'en_US'),
                ['there', $product_name, $product_url]
            );

            if (is_wp_error($result)) {
                $failed++;
            } else {
                $sent++;
            }
        }

        // One-shot: clear regardless of per-recipient failures. A stale
        // subscriber list retried forever on every later stock toggle would
        // be worse than occasionally missing a delivery-failed recipient.
        delete_post_meta($product_id, self::BACK_IN_STOCK_META_KEY);

        self::log_send('back_in_stock', $product_id, $failed ? 'partial' : 'sent', "sent={$sent} failed={$failed} product=" . $product_name);
    }

    /**
     * Sends an approved WhatsApp template message with positional {{1}},
     * {{2}}, ... body variables, in the order given in $params.
     */
    private static function send_template($to, $template_name, $language, array $params) {
        $to = preg_replace('/\D+/', '', $to);
        if (!$to) return new WP_Error('tcwc_automation_no_phone', 'No phone number on the order.');

        $parameters = array_map(function ($value) {
            return ['type' => 'text', 'text' => (string) $value];
        }, $params);

        return TCWC_Cloud_API::send_raw([
            'messaging_product' => 'whatsapp',
            'to'                => $to,
            'type'              => 'template',
            'template'          => [
                'name'     => $template_name,
                'language' => ['code' => $language ?: 'en_US'],
                'components' => [
                    ['type' => 'body', 'parameters' => $parameters],
                ],
            ],
        ]);
    }

    private static function log_send($event, $order_id, $status, $detail) {
        $log = get_option('tcwc_automation_log', []);
        array_unshift($log, [
            'time'   => current_time('mysql'),
            'event'  => $event,
            'order'  => $order_id,
            'status' => $status,
            'detail' => $detail,
        ]);
        update_option('tcwc_automation_log', array_slice($log, 0, 20), false);
    }
}
