import React, { useEffect, useRef, useMemo, useState } from 'react';
import '../../styles/splashscreen.css';

const MIN_DISPLAY_MS = 2000;

const SplashScreen = ({ onReady }) => {
  const [isFading, setIsFading] = useState(false);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef(null);

  const compassTicks = useMemo(
    () => Array.from({ length: 72 }, (_, i) => {
      const angle = (i * 5 * Math.PI) / 180;
      const isMajor = i % 9 === 0;
      const isMid = i % 3 === 0;
      const outer = 145;
      const inner = isMajor ? 128 : isMid ? 132 : 136;
      const x1 = 150 + outer * Math.sin(angle);
      const y1 = 150 - outer * Math.cos(angle);
      const x2 = 150 + inner * Math.sin(angle);
      const y2 = 150 - inner * Math.cos(angle);
      return (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#f97316"
          strokeWidth={isMajor ? 1.2 : isMid ? 0.75 : 0.45}
          opacity={isMajor ? 1 : 0.75}
        />
      );
    }),
    []
  );

  useEffect(() => {
    setIsFading(false);
    setVisible(true);

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsFading(true);
    }, MIN_DISPLAY_MS);

    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (!isFading) return;
    const id = window.setTimeout(() => {
      setVisible(false);
      onReady?.();
    }, 250);
    return () => window.clearTimeout(id);
  }, [isFading, onReady]);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="spinner-wrapper">
          <div className="spinner-ring" />
          <svg
            aria-hidden="true"
            viewBox="0 0 300 300"
            xmlns="http://www.w3.org/2000/svg"
            className="splash-compass-svg"
          >
            <circle cx="150" cy="150" r="145" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.15" />
            <circle cx="150" cy="150" r="138" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.1" />
            <circle cx="150" cy="150" r="118" fill="none" stroke="#f97316" strokeWidth="0.85" opacity="0.18" />
            <circle cx="150" cy="150" r="112" fill="none" stroke="#f97316" strokeWidth="0.4" opacity="0.1" />
            {compassTicks}
            <text x="150" y="104" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#f97316" fontFamily="system-ui, sans-serif" letterSpacing="2">N</text>
            <text x="150" y="196" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="500" fill="#f97316" fontFamily="system-ui, sans-serif">S</text>
            <text x="194" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="500" fill="#f97316" fontFamily="system-ui, sans-serif">E</text>
            <text x="106" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="500" fill="#f97316" fontFamily="system-ui, sans-serif">W</text>
            <circle cx="150" cy="150" r="28" fill="none" stroke="#f97316" strokeWidth="0.7" opacity="0.35" />
            <circle cx="150" cy="150" r="4" fill="none" stroke="#f97316" strokeWidth="0.9" opacity="0.9" />
            <polygon points="150,118 153,150 150,160 147,150" fill="none" stroke="#f97316" strokeWidth="1" strokeLinejoin="round" />
            <polygon points="150,182 153,150 150,140 147,150" fill="none" stroke="#f97316" strokeWidth="0.7" strokeLinejoin="round" opacity="0.55" />
            <line x1="150" y1="122" x2="150" y2="135" stroke="#f97316" strokeWidth="0.5" opacity="0.8" />
            <line x1="150" y1="165" x2="150" y2="178" stroke="#f97316" strokeWidth="0.5" opacity="0.8" />
            <line x1="122" y1="150" x2="135" y2="150" stroke="#f97316" strokeWidth="0.5" opacity="0.8" />
            <line x1="165" y1="150" x2="178" y2="150" stroke="#f97316" strokeWidth="0.5" opacity="0.8" />
          </svg>
        </div>
        <div className="splash-brand-name">Treads CORE</div>
      </div>
    </div>
  );
};

export default SplashScreen;
