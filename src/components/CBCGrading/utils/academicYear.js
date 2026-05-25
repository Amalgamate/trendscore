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
 * Get academic year options for dropdown
 * Returns current year and 2 years on either side
 * 
 * @returns {Array} Array of year objects with value and label
 */
export const getAcademicYearOptions = () => {
  const currentYear = getCurrentAcademicYear();
  const years = [];
  // Restrict to current year and 10 years in the past
  for (let i = -10; i <= 0; i++) {
    const year = currentYear + i;
    years.push({
      value: year,
      label: year.toString()
    });
  }
  
  // Return reversed so current year is at the top
  return years.reverse();
};

/**
 * Format academic year for display
 * 
 * @param {number} year - Academic year
 * @returns {string} Formatted year string
 */
export const formatAcademicYear = (year) => {
  return year?.toString() || 'N/A';
};

/**
 * Validate academic year
 * 
 * @param {number} year - Year to validate
 * @returns {boolean} True if valid
 */
export const isValidAcademicYear = (year) => {
  if (!year || typeof year !== 'number') return false;
  
  const currentYear = getCurrentAcademicYear();
  // Valid range: up to current year, stretching 10 years back
  return year >= (currentYear - 10) && year <= currentYear;
};

const academicYearConfig = {
  getCurrentAcademicYear,
  getCurrentTerm,
  getAcademicYearOptions,
  formatAcademicYear,
  isValidAcademicYear
};
export default academicYearConfig;
