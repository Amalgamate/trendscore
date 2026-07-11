/**
 * Parent Portal More Screen
 * Settings, profile, notifications, transport, documents, support, and logout
 */

import React, { useState } from 'react';
import {
  ArrowLeft, User, Bell, FileText, HelpCircle,
  Settings, LogOut, Lock,
  ChevronRight, ExternalLink, AlertCircle, MessageSquare, Calendar, Mail
} from 'lucide-react';
import { authAPI } from '../../../../services/api/auth.api';
import { useNotifications } from '../../hooks/useNotifications';

// ─── Helper Components ──────────────────────────────────────────────

function MenuSection({ title, children }) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider px-4 mb-3">
          {title}
        </h3>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, subtitle, action, rightContent, isDanger }) {
  return (
    <button
      onClick={action}
      className={`w-full flex items-center gap-3 px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition ${
        isDanger ? 'text-rose-600' : 'text-gray-900'
      }`}
    >
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${
        isDanger 
          ? 'bg-rose-50 text-rose-600'
          : 'bg-brand-purple/10 text-brand-purple'
      }`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className={`font-semibold text-sm ${isDanger ? 'text-rose-600' : 'text-gray-900'}`}>
          {label}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {rightContent || <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
    </button>
  );
}

function ProfileCard({ user, onEditProfile }) {
  return (
    <div className="bg-gradient-to-br from-brand-purple/20 to-purple-100 rounded-2xl p-5 border border-brand-purple/30">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center text-brand-purple font-bold text-xl flex-shrink-0">
          {user?.name?.[0] || 'P'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900">{user?.name || 'Parent Name'}</h3>
          <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user?.phone || 'Phone not set'}</p>
        </div>
      </div>
      <button
        onClick={onEditProfile}
        className="w-full mt-4 px-4 py-2 bg-brand-purple text-white font-semibold rounded-lg hover:bg-purple-700 transition text-sm"
      >
        Edit Profile
      </button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalMore = ({ user, onNavigate, onLogout }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePasswordConfirm, setShowChangePasswordConfirm] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const { showSuccess, showError } = useNotifications();

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleChangePasswordConfirm = async () => {
    if (!user?.email) {
      showError('No email on file for your account. Contact the school to update it.');
      setShowChangePasswordConfirm(false);
      return;
    }
    setSendingReset(true);
    try {
      await authAPI.forgotPassword(user.email);
      showSuccess(`Password reset link sent to ${user.email}`);
    } catch (e) {
      showError(e?.message || 'Failed to send reset link. Please try again.');
    } finally {
      setSendingReset(false);
      setShowChangePasswordConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
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
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-500">Manage your account</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Settings size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5">
        {/* Profile Card */}
        <div className="mb-6">
          <ProfileCard user={user} onEditProfile={() => onNavigate('settings-profile')} />
        </div>

        {/* Account Section */}
        <MenuSection title="Account">
          <MenuItem
            icon={User}
            label="Profile Information"
            subtitle="Edit name, email, phone"
            action={() => onNavigate('settings-profile')}
          />
          <MenuItem
            icon={Lock}
            label="Change Password"
            subtitle="Update your security"
            action={() => setShowChangePasswordConfirm(true)}
          />
        </MenuSection>

        {/* Notifications Section */}
        <MenuSection title="Notifications">
          <MenuItem
            icon={Bell}
            label="Push Notifications"
            subtitle="Get updates on your device"
            action={() => setNotificationsEnabled(!notificationsEnabled)}
            rightContent={
              <ToggleSwitch
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
              />
            }
          />
          <MenuItem
            icon={MessageSquare}
            label="SMS Notifications"
            subtitle="Receive updates via SMS"
            action={() => setSmsEnabled(!smsEnabled)}
            rightContent={
              <ToggleSwitch
                checked={smsEnabled}
                onChange={setSmsEnabled}
              />
            }
          />
        </MenuSection>

        {/* School Services Section */}
        <MenuSection title="School Services">
          <MenuItem
            icon={Calendar}
            label="School Calendar"
            subtitle="Term dates and school events"
            action={() => onNavigate('events-calendar')}
          />
          <MenuItem
            icon={FileText}
            label="Documents"
            subtitle="View and download documents"
            action={() => onNavigate('parent-portal-documents')}
          />
        </MenuSection>

        {/* Support & Help Section */}
        <MenuSection title="Support & Help">
          <MenuItem
            icon={HelpCircle}
            label="Help & Support"
            subtitle="Get help with the portal"
            action={() => onNavigate('parent-portal-support')}
          />
          <MenuItem
            icon={ExternalLink}
            label="Contact School"
            subtitle="Email or raise a support ticket"
            action={() => onNavigate('parent-portal-support')}
          />
        </MenuSection>

        {/* Logout Section */}
        <MenuSection>
          <MenuItem
            icon={LogOut}
            label="Logout"
            subtitle="Sign out of your account"
            action={() => setShowLogoutConfirm(true)}
            isDanger
          />
        </MenuSection>

        {/* About Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">TrendSCORE Parent Portal</p>
          <p className="text-sm font-semibold text-gray-900">v1.0.0</p>
          <p className="text-xs text-gray-400 mt-2">© 2024 All rights reserved</p>
        </div>
      </div>

      {/* Change Password Confirmation Modal */}
      {showChangePasswordConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center p-4">
          <div className="bg-white rounded-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm animate-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-brand-purple/10">
              <Mail size={24} className="text-brand-purple" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Send Password Reset Link?</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              We'll email a secure reset link to <span className="font-semibold">{user?.email || 'your registered email'}</span>. Use it to set a new password.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowChangePasswordConfirm(false)}
                disabled={sendingReset}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePasswordConfirm}
                disabled={sendingReset}
                className="flex-1 px-4 py-3 bg-brand-purple text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-60"
              >
                {sendingReset ? 'Sending…' : 'Send Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center p-4">
          <div className="bg-white rounded-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm animate-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-rose-100">
              <AlertCircle size={24} className="text-rose-600" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Logout?</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentPortalMore;
