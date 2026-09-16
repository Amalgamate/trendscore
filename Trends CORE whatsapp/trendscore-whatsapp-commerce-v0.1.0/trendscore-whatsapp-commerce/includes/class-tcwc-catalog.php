<?php
if (!defined('ABSPATH')) exit;

/**
 * v0.5: Interactive WhatsApp catalogue.
 *
 * Three additive pieces, all opt-in and all requiring Cloud API to already
 * be enabled and configured (see class-tcwc-cloud-api.php):
 *
 *  1. Catalog sync — pushes WooCommerce products into a connected Meta
 *     Commerce Catalog via the Graph API items_batch endpoint, either on
 *     demand ("Sync now") or automatically on product save/trash.
 *  2. Interactive menu — listens for inbound webhook messages (via the
 *     `tcwc_inbound_message` action fired from TCWC_Cloud_API::handle_event())
 *     and replies with a native WhatsApp list of categories, then a native
 *     WhatsApp product-list message for the chosen category, using the
 *     catalog synced in (1).
 *  3. Message templates — list existing templates and submit new ones for
 *     Meta review, needed to message a customer outside the 24h free-form
 *     window (e.g. order/delivery notifications planned for v0.6).
 *
 * Nothing here runs unless Catalog ID + Cloud API credentials are set, so a
 * store that never touches this tab is completely unaffected.
 */
class TCWC_Catalog {

    const GRAPH_VERSION = 'v21.0';
    const SYNC_BATCH_SIZE = 50;
    const LIST_ROW_LIMIT = 10; // WhatsApp interactive list messages cap out at 10 rows per section.

    public static function init() {
        add_action('wp_ajax_tcwc_catalog_sync_all', [__CLASS__, 'ajax_sync_all']);
        add_action('wp_ajax_tcwc_catalog_list_templates', [__CLASS__, 'ajax_list_templates']);
        add_action('wp_ajax_tcwc_catalog_create_template', [__CLASS__, 'ajax_create_template']);

        // Keep the catalog fresh as products change, only if auto-sync is on.
        add_action('woocommerce_update_product', [__CLASS__, 'maybe_sync_product']);
        add_action('woocommerce_new_product', [__CLASS__, 'maybe_sync_product']);
        add_action('wp_trash_post', [__CLASS__, 'maybe_remove_product']);

        // Fired by TCWC_Cloud_API::handle_event() for every inbound message.
        add_action('tcwc_inbound_message', [__CLASS__, 'handle_inbound'], 10, 2);
    }

    /* ---------------------------------------------------------------------
     * Config helpers
     * ------------------------------------------------------------------- */

    private static function is_catalog_configured() {
        return (bool) (TCWC_Settings::get('cloud_api_access_token') && TCWC_Settings::get('catalog_id'));
    }

    private static function is_menu_enabled() {
        return TCWC_Settings::get('interactive_menu_enabled', 'no') === 'yes' && self::is_catalog_configured();
    }

    /* ---------------------------------------------------------------------
     * Catalog sync
     * ------------------------------------------------------------------- */

    public static function maybe_sync_product($product_id) {
        if (TCWC_Settings::get('catalog_auto_sync', 'no') !== 'yes') return;
        if (!self::is_catalog_configured()) return;
        $product = wc_get_product($product_id);
        if (!$product) return;
        self::push_product($product);
    }

    public static function maybe_remove_product($post_id) {
        if (get_post_type($post_id) !== 'product') return;
        if (TCWC_Settings::get('catalog_auto_sync', 'no') !== 'yes') return;
        if (!self::is_catalog_configured()) return;
        self::remove_product($post_id);
    }

    /** Builds the Meta Commerce Catalog payload for one product. */
    private static function product_payload($product) {
        $retailer_id = $product->get_sku() ?: ('wc_' . $product->get_id());
        $image_id = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'full') : wc_placeholder_img_src();
        $availability = $product->is_in_stock() ? 'in stock' : 'out of stock';
        $price_minor = (int) round((float) wc_get_price_to_display($product) * 100);
        $currency = get_woocommerce_currency();
        $description = wp_strip_all_tags($product->get_short_description() ?: $product->get_description());

        return [
            'retailer_id'  => $retailer_id,
            'name'         => $product->get_name(),
            'description'  => $description ?: $product->get_name(),
            'availability' => $availability,
            'condition'    => 'new',
            'price'        => $price_minor . ' ' . $currency,
            'link'         => get_permalink($product->get_id()),
            'image_link'   => $image_url ?: '',
            'brand'        => get_bloginfo('name'),
        ];
    }

    /** Pushes (creates/updates) a single product into the connected catalog. Used by the auto-sync hooks. */
    public static function push_product($product) {
        if (!self::is_catalog_configured()) {
            return new WP_Error('tcwc_catalog_not_configured', 'Connect a Cloud API access token and Catalog ID first.');
        }

        $url = self::items_batch_url();
        $request = [
            'item_type' => 'PRODUCT_ITEM',
            'requests'  => [
                ['method' => 'UPDATE', 'data' => self::product_payload($product)],
            ],
        ];

        return self::graph_post($url, TCWC_Settings::get('cloud_api_access_token'), $request);
    }

    /** Removes a product from the catalog (e.g. when trashed). */
    public static function remove_product($product_id) {
        if (!self::is_catalog_configured()) return;

        $product = wc_get_product($product_id);
        $retailer_id = $product ? ($product->get_sku() ?: ('wc_' . $product_id)) : ('wc_' . $product_id);

        $request = [
            'item_type' => 'PRODUCT_ITEM',
            'requests'  => [
                ['method' => 'DELETE', 'data' => ['retailer_id' => $retailer_id]],
            ],
        ];

        return self::graph_post(self::items_batch_url(), TCWC_Settings::get('cloud_api_access_token'), $request);
    }

    private static function items_batch_url() {
        return 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . rawurlencode(TCWC_Settings::get('catalog_id')) . '/items_batch';
    }

    /** Full sync: every published, purchasable product, batched to stay under Graph API request-size limits. */
    public static function sync_all() {
        if (!self::is_catalog_configured()) {
            return new WP_Error('tcwc_catalog_not_configured', 'Connect a Cloud API access token and Catalog ID first.');
        }
        if (!function_exists('wc_get_products')) {
            return new WP_Error('tcwc_woocommerce_unavailable', 'WooCommerce is unavailable.');
        }

        $url = self::items_batch_url();
        $token = TCWC_Settings::get('cloud_api_access_token');

        $product_ids = wc_get_products(['status' => 'publish', 'limit' => -1, 'return' => 'ids']);
        $synced = 0;
        $failed = 0;

        foreach (array_chunk($product_ids, self::SYNC_BATCH_SIZE) as $chunk) {
            $requests = [];
            foreach ($chunk as $pid) {
                $product = wc_get_product($pid);
                if (!$product || !$product->is_purchasable()) continue;
                $requests[] = ['method' => 'UPDATE', 'data' => self::product_payload($product)];
            }
            if (!$requests) continue;

            $result = self::graph_post($url, $token, ['item_type' => 'PRODUCT_ITEM', 'requests' => $requests]);
            if (is_wp_error($result)) {
                $failed += count($requests);
            } else {
                $synced += count($requests);
            }
        }

        self::log_sync($synced, $failed);
        return ['synced' => $synced, 'failed' => $failed];
    }

    private static function log_sync($synced, $failed) {
        $log = get_option('tcwc_catalog_sync_log', []);
        array_unshift($log, ['time' => current_time('mysql'), 'synced' => $synced, 'failed' => $failed]);
        update_option('tcwc_catalog_sync_log', array_slice($log, 0, 10), false);
    }

    public static function ajax_sync_all() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $result = self::sync_all();
        if (is_wp_error($result)) wp_send_json_error(['message' => $result->get_error_message()], 400);

        wp_send_json_success(['message' => sprintf('Synced %d product(s), %d failed.', $result['synced'], $result['failed'])]);
    }

    /* ---------------------------------------------------------------------
     * Interactive menu — category list -> product list, driven by inbound
     * webhook events. No session state is kept: every reply is
     * self-describing (its id tells us exactly what was tapped), so a
     * restart or multi-server setup can't lose context mid-conversation.
     * ------------------------------------------------------------------- */

    public static function handle_inbound($message, $value) {
        if (!self::is_menu_enabled()) return;

        $from = $message['from'] ?? '';
        if (!$from) return;

        $interactive = $message['interactive'] ?? null;
        if ($interactive) {
            $reply_id = $interactive['list_reply']['id'] ?? ($interactive['button_reply']['id'] ?? '');

            if (strpos($reply_id, 'tcwc_cat_') === 0) {
                self::send_products_for_category($from, (int) substr($reply_id, strlen('tcwc_cat_')));
            } elseif ($reply_id === 'tcwc_menu_more') {
                self::send_category_menu($from);
            }
            return;
        }

        // Plain text: only react to an explicit keyword, so the bot never
        // hijacks an otherwise human back-and-forth conversation.
        $text = strtolower(trim($message['text']['body'] ?? ''));
        if (!$text) return;

        $keywords = array_filter(array_map('trim', explode(',', strtolower(
            TCWC_Settings::get('interactive_menu_keywords', 'menu,catalog,shop')
        ))));

        if (in_array($text, $keywords, true)) {
            self::send_category_menu($from);
        }
    }

    /** Sends an interactive WhatsApp list message of top-level product categories. */
    public static function send_category_menu($to) {
        $terms = get_terms([
            'taxonomy'   => 'product_cat',
            'hide_empty' => true,
            'parent'     => 0,
            'number'     => self::LIST_ROW_LIMIT,
        ]);

        if (is_wp_error($terms) || !$terms) {
            self::send_text_fallback($to, 'Our catalogue isn\'t set up yet — tell us what you\'re looking for and we\'ll help directly.');
            return;
        }

        $rows = [];
        foreach ($terms as $term) {
            $rows[] = [
                'id'          => 'tcwc_cat_' . $term->term_id,
                'title'       => wp_html_excerpt($term->name, 24, ''),
                'description' => wp_html_excerpt($term->description ?: sprintf('%d item(s)', $term->count), 72, ''),
            ];
        }

        self::send_interactive([
            'messaging_product' => 'whatsapp',
            'to'                => $to,
            'type'              => 'interactive',
            'interactive'       => [
                'type'   => 'list',
                'header' => ['type' => 'text', 'text' => get_bloginfo('name')],
                'body'   => ['text' => 'Browse our categories below and tap one to see products.'],
                'footer' => ['text' => 'Reply "menu" anytime to see this again.'],
                'action' => [
                    'button'   => 'View categories',
                    'sections' => [['title' => 'Categories', 'rows' => $rows]],
                ],
            ],
        ]);
    }

    /**
     * Sends products in a category as a native WhatsApp product-list message,
     * referencing the connected catalog (so it shows real photos, prices and
     * an in-chat "Add to cart" — the actual payoff of syncing the catalog).
     */
    public static function send_products_for_category($to, $term_id) {
        $term = get_term($term_id, 'product_cat');
        if (!$term || is_wp_error($term)) {
            self::send_text_fallback($to, 'That category is no longer available — reply "menu" to see current categories.');
            return;
        }

        $products = wc_get_products([
            'category' => [$term->slug],
            'status'   => 'publish',
            'limit'    => self::LIST_ROW_LIMIT,
        ]);

        $items = [];
        foreach ($products as $product) {
            if (!$product->is_purchasable()) continue;
            $items[] = ['product_retailer_id' => $product->get_sku() ?: ('wc_' . $product->get_id())];
        }

        if (!$items) {
            self::send_text_fallback($to, 'No products are available in "' . $term->name . '" right now — reply "menu" to try another category.');
            return;
        }

        self::send_interactive([
            'messaging_product' => 'whatsapp',
            'to'                => $to,
            'type'              => 'interactive',
            'interactive'       => [
                'type'   => 'product_list',
                'header' => ['type' => 'text', 'text' => wp_html_excerpt($term->name, 60, '')],
                'body'   => ['text' => 'Tap a product to view details and price, or add it to your order.'],
                'footer' => ['text' => 'Reply "menu" to browse another category.'],
                'action' => [
                    'catalog_id' => TCWC_Settings::get('catalog_id'),
                    'sections'   => [
                        ['title' => wp_html_excerpt($term->name, 24, ''), 'product_items' => $items],
                    ],
                ],
            ],
        ]);
    }

    private static function send_interactive($payload) {
        if (class_exists('TCWC_Cloud_API')) {
            TCWC_Cloud_API::send_raw($payload);
        }
    }

    private static function send_text_fallback($to, $text) {
        if (class_exists('TCWC_Cloud_API')) {
            TCWC_Cloud_API::send_text($to, $text);
        }
    }

    /* ---------------------------------------------------------------------
     * Message templates — needed to message a customer business-initiated
     * outside the 24h free-form window (order/delivery notifications, etc).
     * Creating a template only submits it for Meta review; approval itself
     * happens on Meta's side and can't be done from here.
     * ------------------------------------------------------------------- */

    public static function list_templates() {
        $waba_id = TCWC_Settings::get('cloud_api_waba_id');
        $token = TCWC_Settings::get('cloud_api_access_token');
        if (!$waba_id || !$token) {
            return new WP_Error('tcwc_templates_not_configured', 'Enter your WhatsApp Business Account ID and access token in the Cloud API tab first.');
        }

        $url = 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . rawurlencode($waba_id)
            . '/message_templates?fields=' . rawurlencode('name,status,category,language') . '&limit=50';

        $response = wp_remote_get($url, ['timeout' => 15, 'headers' => ['Authorization' => 'Bearer ' . $token]]);
        if (is_wp_error($response)) return $response;

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300) return $body['data'] ?? [];

        return new WP_Error('tcwc_templates_failed', $body['error']['message'] ?? ('HTTP ' . $code));
    }

    public static function create_template($name, $category, $language, $body_text) {
        $waba_id = TCWC_Settings::get('cloud_api_waba_id');
        $token = TCWC_Settings::get('cloud_api_access_token');
        if (!$waba_id || !$token) {
            return new WP_Error('tcwc_templates_not_configured', 'Enter your WhatsApp Business Account ID and access token in the Cloud API tab first.');
        }

        $url = 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . rawurlencode($waba_id) . '/message_templates';

        $payload = [
            'name'       => sanitize_key($name),
            'category'   => in_array($category, ['MARKETING', 'UTILITY', 'AUTHENTICATION'], true) ? $category : 'UTILITY',
            'language'   => $language ?: 'en_US',
            'components' => [
                ['type' => 'BODY', 'text' => $body_text],
            ],
        ];

        return self::graph_post($url, $token, $payload);
    }

    public static function ajax_list_templates() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $result = self::list_templates();
        if (is_wp_error($result)) wp_send_json_error(['message' => $result->get_error_message()], 400);

        wp_send_json_success(['templates' => $result]);
    }

    public static function ajax_create_template() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $name = sanitize_key($_POST['name'] ?? '');
        $category = sanitize_text_field($_POST['category'] ?? 'UTILITY');
        $language = sanitize_text_field($_POST['language'] ?? 'en_US');
        $body_text = sanitize_textarea_field($_POST['body_text'] ?? '');

        if (!$name || !$body_text) wp_send_json_error(['message' => 'Template name and body text are required.'], 400);

        $result = self::create_template($name, $category, $language, $body_text);
        if (is_wp_error($result)) wp_send_json_error(['message' => $result->get_error_message()], 400);

        wp_send_json_success(['message' => 'Template submitted for review — check its status in the list above in a few minutes.']);
    }

    /* ---------------------------------------------------------------------
     * Shared Graph API POST helper
     * ------------------------------------------------------------------- */

    private static function graph_post($url, $token, $body) {
        $response = wp_remote_post($url, [
            'timeout' => 20,
            'headers' => ['Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json'],
            'body'    => wp_json_encode($body),
        ]);

        if (is_wp_error($response)) {
            self::log('Request failed: ' . $response->get_error_message());
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $decoded = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300) return $decoded;

        $error_message = $decoded['error']['message'] ?? ('HTTP ' . $code);
        self::log('Request failed: ' . $error_message);
        return new WP_Error('tcwc_catalog_graph_failed', $error_message, $decoded);
    }

    private static function log($message) {
        if (function_exists('wc_get_logger')) {
            wc_get_logger()->info($message, ['source' => 'tcwc-catalog']);
        }
    }
}
