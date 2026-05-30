const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkApps() {
  try {
    const apps = await prisma.app.findMany({ orderBy: { slug: 'asc' } });
    console.log(`\n📚 Total App Definitions: ${apps.length}\n`);
    apps.slice(0, 10).forEach(app => {
      console.log(`• ${app.slug.padEnd(20)} | ${app.name}`);
    });
    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkApps();
