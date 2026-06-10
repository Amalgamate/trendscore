import { PrismaClient, Grade, Term, SummativeGrade, TestStatus, FormativeAssessmentType, RubricRating } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const ACADEMIC_YEAR = 2026;
const TERM: Term = 'TERM_1';

// Learning areas by grade
const LEARNING_AREAS_BY_GRADE: Record<string, string[]> = {
  'PP1': ['Mathematical Activities', 'Language Activities', 'Literacy & Reading', 'Environmental Activities', 'Creative Activities'],
  'PP2': ['Mathematical Activities', 'Language Activities', 'Literacy & Reading', 'Environmental Activities', 'Creative Activities'],
  'GRADE_1': ['English', 'Mathematics', 'Environmental Activities', 'Creative Activities'],
  'GRADE_2': ['English', 'Mathematics', 'Science & Technology', 'Social Studies', 'Creative Activities'],
  'GRADE_3': ['English', 'Mathematics', 'Science & Technology', 'Social Studies', 'Creative Activities'],
  'GRADE_4': ['English', 'Mathematics', 'Science & Technology', 'Social Studies', 'Kenya Sign Language'],
  'GRADE_5': ['English', 'Mathematics', 'Science & Technology', 'Social Studies', 'Kenya Sign Language'],
  'GRADE_6': ['English', 'Mathematics', 'Science & Technology', 'Social Studies', 'Kenya Sign Language'],
};

// Function to calculate grade from marks
function calculateGrade(marks: number, totalMarks: number = 100): SummativeGrade {
  const percentage = (marks / totalMarks) * 100;
  if (percentage >= 80) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'E';
}

// Function to calculate status from marks
function calculateStatus(marks: number, totalMarks: number = 100): TestStatus {
  const percentage = (marks / totalMarks) * 100;
  return percentage >= 40 ? 'PASS' : 'FAIL';
}

// Generate realistic random score with skew towards higher marks
function generateRandomScore(maxMarks: number): number {
  // Generate a score with normal distribution skewed towards higher marks
  const random = Math.random() + Math.random() + Math.random(); // Sum of 3 random values gives roughly normal distribution
  const normalized = random / 3; // Normalize to 0-1
  return Math.round(normalized * maxMarks);
}

async function main() {
  console.log('🌱 Starting comprehensive test seeding for all students...\n');

  try {
    // 1. Get School
    let school = await prisma.school.findFirst({
      where: { name: 'TRENDSCORE DEMO ACADEMY' }
    });

    if (!school) {
      console.log('⚠️ School not found, trying to find any school...');
      school = await prisma.school.findFirst();
    }

    if (!school) {
      console.error('❌ No school found in database.');
      return;
    }

    console.log(`✅ Working with school: ${school.name}\n`);

    // 2. Get an admin/teacher user for creating tests and recording results
    const adminUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: { in: ['ADMIN', 'TEACHER'] } }
    });

    if (!adminUser) {
      console.error('❌ No admin/teacher user found.');
      return;
    }

    console.log(`✅ Using user for test creation: ${adminUser.firstName} ${adminUser.lastName}\n`);

    // 3. Get all learners grouped by grade
    const allLearners = await prisma.learner.findMany({
      where: { schoolId: school.id, archived: false },
      select: { id: true, grade: true, firstName: true, lastName: true, admissionNumber: true }
    });

    console.log(`📊 Found ${allLearners.length} students in the system\n`);

    if (allLearners.length === 0) {
      console.warn('⚠️ No learners found. Please seed learners first.');
      return;
    }

    // Group learners by grade
    const learnersByGrade = new Map<string, typeof allLearners>();
    for (const learner of allLearners) {
      if (!learnersByGrade.has(learner.grade)) {
        learnersByGrade.set(learner.grade, []);
      }
      learnersByGrade.get(learner.grade)!.push(learner);
    }

    console.log('📚 Learners by Grade:');
    for (const [grade, learners] of learnersByGrade) {
      console.log(`   ${grade}: ${learners.length} students`);
    }
    console.log('');

    // 4. Create Tests for Each Grade + Learning Area Combination
    const testMap = new Map<string, string>(); // key: "GRADE_X:LearningArea" -> value: testId

    console.log('🧪 Creating Summative Tests...\n');

    for (const [grade, learningAreas] of Object.entries(LEARNING_AREAS_BY_GRADE)) {
      const learners = learnersByGrade.get(grade);

      // Skip if no learners for this grade
      if (!learners || learners.length === 0) {
        console.log(`   ⏭️  Skipping ${grade} - no students enrolled`);
        continue;
      }

      console.log(`📝 Creating tests for ${grade} (${learners.length} students)`);

      for (const learningArea of learningAreas) {
        const testKey = `${grade}:${learningArea}`;
        const testTitle = `${learningArea} Test - ${TERM}`;

        // Check if test already exists
        let test = await prisma.summativeTest.findFirst({
          where: {
            schoolId: school.id,
            grade: grade as Grade,
            term: TERM,
            academicYear: ACADEMIC_YEAR,
            learningArea: learningArea,
            title: testTitle
          }
        });

        if (!test) {
          // Find grading scale for this grade + learning area
          let scale = await prisma.gradingSystem.findFirst({
            where: {
              grade: grade as Grade,
              name: {
                contains: learningArea
              }
            }
          });

          // If no scale, try to find a default scale for the grade
          if (!scale) {
            scale = await prisma.gradingSystem.findFirst({
              where: {
                grade: grade as Grade
              }
            });
          }

          // Create test
          test = await prisma.summativeTest.create({
            data: {
              title: testTitle,
              learningArea: learningArea,
              term: TERM,
              academicYear: ACADEMIC_YEAR,
              grade: grade as Grade,
              testDate: new Date('2025-02-15'), // Fixed test date
              totalMarks: 100,
              passMarks: 40,
              schoolId: school.id,
              createdBy: adminUser.id,
              scaleId: scale?.id || undefined, // Associate grading scale for performance descriptors
              active: true,
              published: true,
              status: 'PUBLISHED',
              description: `Summative assessment for ${learningArea}`
            }
          });
          console.log(`   ✅ Created: ${testTitle}`);
        } else {
          console.log(`   ℹ️  Found: ${testTitle}`);
        }

        testMap.set(testKey, test.id);
      }
      console.log('');
    }

    // 5. Create Results for All Students
    console.log('\n📈 Creating Student Results...\n');

    let totalResultsCreated = 0;
    let totalResultsUpdated = 0;

    for (const [grade, learners] of learnersByGrade) {
      const learningAreas = LEARNING_AREAS_BY_GRADE[grade] || [];
      console.log(`📊 Processing results for ${grade} (${learners.length} students, ${learningAreas.length} subjects)`);

      for (const learningArea of learningAreas) {
        const testKey = `${grade}:${learningArea}`;
        const testId = testMap.get(testKey);

        if (!testId) {
          console.warn(`   ⚠️  No test found for ${testKey}`);
          continue;
        }

        for (const learner of learners) {
          // Generate random score
          const marksObtained = generateRandomScore(100);
          const percentage = marksObtained; // Out of 100
          const gradeValue = calculateGrade(marksObtained, 100);
          const status = calculateStatus(marksObtained, 100);

          // Upsert result
          const result = await prisma.summativeResult.upsert({
            where: {
              testId_learnerId: {
                testId: testId,
                learnerId: learner.id
              }
            },
            update: {
              marksObtained: marksObtained,
              percentage: percentage,
              grade: gradeValue,
              status: status,
              recordedBy: adminUser.id,
              updatedAt: new Date()
            },
            create: {
              testId: testId,
              learnerId: learner.id,
              marksObtained: marksObtained,
              percentage: percentage,
              grade: gradeValue,
              status: status,
              schoolId: school.id,
              recordedBy: adminUser.id
            }
          });

          // Track whether it was created or updated
          if (result.createdAt.getTime() === new Date(result.updatedAt).getTime()) {
            totalResultsCreated++;
          } else {
            totalResultsUpdated++;
          }

          process.stdout.write('.');
        }
      }
      console.log(' ✅');
    }

    console.log(`\n✅ Total Results Created: ${totalResultsCreated}`);
    console.log(`📝 Total Results Updated: ${totalResultsUpdated}`);

    // 6. Create Formative Assessments
    console.log('\n\n📋 Creating Formative Assessments...\n');

    let formativeCreated = 0;
    const formativeTypes: FormativeAssessmentType[] = ['OPENER', 'WEEKLY', 'QUIZ', 'ASSIGNMENT'];
    const rubricRatings: RubricRating[] = ['EE', 'ME', 'AE', 'BE'];

    for (const [grade, learners] of learnersByGrade) {
      const learningAreas = LEARNING_AREAS_BY_GRADE[grade] || [];
      console.log(`📝 Creating formative assessments for ${grade}`);

      for (const learningArea of learningAreas) {
        for (const assessmentType of formativeTypes) {
          const assessmentTitle = `${assessmentType} - ${learningArea}`;

          // Check if exists
          let formative = await prisma.formativeAssessment.findFirst({
            where: {
              schoolId: school.id,
              learningArea: learningArea,
              term: TERM,
              academicYear: ACADEMIC_YEAR,
              type: assessmentType,
              // Don't filter by title since it's optional
            }
          });

          if (!formative) {
            // Create one formative assessment entry for tracking
            formative = await prisma.formativeAssessment.create({
              data: {
                learnerId: learners[0].id, // Use first learner as anchor
                learningArea: learningArea,
                term: TERM,
                academicYear: ACADEMIC_YEAR,
                teacherId: adminUser.id,
                schoolId: school.id,
                type: assessmentType,
                title: assessmentTitle,
                status: 'PUBLISHED',
                overallRating: 'ME', // Meeting Evidence
                exceedingCount: Math.floor(learners.length * 0.2),
                meetingCount: Math.floor(learners.length * 0.5),
                approachingCount: Math.floor(learners.length * 0.2),
                belowCount: Math.floor(learners.length * 0.1),
                percentage: 75,
                points: 75,
                locked: false
              }
            });

            formativeCreated++;
            process.stdout.write('.');
          }
        }
      }
    }

    console.log(`\n✅ Formative Assessments Created: ${formativeCreated}\n`);

    // 7. Summary Report
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ School: ${school.name}`);
    console.log(`✅ Academic Year: ${ACADEMIC_YEAR}`);
    console.log(`✅ Term: ${TERM}`);
    console.log(`✅ Total Learners: ${allLearners.length}`);
    console.log(`✅ Summative Tests Created: ${testMap.size}`);
    console.log(`✅ Summative Results Created: ${totalResultsCreated}`);
    console.log(`✅ Formative Assessments Created: ${formativeCreated}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
