/**
 * scratch/test-waiver.ts
 * 
 * Script to test the waiver deduction logic directly via the controller's underlying Prisma flow.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting Waiver Test...\n');

  // 1. Find the partial invoice (Ahlam Hache)
  const invoice = await prisma.feeInvoice.findFirst({
    where: { status: 'PARTIAL' },
    include: { learner: true }
  });

  if (!invoice) {
    console.log('❌ No PARTIAL invoice found to test.');
    return;
  }

  console.log(`📄 Found Invoice: ${invoice.invoiceNumber} for ${invoice.learner.firstName}`);
  console.log(`   Initial Balance: KES ${invoice.balance}`);

  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
     console.log('❌ No ADMIN found to act as author.');
     return;
  }

  // 2. CREATE the Waiver (Simulating createWaiver)
  const amountWaived = 300;
  console.log(`\n📝 Creating PENDING waiver for KES ${amountWaived}...`);
  
  const waiver = await prisma.feeWaiver.create({
    data: {
      invoiceId: invoice.id,
      amountWaived,
      reason: 'Test WAIVER of 300',
      waiverCategory: 'OTHER',
      status: 'PENDING',
      createdById: admin.id
    }
  });

  console.log(`   Waiver created! ID: ${waiver.id} | Status: ${waiver.status}`);

  // 3. APPROVE the Waiver (Simulating exact logic from verifyWaiver bugfix)
  console.log(`\n✅ Approving Waiver via exact Controller Transaction Flow...`);
  
  const [updatedWaiver, updatedInvoice] = await prisma.$transaction(async (tx) => {
    const approved = await tx.feeWaiver.update({
      where: { id: waiver.id },
      data: {
        status: 'APPROVED',
        approvedById: admin.id,
        approvedAt: new Date()
      }
    });

    const freshInvoice = await tx.feeInvoice.findUnique({
      where: { id: waiver.invoiceId },
      select: { balance: true, paidAmount: true, totalAmount: true }
    });

    const newBalance = Math.max(0, Number(freshInvoice!.balance) - Number(approved.amountWaived));

    let newStatus = 'PENDING';
    if (newBalance <= 0) {
      newStatus = 'PAID';
    } else if (Number(freshInvoice!.paidAmount) > 0) {
      newStatus = 'PARTIAL';
    }

    const inv = await tx.feeInvoice.update({
      where: { id: waiver.invoiceId },
      data: { balance: newBalance, status: newStatus as any }
    });

    return [approved, inv];
  });

  console.log(`\n🎉 Results After Approval:`);
  console.log(`   Waiver Status:  ${updatedWaiver.status}`);
  console.log(`   Invoice Status: ${updatedInvoice.status}`);
  console.log(`   Final Balance:  KES ${updatedInvoice.balance}`);

  if (Number(updatedInvoice.balance) === Number(invoice.balance) - amountWaived) {
    console.log(`\n✅ SUCCESS: Balance correctly deducted by ${amountWaived}!`);
  } else {
    console.log(`\n❌ FAILED: Balance did not update correctly.`);
  }

}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
