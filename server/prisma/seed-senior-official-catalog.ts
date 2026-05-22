import { PrismaClient } from '@prisma/client';
import { seedSeniorOfficialCatalog } from '../src/services/senior-pathway-catalog.seed';

const prisma = new PrismaClient();

async function main() {
  const result = await seedSeniorOfficialCatalog(prisma);
  console.log('Senior School official catalog seeded:', result);
}

main()
  .catch((error) => {
    console.error('Senior School official catalog seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
