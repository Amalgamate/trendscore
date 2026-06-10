import prisma from '../config/database'
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity'

async function purgeAllData() {
  console.log('🧹 Purging all existing data...');
  await prisma.summativeResult.deleteMany({})
  await prisma.summativeTest.deleteMany({})
  await prisma.formativeAssessment.deleteMany({})
  await prisma.classEnrollment.deleteMany({})
  await prisma.class.deleteMany({})
  await prisma.learner.deleteMany({})
  await prisma.gradingRange.deleteMany({})
  await prisma.gradingSystem.deleteMany({})
  await prisma.aggregationConfig.deleteMany({})
  await prisma.termConfig.deleteMany({})
  await prisma.streamConfig.deleteMany({})
  await prisma.school.deleteMany({})
  console.log('✅ Purge complete.');
}

async function main() {
  const purge = process.argv.includes('--purge')

  if (purge) {
    await purgeAllData()
  }

  console.log('🚀 Initializing system...');
  const existingSchool = await prisma.school.findFirst()
  if (existingSchool) {
    console.log('⚠️ System already initialized. Use --purge to reset.');
    return;
  }

  const school = await prisma.school.create({
    data: {
      name: `${PRODUCT_DISPLAY_NAME} Academy`,
      admissionFormatType: 'NO_BRANCH',
      branchSeparator: '-',
      curriculumType: 'CBC_AND_EXAM',
      assessmentMode: 'MIXED',
      active: true,
      status: 'ACTIVE'
    }
  })

  console.log('✅ School created:', school.name)
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
