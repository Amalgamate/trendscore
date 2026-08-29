/**
 * merge-duplicate-parents.mjs
 *
 * One-shot deduplication script for parent accounts.
 *
 * Strategy per duplicate name group:
 *   1. Pick the "winner" account — prefer the newest par-* parentCode account
 *      (Path B / getOrCreateParent). Fall back to the most recently created.
 *   2. Re-point ALL learner.parentId FKs from losers → winner.
 *   3. Merge FamilyMember / LearnerFamilyLink references onto winner's family.
 *   4. Null out email on ALL parent accounts (we use phone + parentCode only).
 *   5. Set password to bcrypt('changeme') + set passwordResetToken so
 *      mustChangePassword fires on next login.
 *   6. Normalise winner phone to 254XXXXXXXXX format.
 *   7. Deactivate (archive) all loser accounts.
 *   8. Enforce phone uniqueness: if two winners would share a phone after
 *      merge, log a warning and skip rather than corrupt data.
 *
 * Run via: node scripts/merge-duplicate-parents.mjs [--dry-run]
 *
 * Requires: DATABASE_URL in env (or .env file loaded externally).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

// ─── Phone normalisation (mirrors server/src/services/parent.service.ts) ─────

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  // 0XXXXXXXXX → 254XXXXXXXXX
  if (digits.length === 10 && digits.startsWith('0')) return `254${digits.slice(1)}`;
  // XXXXXXXXX (9 digits, starts with 1 or 7) → 254XXXXXXXXX
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  // Already 254XXXXXXXXX
  if (digits.length === 12 && digits.startsWith('254')) return digits;
  // +254XXXXXXXXX → strip +
  if (digits.length === 12 && digits.startsWith('254')) return digits;

  return digits; // return as-is if unrecognised format
}

function isSyntheticEmail(email) {
  if (!email) return true;
  return (
    email.endsWith('@trendscore.co.ke') ||
    email.endsWith('@edu-core.test') ||
    email.includes('@edu-core.') ||
    /^par-[a-f0-9]+@/.test(email) ||
    /^\d+@/.test(email) // phone-number@domain legacy format
  );
}

// ─── Pick the winner from a group of duplicate parent users ──────────────────

function pickWinner(users) {
  // Prefer: has a parentCode (newer getOrCreateParent path)
  const withCode = users.filter(u => u.parentCode);
  const pool = withCode.length > 0 ? withCode : users;
  // Within pool pick the most recently created
  return pool.reduce((best, u) =>
    new Date(u.createdAt) > new Date(best.createdAt) ? u : best
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  MERGE DUPLICATE PARENTS — ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`${'='.repeat(64)}\n`);

  // 1. Find all PARENT users grouped by normalised full name
  const allParents = await prisma.user.findMany({
    where: { role: 'PARENT', archived: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      parentCode: true,
      status: true,
      createdAt: true,
      passwordResetToken: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total active PARENT accounts: ${allParents.length}`);

  // Group by lower-cased full name
  const groups = new Map();
  for (const u of allParents) {
    const key = `${u.firstName} ${u.lastName}`.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }

  const dupGroups = [...groups.entries()].filter(([, users]) => users.length > 1);
  console.log(`Duplicate name groups: ${dupGroups.length}\n`);

  // Track phones claimed by winners to detect cross-group phone collisions
  const claimedPhones = new Map(); // normalizedPhone → winnerId

  let mergedCount = 0;
  let skippedCount = 0;

  for (const [name, users] of dupGroups) {
    const winner = pickWinner(users);
    const losers = users.filter(u => u.id !== winner.id);

    const winnerPhone = normalizePhone(winner.phone ?? losers.find(l => l.phone)?.phone);

    // Check for cross-group phone collision
    if (winnerPhone && claimedPhones.has(winnerPhone) && claimedPhones.get(winnerPhone) !== winner.id) {
      console.warn(`  ⚠ SKIP "${name}" — phone ${winnerPhone} already claimed by another winner. Manual review needed.`);
      skippedCount++;
      continue;
    }
    if (winnerPhone) claimedPhones.set(winnerPhone, winner.id);

    console.log(`\n[MERGE] "${name}" (${users.length} accounts → 1)`);
    console.log(`  Winner : ${winner.id} | email: ${winner.email} | phone: ${winner.phone} | parentCode: ${winner.parentCode ?? 'none'}`);
    losers.forEach(l => console.log(`  Loser  : ${l.id} | email: ${l.email} | phone: ${l.phone}`));

    if (DRY_RUN) {
      mergedCount++;
      continue;
    }

    // ── 2. Re-point learner.parentId ──────────────────────────────────────
    for (const loser of losers) {
      const repointed = await prisma.learner.updateMany({
        where: { parentId: loser.id },
        data: { parentId: winner.id },
      });
      if (repointed.count > 0) {
        console.log(`    Re-pointed ${repointed.count} learner(s) from ${loser.id} → ${winner.id}`);
      }
    }

    // ── 3. Merge FamilyMember links ────────────────────────────────────────
    for (const loser of losers) {
      // Find loser's FamilyMember entry
      const loserMember = await prisma.familyMember.findFirst({
        where: { userId: loser.id },
        select: { id: true, familyAccountId: true },
      });
      if (!loserMember) continue;

      // Find winner's FamilyMember entry
      const winnerMember = await prisma.familyMember.findFirst({
        where: { userId: winner.id },
        select: { id: true, familyAccountId: true },
      });

      // Get all learner links from loser's family
      const loserLinks = await prisma.learnerFamilyLink.findMany({
        where: { familyAccountId: loserMember.familyAccountId },
      });

      if (winnerMember) {
        // Transfer learner family links to winner's family account
        for (const link of loserLinks) {
          await prisma.learnerFamilyLink.upsert({
            where: {
              familyAccountId_learnerId: {
                familyAccountId: winnerMember.familyAccountId,
                learnerId: link.learnerId,
              },
            },
            update: { isPrimary: link.isPrimary },
            create: {
              familyAccountId: winnerMember.familyAccountId,
              learnerId: link.learnerId,
              relationship: link.relationship,
              isPrimary: link.isPrimary,
            },
          });
        }
      }

      // Nullify userId on loser's FamilyMember so it doesn't block archival
      await prisma.familyMember.update({
        where: { id: loserMember.id },
        data: { userId: null },
      });
    }

    // ── 4+5. Update winner: null email, normalise phone, set changeme pwd ──
    const forceResetToken = randomBytes(32).toString('hex');
    const forceResetExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    const hashedChangeme = await bcrypt.hash('changeme', 11);

    // Generate a parentCode for the winner if they don't have one
    let winnerParentCode = winner.parentCode;
    if (!winnerParentCode) {
      for (;;) {
        const candidate = `PAR-${randomBytes(4).toString('hex').toUpperCase()}`;
        const existing = await prisma.user.findUnique({ where: { parentCode: candidate }, select: { id: true } });
        if (!existing) { winnerParentCode = candidate; break; }
      }
    }

    // Build a synthetic email from parentCode (no real email for parents)
    const syntheticEmail = `${winnerParentCode.toLowerCase()}@trendscore.co.ke`;

    await prisma.user.update({
      where: { id: winner.id },
      data: {
        email: syntheticEmail,
        username: winnerParentCode,
        parentCode: winnerParentCode,
        phone: winnerPhone,
        password: hashedChangeme,
        passwordResetToken: forceResetToken,
        passwordResetExpiry: forceResetExpiry,
        status: 'ACTIVE',
        archived: false,
      },
    });
    console.log(`    Winner updated → email: ${syntheticEmail}, phone: ${winnerPhone}, passwordResetToken set`);

    // ── 6. Archive all losers ──────────────────────────────────────────────
    for (const loser of losers) {
      // Null out loser's email/username/parentCode to free unique constraints
      const loserArchiveEmail = `archived-${loser.id}@trendscore.co.ke`;
      await prisma.user.update({
        where: { id: loser.id },
        data: {
          email: loserArchiveEmail,
          username: null,
          parentCode: null,
          phone: null,
          archived: true,
          archivedAt: new Date(),
          archivedBy: 'merge-duplicate-parents-script',
          status: 'INACTIVE',
        },
      });
      console.log(`    Archived loser: ${loser.id}`);
    }

    mergedCount++;
  }

  // ── 7. Set changeme password on ALL remaining non-archived parent accounts ──
  // (This covers parents who had no duplicates but still have synthetic emails)
  console.log(`\n${'─'.repeat(64)}`);
  console.log('Setting changeme password on all remaining active parents...');

  if (!DRY_RUN) {
    const hashedChangeme = await bcrypt.hash('changeme', 11);
    const forceExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const remainingParents = await prisma.user.findMany({
      where: { role: 'PARENT', archived: false },
      select: { id: true, parentCode: true, email: true, phone: true },
    });

    for (const p of remainingParents) {
      // Ensure every parent has a parentCode
      let code = p.parentCode;
      if (!code) {
        for (;;) {
          const candidate = `PAR-${randomBytes(4).toString('hex').toUpperCase()}`;
          const existing = await prisma.user.findUnique({ where: { parentCode: candidate }, select: { id: true } });
          if (!existing) { code = candidate; break; }
        }
      }

      const syntheticEmail = `${code.toLowerCase()}@trendscore.co.ke`;

      await prisma.user.update({
        where: { id: p.id },
        data: {
          email: syntheticEmail,
          username: code,
          parentCode: code,
          password: hashedChangeme,
          passwordResetToken: randomBytes(32).toString('hex'),
          passwordResetExpiry: forceExpiry,
        },
      });
    }

    console.log(`  Updated ${remainingParents.length} parent accounts.`);
  } else {
    console.log('  [DRY RUN] Skipped.');
  }

  console.log(`\n${'='.repeat(64)}`);
  console.log(`  DONE — merged: ${mergedCount} groups, skipped: ${skippedCount}`);
  console.log(`${'='.repeat(64)}\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
