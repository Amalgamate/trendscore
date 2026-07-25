import prisma from '../config/database';
import { parentService } from '../services/parent.service';

const main = async () => {
  const learnerId = String(process.argv[2] || '').trim();

  if (!learnerId) {
    throw new Error('Usage: node dist/scripts/sync-primary-parent.js <learner-id>');
  }

  const learner = await prisma.learner.findUnique({
  where: { id: learnerId },
  select: {
    id: true,
    admissionNumber: true,
    primaryContactType: true,
    primaryContactName: true,
    primaryContactPhone: true,
    primaryContactEmail: true,
  },
  });

  if (!learner) throw new Error(`Learner not found: ${learnerId}`);
  if (!learner.primaryContactType || !learner.primaryContactName || !learner.primaryContactPhone) {
    throw new Error('Learner does not have a complete primary contact');
  }

  const parent = await parentService.syncPrimaryParentForLearner({
  learnerId: learner.id,
  admissionNumber: learner.admissionNumber,
  phone: learner.primaryContactPhone,
  name: learner.primaryContactName,
  email: learner.primaryContactEmail,
  relationship: learner.primaryContactType,
  });

  console.log(JSON.stringify({
  success: true,
  learnerId: learner.id,
  admissionNumber: learner.admissionNumber,
  parentId: parent.id,
  parentName: `${parent.firstName} ${parent.lastName}`.trim(),
  parentPhone: parent.phone,
  }));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
