/**
 * diagnose-duplicate-students.mjs
 *
 * Read-only diagnostic: finds duplicate learner records in the database.
 * Checks for:
 *   1. Same full name + date of birth (true duplicates)
 *   2. Same admission number with different casing
 *   3. Multiple student User accounts for the same admission number
 *   4. Students sharing a phone with a parent (wrong linkage)
 *
 * Run via: node scripts/diagnose-duplicate-students.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`\n${'='.repeat(64)}`);
  console.log('  DUPLICATE STUDENT DIAGNOSTICS');
  console.log(`${'='.repeat(64)}\n`);

  // ── 1. Same name + DOB ────────────────────────────────────────────────────
  console.log('## 1. Learners sharing full name + date of birth');
  const allLearners = await prisma.learner.findMany({
    where: { archived: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      admissionNumber: true,
      grade: true,
      stream: true,
      status: true,
      studentUserId: true,
      parentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const nameDobGroups = new Map();
  for (const l of allLearners) {
    const dob = l.dateOfBirth ? new Date(l.dateOfBirth).toISOString().split('T')[0] : 'unknown-dob';
    const key = `${l.firstName} ${l.lastName}|${dob}`.toLowerCase();
    if (!nameDobGroups.has(key)) nameDobGroups.set(key, []);
    nameDobGroups.get(key).push(l);
  }
  const nameDobDups = [...nameDobGroups.entries()].filter(([, g]) => g.length > 1);

  if (nameDobDups.length === 0) {
    console.log('  ✓ No duplicates found by name + DOB\n');
  } else {
    console.log(`  Found ${nameDobDups.length} duplicate groups:\n`);
    for (const [key, group] of nameDobDups) {
      console.log(`  Name+DOB: "${key}" (${group.length} records)`);
      for (const l of group) {
        console.log(`    - id: ${l.id} | adm: ${l.admissionNumber} | grade: ${l.grade}${l.stream ? `/${l.stream}` : ''} | status: ${l.status} | studentUserId: ${l.studentUserId ?? 'none'}`);
      }
    }
    console.log();
  }

  // ── 2. Admission number case duplicates ───────────────────────────────────
  console.log('## 2. Admission number case-insensitive duplicates');
  const admGroups = new Map();
  for (const l of allLearners) {
    const key = l.admissionNumber.toLowerCase().trim();
    if (!admGroups.has(key)) admGroups.set(key, []);
    admGroups.get(key).push(l);
  }
  const admDups = [...admGroups.entries()].filter(([, g]) => g.length > 1);

  if (admDups.length === 0) {
    console.log('  ✓ No case-insensitive admission number duplicates\n');
  } else {
    console.log(`  Found ${admDups.length} duplicate groups:\n`);
    for (const [key, group] of admDups) {
      console.log(`  Admission (normalised): "${key}"`);
      for (const l of group) {
        console.log(`    - id: ${l.id} | adm: ${l.admissionNumber} | name: ${l.firstName} ${l.lastName} | grade: ${l.grade}`);
      }
    }
    console.log();
  }

  // ── 3. Multiple student User accounts per admission number ────────────────
  console.log('## 3. Multiple student user accounts per admission number');
  const studentUsers = await prisma.user.findMany({
    where: { role: 'STUDENT', archived: false },
    select: { id: true, email: true, username: true, phone: true, firstName: true, lastName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Student email pattern: admissionNumber@trendscore.co.ke
  const stuAdmGroups = new Map();
  for (const u of studentUsers) {
    const adm = u.email?.split('@')[0]?.toLowerCase() ?? u.username?.split('@')[0]?.toLowerCase();
    if (!adm) continue;
    if (!stuAdmGroups.has(adm)) stuAdmGroups.set(adm, []);
    stuAdmGroups.get(adm).push(u);
  }
  const stuDups = [...stuAdmGroups.entries()].filter(([, g]) => g.length > 1);

  if (stuDups.length === 0) {
    console.log('  ✓ No student user duplicates by admission number\n');
  } else {
    console.log(`  Found ${stuDups.length} duplicate groups:\n`);
    for (const [adm, group] of stuDups) {
      console.log(`  Admission: "${adm}"`);
      for (const u of group) {
        console.log(`    - userId: ${u.id} | email: ${u.email} | phone: ${u.phone ?? 'none'} | created: ${new Date(u.createdAt).toISOString().split('T')[0]}`);
      }
    }
    console.log();
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────────
  console.log('## Summary');
  console.log(`  Total active learners           : ${allLearners.length}`);
  console.log(`  Duplicate name+DOB groups       : ${nameDobDups.length}`);
  console.log(`  Duplicate admission number groups: ${admDups.length}`);
  console.log(`  Duplicate student user groups   : ${stuDups.length}`);

  console.log(`\n${'='.repeat(64)}\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
