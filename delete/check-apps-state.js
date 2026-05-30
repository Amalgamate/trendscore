const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAppsState() {
  try {
    // Get the first school
    const school = await prisma.school.findFirst();
    console.log(`\n📍 School: ${school?.name} (ID: ${school?.id})\n`);

    if (!school) {
      console.log('❌ No school found');
      process.exit(1);
    }

    // Get all app configs for this school
    const configs = await prisma.schoolAppConfig.findMany({
      where: { schoolId: school.id },
      include: { app: { select: { slug: true, name: true } } },
      orderBy: { app: { slug: 'asc' } }
    });

    console.log(`📊 App Configurations for ${school.name}:`);
    console.log(`═══════════════════════════════════════════════════════════════════`);
    
    let activeCount = 0;
    configs.forEach(config => {
      const status = config.isActive ? '✅' : '❌';
      const mandatory = config.isMandatory ? '🔒' : '  ';
      const visible = config.isVisible ? '👁️' : '  ';
      
      console.log(`${status} ${mandatory} ${visible} ${config.app.slug.padEnd(20)} | Active: ${String(config.isActive).padEnd(5)} | Mandatory: ${String(config.isMandatory).padEnd(5)} | Visible: ${config.isVisible}`);
      if (config.isActive) activeCount++;
    });

    console.log(`═══════════════════════════════════════════════════════════════════`);
    console.log(`\n✅ Total Active Apps: ${activeCount}/${configs.length}`);
    console.log(`\n`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkAppsState();
