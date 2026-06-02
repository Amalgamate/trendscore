import React, { useState, useEffect } from 'react';
import MobileDashboard from './dashboard/MobileDashboard';

/**
 * Dashboard Responsive Wrapper
 * Shows MobileDashboard on mobile devices (< 768px)
 * Shows regular dashboard on desktop
 */
const DashboardResponsiveWrapper = ({ 
    children, 
    onNavigate, 
    currentPage,
    metrics,
    isMobileOverride = null // For testing: force mobile view
}) => {
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Set mounted and perform initial check
        const checkMobile = () => {
            // If override is set, use that
            if (isMobileOverride !== null) {
                return isMobileOverride;
            }
            // Check using window.innerWidth
            const isScreenSmall = window.innerWidth < 768;
            return isScreenSmall;
        };

        // Check initial state
        const initialIsMobile = checkMobile();
        setIsMobile(initialIsMobile);
        setMounted(true);

        // Add resize listener with debounce
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                setIsMobile(checkMobile());
            }, 150);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout);
        };
    }, [isMobileOverride]);

    // Don't render anything until mounted (SSR safety)
    if (!mounted) {
        return <>{children}</>;
    }

    // If mobile, show the mobile dashboard
    if (isMobile) {
        return (
            <MobileDashboard 
                onNavigate={onNavigate}
                currentPage={currentPage}
                metrics={metrics}
            />
        );
    }

    // Otherwise show the regular desktop dashboard
    return children;
};

export default DashboardResponsiveWrapper;
