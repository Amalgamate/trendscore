import React from 'react';
import {
  Search,
} from 'lucide-react';
import MobileBottomNav from '../dashboard/mobile/MobileBottomNav';
import MobileCommunicationCenter from './MobileCommunicationCenter';

const MobileAppShell = ({ children, user, onNavigate, currentPage, brandingSettings }) => {
  return (
    <div className="ts-mobile-app h-[100dvh] w-full flex flex-col overflow-hidden relative text-white">
      <div className="ts-mobile-header flex min-h-16 items-center justify-between border-b border-[#ff7900]/35 px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-white border border-[#ff7900] flex items-center justify-center overflow-hidden">
            <img
              src="/branding/logo.png"
              alt="Logo"
              className="w-7 h-7 object-contain"
              onError={(e) => { e.currentTarget.src = '/branding/logo.png'; }}
            />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight">
              {brandingSettings?.schoolName || 'TrendScore'}
            </div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-white/65">School Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-[10px] border border-[#ff7900] bg-transparent flex items-center justify-center text-white">
            <Search size={16} />
          </button>
          <MobileCommunicationCenter user={user} onNavigate={onNavigate} />
        </div>
      </div>

      <div className="ts-mobile-scroll flex-1 overflow-y-auto pb-24">{children}</div>

      <MobileBottomNav role={user?.role} currentPath={currentPage} onNavigate={onNavigate} />
    </div>
  );
};

export default MobileAppShell;
