/**
 * useAssessmentSetup Hook
 * Consolidates common assessment context selection logic
 * Used by: FormativeAssessment, CoreCompetenciesAssessment, ValuesAssessment, etc.
 */

import { useState, useCallback } from 'react';
import { TERMS } from '../../../constants/terms';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { getCurrentAcademicYear } from '../utils/academicYear';

/**
 * Custom hook for assessment setup state
 * Handles: grade, stream, term, academic year selection
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.defaultGrade - Initial grade value
 * @param {string} options.defaultStream - Initial stream value
 * @param {string} options.defaultTerm - Initial term value (default: 'TERM_1')
 * @returns {Object} Assessment setup state and handlers
 */
export const useAssessmentSetup = (options = {}) => {
  const {
    defaultGrade = '',
    defaultStream = '',
    defaultTerm = 'TERM_1',
    defaultAcademicYear = getCurrentAcademicYear()
  } = options;

  // Context state
  const [selectedGrade, setSelectedGrade] = useState(defaultGrade);
  const [selectedStream, setSelectedStream] = useState(defaultStream);
  const [selectedTerm, setSelectedTerm] = useState(defaultTerm);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(defaultAcademicYear || getCurrentAcademicYear());
  const { grades: dynamicGrades, streams: dynamicStreams } = useSchoolData();

  // Reset all selections
  const resetSetup = useCallback(() => {
    setSelectedGrade(defaultGrade);
    setSelectedStream(defaultStream);
    setSelectedTerm(defaultTerm);
    setSelectedAcademicYear(defaultAcademicYear || getCurrentAcademicYear());
  }, [defaultGrade, defaultStream, defaultTerm, defaultAcademicYear]);

  // Update grade
  const updateGrade = useCallback((grade) => {
    setSelectedGrade(grade);
  }, []);

  // Update stream
  const updateStream = useCallback((stream) => {
    setSelectedStream(stream);
  }, []);

  // Update term
  const updateTerm = useCallback((term) => {
    setSelectedTerm(term);
  }, []);

  // Update academic year
  const setAcademicYear = useCallback((year) => {
    setSelectedAcademicYear(year);
  }, []);

  // Check if setup is complete
  const isSetupComplete = useCallback(() => {
    return selectedGrade && selectedStream && selectedTerm;
  }, [selectedGrade, selectedStream, selectedTerm]);

  // Get current setup as object
  const getSetup = useCallback(() => ({
    grade: selectedGrade,
    stream: selectedStream,
    term: selectedTerm,
    academicYear: selectedAcademicYear
  }), [selectedGrade, selectedStream, selectedTerm, selectedAcademicYear]);

  return {
    // State
    selectedGrade,
    selectedStream,
    selectedTerm,
    academicYear: selectedAcademicYear,
    grades: dynamicGrades.length > 0 ? dynamicGrades.map(g => ({ value: g, label: g.replace(/_/g, ' ') })) : [],
    streams: dynamicStreams.length > 0 ? dynamicStreams.map(s => ({ value: s.name, label: `Stream ${s.name}` })) : [],
    terms: TERMS,

    // Setters (Standard Names)
    setSelectedGrade: updateGrade,
    setSelectedStream: updateStream,
    setSelectedTerm: updateTerm,
    setSelectedAcademicYear: setAcademicYear,

    // Aliases for compatibility with older code
    updateGrade,
    updateStream,
    updateTerm,
    updateAcademicYear: setAcademicYear,

    // Utilities
    resetSetup,
    isSetupComplete,
    getSetup
  };
};

export default useAssessmentSetup;
