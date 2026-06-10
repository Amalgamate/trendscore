import React, { useState, useEffect } from 'react';
import { 
  X, 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { biometricAPI } from '../../../../services/api/biometric.api';

const EnrollmentModal = ({ person, type, onClose }) => {
  const [status, setStatus] = useState('CHECKING'); // CHECKING, READY, ENROLLING, SUCCESS, ERROR
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setStatus('CHECKING');
      const data = await biometricAPI.getEnrollmentStatus(type.toLowerCase(), person.id);
      setEnrollmentData(data);
      setStatus('READY');
    } catch (err) {
      console.error('Error fetching enrollment status:', err);
      setError('Failed to communicate with Biometric Authority.');
      setStatus('ERROR');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [person.id, type]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl shadow-indigo-500/20 overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Fingerprint size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight uppercase">Biometric Enrollment</h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest italic leading-none mt-1">Interface Node: Secure Authentication</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8">
          {/* User Preview */}
          <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-3xl border border-slate-100 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-semibold text-xl text-indigo-600 shadow-sm">
              {person.firstName?.[0]}{person.lastName?.[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {person.firstName} {person.lastName}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                {type} • {person.admissionNumber || person.employeeCode || 'ID: ' + person.id.split('-')[0]}
              </p>
            </div>
            <div className="ml-auto">
              {enrollmentData?.isEnrolled ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-semibold uppercase tracking-widest ring-1 ring-emerald-500/20">
                  <CheckCircle2 size={12} />
                  Enrolled
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-semibold uppercase tracking-widest ring-1 ring-amber-500/20">
                  <AlertCircle size={12} />
                  Not Enrolled
                </span>
              )}
            </div>
          </div>

          {status === 'CHECKING' && (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw size={40} className="text-indigo-600 animate-spin mb-4" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Synchronizing Keys...</p>
            </div>
          )}

          {status === 'READY' && (
            <div className="space-y-6">
              <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
                <ShieldCheck className="absolute -right-4 -bottom-4 text-white/10" size={120} />
                <h3 className="text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Info size={16} /> 
                  Enrollment Protocol
                </h3>
                <p className="text-xs font-medium text-indigo-50 leading-relaxed mb-6">
                  To complete enrollment, open the TrendScore Biometric Bridge on the local scanning workstation. Use the following dynamic token to authenticate the session:
                </p>
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/20">
                  <code className="text-lg font-semibold tracking-widest font-mono">
                    {person.admissionNumber || person.employeeCode || person.id.split('-')[0]}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(person.admissionNumber || person.employeeCode || person.id)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-all"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Bridge Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <p className="text-[10px] font-medium text-slate-600 italic">Waiting for connection...</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Template Version</p>
                  <p className="text-[10px] font-medium text-slate-600">ISO-19794-2:2011</p>
                </div>
              </div>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl mb-4">
                <AlertCircle size={32} />
              </div>
              <h4 className="text-slate-900 font-semibold uppercase tracking-tight">System Outage</h4>
              <p className="text-xs text-slate-400 mt-2 max-w-xs">{error}</p>
              <button 
                onClick={fetchStatus}
                className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold uppercase tracking-widest shadow-lg shadow-indigo-600/20"
              >
                Retry Link
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[9px] font-medium text-slate-400 flex items-center gap-2">
            <ShieldCheck size={14} className="text-indigo-400" />
            End-to-End Encrypted Enrollment Channel
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={status !== 'READY'}
              onClick={() => window.open('/biometric-bridge-download', '_blank')}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <ExternalLink size={14} />
              Open Bridge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentModal;
