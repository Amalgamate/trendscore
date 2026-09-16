# Conversation Inbox + Trust Features — Build Plan

**Source:** distilled from `Ideas next.md` (two research/scoping conversations).
**Status:** planning only — nothing in this doc is built yet. Do not start
coding from here without checking `whatsapp-commerce-completion-plan.md` §0
first (v0.7/v0.8 haven't even been live-verified yet, and this work should
come after that, not compete with it).

This plan covers two features that turned out to share the same missing
piece — a real persistent-data layer instead of rolling option-array logs —
so they're planned together, built in the order below, and can ship as two
separate versions (v0.9, v1.0) off the same foundation.

---

## 0. Why these two together

- **Conversation inbox** (staff chat with customers) needs a message-history table.
- **Delivery ratings** (feeding both a "live orders" trust ticker and a
  floating rating badge) needs a ratings table.
- Both are new tables, both listen on hooks that already exist
  (`tcwc_inbound_message`, `send_raw()`, the `completed` order-status hook),
  and both plug into the same staff-dashboard permission pattern already
  built in v0.8 (`manage_woocommerce` sees all, `tcwc_manage_orders` sees
  own/unclaimed). Designing the data layer once for both avoids a second,
  slightly-different table shape later.

---

## 1. Foundation — data layer (build first, both features depend on it)

### 1.1 `tcwc_conversations` table
One row per customer phone number.
- `id`, `phone`, `claimed_by` (user ID, nullable), `status`
  (open / waiting_for_person / resolved), `last_activity`, `created_at`

### 1.2 `tcwc_messages` table
One row per message, belongs to a conversation.
- `id`, `conversation_id`, `direction` (in / out), `sender_type`
  (customer / ai / staff), `sender_id` (nullable, staff user ID),
  `body`, `wa_message_id`, `status` (sent / delivered / read — see 2.4),
  `created_at`

### 1.3 `tcwc_ratings` table
One row per delivery rating.
- `id`, `order_id`, `phone`, `score` (1–5), `comment` (nullable),
  `opted_in_for_display` (bool, default false — see §3.2 privacy note),
  `created_at`

### 1.4 Two new listeners to populate the message store
- On existing `tcwc_inbound_message` hook → insert an inbound row.
- New hook fired right after a successful `TCWC_Cloud_API::send_raw()` call
  → insert an outbound row. (This hook doesn't exist yet — add it as part
  of this milestone; it's a one-line addition inside `send_raw()`.)

**Exit criteria for Phase 1:** tables created on plugin activation/update
(with the same self-healing "check on every `init`" pattern used for the
abandoned-order cron, since this plugin is deployed by file overwrite, not
reactivation), both listeners confirmed writing real rows on a live test
message.

---

## 2. Phase A — Conversation inbox (v0.9)

### 2.1 Claiming, independent of orders
Claim lives on the conversation row (`tcwc_conversations.claimed_by`), not
on an order — a conversation can exist with no order at all. Same
one-owner-at-a-time logic as order claiming today; same visibility split
(admin sees all rows, staff sees claimed-by-them + unclaimed pool).

### 2.2 UI — thread view
New sub-tab on the existing WhatsApp Orders dashboard page (same page,
not a new top-level menu item): conversation list on the left (unclaimed
pool + own claimed), thread view on the right, a send box that calls
`send_raw()` directly — no new send path needed.

### 2.3 Making it feel live
Short AJAX polling (every few seconds, only while the inbox tab is open in
the browser) — not WebSockets. Hostinger shared hosting + already-flaky
`wp_cron` makes true push impractical; polling is the honest option for
this hosting tier and this message volume.

### 2.4 24-hour window handling
WhatsApp only allows free-form replies within 24h of the customer's last
inbound message. When a conversation is outside that window, grey out the
send box and surface the existing template system (already built for the
Catalogue tab) instead of a free-text box.

### 2.5 Delivery/read ticks (nice-to-have, not blocking)
Meta already sends delivery-status webhook events for outbound messages —
currently discarded. Wire them into `tcwc_messages.status` for real ✓✓
blue-tick behavior. Skip "typing…" indicator — not exposed by the Business
API in either direction, can't be built.

### 2.6 Media handling (nice-to-have, not blocking)
Inbound images/voice notes/documents arrive as an expiring media ID, not a
URL. In-thread display requires fetching and caching each one server-side.
Can ship v0.9 without this (show "[media received, open in WhatsApp]" as a
placeholder) and add it after.

**Exit criteria for Phase A:** staff can see, claim, and reply to a real
conversation from wp-admin without opening WhatsApp itself, on the live site.

---

## 3. Phase B — Delivery ratings + trust features (v1.0)

### 3.1 Rating capture
Extend the existing delivery-notification automation (fires on order →
`completed`) to append a rating request — interactive 1–5 or 👍/👎 button via
the Cloud API. Reply lands through the same inbound-webhook pipeline as
everything else; a new small listener writes it to `tcwc_ratings`.

### 3.2 Privacy gate (build this in from the start, not after)
Kenya's Data Protection Act 2019 is actively enforced by the ODPC —
displaying "Jane W. from Nairobi just bought X" to every site visitor
without consent is disclosure of personal data with no contractual need.
Required before any "live orders" ticker goes live:
- `opted_in_for_display` starts `false`; only set `true` via an explicit
  checkout checkbox ("feature my order on the site"), never on by default.
- Anything actually displayed publicly: first name only, county (not
  estate/street), rounded time ("a few hours ago", not a timestamp).

### 3.3 Live-orders ticker
Small bottom-corner toast, real opted-in order data only — no simulated/
fake activity. Given how delivery-skeptical Kenyan online shoppers already
are (per the Jumia/Kilimall review pattern noted in the research), a
smaller real trickle beats an artificially busy fake one; don't build a
"simulate activity for quiet periods" fallback.

### 3.4 Floating rating badge
Star score + count, aggregated from `tcwc_ratings` (and/or existing
WooCommerce product reviews if useful). Same fixed-corner visual pattern as
the existing floating WhatsApp button — opposite corner or stacked, not a
new visual language.

### 3.5 Staff hand-off on bad ratings
A 1–2★ delivery rating auto-pushes into the same "waiting for a person"
queue the AI assistant already populates in the Staff dashboard, so a bad
delivery gets a human within minutes instead of sitting unseen.

**Exit criteria for Phase B:** a real completed order can produce a real
rating via WhatsApp reply, a low rating shows up in the staff queue, and
(only if the opt-in checkbox is live and tested) the ticker/badge display
real, non-fabricated data.

---

## 4. Explicitly out of scope for now

- True WebSocket push for the inbox (revisit only if polling proves too
  slow in practice on live traffic).
- "Typing…" indicator (not available via the API).
- Per-variation back-in-stock (already a known limitation elsewhere in the
  completion plan, unrelated to this doc but worth not re-solving here).

---

## 5. Suggested build order

1. Foundation tables + listeners (§1)
2. Phase A conversation inbox, ship and live-verify as v0.9
3. Phase B ratings capture + staff hand-off (no public display yet)
4. Phase B checkout opt-in checkbox
5. Phase B ticker + badge, only once opt-in is live — ship as v1.0

Update this file's checkboxes/status as each stage actually ships and gets
live-verified, same discipline as `whatsapp-commerce-completion-plan.md`.
