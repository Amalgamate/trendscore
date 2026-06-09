/**
 * Seed demo fee payment data for the local instance.
 * Spreads payments over the last 6 months so the trend chart populates.
 * Run: npx ts-node scripts/seed-fee-payments.ts
 */

import { PrismaClient, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

function randomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 100;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(Math.floor(Math.random() * 8) + 8, Math.floor(Math.random() * 59), 0, 0);
  return d;
}

function receiptNumber(prefix: string, idx: number): string {
  return `${prefix}-SEED-${String(idx).padStart(4, '0')}`;
}

async function main() {
  console.log('🌱 Seeding fee payment data...');

  // Get invoices
  const invoices = await prisma.feeInvoice.findMany({
    where: { archived: false },
    select: { id: true, totalAmount: true },
    take: 80,
  });

  if (invoices.length === 0) {
    console.error('❌ No fee invoices found. Create some invoices first.');
    process.exit(1);
  }

  // Get a valid recorder (admin user)
  const recorder = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] }, archived: false },
    select: { id: true },
  });

  if (!recorder) {
    console.error('❌ No admin/accountant user found.');
    process.exit(1);
  }

  console.log(`  Found ${invoices.length} invoices, recorder: ${recorder.id}`);

  const methods: PaymentMethod[] = ['MPESA', 'CASH', 'BANK_TRANSFER', 'MPESA', 'MPESA'];

  // Distribute payments across last 6 months
  // Month 0 = 6 months ago (small), ramping up to this month (largest)
  const monthBuckets = [
    { daysMin: 165, daysMax: 145, count: 6,  amountMin: 5, amountMax: 12 },  // 6mo ago
    { daysMin: 144, daysMax: 115, count: 10, amountMin: 8, amountMax: 18 },  // 5mo ago
    { daysMin: 114, daysMax: 85,  count: 15, amountMin: 10, amountMax: 22 }, // 4mo ago
    { daysMin: 84,  daysMax: 55,  count: 20, amountMin: 12, amountMax: 28 }, // 3mo ago
    { daysMin: 54,  daysMax: 25,  count: 25, amountMin: 15, amountMax: 35 }, // 2mo ago
    { daysMin: 24,  daysMax: 1,   count: 30, amountMin: 20, amountMax: 45 }, // this month
  ];

  let seeded = 0;
  let idx = 1;

  for (const bucket of monthBuckets) {
    for (let i = 0; i < bucket.count; i++) {
      const invoice = invoices[seeded % invoices.length];
      const days = Math.floor(Math.random() * (bucket.daysMax - bucket.daysMin + 1)) + bucket.daysMin;
      const paymentDate = daysAgo(days);
      const amount = randomAmount(bucket.amountMin, bucket.amountMax);
      const method = methods[Math.floor(Math.random() * methods.length)];
      const receipt = receiptNumber('PAY', idx++);

      try {
        await prisma.feePayment.create({
          data: {
            receiptNumber: receipt,
            invoiceId: invoice.id,
            amount,
            paymentMethod: method,
            paymentDate,
            createdAt: paymentDate,
            recordedBy: recorder.id,
            referenceNumber: method === 'MPESA' ? `QHZ${Math.random().toString(36).substring(2, 9).toUpperCase()}` : null,
            notes: 'Seeded demo payment',
          },
        });
        seeded++;
      } catch (err: any) {
        // Skip duplicate receipts silently
        if (!err.message?.includes('Unique constraint')) {
          console.warn(`  ⚠ Skipped: ${err.message}`);
        }
      }
    }
  }

  console.log(`✅ Seeded ${seeded} fee payments across 6 months.`);
  console.log('   Refresh the dashboard to see the trend chart.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
