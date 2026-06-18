import React from 'react';
import SummativeTestFormMobile from './SummativeTestFormMobile';
import SummativeTestFormDesktop from './SummativeTestFormDesktop';
import { useMobile } from '../../hooks/useMobileDetection';

/**
 * SummativeTestForm - Responsive wrapper
 * Routes to mobile or desktop version based on screen size
 */
const SummativeTestForm = ({ onBack, onSuccess, initialTestType = null, initialData = null, test = null }) => {
  const isMobile = useMobile();
  const resolvedInitialData = initialData || test || null;

  return isMobile ? (
    <SummativeTestFormMobile onBack={onBack} onSuccess={onSuccess} initialTestType={initialTestType} initialData={resolvedInitialData} />
  ) : (
    <SummativeTestFormDesktop onBack={onBack} onSuccess={onSuccess} initialTestType={initialTestType} initialData={resolvedInitialData} />
  );
};

export default SummativeTestForm;
