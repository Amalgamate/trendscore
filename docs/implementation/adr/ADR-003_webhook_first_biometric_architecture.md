# ADR-003 — Webhook-First Biometric Architecture

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §17, BIOMETRICS_AUDIT.md §7

---

## Context

TrendSCORE needs to integrate biometric hardware for attendance. Schools deploy different vendors: ZKTeco, Hikvision, Suprema, NFC readers. Each vendor has a different SDK and different protocol. Some devices push events, some require polling. Some schools have no hardware at all.

The biometric stub (found in the audit) already implemented a webhook receiver. The question is whether to commit to this architecture or design something different.

---

## Decision

The biometric integration is **webhook-first**. Any device that can POST an HTTP request to `/api/webhooks/biometric/log` is supported without any vendor-specific code. Vendor SDK adapters are optional additions for richer capabilities (enrollment, device management, pull-mode sync) — they enhance the experience but are not required for basic attendance recording.

The core attendance path works for any device with HTTP capability.

---

## Alternatives Considered

### Option A — Vendor Lock-In (ZKTeco Only)

Integrate ZKTeco SDK deeply. Require all schools to use ZKTeco hardware.

**Pros:** Single SDK, well-documented, widely available in Kenya

**Cons:**
- Excludes schools already invested in other vendors (Hikvision, Suprema)
- Future vendor changes require significant refactoring
- ZKTeco SDK license cost and version compatibility

### Option B — Vendor-Agnostic SDK Layer (Complex)

Build an abstract `IDeviceAdapter` interface that every vendor implements. Deploy vendor-specific adapter services.

**Pros:** Clean abstraction, each vendor fully supported

**Cons:**
- 3–5x more development effort
- Requires maintaining multiple SDKs
- Each adapter is a deployment concern
- Premature if schools don't ask for specific vendor features

### Option C — Webhook-First with Optional SDK Adapters (Chosen)

Define a standard webhook payload. Any device that can POST it is immediately supported. Add ZKTeco SDK adapter as the first optional enhancement.

**Pros:**
- Works immediately with any HTTP-capable device (including low-cost NFC readers)
- SDK adapters added progressively per demand
- No vendor lock-in
- Existing webhook infrastructure already in place (the audit found it working)

**Cons:**
- Devices that only support pull mode (no HTTP push) require an adapter to work
- Template enrollment not possible without a device SDK (acceptable — manual enrollment is the fallback)

---

## Consequences

- The standard webhook payload is the contract: `{ deviceId, deviceToken, personId, personType, timestamp, direction }`
- ZKTeco adapter (Phase 4) enhances to: enrollment, device management UI, pull-mode sync
- Hikvision adapter (Phase 4+): ISAPI event subscription
- NFC/RFID readers: webhook only — no enrollment, presence-by-scan only
- Biometric service must remain device-agnostic in its core path

---

## Revisit Trigger

- A major school chain standardises on a specific vendor and demands deep SDK integration as a contract requirement
- A security audit requires that biometric template comparison happen on-device (not in the server)
