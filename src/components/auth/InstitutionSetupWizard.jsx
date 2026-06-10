/**
 * InstitutionSetupWizard
 *
 * Shown immediately after login when requiresInstitutionSetup === true
 * (i.e. after a whole-institution factory reset).
 *
 * The admin picks the institution type → we call POST /schools/institution-type/lock
 * to save + lock the choice → then navigate into the app.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { configAPI, schoolAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

const INSTITUTION_TYPES = [
  {
    value: 'PRIMARY_CBC',
    label: 'Junior School',
    subtitle: 'CBC Curriculum (Pre-Primary → Grade 9)',
    description:
      'For Early Years (PP1 / PP2) through Junior Secondary (Grade 7–9). Includes CBC grading, learning areas, formative & summative assessments.',
    icon: '🏫',
    color: 'from-indigo-600 to-indigo-500',
    border: 'border-indigo-200',
    bg: 'bg-indigo-50',
    badge: 'bg-indigo-100 text-indigo-700',
    badgeLabel: 'Primary CBC',
  },
  {
    value: 'SECONDARY',
    label: 'Senior School',
    subtitle: 'CBC Senior Secondary (Grade 10–12)',
    description:
      'For Senior Secondary with CBC Pathways (STEM / Social Sciences / Arts & Sports). Supports KCSE preparation, CATs, and end-term exams.',
    icon: '🎓',
    color: 'from-emerald-600 to-emerald-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeLabel: 'Senior CBC',
  },
  {
    value: 'TERTIARY',
    label: 'Tertiary Institution',
    subtitle: 'College / University / TVETs',
    description:
      'For colleges, polytechnics, and universities. Supports departments, programs, units, CATs (30%) + exams (70%), GPA calculation, and transcripts.',
    icon: '🏛️',
    color: 'from-violet-600 to-violet-500',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    badgeLabel: 'Tertiary',
  },
];

const InstitutionSetupWizard = ({ brandingSettings, onComplete }) => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const logoUrl = brandingSettings?.logoUrl || '/branding/logo.png';
  const schoolName = brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME;

  const handleConfirm = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      const res = await schoolAPI.lockInstitutionType(selected);

      if (!res?.success) {
        toast.error(res?.message || 'Failed to save institution type. Please try again.');
        return;
      }

      // Patch the in-memory user: institution locked and setup done.
      updateUser({
        institutionType: selected,
        institutionTypeLocked: true,
        requiresInstitutionSetup: false,
      });

      toast.success('Institution configured! Setting up your dashboard…');

      // For Junior School (PRIMARY_CBC), seed baseline academic data so the
      // user can immediately use Learning Areas + Subject Allocation flows.
      if (selected === 'PRIMARY_CBC') {
        try {
          const clsRes = await configAPI.seedClasses();
          const createdClasses = clsRes?.created ?? clsRes?.data?.created;
          const skippedClasses = clsRes?.skipped ?? clsRes?.data?.skipped;
          toast.success(
            `Junior classes seeded${typeof createdClasses === 'number' ? ` (created ${createdClasses}, skipped ${skippedClasses ?? 0})` : ''}.`
          );
        } catch (e) {
          console.warn('Auto-seed classes failed:', e);
        }

        try {
          const laRes = await configAPI.seedLearningAreas();
          const createdAreas = laRes?.created ?? laRes?.data?.created;
          const skippedAreas = laRes?.skipped ?? laRes?.data?.skipped;
          toast.success(
            `Junior learning areas seeded${typeof createdAreas === 'number' ? ` (created ${createdAreas}, skipped ${skippedAreas ?? 0})` : ''}.`
          );
        } catch (e) {
          console.warn('Auto-seed learning areas failed:', e);
        }
      }

      if (typeof onComplete === 'function') {
        onComplete(selected);
      } else {
        setTimeout(() => navigate('/app', { replace: true }), 600);
      }
    } catch (err) {
      console.error('Institution setup error:', err);
      toast.error(err?.message || 'Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-10 text-center max-w-xl">
        <img
          src={logoUrl}
          alt={schoolName}
          className="mx-auto h-16 w-auto object-contain mb-5 drop-shadow"
          onError={(e) => { e.target.src = '/branding/logo.png'; }}
        />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-200 mb-5">
          <span className="text-amber-600 text-xs font-bold uppercase tracking-widest">Initial Setup Required</span>
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
          Configure Your Institution
        </h1>
        <p className="mt-3 text-slate-500 text-sm leading-relaxed">
          This is a one-time step after an institution reset. Choose the type of institution you are running.
          This choice shapes the modules, grade structure, and assessment flows available across the system.
          <strong className="text-slate-700"> It cannot be changed later without another factory reset.</strong>
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mb-8">
        {INSTITUTION_TYPES.map((type) => {
          const isSelected = selected === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setSelected(type.value)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none
                ${isSelected
                  ? `${type.border} ring-2 ring-offset-2 ring-current bg-white shadow-lg`
                  : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
            >
              {/* Selection indicator */}
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                ${isSelected ? 'border-current bg-current' : 'border-slate-300 bg-white'}`}
                style={isSelected ? { borderColor: 'currentColor' } : {}}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${type.bg} text-2xl mb-4`}>
                {type.icon}
              </div>

              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mb-2 ${type.badge}`}>
                {type.badgeLabel}
              </span>

              <h3 className="text-base font-semibold text-slate-900 mb-1">{type.label}</h3>
              <p className="text-xs font-medium text-slate-500 mb-3">{type.subtitle}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{type.description}</p>
            </button>
          );
        })}
      </div>

      {/* Action */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || saving}
          className={`w-full py-3 px-6 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all shadow-lg
            ${selected && !saving
              ? 'bg-[var(--brand-purple)] text-white hover:opacity-90 active:scale-95'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Configuring…
            </span>
          ) : (
            selected
              ? `Confirm — ${INSTITUTION_TYPES.find(t => t.value === selected)?.label}`
              : 'Select an institution type to continue'
          )}
        </button>

        {selected && !saving && (
          <p className="text-[10px] text-slate-400 text-center">
            You are configuring as <strong className="text-slate-600">{INSTITUTION_TYPES.find(t => t.value === selected)?.label}</strong>.
            This will lock the institution type and cannot be undone without a factory reset.
          </p>
        )}
      </div>
    </div>
  );
};

export default InstitutionSetupWizard;
