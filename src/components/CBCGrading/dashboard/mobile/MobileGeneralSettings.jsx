import React, { useState } from 'react';
import { ChevronRight, Moon, Bell, Lock, LogOut, User } from 'lucide-react';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

const MobileGeneralSettings = ({ user, onLogout, brandingSettings, onNavigate }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const settingsItems = [
    {
      icon: User,
      label: 'My Profile',
      action: 'link',
      onClick: () => onNavigate?.('settings-profile'),
    },
    {
      icon: Moon,
      label: 'Dark Mode',
      action: 'toggle',
      value: darkMode,
      onChange: () => setDarkMode(!darkMode),
    },
    {
      icon: Bell,
      label: 'Notifications',
      action: 'toggle',
      value: notifications,
      onChange: () => setNotifications(!notifications),
    },
    {
      icon: Lock,
      label: 'Change Password',
      action: 'link',
      onClick: () => { /* TODO: implement change password */ },
    },
    {
      icon: LogOut,
      label: 'Sign Out',
      action: 'destructive',
      onClick: onLogout,
    },
  ];

  return (
    <div className="min-h-full px-4 py-6 pb-20 text-white">
      {/* School Info */}
      <div className="ts-mobile-card mb-6 p-4 rounded-lg">
        <div className="text-xs uppercase tracking-wider text-[#06285a]/70 font-semibold">
          School
        </div>
        <div className="text-lg font-bold text-[#06285a] mt-2">
          {brandingSettings?.schoolName || 'School Name'}
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-2">
        {settingsItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={item.onChange || item.onClick}
              className={`w-full flex items-center justify-between p-4 rounded-lg border ${
                item.action === 'destructive'
                  ? 'ts-mobile-card-orange'
                  : 'ts-mobile-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  size={20}
                  className={
                    item.action === 'destructive' ? 'text-red-600' : 'text-gray-600'
                  }
                />
                <span
                  className={`font-medium text-sm ${
                    item.action === 'destructive'
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {item.label}
                </span>
              </div>

              {item.action === 'toggle' ? (
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${
                    item.value ? 'bg-brand-purple' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      item.value ? 'translate-x-4.5' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </div>
              ) : (
                <ChevronRight size={20} className="text-[#06285a]/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* About & Version */}
      <div className="mt-8 text-center">
        <div className="text-xs text-white/65">
          <p>{PRODUCT_DISPLAY_NAME}</p>
          <p className="mt-1">© {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

export default MobileGeneralSettings;
