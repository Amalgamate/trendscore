import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, RefreshCw, CreditCard, Download, Info, Gift, Bus } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api/index';
import { downloadFeeTemplate, downloadBalanceTemplate, downloadWaiverTemplate, downloadTransportTemplate } from '../../../utils/feeTemplateGenerator';
import { getCurrentTerm } from '../utils/academicYear';

const FeeImportModal = ({ isOpen, onClose, onComplete }) => {
  const [importMode, setImportMode] = useState('balances'); // 'balances', 'payments', or 'waivers'
  const [file, setFile] = useState(null);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState(getCurrentTerm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null); // { current, total, percent, message }
  const abortControllerRef = useRef(null);

  const handleCancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setProgress(null);
    setError('Import cancelled by user');
  };

  const handleCloseTrigger = () => {
    if (loading) {
      if (window.confirm('Import is in progress. Are you sure you want to stop it?')) {
        handleCancelImport();
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && (selected.name.endsWith('.xlsx') || selected.name.endsWith('.csv'))) {
      setFile(selected);
      setError('');
    } else {
      setFile(null);
      setError('Please select a valid .xlsx or .csv file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setProgress({ percent: 0, current: 0, total: 0, message: 'Preparing upload...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('academicYear', academicYear);
    formData.append('term', term);

    try {
      const baseUrl = API_BASE_URL || '';
      let endpoint = '/bulk/fees/upload-balances';
      if (importMode === 'payments') {
        endpoint = '/bulk/fees/upload-payments';
      } else if (importMode === 'waivers') {
        endpoint = '/bulk/fees/upload-waivers';
      } else if (importMode === 'transport') {
        endpoint = '/bulk/fees/upload-transport';
      }

      // Initialize AbortController
      abortControllerRef.current = new AbortController();

      // We use native fetch for streaming
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure auth header if needed
        },
        body: formData,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'info') {
              setProgress(prev => ({ ...prev, message: data.message }));
            } else if (data.type === 'start') {
              setProgress(prev => ({ ...prev, total: data.total, message: 'Processing started...' }));
            } else if (data.type === 'progress') {
              setProgress(prev => ({
                ...prev,
                current: data.current,
                total: data.total,
                percent: data.percent,
                message: `Importingstudent ${data.current} of ${data.total}`
              }));
            } else if (data.type === 'complete') {
              setResults(data);
              setProgress(null);
              setLoading(false);
            } else if (data.type === 'error') {
              throw new Error(data.error || data.details);
            }
          } catch (e) {
            console.warn('Failed to parse stream chunk:', line, e);
          }
        }
      }
    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during upload.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-3 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-blue-100" />
            <h2 className="text-lg font-medium">Import Records</h2>
          </div>
          <button onClick={handleCloseTrigger} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!results ? (
            <>
              {/* Import Mode Selection - Tabs */}
              <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                <button
                  onClick={() => setImportMode('balances')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    importMode === 'balances' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <RefreshCw size={14} /> Balances
                </button>
                <button
                  onClick={() => setImportMode('payments')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    importMode === 'payments' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CreditCard size={14} /> Payments
                </button>
                <button
                  onClick={() => setImportMode('waivers')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    importMode === 'waivers' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Gift size={14} /> Waivers
                </button>
                <button
                  onClick={() => setImportMode('transport')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    importMode === 'transport' ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Bus size={14} /> Transport
                </button>
              </div>

              {/* Term & Year Selection */}
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 outline-none"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 outline-none"
                >
                  <option value="TERM_1">Term 1</option>
                  <option value="TERM_2">Term 2</option>
                  <option value="TERM_3">Term 3</option>
                </select>
              </div>

              {/* File Upload Area */}
              <div className="relative border border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-5 hover:bg-blue-50 transition-colors text-center cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <FileSpreadsheet className="mx-auto text-blue-500 mb-2 transition-colors" size={32} />
                {file ? (
                  <p className="text-sm font-medium text-blue-900">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-blue-900">Click or drag .xlsx/.csv</p>
                    <div className="mt-3 flex justify-center">
                      <button 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-md shadow-sm text-[11px] font-medium text-blue-700 hover:bg-blue-50 cursor-pointer relative z-20" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          e.preventDefault();
                          if (importMode === 'balances') downloadBalanceTemplate();
                          else if (importMode === 'waivers') downloadWaiverTemplate();
                          else if (importMode === 'transport') downloadTransportTemplate();
                          else downloadFeeTemplate(); 
                        }}
                      >
                        <Download size={14} /> Download Template
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {/* Requirement Guide */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info size={14} className="text-blue-600" />
                  <p className="text-[11px] font-medium text-gray-700 uppercase tracking-tight">Required Columns</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(importMode === 'balances' 
                    ? ['Adm No', 'Billed', 'Paid', 'Balance', 'Transport Billed', 'Transport Paid'] 
                    : importMode === 'waivers'
                    ? ['Adm No', 'Waiver', 'Date', 'Reason']
                    : importMode === 'transport'
                    ? ['Adm No', 'Charges', 'Paid', 'Bal']
                    : ['Adm No', 'Amount', 'Date', 'Reference', 'Allocation']
                  ).map(col => (
                    <span key={col} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-medium text-gray-600 shadow-sm">{col}</span>
                  ))}
                </div>
              </div>

              {importMode === 'transport' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
                  <Bus size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800">
                    <p className="font-medium mb-0.5">Transport Append Mode</p>
                    <p className="font-medium text-orange-700">
                      Appends transport fees onto existing invoices. Students must already have an invoice for the selected term.
                      Only students marked as <span className="font-semibold">Transport Students</span> will be updated.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 text-xs font-medium p-2.5 rounded-lg flex items-center gap-2 border border-red-100">
                  <X size={14} className="text-red-500"/>
                  {error}
                </div>
              )}
              
              {/* Real-time Progress Indicator */}
              {loading && progress && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[11px] font-medium text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      {progress.message || 'Importing...'}
                    </p>
                    <p className="text-lg font-semibold text-blue-700 tabular-nums leading-none">
                      {progress.percent}%
                    </p>
                  </div>
                  
                  <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

            </>
          ) : (
            /* Results Screen */
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-900">Import Complete!</h3>
                  <p className="text-xs text-green-700 font-medium">Successfully processed {results.summary?.totalRows} rows.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Total Rows</p>
                  <p className="text-lg font-semibold text-gray-800">{results.summary?.totalRows || 0}</p>
                </div>
                {importMode === 'balances' ? (
                  <>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                      <p className="text-[10px] font-medium text-blue-500 uppercase">Created</p>
                      <p className="text-lg font-semibold text-blue-700">{results.summary?.created || 0}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                      <p className="text-[10px] font-medium text-emerald-500 uppercase">Updated</p>
                      <p className="text-lg font-semibold text-emerald-700">{results.summary?.updated || 0}</p>
                    </div>
                  </>
                ) : importMode === 'transport' ? (
                  <>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-center">
                      <p className="text-[10px] font-medium text-orange-500 uppercase">Updated</p>
                      <p className="text-lg font-semibold text-orange-700">{results.summary?.updated || 0}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Skipped</p>
                      <p className="text-lg font-semibold text-gray-700">{results.summary?.skipped || 0}</p>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center col-span-2">
                    <p className="text-[10px] font-medium text-blue-500 uppercase">Processed</p>
                    <p className="text-lg font-semibold text-blue-700">{results.summary?.processed || 0}</p>
                  </div>
                )}
                
                <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                  <p className="text-[10px] font-medium text-red-500 uppercase">Failed</p>
                  <p className="text-lg font-semibold text-red-700">{results.summary?.failed || 0}</p>
                </div>
              </div>

              {results.errors?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-red-800 flex items-center gap-1.5">
                    <X size={14} className="p-0.5 bg-red-200 rounded-full" />
                    Review Errors
                  </h4>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100 max-h-32 overflow-y-auto">
                    <ul className="text-[11px] text-red-700 space-y-1 list-disc pl-4 font-medium">
                      {results.errors.map((e, idx) => (
                        <li key={idx}>Row {e.row}: {e.error} {e.admNo ? `(Adm: ${e.admNo})` : ''}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex gap-3 pt-2">
            {!results ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseTrigger}
                  className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className={`flex-[2] py-2 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${
                    loading ? 'bg-indigo-600' : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  <span>{loading ? 'Processing...' : 'Upload & Process'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={onComplete || onClose}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-black transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeImportModal;
