<?php
if (!defined('ABSPATH')) exit;

class TCWC_Storefront {
    public static function init() {
        add_action('wp_enqueue_scripts', [__CLASS__, 'assets']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'floating_button_assets']);
        add_action('wp_footer', [__CLASS__, 'render_floating_button']);
        add_action('woocommerce_after_add_to_cart_button', [__CLASS__, 'product_button'], 20);
        add_action('woocommerce_after_cart', [__CLASS__, 'cart_button'], 20);

        /**
         * Belt-and-braces manual placement. Many themes (WoodMart's Elementor
         * "Single Product" template builder, custom product-summary layouts,
         * WooCommerce's block-based Cart page, etc.) never call
         * woocommerce_after_add_to_cart_button / woocommerce_after_cart at
         * all, so the hook-based output below simply never fires — the PHP
         * runs fine, there's just nothing listening for it. This shortcode
         * lets the button be dropped in directly wherever the page builder
         * allows a shortcode/HTML widget.
         */
        add_shortcode('tcwc_button', [__CLASS__, 'shortcode_button']);
    }

    public static function assets() {
        if (!is_product() && !is_cart()) return;
        wp_enqueue_style('tcwc', TCWC_URL . 'assets/css/tcwc.css', [], TCWC_VERSION);
        wp_enqueue_script('tcwc', TCWC_URL . 'assets/js/tcwc.js', ['jquery'], TCWC_VERSION, true);

        $product_in_stock = true;
        if (is_product()) {
            $current_product = wc_get_product(get_the_ID());
            $product_in_stock = $current_product ? $current_product->is_in_stock() : true;
        }

        wp_localize_script('tcwc', 'TCWC', [
            'ajax' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tcwc_nonce'),
            'phone' => TCWC_Settings::get('phone'),
            'currency' => get_woocommerce_currency(),
            'buttonText' => TCWC_Settings::get('button_text','Order on WhatsApp'),
            'mpesaEnabled' => TCWC_Settings::get('mpesa_enabled', 'no') === 'yes',
            // Needed client-side so the JS fallback below knows whether it's
            // allowed to inject the button/box, and which product it's for.
            'showProductButton' => TCWC_Settings::get('show_product_button','yes') === 'yes',
            'showCartButton' => TCWC_Settings::get('show_cart_button','yes') === 'yes',
            'currentProductId' => is_product() ? get_the_ID() : 0,
            // v0.6 milestone 5: whether to render the order button or the
            // "notify me" form on the product page fallback path.
            'productInStock' => $product_in_stock,
            'backInStockEnabled' => TCWC_Settings::get('automation_back_in_stock_enabled', 'no') === 'yes',
        ]);
    }

    /**
     * Site-wide floating WhatsApp button. Deliberately a separate, tiny
     * stylesheet and no JS dependency at all (it's a plain <a href="wa.me/...">,
     * not tied to the modal/cart/product flow above) so it can safely load on
     * every front-end page — home, blog posts, custom page-builder pages,
     * checkout, everywhere — without pulling in the full modal-checkout bundle.
     */
    public static function floating_button_assets() {
        if (is_admin()) return;
        if (TCWC_Settings::get('floating_button_enabled', 'yes') !== 'yes') return;
        if (!TCWC_Settings::get('phone')) return;
        wp_enqueue_style('tcwc-float', TCWC_URL . 'assets/css/tcwc-float.css', [], TCWC_VERSION);
    }

    public static function render_floating_button() {
        if (is_admin()) return;
        if (TCWC_Settings::get('floating_button_enabled', 'yes') !== 'yes') return;

        $phone = TCWC_Settings::get('phone');
        if (!$phone) return; // nothing to link to — stay invisible rather than show a dead button

        $position = TCWC_Settings::get('floating_button_position', 'right') === 'left' ? 'left' : 'right';
        $message = TCWC_Settings::get('floating_button_message', 'Hi! I have a question about your products.');
        $url = 'https://wa.me/' . rawurlencode($phone) . '?text=' . rawurlencode($message);
        ?>
        <a href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener" class="tcwc-float-btn tcwc-float-<?php echo esc_attr($position); ?>" aria-label="Chat with us on WhatsApp">
            <span class="tcwc-float-icon" aria-hidden="true"></span>
        </a>
        <?php
    }

    /** Markup shared by the hook output and the shortcode. */
    private static function render_product_button_html($product_id) {
        $size = TCWC_Settings::get('button_size', 'medium');
        $size_class = $size === 'medium' ? '' : ' tcwc-size-' . $size;
        ob_start();
        ?>
        <button type="button" class="button tcwc-product-btn<?php echo esc_attr($size_class); ?>" id="tcwc-product-btn"
            data-product-id="<?php echo esc_attr($product_id); ?>">
            <?php echo esc_html(TCWC_Settings::get('button_text','Order on WhatsApp')); ?>
        </button>
        <div id="tcwc-product-note" class="tcwc-note" aria-live="polite"></div>
        <?php
        return ob_get_clean();
    }

    /**
     * v0.6 milestone 5: "notify me when back in stock" capture form, shown
     * instead of the order button on out-of-stock products. Submits via AJAX
     * to TCWC_Automation::subscribe_back_in_stock(), which stores the
     * request on the product itself and clears it the moment stock is
     * restored (see class-tcwc-automation.php).
     */
    private static function render_notify_form_html($product_id) {
        ob_start();
        ?>
        <form class="tcwc-notify-form" id="tcwc-notify-form" data-product-id="<?php echo esc_attr($product_id); ?>">
            <input type="tel" name="phone" class="tcwc-notify-input" placeholder="Your phone number" required>
            <button type="submit" class="button tcwc-notify-btn">Notify me when back in stock</button>
        </form>
        <div id="tcwc-notify-note" class="tcwc-note" aria-live="polite"></div>
        <?php
        return ob_get_clean();
    }

    /**
     * [tcwc_button] — manual placement for themes/page builders that don't
     * run the standard woocommerce_after_add_to_cart_button /
     * woocommerce_after_cart hooks. Drop this into an Elementor HTML widget,
     * a WoodMart product-template text block, a Cart block "shortcode"
     * element, etc.
     */
    public static function shortcode_button() {
        if (is_product()) {
            global $product;
            if (!$product) {
                $product = wc_get_product(get_the_ID());
            }
            if (!$product) return '';

            if (!$product->is_in_stock()) {
                if (TCWC_Settings::get('automation_back_in_stock_enabled', 'no') !== 'yes') return '';
                return self::render_notify_form_html($product->get_id());
            }

            if (TCWC_Settings::get('show_product_button','yes') !== 'yes') return '';
            if (!$product->is_purchasable()) return '';
            return self::render_product_button_html($product->get_id());
        }

        if (is_cart()) {
            if (TCWC_Settings::get('show_cart_button','yes') !== 'yes') return '';
            if (WC()->cart->is_empty()) return '';
            ob_start();
            ?>
            <div class="tcwc-cart-box">
                <button type="button" class="button alt tcwc-cart-btn" id="tcwc-cart-btn">Checkout on WhatsApp</button>
                <div id="tcwc-cart-note" class="tcwc-note" aria-live="polite"></div>
            </div>
            <?php
            return ob_get_clean();
        }

        return '';
    }

    public static function product_button() {
        global $product;
        if (!$product) return;

        if (!$product->is_in_stock()) {
            if (TCWC_Settings::get('automation_back_in_stock_enabled', 'no') !== 'yes') return;
            echo self::render_notify_form_html($product->get_id());
            return;
        }

        if (TCWC_Settings::get('show_product_button','yes') !== 'yes') return;
        if (!$product->is_purchasable()) return;
        echo self::render_product_button_html($product->get_id());
    }

    public static function cart_button() {
        if (TCWC_Settings::get('show_cart_button','yes') !== 'yes') return;
        if (WC()->cart->is_empty()) return;
        ?>
        <div class="tcwc-cart-box">
            <button type="button" class="button alt tcwc-cart-btn" id="tcwc-cart-btn">Checkout on WhatsApp</button>
            <div id="tcwc-cart-note" class="tcwc-note" aria-live="polite"></div>
        </div>
        <?php
    }
}
