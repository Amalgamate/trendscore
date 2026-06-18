/**
 * Official CBC Learning Area Mapping (Per Grade)
 * Source: MoE / KICD Guidelines
 * This is the Single Source of Truth for Grade-Based auto-generation.
 */

import useSubjectStore from '../store/useSubjectStore';

export const OFFICIAL_CBC_MAPPING = {
  'PLAYGROUP': ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'PP1': ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'PP2': ['Language Activities', 'Kiswahili', 'Mathematical Activities', 'Environmental Activities', 'Creative Activities', 'Religious Activities', 'Pastoral Programme of Instruction (PPI)'],
  'GRADE_1': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_2': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_3': ['English', 'Kiswahili', 'Indigenous Language', 'Mathematical Activities', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
  'GRADE_4': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_5': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_6': ['English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'Mathematics', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'GRADE_7': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  'GRADE_8': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
  'GRADE_9': ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Religious Education', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts & Sports'],
};

/**
 * Returns learning areas for a specific grade
 * Prioritizes dynamic database subjects, falls back to static mapping
 */
export const getLearningAreasByGrade = (grade) => {
  if (!grade) return [];

  // 1. Try to get dynamic subjects from Store
  const dynamicSubjects = useSubjectStore.getState().getSubjectsByGrade(grade);
  if (dynamicSubjects && dynamicSubjects.length > 0) {
    return dynamicSubjects.map(s => s.name);
  }
  
  // 2. Fallback to Static Mapping
  const normalizedGrade = String(grade)
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
    
  return OFFICIAL_CBC_MAPPING[normalizedGrade] || [];
};

/**
 * Returns grouped learning areas for UI display (grouped by Grade)
 */
export const getGroupedLearningAreas = (grade) => {
  const areas = getLearningAreasByGrade(grade);
  return {
    [grade]: areas
  };
};

/**
 * Fallback for legacy components
 */
export const getAllLearningAreas = () => {
  const dynamicSubjects = useSubjectStore.getState().subjects;
  if (dynamicSubjects && dynamicSubjects.length > 0) {
    return Array.from(new Set(dynamicSubjects.map(s => s.name)));
  }

  const all = new Set();
  Object.values(OFFICIAL_CBC_MAPPING).forEach(areas => {
    areas.forEach(area => all.add(area));
  });
  return Array.from(all);
};

/**
 * Validates if a learning area is official for a given grade
 */
export const isValidLearningAreaForGrade = (grade, learningArea) => {
  const areas = getLearningAreasByGrade(grade);
  return areas.includes(learningArea);
};

const learningAreasExport = {
  OFFICIAL_CBC_MAPPING,
  getLearningAreasByGrade,
  getAllLearningAreas,
  isValidLearningAreaForGrade,
  getGroupedLearningAreas
};

export default learningAreasExport;
