const { PrismaClient } = require('@prisma/client');

const loadSeeder = () => {
  try {
    return require('../dist/services/senior-pathway-catalog.seed');
  } catch (distError) {
    try {
      require('ts-node/register');
      return require('../src/services/senior-pathway-catalog.seed');
    } catch (srcError) {
      console.error('[seed:ss:official-catalog] Failed to load seeder.');
      console.error('dist:', distError.message);
      console.error('src:', srcError.message);
      throw srcError;
    }
  }
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const { seedSeniorOfficialCatalog } = loadSeeder();
    const result = await seedSeniorOfficialCatalog(prisma);
    console.log('[seed:ss:official-catalog] Complete:', result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[seed:ss:official-catalog] Failed:', error);
  process.exit(1);
});
