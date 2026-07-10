/**
 * Termly Report Page
 * Now with PDF Download functionality!
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FileText, Printer, Edit3, User, ArrowRight, MessageSquarePlus } from 'lucide-react';
import { generatePDFWithLetterhead } from '../../../utils/simplePdfGenerator';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import DownloadReportButton from '../shared/DownloadReportButton';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { useLearnerSelection } from '../hooks/useLearnerSelection';
import TermlyReportTemplate from '../templates/TermlyReportTemplate';
import TermlyReportCommentsForm from '../../../pages/assessments/TermlyReportCommentsForm';
import { getAcademicYearOptions } from '../utils/academicYear';

const TermlyReport = ({ learners, brandingSettings, user, pageParams = {} }) => {
  const { showSuccess, showError } = useNotifications();

  // Use centralized hooks for assessment state management
  const setup = useAssessmentSetup({ defaultTerm: 'TERM_1' });

  // Use grades, terms, and selection from setup/selection hooks
  const grades = useMemo(() => setup.grades || [], [setup.grades]);
  const setSelectedGrade = setup.updateGrade;
  const selectedGrade = setup.selectedGrade;
  const setSelectedTerm = setup.updateTerm;
  const selectedTerm = setup.selectedTerm;
  const terms = setup.terms;
  const selectedGradeLabel = selectedGrade
    ? grades.find(g => g.value === selectedGrade)?.label
    : '';
  const learnerSearchPlaceholder = selectedGradeLabel
    ? `Search in ${selectedGradeLabel}...`
    : 'Search all learners...';
  const selection = useLearnerSelection(learners || [], {
    grade: selectedGrade,
    status: ['ACTIVE', 'Active']
  });
  const filteredLearners = selection.filteredLearners;
  const selectedLearnerId = selection.selectedLearnerId;
  const setSelectedLearnerId = selection.selectLearner;
  const selectedLearner = learners?.find(l => l.id === selectedLearnerId);
  const initializedFromParamsRef = useRef(false);

  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'report'
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCommentsForm, setShowCommentsForm] = useState(false);

  useEffect(() => {
    if (initializedFromParamsRef.current) return;
    initializedFromParamsRef.current = true;

    const normalizeGrade = (value) => {
      if (!value) return '';
      return String(value).trim().replace(/\s+/g, '_').toUpperCase();
    };
    const normalizedGrade = normalizeGrade(pageParams?.grade);
    if (normalizedGrade && grades.some(g => normalizeGrade(g.value) === normalizedGrade)) {
      setSelectedGrade(normalizedGrade);
    }

    if (pageParams?.term) {
      const normalizedTerm = String(pageParams.term).trim().replace(/\s+/g, '_').toUpperCase();
      if (terms.some(t => t.value === normalizedTerm)) {
        setSelectedTerm(normalizedTerm);
      }
    }

    if (pageParams?.academicYear && !Number.isNaN(Number(pageParams.academicYear))) {
      setup.setSelectedAcademicYear(Number(pageParams.academicYear));
    }
  }, [grades, pageParams, setSelectedGrade, setSelectedTerm, setup, terms]);

  const fetchReportData = useCallback(async () => {
    if (!selection.selectedLearnerId) return;

    setLoading(true);
    try {
      const response = await api.reports.getTermlyReport(selection.selectedLearnerId, {
        term: setup.selectedTerm,
        academicYear: setup.academicYear
      });

      if (response.success) {
        setReportData(response.data);
        setViewMode('report');
      } else {
        throw new Error(response.message || 'Failed to load report');
      }
    } catch (error) {
      console.error('Error fetching termly report:', error);
      showError(error.message || 'Failed to load termly report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selection.selectedLearnerId, setup.selectedTerm, setup.academicYear, showError]);

  const handleGenerateReport = () => {
    if (selectedLearner) {
      fetchReportData();
    }
  };

  const handleReset = () => {
    setViewMode('setup');
    setSelectedLearnerId('');
    setReportData(null);
  };

  /**
   * Handle PDF Download
   * Generates and downloads the termly report as PDF
   */
  const handleDownloadPDF = async (onProgress) => {
    if (!selectedLearner) {
      showError('Please select a learner first');
      return { success: false, error: 'No learner selected' };
    }
    try {
      // Generate filename
      const filename = `${selectedLearner.firstName}_${selectedLearner.lastName}_${selectedTerm.replace(' ', '_')}_Report.pdf`;
      const schoolInfo = {
        schoolName: user?.school?.name || brandingSettings?.schoolName || '',
        address: user?.school?.location || brandingSettings?.address || 'P.O. Box 1234, Nairobi, Kenya',
        phone: user?.school?.phone || brandingSettings?.phone || '+254 700 000000',
        email: user?.school?.email || brandingSettings?.email || 'info@school.ac.ke',
        website: user?.school?.website || brandingSettings?.website || 'www.school.ac.ke',
        logoUrl: user?.school?.logo || brandingSettings?.logoUrl || '/branding/logo.png',
        brandColor: brandingSettings?.brandColor || '#1e3a8a'
      };
      // Generate PDF from the report content
      const result = await generatePDFWithLetterhead(
        'termly-report-content',
        filename,
        schoolInfo,
        { onProgress }
      );
      if (result.success) {
        showSuccess('Report card downloaded successfully!');
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
  };


  return (
    <div className="space-y-6">

      {/* SETUP VIEW */}
      {viewMode === 'setup' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 max-w-5xl mx-auto mt-8 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-6 text-center bg-slate-50">
            <div className="w-16 h-16 bg-brand-purple/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-purple">
              <FileText size={32} />
            </div>
            <h2 className="text-2xl font-medium text-gray-800">Official Termly Report Card</h2>
            <p className="text-gray-500">Select a learner to generate the official end of term report card</p>
          </div>

          <div className="px-4 md:px-6 py-4 flex flex-wrap justify-center gap-3 items-start">
            <select
              value={selectedGrade || ''}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedLearnerId('');
              }}
              className="h-11 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple outline-none flex-1 md:flex-none md:w-40 min-w-[140px]"
            >
              <option value="">All Grades</option>
              {grades.map(grade => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </select>

            <div className="flex-1 min-w-[260px] md:min-w-[320px]">
              <SmartLearnerSearch
                learners={filteredLearners}
                selectedLearnerId={selectedLearnerId}
                onSelect={setSelectedLearnerId}
                placeholder={learnerSearchPlaceholder}
              />
            </div>

            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="h-11 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple outline-none flex-1 md:flex-none md:w-32 min-w-[120px]"
            >
              {terms.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select
              value={setup.academicYear}
              onChange={(e) => setup.setSelectedAcademicYear(parseInt(e.target.value, 10))}
              className="h-11 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple outline-none flex-1 md:flex-none md:w-28 min-w-[110px]"
            >
              {getAcademicYearOptions().map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>

            <button
              onClick={handleGenerateReport}
              disabled={!selectedLearnerId || loading}
              className="h-11 flex items-center justify-center gap-2 px-6 bg-brand-purple text-white rounded hover:opacity-90 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none min-w-[190px]"
            >
              {loading ? 'Generating...' : 'Generate Report Card'}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* REPORT VIEW */}
      {viewMode === 'report' && reportData && (
        <>
          {/* Compact Context Header - Hidden on Print */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-brand-purple/10 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-20 print:hidden">
            <div className="flex items-center gap-4">
              <div className="bg-brand-purple/10 p-3 rounded-lg text-brand-purple">
                <User size={24} />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 text-lg line-clamp-1">
                  {reportData.learner.firstName} {reportData.learner.lastName}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                  <span>{reportData.learner.admissionNumber}</span>
                  <span className="bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full text-xs">
                    {reportData.term} {reportData.academicYear}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Edit3 size={16} />
                Change
              </button>

              <button
                onClick={() => setShowCommentsForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-semibold text-sm"
                title="Add/Edit teacher comments for this report"
              >
                <MessageSquarePlus size={16} />
                Comments
              </button>

              <DownloadReportButton
                onDownload={handleDownloadPDF}
                label="Save PDF"
                className="px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-brand-teal/90 transition shadow-sm font-semibold text-sm flex items-center gap-2"
              />

              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Print report card"
              >
                <Printer size={20} />
              </button>
            </div>
          </div>

          {/* Report Content - This will be converted to PDF */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* On-Screen Header (Hidden in Print/PDF as Letterhead is added) */}
            <div className="text-white p-4 text-center print:hidden" style={{ backgroundColor: brandingSettings?.brandColor || '#4a0404' }}>
              <h2 className="text-xl font-medium">{brandingSettings?.schoolName || 'ACADEMIC SCHOOL'}</h2>
              <p className="opacity-80 text-sm">Excellence in Competency Based Curriculum</p>
            </div>

            <TermlyReportTemplate reportData={{
              ...reportData,
              schoolName: user?.school?.name || brandingSettings?.schoolName,
              schoolAddress: user?.school?.location || brandingSettings?.address,
              schoolPhone: user?.school?.phone || brandingSettings?.phone,
              schoolEmail: user?.school?.email || brandingSettings?.email,
              logoUrl: brandingSettings?.logoUrl || user?.school?.logo,
              schoolStamp: brandingSettings?.stampUrl || user?.school?.stampUrl,
              brandColor: brandingSettings?.brandColor || reportData.brandColor
            }} />
          </div>
        </>
      )}

      {/* Comments Slide-Over Panel */}
      {showCommentsForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCommentsForm(false)} />
          <div className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
            <TermlyReportCommentsForm
              prefill={{
                learnerId: selectedLearnerId,
                term: selectedTerm,
                academicYear: setup.academicYear
              }}
              onBack={() => setShowCommentsForm(false)}
              onSuccess={() => {
                setShowCommentsForm(false);
                showSuccess('Teacher comments saved successfully!');
                // Re-fetch to display updated comments on the report
                fetchReportData();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TermlyReport;
