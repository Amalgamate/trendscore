import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  Cpu, 
  History, 
  Settings, 
  ShieldCheck, 
  Activity, 
  Plus, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Key,
  Database
} from 'lucide-react';
import { biometricAPI } from '../../../../services/api/biometric.api';
import DeviceList from './DeviceList';
import EnrollmentDashboard from './EnrollmentDashboard';
import LogViewer from './LogViewer';
import BridgeConfig from './BridgeConfig';

const BiometricManager = ({ currentPage }) => {
  const [activeTab, setActiveTab] = useState('enrollment');
  const [stats, setStats] = useState({
    devices: 0,
    enrollments: 0,
    pendingLogs: 0,
    lastActivity: null
  });
  const [loading, setLoading] = useState(true);

  // Sync tab with URL path/query params
  useEffect(() => {
    if (currentPage && currentPage.includes('?')) {
      const params = new URLSearchParams(currentPage.split('?')[1]);
      const tab = params.get('tab');
      if (tab && ['enrollment', 'devices', 'logs', 'config'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [currentPage]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const devices = await biometricAPI.getDevices();
        const logs = await biometricAPI.getLogs({ status: 'PENDING' });
        
        setStats({
          devices: devices.length,
          enrollments: 0, // This would need a specific count API or derived
          pendingLogs: logs.total || 0,
          lastActivity: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error fetching biometric stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const tabs = [
    { id: 'enrollment', label: 'Enrollment', icon: Fingerprint, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'devices', label: 'Devices', icon: Cpu, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'logs', label: 'Attendance Logs', icon: History, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'config', label: 'Setup & API', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)]">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-900 rounded-2xl text-white shadow-xl rotate-3 hover:rotate-0 transition-transform duration-300">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight uppercase">Biometric Authority</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest italic">System Online • Hardware Agnostic Protocol v1.0</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-6 pr-6 border-r border-slate-100">
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Active Terminals</p>
                  <p className="text-lg font-semibold text-slate-900">{stats.devices}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Pending Sync</p>
                  <p className="text-lg font-semibold text-slate-900">{stats.pendingLogs}</p>
                </div>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 -mb-6 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl text-xs font-semibold uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-slate-50 text-indigo-600 border-x border-t border-slate-200' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon size={16} className={activeTab === tab.id ? tab.color : 'text-slate-300'} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto p-6 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeTab === 'enrollment' && <EnrollmentDashboard />}
          {activeTab === 'devices' && <DeviceList />}
          {activeTab === 'logs' && <LogViewer />}
          {activeTab === 'config' && <BridgeConfig />}
        </div>
      </div>

      {/* Modern Status Footer */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-2 rounded-2xl shadow-2xl flex items-center gap-3">
          <div className="flex -space-x-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center">
              <Activity size={10} className="text-emerald-600" />
            </div>
          </div>
          <div className="pr-2">
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Global Status</p>
            <p className="text-[10px] font-medium text-slate-900 mt-0.5">Secure Link Established</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricManager;
