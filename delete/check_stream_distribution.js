const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStreamDistribution() {
  try {
    console.log('🔍 Checking stream distribution for GRADE_9 students...\n');

    // Check streams in GRADE_9
    const grade9Streams = await prisma.learner.groupBy({
      by: ['stream'],
      where: {
        grade: 'GRADE_9',
        archived: false,
        status: 'ACTIVE'
      },
      _count: true
    });

    console.log('📊 GRADE_9 Students by Stream:');
    console.log(JSON.stringify(grade9Streams, null, 2));
    console.log('\nTotal GRADE_9 students:', grade9Streams.reduce((sum, s) => sum + s._count, 0));

    // Check all distinct streams in the system
    console.log('\n\n🌍 All distinct streams in system:');
    const allStreams = await prisma.learner.findMany({
      select: { stream: true },
      where: { archived: false },
      distinct: ['stream']
    });
    console.log(allStreams.map(s => s.stream));

    // Check GRADE_9 with stream filter
    console.log('\n\n🎯 GRADE_9 with stream=A filter:');
    const grade9StreamA = await prisma.learner.count({
      where: {
        grade: 'GRADE_9',
        stream: 'A',
        archived: false,
        status: 'ACTIVE'
      }
    });
    console.log(`Students in GRADE_9 + stream=A: ${grade9StreamA}`);

    // Check if other streams have students at all
    console.log('\n\n📋 Student count by all streams:');
    const allStreamCounts = await prisma.learner.groupBy({
      by: ['stream'],
      where: { archived: false, status: 'ACTIVE' },
      _count: true
    });
    console.log(JSON.stringify(allStreamCounts, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStreamDistribution();
