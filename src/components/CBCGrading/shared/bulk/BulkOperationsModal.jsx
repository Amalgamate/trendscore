import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileDown, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';
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

  const handleUpload = async () => {
    if (!canUpload()) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      const fieldName = supportsMultipleFiles ? 'files' : 'file';
      files.forEach((selectedFile) => formData.append(fieldName, selectedFile));

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
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Upload failed. Please try again.';
      setUploadResult({
        success: false,
        error: errorMessage
      });
    } finally {
      setUploading(false);
    }
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

  const downloadKemisTemplate = async () => {
    try {
      const response = await axiosInstance.get(`/bulk/learners/template/kemis`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kemis_learners_template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('KEMIS template download error:', error);
      alert('Failed to download KEMIS template. Please check your connection and try again.');
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[var(--brand-purple)] text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium tracking-tight">{title}</h2>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-medium mt-0.5">Bulk Management System</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-xl transition-all active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Actions */}
          <div className={`grid ${entityType === 'learners' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <button
              onClick={downloadTemplate}
              className="flex flex-col items-center justify-center gap-1.5 p-3 border border-[#00A09D]/20 rounded-xl hover:border-[#00A09D] hover:bg-[#00A09D]/5 transition-all group active:scale-95"
            >
              <div className="p-2 bg-[#00A09D]/10 rounded-lg group-hover:bg-[#00A09D]/20 transition-colors">
                <FileDown size={18} className="text-[#00A09D]" />
              </div>
              <span className="text-[11px] font-medium text-[#00A09D] text-center leading-tight">Standard Template</span>
            </button>

            {entityType === 'learners' && (
              <button
                onClick={downloadKemisTemplate}
                className="flex flex-col items-center justify-center gap-1.5 p-3 border border-sky-200 rounded-xl hover:border-sky-500 hover:bg-sky-50 transition-all group active:scale-95"
              >
                <div className="p-2 bg-sky-100 rounded-lg group-hover:bg-sky-200 transition-colors">
                  <FileDown size={18} className="text-sky-700" />
                </div>
                <span className="text-[11px] font-medium text-sky-700 text-center leading-tight">KEMIS Template</span>
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex flex-col items-center justify-center gap-1.5 p-3 border border-[var(--brand-purple)]/20 rounded-xl hover:border-[var(--brand-purple)] hover:bg-[var(--brand-purple)]/5 transition-all group disabled:bg-gray-50 disabled:opacity-50 active:scale-95"
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
            </button>
          </div>

          {entityType === 'learners' && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-blue-950">
                <span>🇰🇪</span> Direct KEMIS Import Supported
              </p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                You can upload a raw KEMIS export directly. Learners without a Stream are assigned to an eligible class automatically; add <strong>Parent Phone</strong> only when you want parent accounts and sibling family links matched during import.
              </p>
            </div>
          )}

          {/* Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Upload size={16} className="text-gray-400" />
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-widest">Update Records</h3>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragActive
                ? 'border-[#00A09D] bg-[#00A09D]/5 scale-[1.02]'
                : 'border-gray-200 hover:border-[#00A09D]/30 hover:bg-gray-50/50'
                } ${!canUpload() && files.length ? 'opacity-50' : ''}`}
            >
              {files.length ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-1">
                      <CheckCircle size={28} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {files.length} {files.length === 1 ? 'file' : 'files'} ready to import
                    </span>
                    <p className="text-[10px] text-gray-400 font-medium">Review every file below before processing</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                    {files.map((selectedFile, index) => (
                      <div
                        key={`${selectedFile.name}-${selectedFile.size}-${index}`}
                        title={selectedFile.name}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-2"
                      >
                        <FileSpreadsheet size={16} className="shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700">{selectedFile.name}</span>
                        <CheckCircle size={14} className="shrink-0 text-emerald-500" aria-label="Ready" />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center w-full pt-2">
                    {uploading && (
                      <div className="w-full space-y-2 mb-4">
                        <div className="flex justify-between text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <Loader size={12} className="animate-spin" />
                            Processing Data...
                          </span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00A09D] transition-all duration-500 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!uploadResult && (
                      <div className="flex gap-3 justify-center w-full">
                        <button
                          onClick={handleUpload}
                          disabled={!canUpload() || uploading}
                          className="flex-1 px-6 py-3 bg-[#00A09D] text-white text-xs font-medium rounded-xl hover:bg-[#00908d] transition-all disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-[#00A09D]/20 active:scale-95"
                        >
                          {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                          <span>{uploading ? 'Processing' : 'Upload Now'}</span>
                        </button>
                        <button
                          onClick={resetUpload}
                          disabled={uploading}
                          className="px-6 py-3 border border-gray-200 text-xs font-medium text-gray-500 rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest active:scale-95"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {uploadResult && (
                      <button
                        onClick={handleFinish}
                        className="w-full px-6 py-3.5 bg-[var(--brand-purple)] text-white text-xs font-medium rounded-xl hover:bg-[#420040] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-[var(--brand-purple)]/20 active:scale-95"
                      >
                        <CheckCircle size={18} />
                        <span>Complete & Refresh View</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300">
                    <Upload size={32} />
                  </div>
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
                </div>
              )}
            </div>

            {/* Upload Results */}
            {uploadResult && (
              <div className={`rounded-2xl border-2 transition-all p-5 animate-in slide-in-from-bottom-2 duration-300 ${uploadResult.success
                ? 'bg-emerald-50/50 border-emerald-100'
                : 'bg-rose-50/50 border-rose-100'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${uploadResult.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {uploadResult.success ? (
                      <CheckCircle size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-base font-medium ${uploadResult.success ? 'text-emerald-900' : 'text-rose-900'}`}>
                        {uploadResult.success ? 'Import Finished' : 'Import Failed'}
                      </h4>
                      {uploadResult.success && uploadResult.summary?.failed > 0 && (
                        <button
                          onClick={downloadErrorReport}
                          className="text-[10px] font-medium text-rose-600 hover:text-rose-700 uppercase tracking-tighter flex items-center gap-1 bg-rose-100/50 px-2 py-1 rounded-md transition-colors"
                        >
                          <FileDown size={12} />
                          Error Report
                        </button>
                      )}
                    </div>

                    {uploadResult.success && uploadResult.summary && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="bg-white p-2 rounded-xl border border-emerald-100 flex-1 text-center shadow-sm">
                            <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">Total</p>
                            <p className="text-lg font-semibold text-emerald-700 leading-none mt-1">{uploadResult.summary.total}</p>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-emerald-100 flex-1 text-center shadow-sm">
                            <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">Added</p>
                            <p className="text-lg font-semibold text-emerald-700 leading-none mt-1">{uploadResult.summary.created}</p>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-emerald-100 flex-1 text-center shadow-sm">
                            <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">Updated</p>
                            <p className="text-lg font-semibold text-emerald-700 leading-none mt-1">{uploadResult.summary.updated || 0}</p>
                          </div>
                          <div className={`bg-white p-2 rounded-xl border flex-1 text-center shadow-sm ${uploadResult.summary.failed > 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                            <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">Failed</p>
                            <p className={`text-lg font-semibold leading-none mt-1 ${uploadResult.summary.failed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{uploadResult.summary.failed}</p>
                          </div>
                        </div>

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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkOperationsModal;
