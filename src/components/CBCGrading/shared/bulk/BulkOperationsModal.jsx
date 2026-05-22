import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileDown, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import axiosInstance, { API_BASE_URL } from '../../../../services/api/axiosConfig';

const BulkOperationsModal = ({
  isOpen,
  onClose,
  title,
  entityType, // 'learners', 'teachers', 'parents'
  onUploadComplete,
  userRole // Pass user role if needed, though context is now header-based
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const canUpload = () => !!file;
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (isSupportedUploadFile(droppedFile)) {
        setFile(droppedFile);
        setUploadResult(null);
      } else {
        alert('Please upload a CSV or Excel file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (isSupportedUploadFile(selectedFile)) {
        setFile(selectedFile);
        setUploadResult(null);
      } else {
        alert('Please select a CSV or Excel file');
      }
    }
  };

  const handleUpload = async () => {
    if (!canUpload()) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // School ID removed for single-tenant mode
      const schoolId = null;

      const response = await axiosInstance.post(`/bulk/${entityType}/upload?forceCreate=${forceCreate ? 'true' : 'false'}`, formData, {
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

      // We don't call onUploadComplete() here anymore because we want 
      // the user to see the summary first. We'll call it in handleFinish.
      // However, we can proactively trigger a partial refresh if needed.
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        alert('Authentication required. Please log in again.');
        setExporting(false);
        return;
      }

      // School ID removed for single-tenant mode
      const schoolId = null;

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

  const downloadErrorReport = () => {
    if (!uploadResult || !uploadResult.details) return;

    const { failed, validationErrors } = uploadResult.details;
    const allErrors = [
      ...failed.map(f => ({ Line: f.line, Resource: f.email || f.admissionNumber || 'N/A', Error: f.reason })),
      ...validationErrors.map(v => ({
        Line: v.line,
        Resource: v.data?.['Adm No'] || v.data?.['Learner Name'] || 'N/A',
        Error: Array.isArray(v.error) ? v.error.map((entry) => entry.message).join('; ') : 'Validation failed'
      }))
    ];

    if (allErrors.length === 0) return;

    const headers = ['Line', 'Resource Identifier', 'Error Message'];
    const csvRows = [headers.join(',')];

    allErrors.forEach(err => {
      csvRows.push(`${err.Line},"${err.Resource}","${err.Error}"`);
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
    setFile(null);
    setUploadResult(null);
    setUploadProgress(0);
    setForceCreate(false);
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
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={downloadTemplate}
              className="flex flex-col items-center justify-center gap-2 p-4 border border-[#00A09D]/20 rounded-2xl hover:border-[#00A09D] hover:bg-[#00A09D]/5 transition-all group active:scale-95"
            >
              <div className="p-2 bg-[#00A09D]/10 rounded-xl group-hover:bg-[#00A09D]/20 transition-colors">
                <FileDown size={22} className="text-[#00A09D]" />
              </div>
              <span className="text-xs font-medium text-[#00A09D] uppercase tracking-wider">Template</span>
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex flex-col items-center justify-center gap-2 p-4 border border-[var(--brand-purple)]/20 rounded-2xl hover:border-[var(--brand-purple)] hover:bg-[var(--brand-purple)]/5 transition-all group disabled:bg-gray-50 disabled:opacity-50 active:scale-95"
            >
              <div className="p-2 bg-[var(--brand-purple)]/10 rounded-xl group-hover:bg-[var(--brand-purple)]/20 transition-colors">
                {exporting ? (
                  <Loader size={22} className="animate-spin text-[var(--brand-purple)]" />
                ) : (
                  <Download size={22} className="text-[var(--brand-purple)]" />
                )}
              </div>
              <span className="text-xs font-medium text-[var(--brand-purple)] uppercase tracking-wider">
                {exporting ? 'Exporting...' : 'Export All Stuents'}
              </span>
            </button>
          </div>

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
                } ${!canUpload() && file ? 'opacity-50' : ''}`}
            >
              {file ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-1">
                      <CheckCircle size={28} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[280px]">{file.name}</span>
                    <p className="text-[10px] text-gray-400 font-medium">Ready for processing</p>
                  </div>

                  {/* Force Create Option - Enhanced UI */}
                  <label className="flex items-center gap-3 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl cursor-pointer hover:bg-amber-50 transition-colors group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        id="forceCreate"
                        checked={forceCreate}
                        onChange={(e) => setForceCreate(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-amber-300 bg-white checked:bg-amber-500 checked:border-amber-500 transition-all"
                      />
                      <CheckCircle className="absolute h-3.5 w-3.5 text-white left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-medium text-amber-900 block">Force Update (Overwrite)</span>
                      <p className="text-[10px] text-amber-700 leading-tight mt-0.5">Replace existing records with matching identifiers.</p>
                    </div>
                  </label>

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
                    <p className="text-sm font-medium text-gray-700">Drop your CSV or Excel file here</p>
                    <p className="text-xs text-gray-400">
                      Or <label className="text-[var(--brand-purple)] cursor-pointer hover:underline font-medium">
                        browse files
                        <input
                          ref={fileInputRef}
                          type="file"
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

            {/* Upload Results - Enhanced Detailed Feedback */}
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
                          <div className={`bg-white p-2 rounded-xl border flex-1 text-center shadow-sm ${uploadResult.summary.failed > 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                            <p className="text-[10px] font-medium text-gray-400 uppercase leading-tight">Failed</p>
                            <p className={`text-lg font-semibold leading-none mt-1 ${uploadResult.summary.failed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{uploadResult.summary.failed}</p>
                          </div>
                        </div>

                        {/* Show errors if any */}
                        {uploadResult.details && (uploadResult.details.failed.length > 0 || uploadResult.details.validationErrors.length > 0) && (
                          <details className="mt-2 group">
                            <summary className="cursor-pointer text-xs font-medium text-rose-600 group-open:mb-2 flex items-center gap-2 p-2 hover:bg-rose-100/30 rounded-lg transition-colors">
                              <AlertCircle size={14} />
                              Review Issues ({uploadResult.details.failed.length + uploadResult.details.validationErrors.length})
                            </summary>
                            <div className="max-h-40 overflow-y-auto bg-white border border-rose-100 rounded-xl p-3 text-[11px] space-y-2 shadow-inner">
                              {uploadResult.details.failed.map((err, idx) => (
                                <div key={idx} className="flex gap-3 items-start border-b border-rose-50 pb-1.5 last:border-0 last:pb-0">
                                  <span className="font-medium text-gray-400 min-w-[24px]">L{err.line}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{err.email || err.admissionNumber || 'Record'}</p>
                                    <p className="text-rose-600">{err.reason}</p>
                                  </div>
                                </div>
                              ))}
                              {uploadResult.details.validationErrors.map((err, idx) => (
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
