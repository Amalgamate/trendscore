# Trends CORE WhatsApp Commerce 0.7.1

A WooCommerce WhatsApp-first shopping foundation — branded UI on the storefront and admin, plus an optional official WhatsApp Cloud API layer for two-way messaging.

## Requirements
- WordPress 6.4+
- WooCommerce active
- PHP 7.4+
- For Cloud API features only: a Meta for Developers app with WhatsApp product added, a permanent (System User) access token, and a public HTTPS URL (this plugin's webhook won't verify over plain HTTP).

## Installation
1. WordPress Admin -> Plugins -> Add New Plugin -> Upload Plugin.
2. Upload the plugin as a `.zip` (zip the `trendscore-whatsapp-commerce` folder — see packaging note below).
3. Activate.
4. Go to WooCommerce -> WhatsApp Commerce.
5. Enter the WhatsApp number in international format, e.g. 254712345678, and save.
6. (Optional) Open the **Cloud API** tab to connect Meta's official API — see below.

> **Packaging note:** these updates were made directly on disk via a filesystem connector, which can read and write files but cannot run shell commands or create archives. Zip the `trendscore-whatsapp-commerce` folder yourself (Windows: right-click -> Send to -> Compressed (zipped) folder) before uploading through the WordPress plugin uploader — or upload the folder directly via FTP/SFTP to `wp-content/plugins/`, which needs no zip at all.

## What's new in 0.7.1 — site-wide floating button &amp; button sizing
- **Floating WhatsApp button**: a round, fixed-position button (bottom-right by default) now renders on every front-end page — not just Shop/Product/Cart — via its own tiny stylesheet with no JS dependency (a plain `wa.me` link, so it works even if something else on the page breaks). Configurable position (left/right), pre-filled message, and an on/off toggle, all in the **Storefront** tab. Stays invisible if no WhatsApp number is set rather than showing a dead button.
- **Product button size**: the existing per-product "Order on WhatsApp" button now has a Small / Medium / Large setting, plus a CSS fix (`width:auto !important`) so it no longer inherits a theme's `width:100%` override on `.button` elements — several themes apply that to WooCommerce's add-to-cart button, which was stretching this one full-width too.

## What's new in 0.7.0 — AI shopping assistant
The last item on the original roadmap. Optional, and additive on top of everything else: requires Cloud API to be enabled/configured (to send replies) and an Anthropic API key + model name in the new **AI Assistant** tab.

- **New `includes/class-tcwc-ai-assistant.php`**, hooked into the same `tcwc_inbound_message` action the Catalogue module already uses — so this only ever sees messages that aren't an interactive menu tap and aren't an exact menu keyword ("menu"/"catalog"/"shop"), which TCWC_Catalog continues to own unchanged.
- **Natural-language product search**: a message like "show me black dresses under 3,000" is sent to the Anthropic Messages API with a small, store-aware system prompt and asked for a structured JSON intent (search keywords, category, min/max price, or a hand-off/chitchat decision) — no chat history is kept, each message is judged on its own. Matches are pulled from real WooCommerce product data (`wc_get_products()` with a price-range meta query and category matching), then sent back as a native WhatsApp product-list message if a catalog is connected, or a plain-text name/price/link list otherwise. The AI is explicitly instructed never to invent product names, prices, or stock claims itself.
- **Human hand-off**: triggered by an explicit keyword (default `agent, human, help, talk to someone, speak to someone`), by the AI's own judgement (frustration, complaints, order issues), or automatically after a configurable number of unclear/no-result replies in a row (default 2, within a rolling hour). Once handed off, the bot goes silent on that conversation for a few days or until the customer asks for the menu again — with an optional WhatsApp notification to your own number when it happens.
- **Settings**: API key (encrypted at rest, same save/clear pattern as every other credential in this plugin) and model name (a plain text field, since Anthropic's current model names change over time and aren't hardcoded here), hand-off keywords/threshold/notice text, an optional "store voice" instructions field, a "Run test" tool that shows how a sample message would be classified and which products would match without sending anything over WhatsApp, and a "Recent conversations" log.

**Still manual / not code-level:** obtaining an Anthropic API key and picking a current model string — both need a live Anthropic Console account and can't be done from here.

## What's new in 0.6.x — Automation (all 5 v0.6 milestones, now complete)
Requires Cloud API to be enabled and configured, plus a Meta-**approved** message template per milestone (submit templates from the Catalogue tab). Every milestone is independently toggled and additive — nothing here changes checkout or order behavior when left off.

1. **Order confirmation** — sends the moment a WhatsApp-checkout order reaches its initial On-hold status. Template variables: `{{1}}` name, `{{2}}` order number, `{{3}}` total. Won't re-send if the order re-enters On-hold later.
2. **Payment status** — fires on every M-Pesa callback *and* every manual "Recheck payment status" click (see the M-Pesa order-screen panel), whether or not that changes the order's WooCommerce status — so a customer who abandons the STK PIN prompt still hears back. Template variables: `{{1}}` name, `{{2}}` order number, `{{3}}` a status line (e.g. "Payment received — receipt ABC123" or "Payment was not completed"). Keyed by result, not just "sent once": a failed attempt followed by a successful retry notifies for both, but repeating the *same* result (a Safaricom retry, clicking recheck twice) doesn't re-send.
3. **Delivery notification** — sends when an order reaches **Completed** — WooCommerce's closest built-in equivalent to "shipped"/"done". Template variables: `{{1}}` name, `{{2}}` order number.
4. **Abandoned-order recovery** — this plugin's checkout creates a real On-hold order the instant the modal is submitted, so "abandoned" here means "created, still On-hold, nothing has happened since" (never sent the WhatsApp message, went quiet, or bailed on the M-Pesa PIN). A self-healing hourly cron (re-scheduled on every request if missing, since FTP-style plugin updates don't re-fire the activation hook) checks orders past a configurable threshold (default 6h) and sends **one** reminder with a payment link — never repeats, and only ever touches orders this plugin itself created. Template variables: `{{1}}` name, `{{2}}` order number, `{{3}}` payment link.
5. **Back-in-stock alerts** — an out-of-stock product page shows a "Notify me when back in stock" phone-number form in place of the order button (both via the normal hook and a JS fallback for themes/page builders that skip WooCommerce's standard hooks). The moment the product's own stock status flips back to in-stock, every subscriber gets a WhatsApp message, once each, then the list is cleared. Scoped to the parent product's stock status — a single variation (e.g. one size) restocking while others stay out isn't covered yet. Template variables: `{{1}}` generic greeting ("there" — no name is collected on this form), `{{2}}` product name, `{{3}}` product link.

All five live in the **Automation** tab, each with its own enable toggle, template-name/language fields, a live "configured?" callout, and a shared "Recent sends" log (event, order, status, detail — last 20).

## What's new in 0.5.0 — Interactive WhatsApp catalogue
Requires Cloud API (0.3+) to be enabled and configured. Entirely opt-in and additive — nothing here is required for the click-to-chat or Cloud API flows to keep working.

- **New `includes/class-tcwc-catalog.php`** and a new **Catalogue** settings tab covering three pieces:
  1. **Catalog sync** — pushes WooCommerce products into a connected Meta Commerce Catalog via the Graph API `items_batch` endpoint. Trigger a full sync with the "Sync all products now" button, or turn on "Auto-sync on product save" to push a product every time it's created/updated and remove it when trashed. A "Recent syncs" log shows the last few runs (synced/failed counts).
  2. **Interactive WhatsApp menu** — when enabled, a customer messaging one of your configured keywords (default: `menu`, `catalog`, `shop`) gets a native tappable list of your top-level product categories; picking one returns a native WhatsApp product-list message (photos, prices, in-chat "view/add") for that category's products, sourced from the catalog synced above. No session state is kept — every reply carries its own id, so it can't lose context between messages.
  3. **Message templates** — list existing WhatsApp message templates and submit new ones (name, category, language, body with `{{1}}`-style variables) for Meta's review, directly from the settings screen. Needed to message a customer outside the 24h free-form window — e.g. the order/delivery notifications planned for v0.6. Submitting only sends the template for review; approval itself happens on Meta's side.
- New settings: Catalog ID, auto-sync toggle, interactive-menu toggle + trigger keywords — all under WooCommerce → WhatsApp Commerce → Catalogue.

**Still manual / not code-level:** connecting a Meta Commerce Catalog to your WABA in Commerce Manager, and getting a submitted template actually approved by Meta — both need a live Meta Business/WhatsApp setup and can't be completed from here.

## What's new in 0.4.0 — M-Pesa STK Push (Phase 1)
Payment happens without ever leaving the WhatsApp-initiated checkout modal, tied to the same WooCommerce order object the plugin already creates.

- **New `includes/class-tcwc-mpesa.php`**: Daraja OAuth token fetch with hourly caching, STK Push request, an async callback receiver at `/wp-json/tcwc/v1/mpesa-callback`, and a status-query fallback for when the callback doesn't arrive.
- **New "M-Pesa" settings tab**: environment toggle (sandbox/live), Shortcode + type (PayBill/Till), Consumer Key/Secret and Passkey (secrets encrypted at rest, same pattern as the Cloud API tab), the callback URL to register with Daraja, and a "Recent STK Push attempts" log.
- **Checkout flow**: the WhatsApp checkout modal now offers "Confirm on WhatsApp" (unchanged v0.2/v0.3 behaviour) or "Pay with M-Pesa now" when enabled. Choosing M-Pesa fires the STK Push, shows a "check your phone" state, and polls for the payment result — succeeding order flows still open WhatsApp afterwards for the human-facing receipt, per the original plan. A stuck or failed push offers "Try again" or "Continue via WhatsApp instead" so the sale is never blocked.
- **Order status flow**: `on-hold` → STK sent (`pending`) → `processing`/`paid` via `$order->payment_complete()` on a successful callback, or a logged `failed` status with the M-Pesa result description on decline/timeout/cancellation.
- **Admin visibility**: the order edit screen shows an M-Pesa panel (status, phone, receipt number) with a "Recheck payment status" button that queries Daraja directly — the real-world fallback for a callback that never arrives.
- Entirely opt-in and additive, like the Cloud API layer: disabled by default, and the existing click-to-chat flow is unaffected either way.

## What's new in 0.3.1 — Phase 0 hardening
Code-level fixes from the pre-v0.4 hardening pass (see PROJECT_COMPLETION_PLAN / roadmap doc, Phase 0):
- **Credentials encrypted at rest.** `cloud_api_access_token` and `cloud_api_app_secret` are now encrypted with AES-256-CBC before being saved to `wp_options`, keyed off your site's own `AUTH_KEY`/`SECURE_AUTH_KEY` salts (from `wp-config.php`). They're transparently decrypted on read, so nothing elsewhere in the plugin changes.
- **No more plaintext-in-page-source.** The token and app secret fields used to echo the live value straight into the password input's `value` attribute (visible in page source to anyone with view-source access). They now render blank with a "saved — leave blank to keep it" placeholder, plus an explicit checkbox if you want to clear a stored credential.
- **Explicit HPOS compatibility declaration.** Order creation was already using only `wc_create_order()`/`$order->save()` (HPOS-safe), but the plugin now calls `FeaturesUtil::declare_compatibility()` so WooCommerce stops showing the "unknown compatibility" warning.
- **Real Connection health check.** The Cloud API tab has a new "Check connection" button that calls Meta's Graph API directly (`GET /{phone-number-id}?fields=display_phone_number,verified_name,quality_rating`) — so "configured" now means the token and Phone Number ID actually work, not just that the fields are non-empty.

**Still manual / not code-level:** the rest of Phase 0 (connecting a real Meta app, running the webhook verification handshake end-to-end, sending a real test WhatsApp message, confirming a forged webhook POST gets rejected) needs you to actually click through Meta for Developers and a live WordPress install — that part can't be done from here.

## What's new in 0.3.0 — Cloud API foundation
- **New `includes/class-tcwc-cloud-api.php`**: a REST webhook endpoint (`/wp-json/tcwc/v1/webhook`) that handles Meta's verification handshake, validates the `X-Hub-Signature-256` header once an App Secret is set, logs inbound messages and delivery statuses via `WC_Logger` (source `tcwc-cloud-api`), and a `send_text()` client for outbound messages via the Graph API.
- **New "Cloud API" settings tab**: Phone Number ID, WABA ID, permanent access token, app secret, an auto-generated verify token with a one-click regenerate button, the webhook URL ready to paste into Meta, and a "send test message" tool — all wired up via `fetch()`/`wp_ajax`.
- **Optional admin notification**: when enabled, a new order also pushes the order summary straight to your own WhatsApp via the Cloud API, in addition to the customer's existing click-to-chat message. This never blocks checkout — failures are logged, not surfaced to the customer.
- The v0.2 click-to-chat (`wa.me`) flow is completely unchanged and still works with zero configuration; Cloud API is entirely opt-in.

### Cloud API delivery window — read this before testing
WhatsApp only allows free-form business-initiated text messages within 24 hours of that number last messaging your business number. Outside that window, Meta requires a pre-approved message template (not yet built — planned alongside v0.5 automation). To test "Notify me on WhatsApp" or the "Send test message" tool, message your own Cloud-API-connected business number from the target phone first to open that window.

## What's new in 0.2.0
- Storefront: WhatsApp-branded pill buttons, modal checkout (floating-label inputs, inline validation, loading spinner, animated success state) replacing the old plain inline form.
- Admin settings: tabbed layout, toggle switches, connection-status pill, live phone-mockup preview of the WhatsApp message template.

## Current feature set
- Product-page WhatsApp button with modal checkout
- Variable-product selection through WooCommerce's normal variation form
- Cart -> WhatsApp checkout
- WooCommerce order creation (status: On hold), stock-aware
- Order number + itemised total in the WhatsApp message
- Redesigned, tabbed admin settings with live message preview
- Optional: official WhatsApp Cloud API webhook + outbound messaging + admin order notifications
- Optional: M-Pesa STK Push straight from the checkout modal, with order-screen payment status and a manual recheck fallback
- Optional: Meta Commerce Catalog sync, an in-chat category/product browsing menu, and message-template submission
- Optional: full order-lifecycle WhatsApp automation — confirmation, payment status, delivery, abandoned-order recovery, back-in-stock alerts
- Optional: an AI shopping assistant for natural-language product search and human hand-off over WhatsApp

## Known limitation
The product-page variable-product button still uses WooCommerce's normal add-to-cart flow before opening WhatsApp (the v0.5 interactive menu covers browsing/discovery in-chat, not variation selection or an in-chat cart — that's still a future module).

## Roadmap
All originally planned phases (v0.2 through v0.7) are now shipped. Future work beyond this would be new scope rather than a continuation of the existing roadmap — e.g. in-chat variation selection/cart (noted under Known limitation above), multi-turn AI conversation memory, or WhatsApp Flows for structured checkout forms.

## Competitive note
Most WordPress "WhatsApp for WooCommerce" plugins are click-to-chat bridges only — they open a chat window but don't create an order or touch stock. This plugin creates a real WooCommerce order with variation/stock awareness, has the same official-API foundation as top commercial tools like WANotifier (v0.3), does STK Push payment straight from the checkout modal (v0.4), syncs a real product catalog with in-chat category/product browsing (v0.5), runs the full order-lifecycle notification set on approved templates (v0.6), and as of v0.7 answers natural-language WhatsApp messages with real product search and hands off to a person when it should — covering the same ground as a dedicated WhatsApp commerce SaaS, from a single WordPress plugin.
