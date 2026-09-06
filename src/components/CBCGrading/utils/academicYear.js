/**
 * Academic Year Utilities
 * Helper functions for managing academic year
 */

/**
 * Get current academic year based on date
 * Kenya CBC academic year typically runs January - December (calendar year)
 * 
 * @returns {number} Current academic year
 */
export const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  
  // For Kenya CBC: Academic year = Calendar year
  // Year starts in January and ends in December
  return year;
};

/**
 * Get current school term based on date (Kenya CBC calendar approximation)
 * Term 1: Jan-Apr, Term 2: May-Aug, Term 3: Sep-Dec
 *
 * @returns {string} TERM_1 | TERM_2 | TERM_3
 */
export const getCurrentTerm = () => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 1 && month <= 4) return 'TERM_1';
  if (month >= 5 && month <= 8) return 'TERM_2';
  return 'TERM_3';
};

/**
 * Get dynamic list of academic years as numbers
 * 
 * @param {Object} options
 * @param {number} [options.minPast=5] Number of years in the past
 * @param {number} [options.minFuture=8] Number of years in the future for planning
 * @param {Array<number|string>} [options.extraYears=[]] Any additional years (e.g. from DB, custom entry)
 * @param {'asc'|'desc'} [options.order='asc'] Sort direction
 * @returns {number[]} Array of distinct year numbers
 */
export const getDynamicAcademicYears = ({
  minPast = 5,
  minFuture = 8,
  extraYears = [],
  order = 'asc'
} = {}) => {
  const current = getCurrentAcademicYear();
  const yearSet = new Set();

  for (let i = -minPast; i <= minFuture; i++) {
    yearSet.add(current + i);
  }

  (extraYears || []).forEach(y => {
    const parsed = Number(y);
    if (parsed && !Number.isNaN(parsed) && parsed >= 2000 && parsed <= 2150) {
      yearSet.add(parsed);
    }
  });

  const sorted = Array.from(yearSet).sort((a, b) => (order === 'desc' ? b - a : a - b));
  return sorted;
};

/**
 * Get academic year options for dropdowns
 * Returns years with value and label, combining dynamic rolling horizon + extra years
 * 
 * @param {Object} options
 * @param {number} [options.minPast=5]
 * @param {number} [options.minFuture=8]
 * @param {Array<number|string>} [options.extraYears=[]]
 * @param {'asc'|'desc'} [options.order='desc'] Defaults to newest first for standard dropdowns
 * @returns {Array<{value: number, label: string}>} Array of year objects with value and label
 */
export const getAcademicYearOptions = ({
  minPast = 5,
  minFuture = 8,
  extraYears = [],
  order = 'desc'
} = {}) => {
  const years = getDynamicAcademicYears({ minPast, minFuture, extraYears, order });
  return years.map(year => ({
    value: year,
    label: year.toString()
  }));
};

/**
 * Format academic year for display
 * 
 * @param {number|string} year - Academic year
 * @returns {string} Formatted year string
 */
export const formatAcademicYear = (year) => {
  return year?.toString() || 'N/A';
};

/**
 * Validate academic year
 * Allows a generous ±15 year operational range around current year
 * 
 * @param {number|string} year - Year to validate
 * @returns {boolean} True if valid
 */
export const isValidAcademicYear = (year) => {
  const num = Number(year);
  if (!num || Number.isNaN(num)) return false;
  
  const currentYear = getCurrentAcademicYear();
  return num >= (currentYear - 15) && num <= (currentYear + 15);
};

const academicYearConfig = {
  getCurrentAcademicYear,
  getCurrentTerm,
  getDynamicAcademicYears,
  getAcademicYearOptions,
  formatAcademicYear,
  isValidAcademicYear
};
export default academicYearConfig;
