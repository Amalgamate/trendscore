-- All application-created device tokens are now generated in the service and
-- persisted only as SHA-256 digests. Prevent direct inserts from receiving a
-- new legacy plaintext UUID token from the database default.
ALTER TABLE "biometric_devices"
  ALTER COLUMN "token" DROP DEFAULT;
