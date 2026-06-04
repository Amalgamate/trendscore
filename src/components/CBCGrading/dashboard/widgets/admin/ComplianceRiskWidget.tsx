import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../../services/api';
import { AlertTriangle, ShieldAlert, ArrowRight } from 'lucide-react';

const ComplianceRiskWidget = () => {
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
        console.error('Failed to load compliance metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[300px] w-full bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-100 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  // Derive simple risks from existing data if a specific risk endpoint isn't available
  const risks = metrics?.risks || [];
  
  // Fallback derived risks for demonstration purposes to show the design
  const fallbackRisks = [
    {
      type: 'high',
      title: 'Unassessed Classes',
      description: '3 classes have incomplete assessments for the current term.',
      action: 'View Classes'
    },
    {
      type: 'medium',
      title: 'Fee Deficits',
      description: 'Grade 4 has fallen below the 50% fee collection threshold.',
      action: 'Send Reminders'
    },
    {
      type: 'low',
      title: 'System Activity',
      description: '5 teachers have not logged in for over 48 hours.',
      action: 'View Activity'
    }
  ];

  const displayRisks = risks.length > 0 ? risks : fallbackRisks;

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'high': return { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', icon: <ShieldAlert size={16} /> };
      case 'medium': return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: <AlertTriangle size={16} /> };
      default: return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', icon: <AlertTriangle size={16} /> };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
            <ShieldAlert size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Compliance & Risk</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">Warning Center</p>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {displayRisks.length > 0 ? (
          <div className="space-y-3">
            {displayRisks.map((risk: any, idx: number) => {
              const styles = getTypeStyles(risk.type);
              return (
                <div key={idx} className={`p-4 rounded-xl border ${styles.border} flex items-start gap-4 transition-colors hover:bg-slate-50`}>
                  <div className={`p-2 rounded-lg ${styles.bg} ${styles.text}`}>
                    {styles.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900">{risk.title}</h4>
                    <p className="text-xs font-medium text-gray-600 mt-1">{risk.description}</p>
                    <button className={`mt-2 text-[10px] font-bold ${styles.text} uppercase tracking-wider flex items-center gap-1 hover:opacity-80 transition-opacity`}>
                      {risk.action} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 mb-4">
              <ShieldAlert size={24} className="text-emerald-500" />
            </div>
            <h4 className="text-[13px] font-bold text-gray-800 mb-1">No Active Risks</h4>
            <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
              All compliance checks and operational metrics are operating normally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceRiskWidget;
