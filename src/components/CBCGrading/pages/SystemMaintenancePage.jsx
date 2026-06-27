import React, { useState } from 'react';
import { 
  ShieldAlert, RefreshCcw, Database, AlertTriangle, CheckCircle2, 
  Trash2, Loader2, ArrowLeft, Info, Eraser, UploadCloud, Users, GraduationCap, WalletCards
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import usePageNavigation from '../../../hooks/usePageNavigation';
import BackupSettings from './settings/BackupSettings';
import BulkOperationsModal from '../shared/bulk/BulkOperationsModal';
import FeeImportModal from '../shared/FeeImportModal';

const SystemMaintenancePage = () => {
  const navigateTo = usePageNavigation();
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetStatus, setResetStatus] = useState('idle'); // idle, loading, success, error
  const [showInstitutionResetModal, setShowInstitutionResetModal] = useState(false);
  const [institutionConfirmText, setInstitutionConfirmText] = useState('');
  const [institutionResetStatus, setInstitutionResetStatus] = useState('idle'); // idle, loading, success, error
  const [institutionResetLoading, setInstitutionResetLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('restore');
  const [activeImport, setActiveImport] = useState(null);

  const REQUIRED_CONFIRM_TEXT = 'RESET TOTAL ACCOUNTING';
  const REQUIRED_INSTITUTION_CONFIRM_TEXT = 'RESET WHOLE INSTITUTION';

  const handleTotalReset = async () => {
    if (confirmText !== REQUIRED_CONFIRM_TEXT) {
      showError('Confirmation text mismatch');
      return;
    }

    try {
      setLoading(true);
      setResetStatus('loading');
      
      const response = await api.fees.resetAllAccounting({
        confirmToken: 'RESET_TOTAL_ACCOUNTING'
      });

      if (response.success) {
        showSuccess(response.message || 'Total reset complete!');
        setResetStatus('success');
        setConfirmText('');
        // We stay here to show the success state, but user can navigate away
      }
    } catch (error) {
      console.error('Reset error:', error);
      showError(error.message || 'Global reset failed. Please contact technical support.');
      setResetStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleWholeInstitutionReset = async () => {
    if (institutionConfirmText !== REQUIRED_INSTITUTION_CONFIRM_TEXT) {
      showError('Confirmation text mismatch');
      return;
    }

    try {
      setInstitutionResetLoading(true);
      setInstitutionResetStatus('loading');
      const response = await api.school.resetWholeInstitution('RESET_WHOLE_INSTITUTION');
      if (response.success) {
        setInstitutionResetStatus('success');
        setInstitutionConfirmText('');
        showSuccess(response.message || 'Institution reset completed');
      }
    } catch (error) {
      console.error('Institution reset error:', error);
      setInstitutionResetStatus('error');
      showError(error.message || 'Institution reset failed. Please contact support.');
    } finally {
      setInstitutionResetLoading(false);
    }
  };

  const renderResetTab = () => (
    <div className="grid gap-6">
      {/* Safety Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900">Privileged Operations Area</h3>
          <p className="text-amber-800 text-sm mt-1">
            Actions in this section can cause permanent data loss or system-wide changes.
            Only proceed if you are a designated Super Administrator.
          </p>
        </div>
      </div>

      {/* Total Accounting Reset Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                <Eraser className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 text-lg">Total Financial Reset</h4>
                <p className="text-slate-500 text-sm">Wipe all invoices, payments, and ledger entries for a fresh start.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100">
            <h5 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Info className="w-3 h-3" /> What will be deleted:
            </h5>
            <ul className="text-sm text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1 ml-5 list-disc">
              <li>Every Fee Invoice (All terms/years)</li>
              <li>All Fee Payments & Receipts</li>
              <li>All Fee Waivers & Pledges</li>
              <li>The entire General Ledger (Journal Entries)</li>
              <li>All recorded Expenses</li>
              <li>All Payroll History</li>
            </ul>
            <p className="text-xs text-red-600 font-medium mt-3 italic">
              * Structural data like Students, Staff, and Fee Structures will NOT be touched.
            </p>
          </div>

          <div className="flex justify-end gap-3 flex-wrap">
            <button
              onClick={() => setShowInstitutionResetModal(true)}
              className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-sm active:transform active:scale-95"
            >
              <RefreshCcw className="w-4 h-4" />
              Factory Reset Institution
            </button>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-sm active:transform active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              Factory Reset Accounting
            </button>
          </div>
        </div>
      </div>

      {/* Future Tooling Card Placeholder */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 opacity-60">
        <div className="flex gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900">Automated Bulk Generation</h4>
            <p className="text-slate-500 text-sm">Massively generate invoices for all students based on assigned structures.</p>
            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const importGroups = [
    {
      id: 'learners',
      title: 'Learners',
      description: 'Bulk upload learner records, admission numbers, classes, streams, and guardian contacts.',
      icon: GraduationCap,
      entityType: 'learners',
      actionLabel: 'Import Learners',
    },
    {
      id: 'staff',
      title: 'Teachers & Staff',
      description: 'Import teacher and operational staff accounts using controlled identity matching.',
      icon: Users,
      entityType: 'teachers',
      actionLabel: 'Import Staff',
    },
    {
      id: 'parents',
      title: 'Parents',
      description: 'Create or link parent accounts to existing learners without duplicating guardian profiles.',
      icon: Users,
      entityType: 'parents',
      actionLabel: 'Import Parents',
    },
    {
      id: 'fees',
      title: 'Fees',
      description: 'Import opening balances, payments, waivers, and transport fee updates with audit checks.',
      icon: WalletCards,
      entityType: 'fees',
      actionLabel: 'Import Fees',
    },
  ];

  const importTitles = {
    learners: 'Bulk Learner Import',
    teachers: 'Bulk Staff Import',
    parents: 'Bulk Parent Import',
  };

  const renderImportsTab = () => (
    <div className="grid gap-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Import Center</h3>
            <p className="text-slate-600 text-sm mt-1">
              Central place for bulk uploads. Each import will validate first, show duplicate/conflict rows,
              then require confirmation before writing records.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {importGroups.map(({ id, title, description, icon: Icon, entityType, actionLabel }) => (
          <div key={id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-slate-900">{title}</h4>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
                <button
                  type="button"
                  onClick={() => setActiveImport(entityType)}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-black transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  {actionLabel}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    { id: 'restore', label: 'Restore' },
    { id: 'imports', label: 'Imports' },
    { id: 'reset', label: 'Reset' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigateTo('FINANCE_DASHBOARD')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-slate-900">System Maintenance</h1>
          <p className="text-slate-500 text-sm">Administrative tools for Restore, Imports, and Reset operations.</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="inline-flex bg-slate-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'restore' && <BackupSettings />}
      {activeTab === 'imports' && renderImportsTab()}
      {activeTab === 'reset' && renderResetTab()}

      <BulkOperationsModal
        isOpen={['learners', 'teachers', 'parents'].includes(activeImport)}
        onClose={() => setActiveImport(null)}
        title={importTitles[activeImport] || 'Bulk Import'}
        entityType={activeImport}
        onUploadComplete={() => {
          setActiveImport(null);
          showSuccess('Import completed');
        }}
      />

      <FeeImportModal
        isOpen={activeImport === 'fees'}
        onClose={() => setActiveImport(null)}
        onComplete={() => {
          setActiveImport(null);
          showSuccess('Fee import completed');
        }}
      />

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-medium">Catastrophic Action Required</h2>
              <p className="text-red-100 text-sm mt-1 opacity-90">
                This action is irreversible and will wipe all your financial balances.
              </p>
            </div>

            <div className="p-6">
              {resetStatus === 'success' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">System Reset Successful!</h3>
                  <p className="text-slate-600 text-sm mb-6">All accounting records have been cleared. You are back to zero.</p>
                  <button 
                    onClick={() => {
                        setShowResetModal(false);
                        setResetStatus('idle');
                        navigateTo('FINANCE_DASHBOARD');
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-medium rounded-xl"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    To confirm this action, please type <strong>{REQUIRED_CONFIRM_TEXT}</strong> in the field below. This safety check ensures you are making this decision intentionally.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <input 
                        type="text" 
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type confirmation here..."
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-red-500 focus:outline-none transition-all font-mono text-center tracking-wider"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => {
                            if (!loading) {
                              setShowResetModal(false);
                              setResetStatus('idle');
                              setConfirmText('');
                            }
                          }}
                          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                        >
                          Abort
                        </button>
                        <button 
                          disabled={confirmText !== REQUIRED_CONFIRM_TEXT || loading}
                          onClick={handleTotalReset}
                          className={`flex-1 py-3 text-white font-medium rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-all ${
                            confirmText === REQUIRED_CONFIRM_TEXT && !loading 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-slate-300 cursor-not-allowed shadow-none'
                          }`}
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Wipe'}
                        </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Whole Institution Reset Modal */}
      {showInstitutionResetModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-6 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-medium">Institution Factory Reset</h2>
              <p className="text-slate-200 text-sm mt-1 opacity-90">
                This will wipe institution data and return setup to first-login mode.
              </p>
            </div>

            <div className="p-6">
              {institutionResetStatus === 'success' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Institution Reset Complete</h3>
                  <p className="text-slate-600 text-sm mb-6">
                    Super-admin access was preserved. Please sign in again to choose institution type.
                  </p>
                  <button
                    onClick={() => {
                      localStorage.removeItem('selectedInstitutionType');
                      localStorage.removeItem('token');
                      localStorage.removeItem('refreshToken');
                      localStorage.removeItem('user');
                      setShowInstitutionResetModal(false);
                      setInstitutionResetStatus('idle');
                      window.location.hash = '#/auth/login';
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-medium rounded-xl"
                  >
                    Re-Login Now
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
                    <h5 className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-2">Data erased by this action</h5>
                    <ul className="text-sm text-red-700 list-disc ml-5 space-y-1">
                      <li>All learners, classes, attendance, assessment, and report data</li>
                      <li>All finance, transport, inventory, library, LMS, and communication records</li>
                      <li>All non-super-admin user accounts</li>
                    </ul>
                    <p className="text-xs text-red-700 font-medium mt-3">
                      Super admin account(s) and app bootstrap tables are preserved.
                    </p>
                  </div>

                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    Type <strong>{REQUIRED_INSTITUTION_CONFIRM_TEXT}</strong> to continue.
                  </p>

                  <div className="space-y-4">
                    <input
                      type="text"
                      value={institutionConfirmText}
                      onChange={(e) => setInstitutionConfirmText(e.target.value)}
                      placeholder="Type confirmation here..."
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none transition-all font-mono text-center tracking-wider"
                    />

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          if (!institutionResetLoading) {
                            setShowInstitutionResetModal(false);
                            setInstitutionResetStatus('idle');
                            setInstitutionConfirmText('');
                          }
                        }}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                      >
                        Abort
                      </button>
                      <button
                        disabled={institutionConfirmText !== REQUIRED_INSTITUTION_CONFIRM_TEXT || institutionResetLoading}
                        onClick={handleWholeInstitutionReset}
                        className={`flex-1 py-3 text-white font-medium rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${
                          institutionConfirmText === REQUIRED_INSTITUTION_CONFIRM_TEXT && !institutionResetLoading
                            ? 'bg-slate-900 hover:bg-black shadow-slate-300'
                            : 'bg-slate-300 cursor-not-allowed shadow-none'
                        }`}
                      >
                        {institutionResetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Institution Reset'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMaintenancePage;
