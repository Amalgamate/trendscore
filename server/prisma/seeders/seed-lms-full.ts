/**
 * LMS Full Dummy Content Seeder
 *
 * Populates the Digital Learning Hub with realistic dummy data:
 *  - School, teachers, students, learners
 *  - Classes, learning areas, term configs
 *  - Legacy LMSCourses + LMSContent
 *  - LearningLessons + LessonBlocks (multiple block types)
 *  - LearningAssignments + questions
 *  - LearningResources
 *  - Enrollments, progress, sessions, achievements, bookmarks
 *
 * Run: npx ts-node prisma/seeders/seed-lms-full.ts
 */

import { PrismaClient, UserRole, Gender, LearnerStatus, CourseStatus, ContentType, EnrollmentStatus, LessonStatus, LessonBlockType, AssignmentCategory, AssignmentStatus, SubmissionStatus, ResourceType, DifficultyLevel, AchievementType, Term, InstitutionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD_HASH = bcrypt.hashSync('Password123!', 10);

async function ensureSchool() {
  return prisma.school.upsert({
    where: { name: 'LMS Demo Academy' },
    update: { active: true, status: 'ACTIVE', archived: false, institutionType: InstitutionType.SECONDARY, institutionTypeLocked: true, requiresUserVerification: false, curriculumType: 'CBC_AND_EXAM' as any },
    create: { name: 'LMS Demo Academy', active: true, status: 'ACTIVE', institutionType: InstitutionType.SECONDARY, institutionTypeLocked: true, requiresUserVerification: false, curriculumType: 'CBC_AND_EXAM' as any },
  });
}

async function ensureUser(email: string, role: UserRole, firstName: string, lastName: string, username?: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: PASSWORD_HASH, firstName, lastName, role, status: 'ACTIVE', emailVerified: true, username: username || email.split('@')[0] },
  });
}

async function ensureLearner(admissionNumber: string, firstName: string, lastName: string, grade: string, stream?: string) {
  return prisma.learner.upsert({
    where: { admissionNumber },
    update: {},
    create: { admissionNumber, firstName, lastName, dateOfBirth: new Date('2010-01-01'), gender: Gender.MALE, grade, stream: stream || 'A', status: LearnerStatus.ACTIVE, institutionType: InstitutionType.SECONDARY },
  });
}

async function ensureClass(name: string, grade: string, stream: string, academicYear: number, term: Term) {
  const code = `CLS-${grade}-${stream}-${academicYear}`;
  const existing = await prisma.class.findFirst({ where: { name, grade, stream, academicYear, term } });
  if (existing) return existing;
  return prisma.class.create({ data: { classCode: code, name, grade, stream: stream || 'A', academicYear, term, capacity: 40, active: true, institutionType: InstitutionType.SECONDARY } });
}

async function ensureLearningArea(name: string, gradeLevel: string, institutionType: InstitutionType) {
  const existing = await prisma.learningArea.findFirst({ where: { name, gradeLevel } });
  if (existing) return existing;
  return prisma.learningArea.create({ data: { name, gradeLevel, institutionType, icon: '📚', color: '#6366f1' } });
}

async function ensureTermConfig(academicYear: number, term: Term, startDate: Date, endDate: Date, createdById: string) {
  const existing = await prisma.termConfig.findFirst({ where: { academicYear, term } });
  if (existing) return existing;
  return prisma.termConfig.create({ data: { academicYear, term, startDate, endDate, isActive: term === Term.TERM_1, createdBy: createdById } });
}

async function seedLMSCourse(schoolId: string, teacherId: string, title: string, subject: string, grade: string, category: string, status: CourseStatus) {
  const existing = await prisma.lMSCourse.findFirst({ where: { title, createdById: teacherId } });
  if (existing) return existing;
  return prisma.lMSCourse.create({ data: { title, description: `Dummy ${title} course.`, subject, grade, category, status: status || CourseStatus.PUBLISHED, createdById: teacherId } });
}

async function seedLMSContent(courseId: string, teacherId: string, items: { title: string; type: ContentType; url: string; description?: string }[]) {
  const created = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const existing = await prisma.lMSContent.findFirst({ where: { courseId, title: item.title } });
    if (existing) { created.push(existing); continue; }
    created.push(await prisma.lMSContent.create({ data: { courseId, title: item.title, description: item.description, type: item.type, url: item.url, order: i + 1, uploadedById: teacherId } }));
  }
  return created;
}

async function seedLearningLesson(schoolId: string, classId: string, learningAreaId: string, termId: string, teacherId: string, title: string, status: LessonStatus, blocks: { type: LessonBlockType; order: number; content: any }[]) {
  const existing = await prisma.learningLesson.findFirst({ where: { schoolId, title, createdById: teacherId } });
  let lesson: any;
  if (existing) {
    lesson = existing;
  } else {
    lesson = await prisma.learningLesson.create({ data: { schoolId, classId, learningAreaId, termId, title, description: `Dummy lesson: ${title}`, status, createdById: teacherId, estimatedMins: 45, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), allowComments: true, allowQuestions: true, allowDownload: false } });
  }
  const createdBlocks = [];
  for (const block of blocks) {
    const existingBlock = await prisma.lessonBlock.findFirst({ where: { lessonId: lesson.id, order: block.order } });
    if (existingBlock) { createdBlocks.push(existingBlock); continue; }
    createdBlocks.push(await prisma.lessonBlock.create({ data: { lessonId: lesson.id, type: block.type, order: block.order, content: block.content } }));
  }
  return { lesson, blocks: createdBlocks };
}

async function seedLearningAssignment(schoolId: string, classId: string, learningAreaId: string, termId: string, teacherId: string, title: string, category: AssignmentCategory, status: AssignmentStatus, questions: any[]) {
  const existing = await prisma.learningAssignment.findFirst({ where: { schoolId, title, createdById: teacherId } });
  let assignment: any;
  if (existing) {
    assignment = existing;
  } else {
    assignment = await prisma.learningAssignment.create({ data: { schoolId, classId, learningAreaId, termId, title, instructions: `Complete the ${title} assignment.`, category, status, totalMarks: 100, passMark: 50, questions, createdById: teacherId, dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), estimatedMins: 60, allowLateSubmit: true, allowResubmit: false, maxFileSize: 25, allowedFileTypes: ['pdf', 'docx', 'jpg'], gradebookSync: false } });
  }
  return assignment;
}

async function seedLearningResource(schoolId: string, learningAreaId: string, title: string, resourceType: ResourceType, difficulty: DifficultyLevel, topic: string, term: number, uploadedById: string) {
  const existing = await prisma.learningResource.findFirst({ where: { schoolId, title, uploadedById } });
  if (existing) return existing;
  return prisma.learningResource.create({ data: { schoolId, learningAreaId, title, description: `Dummy ${resourceType.toLowerCase()} on ${topic}.`, resourceType, difficulty, topic, term, year: new Date().getFullYear(), uploadedById, isPublic: false } });
}

async function seedEnrollment(courseId: string, learnerId: string, enrolledById: string, status: EnrollmentStatus) {
  const existing = await prisma.lMSEnrollment.findFirst({ where: { courseId, learnerId, status } });
  if (existing) return existing;
  return prisma.lMSEnrollment.create({ data: { courseId, learnerId, enrolledById, status, enrolledAt: new Date() } });
}

async function seedLMSProgress(enrollmentId: string, contentId: string, completed: boolean, progress: number) {
  const existing = await prisma.lMSProgress.findFirst({ where: { enrollmentId, contentId } });
  if (existing) return existing;
  return prisma.lMSProgress.create({ data: { enrollmentId, contentId, completed, progress, timeSpent: completed ? 300 : 0, lastAccessedAt: new Date() } });
}

async function seedLearningProgress(learnerId: string, lessonId: string, schoolId: string, blocksCompleted: number, totalBlocks: number, percentComplete: number) {
  const existing = await prisma.learningProgress.findFirst({ where: { learnerId, lessonId } });
  if (existing) return existing;
  return prisma.learningProgress.create({ data: { learnerId, lessonId, schoolId, blocksCompleted, totalBlocks, percentComplete, timeSpentMins: Math.round(totalBlocks * 5), completedAt: percentComplete >= 100 ? new Date() : null } });
}

async function seedLearningSession(learnerId: string, lessonId: string, schoolId: string, durationSec: number, deviceType: string) {
  const startedAt = new Date(Date.now() - durationSec * 1000);
  return prisma.learningSession.create({ data: { learnerId, lessonId, schoolId, startedAt, endedAt: new Date(), durationSec, deviceType: deviceType as any } });
}

async function seedAchievement(learnerId: string, schoolId: string, type: AchievementType, title: string, description: string, xpEarned: number) {
  const existing = await prisma.learnerAchievement.findFirst({ where: { learnerId, schoolId, type, archived: false } });
  if (existing) return existing;
  return prisma.learnerAchievement.create({ data: { learnerId, schoolId, type, title, description, xpEarned, earnedAt: new Date() } });
}

async function seedLearningBookmark(learnerId: string, resourceId: string, schoolId: string) {
  const existing = await prisma.learningBookmark.findFirst({ where: { learnerId, resourceId } });
  if (existing) return existing;
  return prisma.learningBookmark.create({ data: { learnerId, resourceId, schoolId } });
}

async function main() {
  console.log('🌱 Starting full LMS dummy content seeder...');

  const school = await ensureSchool();
  console.log(`   School: ${school.name}`);

  const teacher = await ensureUser('lms.teacher@demo.test', UserRole.TEACHER, 'Demo', 'Teacher', 'demo-teacher');
  console.log(`   Teacher: ${teacher.firstName} ${teacher.lastName}`);

  const studentUsers = [];
  const learners = [];
  for (let i = 1; i <= 5; i++) {
    const email = `lms.student${i}@demo.test`;
    const user = await ensureUser(email, UserRole.STUDENT, `Student`, `${i}`, `lms-student-${i}`);
    const learner = await ensureLearner(`lms-student-${i}`, `Student`, `${i}`, 'GRADE_10', 'A');
    await prisma.learner.update({ where: { id: learner.id }, data: { parentId: teacher.id } });
    studentUsers.push(user);
    learners.push(learner);
    console.log(`   Student ${i}: ${user.firstName} ${user.lastName} (${learner.admissionNumber})`);
  }

  const class10A = await ensureClass('Grade 10 - A', 'GRADE_10', 'A', 2025, Term.TERM_1);
  const class10B = await ensureClass('Grade 10 - B', 'GRADE_10', 'B', 2025, Term.TERM_1);
  const class11A = await ensureClass('Grade 11 - A', 'GRADE_11', 'A', 2025, Term.TERM_1);
  console.log(`   Classes: ${class10A.name}, ${class10B.name}, ${class11A.name}`);

  const mathLA = await ensureLearningArea('Mathematics', 'GRADE_10', InstitutionType.SECONDARY);
  const engLA = await ensureLearningArea('English', 'GRADE_10', InstitutionType.SECONDARY);
  const bioLA = await ensureLearningArea('Biology', 'GRADE_11', InstitutionType.SECONDARY);
  const csLA = await ensureLearningArea('Computer Science', 'GRADE_10', InstitutionType.SECONDARY);
  console.log(`   Learning areas seeded`);

  const term1 = await ensureTermConfig(2025, Term.TERM_1, new Date('2025-01-06'), new Date('2025-04-04'), teacher.id);
  const term2 = await ensureTermConfig(2025, Term.TERM_2, new Date('2025-05-05'), new Date('2025-07-04'), teacher.id);
  console.log(`   Terms seeded`);

  // Legacy courses
  const courses = [];
  const courseDefs = [
    { title: 'Mathematics Basics', subject: 'Mathematics', grade: 'GRADE_10', category: 'Core Subject', status: CourseStatus.PUBLISHED, la: mathLA },
    { title: 'English Language Skills', subject: 'English', grade: 'GRADE_10', category: 'Core Subject', status: CourseStatus.PUBLISHED, la: engLA },
    { title: 'Biology Explorations', subject: 'Biology', grade: 'GRADE_11', category: 'Science', status: CourseStatus.PUBLISHED, la: bioLA },
    { title: 'Computer Studies Foundations', subject: 'Computer Studies', grade: 'GRADE_10', category: 'Elective', status: CourseStatus.PUBLISHED, la: csLA },
  ];
  for (const def of courseDefs) {
    const course = await seedLMSCourse(school.id, teacher.id, def.title, def.subject, def.grade, def.category, def.status);
    courses.push(course);
    console.log(`   Course: ${course.title}`);

    const contentItems = [
      { title: 'Introduction Video', type: ContentType.VIDEO, url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', description: 'Overview of the course.' },
      { title: 'Course Notes', type: ContentType.PDF, url: 'https://example.com/notes.pdf', description: 'Downloadable notes.' },
      { title: 'Additional Reading', type: ContentType.LINK, url: 'https://example.com/reading', description: 'External resource.' },
      { title: 'Audio Summary', type: ContentType.AUDIO, url: 'https://example.com/summary.mp3', description: 'Listen to the summary.' },
    ];
    const contents = await seedLMSContent(course.id, teacher.id, contentItems);
    console.log(`     ${contents.length} content items`);

    for (const learner of learners) {
      const enrollment = await seedEnrollment(course.id, learner.id, teacher.id, EnrollmentStatus.ACTIVE);
      for (const content of contents) {
        const isComplete = Math.random() > 0.5;
        await seedLMSProgress(enrollment.id, content.id, isComplete, isComplete ? 100 : Math.floor(Math.random() * 80));
      }
    }
  }

  // New Learning Lessons
  const lessons = [];
  const lessonDefs = [
    { title: 'Introduction to Algebra', la: mathLA, cls: class10A, blocks: [
      { type: LessonBlockType.HEADING, order: 1, content: { text: 'Introduction to Algebra', level: 2 } },
      { type: LessonBlockType.PARAGRAPH, order: 2, content: { text: 'Algebra is a branch of mathematics dealing with symbols and the rules for manipulating those symbols.' } },
      { type: LessonBlockType.VIDEO, order: 3, content: { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', caption: 'Algebra Basics' } },
      { type: LessonBlockType.QUIZ, order: 4, content: { questions: [{ id: 'q1', question: 'What is 2x + 3 when x=2?', choices: ['5', '7', '9', '11'], correctIndex: 1 }] } },
      { type: LessonBlockType.PRACTICE_QUESTIONS, order: 5, content: { questions: [{ id: 'pq1', question: 'Solve for x: x + 5 = 10', answer: 'x = 5' }] } },
    ]},
    { title: 'Grammar Fundamentals', la: engLA, cls: class10A, blocks: [
      { type: LessonBlockType.HEADING, order: 1, content: { text: 'Grammar Fundamentals', level: 2 } },
      { type: LessonBlockType.PARAGRAPH, order: 2, content: { text: 'Understanding parts of speech is essential for mastering English grammar.' } },
      { type: LessonBlockType.ACCORDION, order: 3, content: { items: [{ title: 'Nouns', content: 'A noun is a person, place, or thing.' }, { title: 'Verbs', content: 'A verb expresses action or state of being.' }] } },
      { type: LessonBlockType.FLASHCARDS, order: 4, content: { cards: [{ front: 'What is a noun?', back: 'A person, place, or thing.' }, { front: 'What is a verb?', back: 'An action or state of being.' }] } },
    ]},
    { title: 'Cell Biology', la: bioLA, cls: class11A, blocks: [
      { type: LessonBlockType.HEADING, order: 1, content: { text: 'Cell Biology', level: 2 } },
      { type: LessonBlockType.IMAGE, order: 2, content: { url: 'https://example.com/cell-diagram.png', caption: 'Animal Cell Diagram' } },
      { type: LessonBlockType.TIMELINE, order: 3, content: { events: [{ date: '1665', title: 'Cell Discovery', description: 'Robert Hooke discovered cells.' }, { date: '1839', title: 'Cell Theory', description: 'Schleiden and Schwann proposed cell theory.' }] } },
    ]},
    { title: 'Programming Basics', la: csLA, cls: class10A, blocks: [
      { type: LessonBlockType.HEADING, order: 1, content: { text: 'Programming Basics', level: 2 } },
      { type: LessonBlockType.CODE, order: 2, content: { code: 'console.log("Hello, World!");', language: 'javascript' } },
      { type: LessonBlockType.PARAGRAPH, order: 3, content: { text: 'Programming is the process of creating a set of instructions that tell a computer how to perform a task.' } },
    ]},
  ];
  for (const def of lessonDefs) {
    const { lesson, blocks } = await seedLearningLesson(school.id, def.cls.id, def.la.id, term1.id, teacher.id, def.title, LessonStatus.PUBLISHED, def.blocks);
    lessons.push({ lesson, blocks });
    console.log(`   Lesson: ${lesson.title} (${blocks.length} blocks)`);

    for (const learner of learners) {
      const progress = await seedLearningProgress(learner.id, lesson.id, school.id, Math.floor(Math.random() * blocks.length), blocks.length, Math.floor(Math.random() * 100));
      if (progress.percentComplete > 0) {
        await seedLearningSession(learner.id, lesson.id, school.id, Math.floor(Math.random() * 1800) + 300, 'DESKTOP');
      }
    }
  }

  // Assignments
  const assignments = [];
  const assignmentDefs = [
    { title: 'Algebra Worksheet', la: mathLA, cls: class10A, category: AssignmentCategory.HOMEWORK, questions: [{ id: 'a1', question: 'Simplify 3x + 2x', choices: ['5x', '6x', 'x', '3x'], correctIndex: 0, explanation: 'Combine like terms.' }] },
    { title: 'Grammar Quiz', la: engLA, cls: class10A, category: AssignmentCategory.READING, questions: [{ id: 'a2', question: 'Select the correct sentence.', choices: ['He go to school.', 'He goes to school.', 'He going to school.'], correctIndex: 1, explanation: 'Subject-verb agreement.' }] },
    { title: 'Cell Diagram Labeling', la: bioLA, cls: class11A, category: AssignmentCategory.PRACTICAL, questions: [{ id: 'a3', question: 'Label the nucleus.', choices: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'The nucleus is the control center.' }] },
  ];
  for (const def of assignmentDefs) {
    const assignment = await seedLearningAssignment(school.id, def.cls.id, def.la.id, term1.id, teacher.id, def.title, def.category, AssignmentStatus.PUBLISHED, def.questions);
    assignments.push(assignment);
    console.log(`   Assignment: ${assignment.title}`);

    for (const learner of learners) {
      const existing = await prisma.learningSubmission.findFirst({ where: { assignmentId: assignment.id, learnerId: learner.id } });
      if (existing) continue;
      await prisma.learningSubmission.create({ data: { assignmentId: assignment.id, learnerId: learner.id, status: Math.random() > 0.3 ? SubmissionStatus.SUBMITTED : SubmissionStatus.DRAFT, submittedAt: new Date(), attemptNumber: 1 } });
    }
  }

  // Resources
  const resourceDefs = [
    { title: 'Math Revision Notes', la: mathLA, type: ResourceType.NOTES, difficulty: DifficultyLevel.MEDIUM, topic: 'Algebra', term: 1 },
    { title: 'English Past Paper 2024', la: engLA, type: ResourceType.PAST_PAPER, difficulty: DifficultyLevel.HARD, topic: 'Grammar', term: 1 },
    { title: 'Biology Worksheet', la: bioLA, type: ResourceType.WORKSHEET, difficulty: DifficultyLevel.EASY, topic: 'Cells', term: 1 },
    { title: 'CS Scheme of Work', la: csLA, type: ResourceType.SCHEME, difficulty: DifficultyLevel.MEDIUM, topic: 'Programming', term: 1 },
  ];
  for (const def of resourceDefs) {
    const resource = await seedLearningResource(school.id, def.la.id, def.title, def.type, def.difficulty, def.topic, def.term, teacher.id);
    console.log(`   Resource: ${resource.title}`);
    await seedLearningBookmark(learners[0].id, resource.id, school.id);
  }

  // Achievements
  for (const learner of learners) {
    await seedAchievement(learner.id, school.id, AchievementType.FIRST_LESSON, 'First Lesson Completed', 'You completed your first lesson.', 25);
    await seedAchievement(learner.id, school.id, AchievementType.ASSIGNMENT_ACE, 'Assignment Starter', 'You submitted your first assignment.', 20);
    await seedAchievement(learner.id, school.id, AchievementType.STREAK_7, '7-Day Streak', 'You learned for 7 days in a row.', 40);
    console.log(`   Achievements for ${learner.firstName} ${learner.lastName}`);
  }

  console.log('✅ LMS full dummy content seeding complete!');
}

(async () => {
  await main()
    .catch((error) => {
      console.error('❌ LMS full seeder error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
})();
