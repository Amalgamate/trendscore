# Trends CORE WhatsApp Commerce — Completion Plan

**Plugin location:** `Trends CORE whatsapp\trendscore-whatsapp-commerce-v0.1.0\trendscore-whatsapp-commerce\`
**Current version:** 0.8.5
**Live site:** ventukenya.com (WordPress + WooCommerce + WoodMart theme)
**Last self-check:** 2026-09-15 — Baileys evaluated and **decided against** (see §7a — research kept for reference, not deleted). Built v1 of the WhatsApp conversation inbox instead, directly on the official Cloud API only: real persistent `wp_tcwc_conversations` / `wp_tcwc_messages` tables (§7b), a two-pane admin inbox page with claim-on-reply, the 24h-window guard, and delivery-status ticks (§7c). PHP linted clean (`php -l`) and JS syntax-checked (`node --check`) before being written to disk, but **none of it has touched the live site yet** — new item added to §0. Deferred from 2026-09-13 still applies: v0.7's live end-to-end test (real inbound message + hand-off) has not been run — no second WhatsApp account available. That gap now also blocks verifying the inbox's inbound side, since both rely on the same webhook.

This doc is the single source of truth for what's actually done vs. outstanding.
Update it — don't just remember it — every time a milestone below is finished or
a new gap is found. One item fully resolved and verified before moving to the next.

---

## 0. Open loop — verify before anything else

- [ ] **Verify the Staff tab and Orders dashboard on the live site (v0.8).**
  Steps 1–3 confirmed live 2026-09-13 (screenshot): Staff tab panel displays
  correctly, a test staff member ("Test M") was added via the Settings tab
  and the row appeared without a page reload. **Note:** the live-preview
  panel in that screenshot also showed "Cloud API is enabled but missing a
  Phone Number ID or access token" — separate from the Staff tab itself,
  but flagged here so it isn't lost; needs the Connection tab filled in
  before any Cloud API send will work. Remaining steps:
  4. Log in as the test staff account, confirm they land straight on the
     WhatsApp Orders dashboard (now the sidebar's only visible item — see
     the 0.8.2 sidebar change below) and can claim an order, add a note,
     recheck an M-Pesa payment, and mark an order complete — but cannot
     see the Settings page or anything else in the sidebar.
  5. Remove the staff member from the Settings tab, confirm the row disappears
     and their WordPress login still works (just without the WhatsApp Staff role).

- [ ] **Verify the 0.8.3 menu consolidation on the live site.**
  Code-complete, not yet deployed/tested. The whole plugin now lives behind
  one top-level "WhatsApp Commerce" sidebar item with two submenus (Orders,
  Settings), forced to sit right after Dashboard, with login/dashboard
  redirects sending anyone who can see it straight to Orders. Steps:
  1. Deploy the updated `trendscore-whatsapp-commerce` folder.
  2. As admin, confirm a single "WhatsApp Commerce" top-level sidebar item
     appears right after Dashboard, expanding to "Orders" and "Settings".
  3. As admin, log out and back in (or visit `/wp-admin/` directly) —
     confirm it lands you on Orders, not the default WP dashboard.
  4. Log in as the test staff account — confirm the sidebar shows *only*
     "WhatsApp Commerce" → "Orders" (no "Settings" submenu, no Dashboard,
     Posts, Media, WooCommerce, etc.), and that login lands them there too.
  5. Confirm order edit links ("#1234" in the orders table) still open
     correctly, and that the Settings page's own "Open the WhatsApp Orders
     dashboard" link and all its tabs still work as before — only the menu
     location changed, not the page content, but worth confirming since
     this is exactly the kind of thing that's easy to break silently.

- [ ] **Verify the WhatsApp Inbox on the live site (v0.9, built 2026-09-15).**
  Code-complete and lint/syntax-checked, but genuinely untested against a
  live database or real webhook traffic — nothing here is "done" until
  confirmed. Steps:
  1. Deploy the updated `trendscore-whatsapp-commerce` folder.
  2. Load any wp-admin page once as an admin — confirms `wp_tcwc_conversations`
     / `wp_tcwc_messages` were actually created (`ensure_tables()` runs on
     every `TCWC_Inbox::init()`, not just activation; check the site's table
     list if unsure).
  3. Open WhatsApp Commerce → Inbox as admin — confirm the two-pane layout
     renders and shows "No conversations yet" rather than an error.
  4. Send the connected business number a real WhatsApp message from a
     separate phone — confirm it appears in the Inbox list within ~6s
     (poll interval) with a correct preview and unread badge.
  5. Click the conversation, confirm the thread loads, the unread badge
     clears, and the 24h-window banner is absent (message just arrived).
  6. Reply from the Inbox — confirm it arrives on the test phone, the
     conversation auto-claims to the replying user, and a ✓ (or ✓✓ once
     Meta's delivery-status webhook lands) appears on the sent bubble.
  7. Log in as the test staff account — confirm they see the same
     conversation only after claiming or replying to it, and cannot see
     conversations claimed by someone else.
  8. Let a conversation sit unanswered for >24h (or fake it by editing
     `last_message_at`/message `created_at` directly in the DB for a test
     row) — confirm the composer is replaced by the window-closed notice
     and `ajax_send` rejects a forced request with the same message.

- [ ] **DEFERRED — Verify the AI shopping assistant end-to-end on the live site (v0.7).**
  Code-complete, never tested against a real inbound WhatsApp message from a
  second/external account — no such account currently available. Explicitly
  deferred by decision on 2026-09-13, not abandoned: development is allowed
  to continue on top of v0.7 (including the conversation-inbox work), but
  the hand-off queue this feeds must **not** be treated as verified until
  this is actually run. Revisit before, or immediately after, any release
  that depends on the "waiting for a person" queue being reliable. Steps
  when it is run:
  1. Enable it in the AI Assistant tab with a real Anthropic API key and model.
  2. Use "Test a message" in that tab to sanity-check intent parsing first.
  3. Send the real business number a free-text product query from a phone
     that isn't a saved test number, confirm a reply and (if catalog is
     configured) an interactive product list arrive.
  4. Send a hand-off keyword (e.g. "agent"), confirm the hand-off notice
     sends and the conversation shows up in the Staff Orders dashboard's
     "Waiting for a person" queue, and that "Mark resolved" clears it.

- [ ] **Confirm the storefront-visibility fix works on the live site.**
  Root cause identified: `product_button()` / `cart_button()` only fire on
  `woocommerce_after_add_to_cart_button` / `woocommerce_after_cart`, which
  WoodMart's Elementor product template (and/or WooCommerce's block-based
  Cart page) may never call.
  Fix shipped in 0.6.1: JS self-healing fallback injection (`assets/js/tcwc.js`)
  + manual `[tcwc_button]` shortcode (`class-tcwc-storefront.php`).
  **Not yet verified against the live site** — nothing here is "done" until
  confirmed. Steps:
  1. Re-zip the `trendscore-whatsapp-commerce` folder (not the `-v0.1.0` parent).
  2. Deploy via FTP/SFTP or plugin upload, replacing old files.
  3. Hard-refresh / purge cache (Hostinger + any CDN).
  4. View-source the product page → confirm `tcwc-product-btn` is present.
  5. Same for the cart page → confirm `tcwc-cart-btn`.
  6. If either is still missing after the JS fallback, place `[tcwc_button]`
     directly in the WoodMart product template via Elementor as the guaranteed
     fallback, and note that here.

- [ ] **Verify payment status + delivery notification milestones on the live site.**
  Both are wired through the same battle-tested Cloud API `send_raw()` path
  as order confirmation, but neither has been triggered by a real M-Pesa
  callback or a real order reaching Completed yet. Before trusting either:
  1. Submit `payment_status` and `delivery_notification` templates in the
     Catalogue tab (or reuse existing approved templates and just point the
     Automation-tab "Template name" fields at them) and get them approved by Meta.
  2. Turn on both toggles in the Automation tab.
  3. Run one real M-Pesa sandbox STK Push end to end — confirm the WhatsApp
     message arrives on both success and a deliberately failed/cancelled PIN entry.
  4. Mark a real test order Completed — confirm the delivery WhatsApp arrives once, not on every save.

- [ ] **Confirm the abandoned-order cron actually runs on the live host.**
  `wp_cron` on shared/managed hosting (Hostinger) is request-triggered by
  default, not a real system cron — if the site gets little traffic overnight,
  the hourly check may fire late or not at all. Options if it turns out to be
  unreliable: set up a real server cron hitting `wp-cron.php` on a schedule
  (Hostinger's hPanel has a cron-jobs section for this), or lower expectations
  on timing precision since a late nudge is still better than none.

- [ ] **Verify back-in-stock alerts on the live site.**
  1. Submit a `back_in_stock` template in the Catalogue tab and get it approved.
  2. Enable the toggle in the Automation tab.
  3. Find (or temporarily set) a real out-of-stock product, view its page, and
     confirm the notify-me form actually renders (same caveat as §0 — WoodMart's
     template may not fire the hook that renders it, so check whether the JS
     fallback catches it).
  4. Submit the form with a real phone number, then flip the product back to
     In stock in wp-admin and confirm the WhatsApp message arrives exactly once.

---

## 1. Shipped & considered done (code-complete; some need live re-verification after 0.6.4)

- [x] v0.2 — Modal checkout & branded UI
- [x] v0.3 — Official WhatsApp Cloud API (webhook receiver, signature verification, admin notify)
- [x] v0.3.1 — Phase 0 hardening (encrypted credentials at rest, no plaintext in page source, HPOS compatibility declared, real connection health check)
- [x] v0.4 — M-Pesa STK Push (Daraja OAuth, STK request, async callback + status-poll fallback, admin recheck panel)
- [x] v0.5 — Interactive WhatsApp catalogue (Meta Commerce Catalog sync, in-chat category/product browsing menu, message-template submission)
- [x] v0.6 milestone 1/5 — Automation: order confirmation on first `on-hold` transition, idempotent, logged
- [x] v0.6 milestone 2/5 — Automation: payment status notification, hooked into `tcwc_mpesa_payment_result` (fires on both the async callback and manual "Recheck payment status"), idempotent per-result, logged. **Code-complete, not yet live-tested with a real STK Push.**
- [x] v0.6 milestone 3/5 — Automation: delivery notification on order → `completed`, idempotent, logged. **Code-complete, not yet live-tested.**
- [x] v0.6 milestone 4/5 — Automation: abandoned-order recovery. Reframed from a classic "cart abandonment" (this plugin has no pre-order cart+contact capture stage — checkout submission immediately creates a real on-hold order) to "stale on-hold order nudge": a self-healing hourly `wp_cron` job (re-checks `wp_next_scheduled()` on every `init`, since this plugin is deployed by overwriting files via FTP rather than reactivating, so `register_activation_hook` alone would silently never schedule it on an update) finds on-hold orders past a configurable age threshold, sends one reminder with a link to WooCommerce's built-in guest "pay for this order" page (`$order->get_checkout_payment_url()`), never repeats. **Code-complete, not yet live-tested — cron firing itself needs confirming on the live host.**
- [x] v0.6 milestone 5/5 — Automation: back-in-stock alerts. A "Notify me when back in stock" form (phone number only) replaces the order button/shortcode/JS-fallback on any out-of-stock product page. Submits via a new `tcwc_subscribe_back_in_stock` AJAX endpoint, storing subscribers as post meta on the product. `woocommerce_product_set_stock_status` triggers the send the moment the product flips back to in-stock, then the subscriber list is cleared (one-shot, not retried). **Scoped to the parent product's own stock status only** — a single variation (e.g. one size) restocking while others stay out is not covered. **Code-complete, not yet live-tested.**
- [x] Fixed a latent bug found while in this file: `\u2014` inside single-quoted PHP strings doesn't resolve to an em dash (PHP only does that in double-quoted strings) — order notes were literally showing the text `\u2014`. Fixed across all four automation send methods.
- [x] v0.7 — AI shopping assistant: natural-language product search via the Anthropic Messages API (`class-tcwc-ai-assistant.php`), stateless per-turn intent classification (`product_search` / `handoff` / `other`), keyword- and AI-judgement-based human hand-off with a self-expiring mute per phone number, auto hand-off after N unclear replies in a row, and an admin "test a message" tool. **Code-complete, not yet live-tested** — see §0.
- [x] v0.8 — Staff accounts & order management: a limited `tcwc_staff` WordPress role (idempotently re-granted on every admin load), a dedicated WhatsApp Orders dashboard (order claiming/release, private notes, mark complete, M-Pesa recheck extended to staff capability, and the AI hand-off queue with "mark resolved"), and a Settings → Staff tab for adding/removing staff by email (`class-tcwc-staff.php`). **Two bugs found and fixed 2026-09-13** while verifying a prior session's handoff against the actual files, before any of it had been tested live: the Staff tab's CSS `:checked` selectors were missing from `tcwc-admin.css` (nav item and radio input existed but the panel never displayed), and the Settings-tab "Add staff"/"Remove" buttons had no JS handlers anywhere (`tcwc-staff.js` only loads on the Orders dashboard page, not Settings). Both fixed; version bumped 0.8.0 → 0.8.1. Staff tab + add-staff flow **confirmed live** 2026-09-13; rest still pending — see §0.
- [x] v0.8.2/0.8.3 — Menu consolidation: rather than two separate admin pages (a WooCommerce submenu for Settings, and a bolted-on top-level for Orders), the whole plugin now lives behind one top-level sidebar item, "WhatsApp Commerce" (`class-tcwc-staff.php::menu()`), with two submenus — "Orders" (default landing, same slug as the parent) and "Settings" (`class-tcwc-settings.php::menu()`, now parented to `tcwc-orders` instead of `woocommerce`). WordPress hides the Settings submenu automatically for anyone lacking `manage_woocommerce`, so WhatsApp Staff accounts see only Orders with no extra code. A `force_second_position()` routine reorders the rendered `$menu` array on a very late `admin_menu` hook so this sits right after Dashboard regardless of what position number other active plugins have already claimed — `add_menu_page()`'s numeric position argument alone isn't reliable on a site with this many plugins. Login and any visit to the default wp-admin dashboard now redirect anyone who can see this module (admin, shop manager, or staff) straight to Orders — it's the primary workspace now, not a side tool. **Code-complete, not yet live-tested** — see §0.
- [x] v0.9 milestone 1 — WhatsApp conversation inbox v1 (`class-tcwc-inbox.php`, new). Real persistent storage (`wp_tcwc_conversations` / `wp_tcwc_messages`, created idempotently on every load so an FTP-copied update doesn't need reactivation) replaces the rolling last-20 option-array logs for this purpose. Two new hooks make it possible: `tcwc_outbound_message` (fired from `TCWC_Cloud_API::send_raw()` on every successful send) and `tcwc_message_status` (fired from `handle_event()`'s statuses loop, previously logged-only) — both additive, nothing existing changed behavior. New "Inbox" submenu under WhatsApp Commerce: two-pane list + thread UI, ~5–6s AJAX polling, claim-on-first-reply (same one-owner idea as order claiming, keyed on phone instead of order ID), admin sees every conversation while staff see only their own claimed + the unclaimed pool, real ✓/✓✓ ticks from Meta's delivery-status callbacks, and a server-enforced (not just UI) 24-hour window check before allowing a free-form send. Built directly on `TCWC_Cloud_API` only — no provider abstraction, since Baileys was evaluated and not pursued (§7a). **Deferred to a later pass, not built in v1:** media (images/voice notes) shows as a `[image]`/`[voice note]` label rather than being fetched and displayed; outside the 24h window the UI blocks sending rather than offering to send an approved template; the periodic thread refresh can overwrite an unsent draft in the composer if a reply is left half-typed for more than ~5 seconds. **Code-complete, lint/syntax-checked, not yet live-tested** — see §0.

---

## 2. v0.6 — Automation (all 5 milestones shipped)

- [x] ~~Payment status notification~~ — done (see §1). Settings UI added: toggle, template name, language, with an inline warning if M-Pesa itself isn't enabled yet.
- [x] ~~Delivery notification~~ — done (see §1). Fires on `completed` (WooCommerce has no separate "shipped" status by default). Settings UI added.
- [x] ~~Abandoned-cart recovery~~ — done (see §1), scoped as "abandoned-order recovery" for this architecture. Settings UI added: toggle, hours-threshold, template name, language.
- [x] ~~Back-in-stock alerts~~ — done (see §1). Settings UI added: toggle, template name, language. New frontend capture form + AJAX endpoint + stock-restored hook.

v0.6 is now feature-complete pending live verification (see §0). Next: v0.7 AI shopping assistant.

---

## 3. v0.7 — AI shopping assistant (shipped, code-complete)

- [x] Natural-language product search / recommendations in-chat
  (e.g. "show me black dresses under 3,000")
- [x] Human-agent hand-off inside WhatsApp, feeding the v0.8 Staff dashboard's queue

See §1 for detail. Not yet live-tested — see §0.

---

## 4. Known limitations (carried forward, not yet scheduled)

- [ ] Variable-product selection on the product page still goes through
  WooCommerce's normal add-to-cart form before WhatsApp opens — no in-chat
  variation picker. Separate from the v0.5 browsing/discovery menu.
- [ ] Back-in-stock alerts (v0.6 milestone 5) only watch the parent product's
  own stock status. A variable product where one variation restocks while
  others stay out won't trigger a notification — would need a separate
  `woocommerce_variation_set_stock_status` hook and a way to disambiguate
  which variation a subscriber actually wanted.

---

## 5. Manual / non-code items (can't be done from the repo)

These need a human clicking through a live Meta Business / WordPress setup —
listed here only so they don't get silently dropped, not as code work:

- [ ] Full webhook verification handshake end-to-end on the live Meta app
- [ ] Send a real test WhatsApp message and confirm delivery
- [ ] Get submitted message templates actually approved by Meta
- [ ] Connect the Meta Commerce Catalog to the WABA in Commerce Manager

---

## 6. Key learnings & principles

- The plugin folder lives at `Trends CORE whatsapp\trendscore-whatsapp-commerce-v0.1.0\trendscore-whatsapp-commerce\`
  inside the TrendSCORE repo root — a separate, unrelated project from the
  TrendSCORE school-platform timetable module also being worked on in this repo.
- Edits are made directly on disk via the filesystem MCP connector; it **cannot
  run shell commands or create archives**. The user must zip
  (`trendscore-whatsapp-commerce` folder itself, not its versioned parent) and
  deploy manually, or upload the folder directly via FTP/SFTP (no zip needed).
- Bump `TCWC_VERSION` (top of the main plugin file, two places) on every
  frontend asset change — `wp_enqueue_script`/`style` cache-bust off it, so an
  unbumped version can mean the live site keeps serving stale JS/CSS after
  redeploy.
- The filesystem MCP server needs a **dedicated terminal** — sharing it with
  anything else (dev server, test runner) has caused it to go silently
  unresponsive before. If a filesystem tool call times out, that's the first
  thing to check.
- `filesystem:edit_file` with an `{oldText, newText}` edits array is the
  correct tool for editing files in this repo (not the sandbox `str_replace`,
  which only touches the sandbox filesystem, not the Windows one this project
  lives on).

---

## 7. v0.9 — Connection abstraction (decided against), conversation inbox (shipped v1), trust & social proof (not started)

Three pieces of work that turned out to share the same foundation. Original
plan was provider abstraction first, then the shared message store, then
the inbox and ratings on top of it. **What actually happened, 2026-09-15:**
after reviewing the Baileys research below, Tosh decided not to pursue it
("if it can't run [without new infrastructure], let's avoid it completely") —
so 7a is parked, not built. That simplified everything downstream: 7b and 7c
no longer need to stay provider-agnostic, and were built directly against
`TCWC_Cloud_API` the same session. See §1 for what shipped. 7a's research is
kept below in full rather than deleted, in case a future conversation
revisits it with different constraints (e.g. a VPS acquired for other
reasons).

### 7a. WhatsApp connection abstraction — Official Cloud API ⇄ Baileys — DECIDED AGAINST, 2026-09-15, not built

**Decision:** evaluated, not pursued. The combination of (1) needing new,
separate VPS infrastructure the current Hostinger shared plan can't run, and
(2) real, current ban risk concentrated in exactly the automation features
that make this plugin useful, outweighed the cost-saving and no-verification
appeal for this store. Kept as a reference below, not deleted — revisit if
the constraints change (e.g. a VPS gets acquired for another reason, or Meta's
October pricing turns out to matter more than the 1,000-free allowance suggests).

Original framing, kept as written:

**What Baileys is, researched 2026-09-13:** a WebSocket-based library
(`@whiskeysockets/baileys`) that logs in as a second "linked device" on a
real WhatsApp account by scanning a QR/pairing code — no Meta Business
verification, no app review, connects in minutes. It is explicitly
unaffiliated with WhatsApp; the maintainers' own README disclaims ToS
violations rather than endorsing them.

**Why this isn't a free swap — read before building:**
- **Ban risk is real and current, not theoretical.** Multiple independent
  2026 sources converge on the same picture: unofficial connections
  (Baileys, WAHA, Evolution API, whatsapp-web.js) get flagged by WhatsApp's
  behavioral detection within weeks to months, especially once a number
  sends proactive/business-initiated messages to people who haven't just
  messaged first. One source citing 600+ Indian SMB accounts put unofficial-tool
  ban rate at 68% within 12 months. Official-API bans have an appeal process
  (low success rate, but real); **a Baileys ban is generally permanent — no
  appeal path** for an unofficial connection.
- **This plugin's own best features are exactly the highest-risk pattern.**
  The official Cloud API's approved-template system exists specifically so a
  business can message a customer outside an active 24-hour conversation
  (delivery notifications, abandoned-order nudges, back-in-stock alerts —
  all shipped or planned here, plus the new post-delivery rating request in
  §7d). Baileys has **no equivalent safety valve** — an unsolicited
  automated message over Baileys looks identical to spam from a personal
  account, which is the single biggest ban trigger every source agrees on.
- **Ecosystem supply-chain warning:** in April 2026 a popular "anti-ban"
  npm helper for this exact library (56k downloads) turned out to be
  stealing WhatsApp session credentials. Stick to the official
  `@whiskeysockets/baileys` package (or an established wrapper — see
  below); don't add third-party "anti-ban" packages on top.
- **Separately worth flagging:** Meta restricted open-ended AI "assistant"
  bots on the *official* platform too, as of Jan 2026 — only structured
  flows (orders/FAQ/status) are policy-compliant now. Worth a quick
  compliance check on the existing AI assistant (§3) regardless of which
  provider ships here; noted so it doesn't get lost, not part of this build.
- **Cost picture, researched 2026-09-15 (changes in ~2 weeks):** the
  official Cloud API has no platform fee, and today's in-window replies /
  utility templates are free — but from **October 1, 2026** Meta starts
  billing those too: free-form service-message replies (staff or the AI
  assistant) at roughly **$0.004/message in Kenya (~KES 0.50)**, with the
  **first 1,000 service messages per business phone number per month still
  free** (resets monthly). At this store's likely volume that's plausibly
  $0/month in practice; unclear from research so far whether the 1,000-free
  allowance also covers in-window utility templates (delivery notices) or
  only free-form replies — confirm on Meta's WhatsApp Manager rate card
  before budgeting either way. Baileys has no Meta-side fee at all, but
  isn't literally free once the companion VPS (§ above) is counted — the
  real cost trade there is the ban risk above, not a line-item fee.

**Architecture — the part that actually changes the plan:** Baileys holds a
persistent WebSocket session; it cannot run inside a stateless PHP page-load
the way `TCWC_Cloud_API`'s plain HTTPS calls do. It needs an always-on
companion process — genuinely new infrastructure, not just a new settings
tab:
- **Won't run on the current Hostinger shared plan** — same reason
  `wp_cron` is already unreliable there: no persistent background processes
  allowed. Needs a Hostinger VPS/Cloud plan or any small external VPS.
  **Picked 2026-09-15: Hostinger VPS, KVM 2 tier** (2 vCPU, 8GB RAM, 100GB
  NVMe, ~$6–7/mo intro — check the renewal rate at checkout, Hostinger's
  intro-vs-renewal gap is real) — root access, Docker-ready, comfortable
  headroom for the wrapper API + reverse proxy. KVM 1 (4GB RAM, ~$5/mo)
  would technically run Baileys alone but leaves less room to grow. This is
  a **second, separate** Hostinger product — `ventukenya.com` stays on the
  existing shared/WordPress plan unchanged; the VPS only runs the gateway
  container, reached via a new subdomain (e.g. `wa.ventukenya.com`) with its
  own SSL cert (Caddy as reverse proxy handles this automatically) and a
  shared-secret token for the plugin to authenticate with.
- Rather than hand-rolling a raw Baileys Node script, run an actively
  maintained open-source REST wrapper built for exactly this — **Evolution
  API** or **WAHA (WhatsApp HTTP API)** are the two established options,
  both Docker-deployable, both already handle session persistence,
  reconnection, and webhooks, so the companion service becomes "deploy a
  container" rather than "maintain bespoke glue code." Worth a short
  side-by-side of those two specifically before picking one — not done yet.

**Build steps:**
1. Introduce a `TCWC_WhatsApp_Provider` contract (`send($to, $payload)`,
   `is_connected()`). Refactor `TCWC_Cloud_API` to implement it — low risk,
   since every send already funnels through `send_raw()`.
2. New `TCWC_Baileys_Provider` class calling the companion gateway over
   HTTPS with a shared secret.
3. New setting `whatsapp_provider` (`cloud_api` default | `baileys`) plus
   Baileys-specific fields (gateway URL, gateway token) in the Connection
   tab. A small dispatcher (`TCWC_WhatsApp::send()`) reads this setting and
   routes to whichever provider is active — every existing call site
   (automation, AI assistant, staff dashboard) changes its one call, nothing
   else about those files needs to know which provider is live.
4. Pairing UX: Settings page polls the gateway for a QR code (base64 PNG)
   and connection status until paired — genuinely new UI pattern, nothing
   like it exists today since Cloud API only needs pasted tokens.
5. Inbound side: the gateway pushes inbound messages to a new WP REST/AJAX
   endpoint; a small translator normalizes that payload into the exact
   shape `TCWC_Cloud_API::handle_event()` already produces from Meta's
   webhook, firing the **same** `tcwc_inbound_message` action — so the AI
   assistant, catalogue, and the planned conversation inbox (§7c) all work
   unmodified regardless of which provider is active.
6. Feature-gate anything proactive/template-shaped (automations, delivery
   notification, the new rating request) behind a visible "elevated ban
   risk on an unofficial connection" notice when `whatsapp_provider ===
   'baileys'`, rather than sending it identically either way.

### 7b. Shared message store — SHIPPED v1, 2026-09-15 (see §1 for the live summary)

Built as designed below, with two small differences from the original plan,
noted here so the schema description stays accurate: `wp_tcwc_conversations`
ended up without a separate `status` enum column (claimed_by/claimed_at
already capture what's needed for v1's claim-based view, so a redundant
status field was dropped rather than kept unused), and `wp_tcwc_messages`
has no `media_id` column yet since media isn't fetched/displayed in v1 (see
§1's "deferred" note) — add both back if/when media handling or a richer
status lifecycle actually gets built.

Original design, kept as written:

Both 7c and 7d need real persistent storage — today nothing saves
conversation history; the AI/automation "logs" are rolling last-20
option arrays, not queryable threads. Two new tables via `dbDelta` on
activation:

- **`wp_tcwc_conversations`** — id, phone (unique), customer_name
  (nullable), status (`bot` | `ai_handled` | `waiting_human` | `claimed` |
  `resolved`), claimed_by (user_id, nullable), claimed_at, last_message_at,
  last_message_preview, unread_count, created_at.
- **`wp_tcwc_messages`** — id, conversation_id (FK), direction (`in`/`out`),
  sender_type (`customer` | `ai` | `staff` | `automation` | `system`),
  sender_id (nullable, staff user id), wa_message_id (nullable — matches
  delivery-status callbacks), message_type, body, media_id (nullable),
  status (`sent`/`delivered`/`read`/`failed`, outbound only), created_at.

Populated by two listeners, not scattered writes: one on the existing
`tcwc_inbound_message` action (logs every inbound message regardless of who
else is listening), and one new `do_action('tcwc_outbound_message', ...)`
added at the point `send_raw()` succeeds (small, additive change — nothing
existing breaks). Meta's delivery-status webhook events (`$value['statuses']`
in `handle_event()`) already arrive today and are currently only written to
the debug log — wiring those into `status` on the message row is what gives
real ✓✓-style read receipts in 7c, at near-zero extra cost.

Conversation **claiming** is independent of order claiming (`_tcwc_claimed_by`
on the order) — a conversation can exist before, after, or without any
order, so it needs its own `claimed_by` column on `wp_tcwc_conversations`
rather than reusing the order-meta pattern.

### 7c. Conversation inbox — SHIPPED v1, 2026-09-15 (see §1 for the live summary; §0 for the still-needed live test)

Built largely as designed below. Real differences from the original plan:
it's a **new, separate** "Inbox" page alongside WhatsApp Orders rather than
replacing it (Orders stays focused on order-claiming/M-Pesa/notes; Inbox is
the conversation view); outside the 24h window the UI currently just blocks
sending with an explanatory message rather than offering to fire a template
from here; and the composer can lose an unsent draft on the ~5s periodic
refresh if left mid-type — noted as a known rough edge in §1, not fixed yet.

Original design, kept as written:

- New admin page (replacing/extending WhatsApp Orders) — two-pane layout,
  conversation list + thread view, plain PHP/vanilla JS to match the rest of
  the plugin (no build step needed).
- Permission split reuses the exact pattern already proven for orders:
  `manage_woocommerce` sees every conversation; `tcwc_manage_orders` (staff)
  sees only conversations they've claimed plus an unclaimed pool to pick up
  — same one-owner-at-a-time idea as order claiming, just keyed on phone
  number.
- "Live" feel via short AJAX polling while the inbox tab is open (a few
  seconds) — true push (WebSockets) isn't realistic on Hostinger shared
  hosting without new infrastructure, and isn't needed at this message
  volume.
- Sending a reply calls the existing `TCWC_Cloud_API::send_text()` (or the
  active provider, post-7a) — the send path already exists; this just adds
  an AJAX endpoint and logs the result to `wp_tcwc_messages`.
- 24-hour window rule surfaces in the UI: input greys out with a "send a
  template instead" prompt once >24h since the customer's last message,
  reusing the template system already in the Catalogue tab.
- Media (images/voice notes/documents) arrives as an expiring media ID, not
  a URL — needs a small fetch-and-cache proxy to display in-thread.
- Not replicable: WhatsApp doesn't expose a "customer is typing…" signal to
  businesses on either provider — the thread can look and feel like a real
  chat, but that one native touch isn't available.

### 7d. Trust & social proof

- **New `wp_tcwc_ratings` table** — order_id, phone, score (1–5), comment
  (nullable), source (`delivery_request` | `manual`), created_at,
  display_consent (bool), display_name (nullable, sanitized).
- **Delivery-triggered rating request**: the existing delivery-notification
  automation (fires on order → `completed`) gets a rating request appended
  — quick-reply buttons (1–5, or 👍/👎 first) via whichever provider is
  active. The customer's tap/reply lands through the same inbound pipeline
  the AI assistant already listens on (§7a step 5 makes this
  provider-agnostic for free) — new small listener class, not new plumbing.
  A 1–2★ rating auto-pushes into the same "waiting for a person" hand-off
  queue the AI assistant already populates, so a bad delivery gets a human
  fast instead of sitting unseen.
- **Floating rating badge** — aggregate score + review count from
  `wp_tcwc_ratings` (and/or existing WooCommerce product reviews), fixed
  position, reusing the same visual language as the existing floating
  WhatsApp button (`tcwc-float.css`) rather than looking bolted on. Links to
  a fuller reviews view; proper review schema markup for Google rich-result
  eligibility as a side benefit.
- **Live-orders ticker** — small toast ("Jane from Nairobi just bought X",
  N minutes ago), **real order data only, no simulated activity** — local
  market research (2026-09-13) shows Kenyan online shoppers are already
  unusually delivery-skeptical (widespread Jumia/Kilimall complaints);
  anything that reads as artificially busy will cost more trust than it buys.
- **Consent, not just anonymization — this is a Kenyan-law requirement, not
  a nice-to-have.** Kenya's Data Protection Act 2019 is actively enforced by
  the ODPC (fines up to KES 5M or 1% of turnover), and publicly displaying a
  customer's name + purchase to every site visitor has no contractual
  necessity behind it — it needs a genuine opt-in. Build: an off-by-default
  checkbox at checkout ("feature my order, first name only, on the site"),
  stored as `display_consent` above; the ticker only ever reads
  consented rows. No opt-in flow, no ticker entry — not negotiable.
