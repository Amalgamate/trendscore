/**
 * Student Fee Statements Page
 * Generate and view individual student fee statements
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Search, User,
  CheckCircle, AlertCircle, Clock, Printer, Mail, Eye, Loader2, Filter, RefreshCw, MapPin, Phone
} from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../shared/LoadingSpinner';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import { generateStatementPDF } from '../../../utils/simplePdfGenerator';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useAuth } from '../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../services/schoolContext';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

const normalizeParentLearner = (child) => {
  const parts = String(child?.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    ...child,
    firstName: child?.firstName || parts[0] || '',
    lastName: child?.lastName || parts.slice(1).join(' ') || '',
    stream: child?.stream || child?.className || '',
    parentName: child?.parentName || child?.guardianName || 'Parent/Guardian',
    parentPhone: child?.parentPhone || child?.guardianPhone || '',
    parentEmail: child?.parentEmail || child?.guardianEmail || '',
  };
};

const getLearnerPhoto = (learner) => learner?.photoUrl || learner?.profilePicture || learner?.photo || learner?.imageUrl || null;

const StudentStatementsPage = ({ parentMode = false, initialLearner = null, onNavigate = null }) => {
  const [learners, setLearners] = useState([]);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const [showStatement, setShowStatement] = useState(false);

  const activeFilterCount = filterGrade !== 'all' ? 1 : 0;
  const clearAllFilters = () => setFilterGrade('all');
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const { showSuccess, showError } = useNotifications();
  const { grades: fetchedGrades } = useSchoolData();
  const { user } = useAuth();
  const selectedInstitutionType = String(getSelectedInstitutionType() || user?.institutionType || '').toUpperCase();
  const isSecondaryPortal = selectedInstitutionType === 'SECONDARY' || selectedInstitutionType === 'HIGH_SCHOOL';
  const isSecondaryGrade = React.useCallback((gradeValue) => {
    const g = String(gradeValue || '').trim().toUpperCase().replace(/\s+/g, '_');
    return g.startsWith('FORM') || ['GRADE_10', 'GRADE_11', 'GRADE_12', 'GRADE10', 'GRADE11', 'GRADE12'].includes(g);
  }, []);

  useEffect(() => {
    const fetchLearners = async () => {
      try {
        setLoading(true);
        if (parentMode) {
          const metricsRes = await api.dashboard.getParentMetrics();
          const children = (metricsRes?.data?.children || []).map(normalizeParentLearner);
          setLearners(children);

          try {
            const schoolRes = await api.school.getAll();
            const schoolData = schoolRes.data?.data || schoolRes.data?.[0] || schoolRes.data || schoolRes;
            if (schoolData) {
              setSchoolInfo({
                name: schoolData.name || schoolData.schoolName || `${PRODUCT_DISPLAY_NAME} Academy`,
                motto: schoolData.motto || '',
                address: schoolData.address || '',
                phone: schoolData.phone || '',
                email: schoolData.email || '',
                logoUrl: schoolData.logoUrl || '/branding/logo.png'
              });
            }
          } catch (schoolErr) {
            console.warn('Failed to load school branding, using defaults:', schoolErr);
          }

          if (initialLearner?.id) {
            const matched = children.find((child) => child.id === initialLearner.id) || normalizeParentLearner(initialLearner);
            setSelectedLearner(matched);
            await fetchLearnerStatement(matched.id);
          }
          return;
        }

        // 1. Load learners (Essential)
        const learnersRes = await api.learners.getAll({ status: 'ACTIVE' });
        const rows = Array.isArray(learnersRes.data) ? learnersRes.data : [];
        setLearners(rows.filter((learner) => {
          const learnerIsSecondary = isSecondaryGrade(learner?.grade);
          return isSecondaryPortal ? learnerIsSecondary : !learnerIsSecondary;
        }));

        // 2. Load school info (Optional/Non-blocking)
        try {
          const schoolRes = await api.school.getAll();
          const schoolData = schoolRes.data?.data || schoolRes.data?.[0] || schoolRes.data || schoolRes;
          if (schoolData) {
            setSchoolInfo({
              name: schoolData.name || schoolData.schoolName || `${PRODUCT_DISPLAY_NAME} Academy`,
              motto: schoolData.motto || '',
              address: schoolData.address || '',
              phone: schoolData.phone || '',
              email: schoolData.email || '',
              logoUrl: schoolData.logoUrl || '/branding/logo.png'
            });
          }
        } catch (schoolErr) {
          console.warn('Failed to load school branding, using defaults:', schoolErr);
          // Fallback to basic defaults already in state or handled by optional chaining
        }
      } catch (error) {
        showError(parentMode ? 'Failed to load your children' : 'Failed to load students');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLearners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError, isSecondaryPortal, isSecondaryGrade, parentMode, initialLearner?.id]);

  const fetchLearnerStatement = async (learnerId) => {
    try {
      setLoading(true);
      const invoicesResponse = await api.fees.getLearnerInvoices(learnerId);
      setInvoices(invoicesResponse.data || []);

      // Extract all payments from invoices
      const allPayments = [];
      invoicesResponse.data?.forEach(invoice => {
        invoice.payments?.forEach(payment => {
          allPayments.push({
            ...payment,
            invoiceNumber: invoice.invoiceNumber,
            feeType: invoice.feeStructure?.name
          });
        });
      });
      setPayments(allPayments);
      setShowStatement(true);
    } catch (error) {
      showError('Failed to load statement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatement = (learner) => {
    setSelectedLearner(parentMode ? normalizeParentLearner(learner) : learner);
    fetchLearnerStatement(learner.id);
  };

  const handlePrintStatement = async () => {
    try {
      showSuccess('Opening print preview...');
      const { printWindow } = await import('../../../utils/simplePdfGenerator');
      const result = await printWindow('statement-content');
      if (!result.success) throw new Error(result.error || 'Failed to open print preview');
    } catch (error) {
      showError('Failed to generate print preview');
      console.error(error);
    }
  };

  const handleDownloadStatement = async () => {
    if (!selectedLearner) return;
    try {
      setPdfGenerating(true);
      setPdfProgress('Starting PDF generation...');
      const filename = `Statement_${selectedLearner?.firstName}_${selectedLearner?.lastName}_${new Date().getFullYear()}.pdf`;
      const elementId = window.innerWidth < 768 ? 'mobile-statement-content' : 'statement-content';
      const result = await generateStatementPDF(selectedLearner, invoices, payments, {
        elementId,
        fileName: filename,
        onProgress: (message) => {
          setPdfProgress(message);
        }
      });
      if (result.success) {
        showSuccess('Statement downloaded successfully');
        setPdfProgress('Download complete');
      } else {
        throw new Error(result.error || 'Failed to generate PDF');
      }
    } catch (error) {
      showError('Failed to download statement');
      setPdfProgress('Failed to generate PDF');
      console.error(error);
    } finally {
      setPdfGenerating(false);
      window.setTimeout(() => setPdfProgress(''), 3000);
    }
  };

  const handleEmailStatement = async () => {
    if (!selectedLearner) return;
    try {
      showSuccess('Preparing statement for email...');
      // Capture the statement DOM element as a PNG and convert to base64 for the email API
      const { captureElement } = await import('../../../utils/simplePdfGenerator');
      const el = document.getElementById('statement-content');
      if (!el) throw new Error('Statement element not found');
      const canvas = await captureElement(el);
      const base64data = canvas.toDataURL('image/png');
      showSuccess('Sending email...');
      await api.fees.emailStatement(selectedLearner.id, { pdfBase64: base64data });
      showSuccess('Statement sent successfully');
    } catch (error) {
      console.error('Failed to prepare statement:', error);
      showError(error.message || 'Failed to prepare statement for emailing');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      PARTIAL: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'Partial' },
      PAID: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Paid' },
      OVERPAID: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Overpaid' },
      WAIVED: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Waived' }
    };
    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon size={14} />
        {badge.label}
      </span>
    );
  };

  const filteredLearners = learners.filter(learner => {
    const fullName = `${learner.firstName} ${learner.lastName}`.toLowerCase();
    const admNo = (learner.admissionNumber || learner.admNo || '').toString().toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();

    const matchesSearch = fullName.includes(lowerTerm) || admNo.includes(lowerTerm);
    const matchesGrade = filterGrade === 'all' || learner.grade === filterGrade;
    return matchesSearch && matchesGrade;
  });

  const calculateTotals = () => {
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalBalance = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
    return { totalAmount, totalPaid, totalBalance };
  };
  const hasStatementRows = invoices.length > 0;
  const statementTotals = calculateTotals();

  if (loading && !showStatement) return <LoadingSpinner />;

  return (
    <div className="space-y-6">

      {!showStatement ? (
        <>
          {parentMode && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onNavigate?.('parent-portal-home')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm active:scale-[0.98]"
              >
                ← Back
              </button>
              <h1 className="text-base font-bold text-gray-900">Student Statements</h1>
            </div>
          )}

          {!parentMode && (
            <div className="flex flex-col md:flex-row gap-3 items-end w-full">
              <div className="flex-[2] w-full relative z-40">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search learners by name or adm no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowGlobalFilters(!showGlobalFilters)}
                  className={`px-5 py-2.5 border rounded-xl font-medium flex items-center gap-2 transition-all ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50 text-gray-700 bg-white shadow-sm'}`}
                >
                  <Filter size={18} className={activeFilterCount > 0 ? "text-blue-600" : "text-gray-500"} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] ml-1">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showGlobalFilters && (
                  <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in origin-top-right">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <Filter size={16} className="text-blue-600" /> Learner Filters
                      </h3>
                      {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className="text-[11px] font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors">
                          Clear All
                        </button>
                      )}
                    </div>

                    <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      <div>
                        <h4 className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest mb-3">Academic Context</h4>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600">Grade Level</label>
                          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm w-full outline-blue-500">
                            <option value="all">All Grades</option>
                            {fetchedGrades.map(g => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button onClick={() => setShowGlobalFilters(false)} className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
                        Apply & Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Students List */}
          {filteredLearners.length === 0 ? (
            <EmptyState
              icon={User}
              title="No Students Found"
              message={searchTerm ? "No students match your search." : "No active students found."}
            />
          ) : (
            <>
            <div className="md:hidden space-y-3">
              {filteredLearners.map((learner) => (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => handleViewStatement(learner)}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] transition"
                >
                  <div className="flex items-start gap-3">
                    {getLearnerPhoto(learner) ? (
                      <img
                        src={getLearnerPhoto(learner)}
                        alt={`${learner.firstName} ${learner.lastName}`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-sm flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div
                      style={{ display: getLearnerPhoto(learner) ? 'none' : 'flex' }}
                      className="w-10 h-10 bg-blue-50 border-2 border-blue-500 rounded-full items-center justify-center flex-shrink-0"
                    >
                      <User className="text-blue-600" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        {learner.firstName} {learner.lastName}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <p className="font-bold text-gray-400 uppercase">Class</p>
                          <p className="font-semibold text-gray-800">{learner.grade} {learner.stream}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-400 uppercase">Admission</p>
                          <p className="font-semibold text-gray-800">{learner.admissionNumber || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-blue-600 font-bold text-xs pt-1">View</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full border-collapse">
                <thead className="border-b border-[color:var(--table-border)]">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Student</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Grade</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Admission No.</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLearners.map((learner) => (
                    <tr key={learner.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          {getLearnerPhoto(learner) ? (
                            <img
                              src={getLearnerPhoto(learner)}
                              alt={`${learner.firstName} ${learner.lastName}`}
                              className="w-8 h-8 rounded-full object-cover border border-blue-500 shadow-sm"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div
                            style={{ display: getLearnerPhoto(learner) ? 'none' : 'flex' }}
                            className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center"
                          >
                            <User className="text-blue-600" size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-xs">
                              {learner.firstName} {learner.lastName}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {learner.parentName || 'No parent linked'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-xs text-gray-600">
                        {learner.grade} {learner.stream}
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-medium text-gray-900">
                        {learner.admissionNumber || 'N/A'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-100">
                        <button
                          onClick={() => handleViewStatement(learner)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs"
                        >
                          <Eye size={14} />
                          View Statement
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      ) : (
        // Statement View
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="bg-white rounded-lg shadow p-3 sticky top-0 z-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                onClick={() => {
                  setShowStatement(false);
                  setSelectedLearner(null);
                  setInvoices([]);
                  setPayments([]);
                  if (parentMode && learners.length <= 1 && onNavigate) onNavigate('dashboard');
                }}
                className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50 transition self-start"
              >
                {parentMode && learners.length <= 1 ? '← Back to Dashboard' : '← Back to Students'}
              </button>
              <div className="grid grid-cols-1 sm:flex sm:items-center gap-2">
                <button
                  onClick={handlePrintStatement}
                  disabled={!hasStatementRows}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  onClick={handleDownloadStatement}
                  disabled={pdfGenerating || !hasStatementRows}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {pdfGenerating ? 'Generating…' : 'Download PDF'}
                </button>
                {!parentMode && (
                  <button
                    onClick={handleEmailStatement}
                    disabled={!hasStatementRows}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail size={14} />
                    Email
                  </button>
                )}
              </div>
            </div>
            {pdfProgress && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-semibold">PDF status:</span> {pdfProgress}
              </div>
            )}
          </div>

          {!hasStatementRows ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center shadow-sm">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <FileText size={22} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">No fee statement available yet</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                {selectedLearner?.firstName || 'This student'} does not have any fee invoices or statement records at the moment.
                Once the school posts an invoice, the statement will appear here automatically.
              </p>
            </div>
          ) : (
            <>
          <div id="mobile-statement-content" className="md:hidden space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl border border-gray-100 bg-gray-50 p-2 flex items-center justify-center flex-shrink-0">
                  <img src={schoolInfo?.logoUrl || '/branding/logo.png'} alt="School Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Fee Statement</p>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight mt-1">{schoolInfo?.name || `${PRODUCT_DISPLAY_NAME} Academy`}</h1>
                  <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-sm font-bold text-gray-900">
                  {selectedLearner?.firstName} {selectedLearner?.lastName}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="font-bold text-gray-400 uppercase">Admission</p>
                    <p className="font-semibold text-gray-800">{selectedLearner?.admissionNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-400 uppercase">Class</p>
                    <p className="font-semibold text-gray-800">{selectedLearner?.grade} {selectedLearner?.stream}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Total Invoiced</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">KES {statementTotals.totalAmount.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Paid</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">KES {statementTotals.totalPaid.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Balance</p>
                  <p className="text-lg font-bold text-rose-700 mt-1">KES {statementTotals.totalBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Invoices</h2>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900">{invoice.invoiceNumber}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{invoice.feeStructure?.name || 'Fee invoice'}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{invoice.feeStructure?.term || 'Current term'}</p>
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-right">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Amount</p>
                        <p className="text-xs font-bold text-gray-800">{Number(invoice.totalAmount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Paid</p>
                        <p className="text-xs font-bold text-emerald-600">{Number(invoice.paidAmount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Balance</p>
                        <p className="text-xs font-bold text-rose-600">{Number(invoice.balance).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Payments</h2>
              {payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-xs font-medium text-gray-400">
                  No payments recorded for this statement.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900">{payment.invoiceNumber}</p>
                        <p className="text-[11px] text-gray-500">{new Date(payment.paymentDate).toLocaleDateString()} · {payment.paymentMethod}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-600">KES {Number(payment.amount).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Statement Layout Container */}
          <div 
            id="statement-content" 
            className="hidden md:block bg-white mx-auto shadow-2xl overflow-hidden report-card"
            style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}
          >
            {/* Header / Letterhead */}
            <div className="flex justify-between items-start border-b-2 border-blue-900 pb-6 mb-8">
              <div className="flex gap-6 items-center">
                <div className="w-36 h-36 bg-gray-50 rounded-xl p-3 flex items-center justify-center border border-gray-100 shadow-sm">
                  <img src={schoolInfo?.logoUrl || '/branding/logo.png'} alt="School Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-blue-900 uppercase tracking-tight">{schoolInfo?.name}</h1>
                  {schoolInfo?.motto && <p className="text-blue-600 italic text-sm font-medium mt-1">"{schoolInfo.motto}"</p>}
                  <div className="mt-4 space-y-1 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    {schoolInfo?.address && <div className="flex items-center gap-2"><MapPin size={14} className="text-blue-500" /> {schoolInfo.address}</div>}
                    <div className="flex gap-4">
                      {schoolInfo?.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-blue-500" /> {schoolInfo.phone}</div>}
                      {schoolInfo?.email && <div className="flex items-center gap-2"><Mail size={14} className="text-blue-500" /> {schoolInfo.email}</div>}
                      {schoolInfo?.kraPin && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> KRA PIN: {schoolInfo.kraPin}</div>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-blue-900 text-white px-4 py-2 rounded-lg inline-block mb-3">
                  <h2 className="text-lg font-semibold uppercase tracking-widest">Fee Statement</h2>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-gray-400 font-medium uppercase">Academic Year</p>
                  <p className="font-semibold text-gray-800 text-sm tracking-tighter">{new Date().getFullYear()}</p>
                  <p className="text-[10px] text-gray-400 font-medium uppercase mt-2">Statement Date</p>
                  <p className="font-semibold text-gray-800 text-sm tracking-tighter">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Student Information */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">Student Details</h3>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-semibold">
                      {selectedLearner?.firstName} {selectedLearner?.lastName}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Admission No:</span>
                    <span className="ml-2 font-semibold">{selectedLearner?.admissionNumber}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Grade:</span>
                    <span className="ml-2 font-semibold">
                      {selectedLearner?.grade} {selectedLearner?.stream}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">Parent/Guardian Details</h3>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-semibold">{selectedLearner?.parentName || 'N/A'}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 font-semibold">{selectedLearner?.parentPhone || 'N/A'}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-semibold">{selectedLearner?.parentEmail || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Cards with Premium Styling */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 border-t-4 border-blue-600 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1 text-center">Total Invoiced</p>
                <p className="text-2xl font-semibold text-blue-900 text-center">
                  <span className="text-xs font-medium mr-1 italic text-blue-400">KES</span>
                  {calculateTotals().totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 border-t-4 border-emerald-500 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1 text-center">Total Payments</p>
                <p className="text-2xl font-semibold text-emerald-600 text-center">
                  <span className="text-xs font-medium mr-1 italic text-emerald-400">KES</span>
                  {calculateTotals().totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 border-t-4 border-rose-500 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1 text-center">Outstanding Balance</p>
                <p className="text-2xl font-semibold text-rose-600 text-center">
                  <span className="text-xs font-medium mr-1 italic text-rose-400">KES</span>
                  {calculateTotals().totalBalance.toLocaleString()}
                </p>
                {calculateTotals().totalBalance > 0 && (
                  <p className="text-[9px] text-center text-rose-500 font-semibold uppercase mt-1">Payment Required</p>
                )}
              </div>
            </div>

            {/* Invoices Table with Refined Styling */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                Fee Invoices Breakdown
              </h3>
              <div className="overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100">Inv #</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100">Fee Type</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-center">Term</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-right">Amount</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-right">Paid</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-right">Balance</th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.map((invoice, idx) => (
                      <tr key={invoice.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="px-3 py-1.5 border-r border-gray-100">
                          <div className="text-xs font-semibold text-gray-900">{invoice.invoiceNumber}</div>
                          {invoice.etimsControlCode && (
                            <div className="text-[9px] text-emerald-600 font-medium uppercase tracking-tighter mt-0.5 flex items-center gap-1">
                              <RefreshCw size={8} className="animate-spin-slow" /> eTIMS: {invoice.etimsControlCode}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-medium text-gray-700">{invoice.feeStructure?.name}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-medium text-gray-500 text-center uppercase tracking-tighter">{invoice.feeStructure?.term}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-semibold text-gray-900 text-right">
                          {Number(invoice.totalAmount).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-semibold text-emerald-600 text-right">
                          {Number(invoice.paidAmount).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-semibold text-rose-600 text-right bg-rose-50/20">
                          {Number(invoice.balance).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-center">{getStatusBadge(invoice.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History Section */}
            <div>
              <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                Transaction Record
              </h3>
              {payments.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 py-10 text-center">
                  <p className="text-gray-400 text-xs font-medium italic">No payments recorded for this academic period</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100">Date</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100">Invoice</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-right">Amount</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100 text-center">Method</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase tracking-wider border-r border-gray-100">Reference No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payments.map((payment, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                          <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-medium text-gray-600">
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-semibold text-gray-800">{payment.invoiceNumber}</td>
                          <td className="px-3 py-1.5 border-r border-gray-100 text-xs font-semibold text-emerald-600 text-right bg-emerald-50/10">
                            {Number(payment.amount).toLocaleString()}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-100 text-center">
                             <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-tighter">
                               {payment.paymentMethod}
                             </span>
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-100 text-xs text-gray-500 font-mono tracking-tighter">
                            {payment.referenceNumber || 'INTERNAL'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
            </>
          )}


          {/* Footer Note */}
          {hasStatementRows && <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-0.5">Note:</p>
            <p>This is an official fee statement. For any inquiries or discrepancies, please contact the accounts office.</p>
          </div>}
        </div>
      )}
    </div>
  );
};

export default StudentStatementsPage;
