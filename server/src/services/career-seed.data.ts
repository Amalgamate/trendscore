/**
 * career-seed.data.ts
 * Seed data for Career Explorer (SPEC-005).
 * 30 representative Kenyan CBC-aligned careers across 3 pathways.
 * Idempotent — safe to run multiple times (upsert by code).
 */

export const CAREER_FAMILIES = [
  { code: 'STEM_SCIENCES',    name: 'Sciences & Research' },
  { code: 'STEM_TECH',        name: 'Technology & Engineering' },
  { code: 'STEM_HEALTH',      name: 'Health & Medicine' },
  { code: 'SOCIAL_BUSINESS',  name: 'Business & Finance' },
  { code: 'SOCIAL_LAW',       name: 'Law & Governance' },
  { code: 'SOCIAL_EDUCATION', name: 'Education & Social Work' },
  { code: 'SOCIAL_MEDIA',     name: 'Media & Communication' },
  { code: 'ARTS_CREATIVE',    name: 'Creative Arts & Design' },
  { code: 'ARTS_SPORTS',      name: 'Sports & Physical Education' },
  { code: 'ARTS_PERFORMING',  name: 'Performing Arts' },
];

export interface CareerSeedRecord {
  code: string;
  title: string;
  familyCode: string;
  shortSummary: string;
  recommendedPathway: string;
  recommendedTrackCode?: string;
  typicalActivities: string[];
  keySkills: string[];
  workEnvironments: string[];
  routes: Array<{ routeType: string; qualificationTitle: string; exampleInstitutions: string[]; durationYears: number }>;
}

export const CAREERS: CareerSeedRecord[] = [
  // ── STEM — Sciences & Research ─────────────────────────────────────────────
  {
    code: 'MEDICAL_DOCTOR', title: 'Medical Doctor', familyCode: 'STEM_HEALTH',
    shortSummary: 'Diagnose and treat illnesses, perform surgeries, and promote community health.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Examining patients', 'Diagnosing conditions', 'Prescribing treatment', 'Performing procedures'],
    keySkills: ['Critical thinking', 'Communication', 'Attention to detail', 'Empathy', 'Decision making'],
    workEnvironments: ['Hospitals', 'Clinics', 'Community health centres'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'MBChB', exampleInstitutions: ['University of Nairobi', 'Moi University', 'Mount Kenya University'], durationYears: 6 },
    ],
  },
  {
    code: 'NURSE', title: 'Registered Nurse', familyCode: 'STEM_HEALTH',
    shortSummary: 'Provide direct patient care, administer medication and support recovery.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Patient assessment', 'Medication administration', 'Wound care', 'Patient education'],
    keySkills: ['Compassion', 'Clinical skills', 'Record keeping', 'Teamwork'],
    workEnvironments: ['Hospitals', 'Maternity units', 'Community clinics'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Nursing', exampleInstitutions: ['KU', 'UoN'], durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Nursing', exampleInstitutions: ['Kenya Medical Training College'], durationYears: 3 },
    ],
  },
  {
    code: 'PHARMACIST', title: 'Pharmacist', familyCode: 'STEM_HEALTH',
    shortSummary: 'Dispense medications, advise on drug interactions and promote safe medicine use.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Dispensing prescriptions', 'Counselling patients', 'Checking drug interactions', 'Stock management'],
    keySkills: ['Chemistry knowledge', 'Accuracy', 'Communication', 'Ethics'],
    workEnvironments: ['Hospitals', 'Retail pharmacies', 'Research labs'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BPharm', exampleInstitutions: ['UoN', 'Kenyatta University'], durationYears: 5 },
    ],
  },
  {
    code: 'SOFTWARE_ENGINEER', title: 'Software Engineer', familyCode: 'STEM_TECH',
    shortSummary: 'Design, build and maintain software systems that power apps, websites and services.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Writing code', 'Debugging', 'System design', 'Code reviews', 'Deployment'],
    keySkills: ['Programming', 'Problem solving', 'Logical thinking', 'Collaboration'],
    workEnvironments: ['Tech companies', 'Banks', 'Startups', 'Remote work'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Computer Science', exampleInstitutions: ['Strathmore University', 'JKUAT', 'UoN'], durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Software Development Bootcamp', exampleInstitutions: ['Moringa School', 'ALX Africa'], durationYears: 0.5 },
    ],
  },
  {
    code: 'DATA_SCIENTIST', title: 'Data Scientist', familyCode: 'STEM_TECH',
    shortSummary: 'Analyse large datasets to uncover insights that guide business and research decisions.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Data collection', 'Statistical modelling', 'Machine learning', 'Data visualisation'],
    keySkills: ['Statistics', 'Python/R', 'Critical thinking', 'Business acumen'],
    workEnvironments: ['Tech firms', 'Banks', 'Research institutions', 'NGOs'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Data Science', exampleInstitutions: ['Strathmore', 'USIU'], durationYears: 4 },
      { routeType: 'DEGREE', qualificationTitle: 'BSc Statistics', exampleInstitutions: ['UoN', 'KU'], durationYears: 4 },
    ],
  },
  {
    code: 'CIVIL_ENGINEER', title: 'Civil Engineer', familyCode: 'STEM_TECH',
    shortSummary: 'Design and oversee construction of infrastructure like roads, bridges and buildings.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Site surveys', 'Structural design', 'Project management', 'Safety inspections'],
    keySkills: ['Mathematics', 'Physics', 'AutoCAD', 'Project management'],
    workEnvironments: ['Construction sites', 'Government agencies', 'Consulting firms'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Civil Engineering', exampleInstitutions: ['UoN', 'JKUAT', 'Dedan Kimathi University'], durationYears: 5 },
    ],
  },
  {
    code: 'AGRONOMIST', title: 'Agronomist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Improve crop production and soil management to increase food security.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Soil testing', 'Crop monitoring', 'Advising farmers', 'Research trials'],
    keySkills: ['Biology', 'Chemistry', 'Field work', 'Research skills'],
    workEnvironments: ['Farms', 'Research stations', 'Government ministries', 'NGOs'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Agriculture', exampleInstitutions: ['Egerton University', 'UoN', 'Maseno University'], durationYears: 4 },
    ],
  },
  {
    code: 'ENVIRONMENTAL_SCIENTIST', title: 'Environmental Scientist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Study and protect natural environments from pollution and climate change.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Environmental impact assessments', 'Field sampling', 'Policy advising', 'Data analysis'],
    keySkills: ['Biology', 'Chemistry', 'GIS', 'Report writing'],
    workEnvironments: ['NEMA', 'NGOs', 'Mining firms', 'Research institutions'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Environmental Science', exampleInstitutions: ['UoN', 'Kenyatta University', 'Maseno'], durationYears: 4 },
    ],
  },
  // ── Social Sciences ────────────────────────────────────────────────────────
  {
    code: 'LAWYER', title: 'Advocate / Lawyer', familyCode: 'SOCIAL_LAW',
    shortSummary: 'Represent clients in legal matters, draft contracts and uphold justice.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Legal research', 'Court representation', 'Contract drafting', 'Client advisory'],
    keySkills: ['Critical thinking', 'Communication', 'Research', 'Negotiation'],
    workEnvironments: ['Law firms', 'Courts', 'Government', 'NGOs', 'Corporations'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'LLB Law', exampleInstitutions: ['UoN', 'Strathmore', 'KCA University'], durationYears: 4 },
    ],
  },
  {
    code: 'ACCOUNTANT', title: 'Accountant / CPA', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Manage financial records, prepare accounts and ensure tax compliance.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Bookkeeping', 'Financial statements', 'Tax filing', 'Auditing'],
    keySkills: ['Mathematics', 'Accuracy', 'Excel/Accounting software', 'Ethics'],
    workEnvironments: ['Audit firms', 'Banks', 'NGOs', 'Government', 'All industries'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BCom Accounting', exampleInstitutions: ['UoN', 'KU', 'Daystar'], durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'CPA Kenya', exampleInstitutions: ['KASNEB'], durationYears: 2 },
    ],
  },
  {
    code: 'ECONOMIST', title: 'Economist', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Analyse economic trends and advise on policy, trade and resource allocation.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Economic modelling', 'Policy research', 'Data analysis', 'Report writing'],
    keySkills: ['Mathematics', 'Statistics', 'Research', 'Communication'],
    workEnvironments: ['Central Bank', 'Treasury', 'World Bank', 'Universities'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Economics', exampleInstitutions: ['UoN', 'Strathmore', 'USIU'], durationYears: 4 },
    ],
  },
  {
    code: 'JOURNALIST', title: 'Journalist / Media Presenter', familyCode: 'SOCIAL_MEDIA',
    shortSummary: 'Report news, investigate stories and communicate information to the public.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['News writing', 'Interviewing', 'Broadcasting', 'Social media management'],
    keySkills: ['Writing', 'Communication', 'Research', 'Public speaking'],
    workEnvironments: ['TV stations', 'Radio', 'Print media', 'Online platforms'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Journalism & Mass Communication', exampleInstitutions: ['UoN', 'USIU', 'Daystar'], durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Journalism', exampleInstitutions: ['Kenya Institute of Mass Communication'], durationYears: 2 },
    ],
  },
  {
    code: 'TEACHER', title: 'Teacher / Educator', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Educate and inspire learners at primary, secondary or tertiary level.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Lesson planning', 'Teaching', 'Assessment', 'Mentoring students'],
    keySkills: ['Communication', 'Patience', 'Subject mastery', 'Classroom management'],
    workEnvironments: ['Schools', 'Colleges', 'Universities', 'Online platforms'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BEd', exampleInstitutions: ['KU', 'Egerton', 'UoN'], durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'DPTE', exampleInstitutions: ['Kenya Education Management Institute'], durationYears: 2 },
    ],
  },
  {
    code: 'SOCIAL_WORKER', title: 'Social Worker', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Support vulnerable individuals and communities to improve wellbeing.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Case assessment', 'Counselling', 'Community outreach', 'Report writing'],
    keySkills: ['Empathy', 'Communication', 'Problem solving', 'Resilience'],
    workEnvironments: ['NGOs', 'Government', 'Hospitals', 'Schools'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSW Social Work', exampleInstitutions: ['UoN', 'KU'], durationYears: 4 },
    ],
  },
  // ── Arts & Sports Science ──────────────────────────────────────────────────
  {
    code: 'GRAPHIC_DESIGNER', title: 'Graphic Designer', familyCode: 'ARTS_CREATIVE',
    shortSummary: 'Create visual content for brands, media and digital platforms.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'CREATIVE_ARTS',
    typicalActivities: ['Logo design', 'Brand identity', 'Print layout', 'Digital illustration'],
    keySkills: ['Adobe Creative Suite', 'Creativity', 'Visual communication', 'Typography'],
    workEnvironments: ['Design agencies', 'NGOs', 'Media companies', 'Freelance'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Graphic Design', exampleInstitutions: ['Kenyatta University', 'KCCA'], durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Graphic Design', exampleInstitutions: ['Nairobi Institute of Technology'], durationYears: 2 },
    ],
  },
  {
    code: 'PROFESSIONAL_ATHLETE', title: 'Professional Athlete / Coach', familyCode: 'ARTS_SPORTS',
    shortSummary: 'Compete at elite level or coach others in sports like athletics, football or rugby.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'SPORTS_SCIENCE',
    typicalActivities: ['Training', 'Competing', 'Coaching', 'Performance analysis'],
    keySkills: ['Physical fitness', 'Discipline', 'Tactical thinking', 'Leadership'],
    workEnvironments: ['Sports academies', 'National teams', 'Schools', 'Sports clubs'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Sports Science', exampleInstitutions: ['KU', 'Moi University'], durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Sports Coaching Certificate', exampleInstitutions: ['Athletics Kenya', 'FIFA Academy'], durationYears: 0.5 },
    ],
  },
  {
    code: 'MUSICIAN', title: 'Musician / Music Producer', familyCode: 'ARTS_PERFORMING',
    shortSummary: 'Compose, perform and produce music across genres for live and studio audiences.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'PERFORMING_ARTS',
    typicalActivities: ['Composing', 'Recording', 'Live performance', 'Music production'],
    keySkills: ['Musical talent', 'Creativity', 'Audio software', 'Business skills'],
    workEnvironments: ['Recording studios', 'Events', 'Schools', 'Online platforms'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BA Music', exampleInstitutions: ['KU', 'Daystar University'], durationYears: 4 },
      { routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Music Production', exampleInstitutions: ['Audio Visual Institute Nairobi'], durationYears: 2 },
    ],
  },
  {
    code: 'ARCHITECT', title: 'Architect', familyCode: 'ARTS_CREATIVE',
    shortSummary: 'Design functional and aesthetic buildings, managing projects from concept to completion.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'CREATIVE_ARTS',
    typicalActivities: ['Concept design', 'Technical drawings', 'Client consultation', 'Site supervision'],
    keySkills: ['Creativity', 'Technical drawing', 'AutoCAD', 'Spatial thinking'],
    workEnvironments: ['Architecture firms', 'Government', 'Real estate', 'Freelance'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BArch', exampleInstitutions: ['UoN', 'Jomo Kenyatta University'], durationYears: 5 },
    ],
  },
  {
    code: 'PHYSIOTHERAPIST', title: 'Physiotherapist', familyCode: 'ARTS_SPORTS',
    shortSummary: 'Help patients recover movement and manage pain through physical therapy.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'SPORTS_SCIENCE',
    typicalActivities: ['Patient assessment', 'Exercise therapy', 'Sports injury rehab', 'Patient education'],
    keySkills: ['Anatomy knowledge', 'Manual therapy', 'Empathy', 'Physical stamina'],
    workEnvironments: ['Hospitals', 'Sports teams', 'Rehabilitation centres', 'Private practice'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Physiotherapy', exampleInstitutions: ['UoN', 'KU', 'Moi University'], durationYears: 4 },
    ],
  },
];
