/**
 * Parent Portal Fees Screen
 * Modern banking app-style fees management
 * Display outstanding balance, fee breakdown, transactions, and payment options
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, DollarSign, TrendingDown, Download, History,
  ChevronRight, AlertCircle, CheckCircle, Clock, FileText,
  Wallet, Phone
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';

// ─── Helper Components ──────────────────────────────────────────────

function OutstandingBalanceCard({ balance, dueDate, statusMessage }) {
  const isOverdue = statusMessage?.toLowerCase().includes('overdue');

  return (
    <div className={`rounded-2xl p-6 text-white ${
      isOverdue
        ? 'bg-gradient-to-br from-rose-600 to-rose-700'
        : 'bg-gradient-to-br from-brand-purple to-purple-700'
    } relative overflow-hidden`}>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

      <div className="relative z-10">
        <p className="text-white/80 text-sm font-medium mb-2">Outstanding Balance</p>
        <h2 className="text-4xl font-bold mb-1">KES {Number(balance || 0).toLocaleString()}</h2>
        
        {dueDate && (
          <p className="text-white/70 text-xs">Due: {dueDate}</p>
        )}

        {statusMessage && (
          <div className="mt-3 p-2 bg-white/20 rounded-lg">
            <p className="text-xs font-semibold">{statusMessage}</p>
          </div>
        )}
      </div>

      {/* Status icon */}
      <div className={`absolute top-4 right-4 p-3 rounded-xl ${
        isOverdue ? 'bg-white/20' : 'bg-white/10'
      }`}>
        {isOverdue ? (
          <AlertCircle size={20} />
        ) : (
          <DollarSign size={20} />
        )}
      </div>
    </div>
  );
}

function PaymentProgressCard({ paid, outstanding, total }) {
  const progressPercent = total > 0 ? (paid / total * 100) : 0;
  const remainingPercent = 100 - progressPercent;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">Payment Progress</h3>

      {/* Progress visualization */}
      <div className="flex h-6 gap-1 rounded-full overflow-hidden bg-gray-100 mb-4">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
        <div className="h-full bg-gray-300 flex-1" />
      </div>

      {/* Progress details */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Paid</p>
          <p className="text-lg font-bold text-emerald-600">
            {Math.round(progressPercent)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">KES {Number(paid).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Due</p>
          <p className="text-lg font-bold text-amber-600">
            {Math.round(remainingPercent)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">KES {Number(outstanding).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Fees</p>
          <p className="text-lg font-bold text-gray-900">
            100%
          </p>
          <p className="text-xs text-gray-400 mt-1">KES {Number(total).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function FeeBreakdownCard({ breakdown }) {
  const items = breakdown || [
    { category: 'Tuition', amount: 50000, status: 'PAID', paid: 50000 },
    { category: 'Transport', amount: 15000, status: 'PAID', paid: 15000 },
    { category: 'Activity', amount: 5000, status: 'PARTIALLY_PAID', paid: 2500 },
    { category: 'Exams', amount: 3000, status: 'UNPAID', paid: 0 },
    { category: 'Meals', amount: 8000, status: 'UNPAID', paid: 0 },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: '✓ Paid' };
      case 'PARTIALLY_PAID':
        return { bg: 'bg-amber-50', text: 'text-amber-700', label: '◐ Partial' };
      case 'UNPAID':
        return { bg: 'bg-rose-50', text: 'text-rose-700', label: '◯ Unpaid' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', label: status };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Fee Breakdown</h3>
      
      <div className="space-y-2">
        {items.map((item, idx) => {
          const badge = getStatusBadge(item.status);
          const outstanding = item.amount - item.paid;

          return (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{item.category}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.paid > 0 && `KES ${Number(item.paid).toLocaleString()} paid • `}
                  {outstanding > 0 ? `KES ${Number(outstanding).toLocaleString()} outstanding` : 'Complete'}
                </p>
              </div>
              <div className={`px-2.5 py-1 rounded-lg font-semibold text-xs ${badge.bg} ${badge.text}`}>
                {badge.label}
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full mt-3 text-brand-purple font-semibold py-2 text-sm hover:bg-brand-purple/5 rounded-lg transition flex items-center justify-center gap-2">
        Download Detailed Breakdown <ChevronRight size={16} />
      </button>
    </div>
  );
}

function RecentTransactionsCard({ transactions }) {
  const recentTxns = (transactions || []).slice(0, 5);

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'PAYMENT':
        return { icon: TrendingDown, color: 'text-emerald-600 bg-emerald-50' };
      case 'INVOICE':
        return { icon: FileText, color: 'text-blue-600 bg-blue-50' };
      case 'CREDIT':
        return { icon: CheckCircle, color: 'text-purple-600 bg-purple-50' };
      case 'WAIVER':
        return { icon: Wallet, color: 'text-amber-600 bg-amber-50' };
      default:
        return { icon: DollarSign, color: 'text-gray-600 bg-gray-50' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Recent Transactions</h3>
        <button className="text-brand-purple text-xs font-semibold hover:bg-brand-purple/5 px-2 py-1 rounded">
          View All
        </button>
      </div>

      {recentTxns.length > 0 ? (
        <div className="space-y-2">
          {recentTxns.map((txn, idx) => {
            const txnIcon = getTransactionIcon(txn.type);
            const Icon = txnIcon.icon;

            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${txnIcon.color}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{txn.description || txn.type}</p>
                  <p className="text-xs text-gray-500">{txn.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${
                    txn.type === 'PAYMENT' 
                      ? 'text-emerald-600' 
                      : txn.type === 'INVOICE'
                      ? 'text-rose-600'
                      : 'text-gray-900'
                  }`}>
                    {txn.type === 'PAYMENT' ? '-' : '+'} KES {Number(txn.amount).toLocaleString()}
                  </p>
                  <p className={`text-xs font-semibold mt-0.5 ${getStatusBadge(txn.status)}`}>
                    {txn.status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center py-6 text-gray-400 text-sm">No transactions yet</p>
      )}
    </div>
  );
}

function PaymentMethodsCard({ onPayNow }) {
  const methods = [
    { id: 'card', name: 'Credit/Debit Card', icon: Wallet },
    { id: 'bank', name: 'Bank Transfer', icon: DollarSign },
    { id: 'mobile', name: 'Mobile Money', icon: Phone },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Payment Methods</h3>
      
      <div className="space-y-2 mb-4">
        {methods.map((method) => {
          const Icon = method.icon;
          return (
            <button
              key={method.id}
              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-left"
            >
              <Icon size={20} className="text-brand-purple flex-shrink-0" />
              <span className="font-semibold text-gray-900">{method.name}</span>
              <ChevronRight size={16} className="ml-auto text-gray-400" />
            </button>
          );
        })}
      </div>

      <button
        onClick={onPayNow}
        className="w-full bg-brand-purple text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2"
      >
        <DollarSign size={18} />
        Pay Now
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalFees = ({ user, onNavigate }) => {
  const [feesData, setFeesData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeesData = async () => {
      try {
        const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
        if (response.success) {
          const firstChild = response.data?.children?.[0];
          if (firstChild) {
            setFeesData({
              outstandingBalance: firstChild.feeBalance || 0,
              amountDue: firstChild.amountDue || 0,
              nextPaymentDate: firstChild.nextPaymentDate,
              totalFees: firstChild.totalFees || 50000,
              paidAmount: firstChild.paidAmount || 0,
              dueDate: firstChild.dueDate,
              statusMessage: firstChild.feeBalance > 0 ? 'Payment Due' : 'All Paid',
              breakdown: firstChild.feeBreakdown || [],
              transactions: firstChild.transactions || [],
            });
          }
        }
      } catch (error) {
        console.error('Failed to load fees data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFeesData();
  }, []);

  const handlePayNow = () => {
    // This would typically open a payment gateway or form
    // For now, navigate to payment processing
    alert('Payment gateway would open here');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('parent-portal-home')}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">School Fees</h1>
            <p className="text-xs text-gray-500">Payment & Fee Management</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-4">
        {loading ? (
          <>
            <div className="h-40 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            <div className="h-32 bg-white rounded-2xl border border-gray-200 animate-pulse" />
          </>
        ) : feesData ? (
          <>
            {/* Outstanding Balance */}
            <OutstandingBalanceCard
              balance={feesData.outstandingBalance}
              dueDate={feesData.dueDate}
              statusMessage={feesData.statusMessage}
            />

            {/* Payment Progress */}
            <PaymentProgressCard
              paid={feesData.paidAmount}
              outstanding={feesData.outstandingBalance}
              total={feesData.totalFees}
            />

            {/* Fee Breakdown */}
            <FeeBreakdownCard breakdown={feesData.breakdown} />

            {/* Recent Transactions */}
            <RecentTransactionsCard transactions={feesData.transactions} />

            {/* Payment Methods & Pay Button */}
            <PaymentMethodsCard onPayNow={handlePayNow} />

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h3 className="font-semibold text-blue-900 mb-2">❓ Need Help?</h3>
              <p className="text-sm text-blue-800 mb-3">
                For payment issues or fee inquiries, contact the school finance office.
              </p>
              <button className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-2">
                Contact Finance Office <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-1">No Fee Data Available</h3>
            <p className="text-sm text-gray-500">Contact your school to set up fee management</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalFees;
