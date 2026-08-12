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

## Phone face terminal

The phone terminal uses Amazon Rekognition Face Liveness and a school-scoped face collection. Manual admission/staff ID entry is the only fallback. TrendSCORE does not provide a QR scanner on this terminal.

1. Register the phone as a terminal under **Biometrics > Devices**.
2. Choose **Activate phone** on its device card. The resulting 8-digit code is valid for ten minutes and can be used once.
3. Open `https://<school-host>/#/terminal/biometric` on the phone, then enter the hardware ID and activation code.
4. Use Chrome on Android, choose **CHECK IN** or **CHECK OUT**, and select **Start face recognition**. A new AWS session is created for every attempt and expires after three minutes.
5. The server records attendance only when the AWS liveness score and face-match score meet the configured thresholds. The defaults are 90 and 97 respectively; validate them against the school's approved risk assessment before go-live.
6. Face recognition requires internet connectivity. Manual fallback events captured without connectivity are stored in the phone's IndexedDB queue and synchronize in capture order when the connection returns.

Each phone event has a terminal-generated `eventId`. TrendSCORE enforces uniqueness per terminal, so retrying the same offline event returns the original result instead of creating another biometric log or attendance record.

The terminal bearer token is held in browser application storage and rotated when a new activation code is exchanged. Remove the terminal configuration before repurposing the phone, and decommission the device immediately if the phone is lost.

## AWS Rekognition setup

TrendSCORE needs server-side AWS credentials and a separate assumable role for the browser liveness stream. Never put permanent AWS access keys in frontend build variables or phone storage.

Set these values in the school stack environment file:

```text
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<server credential, omit when using an instance role>
AWS_SECRET_ACCESS_KEY=<server credential, omit when using an instance role>
AWS_REKOGNITION_LIVENESS_ROLE_ARN=arn:aws:iam::<account-id>:role/TrendScoreFaceLivenessClient
AWS_REKOGNITION_COLLECTION_PREFIX=trendscore
AWS_REKOGNITION_LIVENESS_THRESHOLD=90
AWS_REKOGNITION_MATCH_THRESHOLD=97
```

Face Liveness is not currently available in Africa (Cape Town) `af-south-1`.
For Kenya deployments, TrendSCORE uses Asia Pacific (Mumbai) `ap-south-1` unless
the school's approved data-protection assessment selects another AWS-supported
Face Liveness region.

For managed deployments, store the access key ID and secret access key as
GitHub Environment secrets, and store the region and role ARN as Environment
variables. The school promotion workflow transfers all four values through a
permission-restricted temporary file, updates only the manifest-approved school
environment, sets that environment file to mode `0600`, and removes the
temporary file. The workflow never prints credential values. If the protected
configuration is absent, promotion leaves the existing school AWS settings
unchanged; a partial configuration stops the deployment before restart.

The server identity needs the following Rekognition actions plus `sts:AssumeRole` for the liveness-client role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults",
        "rekognition:CreateCollection",
        "rekognition:DescribeCollection",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<account-id>:role/TrendScoreFaceLivenessClient"
    }
  ]
}
```

The assumed `TrendScoreFaceLivenessClient` role must allow only:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "rekognition:StartFaceLivenessSession",
    "Resource": "*"
  }]
}
```

Configure the role's trust policy so only the TrendSCORE server identity can assume it. TrendSCORE requests 15-minute temporary credentials and returns them only for a one-time, three-minute liveness session. Audit images are disabled; the transient AWS reference image is used immediately for enrollment or matching and is not written to TrendSCORE storage.

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

1. Open **Biometric Attendance > Biometric Authority**, search for the learner or staff member, and choose **Check enrollment**.
2. Confirm that documented parent/guardian consent (or staff consent) and the approved biometric purpose are on record.
3. Choose **Start live face enrollment** and let the named person complete the AWS liveness challenge.
4. TrendSCORE indexes one face vector into that school's AWS collection and stores only an encrypted provider reference locally. It does not retain the selfie video or reference image.
5. Revoke the credential when consent is withdrawn, the person leaves, or the credential is suspected to be compromised. Revocation removes the AWS face vector as well as disabling the local credential.

## Maintenance and incident response

- **Token exposed or lost:** rotate the terminal token, update the terminal/connector, and verify with a new scan. The previous token stops working immediately.
- **Terminal retired or stolen:** decommission it. TrendSCORE disables authentication while retaining attendance logs for audit purposes.
- **Phone replaced or browser storage cleared:** create a new activation code. Activation rotates the terminal token, invalidating the previous phone session.
- **Face scan cannot start:** confirm the AWS region, server credentials, liveness role trust policy, `sts:AssumeRole`, outbound HTTPS, and **Biometrics > API & Bridge Info** readiness.
- **Face not recognized:** use manual fallback, confirm the person has an active FACE credential, improve lighting, and re-enroll only after revoking the old credential.
- **Scans not arriving:** check terminal time, outbound DNS/HTTPS, the exact hardware ID, bearer token, response code, and **Biometrics > Attendance Data Feed**. Retry failed internal processing only after correcting the cause.
- **Encryption readiness failed:** repair the school's deployment environment with the original 64-character hexadecimal key. Never generate a replacement for a school that already has enrolled credentials.
- **Key rotation:** schedule a controlled migration that decrypts every active credential with the old key and re-encrypts it with the new key/version. Take a verified backup first. Do not rotate by editing the environment file alone.

## Go-live checklist

- School deployment reports encryption ready and the expected key version.
- AWS face recognition reports configured, and both the server role and short-lived liveness role pass a real phone test.
- A biometric DPIA, documented purpose, retention policy, and parent/guardian or staff consent workflow are approved before enrollment.
- Terminal is registered under the correct school and its token is stored only on the terminal/connector.
- A fresh connection test reports connected.
- A liveness-protected test scan appears in the biometric log with modality FACE, the correct person, direction, confidence values, and local time.
- Old or test tokens have been rotated, and unused terminals have been decommissioned.
- Installer, installation time, terminal location, serial number, and firmware are recorded in TrendSCORE.
