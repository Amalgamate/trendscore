/**
 * Parent Portal More Screen
 * Settings, profile, notifications, transport, documents, support, and logout
 */

import React, { useState } from 'react';
import {
  ArrowLeft, User, Bell, Truck, FileText, HelpCircle,
  Settings, LogOut, Shield, Eye, Languages, Lock,
  ChevronRight, ExternalLink, AlertCircle, MessageSquare
} from 'lucide-react';

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

function ProfileCard({ user }) {
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
      <button className="w-full mt-4 px-4 py-2 bg-brand-purple text-white font-semibold rounded-lg hover:bg-purple-700 transition text-sm">
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

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
          <ProfileCard user={user} />
        </div>

        {/* Account Section */}
        <MenuSection title="Account">
          <MenuItem
            icon={User}
            label="Profile Information"
            subtitle="Edit name, email, phone"
            action={() => console.log('Edit profile')}
          />
          <MenuItem
            icon={Lock}
            label="Change Password"
            subtitle="Update your security"
            action={() => console.log('Change password')}
          />
          <MenuItem
            icon={Shield}
            label="Privacy & Security"
            subtitle="Control your data"
            action={() => console.log('Privacy settings')}
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
            icon={Truck}
            label="Transport Details"
            subtitle="View route and schedule"
            action={() => onNavigate('parent-portal-transport')}
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
            subtitle="Phone, email, address"
            action={() => console.log('Contact school')}
          />
        </MenuSection>

        {/* App Settings Section */}
        <MenuSection title="App Settings">
          <MenuItem
            icon={Languages}
            label="Language"
            subtitle="English"
            action={() => console.log('Change language')}
          />
          <MenuItem
            icon={Eye}
            label="Display"
            subtitle="Light theme"
            action={() => console.log('Display settings')}
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
