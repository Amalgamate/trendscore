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

1. Parent signs in and opens **My Profile**.
2. Parent confirms consent and creates a one-time code.
3. Parent sends `LINK <code>` from the WhatsApp number saved on their own parent account, within 10 minutes.
4. The backend verifies the code, account role/status, and current phone match before linking.
5. Parent can pause/resume replies with `STOP` / `START`, or pause and disconnect from **My Profile**.

The code is stored as a hash in Redis and consumed atomically. Raw inbound message text is not persisted by this assistant.
