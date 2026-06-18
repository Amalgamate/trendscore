/**
 * Summative Test Creation Page - Single Test Form
 * Redesigned with premium Shadcn UI and Brand Colors (Purple & Teal)
 */

import React from 'react';
import {
  ArrowLeft, Check, AlertCircle, RefreshCw,
  ClipboardList, Layers, Clock,
  Database, Zap, ShieldCheck, ListChecks,
  Target, FileText
} from 'lucide-react';
import { useSummativeTestForm } from '../../hooks/useSummativeTestForm';
import { useAuth } from '../../hooks/useAuth';

// Premium UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const SummativeTestFormDesktop = ({ onBack, onSuccess, initialTestType = null, initialData = null }) => {
  const { user } = useAuth();
  const {
    formData,
    scales,
    grades,
    terms,
    errors,
    saveStatus,
    saving,
    loadingScales,
    loadingGrades,
    testTypes,
    availableLearningAreas,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    getSelectedScale
  } = useSummativeTestForm({ initialTestType, initialData });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const createdTest = await originalHandleSubmit(e);
      if (createdTest && onSuccess) {
        onSuccess(createdTest);
      }
    } catch (error) {
      // Error managed in hook
    }
  };

  const selectedScale = getSelectedScale();

  return (
    <div className="min-h-screen bg-[#fcfdff] pb-20">
      {/* Sticky Action Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-purple-100 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="rounded-full hover:bg-purple-50 hover:text-brand-purple border-purple-100 transition-all"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Construct New Test</h1>
              <div className="flex items-center gap-2 text-[10px] text-brand-purple font-semibold uppercase tracking-widest">
                <FileText size={12} className="fill-brand-purple/10" />
                <span>Summative Assessment Engine</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-brand-teal bg-brand-teal/5 px-4 py-1.5 rounded-full border border-brand-teal/20 animate-in fade-in zoom-in duration-300">
                <Check size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Saved Successfully</span>
              </div>
            )}
            <Button
              variant="ghost"
              onClick={onBack}
              className="hidden md:flex text-slate-500 font-medium"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-purple hover:bg-brand-purple/90 text-white px-8 rounded-full shadow-lg shadow-brand-purple/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Deploy Test</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>

          {/* Test Title */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">
              Test Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Mathematics End Term 1 Evaluation"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`h-12 text-base border-slate-200 focus-visible:ring-brand-purple ${errors.title ? 'border-red-400' : ''}`}
            />
            {errors.title && <p className="text-[10px] text-red-500 font-medium uppercase mt-1">{errors.title}</p>}
          </div>

          {/* Assessment Type & Term */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Assessment Type</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
              >
                <option value="">Select Type</option>
                {testTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.type && <p className="text-[10px] text-red-500 font-medium uppercase">{errors.type}</p>}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Academic Term</label>
              <select
                value={formData.term}
                onChange={(e) => handleInputChange('term', e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                disabled={loadingGrades}
              >
                <option value="">Select Term</option>
                {terms.map(term => (
                  <option key={term.value} value={term.value}>{term.label}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Target Grade & Learning Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Target Grade</label>
              <select
                value={formData.grade}
                onChange={(e) => handleInputChange('grade', e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none text-sm font-medium text-slate-700"
                disabled={loadingGrades}
              >
                <option value="">Choose Level</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>
                    {grade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
              {errors.grade && <p className="text-[10px] text-red-500 font-medium uppercase mt-1">{errors.grade}</p>}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Learning Area / Subject</label>
              <select
                value={formData.learningArea}
                onChange={(e) => handleInputChange('learningArea', e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none text-sm font-medium text-slate-700"
                disabled={!formData.grade}
              >
                <option value="">{formData.grade ? 'Select Subject' : 'Select Grade first'}</option>
                {formData.grade && availableLearningAreas.map(area => (
                  <option key={area.id || area.name} value={area.name}>{area.name}</option>
                ))}
              </select>
              {errors.learningArea && <p className="text-[10px] text-red-500 font-medium uppercase mt-1">{errors.learningArea}</p>}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Total Marks</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.totalMarks}
                  onChange={(e) => handleInputChange('totalMarks', e.target.value)}
                  className="h-11 border-slate-200 font-medium text-brand-purple"
                />
                <span className="text-slate-400 text-xs font-medium shrink-0">PTS</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Pass Threshold</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.passMarks}
                  onChange={(e) => handleInputChange('passMarks', e.target.value)}
                  className="h-11 border-slate-200 font-medium text-brand-purple"
                />
                <span className="text-slate-400 text-xs font-medium shrink-0">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Duration</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    className="h-11 border-slate-200 font-medium text-brand-purple pl-9"
                  />
                  <Clock className="absolute left-3 top-3 text-slate-300" size={16} />
                </div>
                <span className="text-slate-400 text-xs font-medium shrink-0">MIN</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Performance Scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Performance Scale</label>
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('pageNavigate', {
                    detail: { page: 'settings-academic', params: { tab: 'performance-levels' } }
                  }))}
                  className="text-[10px] font-medium text-brand-purple hover:underline"
                >
                  Manage in Settings
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={formData.scaleId}
                onChange={(e) => handleInputChange('scaleId', e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none appearance-none font-medium text-slate-700 text-sm"
                disabled={loadingScales}
              >
                <option value="">Select Scale Protocol</option>
                {scales
                  .filter(s => {
                    if (s.type !== 'SUMMATIVE') return false;
                    if (!formData.grade) return true;
                    const gradeMatch = s.grade === formData.grade ||
                      (s.name && s.name.toUpperCase().includes(formData.grade.toUpperCase().replace(/_/g, ' ')));
                    if (!gradeMatch) return false;
                    // If a learning area is selected, further filter by it
                    if (formData.learningArea) {
                      return s.name && s.name.toLowerCase().includes(formData.learningArea.toLowerCase());
                    }
                    return true;
                  })
                  .map(scale => (
                    <option key={scale.id} value={scale.id}>{scale.name}</option>
                  ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-brand-purple opacity-40">
                {loadingScales ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {formData.learningArea
                ? `Showing scales matched to "${formData.learningArea}" — auto-selected if available.`
                : 'Select a learning area first to auto-match the scale.'}
            </p>
          </div>

        </form>
      </div>


      {/* Global Errors */}
      {errors.submit && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-500">
          <div className="bg-red-950 text-white border border-red-900/50 p-6 rounded-[2rem] shadow-2xl flex items-center gap-6 max-w-xl">
            <div className="h-12 w-12 bg-red-900/50 rounded-2xl flex items-center justify-center shrink-0">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-semibold uppercase text-red-200 tracking-widest">Initialization Blocked</h4>
              <p className="text-xs font-medium text-red-300 leading-relaxed">{errors.submit}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleInputChange('submit', null)}
              className="text-white hover:bg-white/10"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummativeTestFormDesktop;
