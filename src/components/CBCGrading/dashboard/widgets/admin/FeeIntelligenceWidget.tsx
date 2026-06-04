import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../../services/api';
import { Wallet, TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';

const FeeIntelligenceWidget = () => {
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
        console.error('Failed to load fee intelligence', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[400px] w-full bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-100 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100"></div>
          ))}
        </div>
      </div>
    );
  }

  const feeCollected = metrics?.stats?.feeCollected || 0;
  const feePending = metrics?.stats?.feePending || 0;
  const totalTarget = feeCollected + feePending;
  const collectionRate = totalTarget > 0 ? Math.round((feeCollected / totalTarget) * 100) : 0;
  
  const streamBreakdown = metrics?.financials?.streamBreakdown || [];

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `KES ${(val / 1000000).toFixed(2)}M`;
    return `KES ${val.toLocaleString()}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Wallet size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Fee Intelligence</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">Collection Health by Stream</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreHorizontal size={18} className="text-gray-400" />
        </button>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        {/* Total Summary - Colorful Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Expected Revenue */}
          <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.1)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(59,130,246,0.15)] hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Wallet size={18} strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Expected Revenue</span>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(totalTarget)}</h3>
            <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-blue-500 h-full w-full rounded-full"></div>
            </div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mt-2">100% of target</p>
          </div>

          {/* Collected */}
          <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.1)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.15)] hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={18} strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Collected (This Term)</span>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(feeCollected)}</h3>
            <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${collectionRate}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-2">{collectionRate}% of target</p>
          </div>

          {/* Outstanding */}
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(244,63,94,0.1)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(244,63,94,0.15)] hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                <TrendingDown size={18} strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Outstanding Bal</span>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(feePending)}</h3>
            <div className="w-full bg-rose-200 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${100 - collectionRate}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-2">{100 - collectionRate}% remaining</p>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-2 px-2">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Stream / Grade</span>
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Progress</span>
          </div>

          {streamBreakdown.length > 0 ? (
            streamBreakdown.map((stream: any, idx: number) => {
              const streamTarget = stream.target || (stream.collected + stream.bal) || 1;
              const streamRate = Math.round((stream.collected / streamTarget) * 100);
              
              return (
                <div key={idx} className="group p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-800">{stream.name}</span>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-md">
                        {formatCurrency(stream.bal)} pending
                      </span>
                      <span className="text-sm font-black text-gray-900 w-24 text-right">
                        {formatCurrency(stream.collected)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex mt-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${streamRate >= 80 ? 'bg-emerald-500' : streamRate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                      style={{ width: `${streamRate}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Awaiting Data
              </span>
              <p className="text-xs text-gray-400 mt-1">No stream breakdown available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeeIntelligenceWidget;
