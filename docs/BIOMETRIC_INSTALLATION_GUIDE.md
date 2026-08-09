# Biometric terminal installation guide

This guide covers the supported TrendSCORE biometric integration. It is vendor-neutral: a terminal may send the canonical HTTPS payload directly, or a certified vendor connector may translate the terminal's protocol into that payload.

TrendSCORE does not currently ship a desktop bridge installer or a vendor-specific ZKTeco driver. Do not install an unverified connector or configure a terminal to send biometric templates to a browser.

## Security model

- `BIOMETRIC_ENCRYPTION_KEY` is a server/deployment secret. It is never entered in School Settings, returned by the API, or shared with an installer.
- Each school stack must have its own 64-character hexadecimal key. The deployment script generates one with OpenSSL when the school's environment file has no key.
- A malformed or missing key stops a production deployment. The script never replaces an existing key automatically because doing so would make enrolled templates unreadable.
- `BIOMETRIC_KEY_VERSION` records which encryption key encrypted a credential. Back up the school environment file in the approved secret store before enrolling anyone.
- Every terminal receives a separate device token. TrendSCORE shows it only when the terminal is registered or its token is rotated; store it in the terminal or connector, not in documents or screenshots.

## Before installation

1. Confirm the terminal can make outbound HTTPS requests, or obtain a certified connector for its vendor protocol.
2. Give the terminal a stable hardware identifier and record its serial number, physical location, firmware version, and network owner.
3. Confirm the school deployment reports **Encryption ready** on **Biometrics > Installation**.
4. Confirm the school's server time and terminal time use NTP. Scan timestamps must be ISO 8601 values with a timezone.

## Register and configure a terminal

1. In TrendSCORE, open **Biometrics > Devices** and choose **Register terminal**.
2. Enter the stable hardware ID, name, type, location, serial number, firmware, IP address where useful, and sync mode.
3. Copy the one-time terminal token immediately. If it is lost, rotate it from the device actions; do not register a duplicate terminal.
4. Configure the terminal or connector to send HTTPS `POST` requests to:

   ```text
   https://<school-host>/api/biometric/log
   ```

5. Send the device token as a bearer token:

   ```text
   Authorization: Bearer <one-time-device-token>
   Content-Type: application/json
   ```

6. Send the canonical payload:

   ```json
   {
     "deviceId": "GATE-01",
     "personId": "LEARNER-ADMISSION-NUMBER",
     "personType": "LEARNER",
     "timestamp": "2026-08-09T07:12:30+03:00",
     "direction": "IN"
   }
   ```

   `personType` must be `LEARNER` or `STAFF`; `direction` must be `IN` or `OUT`. The registered `deviceId` must match exactly. A connector may map vendor events to this contract but must not log or forward raw fingerprint templates. Sending `deviceToken` in the JSON body remains supported for legacy devices, but the authorization header is preferred.

7. Perform one test scan and choose **Test connection** in TrendSCORE. The terminal becomes verified when a recent authenticated heartbeat or scan is observed.

## Enrolment

Use **Biometrics > Enrolment** to check whether a learner or staff member has an active credential. Capture requires supported terminal/connector software; the browser UI does not capture or receive raw templates. TrendSCORE encrypts accepted templates on the server and returns only enrolment status.

Obtain informed consent and follow the school's biometric retention policy before enrolment. Revoke a credential when consent is withdrawn, the person leaves, or a credential is suspected to be compromised.

## Maintenance and incident response

- **Token exposed or lost:** rotate the terminal token, update the terminal/connector, and verify with a new scan. The previous token stops working immediately.
- **Terminal retired or stolen:** decommission it. TrendSCORE disables authentication while retaining attendance logs for audit purposes.
- **Scans not arriving:** check terminal time, outbound DNS/HTTPS, the exact hardware ID, bearer token, response code, and **Biometrics > Logs**. Retry failed internal processing only after correcting the cause.
- **Encryption readiness failed:** repair the school's deployment environment with the original 64-character hexadecimal key. Never generate a replacement for a school that already has enrolled credentials.
- **Key rotation:** schedule a controlled migration that decrypts every active credential with the old key and re-encrypts it with the new key/version. Take a verified backup first. Do not rotate by editing the environment file alone.

## Go-live checklist

- School deployment reports encryption ready and the expected key version.
- Terminal is registered under the correct school and its token is stored only on the terminal/connector.
- A fresh connection test reports connected.
- A test scan appears in the biometric log with the correct person, direction, and local time.
- Old or test tokens have been rotated, and unused terminals have been decommissioned.
- Installer, installation time, terminal location, serial number, and firmware are recorded in TrendSCORE.
