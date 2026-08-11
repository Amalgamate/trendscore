/**
 * career-seed.data.ts
 * Seed data for Career Explorer (SPEC-005).
 * Kenyan CBC-aligned careers across the three senior-school pathways.
 * Idempotent — safe to run multiple times (upsert by code).
 */

export const CAREER_FAMILIES = [
  { code: 'STEM_SCIENCES',    name: 'Sciences & Research', description: 'Investigate the natural world, climate, food systems and the evidence used to solve local problems.' },
  { code: 'STEM_TECH',        name: 'Technology & Engineering', description: 'Build digital products, machines and infrastructure using mathematics, design and practical problem solving.' },
  { code: 'STEM_HEALTH',      name: 'Health & Medicine', description: 'Protect health, diagnose illness and help people live longer, safer and more active lives.' },
  { code: 'SOCIAL_BUSINESS',  name: 'Business & Finance', description: 'Create value, manage money and help organisations make responsible decisions.' },
  { code: 'SOCIAL_LAW',       name: 'Law & Governance', description: 'Support justice, public service, rights and accountable leadership.' },
  { code: 'SOCIAL_EDUCATION', name: 'Education & Social Work', description: 'Teach, mentor and strengthen the wellbeing of learners, families and communities.' },
  { code: 'SOCIAL_MEDIA',     name: 'Media & Communication', description: 'Research, create and share trustworthy stories and messages across platforms.' },
  { code: 'ARTS_CREATIVE',    name: 'Creative Arts & Design', description: 'Use imagination, craft and technology to shape products, spaces, images and experiences.' },
  { code: 'ARTS_SPORTS',      name: 'Sports & Physical Education', description: 'Develop human performance, movement, health and sporting opportunities.' },
  { code: 'ARTS_PERFORMING',  name: 'Performing Arts', description: 'Tell stories and move audiences through music, theatre, dance, film and live production.' },
];

const OFFICIAL_SOURCES = [
  'TVET Authority course catalogue: https://www.tveta.go.ke/tvet-courses/',
  'Commission for University Education programme listings: https://www.cue.or.ke/index.php?id=22&layout=edit&option=com_content&view=article',
].join(' | ');

const DEFAULT_FUTURE_SKILLS = ['Digital fluency', 'Communication', 'Adaptability', 'Ethical practice'];

const FAMILY_OUTLOOK: Record<string, string> = {
  STEM_SCIENCES: 'Opportunities span research, agriculture, conservation, water, climate, laboratories and evidence-led public policy. Demand is strongest for people who can combine science with field, data and communication skills.',
  STEM_TECH: 'Kenya has opportunities in digital services, engineering, construction, manufacturing, energy and technology-enabled businesses. Portfolio evidence, safety practice and continuous upskilling matter alongside formal qualifications.',
  STEM_HEALTH: 'Health services need qualified practitioners in hospitals, community programmes, laboratories, rehabilitation, prevention and health technology. Practitioners must meet the relevant professional registration requirements.',
  SOCIAL_BUSINESS: 'Every school, enterprise, public agency and non-profit needs people who can manage resources, customers, operations and risk. Analytical ability, integrity and digital tools are increasingly important.',
  SOCIAL_LAW: 'Work is available in courts, public administration, compliance, diplomacy, security, human rights and policy. Professional licensing or public-service recruitment requirements vary by role.',
  SOCIAL_EDUCATION: 'Schools, communities, hospitals and development organisations need skilled educators and support professionals. Safeguarding, inclusion, counselling and evidence-based practice are valuable across settings.',
  SOCIAL_MEDIA: 'Digital publishing, broadcasting, public information and strategic communication continue to grow. Strong research, media ethics, storytelling and verification skills help learners adapt to new platforms.',
  ARTS_CREATIVE: 'Creative work is found in agencies, studios, cultural organisations, construction, manufacturing, fashion and freelance practice. A strong portfolio and client collaboration are as important as a qualification.',
  ARTS_SPORTS: 'Schools, clubs, wellness programmes, rehabilitation services and national sport create varied opportunities. Safe practice, coaching credentials and knowledge of human performance improve progression.',
  ARTS_PERFORMING: 'Live events, film, television, music, theatre, digital content and cultural organisations need performers and production specialists. Collaboration, a portfolio and reliable professional practice are essential.',
};

const FAMILY_EARNINGS: Record<string, string> = {
  STEM_SCIENCES: 'Earnings vary by qualification, registration, employer and research or field experience. Compare current public-service scales and employer offers rather than relying on a single advertised figure.',
  STEM_TECH: 'Earnings vary widely with practical competence, certification, project experience, sector and whether work is employed or freelance. Avoid treating bootcamp or online-course claims as guaranteed income.',
  STEM_HEALTH: 'Pay depends on professional registration, cadre, facility, county and experience. Private practice and specialist work have different costs and responsibilities from salaried roles.',
  SOCIAL_BUSINESS: 'Compensation depends on industry, professional exams, responsibility, results and experience. Entrepreneurship has variable income and should be planned with cash-flow and risk awareness.',
  SOCIAL_LAW: 'Income varies by public-service grade, firm, practice area and experience. Some roles require admission, licensing, security clearance or competitive recruitment.',
  SOCIAL_EDUCATION: 'Income depends on registration, employer, grade, subject area and experience. Self-employment and project work can be irregular, so budgeting and professional development are important.',
  SOCIAL_MEDIA: 'Pay varies by audience, employer, platform, portfolio and consistency of commissioned work. Sustainable careers combine creative ability with contracts, ethics and business skills.',
  ARTS_CREATIVE: 'Income is shaped by portfolio quality, clients, materials, contracts and the balance of employed, commissioned and independent work. Build pricing and financial-management skills early.',
  ARTS_SPORTS: 'Earnings depend on credentials, performance, employer, sport and the reliability of competitions or clients. Safety, insurance and progression planning matter alongside talent.',
  ARTS_PERFORMING: 'Income can be project-based and seasonal. A portfolio, dependable collaboration, rights awareness and more than one revenue stream support a sustainable practice.',
};

export interface CareerSeedRecord {
  code: string;
  title: string;
  familyCode: string;
  alternativeTitles?: string[];
  shortSummary: string;
  fullDescription?: string;
  recommendedPathway: string;
  recommendedTrackCode?: string;
  typicalActivities: string[];
  keySkills: string[];
  workEnvironments: string[];
  futureSkills?: string[];
  labourMarketNotes?: string;
  salaryRangeNotes?: string;
  successStory?: string;
  source?: string;
  routes: Array<{
    routeType: string;
    qualificationTitle: string;
    exampleInstitutions: string[];
    durationYears: number;
    minSubjectNotes?: string;
    progressionOptions?: string[];
    source?: string;
  }>;
}

const STARTER_CAREERS: CareerSeedRecord[] = [
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

// The original starter catalogue intentionally demonstrated the UI with only a
// handful of records. These additional records make Browse All useful for real
// learners while keeping the catalogue curated, pathway-aware and easy to
// review. Routes are illustrative signposts; institutions and entry rules must
// always be checked against the current regulator or institution requirements.
const ADDITIONAL_CAREERS: CareerSeedRecord[] = [
  // ── STEM — Sciences & Research ───────────────────────────────────────────
  {
    code: 'BIOLOGIST', title: 'Biologist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Study living organisms and ecosystems to improve health, food systems and conservation.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Collecting field samples', 'Running laboratory tests', 'Recording observations', 'Explaining findings'],
    keySkills: ['Biology', 'Laboratory safety', 'Observation', 'Data analysis'],
    workEnvironments: ['Laboratories', 'Universities', 'Conservation projects', 'Public agencies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Biology or Zoology', exampleInstitutions: ['UoN', 'Kenyatta University', 'Egerton University'], durationYears: 4 }],
  },
  {
    code: 'CHEMIST', title: 'Chemist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Use chemistry to test materials, develop products and protect people and the environment.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Preparing samples', 'Analysing substances', 'Calibrating equipment', 'Writing laboratory reports'],
    keySkills: ['Chemistry', 'Accuracy', 'Laboratory practice', 'Quality control'],
    workEnvironments: ['Research laboratories', 'Manufacturing plants', 'Hospitals', 'Water laboratories'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Chemistry', exampleInstitutions: ['UoN', 'JKUAT', 'Kenyatta University'], durationYears: 4 }],
  },
  {
    code: 'GEOLOGIST', title: 'Geologist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Read the rocks and land beneath us to guide water, minerals, construction and hazard planning.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Mapping rock formations', 'Testing soil and minerals', 'Interpreting geological data', 'Advising project teams'],
    keySkills: ['Earth science', 'Field mapping', 'GIS', 'Technical reporting'],
    workEnvironments: ['Field sites', 'Mines and quarries', 'Consultancies', 'Government agencies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Geology', exampleInstitutions: ['UoN', 'University of Eldoret', 'Taita Taveta University'], durationYears: 4 }],
  },
  {
    code: 'METEOROLOGIST', title: 'Meteorologist / Climate Scientist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Observe weather and climate patterns and turn forecasts into safer decisions for communities and businesses.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Reading weather instruments', 'Analysing satellite data', 'Preparing forecasts', 'Communicating weather risks'],
    keySkills: ['Physics', 'Mathematics', 'Data interpretation', 'Clear communication'],
    workEnvironments: ['Meteorological stations', 'Airports', 'Research centres', 'Media and emergency services'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Meteorology or Atmospheric Science', exampleInstitutions: ['UoN', 'University of Nairobi'], durationYears: 4 }],
  },
  {
    code: 'FOOD_SCIENTIST', title: 'Food Scientist / Technologist', familyCode: 'STEM_SCIENCES',
    shortSummary: 'Make food safer, healthier and more affordable through science, processing and quality assurance.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Testing food samples', 'Improving recipes and processes', 'Checking hygiene controls', 'Designing packaging and shelf-life tests'],
    keySkills: ['Chemistry', 'Microbiology', 'Quality assurance', 'Problem solving'],
    workEnvironments: ['Food factories', 'Farms and laboratories', 'Public health agencies', 'Research organisations'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Food Science and Technology', exampleInstitutions: ['Egerton University', 'JKUAT', 'UoN'], durationYears: 4 }],
  },

  // ── STEM — Technology & Engineering ─────────────────────────────────────
  {
    code: 'CYBERSECURITY_ANALYST', title: 'Cybersecurity Analyst', familyCode: 'STEM_TECH',
    shortSummary: 'Protect people, schools and organisations from digital threats, fraud and data loss.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Monitoring alerts', 'Testing systems', 'Investigating incidents', 'Teaching safe digital habits'],
    keySkills: ['Networking', 'Security thinking', 'Ethics', 'Incident response'],
    workEnvironments: ['Banks', 'Technology companies', 'Government', 'Security operations centres'],
    routes: [
      { routeType: 'DEGREE', qualificationTitle: 'BSc Cybersecurity or Information Technology', exampleInstitutions: ['Strathmore University', 'JKUAT', 'KCA University'], durationYears: 4 },
      { routeType: 'CERTIFICATE', qualificationTitle: 'Cybersecurity professional certification', exampleInstitutions: ['TVET institutions and recognised professional bodies'], durationYears: 1 },
    ],
  },
  {
    code: 'CLOUD_ENGINEER', title: 'Cloud / DevOps Engineer', familyCode: 'STEM_TECH',
    shortSummary: 'Keep online applications reliable by automating how software is built, deployed and monitored.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Automating deployments', 'Managing cloud resources', 'Monitoring uptime', 'Improving backups and recovery'],
    keySkills: ['Linux', 'Scripting', 'Networking', 'Systems thinking'],
    workEnvironments: ['Software teams', 'Fintechs', 'Telecoms', 'Remote-first companies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Computer Science or IT', exampleInstitutions: ['JKUAT', 'Strathmore University', 'UoN'], durationYears: 4 }],
  },
  {
    code: 'UX_DESIGNER', title: 'User Experience (UX) Designer', familyCode: 'STEM_TECH',
    shortSummary: 'Research what people need and design digital products that are clear, inclusive and easy to use.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Interviewing users', 'Sketching journeys', 'Prototyping screens', 'Testing designs'],
    keySkills: ['Empathy', 'Visual thinking', 'Research', 'Prototyping'],
    workEnvironments: ['Product teams', 'Design studios', 'Startups', 'Consultancies'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Interaction or Graphic Design', exampleInstitutions: ['Kenya Institute of Mass Communication', 'TVET institutions'], durationYears: 2 }],
  },
  {
    code: 'NETWORK_ADMINISTRATOR', title: 'Network Administrator', familyCode: 'STEM_TECH',
    shortSummary: 'Connect computers, users and services so that organisations can work securely and efficiently.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Configuring routers and switches', 'Managing user access', 'Troubleshooting outages', 'Documenting networks'],
    keySkills: ['Networking', 'Troubleshooting', 'Customer service', 'Cyber hygiene'],
    workEnvironments: ['Schools', 'Data centres', 'Banks', 'Telecoms and help desks'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in ICT or Network Administration', exampleInstitutions: ['TVET institutions', 'KCA University'], durationYears: 2 }],
  },
  {
    code: 'ELECTRICAL_ENGINEER', title: 'Electrical Engineer', familyCode: 'STEM_TECH',
    shortSummary: 'Design and maintain electrical systems that power homes, industry, communications and public services.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Designing circuits', 'Testing installations', 'Planning power systems', 'Supervising safety checks'],
    keySkills: ['Mathematics', 'Physics', 'Circuit design', 'Safety practice'],
    workEnvironments: ['Power utilities', 'Manufacturing', 'Construction sites', 'Engineering consultancies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Electrical and Electronic Engineering', exampleInstitutions: ['JKUAT', 'UoN', 'Dedan Kimathi University'], durationYears: 5 }],
  },
  {
    code: 'MECHANICAL_ENGINEER', title: 'Mechanical Engineer', familyCode: 'STEM_TECH',
    shortSummary: 'Design, improve and maintain machines used in transport, manufacturing, agriculture and energy.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Creating technical drawings', 'Testing prototypes', 'Planning maintenance', 'Improving production lines'],
    keySkills: ['Physics', 'CAD', 'Materials knowledge', 'Practical problem solving'],
    workEnvironments: ['Workshops', 'Factories', 'Construction', 'Energy and transport companies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Mechanical Engineering', exampleInstitutions: ['JKUAT', 'UoN', 'Moi University'], durationYears: 5 }],
  },
  {
    code: 'SOLAR_TECHNICIAN', title: 'Solar PV Technician', familyCode: 'STEM_TECH',
    shortSummary: 'Install, test and maintain solar power systems that bring reliable energy to homes and businesses.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'TECHNICAL',
    typicalActivities: ['Sizing solar systems', 'Installing panels and batteries', 'Testing wiring', 'Explaining maintenance to customers'],
    keySkills: ['Electrical safety', 'Measurement', 'Roof and site assessment', 'Customer service'],
    workEnvironments: ['Homes and schools', 'Commercial sites', 'Energy companies', 'Rural projects'],
    routes: [
      { routeType: 'TVET', qualificationTitle: 'Solar PV Installation and Maintenance', exampleInstitutions: ['TVET institutions', 'Kenya Renewable Energy Association training partners'], durationYears: 1 },
      { routeType: 'ARTISAN', qualificationTitle: 'Electrical installation artisan pathway', exampleInstitutions: ['TVET institutions'], durationYears: 2 },
    ],
  },

  // ── STEM — Health & Medicine ─────────────────────────────────────────────
  {
    code: 'CLINICAL_OFFICER', title: 'Clinical Officer', familyCode: 'STEM_HEALTH',
    shortSummary: 'Assess patients, provide treatment and support frontline healthcare under professional standards.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Taking histories', 'Examining patients', 'Treating common conditions', 'Referring complex cases'],
    keySkills: ['Clinical reasoning', 'Communication', 'Ethics', 'Calm decision making'],
    workEnvironments: ['County hospitals', 'Health centres', 'Community programmes', 'Private clinics'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Clinical Medicine and Surgery', exampleInstitutions: ['Kenya Medical Training College', 'Accredited medical colleges'], durationYears: 3 }],
  },
  {
    code: 'MEDICAL_LAB_SCIENTIST', title: 'Medical Laboratory Scientist', familyCode: 'STEM_HEALTH',
    shortSummary: 'Use laboratory science to detect disease, monitor treatment and improve patient care.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Receiving specimens', 'Running diagnostic tests', 'Quality control', 'Reporting results securely'],
    keySkills: ['Biology', 'Chemistry', 'Precision', 'Laboratory safety'],
    workEnvironments: ['Hospital laboratories', 'Research institutes', 'Public health labs', 'Private diagnostic centres'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Medical Laboratory Sciences', exampleInstitutions: ['UoN', 'Kenyatta University', 'Mount Kenya University'], durationYears: 4 }],
  },
  {
    code: 'RADIOGRAPHER', title: 'Radiographer', familyCode: 'STEM_HEALTH',
    shortSummary: 'Operate imaging equipment safely to help clinicians understand injuries and illness.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Preparing patients', 'Operating imaging equipment', 'Checking image quality', 'Following radiation safety protocols'],
    keySkills: ['Anatomy', 'Technology use', 'Patient care', 'Safety discipline'],
    workEnvironments: ['Hospitals', 'Diagnostic centres', 'Mobile screening services', 'Research facilities'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Radiography and Medical Imaging', exampleInstitutions: ['UoN', 'Kenyatta University', 'Moi University'], durationYears: 4 }],
  },
  {
    code: 'DENTIST', title: 'Dentist', familyCode: 'STEM_HEALTH',
    shortSummary: 'Prevent and treat oral disease while helping people build lifelong habits for healthy teeth and gums.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Examining teeth', 'Providing preventive care', 'Restoring damaged teeth', 'Educating patients'],
    keySkills: ['Biology', 'Fine motor control', 'Empathy', 'Clinical judgement'],
    workEnvironments: ['Dental clinics', 'Hospitals', 'Community outreach', 'Teaching hospitals'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'Bachelor of Dental Surgery (BDS)', exampleInstitutions: ['UoN', 'Moi University', 'Kenyatta University'], durationYears: 5 }],
  },
  {
    code: 'PUBLIC_HEALTH_OFFICER', title: 'Public Health Officer', familyCode: 'STEM_HEALTH',
    shortSummary: 'Prevent illness in communities by improving sanitation, surveillance, health education and preparedness.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Inspecting public facilities', 'Investigating outbreaks', 'Running health education', 'Collecting community data'],
    keySkills: ['Epidemiology basics', 'Communication', 'Community engagement', 'Report writing'],
    workEnvironments: ['County health departments', 'Schools', 'NGOs', 'Ports and public facilities'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Public Health', exampleInstitutions: ['Kenya Medical Training College', 'TVET institutions'], durationYears: 2 }],
  },
  {
    code: 'NUTRITIONIST', title: 'Nutritionist / Dietitian', familyCode: 'STEM_HEALTH',
    shortSummary: 'Use food and nutrition science to support growth, health, performance and recovery.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'APPLIED_SCIENCES',
    typicalActivities: ['Assessing diets', 'Planning meal guidance', 'Counselling families', 'Monitoring nutrition programmes'],
    keySkills: ['Biology', 'Communication', 'Cultural awareness', 'Data collection'],
    workEnvironments: ['Hospitals', 'Schools', 'Sports programmes', 'Food and development organisations'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Food, Nutrition and Dietetics', exampleInstitutions: ['Kenyatta University', 'UoN', 'Egerton University'], durationYears: 4 }],
  },
  {
    code: 'VETERINARIAN', title: 'Veterinary Doctor', familyCode: 'STEM_HEALTH',
    shortSummary: 'Protect animal health, livelihoods and food safety through diagnosis, treatment and prevention.',
    recommendedPathway: 'STEM', recommendedTrackCode: 'PURE_SCIENCES',
    typicalActivities: ['Examining animals', 'Vaccination and disease control', 'Advising farmers', 'Supporting food-safety checks'],
    keySkills: ['Biology', 'Observation', 'Practical handling', 'Decision making'],
    workEnvironments: ['Clinics', 'Farms', 'Laboratories', 'County and wildlife services'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'Bachelor of Veterinary Medicine', exampleInstitutions: ['University of Nairobi', 'Egerton University'], durationYears: 5 }],
  },

  // ── Social Sciences — Business & Finance ─────────────────────────────────
  {
    code: 'BUSINESS_MANAGER', title: 'Business Manager', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Coordinate people, money and operations so an organisation can serve customers and meet its goals.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Setting targets', 'Managing budgets', 'Coordinating teams', 'Reviewing performance'],
    keySkills: ['Leadership', 'Numeracy', 'Planning', 'Communication'],
    workEnvironments: ['Companies', 'Schools', 'Retail and hospitality', 'NGOs'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BCom or Business Administration', exampleInstitutions: ['UoN', 'Kenyatta University', 'Strathmore University'], durationYears: 4 }],
  },
  {
    code: 'ENTREPRENEUR', title: 'Entrepreneur / Enterprise Builder', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Spot a need, test a solution and build a responsible enterprise that creates value and jobs.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Researching customers', 'Testing ideas', 'Pricing products', 'Managing cash flow'],
    keySkills: ['Creativity', 'Resilience', 'Financial literacy', 'Negotiation'],
    workEnvironments: ['Startups', 'Family businesses', 'Innovation hubs', 'Community enterprises'],
    routes: [{ routeType: 'CERTIFICATE', qualificationTitle: 'Certificate in Entrepreneurship and Business Management', exampleInstitutions: ['TVET institutions', 'Universities and innovation hubs'], durationYears: 1 }],
  },
  {
    code: 'BANKING_OFFICER', title: 'Banking and Financial Services Officer', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Help customers use savings, payments, credit and other financial services safely and responsibly.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Serving customers', 'Reviewing applications', 'Explaining financial products', 'Checking compliance'],
    keySkills: ['Numeracy', 'Trustworthiness', 'Customer service', 'Digital systems'],
    workEnvironments: ['Banks', 'Microfinance institutions', 'SACCOs', 'Fintechs'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Banking and Finance', exampleInstitutions: ['KCA University', 'TVET institutions'], durationYears: 2 }],
  },
  {
    code: 'MARKETING_SPECIALIST', title: 'Marketing Specialist', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Understand audiences and connect them with useful products, services and causes.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Researching audiences', 'Planning campaigns', 'Writing briefs', 'Measuring results'],
    keySkills: ['Communication', 'Creativity', 'Research', 'Data interpretation'],
    workEnvironments: ['Agencies', 'Consumer brands', 'NGOs', 'Digital platforms'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BCom Marketing or BA Communication', exampleInstitutions: ['UoN', 'Daystar University', 'Strathmore University'], durationYears: 4 }],
  },
  {
    code: 'PROCUREMENT_OFFICER', title: 'Procurement and Supply Officer', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Buy goods and services fairly, transparently and at the quality and value an organisation needs.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Writing specifications', 'Comparing suppliers', 'Managing tenders', 'Tracking contracts'],
    keySkills: ['Integrity', 'Negotiation', 'Record keeping', 'Numeracy'],
    workEnvironments: ['Government', 'Hospitals', 'Manufacturers', 'Development organisations'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BCom Procurement and Supply Chain Management', exampleInstitutions: ['JKUAT', 'UoN', 'Kenyatta University'], durationYears: 4 }],
  },
  {
    code: 'SUPPLY_CHAIN_MANAGER', title: 'Supply Chain Manager', familyCode: 'SOCIAL_BUSINESS',
    shortSummary: 'Plan how products move from suppliers to customers while reducing waste, delay and cost.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'BUSINESS',
    typicalActivities: ['Forecasting demand', 'Planning transport', 'Managing warehouses', 'Improving processes'],
    keySkills: ['Planning', 'Data analysis', 'Negotiation', 'Systems thinking'],
    workEnvironments: ['Manufacturing', 'Retail', 'Logistics companies', 'Humanitarian operations'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Supply Chain Management', exampleInstitutions: ['JKUAT', 'Kenyatta University', 'Strathmore University'], durationYears: 4 }],
  },

  // ── Social Sciences — Law & Governance ────────────────────────────────────
  {
    code: 'POLICE_OFFICER', title: 'Police and Public Safety Officer', familyCode: 'SOCIAL_LAW',
    shortSummary: 'Protect people and property while serving communities lawfully, fairly and professionally.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Community engagement', 'Responding to incidents', 'Gathering evidence', 'Writing reports'],
    keySkills: ['Integrity', 'Fitness', 'Communication', 'Calm judgement'],
    workEnvironments: ['National and county services', 'Community safety teams', 'Transport and security operations'],
    routes: [{ routeType: 'CERTIFICATE', qualificationTitle: 'Recognised public safety and police recruitment training', exampleInstitutions: ['Relevant national recruitment and training institutions'], durationYears: 1 }],
  },
  {
    code: 'DIPLOMAT', title: 'Diplomat / Foreign Service Officer', familyCode: 'SOCIAL_LAW',
    shortSummary: 'Represent Kenya, build relationships and help solve international problems through dialogue.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Researching countries', 'Writing briefs', 'Negotiating', 'Supporting citizens abroad'],
    keySkills: ['Writing', 'Languages', 'Cultural awareness', 'Negotiation'],
    workEnvironments: ['Ministries', 'Embassies', 'International organisations', 'Research institutes'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA International Relations, Law or Political Science', exampleInstitutions: ['UoN', 'USIU-Africa', 'Kenyatta University'], durationYears: 4 }],
  },
  {
    code: 'POLICY_ANALYST', title: 'Policy Analyst', familyCode: 'SOCIAL_LAW',
    shortSummary: 'Turn evidence and public needs into practical options for leaders and communities.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Reviewing evidence', 'Interviewing stakeholders', 'Comparing policy options', 'Writing recommendations'],
    keySkills: ['Research', 'Critical thinking', 'Statistics', 'Clear writing'],
    workEnvironments: ['Government', 'Think tanks', 'NGOs', 'International development'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA Political Science, Economics or Public Policy', exampleInstitutions: ['UoN', 'Kenyatta University', 'Strathmore University'], durationYears: 4 }],
  },
  {
    code: 'HUMAN_RIGHTS_ADVOCATE', title: 'Human Rights Advocate', familyCode: 'SOCIAL_LAW',
    shortSummary: 'Promote dignity and equal treatment by documenting concerns, educating communities and supporting change.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Community education', 'Documenting cases', 'Legal and policy research', 'Coalition building'],
    keySkills: ['Empathy', 'Research', 'Courage', 'Advocacy communication'],
    workEnvironments: ['Civil-society organisations', 'Legal aid clinics', 'Public bodies', 'International agencies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'LLB or BA Development Studies / Political Science', exampleInstitutions: ['UoN', 'Kenyatta University', 'Strathmore University'], durationYears: 4 }],
  },

  // ── Social Sciences — Education & Social Work ────────────────────────────
  {
    code: 'EARLY_CHILDHOOD_EDUCATOR', title: 'Early Childhood Educator', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Create safe, playful learning experiences that build young children’s language, confidence and curiosity.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Planning play-based lessons', 'Observing development', 'Partnering with families', 'Creating inclusive activities'],
    keySkills: ['Patience', 'Child development', 'Creativity', 'Safeguarding'],
    workEnvironments: ['Early learning centres', 'Community programmes', 'Schools', 'Family support services'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Early Childhood Development Education', exampleInstitutions: ['TVET institutions', 'Teacher training colleges'], durationYears: 2 }],
  },
  {
    code: 'SPECIAL_NEEDS_EDUCATOR', title: 'Special Needs Educator', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Adapt teaching and support so learners with different abilities can participate and thrive.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Assessing learning needs', 'Adapting materials', 'Working with families', 'Tracking progress'],
    keySkills: ['Inclusion', 'Patience', 'Observation', 'Collaboration'],
    workEnvironments: ['Inclusive schools', 'Special schools', 'Therapy centres', 'Community programmes'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BEd Special Needs Education', exampleInstitutions: ['Kenyatta University', 'Moi University', 'Maseno University'], durationYears: 4 }],
  },
  {
    code: 'PSYCHOLOGIST', title: 'Psychologist / Mental Health Practitioner', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Help people understand thoughts, feelings and behaviour and connect them with appropriate support.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Conducting interviews', 'Providing counselling under scope', 'Keeping confidential records', 'Designing wellbeing programmes'],
    keySkills: ['Listening', 'Ethics', 'Empathy', 'Evidence-based thinking'],
    workEnvironments: ['Schools', 'Hospitals', 'Counselling centres', 'Community and workplace programmes'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA or BSc Psychology', exampleInstitutions: ['UoN', 'Kenyatta University', 'Daystar University'], durationYears: 4 }],
  },
  {
    code: 'COMMUNITY_DEVELOPMENT_OFFICER', title: 'Community Development Officer', familyCode: 'SOCIAL_EDUCATION',
    shortSummary: 'Work with communities to plan projects, strengthen participation and improve local livelihoods.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Facilitating community meetings', 'Mapping local needs', 'Managing projects', 'Measuring impact'],
    keySkills: ['Facilitation', 'Research', 'Project management', 'Cultural humility'],
    workEnvironments: ['County programmes', 'NGOs', 'Community organisations', 'Development agencies'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA Community Development or Development Studies', exampleInstitutions: ['UoN', 'Kenyatta University', 'Moi University'], durationYears: 4 }],
  },

  // ── Social Sciences — Media & Communication ──────────────────────────────
  {
    code: 'PUBLIC_RELATIONS_OFFICER', title: 'Public Relations and Communications Officer', familyCode: 'SOCIAL_MEDIA',
    shortSummary: 'Build trust between organisations and the public through clear, timely and responsible communication.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Writing releases', 'Planning events', 'Briefing spokespeople', 'Monitoring public feedback'],
    keySkills: ['Writing', 'Relationship building', 'Crisis communication', 'Media literacy'],
    workEnvironments: ['Government', 'Companies', 'NGOs', 'Public information offices'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA Communication, Public Relations or Journalism', exampleInstitutions: ['Daystar University', 'UoN', 'USIU-Africa'], durationYears: 4 }],
  },
  {
    code: 'DIGITAL_CONTENT_CREATOR', title: 'Digital Content Creator', familyCode: 'SOCIAL_MEDIA',
    shortSummary: 'Plan, make and evaluate useful digital stories for audiences on video, audio, web and social platforms.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Researching topics', 'Writing scripts', 'Recording and editing', 'Reading audience analytics'],
    keySkills: ['Storytelling', 'Video and audio editing', 'Research', 'Media ethics'],
    workEnvironments: ['Media houses', 'Brands', 'NGOs', 'Freelance studios'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Journalism, Film or Digital Media', exampleInstitutions: ['Kenya Institute of Mass Communication', 'TVET institutions'], durationYears: 2 }],
  },
  {
    code: 'PHOTOGRAPHER', title: 'Photographer / Visual Storyteller', familyCode: 'SOCIAL_MEDIA',
    shortSummary: 'Use light, composition and ethical storytelling to document people, places, products and events.',
    recommendedPathway: 'SOCIAL_SCIENCES', recommendedTrackCode: 'HUMANITIES',
    typicalActivities: ['Planning shoots', 'Operating cameras', 'Editing images', 'Managing client permissions'],
    keySkills: ['Composition', 'Technical camera skills', 'Observation', 'Client communication'],
    workEnvironments: ['Media houses', 'Events', 'Studios', 'Freelance and documentary projects'],
    routes: [{ routeType: 'CERTIFICATE', qualificationTitle: 'Certificate or Diploma in Photography and Digital Media', exampleInstitutions: ['TVET institutions', 'Kenya Institute of Mass Communication'], durationYears: 1 }],
  },

  // ── Arts & Sports Science — Creative Arts & Design ───────────────────────
  {
    code: 'INTERIOR_DESIGNER', title: 'Interior Designer', familyCode: 'ARTS_CREATIVE',
    shortSummary: 'Plan welcoming, useful and safe interior spaces for homes, schools, offices and public places.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'CREATIVE_ARTS',
    typicalActivities: ['Measuring spaces', 'Developing concepts', 'Selecting materials', 'Presenting 3D layouts'],
    keySkills: ['Spatial thinking', 'Drawing', 'Colour and materials', 'Client listening'],
    workEnvironments: ['Design studios', 'Construction projects', 'Furniture companies', 'Freelance practice'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Interior Design', exampleInstitutions: ['TVET institutions', 'Kenyatta University'], durationYears: 2 }],
  },
  {
    code: 'FASHION_DESIGNER', title: 'Fashion Designer / Garment Technologist', familyCode: 'ARTS_CREATIVE',
    shortSummary: 'Turn ideas and fabrics into well-made clothing that reflects culture, function and personal style.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'CREATIVE_ARTS',
    typicalActivities: ['Sketching garments', 'Choosing fabrics', 'Pattern cutting', 'Fitting and quality checks'],
    keySkills: ['Design', 'Sewing', 'Measurement', 'Entrepreneurship'],
    workEnvironments: ['Fashion houses', 'Tailoring enterprises', 'Manufacturing', 'Costume and events'],
    routes: [{ routeType: 'TVET', qualificationTitle: 'Fashion Design and Garment Making', exampleInstitutions: ['TVET institutions', 'Kenya Institute of Textiles'], durationYears: 2 }],
  },
  {
    code: 'ANIMATOR', title: 'Animator / Motion Designer', familyCode: 'ARTS_CREATIVE',
    shortSummary: 'Bring drawings, characters and ideas to life for education, entertainment, advertising and games.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'CREATIVE_ARTS',
    typicalActivities: ['Storyboarding', 'Creating 2D or 3D assets', 'Animating scenes', 'Compositing sound and visuals'],
    keySkills: ['Drawing', 'Timing and movement', '3D or 2D software', 'Storytelling'],
    workEnvironments: ['Animation studios', 'Film and television', 'Advertising', 'Game and e-learning teams'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Animation, Film or Multimedia', exampleInstitutions: ['TVET institutions', 'Kenyatta University'], durationYears: 2 }],
  },

  // ── Arts & Sports Science — Sports & Physical Education ──────────────────
  {
    code: 'FITNESS_TRAINER', title: 'Fitness Trainer / Wellness Coach', familyCode: 'ARTS_SPORTS',
    shortSummary: 'Help people build safe movement, strength and healthy routines suited to their goals.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'SPORTS_SCIENCE',
    typicalActivities: ['Assessing fitness', 'Planning sessions', 'Demonstrating exercises', 'Tracking progress safely'],
    keySkills: ['Human movement', 'Motivation', 'Safety', 'Customer care'],
    workEnvironments: ['Gyms', 'Schools', 'Community centres', 'Sports and wellness programmes'],
    routes: [{ routeType: 'CERTIFICATE', qualificationTitle: 'Fitness and Sports Coaching Certificate', exampleInstitutions: ['TVET institutions', 'Recognised sports training bodies'], durationYears: 1 }],
  },
  {
    code: 'SPORTS_MANAGER', title: 'Sports Manager / Administrator', familyCode: 'ARTS_SPORTS',
    shortSummary: 'Organise teams, facilities, events and budgets so sport can be safe, fair and sustainable.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'SPORTS_SCIENCE',
    typicalActivities: ['Planning fixtures', 'Managing facilities', 'Coordinating sponsors', 'Supporting safeguarding and compliance'],
    keySkills: ['Organisation', 'Leadership', 'Event planning', 'Budgeting'],
    workEnvironments: ['Sports clubs', 'Schools', 'Federations', 'Community and county programmes'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BSc Sports Management or Sports Science', exampleInstitutions: ['Kenyatta University', 'Moi University', 'UoN'], durationYears: 4 }],
  },

  // ── Arts & Sports Science — Performing Arts ───────────────────────────────
  {
    code: 'ACTOR', title: 'Actor / Theatre Performer', familyCode: 'ARTS_PERFORMING',
    shortSummary: 'Interpret characters and ideas for stage, screen, audio and community storytelling.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'PERFORMING_ARTS',
    typicalActivities: ['Rehearsing', 'Studying scripts', 'Performing', 'Working with directors and crews'],
    keySkills: ['Expression', 'Voice and movement', 'Collaboration', 'Discipline'],
    workEnvironments: ['Theatres', 'Film sets', 'Television', 'Community and cultural projects'],
    routes: [{ routeType: 'DEGREE', qualificationTitle: 'BA Theatre Arts, Film or Performing Arts', exampleInstitutions: ['Kenyatta University', 'UoN', 'Daystar University'], durationYears: 4 }],
  },
  {
    code: 'SOUND_ENGINEER', title: 'Sound Engineer / Audio Producer', familyCode: 'ARTS_PERFORMING',
    shortSummary: 'Capture, mix and shape sound for music, film, broadcast, events and digital learning.',
    recommendedPathway: 'ARTS_SPORTS', recommendedTrackCode: 'PERFORMING_ARTS',
    typicalActivities: ['Recording audio', 'Mixing tracks', 'Setting up microphones', 'Mastering and archiving sessions'],
    keySkills: ['Listening', 'Audio technology', 'Problem solving', 'Teamwork'],
    workEnvironments: ['Studios', 'Broadcast stations', 'Live events', 'Film and podcast teams'],
    routes: [{ routeType: 'DIPLOMA', qualificationTitle: 'Diploma in Audio Production and Sound Engineering', exampleInstitutions: ['TVET institutions', 'Kenya Institute of Mass Communication'], durationYears: 2 }],
  },
];

const PATHWAY_SUBJECT_NOTES: Record<string, string> = {
  STEM: 'Build a strong base in mathematics and the relevant sciences; check the current institution and professional-body requirements for the exact route.',
  SOCIAL_SCIENCES: 'Build communication, literacy, numeracy and humanities or business strengths; check the current institution requirements for the exact route.',
  ARTS_SPORTS: 'Build a portfolio or performance record alongside relevant arts, sports, design and communication subjects; check current audition or practical requirements.',
};

function enrichCareer(career: CareerSeedRecord): CareerSeedRecord {
  const familyOutlook = FAMILY_OUTLOOK[career.familyCode] ?? 'Opportunities vary by employer, location, qualification and experience. Keep building transferable skills and verify current requirements before applying.';
  const familyEarnings = FAMILY_EARNINGS[career.familyCode] ?? 'Earnings vary by qualification, employer, experience and whether work is employed, commissioned or self-directed.';
  const fullDescription = career.fullDescription ?? `${career.title} combines the interests and activities in this profile with practical problem solving. Learners can explore it through school projects, conversations with practitioners, volunteering, clubs and a suitable training route.`;
  const futureSkills = career.futureSkills?.length ? career.futureSkills : [...DEFAULT_FUTURE_SKILLS];
  const successStory = career.successStory ?? `Start small: try a school or community project related to ${career.title.toLowerCase()}, document what you learn and ask a practitioner what the next step looks like.`;

  return {
    ...career,
    alternativeTitles: career.alternativeTitles ?? [],
    fullDescription,
    futureSkills,
    labourMarketNotes: career.labourMarketNotes ?? familyOutlook,
    salaryRangeNotes: career.salaryRangeNotes ?? familyEarnings,
    successStory,
    source: career.source ?? OFFICIAL_SOURCES,
    routes: career.routes.map(route => ({
      ...route,
      minSubjectNotes: route.minSubjectNotes ?? PATHWAY_SUBJECT_NOTES[career.recommendedPathway],
      progressionOptions: route.progressionOptions ?? ['Gain supervised experience', 'Build a portfolio or record of practice', 'Check current registration or entry requirements'],
      source: route.source ?? OFFICIAL_SOURCES,
    })),
  };
}

export const CAREERS: CareerSeedRecord[] = [...STARTER_CAREERS, ...ADDITIONAL_CAREERS].map(enrichCareer);

export const CAREER_CATALOGUE_STATS = {
  families: CAREER_FAMILIES.length,
  careers: CAREERS.length,
};
