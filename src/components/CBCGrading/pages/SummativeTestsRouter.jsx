/**
 * SummativeTests Router
 * On mobile: Full-screen card-based UI (no sidebar)
 * On desktop: Grid layout with sidebar
 */

import React from 'react';
import SummativeTestsMobile from './SummativeTestsMobile';
import SummativeTests from './SummativeTests';
import { useMobile } from '../../../hooks/useMobileDetection';

const SummativeTestsRouter = ({ onNavigate, onBack, isMobile: deviceIsMobile, defaultTestType = null }) => {
  const mobileByViewport = useMobile();
  const isMobile = typeof deviceIsMobile === 'boolean' ? deviceIsMobile : mobileByViewport;

  // On mobile: return full-screen component (breaks out of sidebar layout)
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden">
        <SummativeTestsMobile onNavigate={onNavigate} onBack={onBack} defaultTestType={defaultTestType} />
      </div>
    );
  }

  // On desktop: render within normal layout
  return <SummativeTests onNavigate={onNavigate} defaultTestType={defaultTestType} />;
};

export default SummativeTestsRouter;
