import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../../services/api';
import { CreditCard, ArrowDownRight, Wallet, Calendar, AlertCircle } from 'lucide-react';

const ExpensesWidget = () => {
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
        console.error('Failed to load expenses metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[380px] w-full bg-white border border-gray-100 rounded-2xl p-6 animate-pulse flex flex-col">
        <div className="h-6 w-48 bg-gray-100 rounded mb-6"></div>
        <div className="flex-1 space-y-4">
          <div className="h-16 bg-gray-50 rounded-xl"></div>
          <div className="h-24 bg-gray-50 rounded-xl"></div>
          <div className="h-24 bg-gray-50 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const expensesData = metrics?.financials?.expensesSummary || {
    today: 0,
    thisMonth: 0,
    thisTerm: 0,
    byCategory: [],
    recent: []
  };

  const formatCurrency = (val: number) => {
    return `KES ${val.toLocaleString()}`;
  };

  const totalTermExpenses = expensesData.thisTerm || 1; // avoid division by 0
  const categoriesSorted = [...(expensesData.byCategory || [])].sort((a, b) => b.amount - a.amount);
  const recentTransactions = expensesData.recent || [];

  // Creative helper to color code categories
  const getCategoryColor = (category: string) => {
    const cat = String(category).toLowerCase();
    if (cat.includes('salary') || cat.includes('payroll')) return { bg: 'bg-blue-500', text: 'text-blue-600', fill: 'bg-blue-50' };
    if (cat.includes('utility') || cat.includes('water') || cat.includes('electricity')) return { bg: 'bg-amber-500', text: 'text-amber-600', fill: 'bg-amber-50' };
    if (cat.includes('rent')) return { bg: 'bg-rose-500', text: 'text-rose-600', fill: 'bg-rose-50' };
    if (cat.includes('supply') || cat.includes('book') || cat.includes('stationery')) return { bg: 'bg-purple-500', text: 'text-purple-600', fill: 'bg-purple-50' };
    return { bg: 'bg-emerald-500', text: 'text-emerald-600', fill: 'bg-emerald-50' };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      {/* Widget Header */}
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
            <CreditCard size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">School Expenses</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">Operational Cash Outflow</p>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50 flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Today</span>
            <span className="text-[13px] font-black text-gray-900 mt-1 truncate">{formatCurrency(expensesData.today)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50 flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">This Month</span>
            <span className="text-[13px] font-black text-gray-900 mt-1 truncate">{formatCurrency(expensesData.thisMonth)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50 flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">This Term</span>
            <span className="text-[13px] font-black text-orange-600 mt-1 truncate">{formatCurrency(expensesData.thisTerm)}</span>
          </div>
        </div>

        {totalTermExpenses > 1 || recentTransactions.length > 0 ? (
          <div className="flex-1 flex flex-col gap-6">
            {/* Category Breakdown Progress Bars */}
            {categoriesSorted.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Category Allocation</h4>
                <div className="space-y-3">
                  {categoriesSorted.slice(0, 3).map((item: any, idx: number) => {
                    const colors = getCategoryColor(item.category);
                    const pct = Math.round((item.amount / totalTermExpenses) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-gray-700">
                          <span>{item.category}</span>
                          <span>{formatCurrency(item.amount)} ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${colors.bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Expenses List */}
            {recentTransactions.length > 0 && (
              <div className="flex-1 flex flex-col min-h-[140px]">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Transactions</h4>
                <div className="space-y-3 flex-1">
                  {recentTransactions.slice(0, 3).map((item: any, idx: number) => {
                    const colors = getCategoryColor(item.category);
                    return (
                      <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${colors.fill} ${colors.text} flex items-center justify-center`}>
                            <ArrowDownRight size={16} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800 line-clamp-1">{item.description}</p>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{item.category} • {item.account}</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-xs font-black text-red-500">-{formatCurrency(item.amount)}</span>
                          <span className="text-[9px] font-bold text-gray-400 mt-0.5">{new Date(item.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Wallet size={20} className="text-slate-400" />
            </div>
            <h4 className="text-xs font-black text-gray-700">No Expenses Recorded</h4>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] leading-relaxed">
              Use the Accounting module to log school expenditures.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesWidget;
