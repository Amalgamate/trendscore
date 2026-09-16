<?php
if (!defined('ABSPATH')) exit;

/**
 * M-Pesa Daraja STK Push integration (v0.4).
 *
 * Additive, like the Cloud API layer: if M-Pesa isn't enabled/configured,
 * nothing here runs and the existing click-to-chat / Cloud API checkout
 * flow is completely unaffected. Payment happens without leaving the
 * WhatsApp-initiated checkout modal, tied to the same WooCommerce order
 * object that the plugin already creates.
 */
class TCWC_Mpesa {

    const NAMESPACE = 'tcwc/v1';
    const CALLBACK_ROUTE = '/mpesa-callback';
    const TOKEN_TRANSIENT = 'tcwc_mpesa_token';

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('wp_ajax_tcwc_mpesa_stkpush', [__CLASS__, 'ajax_stk_push']);
        add_action('wp_ajax_nopriv_tcwc_mpesa_stkpush', [__CLASS__, 'ajax_stk_push']);
        add_action('wp_ajax_tcwc_mpesa_status', [__CLASS__, 'ajax_status']);
        add_action('wp_ajax_nopriv_tcwc_mpesa_status', [__CLASS__, 'ajax_status']);
        add_action('wp_ajax_tcwc_mpesa_recheck_order', [__CLASS__, 'ajax_recheck_order']);

        // Admin visibility (Milestone 1.3): M-Pesa panel on the order edit screen.
        // Works for both legacy post-based orders and HPOS — this hook fires on
        // both admin order screens regardless of storage backend.
        add_action('woocommerce_admin_order_data_after_billing_address', [__CLASS__, 'render_order_panel']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'order_screen_assets']);
    }

    public static function register_routes() {
        register_rest_route(self::NAMESPACE, self::CALLBACK_ROUTE, [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [__CLASS__, 'handle_callback'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function callback_url() {
        return rest_url(self::NAMESPACE . self::CALLBACK_ROUTE);
    }

    private static function base_url() {
        return TCWC_Settings::get('mpesa_environment', 'sandbox') === 'live'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    private static function is_configured() {
        return TCWC_Settings::get('mpesa_shortcode')
            && TCWC_Settings::get('mpesa_consumer_key')
            && TCWC_Settings::get('mpesa_consumer_secret')
            && TCWC_Settings::get('mpesa_passkey');
    }

    /**
     * Daraja OAuth tokens expire hourly. Cached in a transient (a few seconds
     * short of the real expiry) so we're not re-authenticating on every push.
     */
    private static function get_token() {
        $cached = get_transient(self::TOKEN_TRANSIENT);
        if ($cached) return $cached;

        $key = TCWC_Settings::get('mpesa_consumer_key');
        $secret = TCWC_Settings::get('mpesa_consumer_secret');
        if (!$key || !$secret) return new WP_Error('tcwc_mpesa_not_configured', 'M-Pesa Consumer Key/Secret are not set.');

        $response = wp_remote_get(self::base_url() . '/oauth/v1/generate?grant_type=client_credentials', [
            'timeout' => 15,
            'headers' => ['Authorization' => 'Basic ' . base64_encode($key . ':' . $secret)],
        ]);

        if (is_wp_error($response)) return $response;

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body['access_token'])) {
            return new WP_Error('tcwc_mpesa_auth_failed', $body['error_description'] ?? 'M-Pesa authentication failed.');
        }

        $ttl = isset($body['expires_in']) ? max(60, (int) $body['expires_in'] - 100) : 3500;
        set_transient(self::TOKEN_TRANSIENT, $body['access_token'], $ttl);

        return $body['access_token'];
    }

    /**
     * Initiates an STK Push for a given order and phone number. Stores the
     * CheckoutRequestID on the order so the async callback (and manual
     * "recheck payment status") can find their way back to it.
     */
    public static function stk_push($order, $phone) {
        if (!self::is_configured()) {
            return new WP_Error('tcwc_mpesa_not_configured', 'M-Pesa is not fully configured yet.');
        }

        $token = self::get_token();
        if (is_wp_error($token)) return $token;

        $shortcode = TCWC_Settings::get('mpesa_shortcode');
        $passkey = TCWC_Settings::get('mpesa_passkey');
        $timestamp = current_time('YmdHis');
        $password = base64_encode($shortcode . $passkey . $timestamp);

        $msisdn = self::normalize_msisdn($phone);
        if (!$msisdn) {
            return new WP_Error('tcwc_mpesa_bad_phone', 'Enter a valid Safaricom number, e.g. 0712345678.');
        }

        $amount = (int) ceil((float) $order->get_total());
        $type = TCWC_Settings::get('mpesa_shortcode_type', 'paybill') === 'till'
            ? 'CustomerBuyGoodsOnline'
            : 'CustomerPayBillOnline';

        $body = [
            'BusinessShortCode' => $shortcode,
            'Password'          => $password,
            'Timestamp'         => $timestamp,
            'TransactionType'   => $type,
            'Amount'            => $amount,
            'PartyA'            => $msisdn,
            'PartyB'            => $shortcode,
            'PhoneNumber'       => $msisdn,
            'CallBackURL'       => self::callback_url(),
            'AccountReference'  => 'Order' . $order->get_order_number(),
            'TransactionDesc'   => 'Order #' . $order->get_order_number(),
        ];

        $response = wp_remote_post(self::base_url() . '/mpesa/stkpush/v1/processrequest', [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode($body),
        ]);

        if (is_wp_error($response)) {
            self::note($order, 'M-Pesa STK Push request failed: ' . $response->get_error_message());
            self::store_recent_attempt($order, 'error', $msisdn);
            return $response;
        }

        $data = json_decode(wp_remote_retrieve_body($response), true);

        if (empty($data['ResponseCode']) || $data['ResponseCode'] !== '0') {
            $error_message = $data['errorMessage'] ?? ($data['ResponseDescription'] ?? 'M-Pesa did not accept the STK Push request.');
            self::note($order, 'M-Pesa STK Push rejected: ' . $error_message);
            $order->update_meta_data('_tcwc_mpesa_status', 'failed');
            $order->update_meta_data('_tcwc_mpesa_result_desc', $error_message);
            $order->save();
            self::store_recent_attempt($order, 'rejected', $msisdn);
            return new WP_Error('tcwc_mpesa_rejected', $error_message, $data);
        }

        $order->update_meta_data('_tcwc_mpesa_checkout_request_id', $data['CheckoutRequestID']);
        $order->update_meta_data('_tcwc_mpesa_merchant_request_id', $data['MerchantRequestID']);
        $order->update_meta_data('_tcwc_mpesa_status', 'pending');
        $order->update_meta_data('_tcwc_mpesa_phone', $msisdn);
        $order->update_meta_data('_tcwc_mpesa_result_desc', 'Push sent — waiting for customer to enter PIN.');
        $order->save();

        self::note($order, sprintf('M-Pesa STK Push sent to %s (CheckoutRequestID: %s).', $msisdn, $data['CheckoutRequestID']));
        self::store_recent_attempt($order, 'sent', $msisdn);

        return $data;
    }

    /** Normalizes 07XXXXXXXX / 01XXXXXXXX / 2547XXXXXXXX / +2547XXXXXXXX into 2547XXXXXXXX or 2541XXXXXXXX. */
    private static function normalize_msisdn($phone) {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        if (preg_match('/^0(7|1)\d{8}$/', $digits)) return '254' . substr($digits, 1);
        if (preg_match('/^254(7|1)\d{8}$/', $digits)) return $digits;
        if (preg_match('/^(7|1)\d{8}$/', $digits)) return '254' . $digits;
        return null;
    }

    /**
     * Safaricom's asynchronous confirmation. This is the source of truth for
     * whether payment succeeded — the STK Push response only means "the
     * prompt was sent to the phone", not "the customer paid".
     */
    public static function handle_callback(WP_REST_Request $request) {
        $body = $request->get_json_params();
        $stk = $body['Body']['stkCallback'] ?? null;

        if (!$stk || !isset($stk['CheckoutRequestID'])) {
            self::log('Rejected malformed M-Pesa callback payload.');
            return new WP_REST_Response(['ResultCode' => 1, 'ResultDesc' => 'Malformed payload'], 400);
        }

        $order = self::find_order_by_checkout_request_id($stk['CheckoutRequestID']);
        if (!$order) {
            self::log('M-Pesa callback for unknown CheckoutRequestID: ' . $stk['CheckoutRequestID']);
            // Still acknowledge with 200 — Safaricom retries on non-200/ResultCode!=0,
            // and an unknown order on our end isn't something retrying will fix.
            return new WP_REST_Response(['ResultCode' => 0, 'ResultDesc' => 'Accepted'], 200);
        }

        self::apply_callback_result($order, $stk);

        return new WP_REST_Response(['ResultCode' => 0, 'ResultDesc' => 'Accepted'], 200);
    }

    private static function apply_callback_result($order, $stk) {
        $result_code = (int) ($stk['ResultCode'] ?? 1);
        $result_desc = $stk['ResultDesc'] ?? 'Unknown result';

        if ($result_code === 0) {
            $meta = [];
            foreach (($stk['CallbackMetadata']['Item'] ?? []) as $item) {
                if (isset($item['Name'])) $meta[$item['Name']] = $item['Value'] ?? null;
            }

            $order->update_meta_data('_tcwc_mpesa_status', 'success');
            $order->update_meta_data('_tcwc_mpesa_receipt_number', $meta['MpesaReceiptNumber'] ?? '');
            $order->update_meta_data('_tcwc_mpesa_result_desc', $result_desc);
            $order->add_order_note(sprintf(
                'M-Pesa payment received. Receipt: %s, Amount: %s.',
                $meta['MpesaReceiptNumber'] ?? 'unknown',
                $meta['Amount'] ?? 'unknown'
            ));

            if ($order->has_status(['on-hold', 'pending'])) {
                $order->payment_complete($meta['MpesaReceiptNumber'] ?? '');
            }

            self::store_recent_attempt($order, 'success');
        } else {
            // Common ResultCodes: 1032 = cancelled by user, 1037 = timeout (no PIN entered), 1 = insufficient funds.
            $order->update_meta_data('_tcwc_mpesa_status', 'failed');
            $order->update_meta_data('_tcwc_mpesa_result_desc', $result_desc);
            $order->add_order_note('M-Pesa payment not completed: ' . $result_desc);
            self::store_recent_attempt($order, 'failed');
        }

        $order->save();

        // v0.6: lets TCWC_Automation send a payment-status WhatsApp template
        // without this class needing to know anything about automation.
        do_action('tcwc_mpesa_payment_result', $order, $result_code === 0 ? 'success' : 'failed', $result_desc);
    }

    private static function find_order_by_checkout_request_id($checkout_request_id) {
        $orders = wc_get_orders([
            'limit'      => 1,
            'meta_key'   => '_tcwc_mpesa_checkout_request_id',
            'meta_value' => $checkout_request_id,
        ]);
        return $orders ? $orders[0] : null;
    }

    /**
     * Manual fallback for the real-world edge case where the callback never
     * arrives (network issue on Safaricom's side, server briefly down, etc.).
     * Queries Daraja directly for the current status of a CheckoutRequestID.
     */
    public static function query_status($order) {
        $checkout_request_id = $order->get_meta('_tcwc_mpesa_checkout_request_id');
        if (!$checkout_request_id) {
            return new WP_Error('tcwc_mpesa_no_request', 'No M-Pesa request has been made for this order yet.');
        }

        $token = self::get_token();
        if (is_wp_error($token)) return $token;

        $shortcode = TCWC_Settings::get('mpesa_shortcode');
        $passkey = TCWC_Settings::get('mpesa_passkey');
        $timestamp = current_time('YmdHis');
        $password = base64_encode($shortcode . $passkey . $timestamp);

        $response = wp_remote_post(self::base_url() . '/mpesa/stkpushquery/v1/query', [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode([
                'BusinessShortCode' => $shortcode,
                'Password'          => $password,
                'Timestamp'         => $timestamp,
                'CheckoutRequestID' => $checkout_request_id,
            ]),
        ]);

        if (is_wp_error($response)) return $response;

        $data = json_decode(wp_remote_retrieve_body($response), true);

        // Daraja shapes the query response like a callback body — reuse the same logic.
        if (isset($data['ResultCode'])) {
            self::apply_callback_result($order, $data);
        }

        return $data;
    }

    /* ---------------- AJAX: storefront ---------------- */

    public static function ajax_stk_push() {
        check_ajax_referer('tcwc_nonce', 'nonce');

        $order_id = absint($_POST['order_id'] ?? 0);
        $phone = sanitize_text_field($_POST['phone'] ?? '');
        $order = $order_id ? wc_get_order($order_id) : null;

        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        $result = self::stk_push($order, $phone);
        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success([
            'message' => $result['CustomerMessage'] ?? 'Check your phone and enter your M-Pesa PIN to complete payment.',
            'checkout_request_id' => $result['CheckoutRequestID'],
        ]);
    }

    public static function ajax_status() {
        check_ajax_referer('tcwc_nonce', 'nonce');

        $order_id = absint($_POST['order_id'] ?? 0);
        $order = $order_id ? wc_get_order($order_id) : null;
        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        wp_send_json_success([
            'status' => $order->get_meta('_tcwc_mpesa_status') ?: 'pending',
            'receipt' => $order->get_meta('_tcwc_mpesa_receipt_number'),
            'detail' => $order->get_meta('_tcwc_mpesa_result_desc'),
        ]);
    }

    /* ---------------- AJAX: wp-admin recheck ---------------- */

    public static function ajax_recheck_order() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce') && !current_user_can('tcwc_manage_orders')) {
            wp_send_json_error(['message' => 'Not allowed.'], 403);
        }

        $order_id = absint($_POST['order_id'] ?? 0);
        $order = $order_id ? wc_get_order($order_id) : null;
        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        $result = self::query_status($order);
        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success([
            'status' => $order->get_meta('_tcwc_mpesa_status') ?: 'pending',
            'receipt' => $order->get_meta('_tcwc_mpesa_receipt_number'),
            'detail' => $order->get_meta('_tcwc_mpesa_result_desc'),
        ]);
    }

    /* ---------------- Admin order screen (Milestone 1.3) ---------------- */

    public static function order_screen_assets($hook) {
        // Legacy post-based order edit screens are post.php/post-new.php; HPOS's
        // dedicated order screen has "wc-orders" in its hook suffix — cover both.
        $is_legacy_order_screen = in_array($hook, ['post.php', 'post-new.php'], true);
        $is_hpos_order_screen = strpos((string) $hook, 'wc-orders') !== false;
        if (!$is_legacy_order_screen && !$is_hpos_order_screen) return;

        wp_enqueue_script('tcwc-mpesa-admin', TCWC_URL . 'assets/js/tcwc-mpesa-admin.js', [], TCWC_VERSION, true);
        wp_localize_script('tcwc-mpesa-admin', 'TCWC_MPESA_ADMIN', [
            'ajax'  => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tcwc_nonce'),
        ]);
    }

    public static function render_order_panel($order) {
        $status = $order->get_meta('_tcwc_mpesa_status');
        if (!$status) return; // No M-Pesa attempt on this order — stay out of the way.

        $receipt = $order->get_meta('_tcwc_mpesa_receipt_number');
        $detail = $order->get_meta('_tcwc_mpesa_result_desc');
        $phone = $order->get_meta('_tcwc_mpesa_phone');

        $badge_class = [
            'success' => 'color:#0a7c4a;background:#e6f6ee;',
            'failed'  => 'color:#a02222;background:#fbe9e9;',
            'pending' => 'color:#8a6d00;background:#fff7e0;',
            'sent'    => 'color:#8a6d00;background:#fff7e0;',
        ];
        $style = $badge_class[$status] ?? $badge_class['pending'];
        ?>
        <div class="tcwc-mpesa-panel" style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;">
            <h4 style="margin-bottom:8px;">M-Pesa payment</h4>
            <p>
                <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;<?php echo esc_attr($style); ?>">
                    <?php echo esc_html(ucfirst($status)); ?>
                </span>
            </p>
            <?php if ($phone): ?><p>Phone: <strong><?php echo esc_html($phone); ?></strong></p><?php endif; ?>
            <?php if ($receipt): ?><p>Receipt: <strong><?php echo esc_html($receipt); ?></strong></p><?php endif; ?>
            <?php if ($detail): ?><p style="color:#666;font-size:12px;"><?php echo esc_html($detail); ?></p><?php endif; ?>
            <?php if ($status !== 'success'): ?>
                <button type="button" class="button" id="tcwc-mpesa-recheck" data-order-id="<?php echo esc_attr($order->get_id()); ?>">
                    Recheck payment status
                </button>
                <span id="tcwc-mpesa-recheck-result" style="margin-left:8px;font-size:12px;"></span>
            <?php endif; ?>
        </div>
        <?php
    }

    /* ---------------- Logging & recent-attempts (mirrors the Cloud API pattern) ---------------- */

    private static function note($order, $message) {
        $order->add_order_note($message);
        self::log($message);
    }

    private static function store_recent_attempt($order, $status, $phone = null) {
        $log = get_option('tcwc_mpesa_recent_attempts', []);
        array_unshift($log, [
            'time'  => current_time('mysql'),
            'order' => $order->get_order_number(),
            'status' => $status,
            'phone' => $phone ?: $order->get_meta('_tcwc_mpesa_phone'),
        ]);
        update_option('tcwc_mpesa_recent_attempts', array_slice($log, 0, 20), false);
    }

    private static function log($message) {
        if (function_exists('wc_get_logger')) {
            wc_get_logger()->info($message, ['source' => 'tcwc-mpesa']);
        }
    }
}
