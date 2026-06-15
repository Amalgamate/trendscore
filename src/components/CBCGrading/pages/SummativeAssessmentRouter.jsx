/**
 * SummativeAssessment Router
 * On mobile: Full-screen experience (no sidebar/header)
 * On desktop: Normal layout with sidebar
 */

import React from 'react';
import SummativeAssessmentMobile from './SummativeAssessmentMobile';
import SummativeAssessment from './SummativeAssessment';
import { useMobile } from '../../../hooks/useMobileDetection';

const SummativeAssessmentRouter = ({ learners, initialTestId, defaultTestType = null, onBack, onNavigate, isMobile: deviceIsMobile, brandingSettings, embedded }) => {
  const mobileByViewport = useMobile();
  const isMobile = typeof deviceIsMobile === 'boolean' ? deviceIsMobile : mobileByViewport;

  // On mobile: return full-screen component (breaks out of sidebar layout)
  if (isMobile) {
    if (embedded) {
      return (
        <div className="absolute inset-0 bg-gray-50 overflow-hidden">
          <SummativeAssessmentMobile learners={learners} initialTestId={initialTestId} defaultTestType={defaultTestType} onBack={onBack} onNavigate={onNavigate} brandingSettings={brandingSettings} embedded={embedded} />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden">
        <SummativeAssessmentMobile learners={learners} initialTestId={initialTestId} defaultTestType={defaultTestType} onBack={onBack} onNavigate={onNavigate} brandingSettings={brandingSettings} />
      </div>
    );
  }

  // On desktop: render within normal layout
  return <SummativeAssessment learners={learners} initialTestId={initialTestId} defaultTestType={defaultTestType} brandingSettings={brandingSettings} />;
};

export default SummativeAssessmentRouter;
