<?php
if (!defined('ABSPATH')) exit;

/**
 * v0.7: AI shopping assistant.
 *
 * Listens on the same `tcwc_inbound_message` action that TCWC_Catalog uses
 * (fired from TCWC_Cloud_API::handle_event() for every inbound WhatsApp
 * message), so this is purely additive — nothing about the click-to-chat,
 * Cloud API, M-Pesa, catalogue, or automation flows changes if this stays
 * disabled.
 *
 * Precedence: TCWC_Catalog already owns interactive replies (list/button
 * taps) and exact keyword matches ("menu", "catalog", "shop") when its own
 * interactive-menu feature is on — this class explicitly ignores both of
 * those cases so the two never fight over the same message. Everything
 * else in plain text, when enabled, comes here: natural-language product
 * search ("show me black dresses under 3,000"), a short direct reply for
 * anything else, or hand-off to a human agent.
 *
 * State is intentionally minimal and stateless per conversation turn (no
 * chat history is kept, matching the Catalog module's own "every reply is
 * self-describing" principle) — the only per-phone state is (a) whether the
 * bot is currently muted because a human took over, and (b) a short rolling
 * count of unclear/no-result replies used to auto-hand-off a customer the
 * bot clearly isn't helping.
 */
class TCWC_AI_Assistant {

    const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
    const ANTHROPIC_VERSION = '2023-06-01';

    const MUTE_TRANSIENT_PREFIX = 'tcwc_ai_muted_';
    const MUTE_TTL = 3 * DAY_IN_SECONDS; // roughly "until this conversation has clearly moved on"

    const FAIL_TRANSIENT_PREFIX = 'tcwc_ai_fails_';
    const FAIL_TTL = HOUR_IN_SECONDS; // a rolling window, not a lifetime count

    const SEARCH_RESULT_LIMIT = 5;

    const HANDOFF_QUEUE_OPTION = 'tcwc_ai_handoff_queue';

    public static function init() {
        add_action('tcwc_inbound_message', [__CLASS__, 'handle_inbound'], 20, 2); // after TCWC_Catalog (priority 10)
        add_action('wp_ajax_tcwc_ai_test', [__CLASS__, 'ajax_test']);
    }

    /* ---------------------------------------------------------------------
     * Config helpers
     * ------------------------------------------------------------------- */

    private static function is_enabled() {
        return TCWC_Settings::get('ai_assistant_enabled', 'no') === 'yes'
            && TCWC_Settings::get('ai_api_key')
            && TCWC_Settings::get('ai_model');
    }

    private static function handoff_keywords() {
        return array_filter(array_map('trim', explode(',', strtolower(
            TCWC_Settings::get('ai_handoff_keywords', 'agent,human,help,talk to someone,speak to someone')
        ))));
    }

    private static function menu_keywords() {
        return array_filter(array_map('trim', explode(',', strtolower(
            TCWC_Settings::get('interactive_menu_keywords', 'menu,catalog,shop')
        ))));
    }

    /* ---------------------------------------------------------------------
     * Inbound message entry point
     * ------------------------------------------------------------------- */

    public static function handle_inbound($message, $value) {
        if (!self::is_enabled()) return;

        // Interactive replies (list/button taps) belong to TCWC_Catalog's
        // menu flow, not free-text AI search — never touch those here.
        if (!empty($message['interactive'])) return;

        $from = $message['from'] ?? '';
        $text = trim($message['text']['body'] ?? '');
        if (!$from || !$text) return;

        $lower = strtolower($text);

        // If the static interactive menu is on and this is one of its exact
        // keywords, TCWC_Catalog already answered it — stay out of the way.
        if (TCWC_Settings::get('interactive_menu_enabled', 'no') === 'yes' && in_array($lower, self::menu_keywords(), true)) {
            return;
        }

        // A customer explicitly asking for the menu again (or any of its
        // keywords) is a clear, deliberate signal they want self-service
        // back — treat it as resuming, even mid-mute.
        if (in_array($lower, self::menu_keywords(), true)) {
            self::unmute($from);
        }

        if (self::is_muted($from)) return; // a human is already handling this conversation

        if (self::matches_any($lower, self::handoff_keywords())) {
            self::escalate($from, $text, 'Customer asked for a person.');
            return;
        }

        $intent = self::parse_intent($text);

        if (is_wp_error($intent)) {
            self::log('Intent parsing failed: ' . $intent->get_error_message());
            self::send_text($from, "Sorry, I'm having trouble right now. Reply \"agent\" and we'll get a person to help.");
            return;
        }

        if (($intent['intent'] ?? '') === 'handoff') {
            self::escalate($from, $text, $intent['reply'] ?? 'AI judged this needed a human.');
            return;
        }

        if (($intent['intent'] ?? '') === 'product_search') {
            self::handle_product_search($from, $text, $intent);
            return;
        }

        // 'other' / chitchat / anything unrecognised: send the model's own
        // short reply, and count it toward the auto-handoff threshold only
        // if the model itself signalled it wasn't confident.
        $reply = trim($intent['reply'] ?? '') ?: "I'm not sure I caught that — try describing what you're looking for, or reply \"agent\" for a person.";
        self::send_text($from, $reply . "\n\n_Reply \"agent\" anytime to talk to a person._");
        self::log_conversation($from, 'other', $reply);

        if (empty($intent['reply'])) {
            self::maybe_auto_handoff($from, $text);
        } else {
            self::reset_fail_count($from);
        }
    }

    private static function matches_any($haystack, array $needles) {
        foreach ($needles as $needle) {
            if ($needle !== '' && strpos($haystack, $needle) !== false) return true;
        }
        return false;
    }

    /* ---------------------------------------------------------------------
     * Mute (human hand-off) state — per phone number, self-expiring
     * ------------------------------------------------------------------- */

    private static function mute_key($phone) {
        return self::MUTE_TRANSIENT_PREFIX . md5($phone);
    }

    private static function is_muted($phone) {
        return (bool) get_transient(self::mute_key($phone));
    }

    private static function mute($phone) {
        set_transient(self::mute_key($phone), 1, self::MUTE_TTL);
    }

    private static function unmute($phone) {
        delete_transient(self::mute_key($phone));
    }

    private static function escalate($phone, $customer_text, $reason) {
        self::mute($phone);
        self::reset_fail_count($phone);
        self::push_to_handoff_queue($phone, $reason, $customer_text);

        $notice = TCWC_Settings::get('ai_handoff_notice', "Got it — connecting you with a person from our team. They'll be with you shortly.");
        self::send_text($phone, $notice);
        self::log_conversation($phone, 'handoff', $reason);

        if (TCWC_Settings::get('ai_notify_admin_on_handoff', 'no') === 'yes') {
            $admin_number = TCWC_Settings::get('cloud_api_admin_number');
            if ($admin_number && class_exists('TCWC_Cloud_API')) {
                TCWC_Cloud_API::send_text(
                    $admin_number,
                    "\u{1F464} AI assistant handed off a WhatsApp conversation to a human.\n\nFrom: {$phone}\nReason: {$reason}\nTheir message: \"{$customer_text}\""
                );
            }
        }
    }

    /**
     * A person is on the other end of a hand-off; the WhatsApp Orders staff
     * dashboard (TCWC_Staff) reads this to show "who's waiting for a person
     * right now" without needing a full chat inbox. Stale entries (self-
     * expired mute) are pruned lazily whenever this is read.
     */
    public static function get_handoff_queue() {
        $queue = get_option(self::HANDOFF_QUEUE_OPTION, []);
        $active = array_values(array_filter($queue, function ($row) {
            return !empty($row['phone']) && self::is_muted($row['phone']);
        }));
        if (count($active) !== count($queue)) {
            update_option(self::HANDOFF_QUEUE_OPTION, $active, false);
        }
        return $active;
    }

    /** Called from the staff dashboard's "Mark resolved" button. */
    public static function resolve_handoff($phone) {
        self::unmute($phone);
        $queue = get_option(self::HANDOFF_QUEUE_OPTION, []);
        $queue = array_values(array_filter($queue, function ($row) use ($phone) {
            return ($row['phone'] ?? '') !== $phone;
        }));
        update_option(self::HANDOFF_QUEUE_OPTION, $queue, false);
    }

    private static function push_to_handoff_queue($phone, $reason, $customer_text) {
        $queue = get_option(self::HANDOFF_QUEUE_OPTION, []);
        $queue = array_values(array_filter($queue, function ($row) use ($phone) {
            return ($row['phone'] ?? '') !== $phone; // de-dupe: one entry per phone, refreshed
        }));
        array_unshift($queue, [
            'phone'  => $phone,
            'time'   => current_time('mysql'),
            'reason' => $reason,
            'detail' => wp_html_excerpt((string) $customer_text, 100, ''),
        ]);
        update_option(self::HANDOFF_QUEUE_OPTION, array_slice($queue, 0, 50), false);
    }

    /* ---------------------------------------------------------------------
     * Consecutive-failure tracking -> auto hand-off
     * ------------------------------------------------------------------- */

    private static function fail_key($phone) {
        return self::FAIL_TRANSIENT_PREFIX . md5($phone);
    }

    private static function reset_fail_count($phone) {
        delete_transient(self::fail_key($phone));
    }

    private static function bump_fail_count($phone) {
        $count = (int) get_transient(self::fail_key($phone));
        $count++;
        set_transient(self::fail_key($phone), $count, self::FAIL_TTL);
        return $count;
    }

    private static function maybe_auto_handoff($phone, $customer_text) {
        $threshold = max(1, absint(TCWC_Settings::get('ai_handoff_after_failures', 2)));
        $count = self::bump_fail_count($phone);
        if ($count >= $threshold) {
            self::escalate($phone, $customer_text, "Bot couldn't help after {$count} attempts in a row.");
        }
    }

    /* ---------------------------------------------------------------------
     * Product search
     * ------------------------------------------------------------------- */

    private static function handle_product_search($phone, $customer_text, $intent) {
        $products = self::search_products($intent);

        if (!$products) {
            $reply = trim($intent['reply'] ?? '') ?: "I couldn't find anything matching that.";
            self::send_text($phone, $reply . " Try different words, or reply \"agent\" for a person.");
            self::log_conversation($phone, 'search_empty', $customer_text);
            self::maybe_auto_handoff($phone, $customer_text);
            return;
        }

        self::reset_fail_count($phone);
        $intro = trim($intent['reply'] ?? '') ?: 'Here\'s what I found:';

        $catalog_ready = TCWC_Settings::get('cloud_api_access_token') && TCWC_Settings::get('catalog_id');

        if ($catalog_ready && class_exists('TCWC_Cloud_API')) {
            $items = [];
            foreach ($products as $product) {
                $items[] = ['product_retailer_id' => $product->get_sku() ?: ('wc_' . $product->get_id())];
            }

            TCWC_Cloud_API::send_raw([
                'messaging_product' => 'whatsapp',
                'to'                => $phone,
                'type'              => 'interactive',
                'interactive'       => [
                    'type'   => 'product_list',
                    'header' => ['type' => 'text', 'text' => wp_html_excerpt(get_bloginfo('name'), 60, '')],
                    'body'   => ['text' => wp_html_excerpt($intro, 300, '') . "\n\nReply \"agent\" anytime for a person."],
                    'action' => [
                        'catalog_id' => TCWC_Settings::get('catalog_id'),
                        'sections'   => [['title' => 'Results', 'product_items' => $items]],
                    ],
                ],
            ]);
        } else {
            $lines = [$intro, ''];
            foreach ($products as $product) {
                $price = wp_strip_all_tags(wc_price(wc_get_price_to_display($product), ['currency' => get_woocommerce_currency()]));
                $lines[] = $product->get_name() . ' — ' . $price . "\n" . get_permalink($product->get_id());
            }
            $lines[] = '';
            $lines[] = 'Reply "agent" anytime to talk to a person.';
            self::send_text($phone, implode("\n", $lines));
        }

        self::log_conversation($phone, 'product_search', $customer_text . ' (' . count($products) . ' result(s))');
    }

    private static function search_products($intent) {
        if (!function_exists('wc_get_products')) return [];

        $args = [
            'status'       => 'publish',
            'stock_status' => 'instock',
            'limit'        => self::SEARCH_RESULT_LIMIT,
        ];

        if (!empty($intent['keywords'])) {
            $args['s'] = sanitize_text_field($intent['keywords']);
        }

        $meta_query = [];
        if (isset($intent['max_price']) && is_numeric($intent['max_price'])) {
            $meta_query[] = ['key' => '_price', 'value' => (float) $intent['max_price'], 'compare' => '<=', 'type' => 'DECIMAL'];
        }
        if (isset($intent['min_price']) && is_numeric($intent['min_price'])) {
            $meta_query[] = ['key' => '_price', 'value' => (float) $intent['min_price'], 'compare' => '>=', 'type' => 'DECIMAL'];
        }
        if ($meta_query) $args['meta_query'] = $meta_query;

        if (!empty($intent['category'])) {
            $slug = self::find_matching_category($intent['category']);
            if ($slug) $args['category'] = [$slug];
        }

        $products = wc_get_products($args);
        return array_values(array_filter($products, function ($p) { return $p->is_purchasable(); }));
    }

    private static function find_matching_category($name) {
        $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true]);
        if (is_wp_error($terms) || !$terms) return null;

        $name = strtolower(trim($name));
        foreach ($terms as $term) {
            if (strtolower($term->name) === $name) return $term->slug;
        }
        foreach ($terms as $term) {
            if (strpos(strtolower($term->name), $name) !== false || strpos($name, strtolower($term->name)) !== false) {
                return $term->slug;
            }
        }
        return null;
    }

    /* ---------------------------------------------------------------------
     * Intent parsing via the Anthropic Messages API
     * ------------------------------------------------------------------- */

    private static function category_names() {
        $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true, 'parent' => 0, 'number' => 20]);
        if (is_wp_error($terms) || !$terms) return [];
        return wp_list_pluck($terms, 'name');
    }

    /**
     * Sends the customer's message to Claude and asks for a small structured
     * JSON object back. No chat history is sent — each message is judged on
     * its own, matching the stateless design of the rest of this plugin.
     *
     * @return array|WP_Error ['intent'=>'product_search'|'handoff'|'other', 'reply'=>string, 'keywords'=>?string, 'category'=>?string, 'min_price'=>?float, 'max_price'=>?float]
     */
    public static function parse_intent($customer_text) {
        $api_key = TCWC_Settings::get('ai_api_key');
        $model = TCWC_Settings::get('ai_model');
        if (!$api_key || !$model) {
            return new WP_Error('tcwc_ai_not_configured', 'AI assistant is not fully configured yet.');
        }

        $categories = self::category_names();
        $store_name = get_bloginfo('name');
        $currency = get_woocommerce_currency();
        $custom_instructions = trim(TCWC_Settings::get('ai_store_instructions', ''));

        $system = "You are a WhatsApp shopping assistant for the online store \"{$store_name}\" (currency: {$currency}). "
            . "A customer just sent you a WhatsApp message. Decide what they want and respond with ONLY a single JSON object, "
            . "no other text, no markdown code fences. Schema:\n"
            . '{"intent": "product_search" | "handoff" | "other", '
            . '"reply": "short natural reply, under 300 characters, shown to the customer", '
            . '"keywords": "search keywords or null", "category": "closest matching category name from the list below, or null", '
            . '"min_price": number or null, "max_price": number or null}' . "\n\n"
            . 'Use "product_search" whenever they describe something they might want to buy (an item, a type of product, a price range), even loosely. '
            . 'Use "handoff" if they seem frustrated, explicitly ask for a human/agent, describe a complaint, an existing order problem, or anything too specific/sensitive for automated search. '
            . 'Use "other" for greetings, thanks, small talk, or anything else — keep "reply" friendly and short. '
            . 'Never invent specific product names, prices, or stock claims in "reply" — that comes from the actual product search, not from you. '
            . 'Available top-level categories: ' . (implode(', ', $categories) ?: '(none set up yet)') . '.';

        if ($custom_instructions) {
            $system .= "\n\nAdditional store instructions from the merchant: " . $custom_instructions;
        }

        $response = wp_remote_post(self::ANTHROPIC_API_URL, [
            'timeout' => 20,
            'headers' => [
                'x-api-key'         => $api_key,
                'anthropic-version' => self::ANTHROPIC_VERSION,
                'content-type'      => 'application/json',
            ],
            'body' => wp_json_encode([
                'model'      => $model,
                'max_tokens' => 400,
                'system'     => $system,
                'messages'   => [
                    ['role' => 'user', 'content' => $customer_text],
                ],
            ]),
        ]);

        if (is_wp_error($response)) return $response;

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code < 200 || $code >= 300) {
            $error_message = $body['error']['message'] ?? ('HTTP ' . $code);
            return new WP_Error('tcwc_ai_request_failed', $error_message, $body);
        }

        $text = '';
        foreach (($body['content'] ?? []) as $block) {
            if (($block['type'] ?? '') === 'text') $text .= $block['text'];
        }

        $text = trim(preg_replace('/^```(?:json)?|```$/m', '', trim($text)));
        $decoded = json_decode($text, true);

        if (!is_array($decoded) || empty($decoded['intent'])) {
            return new WP_Error('tcwc_ai_parse_failed', 'Could not understand the AI response.');
        }

        return $decoded;
    }

    /* ---------------------------------------------------------------------
     * Admin: test tool (Settings -> AI Assistant tab)
     * ------------------------------------------------------------------- */

    public static function ajax_test() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $text = sanitize_text_field($_POST['text'] ?? '');
        if (!$text) wp_send_json_error(['message' => 'Enter a sample message first.'], 400);

        $intent = self::parse_intent($text);
        if (is_wp_error($intent)) {
            wp_send_json_error(['message' => $intent->get_error_message()], 400);
        }

        $result = ['intent' => $intent];
        if (($intent['intent'] ?? '') === 'product_search') {
            $products = self::search_products($intent);
            $result['matched_products'] = array_map(function ($p) {
                return $p->get_name() . ' (' . wp_strip_all_tags(wc_price(wc_get_price_to_display($p))) . ')';
            }, $products);
        }

        wp_send_json_success($result);
    }

    /* ---------------------------------------------------------------------
     * Send + log helpers
     * ------------------------------------------------------------------- */

    private static function send_text($to, $text) {
        if (class_exists('TCWC_Cloud_API')) {
            TCWC_Cloud_API::send_text($to, $text);
        }
    }

    private static function log_conversation($phone, $intent, $detail) {
        $log = get_option('tcwc_ai_conversation_log', []);
        array_unshift($log, [
            'time'   => current_time('mysql'),
            'phone'  => $phone,
            'intent' => $intent,
            'detail' => wp_html_excerpt((string) $detail, 140, ''),
        ]);
        update_option('tcwc_ai_conversation_log', array_slice($log, 0, 20), false);
    }

    private static function log($message) {
        if (function_exists('wc_get_logger')) {
            wc_get_logger()->info($message, ['source' => 'tcwc-ai-assistant']);
        }
    }
}
