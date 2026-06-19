import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { useNotifications } from '../../hooks/useNotifications';
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  formatAttendanceLockTime,
  loadAttendanceSettings,
  normalizeAttendanceSettings,
  saveAttendanceSettings,
} from './attendanceSettings';

function ToggleField({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <span>
        <span className="block text-sm font-semibold text-gray-950">{label}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-brand-purple"
      />
    </label>
  );
}

export default function AttendanceSettingsPage() {
  const { showSuccess, showError } = useNotifications();
  const [settings, setSettings] = useState(DEFAULT_ATTENDANCE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadAttendanceSettings()
      .then((loadedSettings) => {
        if (!cancelled) setSettings(loadedSettings);
      })
      .catch((err) => {
        console.warn('[Attendance Settings] Failed to load:', err);
        if (!cancelled) showError('Failed to load attendance settings. Defaults are shown.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [showError]);

  const updateSetting = (key, value) => {
    setSettings((prev) => normalizeAttendanceSettings({ ...prev, [key]: value }));
  };

  const lockLabel = useMemo(() => formatAttendanceLockTime(settings.lockTime), [settings.lockTime]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveAttendanceSettings(settings);
      setSettings(saved);
      showSuccess('Attendance settings saved.');
    } catch (err) {
      showError(err?.message || 'Failed to save attendance settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_ATTENDANCE_SETTINGS);
  };

  return (
    <div className="min-h-full bg-gray-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-950">Attendance Configuration</h1>
              <p className="mt-1 text-sm text-gray-500">
                Control daily attendance locking, exception rules and default communication behaviour.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Current lock: {settings.lockEnabled ? lockLabel : 'Disabled'}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="text-brand-purple" />
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-900">Locking Rules</h2>
            </div>

            <ToggleField
              label="Lock all-present marking"
              description="When enabled, teachers can still mark late and exception entries after the lock time, but bulk all-present marking is blocked unless unlocked."
              checked={settings.lockEnabled}
              onChange={(value) => updateSetting('lockEnabled', value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block rounded-lg border border-gray-200 bg-white p-4">
                <span className="block text-sm font-semibold text-gray-950">Daily lock time</span>
                <input
                  type="time"
                  value={settings.lockTime}
                  disabled={!settings.lockEnabled}
                  onChange={(event) => updateSetting('lockTime', event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-gray-300 px-3 text-base font-semibold outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:bg-gray-100 disabled:text-gray-400"
                />
                <span className="mt-2 block text-xs text-gray-500">Displayed to teachers as {lockLabel}.</span>
              </label>

              <label className="block rounded-lg border border-gray-200 bg-white p-4">
                <span className="block text-sm font-semibold text-gray-950">Unlock review window</span>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.unlockWindowMinutes}
                  onChange={(event) => updateSetting('unlockWindowMinutes', event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-gray-300 px-3 text-base font-semibold outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                />
                <span className="mt-2 block text-xs text-gray-500">
                  Use the Attendance Unlock approval workflow to set the actual relock expiry.
                </span>
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-purple" />
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-900">Approval Link</h2>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              Unlock permissions are controlled by Approval Workflows under the Attendance module. Admins and
              head teachers can approve by default, and extra approvers can be assigned from the workflow.
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Recommended workflow</p>
              <p className="mt-2 text-sm font-semibold text-gray-950">Attendance Unlock</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Use a short relock period such as 30 to 60 minutes for correction windows.
              </p>
            </div>
          </section>
        </div>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-brand-purple" />
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-900">Capture Defaults</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleField
              label="Allow late and excused after lock"
              description="Keep exceptions open after the all-present lock."
              checked={settings.allowLateAfterLock}
              onChange={(value) => updateSetting('allowLateAfterLock', value)}
            />
            <ToggleField
              label="Require notes for late or excused"
              description="Block saving until the teacher explains lateness or excusal."
              checked={settings.requireRemarksForLateExcused}
              onChange={(value) => updateSetting('requireRemarksForLateExcused', value)}
            />
            <ToggleField
              label="Notify absences by default"
              description="Pre-select parent communication when absent learners are saved."
              checked={settings.notifyAbsentDefault}
              onChange={(value) => updateSetting('notifyAbsentDefault', value)}
            />
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={16} />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold text-white',
              'bg-brand-purple hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {isSaving ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
