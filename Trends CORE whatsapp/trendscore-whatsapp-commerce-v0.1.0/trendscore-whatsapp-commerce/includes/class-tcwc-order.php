<?php
if (!defined('ABSPATH')) exit;

class TCWC_Order {
    public static function init() {
        add_action('wp_ajax_tcwc_create_order', [__CLASS__, 'create_order']);
        add_action('wp_ajax_nopriv_tcwc_create_order', [__CLASS__, 'create_order']);
        add_action('wp_ajax_tcwc_get_product', [__CLASS__, 'get_product']);
        add_action('wp_ajax_nopriv_tcwc_get_product', [__CLASS__, 'get_product']);
        add_action('wp_ajax_tcwc_get_cart', [__CLASS__, 'get_cart']);
        add_action('wp_ajax_nopriv_tcwc_get_cart', [__CLASS__, 'get_cart']);
        add_action('wp_ajax_tcwc_add_to_cart', [__CLASS__, 'add_to_cart']);
        add_action('wp_ajax_nopriv_tcwc_add_to_cart', [__CLASS__, 'add_to_cart']);
    }

    private static function verify() {
        check_ajax_referer('tcwc_nonce', 'nonce');
    }

    public static function get_product() {
        self::verify();
        $id = absint($_POST['product_id'] ?? 0);
        $product = wc_get_product($id);
        if (!$product) wp_send_json_error(['message'=>'Product not found.'], 404);

        $data = [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'type' => $product->get_type(),
            'price' => wc_get_price_to_display($product),
            'currency' => get_woocommerce_currency(),
            'stock_status' => $product->get_stock_status(),
            'purchasable' => $product->is_purchasable(),
            'variations' => []
        ];

        if ($product->is_type('variable')) {
            foreach ($product->get_children() as $vid) {
                $v = wc_get_product($vid);
                if (!$v || !$v->exists()) continue;
                $data['variations'][] = [
                    'id'=>$v->get_id(),
                    'attributes'=>$v->get_attributes(),
                    'price'=>wc_get_price_to_display($v),
                    'stock_status'=>$v->get_stock_status(),
                    'stock_quantity'=>$v->get_stock_quantity(),
                    'purchasable'=>$v->is_purchasable(),
                ];
            }
        }
        wp_send_json_success($data);
    }

    public static function add_to_cart() {
        self::verify();
        $product_id = absint($_POST['product_id'] ?? 0);
        $variation_id = absint($_POST['variation_id'] ?? 0);
        $qty = max(1, absint($_POST['quantity'] ?? 1));
        $variation = [];

        if (!$product_id) wp_send_json_error(['message'=>'Product not found.'], 400);

        if ($variation_id) {
            $variation_product = wc_get_product($variation_id);
            if (!$variation_product) wp_send_json_error(['message'=>'Selected variation not found.'], 404);
            $variation = $variation_product->get_attributes();
        }

        $added = WC()->cart->add_to_cart($product_id, $qty, $variation_id, $variation);
        if (!$added) {
            wp_send_json_error(['message'=>'That product or variation is not currently available.'], 400);
        }

        wp_send_json_success(['cart_url'=>wc_get_cart_url()]);
    }

    public static function get_cart() {
        self::verify();
        $items = [];
        foreach (WC()->cart->get_cart() as $item) {
            $p = $item['data'];
            $items[] = [
                'product_id'=>$item['product_id'],
                'variation_id'=>$item['variation_id'],
                'name'=>$p->get_name(),
                'qty'=>$item['quantity'],
                'line_total'=>$item['line_total'],
                'sku'=>$p->get_sku(),
                'variation'=>$item['variation'],
            ];
        }
        wp_send_json_success(['items'=>$items,'total'=>WC()->cart->get_total('edit')]);
    }

    public static function create_order() {
        self::verify();
        if (!function_exists('wc_create_order')) wp_send_json_error(['message'=>'WooCommerce is unavailable.'], 500);

        $name = sanitize_text_field($_POST['name'] ?? '');
        $phone = sanitize_text_field($_POST['phone'] ?? '');
        $address = sanitize_textarea_field($_POST['address'] ?? '');
        $email = sanitize_email($_POST['email'] ?? '');
        if (!$name || !$phone) wp_send_json_error(['message'=>'Name and phone are required.'], 400);

        $order = wc_create_order();
        $order->set_created_via('trendscore_whatsapp');

        $order->set_billing_first_name($name);
        $order->set_billing_phone($phone);
        if ($email) $order->set_billing_email($email);
        if ($address) {
            $order->set_billing_address_1($address);
            $order->set_shipping_address_1($address);
        }

        $items = WC()->cart->get_cart();
        if (!$items) wp_send_json_error(['message'=>'Your cart is empty.'], 400);

        foreach ($items as $item) {
            $order->add_product($item['data'], $item['quantity'], [
                'variation' => $item['variation'],
                'totals' => [
                    'subtotal' => $item['line_subtotal'],
                    'subtotal_tax' => $item['line_subtotal_tax'],
                    'total' => $item['line_total'],
                    'tax' => $item['line_tax'],
                ],
            ]);
        }

        $order->calculate_totals();
        $order->add_order_note('Order created through Trends CORE WhatsApp Commerce.');
        $order->update_status('on-hold');
        $order->save();

        $lines = [];
        foreach ($order->get_items() as $item) {
            $lines[] = $item->get_name() . ' x' . $item->get_quantity() . ' - ' . wp_strip_all_tags(wc_price($item->get_total(), ['currency'=>$order->get_currency()]));
        }

        $msg = TCWC_Settings::get('message_intro','Hello! I would like to order:') . "\n\n";
        $msg .= implode("\n", $lines);
        $msg .= "\n\nOrder: #" . $order->get_order_number();
        $msg .= "\nTotal: " . wp_strip_all_tags(wc_price($order->get_total(), ['currency'=>$order->get_currency()]));
        $msg .= "\nName: " . $name;
        $msg .= "\nPhone: " . $phone;
        if ($address) $msg .= "\nDelivery: " . $address;

        $phone_to = preg_replace('/\D+/', '', TCWC_Settings::get('phone'));
        $url = 'https://wa.me/' . $phone_to . '?text=' . rawurlencode($msg);

        WC()->cart->empty_cart();

        // Optional (v0.3): also push the order straight to the shop owner's own
        // WhatsApp via the Cloud API. This never blocks or fails the checkout —
        // TCWC_Cloud_API::send_text() logs any failure and returns quietly.
        if (
            class_exists('TCWC_Cloud_API')
            && TCWC_Settings::get('cloud_api_enabled') === 'yes'
            && TCWC_Settings::get('cloud_api_notify_admin') === 'yes'
        ) {
            $admin_number = TCWC_Settings::get('cloud_api_admin_number');
            if ($admin_number) {
                TCWC_Cloud_API::send_text($admin_number, "New order via storefront:\n\n" . $msg);
            }
        }

        wp_send_json_success([
            'order_id'=>$order->get_id(),
            'order_number'=>$order->get_order_number(),
            'whatsapp_url'=>$url,
            'message'=>$msg,
        ]);
    }
}
