<?php
if (!defined('ABSPATH')) exit;

/**
 * A real WhatsApp conversation inbox inside wp-admin: every message either
 * direction, stored and threaded, not just reacted to in passing the way
 * the AI assistant / catalogue listeners do. Admins (manage_woocommerce)
 * see every conversation; WhatsApp Staff (TCWC_Staff::CAP) see only ones
 * they've claimed plus the unclaimed pool — same one-owner-at-a-time model
 * as order claiming in class-tcwc-staff.php, just keyed on phone number
 * instead of order ID, since a conversation can exist before, after, or
 * without any order at all.
 *
 * Built directly on TCWC_Cloud_API only (no provider abstraction) —
 * Baileys was evaluated and deliberately not pursued (see
 * whatsapp-commerce-completion-plan.md §7a), so there's nothing to stay
 * agnostic to here.
 */
class TCWC_Inbox {

    const DB_VERSION = '1.0';

    /** Set immediately before a staff-triggered send so log_outbound() can
     *  attribute that one message correctly instead of defaulting to
     *  'system' (which covers AI replies, automations, and admin test
     *  sends — none of which need per-call-site plumbing to identify). */
    private static $pending_context = null;

    public static function init() {
        self::ensure_tables();

        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'assets']);

        // Priority 5: capture every inbound message before TCWC_Catalog (10)
        // or TCWC_AI_Assistant (20) act on it, regardless of what they do.
        add_action('tcwc_inbound_message', [__CLASS__, 'log_inbound'], 5, 2);
        add_action('tcwc_outbound_message', [__CLASS__, 'log_outbound'], 10, 2);
        add_action('tcwc_message_status', [__CLASS__, 'log_status'], 10, 2);

        add_action('wp_ajax_tcwc_inbox_list', [__CLASS__, 'ajax_list']);
        add_action('wp_ajax_tcwc_inbox_thread', [__CLASS__, 'ajax_thread']);
        add_action('wp_ajax_tcwc_inbox_send', [__CLASS__, 'ajax_send']);
        add_action('wp_ajax_tcwc_inbox_claim', [__CLASS__, 'ajax_claim']);
        add_action('wp_ajax_tcwc_inbox_unclaim', [__CLASS__, 'ajax_unclaim']);
    }

    /* ---------------------------------------------------------------------
     * Storage
     * ------------------------------------------------------------------- */

    /**
     * Idempotent, not activation-only — same reasoning as
     * TCWC_Staff::ensure_role_and_caps(): a site updated by copying files
     * over FTP never fires register_activation_hook. Cheap after the first
     * run (one get_option() check), and deliberately NOT gated on
     * is_admin() the way the role check is, because the very first inbound
     * webhook after install can arrive before any admin ever opens
     * wp-admin — the tables need to exist before that happens too.
     */
    public static function ensure_tables() {
        if (get_option('tcwc_inbox_db_version') === self::DB_VERSION) return;

        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $conversations_table = $wpdb->prefix . 'tcwc_conversations';
        $messages_table = $wpdb->prefix . 'tcwc_messages';

        $sql = "CREATE TABLE $conversations_table (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            phone VARCHAR(32) NOT NULL,
            customer_name VARCHAR(190) NOT NULL DEFAULT '',
            claimed_by BIGINT UNSIGNED DEFAULT NULL,
            claimed_by_name VARCHAR(190) NOT NULL DEFAULT '',
            claimed_at DATETIME DEFAULT NULL,
            last_message_at DATETIME DEFAULT NULL,
            last_message_preview VARCHAR(255) NOT NULL DEFAULT '',
            last_direction VARCHAR(3) NOT NULL DEFAULT '',
            unread_count INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY phone (phone),
            KEY claimed_by (claimed_by),
            KEY last_message_at (last_message_at)
        ) $charset_collate;

        CREATE TABLE $messages_table (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            conversation_id BIGINT UNSIGNED NOT NULL,
            direction VARCHAR(3) NOT NULL,
            sender_type VARCHAR(20) NOT NULL,
            sender_id BIGINT UNSIGNED DEFAULT NULL,
            wa_message_id VARCHAR(100) NOT NULL DEFAULT '',
            message_type VARCHAR(20) NOT NULL DEFAULT 'text',
            body LONGTEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY conversation_id (conversation_id),
            KEY wa_message_id (wa_message_id)
        ) $charset_collate;";

        dbDelta($sql);

        update_option('tcwc_inbox_db_version', self::DB_VERSION, false);
    }

    /** Every inbound message, regardless of what the AI assistant or catalogue also do with it. */
    public static function log_inbound($message, $value) {
        global $wpdb;
        $conversations_table = $wpdb->prefix . 'tcwc_conversations';
        $messages_table = $wpdb->prefix . 'tcwc_messages';

        $phone = preg_replace('/\D+/', '', (string) ($message['from'] ?? ''));
        if (!$phone) return;

        $body = self::extract_inbound_body($message);
        $now = current_time('mysql');
        $conversation_id = self::find_or_create_conversation($phone, $body, 'in', $now);

        $wpdb->query($wpdb->prepare(
            "UPDATE $conversations_table SET last_message_at = %s, last_message_preview = %s, last_direction = 'in', unread_count = unread_count + 1 WHERE id = %d",
            $now, mb_substr($body, 0, 250), $conversation_id
        ));

        $wpdb->insert($messages_table, [
            'conversation_id' => $conversation_id,
            'direction'       => 'in',
            'sender_type'     => 'customer',
            'sender_id'       => null,
            'wa_message_id'   => $message['id'] ?? '',
            'message_type'    => $message['type'] ?? 'text',
            'body'            => $body,
            'status'          => '',
            'created_at'      => $now,
        ]);
    }

    /**
     * Every successful outbound send — AI replies, automations, admin test
     * messages, and staff replies from this inbox all funnel through
     * TCWC_Cloud_API::send_raw(), so this is one listener, not scattered
     * writes. Attribution defaults to 'system' (good enough for AI /
     * automation / test sends in v1) unless ajax_send() below flagged the
     * next send as a staff reply via self::$pending_context.
     */
    public static function log_outbound($payload, $result) {
        global $wpdb;
        $conversations_table = $wpdb->prefix . 'tcwc_conversations';
        $messages_table = $wpdb->prefix . 'tcwc_messages';

        $phone = preg_replace('/\D+/', '', (string) ($payload['to'] ?? ''));
        if (!$phone) return;

        $context = self::$pending_context ?: ['sender_type' => 'system', 'sender_id' => null];
        self::$pending_context = null;

        $wa_id = $result['messages'][0]['id'] ?? '';

        // Safety dedupe — shouldn't fire twice for the same message, but cheap to guard.
        if ($wa_id && $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $messages_table WHERE wa_message_id = %s AND direction = 'out'", $wa_id
        ))) return;

        $body = self::extract_outbound_body($payload);
        $now = current_time('mysql');
        $conversation_id = self::find_or_create_conversation($phone, $body, 'out', $now);

        $wpdb->query($wpdb->prepare(
            "UPDATE $conversations_table SET last_message_at = %s, last_message_preview = %s, last_direction = 'out' WHERE id = %d",
            $now, mb_substr($body, 0, 250), $conversation_id
        ));

        $wpdb->insert($messages_table, [
            'conversation_id' => $conversation_id,
            'direction'       => 'out',
            'sender_type'     => $context['sender_type'],
            'sender_id'       => $context['sender_id'],
            'wa_message_id'   => $wa_id,
            'message_type'    => $payload['type'] ?? 'text',
            'body'            => $body,
            'status'          => 'sent',
            'created_at'      => $now,
        ]);
    }

    /** Meta's delivery-status callbacks (sent/delivered/read/failed) — real ✓✓ ticks, at near-zero extra cost since these already arrive today. */
    public static function log_status($status, $value) {
        $wa_id = $status['id'] ?? '';
        $state = $status['status'] ?? '';
        if (!$wa_id || !$state) return;

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'tcwc_messages',
            ['status' => $state],
            ['wa_message_id' => $wa_id, 'direction' => 'out']
        );
    }

    private static function find_or_create_conversation($phone, $body, $direction, $now) {
        global $wpdb;
        $table = $wpdb->prefix . 'tcwc_conversations';

        $conversation_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE phone = %s", $phone));
        if ($conversation_id) return (int) $conversation_id;

        $wpdb->insert($table, [
            'phone'                => $phone,
            'customer_name'        => self::guess_customer_name($phone),
            'last_message_at'      => $now,
            'last_message_preview' => mb_substr($body, 0, 250),
            'last_direction'       => $direction,
            'unread_count'         => $direction === 'in' ? 1 : 0,
            'created_at'           => $now,
        ]);

        return (int) $wpdb->insert_id;
    }

    /**
     * Best-effort only — matches the last 9 digits against billing phone on
     * the customer's most recent WooCommerce order, which absorbs the usual
     * 254/0/+254 formatting differences without needing exact normalization.
     * A miss just means the conversation shows the phone number instead of
     * a name; nothing depends on this succeeding.
     */
    private static function guess_customer_name($phone) {
        if (!function_exists('wc_get_orders')) return '';
        $last9 = substr($phone, -9);
        if (strlen($last9) < 9) return '';

        $orders = wc_get_orders([
            'limit'      => 1,
            'orderby'    => 'date',
            'order'      => 'DESC',
            'meta_query' => [[
                'key'     => '_billing_phone',
                'value'   => $last9,
                'compare' => 'LIKE',
            ]],
        ]);

        if (!$orders) return '';
        $name = trim($orders[0]->get_billing_first_name() . ' ' . $orders[0]->get_billing_last_name());
        return $name;
    }

    private static function extract_inbound_body($message) {
        $type = $message['type'] ?? 'text';
        switch ($type) {
            case 'text':
                return $message['text']['body'] ?? '';
            case 'button':
                return $message['button']['text'] ?? '[button reply]';
            case 'interactive':
                $i = $message['interactive'] ?? [];
                if (isset($i['button_reply']['title'])) return $i['button_reply']['title'];
                if (isset($i['list_reply']['title'])) return $i['list_reply']['title'];
                return '[interactive reply]';
            case 'image':
                return '[image]' . (!empty($message['image']['caption']) ? ' ' . $message['image']['caption'] : '');
            case 'document':
                return '[document]' . (!empty($message['document']['filename']) ? ' ' . $message['document']['filename'] : '');
            case 'audio':
                return '[voice note]';
            case 'video':
                return '[video]';
            case 'location':
                return '[location shared]';
            case 'sticker':
                return '[sticker]';
            default:
                return '[' . $type . ' message]';
        }
    }

    private static function extract_outbound_body($payload) {
        $type = $payload['type'] ?? 'text';
        if ($type === 'text') return $payload['text']['body'] ?? '';
        if ($type === 'template') return '[template: ' . ($payload['template']['name'] ?? 'unknown') . ']';
        if ($type === 'interactive') return '[interactive message]';
        return '[' . $type . ' message]';
    }

    private static function last_inbound_at($conversation_id) {
        global $wpdb;
        return $wpdb->get_var($wpdb->prepare(
            "SELECT created_at FROM {$wpdb->prefix}tcwc_messages WHERE conversation_id = %d AND direction = 'in' ORDER BY created_at DESC LIMIT 1",
            $conversation_id
        ));
    }

    private static function can_view($conversation) {
        if (current_user_can('manage_woocommerce')) return true;
        if (!current_user_can(TCWC_Staff::CAP)) return false;
        return empty($conversation->claimed_by) || (int) $conversation->claimed_by === get_current_user_id();
    }

    /* ---------------------------------------------------------------------
     * Admin page
     * ------------------------------------------------------------------- */

    public static function menu() {
        add_submenu_page(
            'tcwc-orders',
            'WhatsApp Inbox',
            'Inbox',
            TCWC_Staff::CAP,
            'tcwc-inbox',
            [__CLASS__, 'render_page']
        );
    }

    public static function assets($hook) {
        if (strpos((string) $hook, 'tcwc-inbox') === false) return;
        wp_enqueue_style('tcwc-inbox', TCWC_URL . 'assets/css/tcwc-inbox.css', [], TCWC_VERSION);
        wp_enqueue_script('tcwc-inbox', TCWC_URL . 'assets/js/tcwc-inbox.js', [], TCWC_VERSION, true);
        wp_localize_script('tcwc-inbox', 'TCWC_INBOX', [
            'ajax'        => admin_url('admin-ajax.php'),
            'nonce'       => wp_create_nonce('tcwc_nonce'),
            'currentUser' => get_current_user_id(),
        ]);
    }

    public static function render_page() {
        if (!current_user_can(TCWC_Staff::CAP)) return;
        ?>
        <div class="wrap" id="tcwc-inbox-wrap">
            <h1>WhatsApp Inbox</h1>
            <p>Every WhatsApp conversation in one place — reply without leaving wp-admin. Updates automatically every few seconds.</p>
            <div class="tcwc-inbox-shell">
                <div class="tcwc-inbox-list" id="tcwc-inbox-list">
                    <p class="tcwc-inbox-empty">Loading conversations…</p>
                </div>
                <div class="tcwc-inbox-thread" id="tcwc-inbox-thread">
                    <p class="tcwc-inbox-empty">Select a conversation on the left.</p>
                </div>
            </div>
        </div>
        <?php
    }

    /* ---------------------------------------------------------------------
     * AJAX
     * ------------------------------------------------------------------- */

    public static function ajax_list() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(TCWC_Staff::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        global $wpdb;
        $table = $wpdb->prefix . 'tcwc_conversations';
        $user_id = get_current_user_id();

        if (current_user_can('manage_woocommerce')) {
            $rows = $wpdb->get_results("SELECT * FROM $table ORDER BY last_message_at DESC LIMIT 100");
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM $table WHERE claimed_by IS NULL OR claimed_by = %d ORDER BY last_message_at DESC LIMIT 100",
                $user_id
            ));
        }

        $out = array_map(function ($row) use ($user_id) {
            return [
                'id'              => (int) $row->id,
                'phone'           => $row->phone,
                'name'            => $row->customer_name ?: $row->phone,
                'preview'         => $row->last_message_preview,
                'direction'       => $row->last_direction,
                'last_message_at' => $row->last_message_at,
                'unread'          => (int) $row->unread_count,
                'claimed_by'      => $row->claimed_by ? (int) $row->claimed_by : null,
                'claimed_by_name' => $row->claimed_by_name,
                'is_mine'         => $row->claimed_by && (int) $row->claimed_by === $user_id,
            ];
        }, $rows);

        wp_send_json_success(['conversations' => $out]);
    }

    public static function ajax_thread() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(TCWC_Staff::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        global $wpdb;
        $conversation_id = absint($_POST['conversation_id'] ?? 0);
        $conv_table = $wpdb->prefix . 'tcwc_conversations';
        $msg_table = $wpdb->prefix . 'tcwc_messages';

        $conversation = $wpdb->get_row($wpdb->prepare("SELECT * FROM $conv_table WHERE id = %d", $conversation_id));
        if (!$conversation) wp_send_json_error(['message' => 'Conversation not found.'], 404);
        if (!self::can_view($conversation)) wp_send_json_error(['message' => 'Not allowed to view this conversation.'], 403);

        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $msg_table WHERE conversation_id = %d ORDER BY created_at ASC, id ASC LIMIT 300",
            $conversation_id
        ));

        // Opening the thread marks it read.
        $wpdb->update($conv_table, ['unread_count' => 0], ['id' => $conversation_id]);

        $last_inbound = self::last_inbound_at($conversation_id);
        $within_window = $last_inbound && (current_time('timestamp') - strtotime($last_inbound)) < DAY_IN_SECONDS;

        $out = array_map(function ($m) {
            return [
                'id'          => (int) $m->id,
                'direction'   => $m->direction,
                'sender_type' => $m->sender_type,
                'body'        => $m->body,
                'type'        => $m->message_type,
                'status'      => $m->status,
                'created_at'  => $m->created_at,
            ];
        }, $messages);

        wp_send_json_success([
            'messages'      => $out,
            'conversation'  => [
                'id'              => (int) $conversation->id,
                'name'            => $conversation->customer_name ?: $conversation->phone,
                'phone'           => $conversation->phone,
                'claimed_by'      => $conversation->claimed_by ? (int) $conversation->claimed_by : null,
                'claimed_by_name' => $conversation->claimed_by_name,
            ],
            'within_window' => $within_window,
        ]);
    }

    public static function ajax_send() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(TCWC_Staff::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        global $wpdb;
        $conv_table = $wpdb->prefix . 'tcwc_conversations';
        $conversation_id = absint($_POST['conversation_id'] ?? 0);
        $message = sanitize_textarea_field($_POST['message'] ?? '');

        if (!$conversation_id || !$message) wp_send_json_error(['message' => 'Nothing to send.'], 400);

        $conversation = $wpdb->get_row($wpdb->prepare("SELECT * FROM $conv_table WHERE id = %d", $conversation_id));
        if (!$conversation) wp_send_json_error(['message' => 'Conversation not found.'], 404);
        if (!self::can_view($conversation)) wp_send_json_error(['message' => 'Not allowed to reply here.'], 403);

        $last_inbound = self::last_inbound_at($conversation_id);
        if (!$last_inbound || (current_time('timestamp') - strtotime($last_inbound)) >= DAY_IN_SECONDS) {
            wp_send_json_error(['message' => "Outside WhatsApp's 24-hour reply window — only a pre-approved template can be sent now, not a free-form message."], 400);
        }

        $user = wp_get_current_user();

        // Whoever replies to an unclaimed conversation claims it — same idea as order claiming.
        if (!$conversation->claimed_by) {
            $wpdb->update($conv_table, [
                'claimed_by'      => $user->ID,
                'claimed_by_name' => $user->display_name,
                'claimed_at'      => current_time('mysql'),
            ], ['id' => $conversation_id]);
        }

        self::$pending_context = ['sender_type' => 'staff', 'sender_id' => $user->ID];
        $result = TCWC_Cloud_API::send_text($conversation->phone, $message);
        self::$pending_context = null;

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success(['claimed_by' => $user->display_name, 'claimed_by_id' => $user->ID]);
    }

    public static function ajax_claim() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(TCWC_Staff::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        global $wpdb;
        $conversation_id = absint($_POST['conversation_id'] ?? 0);
        $user = wp_get_current_user();

        $wpdb->update($wpdb->prefix . 'tcwc_conversations', [
            'claimed_by'      => $user->ID,
            'claimed_by_name' => $user->display_name,
            'claimed_at'      => current_time('mysql'),
        ], ['id' => $conversation_id]);

        wp_send_json_success(['claimed_by' => $user->display_name, 'claimed_by_id' => $user->ID]);
    }

    public static function ajax_unclaim() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(TCWC_Staff::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        global $wpdb;
        $conversation_id = absint($_POST['conversation_id'] ?? 0);

        $wpdb->update($wpdb->prefix . 'tcwc_conversations', [
            'claimed_by'      => null,
            'claimed_by_name' => '',
            'claimed_at'      => null,
        ], ['id' => $conversation_id]);

        wp_send_json_success();
    }
}
