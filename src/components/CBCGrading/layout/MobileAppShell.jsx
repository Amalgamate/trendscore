import React from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  Home,
  ClipboardCheck,
  Mail,
  User,
  Search,
  Bell,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

const MobileAppShell = ({ children, user, onNavigate, currentPage, brandingSettings }) => {
  const { role } = usePermissions();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'attendance-daily', label: 'Attend', icon: ClipboardCheck },
    { id: 'comm-messages', label: 'Inbox', icon: Mail },
    { id: 'settings-users', label: 'Profile', icon: User },
  ];

  return (
    <div className="h-[100dvh] w-full bg-white flex flex-col overflow-hidden relative">
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#f4f4f0] bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-white border border-[#ebebeb] flex items-center justify-center overflow-hidden">
            <img
              src="/branding/logo.png"
              alt="Logo"
              className="w-7 h-7 object-contain"
              onError={(e) => { e.currentTarget.src = '/branding/logo.png'; }}
            />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#1a1a18] leading-tight">
              {brandingSettings?.schoolName || 'Zawadi Junior'}
            </div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-[#aaa]">School Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-[10px] border border-[#ebebeb] bg-[#fafafa] flex items-center justify-center">
            <Search size={16} className="text-[#555]" />
          </button>
          <button className="w-9 h-9 rounded-[10px] border border-[#ebebeb] bg-[#fafafa] flex items-center justify-center relative">
            <Bell size={16} className="text-[#555]" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#e44]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fafaf8] pb-4">{children}</div>

      <div className="h-[72px] border-t border-[#f0f0ec] bg-white flex items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item, idx) => {
          const isActive = currentPage === item.id || (item.id === 'dashboard' && currentPage === 'learners-list');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn("flex-1 flex flex-col items-center gap-1 py-1")}
            >
              <div className={cn("w-9 h-7 rounded-[10px] flex items-center justify-center", isActive ? 'bg-[#f0f0ec]' : '')}>
                <item.icon size={19} className={isActive ? 'text-[#1a1a18]' : 'text-[#bbb]'} />
              </div>
              <span className={cn("text-[9px] uppercase tracking-[0.04em] font-medium", isActive ? 'text-[#1a1a18]' : 'text-[#bbb]')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileAppShell;
