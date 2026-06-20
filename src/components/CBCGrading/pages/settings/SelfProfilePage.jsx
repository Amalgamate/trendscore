import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, Camera, Loader2, LogOut, Mail, Phone, Save, Shield, User } from 'lucide-react';
import { authAPI } from '../../../../services/api/auth.api';
import { userAPI } from '../../../../services/api/user.api';
import { useAuth } from '../../../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import ProfilePhotoModal from '../../shared/ProfilePhotoModal';

const emptyProfile = {
  firstName: '',
  middleName: '',
  lastName: '',
  phone: '',
  profilePicture: '',
};

const formatRoleName = (role) => String(role || 'USER')
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');

const buildFormState = (user) => ({
  firstName: user?.firstName || user?.name?.split(' ')?.[0] || '',
  middleName: user?.middleName || '',
  lastName: user?.lastName || user?.name?.split(' ')?.slice(1).join(' ') || '',
  phone: user?.phone || '',
  profilePicture: user?.profilePicture || user?.profileImage || '',
});

const buildDisplayName = (user, form) => {
  const parts = [
    form?.firstName ?? user?.firstName,
    form?.middleName ?? user?.middleName,
    form?.lastName ?? user?.lastName,
  ].filter(Boolean);
  return parts.join(' ') || user?.name || 'User';
};

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
        <Icon size={14} />
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 border border-gray-200 bg-gray-50 px-4 py-3">
      <Icon size={18} className="text-gray-500 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900 break-words">{value || 'Not set'}</p>
      </div>
    </div>
  );
}

const SelfProfilePage = ({ user: initialUser, onNavigate, onLogout, backTarget = 'settings' }) => {
  const { user: authUser, updateUser } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const profileSourceUser = initialUser || authUser;
  const backLabel = backTarget === 'dashboard' ? 'Back to dashboard' : 'Back to settings';
  const profileSourceUserId = profileSourceUser?.id;
  const profileSourceUserRef = useRef(profileSourceUser);
  const [profileUser, setProfileUser] = useState(initialUser || authUser);
  const [form, setForm] = useState(() => buildFormState(initialUser || authUser || emptyProfile));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const displayName = useMemo(() => buildDisplayName(profileUser, form), [profileUser, form]);
  const initials = useMemo(() => (
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'
  ), [displayName]);

  useEffect(() => {
    profileSourceUserRef.current = profileSourceUser;
  }, [profileSourceUser]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const response = await authAPI.me();
        const freshUser = response?.data || response?.user || profileSourceUserRef.current;
        if (!mounted) return;
        setProfileUser(freshUser);
        setForm(buildFormState(freshUser));
        if (freshUser) updateUser({ ...freshUser, name: `${freshUser.firstName || ''} ${freshUser.lastName || ''}`.trim() || freshUser.name });
      } catch (error) {
        if (mounted) showError(error.message || 'Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [profileSourceUserId, showError, updateUser]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
      };
      const response = await userAPI.updateOwnProfile(payload);
      const updated = response?.data;
      const nextUser = {
        ...profileUser,
        ...updated,
        name: updated?.name || `${updated?.firstName || payload.firstName} ${updated?.lastName || payload.lastName}`.trim(),
      };

      setProfileUser(nextUser);
      setForm(buildFormState(nextUser));
      updateUser(nextUser);
      showSuccess('Profile updated successfully');
    } catch (error) {
      showError(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhoto = async (photoData) => {
    const userId = profileUser?.id || profileSourceUserId;
    if (!userId) {
      showError('Profile is still loading. Try again in a moment.');
      return false;
    }

    setSavingPhoto(true);
    try {
      const response = await userAPI.uploadPhoto(userId, photoData);
      const updated = response?.data;
      const nextUser = {
        ...profileUser,
        ...updated,
        name: updated?.name || buildDisplayName(updated || profileUser, form),
      };

      setProfileUser(nextUser);
      setForm(buildFormState(nextUser));
      updateUser(nextUser);
      showSuccess('Profile photo updated successfully');
      return true;
    } catch (error) {
      showError(error.message || 'Failed to update profile photo');
      return false;
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.(backTarget)}
            className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
            aria-label={backLabel}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-purple">Account</p>
            <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">My Profile</h1>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="border border-gray-200 bg-white p-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {form.profilePicture ? (
                  <img
                    src={form.profilePicture}
                    alt=""
                    className="h-24 w-24 rounded-full border-4 border-white bg-gray-100 object-cover shadow"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-brand-purple text-2xl font-bold text-white shadow">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="Update profile photo"
                  disabled={loading || savingPhoto}
                >
                  {savingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-950">{displayName}</h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
                {formatRoleName(profileUser?.role)}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <ReadOnlyItem icon={Mail} label="Email" value={profileUser?.email} />
              <ReadOnlyItem icon={Shield} label="Role" value={formatRoleName(profileUser?.role)} />
              {profileUser?.staffId && <ReadOnlyItem icon={BadgeCheck} label="Staff ID" value={profileUser.staffId} />}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            )}
          </aside>

          <form onSubmit={handleSubmit} className="border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Personal Details</h2>
                <p className="text-sm text-gray-500">Update the profile details shown across the portal.</p>
              </div>
              {loading && (
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading
                </span>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="First Name" icon={User}>
                <input
                  value={form.firstName}
                  onChange={(event) => handleChange('firstName', event.target.value)}
                  className="h-11 w-full border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                  required
                  maxLength={50}
                />
              </Field>

              <Field label="Last Name" icon={User}>
                <input
                  value={form.lastName}
                  onChange={(event) => handleChange('lastName', event.target.value)}
                  className="h-11 w-full border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                  required
                  maxLength={50}
                />
              </Field>

              <Field label="Middle Name" icon={User}>
                <input
                  value={form.middleName}
                  onChange={(event) => handleChange('middleName', event.target.value)}
                  className="h-11 w-full border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                  maxLength={50}
                />
              </Field>

              <Field label="Phone" icon={Phone}>
                <input
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  className="h-11 w-full border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                  maxLength={30}
                  inputMode="tel"
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setForm(buildFormState(profileUser))}
                className="inline-flex h-11 items-center justify-center border border-gray-300 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                disabled={saving || loading}
              >
                Reset
              </button>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 bg-brand-purple px-5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saving || loading}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Profile
              </button>
            </div>
          </form>
        </div>
      </div>
      <ProfilePhotoModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onSave={handleSavePhoto}
        currentPhoto={form.profilePicture}
      />
    </div>
  );
};

export default SelfProfilePage;
