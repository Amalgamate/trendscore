import React from 'react';
import {
  Search,
  Bell,
} from 'lucide-react';
import MobileBottomNav from '../dashboard/mobile/MobileBottomNav';

const MobileAppShell = ({ children, user, onNavigate, currentPage, brandingSettings }) => {
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
              {brandingSettings?.schoolName || 'TrendScore'}
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

      <div className="flex-1 overflow-y-auto bg-[#fafaf8] pb-24">{children}</div>

      <MobileBottomNav role={user?.role} currentPath={currentPage} onNavigate={onNavigate} />
    </div>
  );
};

export default MobileAppShell;
