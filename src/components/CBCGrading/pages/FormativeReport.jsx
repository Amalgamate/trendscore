/**
 * Formative Report Page - UPDATED WITH REAL DATA
 * View formative assessment reports for learners with actual API data
 * Redesigned with Compact Context Header Pattern
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Loader, Printer, Edit3, User } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import { generatePDFWithLetterhead } from '../../../utils/simplePdfGenerator';
import DownloadReportButton from '../shared/DownloadReportButton';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { useLearnerSelection } from '../hooks/useLearnerSelection';

const FormativeReport = ({ learners, brandingSettings, user }) => {
  const { showSuccess, showError } = useNotifications();

  // Use centralized hooks for assessment state management
  const setup = useAssessmentSetup({ defaultTerm: 'TERM_1' });
  const selection = useLearnerSelection(learners || [], { status: ['ACTIVE', 'Active'] });

  // UI State
  const [viewMode, setViewMode] = useState('setup'); // 'setup' or 'report'
  const [selectedArea, setSelectedArea] = useState('all');

  // Data State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!selection.selectedLearnerId) return;

    setLoading(true);
    try {
      const response = await api.reports.getFormativeReport(selection.selectedLearnerId, {
        term: setup.selectedTerm,
        academicYear: setup.academicYear
      });

      if (response.success) {
        setReportData(response.data);
        setViewMode('report'); // Auto-switch to report view on success
      } else {
        throw new Error(response.message || 'Failed to load report');
      }
    } catch (error) {
      console.error('Error fetching formative report:', error);
      showError(error.message || 'Failed to load formative report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selection.selectedLearnerId, setup.selectedTerm, setup.academicYear, showError]);

  // Fetch report data when learner or term changes
  useEffect(() => {
    if (selection.selectedLearnerId && setup.selectedTerm) {
      fetchReportData();
    }
  }, [selection.selectedLearnerId, setup.selectedTerm, fetchReportData]);

  const handleDownloadPDF = async (onProgress) => {
    if (!reportData) {
      showError('No report data available');
      return { success: false, error: 'No data' };
    }

    try {
      const filename = `${reportData.learner.firstName}_${reportData.learner.lastName}_Formative_${setup.selectedTerm}_Report.pdf`;

      const schoolInfo = {
        schoolName: user?.school?.name || brandingSettings?.schoolName || '',
        address: user?.school?.location || brandingSettings?.address || 'P.O. Box 1234, Nairobi, Kenya',
        phone: user?.school?.phone || brandingSettings?.phone || '+254 700 000000',
        email: user?.school?.email || brandingSettings?.email || 'info@school.ac.ke',
        website: user?.school?.website || brandingSettings?.website || 'www.school.ac.ke',
        logoUrl: brandingSettings?.logoUrl || user?.school?.logo || '/branding/logo.png',
        brandColor: brandingSettings?.brandColor || '#1e3a8a'
      };

      // generatePDFWithLetterhead now routes through the unified frontend engine.
      // schoolInfo is accepted for back-compat but the letterhead is already
      // rendered in the DOM by the report template itself.
      const result = await generatePDFWithLetterhead(
        'formative-report-content',
        filename,
        schoolInfo,
        { onProgress }
      );

      if (result.success) {
        showSuccess('Report downloaded successfully!');
        return { success: true };
      } else {
        throw new Error(result.error || 'PDF generation failed');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      showError('Failed to generate PDF. Please try again.');
      return { success: false, error: error.message };
    }
  };

  const handlePrint = () => {
    window.print();
    showSuccess('Printing report...');
  };


  // Get rating color
  const getRatingColor = (rating) => {
    if (!rating) return 'bg-gray-100 text-gray-800';
    if (rating.startsWith('EE')) return 'bg-green-100 text-green-800';
    if (rating.startsWith('ME')) return 'bg-blue-100 text-blue-800';
    if (rating.startsWith('AE')) return 'bg-yellow-100 text-yellow-800';
    if (rating.startsWith('BE')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Get rating label
  const getRatingLabel = (rating) => {
    if (!rating) return 'Not Assessed';
    const labels = {
      'EE1': 'Exceeds Expectations 1',
      'EE2': 'Exceeds Expectations 2',
      'ME1': 'Meets Expectations 1',
      'ME2': 'Meets Expectations 2',
      'AE1': 'Approaches Expectations 1',
      'AE2': 'Approaches Expectations 2',
      'BE1': 'Below Expectations 1',
      'BE2': 'Below Expectations 2',
    };
    return labels[rating] || rating;
  };

  // Derive learningAreasAssessed from the assessments array (backend sends byLearningArea
  // as an object but doesn't send a flat array — build it here)
  const learningAreasAssessed = reportData
    ? [...new Set((reportData.assessments || []).map(a => a.learningArea))].sort()
    : [];

  // Distribution helpers — backend uses EE/ME/AE/BE (rubric groups),
  // frontend stat cards want EE1+EE2, ME1+ME2, AE1+AE2 (detailed ratings).
  // The detailed ratings live on each assessment as detailedRating.
  const detailedDist = (reportData?.assessments || []).reduce((acc, a) => {
    if (a.detailedRating) acc[a.detailedRating] = (acc[a.detailedRating] || 0) + 1;
    return acc;
  }, {});

  // averagePercentage — backend sends averagePoints (points scale) and individual
  // assessment percentages; compute mean from assessments directly.
  const averagePercentage = (() => {
    const percs = (reportData?.assessments || []).map(a => a.percentage).filter(p => p != null);
    return percs.length > 0 ? Math.round(percs.reduce((a, b) => a + b, 0) / percs.length) : 0;
  })();

  // Filter assessments by learning area
  const filteredAssessments = selectedArea === 'all'
    ? reportData?.assessments || []
    : (reportData?.assessments || []).filter(a => a.learningArea === selectedArea);

  const handleReset = () => {
    selection.clearSelection();
    setReportData(null);
    setViewMode('setup');
  };

  return (
    <div className="space-y-6">

      {/* SETUP VIEW: SELECTION PANEL */}
      {viewMode === 'setup' && (
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border border-gray-200 max-w-4xl mx-auto mt-4 sm:mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 shrink-0 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Generate Formative Report</h2>
              <p className="text-sm text-gray-500">Select a learner and term to view their assessment report</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Learner</label>

              <SmartLearnerSearch
                learners={selection.filteredLearners}
                selectedLearnerId={selection.selectedLearnerId}
                onSelect={selection.selectLearner}
                placeholder="Search by name, adm no..."
                compact
                inputClassName="h-12 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Term</label>
              <select
                value={setup.selectedTerm}
                onChange={(e) => setup.updateTerm(e.target.value)}
                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {setup.terms.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading && (
            <div className="mt-8 text-center">
              <Loader className="mx-auto animate-spin text-blue-600 mb-2" size={24} />
              <p className="text-sm text-gray-500">Generating report...</p>
            </div>
          )}
        </div>
      )}

      {/* REPORT VIEW */}
      {viewMode === 'report' && reportData && (
        <>
          {/* Compact Context Header */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-20 print:hidden">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <User size={24} />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 text-lg line-clamp-1">
                  {reportData.learner.firstName} {reportData.learner.lastName}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                  <span>{reportData.learner.admissionNumber}</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                    {setup.terms.find(t => t.value === setup.selectedTerm)?.label} {setup.academicYear}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-end items-center gap-2 md:gap-3 w-full md:w-auto">
              <div className="hidden md:block">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Learning Areas</option>
                  {learningAreasAssessed.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Edit3 size={16} />
                Change
              </button>

              <DownloadReportButton
                onDownload={handleDownloadPDF}
                label="PDF"
                className="px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-brand-teal/90 transition shadow-sm font-semibold text-sm flex items-center justify-center gap-2 flex-1 md:flex-none"
              />

              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Print Report"
              >
                <Printer size={20} />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div id="formative-report-content" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Learner Information */}
            <div className="bg-white rounded-xl shadow-md p-4 print:shadow-none print:border print:border-gray-200">
              <h3 className="text-xs font-medium mb-3 uppercase text-gray-500 tracking-wider border-b border-gray-100 pb-2">Learner Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Name</p>
                  <p className="text-gray-900 text-sm font-medium">
                    {reportData.learner.firstName} {reportData.learner.middleName || ''} {reportData.learner.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Admission No</p>
                  <p className="text-gray-900 text-sm font-medium">{reportData.learner.admissionNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Class</p>
                  <p className="text-gray-900 text-sm font-medium">{reportData.learner.grade} {reportData.learner.stream ? `- ${reportData.learner.stream}` : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Term</p>
                  <p className="text-gray-900 text-sm font-medium">{setup.terms.find(t => t.value === setup.selectedTerm)?.label} 2026</p>
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden print:shadow-none print:border print:border-gray-200">
              <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                <h4 className="font-medium text-blue-800 text-xs uppercase tracking-wider">Performance Summary</h4>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Total Assessments</p>
                    <p className="text-2xl font-medium text-gray-800">{reportData.totalAssessments}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Average %</p>
                    <p className="text-2xl font-medium text-purple-600">{averagePercentage}%</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                    <p className="text-[10px] text-green-600 font-medium uppercase mb-1">Exceeding</p>
                    <p className="text-2xl font-medium text-green-700">
                      {(detailedDist.EE1 || 0) + (detailedDist.EE2 || 0)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-medium uppercase mb-1">Meeting</p>
                    <p className="text-2xl font-medium text-blue-700">
                      {(detailedDist.ME1 || 0) + (detailedDist.ME2 || 0)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
                    <p className="text-[10px] text-yellow-600 font-medium uppercase mb-1">Approaching</p>
                    <p className="text-2xl font-medium text-yellow-700">
                      {(detailedDist.AE1 || 0) + (detailedDist.AE2 || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Printable Report Content */}
            <div className="bg-white rounded-xl shadow-md p-6 print:shadow-none print:p-0">
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h3 className="text-lg font-medium text-gray-800">Detailed Assessment Report</h3>
                <span className="text-sm text-gray-500">{filteredAssessments.length} records found</span>
              </div>

              {/* Assessments by Learning Area */}
              <div className="space-y-4">
                {filteredAssessments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <FileText className="mx-auto mb-2 text-gray-400" size={32} />
                    <p>No assessments found for the selected criteria</p>
                  </div>
                ) : (
                  filteredAssessments.map((assessment, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors break-inside-avoid">
                      <div className="flex flex-col md:flex-row md:justify-between items-start mb-3 gap-2 md:gap-0">
                        <div>
                          <h4 className="font-medium text-sm text-gray-900">{assessment.learningArea}</h4>
                          {assessment.strand && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              <span className="font-semibold">Strand:</span> {assessment.strand}
                              {assessment.subStrand && ` - ${assessment.subStrand}`}
                            </p>
                          )}
                        </div>
                        <div className="text-left md:text-right w-full md:w-auto">
                          <span className={`inline-flex max-w-max px-3 py-1 rounded-full text-xs font-medium ${getRatingColor(assessment.detailedRating)}`}>
                            {assessment.detailedRating} - {assessment.percentage}%
                          </span>
                          <p className="text-[10px] text-gray-500 mt-1 font-medium uppercase">{getRatingLabel(assessment.detailedRating)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 bg-gray-50 p-3 rounded-lg text-xs">
                        {/* Feedback Sections */}
                        {assessment.strengths && (
                          <div className="flex gap-2">
                            <span className="font-medium text-green-700 min-w-[80px]">✓ Strengths:</span>
                            <span className="text-gray-700">{assessment.strengths}</span>
                          </div>
                        )}

                        {assessment.areasImprovement && (
                          <div className="flex gap-2">
                            <span className="font-medium text-orange-700 min-w-[80px]">→ Improve:</span>
                            <span className="text-gray-700">{assessment.areasImprovement}</span>
                          </div>
                        )}

                        {assessment.recommendations && (
                          <div className="flex gap-2">
                            <span className="font-medium text-blue-700 min-w-[80px]">💡 Advice:</span>
                            <span className="text-gray-700">{assessment.recommendations}</span>
                          </div>
                        )}
                      </div>

                      {/* Teacher Info */}
                      <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex justify-end items-center gap-1">
                        <span>Assessed by:</span>
                        <span className="font-medium text-gray-600">{assessment.teacher?.firstName} {assessment.teacher?.lastName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Teacher's Overall Comment */}
              {reportData.teacherComment && (
                <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-xl break-inside-avoid">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <Edit3 size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 text-sm mb-1">Class Teacher's Comment</p>
                      <p className="text-gray-700 text-sm leading-relaxed">{reportData.teacherComment.classTeacherComment}</p>

                      <div className="mt-3 flex justify-between items-center border-t border-blue-200 pt-2">
                        <p className="text-xs font-semibold text-blue-800">
                          {reportData.teacherComment.classTeacherName}
                        </p>
                        <p className="text-xs text-blue-600">
                          {new Date(reportData.teacherComment.classTeacherDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Footer */}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 relative">
                {brandingSettings?.stampUrl && (
                  <div className="absolute right-0 bottom-full mb-[-10px] opacity-60">
                    <img
                      src={brandingSettings.stampUrl}
                      alt="Stamp"
                      className="w-20 h-20 object-contain"
                      style={{ mixBlendMode: 'multiply' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <p>Generated on: {new Date(reportData.generatedDate).toLocaleString('en-GB')}</p>
                <p className="mt-1">This is an official document from {brandingSettings?.schoolName || 'ACADEMIC SCHOOL'}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FormativeReport;
