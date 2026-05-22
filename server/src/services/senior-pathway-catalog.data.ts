export type OfficialPathwayCode = 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';
export type OfficialSubjectType = 'EXAMINABLE_CORE' | 'EXAMINABLE_OPTIONAL' | 'SUPPORT_SUBJECT' | 'NON_EXAMINABLE';

export const OFFICIAL_PATHWAYS: Array<{ code: OfficialPathwayCode; name: string; description: string }> = [
  { code: 'STEM', name: 'STEM', description: 'Science, Technology, Engineering and Mathematics' },
  { code: 'SOCIAL_SCIENCES', name: 'Social Sciences', description: 'Humanities, business studies, languages, and literature' },
  { code: 'ARTS_SPORTS', name: 'Arts & Sports Science', description: 'Arts, sports, and recreation' },
];

export const OFFICIAL_TRACKS: Array<{
  pathwayCode: OfficialPathwayCode;
  code: string;
  name: string;
  description?: string;
}> = [
  { pathwayCode: 'STEM', code: 'PURE_SCIENCES', name: 'Pure Sciences' },
  { pathwayCode: 'STEM', code: 'APPLIED_SCIENCES', name: 'Applied Sciences' },
  { pathwayCode: 'STEM', code: 'TECHNICAL_STUDIES', name: 'Technical Studies' },
  { pathwayCode: 'SOCIAL_SCIENCES', code: 'HUMANITIES_BUSINESS', name: 'Humanities & Business Studies' },
  { pathwayCode: 'SOCIAL_SCIENCES', code: 'LANGUAGES_LITERATURE', name: 'Languages & Literature' },
  { pathwayCode: 'ARTS_SPORTS', code: 'ARTS', name: 'Arts' },
  { pathwayCode: 'ARTS_SPORTS', code: 'SPORTS_RECREATION', name: 'Sports & Recreation' },
];

export const OFFICIAL_LEARNING_AREAS: Array<{
  officialCode: string;
  officialName: string;
  subjectType: OfficialSubjectType;
  pathwayCode?: OfficialPathwayCode;
  trackCode?: string;
  examinable?: boolean;
}> = [
  { officialCode: 'ENG', officialName: 'English', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'KIS', officialName: 'Kiswahili', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'KSL', officialName: 'Kenya Sign Language', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'CORE_MATH', officialName: 'Core Mathematics', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'ESS_MATH', officialName: 'Essential Mathematics', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'CSL', officialName: 'Community Service Learning', subjectType: 'EXAMINABLE_CORE' },
  { officialCode: 'PE', officialName: 'Physical Education', subjectType: 'SUPPORT_SUBJECT', examinable: false },
  { officialCode: 'ICT', officialName: 'ICT', subjectType: 'SUPPORT_SUBJECT', examinable: false },

  { officialCode: 'BIO', officialName: 'Biology', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'PURE_SCIENCES' },
  { officialCode: 'CHEM', officialName: 'Chemistry', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'PURE_SCIENCES' },
  { officialCode: 'PHY', officialName: 'Physics', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'PURE_SCIENCES' },
  { officialCode: 'GEN_SCI', officialName: 'General Science', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'PURE_SCIENCES' },
  { officialCode: 'ADV_MATH', officialName: 'Advanced Mathematics', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'PURE_SCIENCES' },
  { officialCode: 'AGRI', officialName: 'Agriculture', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'APPLIED_SCIENCES' },
  { officialCode: 'COMP_STUD', officialName: 'Computer Studies', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'APPLIED_SCIENCES' },
  { officialCode: 'HOME_SCI', officialName: 'Home Science', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'APPLIED_SCIENCES' },
  { officialCode: 'AVIATION', officialName: 'Aviation', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'BUILDING_CONSTRUCTION', officialName: 'Building Construction', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'ELECTRICITY', officialName: 'Electricity', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'METALWORK', officialName: 'Metalwork', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'POWER_MECHANICS', officialName: 'Power Mechanics', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'WOODWORK', officialName: 'Woodwork', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'MEDIA_TECH', officialName: 'Media Technology', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },
  { officialCode: 'MARINE_FISHERIES', officialName: 'Marine & Fisheries Technology', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'STEM', trackCode: 'TECHNICAL_STUDIES' },

  { officialCode: 'LIT_ENG', officialName: 'Literature in English', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'IND_LANG', officialName: 'Indigenous Languages', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'FASIHI', officialName: 'Fasihi ya Kiswahili', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'ARABIC', officialName: 'Arabic', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'FRENCH', officialName: 'French', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'GERMAN', officialName: 'German', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'MANDARIN', officialName: 'Mandarin Chinese', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'LANGUAGES_LITERATURE' },
  { officialCode: 'CRE', officialName: 'Christian Religious Education', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },
  { officialCode: 'IRE', officialName: 'Islamic Religious Education', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },
  { officialCode: 'HRE', officialName: 'Hindu Religious Education', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },
  { officialCode: 'BUSINESS', officialName: 'Business Studies', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },
  { officialCode: 'HISTORY_CIT', officialName: 'History and Citizenship', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },
  { officialCode: 'GEOGRAPHY', officialName: 'Geography', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'SOCIAL_SCIENCES', trackCode: 'HUMANITIES_BUSINESS' },

  { officialCode: 'FINE_ARTS', officialName: 'Fine Arts', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'ARTS_SPORTS', trackCode: 'ARTS' },
  { officialCode: 'MUSIC_DANCE', officialName: 'Music and Dance', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'ARTS_SPORTS', trackCode: 'ARTS' },
  { officialCode: 'THEATRE_FILM', officialName: 'Theatre and Film', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'ARTS_SPORTS', trackCode: 'ARTS' },
  { officialCode: 'SPORTS_RECREATION', officialName: 'Sports and Recreation', subjectType: 'EXAMINABLE_OPTIONAL', pathwayCode: 'ARTS_SPORTS', trackCode: 'SPORTS_RECREATION' },
];

export const OFFICIAL_LEARNING_AREA_ALIASES: Array<{ alias: string; officialCode: string; source?: string }> = [
  { alias: 'English', officialCode: 'ENG', source: 'legacy' },
  { alias: 'Kiswahili', officialCode: 'KIS', source: 'legacy' },
  { alias: 'Kenya Sign Language', officialCode: 'KSL', source: 'legacy' },
  { alias: 'Community Service Learning', officialCode: 'CSL', source: 'legacy' },
  { alias: 'Physical Education', officialCode: 'PE', source: 'legacy' },
  { alias: 'Computer Science', officialCode: 'COMP_STUD', source: 'legacy' },
  { alias: 'Computer Studies', officialCode: 'COMP_STUD', source: 'official' },
  { alias: 'Mandarin', officialCode: 'MANDARIN', source: 'legacy' },
  { alias: 'Mandarin Chinese', officialCode: 'MANDARIN', source: 'official' },
  { alias: 'History & Citizenship', officialCode: 'HISTORY_CIT', source: 'legacy' },
  { alias: 'History and Citizenship', officialCode: 'HISTORY_CIT', source: 'official' },
  { alias: 'Fine Art', officialCode: 'FINE_ARTS', source: 'legacy' },
  { alias: 'Fine Arts', officialCode: 'FINE_ARTS', source: 'official' },
  { alias: 'Home Management', officialCode: 'HOME_SCI', source: 'legacy' },
  { alias: 'Foods & Nutrition', officialCode: 'HOME_SCI', source: 'legacy' },
  { alias: 'Construction Technology', officialCode: 'BUILDING_CONSTRUCTION', source: 'legacy' },
  { alias: 'Electrical Technology', officialCode: 'ELECTRICITY', source: 'legacy' },
  { alias: 'Electrical Installation', officialCode: 'ELECTRICITY', source: 'legacy' },
  { alias: 'Wood Technology', officialCode: 'WOODWORK', source: 'legacy' },
  { alias: 'Carpentry & Joinery', officialCode: 'WOODWORK', source: 'legacy' },
  { alias: 'Film & Digital Media', officialCode: 'THEATRE_FILM', source: 'legacy' },
  { alias: 'Theatre & Elocution', officialCode: 'THEATRE_FILM', source: 'legacy' },
  { alias: 'Athletics', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Ball Games', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Gymnastics', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Water Sports', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Martial Arts', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Boxing', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
  { alias: 'Outdoor Pursuits', officialCode: 'SPORTS_RECREATION', source: 'legacy' },
];

export const OFFICIAL_COMBINATION_RULES: Array<{
  code: string;
  name: string;
  pathwayCode: OfficialPathwayCode;
  trackCode: string;
  officialSource?: string;
  subjects: string[];
}> = [
  {
    code: 'STEM_PURE_BIO_CHEM_PHY',
    name: 'Biology + Chemistry + Physics',
    pathwayCode: 'STEM',
    trackCode: 'PURE_SCIENCES',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['BIO', 'CHEM', 'PHY'],
  },
  {
    code: 'STEM_PURE_BIO_CHEM_AGRI',
    name: 'Biology + Chemistry + Agriculture',
    pathwayCode: 'STEM',
    trackCode: 'PURE_SCIENCES',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['BIO', 'CHEM', 'AGRI'],
  },
  {
    code: 'STEM_APPLIED_PHY_CHEM_COMP',
    name: 'Physics + Chemistry + Computer Studies',
    pathwayCode: 'STEM',
    trackCode: 'APPLIED_SCIENCES',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['PHY', 'CHEM', 'COMP_STUD'],
  },
  {
    code: 'SOC_HUM_HISTORY_GEO_CRE',
    name: 'History and Citizenship + Geography + CRE',
    pathwayCode: 'SOCIAL_SCIENCES',
    trackCode: 'HUMANITIES_BUSINESS',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['HISTORY_CIT', 'GEOGRAPHY', 'CRE'],
  },
  {
    code: 'SOC_LANG_LIT_FRENCH_HISTORY',
    name: 'Literature in English + French + History and Citizenship',
    pathwayCode: 'SOCIAL_SCIENCES',
    trackCode: 'LANGUAGES_LITERATURE',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['LIT_ENG', 'FRENCH', 'HISTORY_CIT'],
  },
  {
    code: 'ARTS_FINE_MUSIC_THEATRE',
    name: 'Fine Arts + Music and Dance + Theatre and Film',
    pathwayCode: 'ARTS_SPORTS',
    trackCode: 'ARTS',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['FINE_ARTS', 'MUSIC_DANCE', 'THEATRE_FILM'],
  },
  {
    code: 'SPORTS_RECREATION_BIO_CHEM',
    name: 'Sports and Recreation + Biology + Chemistry',
    pathwayCode: 'ARTS_SPORTS',
    trackCode: 'SPORTS_RECREATION',
    officialSource: 'senior-school-subject-combinations',
    subjects: ['SPORTS_RECREATION', 'BIO', 'CHEM'],
  },
];

export const AMBIGUOUS_ALIASES = new Set(['Mathematics']);
