import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles, Target, Heart, School, ClipboardList, ArrowRight, ChevronRight, Download } from 'lucide-react';
import { usePathwayStore } from '../../../../store/usePathwayStore';
import { dashboardAPI, pathwayAPI, seniorPathwayAPI, pathwayPlannerAPI, careerAPI } from '../../../../services/api';

import RecommendationTab from './tabs/RecommendationTab';
import CareersTab from './tabs/CareersTab';
import CombinationsTab from './tabs/CombinationsTab';
import SchoolsTab from './tabs/SchoolsTab';
import DecisionPlanTab from './tabs/DecisionPlanTab';

const TABS_JUNIOR = [
  { id: 'discover', label: 'Discover Me', icon: Sparkles },
  { id: 'recommendation', label: 'Recommendation', icon: Target },
  { id: 'careers', label: 'Careers', icon: Heart },
  { id: 'schools', label: 'Schools', icon: School },
  { id: 'combinations', label: 'Combinations', icon: ClipboardList },
  { id: 'decision', label: 'Decision Plan', icon: ClipboardList },
];

const TABS_SENIOR = [
  { id: 'recommendation', label: 'My Pathway', icon: Target },
  { id: 'selection', label: 'Selection', icon: ClipboardList },
  { id: 'progress', label: 'Progress', icon: Sparkles },
  { id: 'decision', label: 'Decision Plan', icon: ClipboardList },
];

const normalizeGrade = (value) => String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '');

const isSeniorExecutionLearner = (metrics, user) => {
  const learner = metrics?.learner || metrics?.profile || {};
  const grade = normalizeGrade(learner?.grade || metrics?.grade);
  if (['GRADE10', 'GRADE11', 'GRADE12', 'FORM1', 'FORM2', 'FORM3', 'FORM4'].includes(grade)) return true;
  if (['GRADE7', 'GRADE8', 'GRADE9'].includes(grade)) return false;
  return String(learner?.institutionType || metrics?.institutionType || user?.institutionType || '').toUpperCase() === 'SECONDARY';
};

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

export default function StudentPathwayDashboard({ user, onNavigate, brandingSettings }) {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seniorExecution, setSeniorExecution] = useState(false);
  const hasAppliedInitialTab = useRef(false);

  const {
    learnerId,
    setLearnerId,
    setStage,
    setMode,
    setActiveTab,
    recommendation,
    selection,
    decisionPlan,
    profile,
    schoolPreferences,
    savedCareers,
    schoolMatches,
    stage,
    mode,
    activeTab,
    isLoading: storeLoading,
    setRecommendation,
    setSelection,
    setDecisionPlan,
    setProfile,
    setSchoolPreferences,
    setSavedCareers,
    setSchoolMatches,
    setLoading: setStoreLoading,
  } = usePathwayStore();

  // Initialize from URL or default
  const initialTab = searchParams.get('tab') || 'recommendation';

  useEffect(() => {
    if (hasAppliedInitialTab.current) return;
    setActiveTab(initialTab);
    hasAppliedInitialTab.current = true;
  }, [initialTab, setActiveTab]);

  // Load all data
  const loadAllData = useCallback(async () => {
    if (!learnerId) return;

    setStoreLoading('dashboard', true);
    setLoading(true);
    setError(null);

    try {
      setMode('student');

      // Load all data in parallel
      const [
        recResult,
        selResult,
        planResult,
        profileResult,
        careersResult,
        schoolsResult,
        matchesResult,
      ] = await Promise.allSettled([
        pathwayAPI.getRecommendation(learnerId, {
          term: new Date().getMonth() <= 3 ? 'TERM_1' : new Date().getMonth() <= 7 ? 'TERM_2' : 'TERM_3',
          academicYear: new Date().getFullYear()
        }),
        seniorExecution ? seniorPathwayAPI.getLearnerSelection(learnerId) : Promise.resolve({ data: null }),
        pathwayPlannerAPI.getDecisionPlan(learnerId),
        pathwayPlannerAPI.getPathwayProfile(learnerId),
        careerAPI.getSavedCareers(learnerId),
        pathwayPlannerAPI.getSchoolPreferences(learnerId),
        pathwayPlannerAPI.getSchoolMatches(learnerId),
      ]);

      if (recResult.status === 'fulfilled') {
        const rec = recResult.value?.data?.prediction ?? recResult.value?.data;
        setRecommendation(rec);
      }

      if (selResult.status === 'fulfilled') {
        setSelection(selResult.value?.data || null);
      }

      if (planResult.status === 'fulfilled') {
        setDecisionPlan(planResult.value?.data || null);
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value?.data || null);
      }

      if (careersResult.status === 'fulfilled') {
        setSavedCareers(careersResult.value?.data || []);
      }

      if (schoolsResult.status === 'fulfilled') {
        setSchoolPreferences(schoolsResult.value?.data || []);
      }

      if (matchesResult.status === 'fulfilled') {
        setSchoolMatches(matchesResult.value?.data || []);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load pathway data');
    } finally {
      setLoading(false);
      setStoreLoading('dashboard', false);
    }
  }, [learnerId, seniorExecution, setMode, setRecommendation, setSelection, setDecisionPlan, setProfile, setSavedCareers, setSchoolPreferences, setSchoolMatches, setStoreLoading]);

  // Load metrics first to get learnerId
  useEffect(() => {
    let cancelled = false;
    dashboardAPI.getStudentMetrics()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || res;
        const lid = data?.learner?.id || data?.learnerId || data?.profile?.id;
        const isSeniorExecution = isSeniorExecutionLearner(data, user);
        setSeniorExecution(isSeniorExecution);
        setStage(isSeniorExecution ? 'senior' : 'junior');
        if (lid) {
          setLearnerId(lid);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load profile');
      });
    return () => { cancelled = true; };
  }, [setLearnerId, setStage, user]);

  // Load all data when learnerId is available
  useEffect(() => {
    if (learnerId) {
      loadAllData();
    }
  }, [learnerId, loadAllData]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const tabs = stage === 'senior' ? TABS_SENIOR : TABS_JUNIOR;
  const activeTabInfo = tabs.find(t => t.id === activeTab) || tabs[0];

  // Keep workflow state keyed to actual tab ids. The former positional array
  // treated the decision-plan state as the combinations step, so an already
  // active Combinations tab could offer "Continue to Combinations" forever.
  const journeySteps = stage === 'junior'
    ? [
        { tabId: 'discover', done: profile?.interestAreas?.length > 0 && profile?.strengthAreas?.length > 0 && !!profile?.learningPreference },
        { tabId: 'recommendation', done: !!recommendation?.predictedPathway },
        { tabId: 'careers', done: savedCareers.length > 0 },
        { tabId: 'schools', done: schoolPreferences.length > 0 },
        { tabId: 'combinations', done: !!selection?.combinationRule?.id },
        { tabId: 'decision', done: ['SUBMITTED', 'PARENT_REVIEWED', 'COUNSELLOR_REVIEWED', 'APPROVED', 'LOCKED'].includes(decisionPlan?.status) },
      ]
    : [
        { tabId: 'recommendation', done: !!recommendation?.predictedPathway },
        { tabId: 'selection', done: !!selection },
        { tabId: 'progress', done: ['SUBMITTED', 'PARENT_REVIEWED', 'COUNSELLOR_REVIEWED', 'APPROVED', 'LOCKED'].includes(decisionPlan?.status) },
        { tabId: 'decision', done: decisionPlan?.status === 'LOCKED' },
      ];

  const firstIncompleteStep = journeySteps.findIndex((step) => !step.done);
  const completedSteps = journeySteps.filter((step) => step.done).length;
  const progressData = {
    percent: Math.round((completedSteps / journeySteps.length) * 100),
    nextStep: firstIncompleteStep,
  };
  const currentStepIndex = journeySteps.findIndex((step) => step.tabId === activeTab);
  const nextStep = journeySteps.find((step, index) => index > currentStepIndex && !step.done);
  const nextTab = nextStep ? tabs.find((tab) => tab.id === nextStep.tabId) : null;

  if (loading && !learnerId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-[#06285a] px-4 pt-6 pb-8">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="px-4 -mt-4 space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">{error}</p>
          <button
            type="button"
            onClick={loadAllData}
            className="mt-3 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!learnerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const currentTabContent = () => {
    switch (activeTab) {
      case 'discover':
        return <RecommendationTab learnerId={learnerId} mode="discover" recommendation={recommendation} profile={profile} onSaved={loadAllData} />;
      case 'recommendation':
        return <RecommendationTab learnerId={learnerId} mode="recommendation" recommendation={recommendation} />;
      case 'careers':
        return <CareersTab learnerId={learnerId} savedCareers={savedCareers} onNavigate={onNavigate} />;
      case 'schools':
        return <SchoolsTab learnerId={learnerId} schoolPreferences={schoolPreferences} schoolMatches={schoolMatches} onChanged={loadAllData} />;
      case 'combinations':
        return <CombinationsTab learnerId={learnerId} recommendation={recommendation} selection={selection} stage={stage} />;
      case 'selection':
        return <CombinationsTab learnerId={learnerId} recommendation={recommendation} selection={selection} stage="senior" mode="selection" />;
      case 'progress':
        return <DecisionPlanTab learnerId={learnerId} mode="progress" decisionPlan={decisionPlan} recommendation={recommendation} selection={selection} />;
      case 'decision':
        return <DecisionPlanTab learnerId={learnerId} mode="decision" decisionPlan={decisionPlan} recommendation={recommendation} selection={selection} onChanged={loadAllData} />;
      default:
        return <RecommendationTab learnerId={learnerId} mode="recommendation" recommendation={recommendation} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#06285a] px-4 pt-6 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-0.5">
              My Future
            </p>
            <h1 className="text-white text-2xl font-black">Pathway Journey</h1>
            <p className="text-white/60 text-[11px] mt-1">
              {stage === 'senior' ? 'Senior Secondary (Grade 10–12)' : 'Junior Secondary (Grade 7–9)'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('pathway-guide')}
            className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[10px] font-black text-white hover:bg-white/20"
          >
            Pathway Guide
          </button>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* Progress Header */}
        <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Journey Progress</p>
              <p className="mt-1 text-xs font-bold text-gray-800">
                {progressData.percent}% complete
                {firstIncompleteStep >= 0 && <span className="ml-2 text-indigo-600">· Next: {tabs.find((tab) => tab.id === journeySteps[firstIncompleteStep]?.tabId)?.label}</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-indigo-700">{progressData.percent}%</p>
              <p className="text-[9px] font-bold text-gray-400">complete</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressData.percent}%` }} />
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-3 md:grid-cols-6">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                className={`rounded-lg border p-1.5 text-center text-[8px] font-black ${
                  index < progressData.nextStep || (progressData.nextStep === -1 && index < tabs.length)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : index === progressData.nextStep
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                {index < progressData.nextStep || (progressData.nextStep === -1 && index < tabs.length) ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 mx-auto mb-0.5 rounded-full bg-emerald-500 text-white text-[8px]">✓</span>
                ) : (
                  <span className="inline-flex items-center justify-center w-5 h-5 mx-auto mb-0.5 rounded-full bg-gray-200 text-gray-400 text-[8px]">{index + 1}</span>
                )}
                <span className="mt-1 block truncate">{tab.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Stats Cards */}
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-[9px] font-black uppercase text-indigo-600">Current Pathway</p>
            <p className="mt-1 text-xs font-black text-gray-900">
              {selection?.pathway?.name || recommendation?.predictedPathway || 'Not set'}
            </p>
            <p className="text-[10px] text-gray-600">
              {selection?.combinationRule?.name || 'Combination not selected'}
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600">
              <Heart size={9} /> Saved Careers
            </p>
            <div className="mt-1 space-y-0.5">
              {savedCareers.length ? savedCareers.slice(0, 3).map((item) => (
                <p key={item.id} className="truncate text-[10px] font-bold text-gray-800">{item.career?.title}</p>
              )) : (
                <p className="text-[10px] text-gray-500">None saved</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600">
              <School size={9} /> Shortlisted Schools
            </p>
            <div className="mt-1 space-y-0.5">
              {schoolPreferences.length ? schoolPreferences.slice(0, 3).map((item) => (
                <p key={item.id} className="truncate text-[10px] font-bold text-gray-800">#{item.rank} {item.school?.name}</p>
              )) : (
                <p className="text-[10px] text-gray-500">None shortlisted</p>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="rounded-2xl border border-gray-200 bg-white p-1 shadow-sm" aria-label="Pathway sections">
          <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-shrink-0 rounded-xl px-3 py-2 text-center transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#06285a] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <tab.icon size={14} aria-hidden="true" />
                  <span className="text-[11px] font-black">{tab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {storeLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#06285a]" />
            </div>
          ) : (
            currentTabContent()
          )}
        </div>

        {/* Workflow action belongs after the current step's content. */}
        {nextTab && (
          <div className="flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
          onClick={() => {
            handleTabChange(nextTab.id);
            window.requestAnimationFrame(() => {
              document.querySelector('[role="tablist"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Continue to {nextTab.label} <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Download PDF */}
        {recommendation && (
          <button
            type="button"
            onClick={async () => {
              // PDF generation logic here
            }}
            className="w-full rounded-2xl border border-[#06285a]/20 bg-[#06285a]/5 py-3 text-sm font-black text-[#06285a] flex items-center justify-center gap-2 hover:bg-[#06285a]/10 transition-colors"
          >
            <Download size={14} aria-hidden="true" />
            Download Pathway Plan (PDF)
          </button>
        )}
      </div>
    </div>
  );
}
