import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Starter career catalogue seed — a modest, idempotent set of careers spanning
 * STEM, Social Sciences, and Arts & Sports Science pathways, each with a
 * plausible education route. Intended as a foundation to expand from, not an
 * exhaustive catalogue (see PATHWAYS_IMPLEMENTATION_PLAN.md Stage 3).
 *
 * Uses `code` as the idempotency key throughout — safe to re-run.
 */

interface RouteSeed {
  routeType: string;
  qualificationTitle: string;
  minSubjectNotes?: string;
  durationYears?: number;
}

interface CareerSeed {
  code: string;
  title: string;
  familyCode: string;
  shortSummary: string;
  keySkills: string[];
  recommendedPathway: 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';
  routes: RouteSeed[];
}

const FAMILIES = [
  { code: 'ENGINEERING_TECH', name: 'Engineering & Technology' },
  { code: 'HEALTH_SCIENCES', name: 'Health Sciences' },
  { code: 'BUSINESS_FINANCE', name: 'Business & Finance' },
  { code: 'LAW_PUBLIC_SERVICE', name: 'Law & Public Service' },
  { code: 'EDUCATION_SOCIAL', name: 'Education & Social Sciences' },
  { code: 'CREATIVE_ARTS', name: 'Creative Arts & Media' },
  { code: 'SPORTS_SCIENCE', name: 'Sports Science & Recreation' },
];

const CAREERS: CareerSeed[] = [
  // STEM
  {
    code: 'SOFTWARE_ENGINEER',
    title: 'Software Engineer',
    familyCode: 'ENGINEERING_TECH',
    shortSummary: 'Designs, builds, and maintains software systems and applications.',
    keySkills: ['Problem solving', 'Mathematics', 'Programming logic', 'Collaboration'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Computer Science / Software Engineering', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Information Technology', durationYears: 2 },
    ],
  },
  {
    code: 'CIVIL_ENGINEER',
    title: 'Civil Engineer',
    familyCode: 'ENGINEERING_TECH',
    shortSummary: 'Plans and oversees construction of infrastructure like roads, bridges, and buildings.',
    keySkills: ['Mathematics', 'Physics', 'Technical drawing', 'Project management'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Civil Engineering', durationYears: 5 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Civil Engineering', durationYears: 3 },
    ],
  },
  {
    code: 'MEDICAL_DOCTOR',
    title: 'Medical Doctor',
    familyCode: 'HEALTH_SCIENCES',
    shortSummary: 'Diagnoses and treats illness and injury in patients.',
    keySkills: ['Biology', 'Chemistry', 'Empathy', 'Decision making under pressure'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'Bachelor of Medicine, Bachelor of Surgery (MBChB)', durationYears: 6 },
    ],
  },
  {
    code: 'NURSE',
    title: 'Registered Nurse',
    familyCode: 'HEALTH_SCIENCES',
    shortSummary: 'Provides direct patient care and supports treatment plans in clinical settings.',
    keySkills: ['Biology', 'Patient care', 'Attention to detail', 'Communication'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Nursing', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Kenya Registered Community Health Nursing', durationYears: 3 },
    ],
  },
  {
    code: 'DATA_ANALYST',
    title: 'Data Analyst',
    familyCode: 'ENGINEERING_TECH',
    shortSummary: 'Collects and interprets data to inform business or policy decisions.',
    keySkills: ['Mathematics', 'Statistics', 'Spreadsheets', 'Critical thinking'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Statistics / Data Science', durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Data Analytics Certificate', durationYears: 0.5 },
    ],
  },
  {
    code: 'AGRICULTURAL_ENGINEER',
    title: 'Agricultural Engineer',
    familyCode: 'ENGINEERING_TECH',
    shortSummary: 'Applies engineering principles to farming, irrigation, and agricultural machinery.',
    keySkills: ['Mathematics', 'Biology', 'Mechanical aptitude'],
    recommendedPathway: 'STEM',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Agricultural Engineering', durationYears: 4 },
    ],
  },

  // Social Sciences
  {
    code: 'LAWYER',
    title: 'Lawyer / Advocate',
    familyCode: 'LAW_PUBLIC_SERVICE',
    shortSummary: 'Advises clients and represents them in legal matters and court proceedings.',
    keySkills: ['Argumentation', 'Research', 'Written communication', 'Ethics'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'Bachelor of Laws (LLB)', durationYears: 4, minSubjectNotes: 'Followed by Advocates Training Programme' },
    ],
  },
  {
    code: 'ACCOUNTANT',
    title: 'Accountant',
    familyCode: 'BUSINESS_FINANCE',
    shortSummary: 'Manages financial records, budgets, and compliance for organizations.',
    keySkills: ['Mathematics', 'Attention to detail', 'Integrity'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BCom Accounting / Finance', durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'CPA (Certified Public Accountant)', durationYears: 2 },
    ],
  },
  {
    code: 'TEACHER',
    title: 'Teacher',
    familyCode: 'EDUCATION_SOCIAL',
    shortSummary: 'Educates learners in a specific subject area at primary, secondary, or tertiary level.',
    keySkills: ['Communication', 'Patience', 'Subject mastery', 'Classroom management'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'Bachelor of Education', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Teacher Education', durationYears: 2 },
    ],
  },
  {
    code: 'DIPLOMAT_FOREIGN_SERVICE',
    title: 'Diplomat / Foreign Service Officer',
    familyCode: 'LAW_PUBLIC_SERVICE',
    shortSummary: 'Represents national interests abroad and manages international relations.',
    keySkills: ['Languages', 'Negotiation', 'Political awareness'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA International Relations / Political Science', durationYears: 4 },
    ],
  },
  {
    code: 'SOCIAL_WORKER',
    title: 'Social Worker',
    familyCode: 'EDUCATION_SOCIAL',
    shortSummary: 'Supports individuals and families facing social, economic, or personal challenges.',
    keySkills: ['Empathy', 'Communication', 'Case management'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Social Work', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Social Work and Community Development', durationYears: 3 },
    ],
  },
  {
    code: 'JOURNALIST',
    title: 'Journalist',
    familyCode: 'CREATIVE_ARTS',
    shortSummary: 'Researches, writes, and reports news and current affairs across media platforms.',
    keySkills: ['Writing', 'Curiosity', 'Interviewing', 'Ethics'],
    recommendedPathway: 'SOCIAL_SCIENCES',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Journalism and Mass Communication', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Mass Communication', durationYears: 2 },
    ],
  },

  // Arts & Sports Science
  {
    code: 'GRAPHIC_DESIGNER',
    title: 'Graphic Designer',
    familyCode: 'CREATIVE_ARTS',
    shortSummary: 'Creates visual content for branding, marketing, and digital media.',
    keySkills: ['Creativity', 'Visual composition', 'Design software'],
    recommendedPathway: 'ARTS_SPORTS',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Fine Art / Design', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Graphic Design', durationYears: 2 },
    ],
  },
  {
    code: 'MUSICIAN_PERFORMER',
    title: 'Musician / Performing Artist',
    familyCode: 'CREATIVE_ARTS',
    shortSummary: 'Composes, performs, or produces music and live performances professionally.',
    keySkills: ['Musicality', 'Discipline', 'Performance confidence'],
    recommendedPathway: 'ARTS_SPORTS',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Music', durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Music Performance Certificate', durationYears: 1 },
    ],
  },
  {
    code: 'PROFESSIONAL_ATHLETE_COACH',
    title: 'Professional Athlete / Sports Coach',
    familyCode: 'SPORTS_SCIENCE',
    shortSummary: 'Competes professionally in sport or trains and develops athletes.',
    keySkills: ['Physical fitness', 'Discipline', 'Strategic thinking', 'Leadership'],
    recommendedPathway: 'ARTS_SPORTS',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Sports Science / Physical Education', durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Coaching Certification (sport-specific)', durationYears: 0.5 },
    ],
  },
  {
    code: 'FILM_TV_PRODUCER',
    title: 'Film / TV Producer',
    familyCode: 'CREATIVE_ARTS',
    shortSummary: 'Oversees the creative and logistical production of film, TV, or digital video content.',
    keySkills: ['Creativity', 'Project management', 'Storytelling'],
    recommendedPathway: 'ARTS_SPORTS',
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Film Production / Media Studies', durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Film and TV Production', durationYears: 2 },
    ],
  },
  {
    code: 'FASHION_DESIGNER',
    title: 'Fashion Designer',
    familyCode: 'CREATIVE_ARTS',
    shortSummary: 'Designs clothing and accessories, from concept sketches to finished garments.',
    keySkills: ['Creativity', 'Sewing/construction', 'Trend awareness'],
    recommendedPathway: 'ARTS_SPORTS',
    routes: [
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Fashion Design and Technology', durationYears: 2 },
      { routeType: 'TVET', qualificationTitle: 'TVET Certificate in Fashion Design', durationYears: 1 },
    ],
  },
];

export async function seedCareers(): Promise<void> {
  console.log('\n🎯 Seeding starter career catalogue...');

  const familyIdByCode: Record<string, string> = {};
  for (const f of FAMILIES) {
    const row = await prisma.careerFamily.upsert({
      where: { code: f.code },
      create: { code: f.code, name: f.name },
      update: { name: f.name },
    });
    familyIdByCode[f.code] = row.id;
  }
  console.log(`   ✅ Upserted ${FAMILIES.length} career families`);

  let count = 0;
  for (const c of CAREERS) {
    const career = await prisma.career.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        title: c.title,
        familyId: familyIdByCode[c.familyCode],
        shortSummary: c.shortSummary,
        keySkills: c.keySkills,
        recommendedPathway: c.recommendedPathway,
        verificationStatus: 'UNVERIFIED',
        publishedAt: new Date(),
      },
      update: {
        title: c.title,
        familyId: familyIdByCode[c.familyCode],
        shortSummary: c.shortSummary,
        keySkills: c.keySkills,
        recommendedPathway: c.recommendedPathway,
      },
    });

    for (const r of c.routes) {
      const existing = await prisma.careerEducationRoute.findFirst({
        where: { careerId: career.id, routeType: r.routeType, qualificationTitle: r.qualificationTitle },
      });
      if (!existing) {
        await prisma.careerEducationRoute.create({
          data: {
            careerId: career.id,
            routeType: r.routeType,
            qualificationTitle: r.qualificationTitle,
            minSubjectNotes: r.minSubjectNotes,
            durationYears: r.durationYears,
            verificationStatus: 'UNVERIFIED',
          },
        });
      }
    }
    count += 1;
  }
  console.log(`   ✅ Upserted ${count} careers with education routes`);
  console.log('✨ Career catalogue seeded (starter set — expand via admin console when built)!');
}

if (require.main === module) {
  seedCareers()
    .catch((error) => {
      console.error('❌ Career seed error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
