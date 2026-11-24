# Parent WhatsApp assistant

The assistant replies to inbound WhatsApp messages with the current fee balance or latest published assessment results for the linked parent account. It never asks an LLM to produce school facts: Ollama classifies the request, and the backend reads the figures from the school database. If enabled, the parent’s inbound text is sent to the school-hosted Ollama service only for intent classification; fee balances and assessment records are not sent to the model. When Ollama is not configured or unavailable, local intent rules are used.

## Meta webhook configuration

Set these variables in the school instance environment before enabling the callback:

```dotenv
WABA_PHONE_NUMBER_ID=your_meta_phone_number_id
WABA_DISPLAY_PHONE=+2547XXXXXXXX
WABA_ACCESS_TOKEN=your_cloud_api_access_token
WABA_VERIFY_TOKEN=a-long-random-verification-token
WABA_APP_SECRET=your_meta_app_secret
WABA_API_VERSION=v27.0
```

Register `https://<school-domain>/api/webhooks/whatsapp` as the Meta callback URL, subscribe to the `messages` field, and enter the same `WABA_VERIFY_TOKEN`. The inbound POST is rejected unless `X-Hub-Signature-256` validates against `WABA_APP_SECRET`. Keep the app secret and access token in the protected school environment, never in the frontend or source control.

The callback currently expects one `WABA_PHONE_NUMBER_ID` per school backend instance. If multiple schools share a single Meta app callback, route callbacks through a central webhook gateway keyed by `metadata.phone_number_id`; do not point one school's callback directly at another school's instance.

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
4. The backend verifies the Meta signature, code, account role/status, and current phone match before linking.
5. Parent can pause/resume replies with `STOP` / `START`, or pause and disconnect from **My Profile**.

The code is stored as a hash in Redis and consumed atomically. Raw inbound message text is not persisted by this assistant. WhatsApp provider events are deduplicated in Redis for 24 hours.
