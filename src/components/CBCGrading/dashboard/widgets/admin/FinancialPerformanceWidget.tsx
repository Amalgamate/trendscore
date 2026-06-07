import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../../services/api';
import { TrendingUp, Maximize2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';

const FinancialPerformanceWidget = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'trends' | 'sources'>('trends');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await dashboardAPI.getAdminMetrics('term');
        if (response?.success) {
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('Failed to load financial performance metrics', error);
      } finally {
        setView('trends'); // Default view
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[400px] w-full bg-white border border-gray-100 rounded-2xl p-6 animate-pulse flex flex-col">
        <div className="h-6 w-48 bg-gray-100 rounded mb-6"></div>
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100"></div>
      </div>
    );
  }

  const revenueTrendData = metrics?.financials?.trendData || [];
  const revenueSourcesData = metrics?.financials?.revenueSources || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <TrendingUp size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Financial Performance</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">
              {view === 'trends' ? 'Revenue Trends' : 'Revenue Sources'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold border border-slate-200/50">
            <button 
              onClick={() => setView('trends')} 
              className={`px-3 py-1 rounded-md transition-all duration-200 ${view === 'trends' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Trends
            </button>
            <button 
              onClick={() => setView('sources')} 
              className={`px-3 py-1 rounded-md transition-all duration-200 ${view === 'sources' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Sources
            </button>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Maximize2 size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex-1 min-h-[250px]">
          {view === 'trends' ? (
            revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                    dx={-10} 
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 0, 
                      border: '1px solid #f1f5f9', 
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }} 
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                    labelStyle={{ color: '#64748b', fontWeight: 700, marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Awaiting Data
                </span>
                <p className="text-xs text-gray-400 mt-1">No trend data available for this period</p>
              </div>
            )
          ) : (
            revenueSourcesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSourcesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="source" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                    dx={-10} 
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 0, 
                      border: '1px solid #f1f5f9', 
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }} 
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Collected']}
                    labelStyle={{ color: '#64748b', fontWeight: 700, marginBottom: '4px' }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {revenueSourcesData.map((entry: any, index: number) => {
                      const colors = ['#3b82f6', '#10b981', '#a855f7', '#64748b']; // Blue (Fee), Emerald (Transport), Purple (Uniforms), Slate (Others)
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Awaiting Data
                </span>
                <p className="text-xs text-gray-400 mt-1">No sources data available for this period</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialPerformanceWidget;
