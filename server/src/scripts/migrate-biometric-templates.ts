/**
 * migrate-biometric-templates.ts
 *
 * One-time migration: encrypts any existing plaintext biometric templates
 * stored in biometric_credentials.template.
 *
 * Usage:
 *   ts-node src/scripts/migrate-biometric-templates.ts [--dry-run]
 *
 * Flags:
 *   --dry-run   Report how many rows need migration without writing anything
 *
 * Safety:
 *   - Runs in batches of BATCH_SIZE rows
 *   - Skips rows that are already encrypted (isEncryptedTemplate check)
 *   - Idempotent: safe to run multiple times
 *   - Logs row counts at start and end
 *
 * IMPORTANT: Take a full database backup before running in production.
 */

import 'dotenv/config';
import prisma from '../config/database';
import {
  encryptTemplate,
  legacyStringToBuffer,
  isEncryptedTemplate,
} from '../domains/biometrics/biometric.encryption';
import logger from '../utils/logger';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 200;
const isDryRun = process.argv.includes('--dry-run');

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  await prisma.$connect();

  logger.info('[BiometricMigration] Starting template encryption migration');
  if (isDryRun) {
    logger.info('[BiometricMigration] DRY RUN MODE — no writes will occur');
  }

  // Count total credentials
  const total = await prisma.biometricCredential.count();
  logger.info(`[BiometricMigration] Total credential rows: ${total}`);

  let processed = 0;
  let encrypted = 0;
  let alreadyEncrypted = 0;
  let failed = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.biometricCredential.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        template: true,
        keyVersion: true,
      },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const row of batch) {
      processed++;
      try {
        // template is stored as Bytes (Buffer) in Prisma
        // For legacy rows it will be a Buffer of the raw UTF-8 string bytes
        const templateStr = row.template.toString('utf8');

        if (isEncryptedTemplate(templateStr)) {
          alreadyEncrypted++;
          continue;
        }

        if (!isDryRun) {
          // Treat the stored bytes as a legacy string template
          const plainBuffer = legacyStringToBuffer(templateStr);
          const { encrypted: encryptedStr, keyVersion } = encryptTemplate(plainBuffer);
          const encryptedBuffer = Buffer.from(encryptedStr, 'utf8');

          await prisma.biometricCredential.update({
            where: { id: row.id },
            data: {
              template: encryptedBuffer,
              keyVersion,
              encryptedAt: new Date(),
            },
          });
        }

        encrypted++;
      } catch (err: any) {
        failed++;
        logger.error(`[BiometricMigration] Failed to process row ${row.id}: ${err.message}`);
      }
    }

    logger.info(
      `[BiometricMigration] Progress: ${processed}/${total} — ` +
      `encrypted=${encrypted}, skipped=${alreadyEncrypted}, failed=${failed}`
    );

    await sleep(BATCH_DELAY_MS);
  }

  logger.info(
    `[BiometricMigration] Complete — ` +
    `total=${total}, processed=${processed}, ` +
    `encrypted=${encrypted}, already_encrypted=${alreadyEncrypted}, failed=${failed}`
  );

  if (isDryRun) {
    logger.info(`[BiometricMigration] DRY RUN: ${encrypted} rows would be encrypted`);
  }

  if (failed > 0) {
    logger.error(`[BiometricMigration] ${failed} rows failed — review logs above`);
    process.exit(1);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  logger.error('[BiometricMigration] Fatal error:', err);
  process.exit(1);
});
