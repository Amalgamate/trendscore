import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download, FileDown, FileSpreadsheet, AlertCircle, CheckCircle, Loader, Sparkles, ListChecks } from 'lucide-react';
import axiosInstance, { API_BASE_URL } from '../../../../services/api/axiosConfig';
import { getAuthItem } from '../../../../utils/authStorage';

const MAX_LEARNER_IMPORT_FILES = 20;

const BulkOperationsModal = ({
  isOpen,
  onClose,
  title,
  entityType, // 'learners', 'teachers', 'parents'
  onUploadComplete,
  userRole // Pass user role if needed, though context is now header-based
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // ── Pre-import analysis step (learners only) ──────────────────────────
  // Before the real import runs, we dry-run the file so the admin can see a
  // report of exactly what will happen — how many rows were found, how many
  // are ready to import, and what (if anything) needs fixing — instead of
  // finding out only after something fails.
  const [checkingFile, setCheckingFile] = useState(false);
  const [analysis, setAnalysis] = useState(null); // full /preview response: { summary, nextAdmissionNumberPreview, details }
  const [blockedError, setBlockedError] = useState(null); // set when the file has no recognizable rows at all
  const [numberingStrategy, setNumberingStrategy] = useState('auto'); // 'auto' | 'manual'
  const [numberingStart, setNumberingStart] = useState('');

  if (!isOpen) return null;

  const canUpload = () => files.length > 0;
  const supportsMultipleFiles = entityType === 'learners';
  const isSupportedUploadFile = (selectedFile) => {
    if (!selectedFile) return false;
    const name = selectedFile.name.toLowerCase();
    return (
      selectedFile.type === 'text/csv' ||
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      selectedFile.type === 'application/vnd.ms-excel' ||
      name.endsWith('.csv') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls')
    );
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const addFiles = (selectedFiles) => {
    const allFiles = Array.from(selectedFiles || []);
    const acceptedFiles = allFiles.filter(isSupportedUploadFile);
    const filesToImport = supportsMultipleFiles ? acceptedFiles.slice(0, MAX_LEARNER_IMPORT_FILES) : acceptedFiles.slice(0, 1);
    if (filesToImport.length) {
      setFiles(filesToImport);
      setUploadResult(null);
      setAnalysis(null);
      setBlockedError(null);
      setNumberingStrategy('auto');
      setNumberingStart('');
    }
    if (acceptedFiles.length !== allFiles.length) {
      alert('Only CSV and Excel files can be uploaded.');
    }
    if (supportsMultipleFiles && acceptedFiles.length > MAX_LEARNER_IMPORT_FILES) {
      alert(`You can import up to ${MAX_LEARNER_IMPORT_FILES} learner files at a time. The first ${MAX_LEARNER_IMPORT_FILES} were selected.`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
  };

  const performUpload = async (extraFields = {}) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      const fieldName = supportsMultipleFiles ? 'files' : 'file';
      files.forEach((selectedFile) => formData.append(fieldName, selectedFile));
      Object.entries(extraFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') formData.append(key, value);
      });

      const response = await axiosInstance.post(`/bulk/${entityType}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      const result = response.data;
      setUploadResult(result);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = extractErrorMessage(error.response?.data) || error.message || 'Upload failed. Please try again.';
      setUploadResult({
        success: false,
        error: errorMessage
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!canUpload()) return;

    // Learners: always analyze the file first so the admin sees a report of
    // exactly what will import cleanly and what needs fixing before anything
    // is written to the database.
    if (entityType === 'learners' && !analysis && !blockedError) {
      setCheckingFile(true);
      setBlockedError(null);
      try {
        const previewData = new FormData();
        files.forEach((selectedFile) => previewData.append('files', selectedFile));
        const previewResponse = await axiosInstance.post('/bulk/learners/preview', previewData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setAnalysis(previewResponse.data);
        setCheckingFile(false);
        return; // Wait for the admin to review the report before importing anything.
      } catch (error) {
        const message = extractErrorMessage(error.response?.data);
        setCheckingFile(false);
        if (message) {
          setBlockedError(message);
          return;
        }
        // Unexpected failure (network, 500, etc.) — fall through to the real
        // upload so the admin still gets a result instead of a dead end.
        console.error('File analysis failed:', error);
      }
    }

    await performUpload();
  };

  const getIssueMessage = (issue) => {
    if (!issue) return 'Validation failed';
    if (Array.isArray(issue.error)) return issue.error.map((entry) => entry.message).join('; ');
    if (typeof issue.error === 'string') return issue.error;
    return 'Validation failed';
  };

  // Backend error responses aren't all shaped the same way: route handlers
  // return { error: 'string' }, the rate limiter returns { error: { message } },
  // and the global error handler (auth failures, 5xx, etc.) returns
  // { message, code }. Always reduce whatever comes back to a plain string so
  // it's safe to render directly — an object slipping through here crashes
  // the component ("Objects are not valid as a React child").
  const extractErrorMessage = (data) => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data.error === 'string') return data.error;
    if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') return data.error.message;
    if (typeof data.message === 'string') return data.message;
    return null;
  };

  const handleProceedImport = async () => {
    const hasMissingNumbers = (analysis?.summary?.missingAdmissionNumbers || 0) > 0;
    if (hasMissingNumbers && numberingStrategy === 'manual' && (!numberingStart || Number(numberingStart) <= 0)) {
      alert('Enter a starting admission number greater than 0.');
      return;
    }
    await performUpload(
      hasMissingNumbers && numberingStrategy === 'manual'
        ? { admissionNumberStrategy: 'manual', admissionNumberStart: numberingStart }
        : {}
    );
  };

  const downloadTemplate = async () => {
    try {
      const response = await axiosInstance.get(`/bulk/${entityType}/template`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Template download error:', error);
      alert('Failed to download template. Please check your connection and try again.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getAuthItem('token');

      if (!token) {
        alert('Authentication required. Please log in again.');
        setExporting(false);
        return;
      }

      let url = `${API_BASE_URL}/bulk/${entityType}/export`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Export failed:', response.status, response.statusText);
        alert(`Failed to export data (${response.status}). Please check your connection and try again.`);
        setExporting(false);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${entityType}_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please check your connection and try again.');
    } finally {
      setExporting(false);
    }
  };

  const getErrorResource = (record) => {
    if (!record) return 'N/A';
    const splitName = [record['First Name'], record['Other Names'], record['Surname']]
      .filter(Boolean)
      .join(' ');
    return record.email ||
      record.admissionNumber ||
      record.admNo ||
      record['Adm No'] ||
      record['Learner Name'] ||
      splitName ||
      record['Birth Entry Number'] ||
      'N/A';
  };

  const downloadErrorReport = () => {
    if (!uploadResult || !uploadResult.details) return;

    const { failed, validationErrors } = uploadResult.details;
    const allErrors = [
      ...failed.map(f => ({ File: f.sourceFile || '', Line: f.line, Resource: getErrorResource(f), Error: f.reason })),
      ...validationErrors.map(v => ({
        File: v.sourceFile || '',
        Line: v.line,
        Resource: getErrorResource(v.data),
        Error: Array.isArray(v.error) ? v.error.map((entry) => entry.message).join('; ') : 'Validation failed'
      }))
    ];

    if (allErrors.length === 0) return;

    const headers = ['File', 'Line', 'Resource Identifier', 'Error Message'];
    const csvRows = [headers.join(',')];

    allErrors.forEach(err => {
      csvRows.push(`"${err.File}",${err.Line},"${err.Resource}","${err.Error}"`);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${entityType}_import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetUpload = () => {
    setFiles([]);
    setUploadResult(null);
    setUploadProgress(0);
    setAnalysis(null);
    setBlockedError(null);
    setNumberingStrategy('auto');
    setNumberingStart('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFinish = () => {
    if (uploadResult?.success && onUploadComplete) {
      onUploadComplete();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          >
            {/* Header */}
            <div className="bg-[var(--brand-purple)] p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"
                  initial={{ rotate: -8, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                >
                  <Sparkles size={18} className="text-white" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-medium tracking-tight text-white">{title}</h2>
                  <p className="text-white text-[10px] uppercase tracking-widest font-medium mt-0.5">Bulk Management System</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="text-white hover:bg-white/20 p-2 rounded-xl transition-colors"
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={20} />
              </motion.button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Quick Actions */}
              <div className={`grid ${entityType === 'learners' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                <motion.button
                  onClick={downloadTemplate}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 border border-[#00A09D]/20 rounded-xl bg-[#00A09D]/[0.03] hover:border-[#00A09D] hover:bg-[#00A09D]/5 transition-colors group"
                  whileHover={{ y: -3, boxShadow: '0 8px 20px -8px rgba(0,160,157,0.35)' }}
                  whileTap={{ scale: 0.96 }}
                >
                  <div className="p-2 bg-[#00A09D]/10 rounded-lg group-hover:bg-[#00A09D]/20 transition-colors">
                    <FileDown size={18} className="text-[#00A09D]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#00A09D] text-center leading-tight">Standard Template</span>
                </motion.button>

                <motion.button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 border border-[var(--brand-purple)]/20 rounded-xl bg-[var(--brand-purple)]/[0.03] hover:border-[var(--brand-purple)] hover:bg-[var(--brand-purple)]/5 transition-colors group disabled:opacity-50"
                  whileHover={exporting ? {} : { y: -3, boxShadow: '0 8px 20px -8px rgba(76,0,80,0.3)' }}
                  whileTap={exporting ? {} : { scale: 0.96 }}
                >
                  <div className="p-2 bg-[var(--brand-purple)]/10 rounded-lg group-hover:bg-[var(--brand-purple)]/20 transition-colors">
                    {exporting ? (
                      <Loader size={18} className="animate-spin text-[var(--brand-purple)]" />
                    ) : (
                      <Download size={18} className="text-[var(--brand-purple)]" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[var(--brand-purple)] text-center leading-tight">
                    {exporting ? 'Exporting...' : 'Export All'}
                  </span>
                </motion.button>
              </div>

              {/* Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Upload size={16} className="text-gray-400" />
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-widest">Update Records</h3>
                </div>

                {/* Drag and Drop Zone */}
                <motion.div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center overflow-hidden transition-colors ${dragActive
                    ? 'border-[#00A09D] bg-[#00A09D]/5'
                    : 'border-gray-200 hover:border-[#00A09D]/30 hover:bg-gray-50/50'
                    } ${!canUpload() && files.length ? 'opacity-50' : ''}`}
                  animate={{ scale: dragActive ? 1.02 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {dragActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-[#00A09D]/10 via-transparent to-[#00A09D]/10"
                      animate={{ opacity: [0.4, 0.9, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  )}
                  <AnimatePresence mode="wait">
                    {files.length ? (
                      <motion.div
                        key="files"
                        className="relative z-10 space-y-5"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <motion.div
                            className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-1"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <CheckCircle size={28} />
                          </motion.div>
                          <span className="text-sm font-semibold text-gray-700">
                            {files.length} {files.length === 1 ? 'file' : 'files'} ready to import
                          </span>
                          <p className="text-[10px] text-gray-400 font-medium">Review every file below before processing</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                          {files.map((selectedFile, index) => (
                            <motion.div
                              key={`${selectedFile.name}-${selectedFile.size}-${index}`}
                              title={selectedFile.name}
                              className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-2"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.04 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <FileSpreadsheet size={16} className="shrink-0 text-emerald-600" />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700">{selectedFile.name}</span>
                              <CheckCircle size={14} className="shrink-0 text-emerald-500" aria-label="Ready" />
                            </motion.div>
                          ))}
                        </div>

                        <div className="flex flex-col items-center w-full pt-2">
                          <AnimatePresence>
                            {uploading && (
                              <motion.div
                                className="w-full space-y-2 mb-4"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <div className="flex justify-between text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5">
                                    <Loader size={12} className="animate-spin" />
                                    Processing Data...
                                  </span>
                                  <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden relative">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-[#00A09D] to-emerald-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {checkingFile && (
                              <motion.div
                                className="flex items-center justify-center gap-2 w-full py-3 text-xs font-medium text-gray-500"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <Loader size={14} className="animate-spin" />
                                Analyzing file...
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* File couldn't be read at all — nothing to analyze */}
                          <AnimatePresence>
                            {!checkingFile && blockedError && !uploadResult && (
                              <motion.div
                                className="w-full text-left bg-rose-50/60 border border-rose-100 rounded-xl p-4 space-y-3"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <div className="flex items-start gap-2">
                                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-semibold text-rose-800">We couldn't find any student rows in this file</p>
                                    <p className="text-[11px] text-rose-600 mt-1">{blockedError}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                  <motion.button
                                    type="button"
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 text-[11px] font-medium text-[#00A09D] hover:bg-[#00A09D]/10 rounded-lg transition-colors"
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    Get Standard Template
                                  </motion.button>
                                  <motion.button
                                    type="button"
                                    onClick={resetUpload}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    Choose Different File
                                  </motion.button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Full pre-import analysis report */}
                          <AnimatePresence>
                            {!checkingFile && analysis && !uploadResult && (
                              <motion.div
                                className="w-full text-left bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <div className="flex items-center gap-2">
                                  <ListChecks size={15} className="text-[var(--brand-purple)]" />
                                  <p className="text-xs font-semibold text-gray-700">File Analysis</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { label: 'Rows Found', value: analysis.summary?.total ?? 0, tone: 'slate' },
                                    { label: 'Ready', value: (analysis.summary?.total || 0) - (analysis.summary?.validationErrors || 0), tone: 'emerald' },
                                    { label: 'Issues', value: analysis.summary?.validationErrors || 0, tone: (analysis.summary?.validationErrors || 0) > 0 ? 'rose' : 'emerald' },
                                  ].map((stat, i) => (
                                    <motion.div
                                      key={stat.label}
                                      className={`bg-white p-2 rounded-lg border text-center ${stat.tone === 'rose' ? 'border-rose-100' : stat.tone === 'emerald' ? 'border-emerald-100' : 'border-gray-200'}`}
                                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      transition={{ delay: i * 0.05 }}
                                    >
                                      <p className="text-[9px] font-medium text-gray-400 uppercase leading-tight">{stat.label}</p>
                                      <p className={`text-base font-semibold leading-none mt-1 ${stat.tone === 'rose' ? 'text-rose-600' : stat.tone === 'emerald' ? 'text-emerald-700' : 'text-gray-700'}`}>{stat.value}</p>
                                    </motion.div>
                                  ))}
                                </div>

                                {analysis.summary?.skipped > 0 && (
                                  <p className="text-[11px] text-gray-500">{analysis.summary.skipped} blank row{analysis.summary.skipped === 1 ? '' : 's'} will be skipped automatically.</p>
                                )}

                                {(analysis.summary?.validationErrors || 0) > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-medium text-rose-700">These rows need fixing before you can import — nothing will be saved until they're resolved:</p>
                                    <div className="max-h-32 overflow-y-auto bg-white border border-rose-100 rounded-lg p-2.5 text-[11px] space-y-1.5">
                                      {analysis.details?.validationErrors?.slice(0, 8).map((issue, idx) => (
                                        <div key={idx} className="flex gap-2 items-start border-b border-rose-50 pb-1.5 last:border-0 last:pb-0">
                                          <span className="font-medium text-gray-400 min-w-[28px]">L{issue.line}</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-700 truncate">{getErrorResource(issue.data)}</p>
                                            <p className="text-rose-600">{getIssueMessage(issue)}</p>
                                          </div>
                                        </div>
                                      ))}
                                      {(analysis.details?.validationErrors?.length || 0) > 8 && (
                                        <p className="text-gray-400 italic">+{analysis.details.validationErrors.length - 8} more</p>
                                      )}
                                    </div>
                                    <div className="flex gap-2 justify-end pt-1">
                                      <motion.button
                                        type="button"
                                        onClick={resetUpload}
                                        className="px-4 py-2 text-[11px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        Choose Different File
                                      </motion.button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                                      <CheckCircle size={13} />
                                      Every row looks good and is ready to import.
                                    </p>

                                    {analysis.summary?.missingAdmissionNumbers > 0 && (
                                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 space-y-2">
                                        <p className="text-[11px] font-semibold text-amber-800">
                                          {analysis.summary.missingAdmissionNumbers} of {analysis.summary.total} students have no Admission Number.
                                        </p>
                                        <p className="text-[10px] text-amber-700">Choose how to number them:</p>

                                        <label className="flex items-start gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="numberingStrategy"
                                            checked={numberingStrategy === 'auto'}
                                            onChange={() => setNumberingStrategy('auto')}
                                            className="mt-0.5"
                                          />
                                          <span className="text-[11px] text-gray-700">
                                            <span className="font-semibold">Auto-generate</span> using the current numbering settings
                                            {analysis.nextAdmissionNumberPreview && (
                                              <span className="text-gray-400"> (continues from {analysis.nextAdmissionNumberPreview})</span>
                                            )}
                                          </span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                                          <input
                                            type="radio"
                                            name="numberingStrategy"
                                            checked={numberingStrategy === 'manual'}
                                            onChange={() => setNumberingStrategy('manual')}
                                          />
                                          <span className="text-[11px] font-semibold text-gray-700">Start a new sequence at</span>
                                          <input
                                            type="number"
                                            min="1"
                                            value={numberingStart}
                                            onFocus={() => setNumberingStrategy('manual')}
                                            onChange={(e) => { setNumberingStrategy('manual'); setNumberingStart(e.target.value); }}
                                            placeholder="e.g. 1500"
                                            className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-[11px] focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                                          />
                                        </label>
                                      </div>
                                    )}

                                    <div className="flex gap-2 justify-end pt-1">
                                      <motion.button
                                        type="button"
                                        onClick={resetUpload}
                                        className="px-4 py-2 text-[11px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        Back
                                      </motion.button>
                                      <motion.button
                                        type="button"
                                        onClick={handleProceedImport}
                                        disabled={uploading}
                                        className="px-4 py-2 bg-[#00A09D] text-white text-[11px] font-medium rounded-lg hover:bg-[#00908d] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                        whileHover={uploading ? {} : { scale: 1.03 }}
                                        whileTap={uploading ? {} : { scale: 0.95 }}
                                      >
                                        {uploading ? <Loader size={13} className="animate-spin" /> : null}
                                        Proceed with Import
                                      </motion.button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {!checkingFile && !analysis && !blockedError && !uploadResult && (
                              <motion.div
                                className="flex gap-3 justify-center w-full"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <motion.button
                                  onClick={handleUpload}
                                  disabled={!canUpload() || uploading}
                                  className="flex-1 px-6 py-3 bg-[#00A09D] text-white text-xs font-medium rounded-xl hover:bg-[#00908d] transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-[#00A09D]/20"
                                  whileHover={(!canUpload() || uploading) ? {} : { scale: 1.02, boxShadow: '0 10px 24px -8px rgba(0,160,157,0.45)' }}
                                  whileTap={(!canUpload() || uploading) ? {} : { scale: 0.97 }}
                                >
                                  {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                  <span>{uploading ? 'Processing' : 'Upload Now'}</span>
                                </motion.button>
                                <motion.button
                                  onClick={resetUpload}
                                  disabled={uploading}
                                  className="px-6 py-3 border border-gray-200 text-xs font-medium text-gray-500 rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-widest"
                                  whileHover={uploading ? {} : { scale: 1.02 }}
                                  whileTap={uploading ? {} : { scale: 0.97 }}
                                >
                                  Cancel
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {uploadResult && (
                              <motion.button
                                onClick={handleFinish}
                                className="w-full px-6 py-3.5 bg-[var(--brand-purple)] text-white text-xs font-medium rounded-xl hover:bg-[#420040] transition-colors flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-[var(--brand-purple)]/20"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                              >
                                <CheckCircle size={18} />
                                <span>Complete & Refresh View</span>
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        className="relative z-10 space-y-4 py-4"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      >
                        <motion.div
                          className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300"
                          animate={{ y: dragActive ? -4 : [0, -3, 0] }}
                          transition={dragActive
                            ? { type: 'spring', stiffness: 300, damping: 15 }
                            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <Upload size={32} className={dragActive ? 'text-[#00A09D]' : undefined} />
                        </motion.div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-700">Drop your CSV or Excel files here</p>
                          <p className="text-xs text-gray-400">
                            Or <label className="text-[var(--brand-purple)] cursor-pointer hover:underline font-medium">
                              browse files
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple={supportsMultipleFiles}
                                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                onChange={handleFileChange}
                                className="hidden"
                              />
                            </label>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Upload Results */}
                <AnimatePresence>
                  {uploadResult && (
                    <motion.div
                      className={`rounded-2xl border-2 p-5 ${uploadResult.success
                        ? 'bg-emerald-50/50 border-emerald-100'
                        : 'bg-rose-50/50 border-rose-100'
                        }`}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    >
                      <div className="flex items-start gap-3">
                        <motion.div
                          className={`p-2 rounded-xl mt-0.5 ${uploadResult.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.05 }}
                        >
                          {uploadResult.success ? (
                            <CheckCircle size={20} />
                          ) : (
                            <AlertCircle size={20} />
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-base font-medium ${uploadResult.success ? 'text-emerald-900' : 'text-rose-900'}`}>
                              {uploadResult.success ? 'Import Finished' : 'Import Failed'}
                            </h4>
                            {uploadResult.success && uploadResult.summary?.failed > 0 && (
                              <motion.button
                                onClick={downloadErrorReport}
                                className="text-[10px] font-medium text-rose-600 hover:text-rose-700 uppercase tracking-tighter flex items-center gap-1 bg-rose-100/50 px-2 py-1 rounded-md transition-colors"
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <FileDown size={12} />
                                Error Report
                              </motion.button>
                            )}
                          </div>

                          {uploadResult.success && uploadResult.summary && (
                            <div className="mt-3 space-y-3">
                              <div className="flex items-center gap-4">
                                {[
                                  { label: 'Total', value: uploadResult.summary.total, tone: 'emerald' },
                                  { label: 'Added', value: uploadResult.summary.created, tone: 'emerald' },
                                  { label: 'Updated', value: uploadResult.summary.updated || 0, tone: 'emerald' },
                                  { label: 'Failed', value: uploadResult.summary.failed, tone: uploadResult.summary.failed > 0 ? 'rose' : 'emerald' }
                                ].map((stat, i) => (
                                  <motion.div
                                    key={stat.label}
                                    className={`bg-white p-2 rounded-xl border flex-1 text-center shadow-sm ${stat.tone === 'rose' ? 'border-rose-100' : 'border-emerald-100'}`}
                                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: 0.08 + i * 0.05 }}
                                  >
                                    <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">{stat.label}</p>
                                    <p className={`text-lg font-semibold leading-none mt-1 ${stat.tone === 'rose' ? 'text-rose-600' : 'text-emerald-700'}`}>{stat.value}</p>
                                  </motion.div>
                                ))}
                              </div>

                              {uploadResult.summary.missingAdmissionNumbers > 0 && (
                                <p className="text-[11px] text-emerald-700 bg-white/60 border border-emerald-100 rounded-lg px-3 py-2">
                                  {uploadResult.summary.missingAdmissionNumbers} student{uploadResult.summary.missingAdmissionNumbers === 1 ? '' : 's'} had no Admission Number and {uploadResult.summary.missingAdmissionNumbers === 1 ? 'was' : 'were'} auto-numbered{uploadResult.summary.admissionNumberStrategy === 'manual' ? ` starting at ${uploadResult.summary.admissionNumberStartedAt}` : ''}.
                                </p>
                              )}

                              {/* Show errors if any */}
                              {uploadResult.details && (uploadResult.details.failed?.length > 0 || uploadResult.details.validationErrors?.length > 0) && (
                                <details className="mt-2 group">
                                  <summary className="cursor-pointer text-xs font-medium text-rose-600 group-open:mb-2 flex items-center gap-2 p-2 hover:bg-rose-100/30 rounded-lg transition-colors">
                                    <AlertCircle size={14} />
                                    Review Issues ({(uploadResult.details.failed?.length || 0) + (uploadResult.details.validationErrors?.length || 0)})
                                  </summary>
                                  <div className="max-h-40 overflow-y-auto bg-white border border-rose-100 rounded-xl p-3 text-[11px] space-y-2 shadow-inner">
                                    {uploadResult.details.failed?.map((err, idx) => (
                                      <div key={idx} className="flex gap-3 items-start border-b border-rose-50 pb-1.5 last:border-0 last:pb-0">
                                        <span className="font-medium text-gray-400 min-w-[24px]">L{err.line}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-800 truncate">{err.admNo || err.name || 'Record'}</p>
                                          <p className="text-rose-600">{err.reason}</p>
                                        </div>
                                      </div>
                                    ))}
                                    {uploadResult.details.validationErrors?.map((err, idx) => (
                                      <div key={idx} className="flex gap-3 items-start border-b border-rose-50 pb-1.5 last:border-0 last:pb-0">
                                        <span className="font-medium text-gray-400 min-w-[24px]">L{err.line}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-800">Validation Error</p>
                                          <p className="text-rose-400 italic">
                                            {Array.isArray(err.error) ? err.error.map((entry) => entry.message).join('; ') : 'Check template format'}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}

                          {uploadResult.error && (
                            <div className="mt-2 p-3 bg-white border border-rose-100 rounded-xl">
                              <p className="text-xs font-medium text-rose-600">
                                {typeof uploadResult.error === 'string'
                                  ? uploadResult.error
                                  : uploadResult.error?.message || 'A system error occurred'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkOperationsModal;
