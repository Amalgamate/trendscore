<?php
/**
 * Plugin Name: Trends CORE WhatsApp Commerce
 * Description: WhatsApp-first shopping for WooCommerce: variable-product selection, cart, checkout-to-WhatsApp, WooCommerce order creation, and order tracking foundation.
 * Version: 0.8.5
 * Author: Trends CORE
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Text Domain: trendscore-whatsapp-commerce
 */

if (!defined('ABSPATH')) exit;

define('TCWC_VERSION', '0.8.5');
define('TCWC_PATH', plugin_dir_path(__FILE__));
define('TCWC_URL', plugin_dir_url(__FILE__));

require_once TCWC_PATH . 'includes/class-tcwc-settings.php';
require_once TCWC_PATH . 'includes/class-tcwc-storefront.php';
require_once TCWC_PATH . 'includes/class-tcwc-order.php';
require_once TCWC_PATH . 'includes/class-tcwc-cloud-api.php';
require_once TCWC_PATH . 'includes/class-tcwc-mpesa.php';
require_once TCWC_PATH . 'includes/class-tcwc-catalog.php';
require_once TCWC_PATH . 'includes/class-tcwc-automation.php';
require_once TCWC_PATH . 'includes/class-tcwc-ai-assistant.php';
require_once TCWC_PATH . 'includes/class-tcwc-staff.php';
require_once TCWC_PATH . 'includes/class-tcwc-inbox.php';

/**
 * Phase 0 hardening: declare HPOS (High-Performance Order Storage) compatibility
 * explicitly. Order creation already only uses wc_create_order()/$order->save(),
 * which is HPOS-safe, but WooCommerce still shows an "unknown compatibility"
 * warning in the plugins list until a plugin declares itself either way.
 */
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>Trends CORE WhatsApp Commerce</strong> requires WooCommerce to be installed and active.</p></div>';
        });
        return;
    }

    // The Staff module registers the `tcwc-orders` top-level menu. It must
    // register before Settings (or Inbox) add their child pages, otherwise
    // WordPress stores the callback under the wrong admin-page hook and the
    // link 404s.
    TCWC_Staff::init();
    TCWC_Inbox::init();
    TCWC_Settings::init();
    TCWC_Storefront::init();
    TCWC_Order::init();
    TCWC_Cloud_API::init();
    TCWC_Mpesa::init();
    TCWC_Catalog::init();
    TCWC_Automation::init();
    TCWC_AI_Assistant::init();
});

register_activation_hook(__FILE__, function () {
    if (class_exists('TCWC_Staff')) {
        TCWC_Staff::ensure_role_and_caps();
    }
    if (get_option('tcwc_settings', null) === null) {
        add_option('tcwc_settings', array(
            'phone' => '',
            'button_text' => 'Order on WhatsApp',
            'button_size' => 'medium',
            'show_product_button' => 'yes',
            'show_cart_button' => 'yes',
            'create_order' => 'yes',
            'currency_prefix' => 'KES ',
            'message_intro' => 'Hello! I would like to order:',
            'floating_button_enabled' => 'yes',
            'floating_button_position' => 'right',
            'floating_button_message' => 'Hi! I have a question about your products.',
            'cloud_api_enabled' => 'no',
            'cloud_api_phone_number_id' => '',
            'cloud_api_waba_id' => '',
            'cloud_api_access_token' => '',
            'cloud_api_app_secret' => '',
            'cloud_api_verify_token' => '',
            'cloud_api_notify_admin' => 'no',
            'cloud_api_admin_number' => '',
            'mpesa_enabled' => 'no',
            'mpesa_environment' => 'sandbox',
            'mpesa_shortcode' => '',
            'mpesa_shortcode_type' => 'paybill',
            'mpesa_consumer_key' => '',
            'mpesa_consumer_secret' => '',
            'mpesa_passkey' => '',
            'catalog_id' => '',
            'catalog_auto_sync' => 'no',
            'interactive_menu_enabled' => 'no',
            'interactive_menu_keywords' => 'menu,catalog,shop',
            'automation_order_confirmation_enabled' => 'no',
            'automation_order_confirmation_template' => 'order_confirmation',
            'automation_order_confirmation_language' => 'en_US',
            'automation_payment_status_enabled' => 'no',
            'automation_payment_status_template' => 'payment_status',
            'automation_payment_status_language' => 'en_US',
            'automation_delivery_enabled' => 'no',
            'automation_delivery_template' => 'delivery_notification',
            'automation_delivery_language' => 'en_US',
            'automation_abandoned_cart_enabled' => 'no',
            'automation_abandoned_cart_template' => 'abandoned_cart',
            'automation_abandoned_cart_language' => 'en_US',
            'automation_abandoned_cart_hours' => 6,
            'automation_back_in_stock_enabled' => 'no',
            'automation_back_in_stock_template' => 'back_in_stock',
            'automation_back_in_stock_language' => 'en_US',
            'ai_assistant_enabled' => 'no',
            'ai_api_key' => '',
            'ai_model' => '',
            'ai_handoff_keywords' => 'agent,human,help,talk to someone,speak to someone',
            'ai_handoff_after_failures' => 2,
            'ai_handoff_notice' => "Got it — connecting you with a person from our team. They'll be with you shortly.",
            'ai_notify_admin_on_handoff' => 'no',
            'ai_store_instructions' => '',
        ));
    }
});

register_deactivation_hook(__FILE__, function () {
    // Clean up the self-healing abandoned-order cron (see class-tcwc-automation.php)
    // so it doesn't keep firing after the plugin is switched off.
    wp_clear_scheduled_hook('tcwc_abandoned_cart_check');
});
