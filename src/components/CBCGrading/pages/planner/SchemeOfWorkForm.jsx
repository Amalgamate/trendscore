import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermissions } from '../../../../hooks/usePermissions';
import api from '../../../../services/api';
import { Card } from '../../../../components/ui/card';
import { ArrowLeft, Save, Send, AlertCircle, Plus, Trash2, Printer, CheckCircle, XOctagon, FileText, Upload, FileSpreadsheet, FileType2, FileImage, Sparkles } from 'lucide-react';
import {
  parseExcelScheme,
  parseDocxSchemeText,
  parsePdfSchemeText,
  buildWeeksFromUnstructuredText,
} from '../../../../utils/schemeImportParser';

const WEEKS_IN_TERM = 14; 
// Pre-populate empty rows up to the standard 14 weeks. Additional can be added if needed.

const generateEmptyWeeks = () => {
  return Array.from({ length: WEEKS_IN_TERM }, (_, i) => ({
    weekNumber: i + 1,
    strand: '',
    subStrand: '',
    outcomes: '',
    inquiryQuestions: '',
    activities: '',
    coreCompetencies: '',
    values: '',
    pertinentIssues: '',
    resources: '',
    assessment: '',
    remarks: ''
  }));
};

const SchemeOfWorkForm = ({ schemeId, onBack }) => {
  const { user } = useAuth();
  const { isAnyRole } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Data sources for dropdowns
  const [learningAreas, setLearningAreas] = useState([]);
  const [grades, setGrades] = useState([
    'PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9'
  ]);
  
  // Initial / Loaded state
  const [schemeData, setSchemeData] = useState({
    grade: '',
    learningArea: '',
    term: '',
    academicYear: new Date().getFullYear(),
    classId: '',
    title: '',
    status: 'DRAFT',
    weeks: generateEmptyWeeks()
  });

  // Review states (For Head Teacher/Admin)
  const [reviewComment, setReviewComment] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState({
    fileName: '',
    fileType: '',
    rawText: '',
    previewRows: [],
    warning: ''
  });

  const isTeacher = isAnyRole(['TEACHER']);
  const canReview = isAnyRole(['HEAD_TEACHER', 'ADMIN', 'SUPER_ADMIN']);
  const isCreatorOrNew = !schemeId || (schemeData.teacherId === user.id);
  const isEditable = ['DRAFT', 'REJECTED'].includes(schemeData.status)
    && (canReview || (isTeacher && isCreatorOrNew));
  const isReviewable = canReview && schemeId && schemeData.status === 'SUBMITTED';
  const isViewOnly = !isEditable && !isReviewable;

  const STATUS_STEPS = ['DRAFT', 'SUBMITTED', 'APPROVED'];
  const statusIndex = STATUS_STEPS.indexOf(schemeData.status);
  const isRejected = schemeData.status === 'REJECTED';

  const fetchFormDependencies = useCallback(async () => {
    try {
      const [laRes, termRes, gradeRes] = await Promise.all([
        api.config.getLearningAreas(),
        api.config.getTermConfigs(),
        api.config.getGrades(),
      ]);
      setLearningAreas(laRes.data || laRes || []);
      const availableGrades = gradeRes.data || gradeRes || [];
      if (availableGrades.length) {
        setGrades(availableGrades);
        setSchemeData((prev) => ({
          ...prev,
          grade: availableGrades.includes(prev.grade) ? prev.grade : prev.grade.replace(/^GRADE\s+/, '').replace(/^(\d+)$/, 'GRADE_$1'),
        }));
      }

      const terms = termRes.data || termRes || [];
      if (!schemeId) {
        const activeTerm = terms.find(t => t.isActive);
        if (activeTerm) {
          setSchemeData(prev => ({
            ...prev,
            term: activeTerm.term,
            academicYear: activeTerm.academicYear
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching dependencies:', err);
    }
  }, [schemeId]);

  const fetchScheme = useCallback(async () => {
    if (!schemeId) return;
    setLoading(true);
    try {
      const res = await api.schemesOfWork.getById(schemeId);
      if (res.data) {
        const loaded = res.data;
        const mergedWeeks = loaded.weeks.length > 0 ? loaded.weeks : generateEmptyWeeks();
        setSchemeData({ ...loaded, weeks: mergedWeeks });
        setReviewComment(loaded.reviewComment || '');
      }
    } catch (err) {
      setError('Failed to load Scheme of Work');
    } finally {
      setLoading(false);
    }
  }, [schemeId]);

  useEffect(() => {
    fetchFormDependencies();
    fetchScheme();
  }, [fetchFormDependencies, fetchScheme]);

  const updateHeaderField = (field, value) => {
    if (!isEditable) return;
    setSchemeData(prev => ({ ...prev, [field]: value }));
  };

  const updateWeekRow = (index, field, value) => {
    if (!isEditable) return;
    setSchemeData(prev => {
      const newWeeks = [...prev.weeks];
      newWeeks[index] = { ...newWeeks[index], [field]: value };
      return { ...prev, weeks: newWeeks };
    });
  };

  const addWeek = () => {
    if (!isEditable) return;
    setSchemeData(prev => ({
      ...prev,
      weeks: [...prev.weeks, {
        weekNumber: prev.weeks.length + 1,
        strand: '', subStrand: '', outcomes: '', inquiryQuestions: '',
        activities: '', coreCompetencies: '', values: '', pertinentIssues: '',
        resources: '', assessment: '', remarks: ''
      }]
    }));
  };

  const removeWeek = (index) => {
    if (!isEditable) return;
    setSchemeData(prev => {
      const newWeeks = prev.weeks.filter((_, i) => i !== index);
      // Reindex
      newWeeks.forEach((w, i) => w.weekNumber = i + 1);
      return { ...prev, weeks: newWeeks };
    });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImporting(true);
    try {
      const fileName = file.name || 'Uploaded file';
      const lowerName = fileName.toLowerCase();
      const mime = String(file.type || '').toLowerCase();

      if (
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.csv') ||
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('csv')
      ) {
        const parsed = await parseExcelScheme(file);
        setImportPreview({
          fileName,
          fileType: 'excel',
          rawText: parsed.rawText,
          previewRows: parsed.previewRows || [],
          warning: parsed.warning || '',
        });

        if (parsed.rows?.length) {
          setSchemeData((prev) => ({ ...prev, weeks: parsed.rows }));
        }
        return;
      }

      if (
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.doc') ||
        mime.includes('wordprocessingml') ||
        mime.includes('msword')
      ) {
        const rawText = await parseDocxSchemeText(file);
        setImportPreview({
          fileName,
          fileType: 'word',
          rawText,
          previewRows: [],
          warning: '',
        });
        setSchemeData((prev) => ({ ...prev, weeks: buildWeeksFromUnstructuredText(rawText) }));
        return;
      }

      if (lowerName.endsWith('.pdf') || mime.includes('pdf')) {
        const rawText = await parsePdfSchemeText(file);
        setImportPreview({
          fileName,
          fileType: 'pdf',
          rawText,
          previewRows: [],
          warning: '',
        });
        setSchemeData((prev) => ({ ...prev, weeks: buildWeeksFromUnstructuredText(rawText) }));
        return;
      }

      throw new Error('Unsupported file type. Use Word, PDF, or Excel files.');
    } catch (err) {
      setImportError(err?.message || 'Unable to import this file.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const getImportIcon = () => {
    if (importPreview.fileType === 'excel') return <FileSpreadsheet size={16} className="text-emerald-600" />;
    if (importPreview.fileType === 'pdf') return <FileImage size={16} className="text-rose-600" />;
    if (importPreview.fileType === 'word') return <FileType2 size={16} className="text-blue-600" />;
    return <Upload size={16} className="text-brand-teal" />;
  };

  const handleSave = async (submit = false) => {
    setError('');
    
    // Basic validation
    if (!schemeData.grade || !schemeData.learningArea || !schemeData.term) {
      setError('Grade, Learning Area, and Term are required.');
      window.scrollTo(0, 0);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...schemeData,
        status: submit ? 'SUBMITTED' : schemeData.status,
        academicYear: Number(schemeData.academicYear)
      };

      if (schemeId) {
        await api.schemesOfWork.update(schemeId, payload);
      } else {
        await api.schemesOfWork.create(payload);
      }
      
      onBack();
    } catch (err) {
      setError(err.message || 'Failed to save Scheme of Work');
      window.scrollTo(0, 0);
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (status) => {
    setSaving(true);
    try {
      await api.schemesOfWork.review(schemeId, { status, remarks: reviewComment });
      onBack();
    } catch (err) {
      setError(err.message || `Failed to ${status} Scheme of Work`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20 print:p-0 print:m-0 print:block">
      
      {/* --- Sticky Print Navbar --- */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex flex-wrap justify-between items-center gap-4 print:hidden shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-medium text-gray-800">
            {schemeId ? `${isViewOnly ? 'View' : 'Edit'} Scheme of Work` : 'New Scheme of Work'}
          </h2>
          {schemeData.status && (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border 
              ${schemeData.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                schemeData.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200' :
                schemeData.status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-200' :
                'bg-gray-100 text-gray-800 border-gray-200'}`}
            >
              {schemeData.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            <Printer size={18} />
            Print / PDF
          </button>
          
          {isEditable && (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-brand-teal bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition font-medium disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white bg-brand-teal rounded-lg hover:bg-teal-700 transition font-medium shadow-sm disabled:opacity-50"
              >
                <Send size={18} />
                Submit for Approval
              </button>
            </>
          )}

          {isReviewable && (
            <>
              <button
                onClick={() => handleReview('REJECTED')}
                disabled={saving || !reviewComment.trim()}
                className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition font-medium disabled:opacity-50"
                title={!reviewComment.trim() ? "Add a comment before rejecting" : ""}
              >
                <XOctagon size={18} />
                Reject
              </button>
              <button
                onClick={() => handleReview('APPROVED')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition font-medium shadow-sm disabled:opacity-50"
              >
                <CheckCircle size={18} />
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3 print:hidden">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="px-6 print:hidden">
        <Card className="p-4 border border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-widest font-semibold text-gray-500">Approval Progress</span>
            {STATUS_STEPS.map((step, index) => {
              const isActive = !isRejected && statusIndex >= index;
              return (
                <React.Fragment key={step}>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      isActive
                        ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/30'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {step === 'SUBMITTED' ? 'PENDING APPROVAL' : step}
                  </span>
                  {index < STATUS_STEPS.length - 1 && (
                    <span className="text-gray-300 text-xs">-&gt;</span>
                  )}
                </React.Fragment>
              );
            })}
            {isRejected && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200">
                REJECTED (ACTION REQUIRED)
              </span>
            )}
          </div>
          {schemeData.reviewedAt && (
            <p className="mt-2 text-xs text-gray-500">
              Last review: {new Date(schemeData.reviewedAt).toLocaleString()}
            </p>
          )}
        </Card>
      </div>

      {/* --- Print Header --- */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-8">
        <h1 className="text-2xl font-medium uppercase tracking-wider mb-2">Scheme of Work</h1>
        <div className="flex justify-center gap-8 text-sm font-semibold">
          <span>Teacher: {schemeData.teacher?.firstName || user.firstName} {schemeData.teacher?.lastName || user.lastName}</span>
          <span>Subject: {schemeData.learningArea}</span>
          <span>Grade: {schemeData.grade}</span>
          <span>Term: {String(schemeData.term || '').replace(/^TERM_(\d+)$/, 'Term $1')} - {schemeData.academicYear}</span>
        </div>
      </div>

      <div className="px-6 print:px-0">
        
        {/* --- Setup Metadata Card --- */}
        <Card className="p-6 mb-8 print:hidden border-t-4 border-t-brand-teal shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText size={20} className="text-brand-teal" />
            Scheme Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Learning Area <span className="text-red-500">*</span></label>
              <select
                disabled={!isEditable}
                value={schemeData.learningArea}
                onChange={(e) => updateHeaderField('learningArea', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-gray-100 disabled:text-gray-600 font-medium"
              >
                <option value="">Select subject...</option>
                {learningAreas.map(la => (
                  <option key={la.id} value={la.name}>{la.name}</option>
                ))}
                {!learningAreas.length && schemeData.learningArea && <option value={schemeData.learningArea}>{schemeData.learningArea}</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level <span className="text-red-500">*</span></label>
              <select
                disabled={!isEditable}
                value={schemeData.grade}
                onChange={(e) => updateHeaderField('grade', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-gray-100 disabled:text-gray-600 font-medium"
              >
                <option value="">Select grade...</option>
                {grades.map(g => (
                  <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term & Year <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  disabled={!isEditable}
                  value={schemeData.term}
                  onChange={(e) => updateHeaderField('term', e.target.value)}
                  className="w-3/5 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-gray-100 disabled:text-gray-600 font-medium"
                >
                  <option value="">Term...</option>
                  <option value="TERM_1">Term 1</option>
                  <option value="TERM_2">Term 2</option>
                  <option value="TERM_3">Term 3</option>
                </select>
                <input
                  type="number"
                  disabled={!isEditable}
                  value={schemeData.academicYear}
                  onChange={(e) => updateHeaderField('academicYear', e.target.value)}
                  className="w-2/5 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-gray-100 disabled:text-gray-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title / Remarks (Optional)</label>
              <input
                type="text"
                disabled={!isEditable}
                placeholder="e.g. Adapted for Term 2"
                value={schemeData.title || ''}
                onChange={(e) => updateHeaderField('title', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-gray-100 disabled:text-gray-600"
              />
            </div>

          </div>
        </Card>

        {isEditable && (
          <Card className="p-6 mb-8 print:hidden border border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Upload size={18} className="text-brand-teal" />
                  Import Existing Scheme
                </h3>
                <p className="text-sm text-gray-500">
                  Import from Word, PDF, or Excel. Parsed content is previewed and mapped into weekly rows.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white hover:bg-teal-700 transition cursor-pointer">
                <Upload size={16} />
                {importing ? 'Reading File...' : 'Import File'}
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,.xls,.xlsx,.csv"
                  onChange={handleImportFile}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </div>

            {importError && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                {importError}
              </div>
            )}

            {importPreview.fileName && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  {getImportIcon()}
                  Preview: {importPreview.fileName}
                </div>
                {importPreview.warning && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                    {importPreview.warning}
                  </div>
                )}

                {importPreview.previewRows?.length > 0 ? (
                  <div className="overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <tbody>
                        {importPreview.previewRows.map((row, rowIdx) => (
                          <tr key={`preview-row-${rowIdx}`}>
                            {row.map((cell, cellIdx) => (
                              <td key={`preview-cell-${rowIdx}-${cellIdx}`} className="px-2 py-1 text-gray-700">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="max-h-56 overflow-auto text-xs whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700">
                    {importPreview.rawText || 'No text extracted from this file.'}
                  </pre>
                )}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 mb-8 print:hidden border border-blue-200 bg-blue-50/60">
          <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2 mb-2">
            <Sparkles size={18} />
            Recommended Scheme Template (Institution Standard)
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            Common institutional template includes: Week, Strand, Sub-strand, Specific Learning Outcomes, Key Inquiry Questions,
            Learning Experiences, Learning Resources, Assessment, and Reflection/Remarks. CBC institutions also include Core Competencies,
            Values, and Pertinent & Contemporary Issues (PCIs).
          </p>
          <div className="text-xs text-blue-900 font-medium">
            Tip: Use clear week-by-week rows in your source file for best import accuracy.
          </div>
        </Card>

        {/* --- Admin Review Section --- */}
        {(isReviewable || schemeData.status === 'REJECTED' || (schemeData.status === 'APPROVED' && schemeData.reviewComment)) && (
          <Card className={`p-6 mb-8 print:hidden ${isReviewable ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : 'bg-gray-50'}`}>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Reviewer Comments</h3>
            <textarea
              disabled={!isReviewable}
              placeholder={isReviewable ? "Add constructive feedback or reasons for rejection here..." : "No comments left."}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none disabled:bg-white disabled:text-gray-800 min-h-[100px]"
            />
          </Card>
        )}


        {/* --- The Grid --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full overflow-x-auto print:shadow-none print:border-none">
          <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
            <thead>
              <tr className="bg-gray-800 text-white text-xs tracking-wider border-b border-gray-900 print:bg-gray-200 print:text-black print:border-black">
                <th className="w-12 py-3 px-2 text-center">Wk</th>
                <th className="w-32 py-3 px-3">Strand</th>
                <th className="w-32 py-3 px-3">Sub-Strand</th>
                <th className="w-48 py-3 px-3">Specific Learning Outcomes</th>
                <th className="w-40 py-3 px-3">Key Inquiry Questions</th>
                <th className="w-48 py-3 px-3">Learning Experiences</th>
                <th className="w-32 py-3 px-3">Core Competencies</th>
                <th className="w-32 py-3 px-3">Values & Pertinent Issues</th>
                <th className="w-40 py-3 px-3">Resources</th>
                <th className="w-32 py-3 px-3">Assessment</th>
                <th className="w-32 py-3 px-3">Remarks</th>
                {isEditable && <th className="w-12 py-3 px-2 print:hidden"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schemeData.weeks.map((week, idx) => (
                <tr key={idx} className="group hover:bg-teal-50/30 transition-colors print:hover:bg-transparent">
                  <td className="py-2 px-2 text-center font-medium text-gray-500 bg-gray-50 border-r border-gray-200 print:bg-transparent print:border-black align-top">
                    {week.weekNumber}
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.strand || ''} 
                      onChange={(e) => updateWeekRow(idx, 'strand', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.subStrand || ''} 
                      onChange={(e) => updateWeekRow(idx, 'subStrand', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.outcomes || ''} 
                      placeholder="By the end of the lesson..."
                      onChange={(e) => updateWeekRow(idx, 'outcomes', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.inquiryQuestions || ''} 
                      onChange={(e) => updateWeekRow(idx, 'inquiryQuestions', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.activities || ''} 
                      onChange={(e) => updateWeekRow(idx, 'activities', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.coreCompetencies || ''} 
                      onChange={(e) => updateWeekRow(idx, 'coreCompetencies', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={(week.values ? week.values + '\n' : '') + (week.pertinentIssues || '')} 
                      onChange={(e) => {
                        // Just map it all to 'values' for simplicity, or split appropriately. Let's map to values.
                        updateWeekRow(idx, 'values', e.target.value);
                      }}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.resources || ''} 
                      onChange={(e) => updateWeekRow(idx, 'resources', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-200 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.assessment || ''} 
                      onChange={(e) => updateWeekRow(idx, 'assessment', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  <td className="p-0 print:border-black align-top">
                    <textarea 
                      disabled={!isEditable}
                      value={week.remarks || ''} 
                      onChange={(e) => updateWeekRow(idx, 'remarks', e.target.value)}
                      className="w-full h-full min-h-[80px] p-2 text-sm outline-none resize-y bg-transparent disabled:text-gray-900 print:resize-none"
                    />
                  </td>
                  
                  {isEditable && (
                    <td className="p-2 align-middle text-center print:hidden border-l border-gray-100">
                      <button 
                        onClick={() => removeWeek(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove Week"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {isEditable && (
            <div className="bg-gray-50 p-4 border-t border-gray-200 print:hidden text-center">
              <button 
                onClick={addWeek}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Plus size={16} /> Add Week
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemeOfWorkForm;
