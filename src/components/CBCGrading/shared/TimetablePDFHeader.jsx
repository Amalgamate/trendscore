/**
 * TimetablePDFHeader Component
 * Beautiful PDF header with logo, school name, and metadata
 * Designed for professional timetable exports
 */

import React from 'react';

const TimetablePDFHeader = ({
  className = '',
  schoolName = 'School Timetable',
  selectedClass = '',
  weekInfo = '',
  logoUrl = '/branding/logo.png'
}) => {
  return (
    <div className={`print-only timetable-pdf-header ${className}`}>
      <style>{`
        .timetable-pdf-header {
          background: #ffffff;
          padding: 0 0 12px 0;
          text-align: left;
          border-bottom: 2px solid #111827;
          margin: 0 0 14px 0;
          page-break-after: avoid;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .timetable-pdf-header-logo {
          width: 64px;
          height: 64px;
          margin: 0;
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          flex: 0 0 auto;
        }
        
        .timetable-pdf-header-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .timetable-pdf-header-body {
          flex: 1;
          min-width: 0;
        }
        
        .timetable-pdf-header-title {
          color: #111827;
          margin: 0 0 3px 0;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: 0;
        }
        
        .timetable-pdf-header-subtitle {
          color: #374151;
          margin: 0 0 7px 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0;
        }
        
        .timetable-pdf-header-meta {
          display: flex;
          justify-content: flex-start;
          gap: 14px;
          margin-top: 0;
          flex-wrap: wrap;
        }
        
        .timetable-pdf-header-meta-item {
          color: #4b5563;
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .timetable-pdf-header-meta-label {
          font-weight: 800;
          color: #111827;
        }
        
        .timetable-pdf-header-meta-value {
          font-weight: 600;
        }
        
        /* Hidden in screen view, shown in print */
        @media screen {
          .print-only {
            display: none;
          }
        }
        
        /* Print-specific styles */
        @media print {
          .print-only {
            display: block;
          }
          
          .timetable-pdf-header {
            margin: 0 0 12px 0;
            padding: 0 0 10px 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .timetable-pdf-header-logo {
            width: 50px;
            height: 50px;
          }
          
          .timetable-pdf-header-title {
            font-size: 19px;
            margin-bottom: 3px;
          }
          
          .timetable-pdf-header-subtitle {
            font-size: 12px;
            margin-bottom: 6px;
          }
          
          .timetable-pdf-header-meta {
            gap: 12px;
            margin-top: 0;
          }
          
          .timetable-pdf-header-meta-item {
            font-size: 9px;
          }
        }
      `}</style>
      
      <div className="timetable-pdf-header-logo">
        <img src={logoUrl} alt="School Logo" onError={(event) => { event.currentTarget.src = '/branding/logo.png'; }} />
      </div>
      
      <div className="timetable-pdf-header-body">
        <h1 className="timetable-pdf-header-title">{schoolName}</h1>
        <div className="timetable-pdf-header-subtitle">CLASS TIMETABLE</div>
        <div className="timetable-pdf-header-meta">
          {selectedClass && (
            <div className="timetable-pdf-header-meta-item">
              <span className="timetable-pdf-header-meta-label">CLASS:</span>
              <span className="timetable-pdf-header-meta-value">{selectedClass}</span>
            </div>
          )}
          {weekInfo && (
            <div className="timetable-pdf-header-meta-item">
              <span className="timetable-pdf-header-meta-label">WEEK:</span>
              <span className="timetable-pdf-header-meta-value">{weekInfo}</span>
            </div>
          )}
          <div className="timetable-pdf-header-meta-item">
            <span className="timetable-pdf-header-meta-label">GENERATED:</span>
            <span className="timetable-pdf-header-meta-value">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetablePDFHeader;
