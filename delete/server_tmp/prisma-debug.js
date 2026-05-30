require('dotenv').config({path: './.env'});
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const data = {
    type: 'OPENER',
    strategy: 'SIMPLE_AVERAGE',
    grade: 'GRADE_1',
    learningArea: 'TEST_MATH',
    weight: 10,
    createdBy: 'test-settings-admin-id'
  };
  console.log('grade typeof', typeof data.grade, data.grade instanceof String, data.grade.constructor.name);
  try {
    const res = await prisma.aggregationConfig.create({ data });
    console.log('created', res);
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
})();
