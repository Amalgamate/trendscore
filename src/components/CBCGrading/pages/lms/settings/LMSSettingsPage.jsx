import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Loader2,
  Save,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  Upload,
  Users,
} from 'lucide-react';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { useNotifications } from '../../../hooks/useNotifications';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { cn } from '../../../../../utils/cn';

// ─── Default settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  // General
  enableLearning: true,
  enableMarketplace: false,
  enableAI: false,
  enableRevisionLibrary: true,
  // Submissions
  allowLateSubmission: true,
  allowResubmission: false,
  maxUploadSizeMB: 25,
  allowedFileTypes: ['pdf', 'docx', 'pptx', 'jpg', 'png', 'mp4'],
  assignmentDueTime: '23:59',
  // Lessons
  enableComments: true,
  enableStudentQuestions: true,
  enableDownloads: false,
  // Gamification
  enableGamification: false,
  enableXP: false,
  enableBadges: false,
  enableLeaderboards: false,
  enableStreaks: false,
  // Parents
  notifyParents: true,
  showFeedbackToParents: true,
  showProgressToParents: true,
  // Marketplace
  marketplaceRevenuePct: 70,
  requireApproval: true,
  allowFreeContent: true,
};

// ─── Reusable sub-components ─────────────────────────────────────────────────

function ToggleField({ label, description, checked, onChange, disabled = false }) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-4 transition-colors',
        disabled
          ? 'cursor-not-allowed border-gray-100 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-brand-purple/30',
      )}
    >
      <span className="min-w-0">
        <span className={cn('block text-sm font-semibold', disabled ? 'text-gray-400' : 'text-gray-950')}>
          {label}
        </span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-200'
            : checked
            ? 'border-brand-purple bg-brand-purple'
            : 'border-gray-300 bg-gray-100',
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

function NumberField({ label, description, value, min, max, unit, onChange, disabled = false }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-sm font-semibold text-gray-950">{label}</label>
      {description && (
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'h-10 w-28 rounded-md border px-3 text-sm font-semibold outline-none',
            'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
            disabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : 'border-gray-300 bg-white text-gray-950',
          )}
        />
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

function TextField({ label, description, value, placeholder, onChange, disabled = false }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-sm font-semibold text-gray-950">{label}</label>
      {description && (
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      )}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'mt-3 h-10 w-full rounded-md border px-3 text-sm outline-none',
          'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
            : 'border-gray-300 bg-white text-gray-950',
        )}
      />
    </div>
  );
}

function TimeField({ label, description, value, onChange, disabled = false }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-sm font-semibold text-gray-950">{label}</label>
      {description && (
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      )}
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'mt-3 h-10 rounded-md border px-3 text-sm outline-none',
          'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
            : 'border-gray-300 bg-white text-gray-950',
        )}
      />
    </div>
  );
}

// ─── Accordion section ───────────────────────────────────────────────────────

function SettingsSection({ title, icon: Icon, iconColor = 'text-brand-purple', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100', iconColor)}>
            <Icon size={16} />
          </span>
          <span className="text-sm font-bold text-gray-950">{title}</span>
        </div>
        {open ? (
          <ChevronDown size={16} className="flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={16} className="flex-shrink-0 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Permission gate ──────────────────────────────────────────────────────────

function PermissionDenied() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <ShieldAlert size={36} className="text-red-400" />
      <div>
        <p className="text-base font-bold text-red-900">Access Restricted</p>
        <p className="mt-1 text-sm text-red-700">
          You need the <strong>Learning Manage</strong> permission to configure LMS settings.
          Contact your school administrator.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LMSSettingsPage() {
  const { can } = usePermissions();
  const { showSuccess, showError } = useNotifications();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Permission gate — render nothing useful until we know if user can manage
  const canManage = can('LEARNING_MANAGE');

  // Fetch on mount
  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    lmsAPI
      .getSettings()
      .then((response) => {
        if (!cancelled) {
          const data = response?.data ?? response ?? {};
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            allowedFileTypes: Array.isArray(data.allowedFileTypes)
              ? data.allowedFileTypes
              : DEFAULT_SETTINGS.allowedFileTypes,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showError(err?.message || 'Failed to load LMS settings. Defaults are shown.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, showError]);

  const update = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await lmsAPI.updateSettings(settings);
      const saved = response?.data ?? response ?? {};
      setSettings({
        ...DEFAULT_SETTINGS,
        ...saved,
        allowedFileTypes: Array.isArray(saved.allowedFileTypes)
          ? saved.allowedFileTypes
          : DEFAULT_SETTINGS.allowedFileTypes,
      });
      showSuccess('LMS settings saved successfully.');
    } catch (err) {
      showError(err?.message || 'Failed to save LMS settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[var(--app-page-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <Settings2 size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-950">LMS Settings</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Configure learning, submissions, gamification, and more for your school.
              </p>
            </div>
          </div>
          {canManage && !loading && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white',
                'bg-brand-purple hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60',
                'w-full sm:w-auto',
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={15} />
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>

        {/* ── Permission denied ── */}
        {!canManage && <PermissionDenied />}

        {/* ── Loading skeleton ── */}
        {canManage && loading && <LoadingSkeleton />}

        {/* ── Settings sections ── */}
        {canManage && !loading && (
          <>
            {/* ── General ── */}
            <SettingsSection
              title="General"
              icon={BookOpen}
              iconColor="text-blue-600"
              defaultOpen
            >
              <p className="mb-4 text-xs text-gray-500">
                Enable or disable the top-level LMS features for your school.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Enable Learning Hub"
                  description="Master switch. Disabling hides the Learning module from all users."
                  checked={settings.enableLearning}
                  onChange={(v) => update('enableLearning', v)}
                />
                <ToggleField
                  label="Enable Marketplace"
                  description="Allow teachers to publish and sell learning resources (Enterprise)."
                  checked={settings.enableMarketplace}
                  onChange={(v) => update('enableMarketplace', v)}
                />
                <ToggleField
                  label="Enable AI Assistant"
                  description="Power AI-generated Q&A, lesson plans, rubrics, and practice questions (Enterprise)."
                  checked={settings.enableAI}
                  onChange={(v) => update('enableAI', v)}
                />
                <ToggleField
                  label="Enable Revision Library"
                  description="Allow teachers to upload and students to search digital resources."
                  checked={settings.enableRevisionLibrary}
                  onChange={(v) => update('enableRevisionLibrary', v)}
                />
              </div>
            </SettingsSection>

            {/* ── Submissions ── */}
            <SettingsSection
              title="Submissions"
              icon={Upload}
              iconColor="text-orange-600"
            >
              <p className="mb-4 text-xs text-gray-500">
                Control late submissions, resubmission rules, file upload constraints, and default due time.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Allow Late Submissions"
                  description="Permit students to submit after the assignment due date."
                  checked={settings.allowLateSubmission}
                  onChange={(v) => update('allowLateSubmission', v)}
                />
                <ToggleField
                  label="Allow Resubmission"
                  description="Let students submit a revised response if the assignment also allows it."
                  checked={settings.allowResubmission}
                  onChange={(v) => update('allowResubmission', v)}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="Max Upload Size"
                  description="Maximum file size per submission attachment."
                  value={settings.maxUploadSizeMB}
                  min={1}
                  max={500}
                  unit="MB"
                  onChange={(v) => update('maxUploadSizeMB', v)}
                />
                <TimeField
                  label="Default Assignment Due Time"
                  description="The time-of-day used when a due date is set without a specific time."
                  value={settings.assignmentDueTime}
                  onChange={(v) => update('assignmentDueTime', v)}
                />
              </div>
              <div className="mt-3">
                <TextField
                  label="Allowed File Types"
                  description="Comma-separated list of permitted file extensions (e.g. pdf,docx,mp4). Leave blank to allow all types."
                  value={settings.allowedFileTypes.join(',')}
                  placeholder="pdf,docx,pptx,jpg,png,mp4"
                  onChange={(v) => update(
                    'allowedFileTypes',
                    v.split(',').map((type) => type.trim().replace(/^\./, '')).filter(Boolean),
                  )}
                />
              </div>
            </SettingsSection>

            {/* ── Lessons ── */}
            <SettingsSection
              title="Lessons"
              icon={BookOpen}
              iconColor="text-indigo-600"
            >
              <p className="mb-4 text-xs text-gray-500">
                Manage default interactivity options for published lessons.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ToggleField
                  label="Enable Comments"
                  description="Allow students to leave comments on lessons."
                  checked={settings.enableComments}
                  onChange={(v) => update('enableComments', v)}
                />
                <ToggleField
                  label="Enable Student Questions"
                  description="Allow students to post questions directly on lesson blocks."
                  checked={settings.enableStudentQuestions}
                  onChange={(v) => update('enableStudentQuestions', v)}
                />
                <ToggleField
                  label="Enable Downloads"
                  description="Allow students to download lesson assets and attachments."
                  checked={settings.enableDownloads}
                  onChange={(v) => update('enableDownloads', v)}
                />
              </div>
            </SettingsSection>

            {/* ── Gamification ── */}
            <SettingsSection
              title="Gamification"
              icon={Gamepad2}
              iconColor="text-emerald-600"
            >
              <p className="mb-4 text-xs text-gray-500">
                Motivate students with XP, badges, leaderboards, and streaks. Disabling the master
                switch hides all gamification UI without deleting earned achievements.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Enable Gamification"
                  description="Master switch for all gamification features."
                  checked={settings.enableGamification}
                  onChange={(v) => update('enableGamification', v)}
                />
                <ToggleField
                  label="Enable XP Points"
                  description="Award experience points for completing lessons and assignments."
                  checked={settings.enableXP}
                  disabled={!settings.enableGamification}
                  onChange={(v) => update('enableXP', v)}
                />
                <ToggleField
                  label="Enable Badges"
                  description="Award achievement badges (e.g. First Lesson, Perfect Score)."
                  checked={settings.enableBadges}
                  disabled={!settings.enableGamification}
                  onChange={(v) => update('enableBadges', v)}
                />
                <ToggleField
                  label="Enable Leaderboards"
                  description="Show class-scoped XP leaderboards within the current term."
                  checked={settings.enableLeaderboards}
                  disabled={!settings.enableGamification}
                  onChange={(v) => update('enableLeaderboards', v)}
                />
                <ToggleField
                  label="Enable Streaks"
                  description="Track consecutive daily lesson completions for each student."
                  checked={settings.enableStreaks}
                  disabled={!settings.enableGamification}
                  onChange={(v) => update('enableStreaks', v)}
                />
              </div>
              {!settings.enableGamification && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <span>
                    Gamification is disabled. XP, badge, streak, and leaderboard options above are inactive.
                    Existing achievement records are preserved.
                  </span>
                </div>
              )}
            </SettingsSection>

            {/* ── Parents ── */}
            <SettingsSection
              title="Parent Visibility"
              icon={Users}
              iconColor="text-pink-600"
            >
              <p className="mb-4 text-xs text-gray-500">
                Control what learning data parents can see in the Parent Portal.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ToggleField
                  label="Notify Parents"
                  description="Send parents notifications when their child's assignment is marked."
                  checked={settings.notifyParents}
                  onChange={(v) => update('notifyParents', v)}
                />
                <ToggleField
                  label="Show Feedback to Parents"
                  description="Display teacher feedback on marked submissions in the Parent Portal."
                  checked={settings.showFeedbackToParents}
                  onChange={(v) => update('showFeedbackToParents', v)}
                />
                <ToggleField
                  label="Show Progress to Parents"
                  description="Display lesson completion percentages and engagement stats to parents."
                  checked={settings.showProgressToParents}
                  onChange={(v) => update('showProgressToParents', v)}
                />
              </div>
            </SettingsSection>

            {/* ── Marketplace ── */}
            <SettingsSection
              title="Marketplace"
              icon={ShoppingBag}
              iconColor="text-violet-600"
            >
              <p className="mb-4 text-xs text-gray-500">
                Configure revenue sharing and content approval for the Enterprise Marketplace.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Require Content Approval"
                  description="New listings must be approved by an admin before going public."
                  checked={settings.requireApproval}
                  onChange={(v) => update('requireApproval', v)}
                />
                <ToggleField
                  label="Allow Free Content"
                  description="Publishers can list resources as free downloads."
                  checked={settings.allowFreeContent}
                  onChange={(v) => update('allowFreeContent', v)}
                />
              </div>
              <div className="mt-3">
                <NumberField
                  label="Seller Revenue Share"
                  description="Percentage of each sale credited to the seller's wallet (platform keeps the remainder)."
                  value={settings.marketplaceRevenuePct}
                  min={0}
                  max={100}
                  unit="% to seller"
                  onChange={(v) => update('marketplaceRevenuePct', Math.min(100, Math.max(0, v)))}
                />
              </div>
              {settings.marketplaceRevenuePct < 50 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <span>
                    Seller share is below 50%. Consider a higher rate to encourage content
                    publishing on the Marketplace.
                  </span>
                </div>
              )}
            </SettingsSection>

            {/* ── Save bar (bottom) ── */}
            <div className="flex flex-col-reverse gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-500">
                Changes take effect immediately after saving. The cache is cleared automatically.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white',
                  'bg-brand-purple hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60',
                  'w-full sm:w-auto',
                )}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
