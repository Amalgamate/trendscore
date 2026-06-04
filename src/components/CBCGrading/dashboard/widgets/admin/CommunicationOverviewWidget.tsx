import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../../services/api';
import { MessageSquare, Mail, Activity, ArrowRight } from 'lucide-react';

const CommunicationOverviewWidget = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await dashboardAPI.getAdminMetrics('term');
        if (response?.success) {
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('Failed to load communication metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[300px] w-full bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-100 rounded mb-6"></div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="h-20 bg-gray-50 rounded-xl"></div>
          <div className="h-20 bg-gray-50 rounded-xl"></div>
        </div>
        <div className="h-16 bg-gray-50 rounded-xl"></div>
      </div>
    );
  }

  // Use API data if available, otherwise display a sleek 'no data' or mock state 
  // as per the requirement for graceful degradation.
  const commsData = metrics?.communications || { smsSent: 0, emailSent: 0, activeCampaigns: 0 };
  const hasData = commsData.smsSent > 0 || commsData.emailSent > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
            <MessageSquare size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Communication</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">SMS & Email Health</p>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {hasData ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">SMS Sent</p>
                  <p className="text-2xl font-black text-gray-900">{commsData.smsSent.toLocaleString()}</p>
                </div>
                <MessageSquare className="text-sky-200" size={24} />
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Emails Sent</p>
                  <p className="text-2xl font-black text-gray-900">{commsData.emailSent.toLocaleString()}</p>
                </div>
                <Mail className="text-sky-200" size={24} />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-3">
                <Activity className="text-sky-500" size={20} />
                <div>
                  <p className="text-xs font-bold text-gray-900">Communication Services Online</p>
                  <p className="text-[10px] font-medium text-gray-600 mt-0.5">{commsData.activeCampaigns} active campaigns</p>
                </div>
              </div>
              <button className="text-sky-600 hover:text-sky-800 transition-colors">
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center border border-sky-100 mb-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-100 to-transparent opacity-50"></div>
              <MessageSquare size={24} className="text-sky-400 relative z-10" />
            </div>
            <h4 className="text-[13px] font-bold text-gray-800 mb-1">Communications Setup</h4>
            <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed mb-4">
              Connect your SMS or Email gateway to track broadcast health here.
            </p>
            <button className="px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
              Configure Gateway
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationOverviewWidget;
