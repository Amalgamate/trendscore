<?php
if (!defined('ABSPATH')) exit;

/**
 * Thin client + webhook receiver for the official Meta WhatsApp Cloud API.
 *
 * This is additive: nothing here is required for the plugin to work. The
 * click-to-chat (wa.me) flow in class-tcwc-order.php keeps working exactly
 * as before whether or not Cloud API credentials are configured.
 */
class TCWC_Cloud_API {

    const NAMESPACE = 'tcwc/v1';
    const ROUTE = '/webhook';
    const GRAPH_VERSION = 'v21.0';

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('wp_ajax_tcwc_test_cloud_api', [__CLASS__, 'ajax_test_message']);
        add_action('wp_ajax_tcwc_generate_verify_token', [__CLASS__, 'ajax_generate_verify_token']);
        add_action('wp_ajax_tcwc_check_connection', [__CLASS__, 'ajax_check_connection']);
    }

    public static function register_routes() {
        register_rest_route(self::NAMESPACE, self::ROUTE, [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'handle_verification'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'handle_event'],
                'permission_callback' => '__return_true',
            ],
        ]);
    }

    public static function webhook_url() {
        return rest_url(self::NAMESPACE . self::ROUTE);
    }

    /** Auto-generates a verify token on first use so there's always one to paste into Meta's dashboard. */
    public static function get_verify_token() {
        $token = TCWC_Settings::get('cloud_api_verify_token');
        if (!$token) {
            $token = wp_generate_password(24, false, false);
            $settings = get_option('tcwc_settings', []);
            $settings['cloud_api_verify_token'] = $token;
            update_option('tcwc_settings', $settings);
        }
        return $token;
    }

    /** Meta's one-time GET handshake when you save the webhook URL in the App dashboard. */
    public static function handle_verification(WP_REST_Request $request) {
        $mode      = $request->get_param('hub_mode');
        $token     = (string) $request->get_param('hub_verify_token');
        $challenge = $request->get_param('hub_challenge');

        if ($mode === 'subscribe' && hash_equals(self::get_verify_token(), $token)) {
            self::log('Webhook verification succeeded.');
            return new WP_REST_Response((int) $challenge, 200);
        }

        self::log('Webhook verification failed — token mismatch.');
        return new WP_REST_Response('Verification failed', 403);
    }

    /** Every inbound message / delivery status Meta forwards, once a WABA is subscribed to this webhook. */
    public static function handle_event(WP_REST_Request $request) {
        if (!self::verify_signature($request)) {
            self::log('Rejected webhook payload — invalid or missing signature.');
            return new WP_REST_Response('Invalid signature', 401);
        }

        $body = $request->get_json_params();
        self::store_recent_event($body);

        foreach (($body['entry'] ?? []) as $entry) {
            foreach (($entry['changes'] ?? []) as $change) {
                $value = $change['value'] ?? [];

                foreach (($value['messages'] ?? []) as $message) {
                    self::log(sprintf(
                        'Inbound message from %s: %s',
                        $message['from'] ?? 'unknown',
                        $message['text']['body'] ?? ('[' . ($message['type'] ?? 'non-text') . ' message]')
                    ));

                    // v0.5: lets other modules (e.g. TCWC_Catalog's interactive
                    // menu) react to inbound messages without this class needing
                    // to know anything about them.
                    do_action('tcwc_inbound_message', $message, $value);
                }

                foreach (($value['statuses'] ?? []) as $status) {
                    self::log(sprintf(
                        'Delivery status for message %s: %s',
                        $status['id'] ?? 'unknown',
                        $status['status'] ?? 'unknown'
                    ));

                    // v0.9: was logged-only before — TCWC_Inbox turns this into
                    // real ✓✓ read-receipt ticks on the matching message.
                    do_action('tcwc_message_status', $status, $value);
                }
            }
        }

        return new WP_REST_Response(['received' => true], 200);
    }

    /**
     * Verifies Meta's X-Hub-Signature-256 header against the raw request body.
     * Skipped (returns true) until an App Secret is configured, so the webhook
     * still works during initial setup — but should always be filled in before
     * going live, since without it anyone who finds the URL can post fake events.
     */
    private static function verify_signature(WP_REST_Request $request) {
        $secret = TCWC_Settings::get('cloud_api_app_secret');
        if (!$secret) return true;

        $signature = $request->get_header('x_hub_signature_256');
        if (!$signature) return false;

        $expected = 'sha256=' . hash_hmac('sha256', $request->get_body(), $secret);
        return hash_equals($expected, $signature);
    }

    /**
     * Sends a free-form text message via the Cloud API.
     * Only deliverable inside the 24h window after the customer last messaged
     * the business number, or via a pre-approved message template outside it.
     */
    public static function send_text($to, $message) {
        $to = preg_replace('/\D+/', '', $to);

        return self::send_raw([
            'messaging_product' => 'whatsapp',
            'to'                => $to,
            'type'              => 'text',
            'text'              => ['body' => $message],
        ]);
    }

    /**
     * Sends an arbitrary /messages payload (used for text above, and by
     * TCWC_Catalog for interactive list / product-list messages). $payload
     * must already include messaging_product/to/type/etc — this just adds
     * auth, posts it, and logs the result the same way for every message type.
     */
    public static function send_raw($payload) {
        $phone_number_id = TCWC_Settings::get('cloud_api_phone_number_id');
        $token = TCWC_Settings::get('cloud_api_access_token');

        if (!$phone_number_id || !$token) {
            return new WP_Error('tcwc_not_configured', 'Cloud API is not fully configured yet.');
        }

        $to = $payload['to'] ?? 'unknown';
        $url = 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . rawurlencode($phone_number_id) . '/messages';

        $response = wp_remote_post($url, [
            'timeout' => 15,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode($payload),
        ]);

        if (is_wp_error($response)) {
            self::log('Send failed: ' . $response->get_error_message());
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300) {
            self::log('Message sent to ' . $to . ' — id: ' . ($body['messages'][0]['id'] ?? 'unknown'));

            // v0.9: lets TCWC_Inbox log every outbound send into a real
            // conversation thread, the same way tcwc_inbound_message already
            // lets it (and the AI assistant / catalogue) react to inbound ones.
            do_action('tcwc_outbound_message', $payload, $body);

            return $body;
        }

        $error_message = $body['error']['message'] ?? ('HTTP ' . $code);
        self::log('Send failed (' . $to . '): ' . $error_message);
        return new WP_Error('tcwc_send_failed', $error_message, $body);
    }

    public static function ajax_test_message() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $to = sanitize_text_field($_POST['to'] ?? '');
        if (!$to) wp_send_json_error(['message' => 'Enter a WhatsApp number to test with.'], 400);

        $result = self::send_text(
            $to,
            'This is a test message from Trends CORE WhatsApp Commerce. If you received this, your Cloud API connection is working.'
        );

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success(['message' => 'Test message sent — check WhatsApp on that number.']);
    }

    /**
     * Phase 0 hardening: "configured" in the settings UI so far only meant
     * "fields are non-empty". This makes a real Graph API call so a bad or
     * expired token surfaces immediately instead of silently at checkout time.
     */
    public static function check_connection() {
        $phone_number_id = TCWC_Settings::get('cloud_api_phone_number_id');
        $token = TCWC_Settings::get('cloud_api_access_token');

        if (!$phone_number_id || !$token) {
            return new WP_Error('tcwc_not_configured', 'Enter a Phone Number ID and access token first.');
        }

        $url = 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . rawurlencode($phone_number_id)
            . '?fields=' . rawurlencode('display_phone_number,verified_name,quality_rating');

        $response = wp_remote_get($url, [
            'timeout' => 15,
            'headers' => ['Authorization' => 'Bearer ' . $token],
        ]);

        if (is_wp_error($response)) {
            self::log('Connection check failed: ' . $response->get_error_message());
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300 && !empty($body['display_phone_number'])) {
            self::log('Connection check succeeded for ' . $body['display_phone_number']);
            return $body;
        }

        $error_message = $body['error']['message'] ?? ('HTTP ' . $code);
        self::log('Connection check failed: ' . $error_message);
        return new WP_Error('tcwc_check_failed', $error_message, $body);
    }

    public static function ajax_check_connection() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $result = self::check_connection();

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        $label = trim(($result['verified_name'] ?? '') . ' · ' . ($result['display_phone_number'] ?? ''), ' ·');
        wp_send_json_success(['message' => 'Connected — ' . $label]);
    }

    public static function ajax_generate_verify_token() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $settings = get_option('tcwc_settings', []);
        $settings['cloud_api_verify_token'] = wp_generate_password(24, false, false);
        update_option('tcwc_settings', $settings);

        wp_send_json_success(['verify_token' => $settings['cloud_api_verify_token']]);
    }

    /** Keeps the last 20 raw webhook payloads so the admin screen can show real activity. */
    private static function store_recent_event($payload) {
        $log = get_option('tcwc_cloud_api_recent_events', []);
        array_unshift($log, [
            'time'    => current_time('mysql'),
            'payload' => $payload,
        ]);
        update_option('tcwc_cloud_api_recent_events', array_slice($log, 0, 20), false);
    }

    private static function log($message) {
        if (function_exists('wc_get_logger')) {
            wc_get_logger()->info($message, ['source' => 'tcwc-cloud-api']);
        }
    }
}
