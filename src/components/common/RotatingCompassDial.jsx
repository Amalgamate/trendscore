import React from 'react';

/**
 * RotatingCompassDial
 * Signature rotating compass dial SVG watermark.
 * Used on mobile and desktop views to create a cohesive brand experience.
 */
export default function RotatingCompassDial({
  size = 500,
  bottom = '-190px',
  right = '-190px',
  opacity = 0.1,
  color = '#041635',
  duration = '28s',
  className = '',
  style = {},
}) {
  const widthVal = typeof size === 'number' ? `${size}px` : size;
  const heightVal = typeof size === 'number' ? `${size}px` : size;

  return (
    <>
      <style>{`
        @keyframes compassSpin {
          0%   { transform: rotate(0deg)   skewX(0deg)   skewY(0deg); }
          25%  { transform: rotate(90deg)  skewX(1.5deg) skewY(0.8deg); }
          50%  { transform: rotate(180deg) skewX(0deg)   skewY(0deg); }
          75%  { transform: rotate(270deg) skewX(-1.5deg) skewY(-0.8deg); }
          100% { transform: rotate(360deg) skewX(0deg)   skewY(0deg); }
        }
      `}</style>
      <svg
        aria-hidden="true"
        viewBox="0 0 300 300"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{
          position: 'absolute',
          bottom,
          right,
          width: widthVal,
          height: heightVal,
          opacity,
          animation: `compassSpin ${duration} linear infinite`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
          zIndex: 1,
          ...style,
        }}
      >
        <circle cx="150" cy="150" r="145" fill="none" stroke={color} strokeWidth="0.6" />
        <circle cx="150" cy="150" r="138" fill="none" stroke={color} strokeWidth="0.3" />
        <circle cx="150" cy="150" r="118" fill="none" stroke={color} strokeWidth="0.5" />
        <circle cx="150" cy="150" r="112" fill="none" stroke={color} strokeWidth="0.25" />
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = (i * 5 * Math.PI) / 180;
          const isMajor = i % 9 === 0;
          const isMid   = i % 3 === 0;
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
              stroke={color}
              strokeWidth={isMajor ? 0.9 : isMid ? 0.55 : 0.35}
            />
          );
        })}
        <text
          x="150"
          y="106"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fontWeight="600"
          fill={color}
          fontFamily="system-ui, sans-serif"
          letterSpacing="2"
        >
          N
        </text>
        <text
          x="150"
          y="198"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fontWeight="400"
          fill={color}
          fontFamily="system-ui, sans-serif"
        >
          S
        </text>
        <text
          x="196"
          y="150"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fontWeight="400"
          fill={color}
          fontFamily="system-ui, sans-serif"
        >
          E
        </text>
        <text
          x="104"
          y="150"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fontWeight="400"
          fill={color}
          fontFamily="system-ui, sans-serif"
        >
          W
        </text>
        <circle cx="150" cy="150" r="28" fill="none" stroke={color} strokeWidth="0.5" />
        <circle cx="150" cy="150" r="4"  fill="none" stroke={color} strokeWidth="0.8" />
        <polygon points="150,118 153,150 150,160 147,150" fill="none" stroke={color} strokeWidth="0.7" strokeLinejoin="round" />
        <polygon points="150,182 153,150 150,140 147,150" fill="none" stroke={color} strokeWidth="0.5" strokeLinejoin="round" opacity="0.5" />
        <line x1="150" y1="122" x2="150" y2="135" stroke={color} strokeWidth="0.35" />
        <line x1="150" y1="165" x2="150" y2="178" stroke={color} strokeWidth="0.35" />
        <line x1="122" y1="150" x2="135" y2="150" stroke={color} strokeWidth="0.35" />
        <line x1="165" y1="150" x2="178" y2="150" stroke={color} strokeWidth="0.35" />
      </svg>
    </>
  );
}
