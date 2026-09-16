<?php
if (!defined('ABSPATH')) exit;

/**
 * Staff accounts + a focused WhatsApp order-management dashboard.
 *
 * The pattern here mirrors how dedicated WhatsApp-commerce inboxes (WATI,
 * ChatDaddy, Respond.io, etc.) are run worldwide at small-to-mid scale: a
 * limited staff role that can work orders and hand-offs without full
 * store-admin access, a single "claim" field per order so two people don't
 * answer the same customer twice (the low-tech equivalent of the collision
 * detection those platforms build), and a small hand-off queue rather than a
 * full chat inbox — the actual conversation still happens in WhatsApp
 * itself; this just tracks who's waiting for a person and who's on it.
 */
class TCWC_Staff {

    const ROLE = 'tcwc_staff';
    const CAP = 'tcwc_manage_orders';

    public static function init() {
        self::ensure_role_and_caps();

        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_menu', [__CLASS__, 'force_second_position'], 9999);
        add_action('admin_menu', [__CLASS__, 'restrict_staff_menu'], 999);
        add_action('admin_enqueue_scripts', [__CLASS__, 'assets']);
        add_action('admin_init', [__CLASS__, 'redirect_to_module_on_dashboard']);
        add_filter('login_redirect', [__CLASS__, 'module_login_redirect'], 10, 3);

        add_action('wp_ajax_tcwc_staff_add', [__CLASS__, 'ajax_add_staff']);
        add_action('wp_ajax_tcwc_staff_remove', [__CLASS__, 'ajax_remove_staff']);

        add_action('wp_ajax_tcwc_order_claim', [__CLASS__, 'ajax_claim_order']);
        add_action('wp_ajax_tcwc_order_unclaim', [__CLASS__, 'ajax_unclaim_order']);
        add_action('wp_ajax_tcwc_order_complete', [__CLASS__, 'ajax_mark_complete']);
        add_action('wp_ajax_tcwc_order_note', [__CLASS__, 'ajax_add_note']);
        add_action('wp_ajax_tcwc_resolve_handoff', [__CLASS__, 'ajax_resolve_handoff']);
    }

    /**
     * Registers the "WhatsApp Staff" role on first run, and re-grants the
     * capability idempotently on every admin load in case the site was
     * updated by copying files over rather than through a fresh activation
     * (roles/caps don't get created just by a plugin file existing).
     */
    public static function ensure_role_and_caps() {
        if (!is_admin()) return;

        if (!get_role(self::ROLE)) {
            add_role(self::ROLE, 'WhatsApp Staff', [
                'read'                     => true,
                'edit_shop_orders'         => true,
                'edit_others_shop_orders'  => true,
                'read_private_shop_orders' => true,
                self::CAP                  => true,
            ]);
        }

        foreach (['administrator', 'shop_manager'] as $role_name) {
            $role = get_role($role_name);
            if ($role && !$role->has_cap(self::CAP)) {
                $role->add_cap(self::CAP);
            }
        }
    }

    /**
     * Single top-level entry point for the whole plugin: "WhatsApp Commerce"
     * as the parent, with "Orders" (this page — same slug as the parent, so
     * WordPress treats it as the default landing screen when the parent
     * item itself is clicked) and "Settings" (added separately, by
     * TCWC_Settings::menu(), also parented to 'tcwc-orders') as its two
     * submenus. WordPress hides a submenu automatically for any user who
     * lacks its required capability — Settings requires manage_woocommerce,
     * which WhatsApp Staff accounts never have — so staff see only Orders
     * with no extra code needed here. force_second_position() (below)
     * guarantees this sits right after Dashboard regardless of what
     * position number other plugins have already claimed.
     */
    public static function menu() {
        add_menu_page(
            'WhatsApp Commerce',
            'WhatsApp Commerce',
            self::CAP,
            'tcwc-orders',
            [__CLASS__, 'render_orders_page'],
            'dashicons-format-chat',
            3
        );

        add_submenu_page(
            'tcwc-orders',
            'WhatsApp Orders',
            'Orders',
            self::CAP,
            'tcwc-orders',
            [__CLASS__, 'render_orders_page']
        );
    }

    /**
     * WordPress's menu "position" argument is just an integer key in a
     * shared array — with this many other plugins active, something else
     * is almost certainly already sitting at position 3, so add_menu_page()
     * alone doesn't reliably land second. This runs after every plugin has
     * registered its menu (very late priority) and physically moves this
     * plugin's entry to sit right after Dashboard (index.php) in the
     * rendered array, which is what actually determines sidebar order.
     */
    public static function force_second_position() {
        if (!current_user_can(self::CAP)) return;

        global $menu;
        if (!is_array($menu)) return;

        $slug = 'tcwc-orders';
        $target_key = null;
        $target_item = null;
        foreach ($menu as $key => $item) {
            if (isset($item[2]) && $item[2] === $slug) {
                $target_key = $key;
                $target_item = $item;
                break;
            }
        }
        if ($target_item === null) return;

        unset($menu[$target_key]);

        $reordered = [];
        $placed = false;
        foreach ($menu as $item) {
            $reordered[] = $item;
            if (!$placed && isset($item[2]) && $item[2] === 'index.php') {
                $reordered[] = $target_item;
                $placed = true;
            }
        }
        if (!$placed) {
            array_unshift($reordered, $target_item);
        }

        $menu = $reordered;
    }

    /**
     * For WhatsApp Staff accounts only (never for admins/shop managers,
     * who are distinguished by also holding manage_woocommerce): strips
     * every other sidebar item down to just this page, so the WhatsApp
     * Orders dashboard is the only thing a staff account can see or reach
     * via the sidebar. This is cosmetic, not a security boundary — the
     * tcwc_staff role's actual capabilities (see ensure_role_and_caps())
     * already prevent it from doing anything outside orders/hand-offs;
     * this just stops a staff member from being shown menu items that
     * would 403 if they clicked them.
     */
    public static function restrict_staff_menu() {
        if (!current_user_can(self::CAP) || current_user_can('manage_woocommerce')) return;

        global $menu;
        if (!is_array($menu)) return;

        $keep = 'tcwc-orders';
        $remove = [];
        foreach ($menu as $item) {
            if (isset($item[2]) && $item[2] !== $keep) {
                $remove[] = $item[2];
            }
        }
        foreach ($remove as $slug) {
            remove_menu_page($slug);
        }
    }

    /**
     * Anyone who can see this module (admin, shop manager, or WhatsApp
     * Staff) lands on WhatsApp Orders instead of the default wp-admin
     * dashboard — it's now the primary workspace, not a side tool. Applies
     * on every admin_init, so a bookmark or typed /wp-admin/ URL bounces
     * here too, not just first login.
     */
    public static function redirect_to_module_on_dashboard() {
        global $pagenow;
        if ($pagenow !== 'index.php') return;
        if (!current_user_can(self::CAP)) return;

        wp_safe_redirect(admin_url('admin.php?page=tcwc-orders'));
        exit;
    }

    /** Sends anyone who can see this module straight to it on login. */
    public static function module_login_redirect($redirect_to, $requested_redirect_to, $user) {
        if ($user instanceof WP_User && user_can($user, self::CAP)) {
            return admin_url('admin.php?page=tcwc-orders');
        }
        return $redirect_to;
    }

    public static function assets($hook) {
        if (strpos((string) $hook, 'tcwc-orders') === false) return;
        wp_enqueue_style('tcwc-admin', TCWC_URL . 'assets/css/tcwc-admin.css', [], TCWC_VERSION);
        wp_enqueue_script('tcwc-staff', TCWC_URL . 'assets/js/tcwc-staff.js', [], TCWC_VERSION, true);
        wp_localize_script('tcwc-staff', 'TCWC_STAFF', [
            'ajax'  => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tcwc_nonce'),
        ]);
    }

    /* ---------------------------------------------------------------------
     * Staff accounts (the Settings -> Staff tab uses these)
     * ------------------------------------------------------------------- */

    public static function add_staff_user($email, $display_name) {
        if (!current_user_can('manage_woocommerce')) return new WP_Error('tcwc_forbidden', 'Not allowed.');

        $email = sanitize_email($email);
        if (!is_email($email)) return new WP_Error('tcwc_bad_email', 'Enter a valid email address.');

        $existing = get_user_by('email', $email);
        if ($existing) {
            $existing->add_role(self::ROLE);
            return $existing;
        }

        $username = self::unique_username_from_email($email);
        $user_id = wp_insert_user([
            'user_login'   => $username,
            'user_email'   => $email,
            'display_name' => $display_name ?: $username,
            'user_pass'    => wp_generate_password(20),
            'role'         => self::ROLE,
        ]);

        if (is_wp_error($user_id)) return $user_id;

        wp_new_user_notification($user_id, null, 'user'); // sends the standard "set your password" email
        return get_user_by('id', $user_id);
    }

    private static function unique_username_from_email($email) {
        $base = sanitize_user(current(explode('@', $email)), true);
        if (!$base) $base = 'staff';
        $username = $base;
        $i = 1;
        while (username_exists($username)) {
            $username = $base . $i;
            $i++;
        }
        return $username;
    }

    public static function remove_staff_user($user_id) {
        if (!current_user_can('manage_woocommerce')) return;
        $user = get_user_by('id', absint($user_id));
        if ($user) $user->remove_role(self::ROLE);
    }

    public static function get_staff_users() {
        return get_users(['role' => self::ROLE, 'orderby' => 'display_name']);
    }

    public static function ajax_add_staff() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $email = sanitize_email($_POST['email'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        $result = self::add_staff_user($email, $name);

        if (is_wp_error($result)) wp_send_json_error(['message' => $result->get_error_message()], 400);

        wp_send_json_success([
            'message' => $result->user_email . " added as WhatsApp Staff — they'll get an email to set a password.",
            'user_id' => $result->ID,
            'name'    => $result->display_name,
            'email'   => $result->user_email,
        ]);
    }

    public static function ajax_remove_staff() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) wp_send_json_error(['message' => 'Not allowed.'], 403);

        self::remove_staff_user(absint($_POST['user_id'] ?? 0));
        wp_send_json_success();
    }

    /* ---------------------------------------------------------------------
     * Order claiming — one owner at a time, the same principle behind
     * "collision detection" in dedicated WhatsApp team-inbox tools, just
     * without needing real-time infrastructure to do it.
     * ------------------------------------------------------------------- */

    public static function ajax_claim_order() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(self::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $order = wc_get_order(absint($_POST['order_id'] ?? 0));
        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        $user = wp_get_current_user();
        $order->update_meta_data('_tcwc_claimed_by', $user->ID);
        $order->update_meta_data('_tcwc_claimed_by_name', $user->display_name);
        $order->save();

        wp_send_json_success(['claimed_by' => $user->display_name, 'claimed_by_id' => $user->ID]);
    }

    public static function ajax_unclaim_order() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(self::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $order = wc_get_order(absint($_POST['order_id'] ?? 0));
        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        $order->delete_meta_data('_tcwc_claimed_by');
        $order->delete_meta_data('_tcwc_claimed_by_name');
        $order->save();

        wp_send_json_success();
    }

    public static function ajax_mark_complete() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(self::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $order = wc_get_order(absint($_POST['order_id'] ?? 0));
        if (!$order) wp_send_json_error(['message' => 'Order not found.'], 404);

        $order->update_status('completed', 'Marked complete from the WhatsApp Orders dashboard.');
        wp_send_json_success();
    }

    /** Private (staff-only) order note — never sent to the customer. */
    public static function ajax_add_note() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(self::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);

        $order = wc_get_order(absint($_POST['order_id'] ?? 0));
        $note = sanitize_textarea_field($_POST['note'] ?? '');
        if (!$order || !$note) wp_send_json_error(['message' => 'Nothing to save.'], 400);

        $user = wp_get_current_user();
        $order->add_order_note('[' . $user->display_name . '] ' . $note, false, true);

        wp_send_json_success();
    }

    public static function ajax_resolve_handoff() {
        check_ajax_referer('tcwc_nonce', 'nonce');
        if (!current_user_can(self::CAP)) wp_send_json_error(['message' => 'Not allowed.'], 403);
        if (!class_exists('TCWC_AI_Assistant')) wp_send_json_error(['message' => 'AI assistant module unavailable.'], 500);

        $phone = sanitize_text_field($_POST['phone'] ?? '');
        if (!$phone) wp_send_json_error(['message' => 'Missing phone number.'], 400);

        TCWC_AI_Assistant::resolve_handoff($phone);
        wp_send_json_success();
    }

    /* ---------------------------------------------------------------------
     * Dashboard page
     * ------------------------------------------------------------------- */

    public static function render_orders_page() {
        if (!current_user_can(self::CAP)) return;

        $status_filter = sanitize_key($_GET['tcwc_status'] ?? '');
        $args = [
            'created_via' => 'trendscore_whatsapp', // only orders this plugin's checkout modal created
            'limit'       => 50,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ];
        if ($status_filter) $args['status'] = $status_filter;

        $orders = function_exists('wc_get_orders') ? wc_get_orders($args) : [];
        $handoff_queue = class_exists('TCWC_AI_Assistant') ? TCWC_AI_Assistant::get_handoff_queue() : [];
        $current_user_id = get_current_user_id();
        ?>
        <div class="wrap" id="tcwc-orders-wrap">
            <h1>WhatsApp Orders</h1>
            <p>Orders placed through the WhatsApp checkout modal, in one place — claim one so the rest of the team knows it's being handled, recheck M-Pesa payments, and mark orders complete without leaving this screen.</p>

            <?php if ($handoff_queue): ?>
            <h2>Waiting for a person (<?php echo count($handoff_queue); ?>)</h2>
            <table class="widefat striped" style="margin-bottom:28px;max-width:900px;">
                <thead><tr><th>Since</th><th>Phone</th><th>Reason</th><th>Last message</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($handoff_queue as $row): ?>
                    <tr>
                        <td><?php echo esc_html($row['time'] ?? ''); ?></td>
                        <td><?php echo esc_html($row['phone'] ?? ''); ?></td>
                        <td><?php echo esc_html($row['reason'] ?? ''); ?></td>
                        <td><?php echo esc_html($row['detail'] ?? ''); ?></td>
                        <td>
                            <a class="button button-small" href="https://wa.me/<?php echo esc_attr($row['phone'] ?? ''); ?>" target="_blank" rel="noopener">Open chat</a>
                            <button type="button" class="button button-small tcwc-resolve-handoff" data-phone="<?php echo esc_attr($row['phone'] ?? ''); ?>">Mark resolved</button>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>

            <h2>Orders</h2>
            <table class="widefat striped" id="tcwc-orders-table">
                <thead>
                    <tr>
                        <th>Order</th><th>Date</th><th>Customer</th><th>Total</th>
                        <th>Status</th><th>Payment</th><th>Claimed by</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                <?php if (!$orders): ?>
                    <tr><td colspan="8">No WhatsApp orders yet.</td></tr>
                <?php endif; ?>
                <?php foreach ($orders as $order): ?>
                    <?php
                    $claimed_by_name = $order->get_meta('_tcwc_claimed_by_name');
                    $claimed_by_id = (int) $order->get_meta('_tcwc_claimed_by');
                    $mpesa_status = $order->get_meta('_tcwc_mpesa_status');
                    $phone = $order->get_billing_phone();
                    $phone_digits = preg_replace('/\D+/', '', (string) $phone);
                    ?>
                    <tr data-order-id="<?php echo esc_attr($order->get_id()); ?>">
                        <td><a href="<?php echo esc_url($order->get_edit_order_url()); ?>">#<?php echo esc_html($order->get_order_number()); ?></a></td>
                        <td><?php echo esc_html($order->get_date_created() ? $order->get_date_created()->date('M j, H:i') : ''); ?></td>
                        <td>
                            <?php echo esc_html($order->get_billing_first_name()); ?><br>
                            <?php if ($phone_digits): ?><a href="https://wa.me/<?php echo esc_attr($phone_digits); ?>" target="_blank" rel="noopener"><?php echo esc_html($phone); ?></a><?php endif; ?>
                        </td>
                        <td><?php echo wp_kses_post($order->get_formatted_order_total()); ?></td>
                        <td><?php echo esc_html(wc_get_order_status_name($order->get_status())); ?></td>
                        <td><?php echo $mpesa_status ? esc_html(ucfirst($mpesa_status)) : '—'; ?></td>
                        <td class="tcwc-claimed-cell">
                            <?php if ($claimed_by_name): ?>
                                <?php echo esc_html($claimed_by_name); ?>
                                <?php if ($claimed_by_id === $current_user_id): ?>
                                    <button type="button" class="button-link tcwc-unclaim" data-order-id="<?php echo esc_attr($order->get_id()); ?>">(release)</button>
                                <?php endif; ?>
                            <?php else: ?>
                                <button type="button" class="button button-small tcwc-claim" data-order-id="<?php echo esc_attr($order->get_id()); ?>">Claim</button>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($mpesa_status && $mpesa_status !== 'success'): ?>
                                <button type="button" class="button button-small tcwc-recheck-mpesa" data-order-id="<?php echo esc_attr($order->get_id()); ?>">Recheck payment</button>
                            <?php endif; ?>
                            <?php if (!$order->has_status(['completed', 'cancelled', 'refunded'])): ?>
                                <button type="button" class="button button-small tcwc-mark-complete" data-order-id="<?php echo esc_attr($order->get_id()); ?>">Mark complete</button>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
}
