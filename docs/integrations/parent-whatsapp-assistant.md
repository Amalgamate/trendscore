# Parent WhatsApp assistant

The assistant replies to inbound WhatsApp messages with the current fee balance or latest published assessment results for the linked parent account. It never asks an LLM to produce school facts: Ollama classifies the request, and the backend reads the figures from the school database. If enabled, the parent’s inbound text is sent to the school-hosted Ollama service only for intent classification; fee balances and assessment records are not sent to the model. When Ollama is not configured or unavailable, local intent rules are used.

## Pairing the school WhatsApp session

The school's WhatsApp number is a normal WhatsApp account paired to the backend over [Baileys](https://github.com/WhiskeySockets/Baileys) — there is no Meta Business account, app, or webhook to configure.

1. Sign in as **ADMIN** or **SUPER_ADMIN**.
2. Open **Settings → Communication → WhatsApp**.
3. Start the session and scan the QR code from the phone that will act as the school's WhatsApp number.

The session is stored under `WHATSAPP_AUTH_DIR` (default `/app/whatsapp-auth`). Compose mounts a named `whatsapp_auth` volume there, so the pairing survives container rebuilds and redeploys. If that volume is deleted, the session must be paired again.

For an existing deployment that stored Baileys credentials in the container filesystem, copy the current `/app/whatsapp-auth` contents into the new named volume **before recreating the backend container**. Otherwise the new empty volume will hide the old session and the administrator will need to scan a new QR code. Keep this volume in backups and do not commit its contents.

Once paired, the backend opens an outbound connection and receives inbound messages through the Baileys `messages.upsert` event. **No public webhook endpoint and no inbound port are required** — the socket is outbound-only, so the API does not need to be reachable from the internet for WhatsApp to work.

History backfill (`upsert.type === 'append'`) is ignored on purpose; only genuinely new messages (`notify`) are processed. Message ids are deduplicated in memory for 24 hours so a reconnect cannot replay a message into the assistant.

## Optional local Ollama classifier

The Docker Compose files include an Ollama service on the backend's private Compose network under the optional `ai` profile. It is not started by default. To enable it for a school instance:

```dotenv
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

Start the service with the Compose `ai` profile and pull the configured model into its volume:

```sh
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull qwen2.5:1.5b
```

Ollama is used only to classify a message as `FEES`, `RESULTS`, or `HELP`; the school database remains the source of record. If the model call fails or times out, deterministic local rules handle the request.

## Parent linking and controls

The default flow asks the parent for one decision and one tap. There is no code to copy.

1. Parent signs in and opens **My Profile**.
2. The card shows the number already saved on the parent profile and a single consent checkbox.
3. Parent taps **Turn on WhatsApp assistant**. The school WhatsApp account messages that number: *"Reply YES to confirm."*
4. Parent replies `YES` from the same phone. The backend consumes the pending challenge atomically and links the account, then confirms in the chat with a short list of what they can ask.

A bare `YES` only counts while a challenge is open. With no pending challenge it falls through to normal intent handling, so ordinary conversation is unaffected.

Guardrails: the challenge lasts 15 minutes, is single-use, is keyed by phone hash in Redis, and is rate-limited to 5 requests/hour per parent. The link is re-validated at confirmation time — account role, `ACTIVE` status, current-phone match, at least one accessible learner, and no other parent owning the number. If the school session is disconnected, the request fails with `503` and no challenge is left behind.

**Fallback.** Numbers that cannot receive the consent message can still use **Having trouble? Use a code instead**. That issues a 16-character `LINK <code>` valid for 10 minutes, hashed in Redis, with a 5-attempt cap. It is deliberately hidden behind a link so it is not the default path.

**Turning off.** `STOP` / `START` in chat, or pause and disconnect from **My Profile**.

Raw inbound message text is not persisted by this assistant.

## School-supplied numbers

The parent's `User.phone` is the single number used for both login and WhatsApp — there is no separate WhatsApp column. In the parents bulk CSV, `WhatsApp Number` acts as a fallback when `Phone` is blank, so schools that only hold WhatsApp numbers can still onboard parents. When both columns are present and differ after normalization, `Phone` wins because it is the login identity, and the import row is returned with a warning telling the operator which number was saved.
