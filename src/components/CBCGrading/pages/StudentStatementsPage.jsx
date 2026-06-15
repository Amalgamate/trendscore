/**
 * Student Fee Statements Page
 * Generate and view individual student fee statements
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Search, User,
  CheckCircle, AlertCircle, Clock, Printer, Mail, Eye, Loader2, Filter, X, RefreshCw, MapPin, Phone
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

const StudentStatementsPage = () => {
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
        showError('Failed to load students');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLearners();
  }, [showError, isSecondaryPortal, isSecondaryGrade]);

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
    setSelectedLearner(learner);
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
      const result = await generateStatementPDF(selectedLearner, invoices, payments, {
        elementId: 'statement-content',
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

  if (loading && !showStatement) return <LoadingSpinner />;

  return (
    <div className="space-y-6">

      {!showStatement ? (
        <>
          {/* Top Row: Omni-Search & Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-end w-full">
            {/* Search */}
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

            {/* Unified Filter Button */}
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

              {/* Filter Popover Drawer */}
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

          {/* Students List */}
          {filteredLearners.length === 0 ? (
            <EmptyState
              icon={User}
              title="No Students Found"
              message={searchTerm ? "No students match your search." : "No active students found."}
            />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
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
          )}
        </>
      ) : (
        // Statement View
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowStatement(false);
                  setSelectedLearner(null);
                  setInvoices([]);
                  setPayments([]);
                }}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition"
              >
                ← Back to Students
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintStatement}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  onClick={handleDownloadStatement}
                  disabled={pdfGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {pdfGenerating ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                  onClick={handleEmailStatement}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Mail size={14} />
                  Email
                </button>
              </div>
            </div>
            {pdfProgress && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-semibold">PDF status:</span> {pdfProgress}
              </div>
            )}
          </div>

          {/* Statement Layout Container */}
          <div 
            id="statement-content" 
            className="bg-white mx-auto shadow-2xl overflow-hidden report-card"
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


          {/* Footer Note */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-0.5">Note:</p>
            <p>This is an official fee statement. For any inquiries or discrepancies, please contact the accounts office.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentStatementsPage;
