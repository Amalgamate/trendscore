<?php
if (!defined('ABSPATH')) exit;

class TCWC_Settings {

    /** Fields that hold live credentials and must never sit in wp_options in plain text. */
    const ENCRYPTED_KEYS = ['cloud_api_access_token', 'cloud_api_app_secret', 'mpesa_consumer_secret', 'mpesa_passkey', 'ai_api_key'];
    const ENC_PREFIX = 'tcwc_enc:';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_init', [__CLASS__, 'register']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'assets']);
    }

    /**
     * Returns a setting's value. Encrypted fields (access token, app secret)
     * are transparently decrypted here so every other call site in the plugin
     * (TCWC_Cloud_API, etc.) keeps working unchanged.
     */
    public static function get($key, $default = '') {
        $s = get_option('tcwc_settings', []);
        $value = isset($s[$key]) ? $s[$key] : $default;

        if ($value && in_array($key, self::ENCRYPTED_KEYS, true)) {
            $value = self::decrypt($value);
        }

        return $value;
    }

    /**
     * Derives a symmetric key from WordPress's own AUTH_KEY/SECURE_AUTH_KEY
     * salts (set in wp-config.php, unique per site, never stored in the DB).
     * Falls back to a locally generated key only on the rare install that
     * hasn't set real salts, so encryption still works rather than fatally
     * erroring — but real salts are strongly recommended.
     */
    private static function encryption_key() {
        $material = (defined('AUTH_KEY') ? AUTH_KEY : '') . (defined('SECURE_AUTH_KEY') ? SECURE_AUTH_KEY : '');

        if (strlen($material) < 20) {
            $material = get_option('tcwc_fallback_enc_key');
            if (!$material) {
                $material = wp_generate_password(64, true, true);
                update_option('tcwc_fallback_enc_key', $material, false);
            }
        }

        return hash('sha256', $material, true);
    }

    /** Encrypts a credential for storage. Returns plain text unchanged if OpenSSL is unavailable. */
    public static function encrypt($plaintext) {
        if ($plaintext === '' || $plaintext === null) return '';
        if (!function_exists('openssl_encrypt')) return $plaintext;

        $iv = openssl_random_pseudo_bytes(16);
        $cipher = openssl_encrypt($plaintext, 'aes-256-cbc', self::encryption_key(), OPENSSL_RAW_DATA, $iv);
        if ($cipher === false) return $plaintext;

        return self::ENC_PREFIX . base64_encode($iv . $cipher);
    }

    /** Decrypts a stored credential. Values saved before this hardening pass (no prefix) pass through as-is. */
    public static function decrypt($stored) {
        if (strpos($stored, self::ENC_PREFIX) !== 0) {
            return $stored;
        }
        if (!function_exists('openssl_decrypt')) return '';

        $raw = base64_decode(substr($stored, strlen(self::ENC_PREFIX)));
        $iv = substr($raw, 0, 16);
        $cipher = substr($raw, 16);
        $plain = openssl_decrypt($cipher, 'aes-256-cbc', self::encryption_key(), OPENSSL_RAW_DATA, $iv);

        return $plain === false ? '' : $plain;
    }

    /**
     * Consolidated under the same top-level parent as the Orders dashboard
     * (registered in class-tcwc-staff.php::menu()) rather than nested under
     * WooCommerce, so the whole plugin lives behind one sidebar entry.
     * manage_woocommerce keeps this hidden from WhatsApp Staff accounts
     * automatically — WordPress drops a submenu entirely for anyone who
     * lacks its capability, no extra code needed here.
     */
    public static function menu() {
        add_submenu_page(
            'tcwc-orders',
            'WhatsApp Commerce Settings',
            'Settings',
            'manage_woocommerce',
            'tcwc-settings',
            [__CLASS__, 'page']
        );
    }

    public static function assets($hook) {
        if (strpos($hook, 'tcwc-settings') === false) return;
        wp_enqueue_style('tcwc-admin', TCWC_URL . 'assets/css/tcwc-admin.css', [], TCWC_VERSION);
        wp_enqueue_script('tcwc-admin', TCWC_URL . 'assets/js/tcwc-admin.js', [], TCWC_VERSION, true);
        wp_localize_script('tcwc-admin', 'TCWC_ADMIN', [
            'ajax'  => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tcwc_nonce'),
        ]);
    }

    public static function register() {
        register_setting('tcwc_settings_group', 'tcwc_settings', [
            'sanitize_callback' => [__CLASS__, 'sanitize']
        ]);
    }

    public static function sanitize($input) {
        $existing = get_option('tcwc_settings', []);

        $out = [];
        $out['phone'] = preg_replace('/\D+/', '', $input['phone'] ?? '');
        $out['button_text'] = sanitize_text_field($input['button_text'] ?? 'Order on WhatsApp');
        $out['button_size'] = in_array(($input['button_size'] ?? 'medium'), ['small', 'medium', 'large'], true) ? $input['button_size'] : 'medium';
        $out['show_product_button'] = !empty($input['show_product_button']) ? 'yes' : 'no';
        $out['show_cart_button'] = !empty($input['show_cart_button']) ? 'yes' : 'no';
        $out['create_order'] = !empty($input['create_order']) ? 'yes' : 'no';
        $out['currency_prefix'] = sanitize_text_field($input['currency_prefix'] ?? 'KES ');
        $out['message_intro'] = sanitize_textarea_field($input['message_intro'] ?? 'Hello! I would like to order:');

        // Site-wide floating WhatsApp button
        $out['floating_button_enabled'] = !empty($input['floating_button_enabled']) ? 'yes' : 'no';
        $out['floating_button_position'] = (($input['floating_button_position'] ?? 'right') === 'left') ? 'left' : 'right';
        $out['floating_button_message'] = sanitize_textarea_field($input['floating_button_message'] ?? "Hi! I have a question about your products.");

        // Cloud API (v0.3)
        $out['cloud_api_enabled'] = !empty($input['cloud_api_enabled']) ? 'yes' : 'no';
        $out['cloud_api_phone_number_id'] = sanitize_text_field($input['cloud_api_phone_number_id'] ?? '');
        $out['cloud_api_waba_id'] = sanitize_text_field($input['cloud_api_waba_id'] ?? '');
        // Password-type fields are rendered blank on every page load (see page()) so the
        // encrypted secret is never echoed back into the DOM. That means a blank submission
        // here means "leave it alone", not "clear it" — only a non-empty value overwrites it.
        $posted_token = sanitize_text_field($input['cloud_api_access_token'] ?? '');
        $out['cloud_api_access_token'] = $posted_token !== ''
            ? self::encrypt($posted_token)
            : ($existing['cloud_api_access_token'] ?? '');

        $posted_secret = sanitize_text_field($input['cloud_api_app_secret'] ?? '');
        $out['cloud_api_app_secret'] = $posted_secret !== ''
            ? self::encrypt($posted_secret)
            : ($existing['cloud_api_app_secret'] ?? '');

        // Explicit "clear credential" checkboxes, since blank-now-means-keep above.
        if (!empty($input['cloud_api_clear_token'])) $out['cloud_api_access_token'] = '';
        if (!empty($input['cloud_api_clear_secret'])) $out['cloud_api_app_secret'] = '';
        $out['cloud_api_notify_admin'] = !empty($input['cloud_api_notify_admin']) ? 'yes' : 'no';
        $out['cloud_api_admin_number'] = preg_replace('/\D+/', '', $input['cloud_api_admin_number'] ?? '');

        // Auto-generated by TCWC_Cloud_API — not a form field, always preserve it.
        $out['cloud_api_verify_token'] = $existing['cloud_api_verify_token'] ?? '';

        // M-Pesa (v0.4)
        $out['mpesa_enabled'] = !empty($input['mpesa_enabled']) ? 'yes' : 'no';
        $out['mpesa_environment'] = (($input['mpesa_environment'] ?? 'sandbox') === 'live') ? 'live' : 'sandbox';
        $out['mpesa_shortcode'] = preg_replace('/\D+/', '', $input['mpesa_shortcode'] ?? '');
        $out['mpesa_shortcode_type'] = (($input['mpesa_shortcode_type'] ?? 'paybill') === 'till') ? 'till' : 'paybill';
        $out['mpesa_consumer_key'] = sanitize_text_field($input['mpesa_consumer_key'] ?? '');

        $posted_mpesa_secret = sanitize_text_field($input['mpesa_consumer_secret'] ?? '');
        $out['mpesa_consumer_secret'] = $posted_mpesa_secret !== ''
            ? self::encrypt($posted_mpesa_secret)
            : ($existing['mpesa_consumer_secret'] ?? '');

        $posted_passkey = sanitize_text_field($input['mpesa_passkey'] ?? '');
        $out['mpesa_passkey'] = $posted_passkey !== ''
            ? self::encrypt($posted_passkey)
            : ($existing['mpesa_passkey'] ?? '');

        if (!empty($input['mpesa_clear_secret'])) $out['mpesa_consumer_secret'] = '';
        if (!empty($input['mpesa_clear_passkey'])) $out['mpesa_passkey'] = '';

        // Catalogue & interactive menu (v0.5)
        $out['catalog_id'] = sanitize_text_field($input['catalog_id'] ?? '');
        $out['catalog_auto_sync'] = !empty($input['catalog_auto_sync']) ? 'yes' : 'no';
        $out['interactive_menu_enabled'] = !empty($input['interactive_menu_enabled']) ? 'yes' : 'no';
        $out['interactive_menu_keywords'] = sanitize_text_field($input['interactive_menu_keywords'] ?? 'menu,catalog,shop');

        // Automation (v0.6, milestone 1: order confirmation)
        $out['automation_order_confirmation_enabled'] = !empty($input['automation_order_confirmation_enabled']) ? 'yes' : 'no';
        $out['automation_order_confirmation_template'] = sanitize_key($input['automation_order_confirmation_template'] ?? 'order_confirmation');
        $out['automation_order_confirmation_language'] = sanitize_text_field($input['automation_order_confirmation_language'] ?? 'en_US');

        // Automation (v0.6, milestone 2: payment status)
        $out['automation_payment_status_enabled'] = !empty($input['automation_payment_status_enabled']) ? 'yes' : 'no';
        $out['automation_payment_status_template'] = sanitize_key($input['automation_payment_status_template'] ?? 'payment_status');
        $out['automation_payment_status_language'] = sanitize_text_field($input['automation_payment_status_language'] ?? 'en_US');

        // Automation (v0.6, milestone 3: delivery notification)
        $out['automation_delivery_enabled'] = !empty($input['automation_delivery_enabled']) ? 'yes' : 'no';
        $out['automation_delivery_template'] = sanitize_key($input['automation_delivery_template'] ?? 'delivery_notification');
        $out['automation_delivery_language'] = sanitize_text_field($input['automation_delivery_language'] ?? 'en_US');

        // Automation (v0.6, milestone 4: abandoned-order recovery)
        $out['automation_abandoned_cart_enabled'] = !empty($input['automation_abandoned_cart_enabled']) ? 'yes' : 'no';
        $out['automation_abandoned_cart_template'] = sanitize_key($input['automation_abandoned_cart_template'] ?? 'abandoned_cart');
        $out['automation_abandoned_cart_language'] = sanitize_text_field($input['automation_abandoned_cart_language'] ?? 'en_US');
        $out['automation_abandoned_cart_hours'] = max(1, absint($input['automation_abandoned_cart_hours'] ?? 6));

        // Automation (v0.6, milestone 5: back-in-stock alerts)
        $out['automation_back_in_stock_enabled'] = !empty($input['automation_back_in_stock_enabled']) ? 'yes' : 'no';
        $out['automation_back_in_stock_template'] = sanitize_key($input['automation_back_in_stock_template'] ?? 'back_in_stock');
        $out['automation_back_in_stock_language'] = sanitize_text_field($input['automation_back_in_stock_language'] ?? 'en_US');

        // AI shopping assistant (v0.7)
        $out['ai_assistant_enabled'] = !empty($input['ai_assistant_enabled']) ? 'yes' : 'no';
        $out['ai_model'] = sanitize_text_field($input['ai_model'] ?? '');

        $posted_ai_key = sanitize_text_field($input['ai_api_key'] ?? '');
        $out['ai_api_key'] = $posted_ai_key !== ''
            ? self::encrypt($posted_ai_key)
            : ($existing['ai_api_key'] ?? '');
        if (!empty($input['ai_clear_api_key'])) $out['ai_api_key'] = '';

        $out['ai_handoff_keywords'] = sanitize_text_field($input['ai_handoff_keywords'] ?? 'agent,human,help,talk to someone,speak to someone');
        $out['ai_handoff_after_failures'] = max(1, absint($input['ai_handoff_after_failures'] ?? 2));
        $out['ai_handoff_notice'] = sanitize_textarea_field($input['ai_handoff_notice'] ?? "Got it — connecting you with a person from our team. They'll be with you shortly.");
        $out['ai_notify_admin_on_handoff'] = !empty($input['ai_notify_admin_on_handoff']) ? 'yes' : 'no';
        $out['ai_store_instructions'] = sanitize_textarea_field($input['ai_store_instructions'] ?? '');

        return $out;
    }

    public static function page() {
        if (!current_user_can('manage_woocommerce')) return;

        $phone = self::get('phone');
        $is_connected = !empty($phone);

        $cloud_enabled = self::get('cloud_api_enabled', 'no') === 'yes';
        $token_saved = (bool) self::get('cloud_api_access_token');
        $secret_saved = (bool) self::get('cloud_api_app_secret');
        $cloud_configured = self::get('cloud_api_phone_number_id') && $token_saved;
        $webhook_url = class_exists('TCWC_Cloud_API') ? TCWC_Cloud_API::webhook_url() : home_url('/wp-json/tcwc/v1/webhook');
        $verify_token = class_exists('TCWC_Cloud_API') ? TCWC_Cloud_API::get_verify_token() : self::get('cloud_api_verify_token');

        $mpesa_enabled = self::get('mpesa_enabled', 'no') === 'yes';
        $mpesa_secret_saved = (bool) self::get('mpesa_consumer_secret');
        $mpesa_passkey_saved = (bool) self::get('mpesa_passkey');
        $mpesa_configured = self::get('mpesa_shortcode') && self::get('mpesa_consumer_key') && $mpesa_secret_saved && $mpesa_passkey_saved;
        $mpesa_callback_url = class_exists('TCWC_Mpesa') ? TCWC_Mpesa::callback_url() : home_url('/wp-json/tcwc/v1/mpesa-callback');
        $mpesa_recent = get_option('tcwc_mpesa_recent_attempts', []);

        $catalog_id = self::get('catalog_id');
        $catalog_auto_sync = self::get('catalog_auto_sync', 'no') === 'yes';
        $catalog_configured = $token_saved && $catalog_id;
        $menu_enabled = self::get('interactive_menu_enabled', 'no') === 'yes';
        $catalog_sync_log = get_option('tcwc_catalog_sync_log', []);

        $automation_confirmation_enabled = self::get('automation_order_confirmation_enabled', 'no') === 'yes';
        $automation_configured = $token_saved && self::get('cloud_api_phone_number_id') && self::get('automation_order_confirmation_template');
        $automation_log = get_option('tcwc_automation_log', []);

        $automation_payment_enabled = self::get('automation_payment_status_enabled', 'no') === 'yes';
        $automation_payment_configured = $token_saved && self::get('cloud_api_phone_number_id') && self::get('automation_payment_status_template');
        $mpesa_enabled_for_automation = self::get('mpesa_enabled', 'no') === 'yes';

        $automation_delivery_enabled = self::get('automation_delivery_enabled', 'no') === 'yes';
        $automation_delivery_configured = $token_saved && self::get('cloud_api_phone_number_id') && self::get('automation_delivery_template');

        $automation_abandoned_enabled = self::get('automation_abandoned_cart_enabled', 'no') === 'yes';
        $automation_abandoned_configured = $token_saved && self::get('cloud_api_phone_number_id') && self::get('automation_abandoned_cart_template');

        $automation_stock_enabled = self::get('automation_back_in_stock_enabled', 'no') === 'yes';
        $automation_stock_configured = $token_saved && self::get('cloud_api_phone_number_id') && self::get('automation_back_in_stock_template');

        $ai_enabled = self::get('ai_assistant_enabled', 'no') === 'yes';
        $ai_key_saved = (bool) self::get('ai_api_key');
        $ai_configured = $ai_key_saved && self::get('ai_model');
        $ai_conversation_log = get_option('tcwc_ai_conversation_log', []);
        $staff_users = class_exists('TCWC_Staff') ? TCWC_Staff::get_staff_users() : [];
        ?>
        <div id="tcwc-settings-wrap" class="wrap">

            <div class="tcwc-header">
                <div class="tcwc-header-icon"></div>
                <div class="tcwc-header-text">
                    <h1>Trends CORE WhatsApp Commerce <span class="tcwc-version-badge">v<?php echo esc_html(TCWC_VERSION); ?></span></h1>
                    <p>WhatsApp-first shopping for your WooCommerce store. Click-to-chat works out of the box — connect the official Cloud API when you're ready for two-way messaging.</p>
                </div>
                <span class="tcwc-status-pill <?php echo $is_connected ? 'tcwc-connected' : ''; ?>">
                    <span class="tcwc-status-dot"></span>
                    <?php echo $is_connected ? 'Connected · ' . esc_html($phone) : 'Not connected yet'; ?>
                </span>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields('tcwc_settings_group'); ?>

                <!--
                    Tab radios live inside the form, immediately before .tcwc-body,
                    so they are true DOM siblings of it — required for the
                    "#tcwc-tab-X:checked ~ .tcwc-body ..." CSS in tcwc-admin.css to
                    match at all. They previously sat outside the form (siblings of
                    <form> itself, not of .tcwc-body), so no tab ever displayed its
                    panel — not even the default "Connection" tab.
                -->
                <input type="radio" name="tcwc-tab" id="tcwc-tab-connection" class="tcwc-tab-radio" checked>
                <input type="radio" name="tcwc-tab" id="tcwc-tab-storefront" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-messaging" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-orders" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-cloudapi" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-mpesa" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-catalog" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-automation" class="tcwc-tab-radio">
            <input type="radio" name="tcwc-tab" id="tcwc-tab-ai" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-staff" class="tcwc-tab-radio">
                <input type="radio" name="tcwc-tab" id="tcwc-tab-roadmap" class="tcwc-tab-radio">

                <div class="tcwc-body">

                    <!-- Tab nav -->
                    <nav class="tcwc-tabs-nav">
                        <label for="tcwc-tab-connection">🔌 Connection</label>
                        <label for="tcwc-tab-storefront">🛍️ Storefront</label>
                        <label for="tcwc-tab-messaging">💬 Messaging</label>
                        <label for="tcwc-tab-orders">📦 Orders</label>
                        <label for="tcwc-tab-cloudapi">☁️ Cloud API</label>
                        <label for="tcwc-tab-mpesa">💳 M-Pesa</label>
                        <label for="tcwc-tab-catalog">🗂️ Catalogue</label>
                        <label for="tcwc-tab-automation">🤖 Automation</label>
                        <label for="tcwc-tab-ai">✨ AI Assistant</label>
                        <label for="tcwc-tab-staff">🧑‍💼 Staff</label>
                        <label for="tcwc-tab-roadmap">🚀 What's Next</label>
                    </nav>

                    <!-- Panels -->
                    <div class="tcwc-panels">

                        <div id="tcwc-panel-connection" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>WhatsApp number</h2>
                                <p class="tcwc-card-sub">This is the business number every order gets sent to.</p>
                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_phone">WhatsApp number</label>
                                    <input id="tcwc_phone" type="text" name="tcwc_settings[phone]" value="<?php echo esc_attr($phone); ?>" placeholder="2547XXXXXXXX">
                                    <p class="tcwc-hint">International format, digits only — no <code>+</code>, no spaces. Example: <code>254712345678</code>.</p>
                                </div>
                                <?php if (!$is_connected): ?>
                                <div class="tcwc-callout tcwc-callout-warn">
                                    ⚠️ No number set yet — the WhatsApp buttons will still show on your store, but customers won't be able to reach you until this is filled in.
                                </div>
                                <?php else: ?>
                                <div class="tcwc-callout tcwc-callout-info">
                                    ✅ Orders will open a chat at <strong>wa.me/<?php echo esc_html($phone); ?></strong>.
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>

                        <div id="tcwc-panel-storefront" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Buttons &amp; placement</h2>
                                <p class="tcwc-card-sub">Control where the WhatsApp buttons appear and what they say.</p>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_button_text">Product button text</label>
                                    <input id="tcwc_button_text" type="text" name="tcwc_settings[button_text]" value="<?php echo esc_attr(self::get('button_text', 'Order on WhatsApp')); ?>">
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Product button size</label>
                                    <select name="tcwc_settings[button_size]">
                                        <option value="small" <?php selected(self::get('button_size', 'medium'), 'small'); ?>>Small</option>
                                        <option value="medium" <?php selected(self::get('button_size', 'medium'), 'medium'); ?>>Medium (default)</option>
                                        <option value="large" <?php selected(self::get('button_size', 'medium'), 'large'); ?>>Large</option>
                                    </select>
                                    <p class="tcwc-hint">The button never stretches to full width regardless of size or theme — if it still looks oversized, your theme may be forcing <code>.button</code> elements wider; the Small size is the safest fallback there.</p>
                                </div>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Product page button</strong>
                                        <span>Shows next to Add to Cart on every purchasable product.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[show_product_button]" value="yes" <?php checked(self::get('show_product_button', 'yes'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Cart page button</strong>
                                        <span>Lets shoppers check out their whole cart on WhatsApp.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[show_cart_button]" value="yes" <?php checked(self::get('show_cart_button', 'yes'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Floating WhatsApp button</h2>
                                <p class="tcwc-card-sub">A round WhatsApp button that stays fixed in the corner of every page on your site (not just Shop/Product pages) — the fastest route for a visitor who just wants to ask a question, wherever they are.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Show floating button site-wide</strong>
                                        <span>Opens a WhatsApp chat with the number set in the Connection tab.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[floating_button_enabled]" value="yes" <?php checked(self::get('floating_button_enabled', 'yes'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Position</label>
                                    <select name="tcwc_settings[floating_button_position]">
                                        <option value="right" <?php selected(self::get('floating_button_position', 'right'), 'right'); ?>>Bottom right</option>
                                        <option value="left" <?php selected(self::get('floating_button_position', 'right'), 'left'); ?>>Bottom left</option>
                                    </select>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_float_msg">Pre-filled message</label>
                                    <textarea id="tcwc_float_msg" name="tcwc_settings[floating_button_message]"><?php echo esc_textarea(self::get('floating_button_message', 'Hi! I have a question about your products.')); ?></textarea>
                                    <p class="tcwc-hint">Pre-fills the chat when someone taps the floating button — they can still edit it before sending. This is plain click-to-chat (no order data), since it can appear on any page.</p>
                                </div>

                                <?php if (!$is_connected): ?>
                                <div class="tcwc-callout tcwc-callout-warn">
                                    ⚠️ Set a WhatsApp number in the Connection tab — the floating button won't render without one.
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>

                        <div id="tcwc-panel-messaging" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Message template</h2>
                                <p class="tcwc-card-sub">This is what lands in your WhatsApp inbox when an order comes in — check the live preview on the right.</p>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_currency">Currency prefix</label>
                                    <input id="tcwc_currency" type="text" name="tcwc_settings[currency_prefix]" value="<?php echo esc_attr(self::get('currency_prefix', 'KES ')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_intro">Message intro</label>
                                    <textarea id="tcwc_intro" name="tcwc_settings[message_intro]"><?php echo esc_textarea(self::get('message_intro', 'Hello! I would like to order:')); ?></textarea>
                                </div>
                            </div>
                        </div>

                        <div id="tcwc-panel-orders" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Order handling</h2>
                                <p class="tcwc-card-sub">How this plugin talks to WooCommerce's order system.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Create a WooCommerce order first</strong>
                                        <span>Recommended — gives every WhatsApp order a real order number, and keeps stock and reporting accurate inside WooCommerce.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[create_order]" value="yes" <?php checked(self::get('create_order', 'yes'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    New orders are created with status <strong>On hold</strong> until you confirm payment, so nothing ships automatically.
                                </div>
                            </div>
                        </div>

                        <div id="tcwc-panel-cloudapi" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Official WhatsApp Cloud API <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.3</span></h2>
                                <p class="tcwc-card-sub">Optional. Adds real webhooks and business-initiated messages on top of the click-to-chat flow above — nothing here is required for the store to keep working.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable Cloud API</strong>
                                        <span>Turns on the webhook endpoint and lets the plugin send messages through Meta's official API.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[cloud_api_enabled]" value="yes" <?php checked($cloud_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_phone_number_id">Phone Number ID</label>
                                    <input id="tcwc_phone_number_id" type="text" name="tcwc_settings[cloud_api_phone_number_id]" value="<?php echo esc_attr(self::get('cloud_api_phone_number_id')); ?>" placeholder="e.g. 109876543210123">
                                    <p class="tcwc-hint">From Meta for Developers → your App → WhatsApp → API Setup.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_waba_id">WhatsApp Business Account ID <span style="text-transform:none;font-weight:400;">(optional, for catalog sync later)</span></label>
                                    <input id="tcwc_waba_id" type="text" name="tcwc_settings[cloud_api_waba_id]" value="<?php echo esc_attr(self::get('cloud_api_waba_id')); ?>">
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_access_token">Permanent access token</label>
                                    <input id="tcwc_access_token" type="password" name="tcwc_settings[cloud_api_access_token]" value="" autocomplete="off" placeholder="<?php echo $token_saved ? '•••••••• (saved — leave blank to keep it)' : 'Paste your System User token'; ?>">
                                    <p class="tcwc-hint">
                                        <?php if ($token_saved): ?>
                                            🔒 Stored, encrypted at rest. Paste a new token to replace it, or
                                            <label style="font-weight:600;"><input type="checkbox" name="tcwc_settings[cloud_api_clear_token]" value="1"> clear it</label> on save.
                                        <?php else: ?>
                                            Generate a System User token in Meta Business Settings so it doesn't expire in 24 hours like the default test token.
                                        <?php endif; ?>
                                    </p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_app_secret">App secret <span style="text-transform:none;font-weight:400;">(recommended)</span></label>
                                    <input id="tcwc_app_secret" type="password" name="tcwc_settings[cloud_api_app_secret]" value="" autocomplete="off" placeholder="<?php echo $secret_saved ? '•••••••• (saved — leave blank to keep it)' : 'Paste your app secret'; ?>">
                                    <p class="tcwc-hint">
                                        <?php if ($secret_saved): ?>
                                            🔒 Stored, encrypted at rest. Paste a new secret to replace it, or
                                            <label style="font-weight:600;"><input type="checkbox" name="tcwc_settings[cloud_api_clear_secret]" value="1"> clear it</label> on save.
                                        <?php else: ?>
                                            Used to verify that webhook events really came from Meta. Leave blank only while testing — required before going live.
                                        <?php endif; ?>
                                    </p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Webhook callback URL</label>
                                    <input type="text" readonly value="<?php echo esc_attr($webhook_url); ?>" onclick="this.select();">
                                    <p class="tcwc-hint">Paste this into Meta for Developers → your App → WhatsApp → Configuration → Webhook.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Verify token</label>
                                    <input type="text" readonly value="<?php echo esc_attr($verify_token); ?>" id="tcwc-verify-token-field" onclick="this.select();">
                                    <p class="tcwc-hint">
                                        Paste this alongside the callback URL when Meta asks you to verify the webhook.
                                        <button type="button" class="button" id="tcwc-regenerate-token" style="margin-left:6px;">Regenerate</button>
                                    </p>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Connection health</label>
                                    <p class="tcwc-card-sub" style="margin-top:-4px;">A real call to Meta's Graph API — confirms the Phone Number ID and token actually work, not just that the fields are filled in.</p>
                                    <div style="display:flex;gap:10px;align-items:center;">
                                        <button type="button" class="button" id="tcwc-check-connection">Check connection</button>
                                        <span id="tcwc-connection-result"></span>
                                    </div>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Notify me on WhatsApp for new orders</strong>
                                        <span>Sends the order summary straight to your own WhatsApp via the Cloud API, in addition to the customer's click-to-chat message.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[cloud_api_notify_admin]" value="yes" <?php checked(self::get('cloud_api_notify_admin', 'no'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_admin_number">Your WhatsApp number</label>
                                    <input id="tcwc_admin_number" type="text" name="tcwc_settings[cloud_api_admin_number]" value="<?php echo esc_attr(self::get('cloud_api_admin_number')); ?>" placeholder="2547XXXXXXXX">
                                </div>

                                <div class="tcwc-callout tcwc-callout-warn">
                                    ⚠️ Cloud API messages can only be delivered as free-form text within 24 hours of that number last messaging your business — otherwise Meta requires a pre-approved message template. Send your business number a WhatsApp message first to open that window before testing.
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Send a test message</label>
                                    <div style="display:flex;gap:10px;max-width:460px;">
                                        <input type="text" id="tcwc-test-number" placeholder="2547XXXXXXXX" style="flex:1;">
                                        <button type="button" class="button button-primary" id="tcwc-test-send" style="white-space:nowrap;">Send test</button>
                                    </div>
                                    <p class="tcwc-hint" id="tcwc-test-result"></p>
                                </div>
                            </div>
                        </div>

                        <div id="tcwc-panel-mpesa" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>M-Pesa STK Push <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.4</span></h2>
                                <p class="tcwc-card-sub">Optional. Lets a customer pay instantly from the checkout modal — a payment prompt is pushed straight to their phone, tied to the same WooCommerce order created above.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable M-Pesa STK Push</strong>
                                        <span>Adds a "Pay with M-Pesa" option to the WhatsApp checkout modal.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[mpesa_enabled]" value="yes" <?php checked($mpesa_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Environment</label>
                                    <select name="tcwc_settings[mpesa_environment]">
                                        <option value="sandbox" <?php selected(self::get('mpesa_environment', 'sandbox'), 'sandbox'); ?>>Sandbox (testing)</option>
                                        <option value="live" <?php selected(self::get('mpesa_environment', 'sandbox'), 'live'); ?>>Live (production)</option>
                                    </select>
                                    <p class="tcwc-hint">Use Sandbox with Safaricom's test shortcode/credentials until you've confirmed a full payment end to end.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_mpesa_shortcode">Shortcode</label>
                                    <input id="tcwc_mpesa_shortcode" type="text" name="tcwc_settings[mpesa_shortcode]" value="<?php echo esc_attr(self::get('mpesa_shortcode')); ?>" placeholder="e.g. 174379">
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Shortcode type</label>
                                    <select name="tcwc_settings[mpesa_shortcode_type]">
                                        <option value="paybill" <?php selected(self::get('mpesa_shortcode_type', 'paybill'), 'paybill'); ?>>PayBill</option>
                                        <option value="till" <?php selected(self::get('mpesa_shortcode_type', 'paybill'), 'till'); ?>>Till (Buy Goods)</option>
                                    </select>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_mpesa_key">Consumer Key</label>
                                    <input id="tcwc_mpesa_key" type="text" name="tcwc_settings[mpesa_consumer_key]" value="<?php echo esc_attr(self::get('mpesa_consumer_key')); ?>" autocomplete="off">
                                    <p class="tcwc-hint">From your app on the Daraja developer portal.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_mpesa_secret">Consumer Secret</label>
                                    <input id="tcwc_mpesa_secret" type="password" name="tcwc_settings[mpesa_consumer_secret]" value="" autocomplete="off" placeholder="<?php echo $mpesa_secret_saved ? '•••••••• (saved — leave blank to keep it)' : 'Paste your consumer secret'; ?>">
                                    <p class="tcwc-hint">
                                        <?php if ($mpesa_secret_saved): ?>
                                            🔒 Stored, encrypted at rest. Paste a new value to replace it, or
                                            <label style="font-weight:600;"><input type="checkbox" name="tcwc_settings[mpesa_clear_secret]" value="1"> clear it</label> on save.
                                        <?php else: ?>
                                            Also from the Daraja developer portal, alongside the Consumer Key.
                                        <?php endif; ?>
                                    </p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_mpesa_passkey">Passkey</label>
                                    <input id="tcwc_mpesa_passkey" type="password" name="tcwc_settings[mpesa_passkey]" value="" autocomplete="off" placeholder="<?php echo $mpesa_passkey_saved ? '•••••••• (saved — leave blank to keep it)' : 'Paste your Lipa Na M-Pesa passkey'; ?>">
                                    <p class="tcwc-hint">
                                        <?php if ($mpesa_passkey_saved): ?>
                                            🔒 Stored, encrypted at rest. Paste a new value to replace it, or
                                            <label style="font-weight:600;"><input type="checkbox" name="tcwc_settings[mpesa_clear_passkey]" value="1"> clear it</label> on save.
                                        <?php else: ?>
                                            The Lipa Na M-Pesa Online passkey issued alongside your shortcode.
                                        <?php endif; ?>
                                    </p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Callback URL</label>
                                    <input type="text" readonly value="<?php echo esc_attr($mpesa_callback_url); ?>" onclick="this.select();">
                                    <p class="tcwc-hint">Register this as the STK Push callback URL for your app on the Daraja portal (sandbox and live have separate registration steps).</p>
                                </div>

                                <div class="tcwc-callout <?php echo $mpesa_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>">
                                    <?php echo $mpesa_configured ? '✅ M-Pesa credentials are filled in. Test with a real STK Push before enabling on a live store.' : '⚠️ Shortcode, Consumer Key/Secret, and Passkey are all required before STK Push will work.'; ?>
                                </div>

                                <?php if ($mpesa_recent): ?>
                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">
                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Recent STK Push attempts</label>
                                    <table class="widefat striped" style="margin-top:6px;">
                                        <thead><tr><th>Time</th><th>Order</th><th>Status</th><th>Phone</th></tr></thead>
                                        <tbody>
                                        <?php foreach (array_slice($mpesa_recent, 0, 10) as $row): ?>
                                            <tr>
                                                <td><?php echo esc_html($row['time'] ?? ''); ?></td>
                                                <td>#<?php echo esc_html($row['order'] ?? ''); ?></td>
                                                <td><?php echo esc_html(ucfirst($row['status'] ?? '')); ?></td>
                                                <td><?php echo esc_html($row['phone'] ?? ''); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>

                        <div id="tcwc-panel-catalog" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Interactive catalogue &amp; templates <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.5</span></h2>
                                <p class="tcwc-card-sub">Optional. Requires Cloud API (previous tab) to be enabled and configured. Syncs your WooCommerce products into a Meta Commerce Catalog, lets customers browse categories and products right inside WhatsApp, and manages message templates for messaging outside the 24h window.</p>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_catalog_id">Meta Commerce Catalog ID</label>
                                    <input id="tcwc_catalog_id" type="text" name="tcwc_settings[catalog_id]" value="<?php echo esc_attr($catalog_id); ?>" placeholder="e.g. 1234567890123456">
                                    <p class="tcwc-hint">From Meta Commerce Manager, or Meta for Developers → your App → WhatsApp → Catalog. The catalog must already be connected to your WABA.</p>
                                </div>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Auto-sync on product save</strong>
                                        <span>Pushes a product to the catalog whenever it's created or updated, and removes it when trashed. Off by default — use "Sync now" below for the initial push either way.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[catalog_auto_sync]" value="yes" <?php checked($catalog_auto_sync, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-callout <?php echo $catalog_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>">
                                    <?php echo $catalog_configured ? '✅ Catalog ID and Cloud API token are set — ready to sync.' : '⚠️ Set a Catalog ID here and an access token in the Cloud API tab before syncing.'; ?>
                                </div>

                                <div class="tcwc-field-row">
                                    <div style="display:flex;gap:10px;align-items:center;">
                                        <button type="button" class="button button-primary" id="tcwc-catalog-sync-now">Sync all products now</button>
                                        <span id="tcwc-catalog-sync-result"></span>
                                    </div>
                                    <p class="tcwc-hint">Pushes every published, purchasable product. Large catalogs sync in batches, so this can take a moment — the result appears here when it's done.</p>
                                </div>

                                <?php if ($catalog_sync_log): ?>
                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Recent syncs</label>
                                    <table class="widefat striped" style="margin-top:6px;">
                                        <thead><tr><th>Time</th><th>Synced</th><th>Failed</th></tr></thead>
                                        <tbody>
                                        <?php foreach (array_slice($catalog_sync_log, 0, 5) as $row): ?>
                                            <tr>
                                                <td><?php echo esc_html($row['time'] ?? ''); ?></td>
                                                <td><?php echo esc_html($row['synced'] ?? 0); ?></td>
                                                <td><?php echo esc_html($row['failed'] ?? 0); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <?php endif; ?>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Interactive WhatsApp menu</h2>
                                <p class="tcwc-card-sub">When a customer messages your business number with a keyword below, they get a tappable list of categories, then a native product list (photos, prices) for the category they pick — powered by the catalog synced above.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable interactive menu</strong>
                                        <span>Replies automatically to inbound WhatsApp messages that match a keyword below.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[interactive_menu_enabled]" value="yes" <?php checked($menu_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_menu_keywords">Trigger keywords</label>
                                    <input id="tcwc_menu_keywords" type="text" name="tcwc_settings[interactive_menu_keywords]" value="<?php echo esc_attr(self::get('interactive_menu_keywords', 'menu,catalog,shop')); ?>">
                                    <p class="tcwc-hint">Comma-separated, case-insensitive. A customer sending exactly one of these words gets the category menu.</p>
                                </div>

                                <div class="tcwc-callout tcwc-callout-warn">
                                    ⚠️ Only whole-message keyword matches trigger the menu, so it never interrupts a normal conversation with a human agent.
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Message templates</h2>
                                <p class="tcwc-card-sub">Needed to message a customer outside the 24h free-form window (e.g. order and delivery notifications, planned for v0.6). Submitting a template here sends it to Meta for review — approval happens on their side and can take anywhere from minutes to a day or two.</p>

                                <div class="tcwc-field-row">
                                    <div style="display:flex;gap:10px;align-items:center;">
                                        <button type="button" class="button" id="tcwc-template-refresh">Refresh template list</button>
                                    </div>
                                    <div id="tcwc-template-list" style="margin-top:10px;"></div>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_template_name">New template name</label>
                                    <input id="tcwc_template_name" type="text" placeholder="e.g. order_confirmation">
                                    <p class="tcwc-hint">Lowercase letters, numbers and underscores only.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_template_category">Category</label>
                                    <select id="tcwc_template_category">
                                        <option value="UTILITY">Utility (order/account updates)</option>
                                        <option value="MARKETING">Marketing</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_template_language">Language code</label>
                                    <input id="tcwc_template_language" type="text" value="en_US" style="max-width:140px;">
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_template_body">Body text</label>
                                    <textarea id="tcwc_template_body" placeholder="Hi {{1}}, your order #{{2}} is confirmed and on its way!"></textarea>
                                    <p class="tcwc-hint">Use <code>{{1}}</code>, <code>{{2}}</code>, etc. for variables Meta will require you to fill in when sending.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <button type="button" class="button button-primary" id="tcwc-template-submit">Submit template for review</button>
                                    <p class="tcwc-hint" id="tcwc-template-result"></p>
                                </div>
                            </div>
                        </div>

                        <div id="tcwc-panel-automation" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Order confirmation <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.6</span></h2>
                                <p class="tcwc-card-sub">Optional. Requires Cloud API to be enabled and configured, plus a Meta-approved message template (submit one in the Catalogue tab). Sends the customer a WhatsApp confirmation the moment their WhatsApp-checkout order is received.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable order confirmation</strong>
                                        <span>Sends once per order, the moment it's created (status: On hold). Won't re-send if the order re-enters On hold later.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[automation_order_confirmation_enabled]" value="yes" <?php checked($automation_confirmation_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_confirm_template">Template name</label>
                                    <input id="tcwc_auto_confirm_template" type="text" name="tcwc_settings[automation_order_confirmation_template]" value="<?php echo esc_attr(self::get('automation_order_confirmation_template', 'order_confirmation')); ?>" placeholder="order_confirmation">
                                    <p class="tcwc-hint">Must exactly match an <strong>approved</strong> template name from the Catalogue tab.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_confirm_language">Language code</label>
                                    <input id="tcwc_auto_confirm_language" type="text" name="tcwc_settings[automation_order_confirmation_language]" value="<?php echo esc_attr(self::get('automation_order_confirmation_language', 'en_US')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    ℹ️ Your template's body must use exactly three variables, in this order: <code>{{1}}</code> customer name, <code>{{2}}</code> order number, <code>{{3}}</code> order total. Example body: <em>"Hi {{1}}, thanks for your order! #{{2}} totaling {{3}} has been received and is being processed."</em>
                                </div>

                                <div class="tcwc-callout <?php echo $automation_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                                    <?php echo $automation_configured ? '✅ Cloud API and a template name are set — confirmations will attempt to send once enabled.' : '⚠️ Set a Phone Number ID + access token in the Cloud API tab, and a template name above, before enabling.'; ?>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Payment status <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.6</span></h2>
                                <p class="tcwc-card-sub">Requires M-Pesa (M-Pesa tab) to be enabled — sends the moment Safaricom confirms or rejects an STK Push, whether that comes from the automatic callback or a manual "Recheck payment status" on the order screen.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable payment status notification</strong>
                                        <span>Sends once per result (success or failed) — won't repeat for the same outcome if checked again.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[automation_payment_status_enabled]" value="yes" <?php checked($automation_payment_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_payment_template">Template name</label>
                                    <input id="tcwc_auto_payment_template" type="text" name="tcwc_settings[automation_payment_status_template]" value="<?php echo esc_attr(self::get('automation_payment_status_template', 'payment_status')); ?>" placeholder="payment_status">
                                    <p class="tcwc-hint">Must exactly match an <strong>approved</strong> template name from the Catalogue tab.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_payment_language">Language code</label>
                                    <input id="tcwc_auto_payment_language" type="text" name="tcwc_settings[automation_payment_status_language]" value="<?php echo esc_attr(self::get('automation_payment_status_language', 'en_US')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    ℹ️ Your template's body must use exactly three variables, in this order: <code>{{1}}</code> customer name, <code>{{2}}</code> order number, <code>{{3}}</code> a status line (e.g. "Payment received — receipt ABC123" or "Payment was not completed"). Example body: <em>"Hi {{1}}, update on order #{{2}}: {{3}}"</em>.
                                </div>

                                <div class="tcwc-callout <?php echo ($automation_payment_configured && $mpesa_enabled_for_automation) ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                                    <?php if (!$mpesa_enabled_for_automation): ?>
                                        ⚠️ M-Pesa isn't enabled yet (M-Pesa tab) — there's nothing for this to react to until STK Push is turned on.
                                    <?php else: ?>
                                        <?php echo $automation_payment_configured ? '✅ Cloud API and a template name are set — payment updates will attempt to send once enabled.' : '⚠️ Set a Phone Number ID + access token in the Cloud API tab, and a template name above, before enabling.'; ?>
                                    <?php endif; ?>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Delivery notification <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.6</span></h2>
                                <p class="tcwc-card-sub">Sends when an order reaches <strong>Completed</strong>. WooCommerce has no separate "shipped" status by default — Completed is the point every store can rely on to mean "this order is done".</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable delivery notification</strong>
                                        <span>Sends once per order, the moment it's marked Completed.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[automation_delivery_enabled]" value="yes" <?php checked($automation_delivery_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_delivery_template">Template name</label>
                                    <input id="tcwc_auto_delivery_template" type="text" name="tcwc_settings[automation_delivery_template]" value="<?php echo esc_attr(self::get('automation_delivery_template', 'delivery_notification')); ?>" placeholder="delivery_notification">
                                    <p class="tcwc-hint">Must exactly match an <strong>approved</strong> template name from the Catalogue tab.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_delivery_language">Language code</label>
                                    <input id="tcwc_auto_delivery_language" type="text" name="tcwc_settings[automation_delivery_language]" value="<?php echo esc_attr(self::get('automation_delivery_language', 'en_US')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    ℹ️ Your template's body must use exactly two variables, in this order: <code>{{1}}</code> customer name, <code>{{2}}</code> order number. Example body: <em>"Hi {{1}}, your order #{{2}} is complete — thanks for shopping with us!"</em>.
                                </div>

                                <div class="tcwc-callout <?php echo $automation_delivery_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                                    <?php echo $automation_delivery_configured ? '✅ Cloud API and a template name are set — delivery notifications will attempt to send once enabled.' : '⚠️ Set a Phone Number ID + access token in the Cloud API tab, and a template name above, before enabling.'; ?>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Abandoned order recovery <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.6</span></h2>
                                <p class="tcwc-card-sub">Every WhatsApp-checkout submission creates a real On hold order immediately — there's no separate "cart" to abandon. So this checks for orders that have sat On hold with no activity past the threshold below (the customer never sent the WhatsApp message, went quiet, or bailed on the M-Pesa prompt) and sends <strong>one</strong> reminder with a link to finish paying. Runs on an hourly background check.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable abandoned order recovery</strong>
                                        <span>One reminder per order, ever — never repeats.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[automation_abandoned_cart_enabled]" value="yes" <?php checked($automation_abandoned_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_abandoned_hours">Wait before nudging (hours)</label>
                                    <input id="tcwc_auto_abandoned_hours" type="number" min="1" step="1" name="tcwc_settings[automation_abandoned_cart_hours]" value="<?php echo esc_attr(self::get('automation_abandoned_cart_hours', 6)); ?>" style="max-width:100px;">
                                    <p class="tcwc-hint">How long an order can sit On hold with no payment result before it's considered abandoned. 6 hours is a reasonable default.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_abandoned_template">Template name</label>
                                    <input id="tcwc_auto_abandoned_template" type="text" name="tcwc_settings[automation_abandoned_cart_template]" value="<?php echo esc_attr(self::get('automation_abandoned_cart_template', 'abandoned_cart')); ?>" placeholder="abandoned_cart">
                                    <p class="tcwc-hint">Must exactly match an <strong>approved</strong> template name from the Catalogue tab.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_abandoned_language">Language code</label>
                                    <input id="tcwc_auto_abandoned_language" type="text" name="tcwc_settings[automation_abandoned_cart_language]" value="<?php echo esc_attr(self::get('automation_abandoned_cart_language', 'en_US')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    ℹ️ Your template's body must use exactly three variables, in this order: <code>{{1}}</code> customer name, <code>{{2}}</code> order number, <code>{{3}}</code> a payment link (WhatsApp auto-links plain URLs in message text, so no button component is needed). Example body: <em>"Hi {{1}}, your order #{{2}} is still waiting — finish it here: {{3}}"</em>.
                                </div>

                                <div class="tcwc-callout <?php echo $automation_abandoned_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                                    <?php echo $automation_abandoned_configured ? '✅ Cloud API and a template name are set — the hourly check will attempt to send once enabled.' : '⚠️ Set a Phone Number ID + access token in the Cloud API tab, and a template name above, before enabling.'; ?>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Back-in-stock alerts <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.6</span></h2>
                                <p class="tcwc-card-sub">When enabled, an out-of-stock product page shows a "Notify me when back in stock" form (just a phone number) in place of the order button. The moment the product's stock status flips back to In stock, everyone who asked gets a WhatsApp message — once each. <strong>Scoped to the product's own stock status</strong>: a specific variation (e.g. one size/colour) coming back while the rest stay out isn't covered yet.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable back-in-stock alerts</strong>
                                        <span>Shows the notify-me form on out-of-stock products; sends once per subscriber when restocked.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[automation_back_in_stock_enabled]" value="yes" <?php checked($automation_stock_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_stock_template">Template name</label>
                                    <input id="tcwc_auto_stock_template" type="text" name="tcwc_settings[automation_back_in_stock_template]" value="<?php echo esc_attr(self::get('automation_back_in_stock_template', 'back_in_stock')); ?>" placeholder="back_in_stock">
                                    <p class="tcwc-hint">Must exactly match an <strong>approved</strong> template name from the Catalogue tab.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_auto_stock_language">Language code</label>
                                    <input id="tcwc_auto_stock_language" type="text" name="tcwc_settings[automation_back_in_stock_language]" value="<?php echo esc_attr(self::get('automation_back_in_stock_language', 'en_US')); ?>" style="max-width:140px;">
                                </div>

                                <div class="tcwc-callout tcwc-callout-info">
                                    ℹ️ Your template's body must use exactly three variables, in this order: <code>{{1}}</code> a generic greeting ("there" — we don't collect a name for this form), <code>{{2}}</code> product name, <code>{{3}}</code> product link. Example body: <em>"Hi {{1}}, good news — {{2}} is back in stock: {{3}}"</em>.
                                </div>

                                <div class="tcwc-callout <?php echo $automation_stock_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                                    <?php echo $automation_stock_configured ? '✅ Cloud API and a template name are set — restocks will attempt to notify subscribers once enabled.' : '⚠️ Set a Phone Number ID + access token in the Cloud API tab, and a template name above, before enabling.'; ?>
                                </div>

                                <?php if ($automation_log): ?>
                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">
                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Recent sends</label>
                                    <table class="widefat striped" style="margin-top:6px;">
                                        <thead><tr><th>Time</th><th>Event</th><th>Order</th><th>Status</th><th>Detail</th></tr></thead>
                                        <tbody>
                                        <?php foreach (array_slice($automation_log, 0, 10) as $row): ?>
                                            <tr>
                                                <td><?php echo esc_html($row['time'] ?? ''); ?></td>
                                                <td><?php echo esc_html($row['event'] ?? ''); ?></td>
                                                <td>#<?php echo esc_html($row['order'] ?? ''); ?></td>
                                                <td><?php echo esc_html(ucfirst($row['status'] ?? '')); ?></td>
                                                <td><?php echo esc_html($row['detail'] ?? ''); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <?php endif; ?>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">
                                <p class="tcwc-hint">All five v0.6 automation milestones are live, alongside the v0.7 AI shopping assistant (see the AI Assistant tab).</p>
                            </div>
                        </div>

                        <div id="tcwc-panel-ai" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>AI shopping assistant <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.7</span></h2>
                                <p class="tcwc-card-sub">Optional. When a customer sends your WhatsApp number a plain-text message that isn't a menu keyword or a saved reply, this reads it, searches your products, and replies — or hands the conversation to a person when it should. Requires Cloud API to be enabled and configured (for sending replies) and an Anthropic API key below.</p>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Enable AI assistant</strong>
                                        <span>Handles free-text WhatsApp messages with natural-language product search and human hand-off.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[ai_assistant_enabled]" value="yes" <?php checked($ai_enabled, true); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_api_key">Anthropic API key</label>
                                    <input id="tcwc_ai_api_key" type="password" name="tcwc_settings[ai_api_key]" value="" autocomplete="off" placeholder="<?php echo $ai_key_saved ? '•••••••• (saved — leave blank to keep it)' : 'sk-ant-...'; ?>">
                                    <p class="tcwc-hint">
                                        <?php if ($ai_key_saved): ?>
                                            🔒 Stored, encrypted at rest. Paste a new key to replace it, or
                                            <label style="font-weight:600;"><input type="checkbox" name="tcwc_settings[ai_clear_api_key]" value="1"> clear it</label> on save.
                                        <?php else: ?>
                                            From your Anthropic Console account. This key is billed by Anthropic directly for each message the assistant processes.
                                        <?php endif; ?>
                                    </p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_model">Model</label>
                                    <input id="tcwc_ai_model" type="text" name="tcwc_settings[ai_model]" value="<?php echo esc_attr(self::get('ai_model')); ?>" placeholder="e.g. claude-sonnet-4-5-20250929">
                                    <p class="tcwc-hint">The exact model string from Anthropic's current model list — check <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" rel="noopener">docs.anthropic.com</a> for the latest, since this changes over time and isn't hardcoded here.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_instructions">Store voice / extra instructions <span style="text-transform:none;font-weight:400;">(optional)</span></label>
                                    <textarea id="tcwc_ai_instructions" name="tcwc_settings[ai_store_instructions]" placeholder="e.g. We're a small handmade-jewellery shop in Nairobi — keep replies warm and brief."><?php echo esc_textarea(self::get('ai_store_instructions')); ?></textarea>
                                    <p class="tcwc-hint">Appended to the assistant's instructions. Doesn't change what it's allowed to do (product search / hand-off), just its tone and any store-specific context.</p>
                                </div>

                                <div class="tcwc-callout <?php echo $ai_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>">
                                    <?php echo $ai_configured ? '✅ API key and model are set — test it below before enabling on a live number.' : '⚠️ An API key and model are both required before the assistant will respond to anything.'; ?>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <h2>Human hand-off</h2>
                                <p class="tcwc-card-sub">The assistant never tries to resolve everything itself — these control when it steps back and lets a person take over. Once handed off, the bot stays silent on that conversation for a few days, or until the customer asks for the menu again.</p>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_handoff_keywords">Hand-off keywords</label>
                                    <input id="tcwc_ai_handoff_keywords" type="text" name="tcwc_settings[ai_handoff_keywords]" value="<?php echo esc_attr(self::get('ai_handoff_keywords', 'agent,human,help,talk to someone,speak to someone')); ?>">
                                    <p class="tcwc-hint">Comma-separated. A message containing any of these (as a substring, case-insensitive) hands off immediately — the AI's own judgement (frustration, complaints, order issues) can also trigger a hand-off even without one of these words.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_handoff_failures">Auto hand-off after this many unclear replies in a row</label>
                                    <input id="tcwc_ai_handoff_failures" type="number" min="1" step="1" name="tcwc_settings[ai_handoff_after_failures]" value="<?php echo esc_attr(self::get('ai_handoff_after_failures', 2)); ?>" style="max-width:100px;">
                                    <p class="tcwc-hint">Counts within a rolling hour — a customer the bot clearly isn't helping gets a person instead of more misses.</p>
                                </div>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label" for="tcwc_ai_handoff_notice">Hand-off message to the customer</label>
                                    <textarea id="tcwc_ai_handoff_notice" name="tcwc_settings[ai_handoff_notice]"><?php echo esc_textarea(self::get('ai_handoff_notice', "Got it — connecting you with a person from our team. They'll be with you shortly.")); ?></textarea>
                                </div>

                                <div class="tcwc-toggle-row">
                                    <div class="tcwc-toggle-copy">
                                        <strong>Notify me on WhatsApp when a hand-off happens</strong>
                                        <span>Sends to your own number (set in the Cloud API tab) with who it was and why.</span>
                                    </div>
                                    <label class="tcwc-switch">
                                        <input type="checkbox" name="tcwc_settings[ai_notify_admin_on_handoff]" value="yes" <?php checked(self::get('ai_notify_admin_on_handoff', 'no'), 'yes'); ?>>
                                        <span class="tcwc-switch-track"></span>
                                    </label>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Test a message</label>
                                    <p class="tcwc-card-sub" style="margin-top:-4px;">Runs a sample message through the assistant — shows how it would be classified and, for a product search, which products would be returned. Nothing is sent over WhatsApp.</p>
                                    <textarea id="tcwc-ai-test-input" placeholder="e.g. show me black dresses under 3,000"></textarea>
                                    <div style="margin-top:10px;">
                                        <button type="button" class="button button-primary" id="tcwc-ai-test-run">Run test</button>
                                    </div>
                                    <div id="tcwc-ai-test-result" style="margin-top:12px;"></div>
                                </div>

                                <?php if ($ai_conversation_log): ?>
                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">
                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Recent conversations</label>
                                    <table class="widefat striped" style="margin-top:6px;">
                                        <thead><tr><th>Time</th><th>Phone</th><th>Intent</th><th>Detail</th></tr></thead>
                                        <tbody>
                                        <?php foreach (array_slice($ai_conversation_log, 0, 10) as $row): ?>
                                            <tr>
                                                <td><?php echo esc_html($row['time'] ?? ''); ?></td>
                                                <td><?php echo esc_html($row['phone'] ?? ''); ?></td>
                                                <td><?php echo esc_html(ucfirst(str_replace('_', ' ', $row['intent'] ?? ''))); ?></td>
                                                <td><?php echo esc_html($row['detail'] ?? ''); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>

                        <div id="tcwc-panel-staff" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Staff accounts <span class="tcwc-roadmap-badge next" style="margin-left:6px;">New in v0.8</span></h2>
                                <p class="tcwc-card-sub">Add teammates who handle orders and WhatsApp hand-offs without giving them full WordPress admin access. They get a dedicated <strong>WhatsApp Orders</strong> dashboard (its own "WhatsApp Commerce" sidebar item — Orders is all they'll see there) where they can claim orders, recheck M-Pesa payments, mark orders complete, and resolve conversations waiting for a person — but not this Settings screen, plugins, themes, or other WooCommerce settings.</p>

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Add a staff member</label>
                                    <div style="display:flex;gap:10px;flex-wrap:wrap;max-width:560px;">
                                        <input type="text" id="tcwc-staff-name" placeholder="Name" style="flex:1 1 160px;">
                                        <input type="email" id="tcwc-staff-email" placeholder="email@example.com" style="flex:2 1 240px;">
                                        <button type="button" class="button button-primary" id="tcwc-staff-add">Add staff</button>
                                    </div>
                                    <p class="tcwc-hint">If that email doesn't already have a WordPress account, one is created and they're emailed a link to set their own password. An existing account is simply granted the WhatsApp Staff role.</p>
                                    <p class="tcwc-hint" id="tcwc-staff-add-result"></p>
                                </div>

                                <hr style="border:none;border-top:1px solid var(--tcwc-gray-100);margin:22px 0;">

                                <div class="tcwc-field-row">
                                    <label class="tcwc-label">Current staff</label>
                                    <table class="widefat striped" id="tcwc-staff-table" style="margin-top:6px;max-width:640px;">
                                        <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                                        <tbody>
                                        <?php if (!$staff_users): ?>
                                            <tr><td colspan="3">No staff added yet.</td></tr>
                                        <?php endif; ?>
                                        <?php foreach ($staff_users as $staff): ?>
                                            <tr data-user-id="<?php echo esc_attr($staff->ID); ?>">
                                                <td><?php echo esc_html($staff->display_name); ?></td>
                                                <td><?php echo esc_html($staff->user_email); ?></td>
                                                <td><button type="button" class="button-link tcwc-staff-remove" data-user-id="<?php echo esc_attr($staff->ID); ?>" style="color:var(--tcwc-red);">Remove</button></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>

                                <div class="tcwc-callout tcwc-callout-info" style="margin-top:16px;">
                                    ℹ️ "Remove" only takes away the WhatsApp Staff role — it doesn't delete their WordPress account, so nothing else they might do on the site is affected.
                                </div>

                                <div class="tcwc-field-row" style="margin-top:6px;">
                                    <a href="<?php echo esc_url(admin_url('admin.php?page=tcwc-orders')); ?>" class="button">Open the WhatsApp Orders dashboard →</a>
                                </div>
                            </div>
                        </div>

                        <div id="tcwc-panel-roadmap" class="tcwc-panel">
                            <div class="tcwc-card">
                                <h2>Where this is heading</h2>
                                <p class="tcwc-card-sub">Built to grow from a click-to-chat button into a full WhatsApp commerce platform.</p>

                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.2</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Modal checkout &amp; branded UI</strong>
                                        <span>Redesigned storefront buttons, modal checkout flow, and this settings screen.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.3</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Official WhatsApp Cloud API</strong>
                                        <span>Webhook receiver, signature verification, and business-initiated admin notifications alongside the existing click-to-chat flow.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.4</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>M-Pesa STK Push</strong>
                                        <span>Payment prompt straight to the customer's phone from the checkout modal, tied to the same WooCommerce order, with an order-screen "recheck payment status" fallback.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.5</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Interactive WhatsApp catalogue</strong>
                                        <span>Meta Commerce Catalog sync, an in-chat category → product browsing menu, and message-template submission for notifications outside the 24h window. See the Catalogue tab.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.6</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Automation</strong>
                                        <span>Order confirmation, payment status, delivery, abandoned-order recovery, and back-in-stock alerts — all live in the Automation tab.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.7</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>AI shopping assistant</strong>
                                        <span>Natural-language product search ("show me black dresses under 3,000"), a direct reply for anything else, and hand-off to a person — on top of the existing static menu, catalogue, and click-to-chat flows. See the AI Assistant tab.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge shipped">Shipped · v0.8</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Staff accounts &amp; order management</strong>
                                        <span>A limited "WhatsApp Staff" role, a dedicated WhatsApp Orders dashboard with order claiming, quick actions, and an AI hand-off queue — the same shape as dedicated WhatsApp team-inbox tools, scoped to a single WordPress plugin. See the Staff tab.</span>
                                    </div>
                                </div>
                                <div class="tcwc-roadmap-item">
                                    <span class="tcwc-roadmap-badge later">Ideas · not scheduled</span>
                                    <div class="tcwc-roadmap-copy">
                                        <strong>Full in-app WhatsApp chat inbox</strong>
                                        <span>Reading and replying to WhatsApp conversations directly from wp-admin, rather than opening WhatsApp itself — the next step up from the claim/hand-off model above, closer to what dedicated tools like WATI or ChatDaddy offer. Meaningfully larger scope (needs message storage, a live inbox UI, and read-receipt/typing handling) — worth a separate conversation before starting.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- Live preview -->
                    <div class="tcwc-preview">
                        <p class="tcwc-preview-label">Live preview</p>
                        <div class="tcwc-phone">
                            <div class="tcwc-phone-bar">
                                <span class="tcwc-phone-bar-avatar"></span>
                                <span id="tcwc-preview-number"><?php echo $is_connected ? 'wa.me/' . esc_html($phone) : 'No number set yet'; ?></span>
                            </div>
                            <div class="tcwc-phone-screen">
                                <div class="tcwc-bubble" id="tcwc-preview-bubble"></div>
                                <div class="tcwc-bubble-time">Sent from your store</div>
                            </div>
                        </div>
                        <?php if ($cloud_enabled): ?>
                        <div class="tcwc-callout <?php echo $cloud_configured ? 'tcwc-callout-info' : 'tcwc-callout-warn'; ?>" style="margin-top:12px;">
                            <?php echo $cloud_configured ? '☁️ Cloud API is enabled and configured.' : '☁️ Cloud API is enabled but missing a Phone Number ID or access token.'; ?>
                        </div>
                        <?php endif; ?>
                    </div>

                </div>

                <div class="tcwc-save-bar">
                    <?php submit_button('Save WhatsApp Commerce Settings', 'primary', 'submit', false, ['class' => 'tcwc-save-btn']); ?>
                </div>
            </form>
        </div>
        <?php
    }
}
