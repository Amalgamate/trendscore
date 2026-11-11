-- Retire legacy M-Pesa providers. Their credentials are not compatible with
-- Safaricom Daraja, so require a fresh Daraja setup before collections resume.
ALTER TABLE "communication_configs"
  ALTER COLUMN "mpesaProvider" SET DEFAULT 'daraja';

UPDATE "communication_configs"
SET
  "mpesaProvider" = 'daraja',
  "mpesaEnabled" = false,
  "mpesaPublicKey" = NULL,
  "mpesaSecretKey" = NULL,
  "mpesaApiKey" = NULL,
  "mpesaPasskey" = NULL,
  "mpesaBusinessNo" = NULL,
  "mpesaOnboardingChecklist" = NULL,
  "mpesaOnboardingUpdatedAt" = NULL,
  "mpesaOnboardingUpdatedBy" = NULL,
  "updatedAt" = NOW()
WHERE LOWER(COALESCE("mpesaProvider", '')) <> 'daraja';
