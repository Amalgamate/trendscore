import React from 'react';
import { ArrowRight, BarChart3, FileText, TrendingUp } from "lucide-react";

const Card = ({ title, description, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50 transition"
  >
    <div className="flex items-start gap-3">
      <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-2 text-emerald-800">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-xs font-medium text-gray-600">{description}</div>
      </div>
      <ArrowRight className="text-gray-400" size={18} />
    </div>
  </button>
);

const ReportsHub = ({ onNavigate }) => {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm font-medium text-gray-600">
          Senior School reporting built on the CBC assessment module.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          icon={FileText}
          title="Learner Reports"
          description="Choose between official report cards and compact summative learner sheets."
          onClick={() => onNavigate?.('assess-learner-reports')}
        />
        <Card
          icon={TrendingUp}
          title="Summative Sheets"
          description="Generate compact learner, grade, and stream performance sheets."
          onClick={() => onNavigate?.('assess-summative-report')}
        />
        <Card
          icon={BarChart3}
          title="Class Analytics"
          description="Use Analytics pages inside the assessment module."
          onClick={() => onNavigate?.('assess-summative-assessment')}
        />
      </div>
    </div>
  );
};

export default ReportsHub;
