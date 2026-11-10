import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedApprovalWorkflows(): Promise<void> {
  console.log('  Seeding approval workflows...');

  // Upsert the default SCORE_UNLOCK workflow
  const workflow = await prisma.approvalWorkflow.upsert({
    where: {
      module_requestType: {
        module: 'ACADEMICS',
        requestType: 'SCORE_UNLOCK',
      },
    },
    update: {
      // Keep existing config on update — don't overwrite admin customizations
    },
    create: {
      name: 'Score Unlock',
      module: 'ACADEMICS',
      requestType: 'SCORE_UNLOCK',
      description: 'Approve teacher requests to temporarily unlock locked assessment scores for editing.',
      active: true,
      approvalMode: 'SINGLE',
      minApprovals: 1,
      relockAfterMinutes: 60,
    },
  });

  // Ensure the default step exists — upsert by workflowId + stepNumber
  const existingStep = await prisma.approvalStep.findUnique({
    where: {
      workflowId_stepNumber: {
        workflowId: workflow.id,
        stepNumber: 1,
      },
    },
  });

  if (!existingStep) {
    await prisma.approvalStep.create({
      data: {
        workflowId: workflow.id,
        stepNumber: 1,
        approverType: 'ROLE',
        approverRoles: ['ADMIN', 'HEAD_TEACHER'],
        approverUserIds: [],
        minApprovals: 1,
      },
    });
    console.log('    ✓ Created SCORE_UNLOCK workflow step 1 (ADMIN + HEAD_TEACHER)');
  } else {
    console.log('    ✓ SCORE_UNLOCK workflow step 1 already exists');
  }

  console.log(`  ✓ Approval workflow seeded: ${workflow.name} (id: ${workflow.id})`);

  // ── PAYMENT_REVERSAL workflow (refund approval) ──────────────────────────
  // Finance staff submit refund requests; only the school owner (SUPER_ADMIN)
  // can approve. This ensures the approval engine routes refund requests
  // correctly and the paymentReversalApprovalHandler fires on approval.
  const refundWorkflow = await prisma.approvalWorkflow.upsert({
    where: {
      module_requestType: {
        module: 'FEES',
        requestType: 'PAYMENT_REVERSAL',
      },
    },
    update: {
      // Preserve admin customizations on update
    },
    create: {
      name: 'Refund Approval',
      module: 'FEES',
      requestType: 'PAYMENT_REVERSAL',
      description: 'Finance staff submit refund requests. Only the school owner (SUPER_ADMIN) can approve. Triggers invoice correction, ledger reversal, and B2C disbursement.',
      active: true,
      approvalMode: 'SINGLE',
      minApprovals: 1,
    },
  });

  const existingRefundStep = await prisma.approvalStep.findUnique({
    where: {
      workflowId_stepNumber: {
        workflowId: refundWorkflow.id,
        stepNumber: 1,
      },
    },
  });

  if (!existingRefundStep) {
    await prisma.approvalStep.create({
      data: {
        workflowId: refundWorkflow.id,
        stepNumber: 1,
        approverType: 'ROLE',
        approverRoles: ['SUPER_ADMIN'],
        approverUserIds: [],
        minApprovals: 1,
      },
    });
    console.log('    ✓ Created PAYMENT_REVERSAL workflow step 1 (SUPER_ADMIN only)');
  } else {
    console.log('    ✓ PAYMENT_REVERSAL workflow step 1 already exists');
  }

  console.log(`  ✓ Approval workflow seeded: ${refundWorkflow.name} (id: ${refundWorkflow.id})`);
}
