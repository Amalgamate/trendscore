const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('Connecting to Prisma...');
  await prisma.$connect();
  console.log('Connected!');
  await prisma.$disconnect();
}

test().catch(console.error);
