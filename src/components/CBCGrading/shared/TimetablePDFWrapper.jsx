/**
 * TimetablePDFWrapper Component
 * Wraps the timetable content with professional styling for PDF export
 * Includes header with logo, proper table alignment, and print optimization
 */

import React from 'react';
import TimetablePDFHeader from './TimetablePDFHeader';

const TimetablePDFWrapper = ({ 
  children, 
  schoolName = 'School Timetable', 
  selectedClass = '', 
  weekInfo = '',
  logoUrl = '/branding/logo.png',
  className = '' 
}) => {
  return (
    <div className={`timetable-pdf-wrapper ${className}`}>
      <style>{`
        .timetable-pdf-wrapper {
          background: white;
          width: 100%;
          page-break-after: avoid;
        }
        
        /* Hide header in normal view */
        .timetable-pdf-wrapper .print-only {
          display: none;
        }
        
        @media print {
          .timetable-pdf-wrapper .print-only {
            display: block;
          }
        }
        
        /* Table styling - compact weekly matrix */
        .timetable-pdf-wrapper table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0;
          background: white;
          box-sizing: border-box;
          border: 1px solid #e5e7eb;
          table-layout: fixed;
        }
        
        .timetable-pdf-wrapper thead {
          background: #ffffff;
        }
        
        .timetable-pdf-wrapper thead tr {
          border-bottom: 1px solid #e5e7eb;
        }
        
        .timetable-pdf-wrapper thead th {
          padding: 13px 12px;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: #111827;
          letter-spacing: 0;
          white-space: normal;
          word-wrap: break-word;
          border-right: 1px solid #e5e7eb;
          vertical-align: middle;
          text-transform: uppercase;
        }
        
        .timetable-pdf-wrapper thead th:last-child {
          border-right: none;
        }
        
        .timetable-pdf-wrapper thead th:first-child {
          width: 128px;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
        }
        
        .timetable-pdf-wrapper tbody tr {
          border-bottom: 1px solid #e5e7eb;
          page-break-inside: avoid;
        }
        
        .timetable-pdf-wrapper tbody tr:last-child {
          border-bottom: 1px solid #e5e7eb;
        }
        
        .timetable-pdf-wrapper tbody tr:hover {
          background-color: #f8fafc;
        }
        
        .timetable-pdf-wrapper tbody td {
          padding: 9px 10px;
          font-size: 11px;
          color: #17213d;
          vertical-align: middle;
          border-right: 1px solid #e5e7eb;
          height: 58px;
          text-align: left;
        }
        
        .timetable-pdf-wrapper tbody td:last-child {
          border-right: none;
        }
        
        .timetable-pdf-wrapper tbody td:first-child {
          background: #ffffff;
          width: 128px;
          color: #111827;
          border-right: 1px solid #e5e7eb;
          padding: 8px 10px;
          vertical-align: middle;
        }
        
        .timetable-pdf-wrapper .time-block-cell {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
          min-width: 108px;
        }

        .timetable-pdf-wrapper .time-block-icon {
          width: 14px;
          height: 14px;
          color: #7c89a6;
          flex: 0 0 auto;
          margin-top: 1px;
        }

        .timetable-pdf-wrapper .time-block-text {
          color: #111827;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.25;
          text-align: left;
          white-space: normal;
        }

        /* Lesson text styling - optimized for compact grid cells */
        .timetable-pdf-wrapper .lesson-card {
          background: none;
          color: #17213d;
          border-radius: 0;
          padding: 0;
          margin: 0;
          border: none;
          box-shadow: none;
          page-break-inside: avoid;
          display: block;
          width: 100%;
          text-align: left;
        }
        
        .timetable-pdf-wrapper .lesson-card-subject {
          font-weight: 800;
          font-size: 11px;
          margin-bottom: 6px;
          letter-spacing: 0;
          line-height: 1.2;
          color: #17213d;
        }
        
        .timetable-pdf-wrapper .lesson-card-details {
          font-size: 10px;
          opacity: 1;
          display: block;
          line-height: 1.25;
          margin-top: 2px;
          color: #56627d;
        }
        
        .timetable-pdf-wrapper .lesson-card-detail-item {
          display: inline;
          font-size: 10px;
          color: #56627d;
        }
        
        .timetable-pdf-wrapper .lesson-card-detail-item:not(:last-child)::after {
          content: " • ";
          margin: 0 6px;
          color: #17213d;
        }
        
        /* Empty slot styling */
        .timetable-pdf-wrapper .empty-slot {
          color: #cbd5e0;
          font-style: italic;
          text-align: center;
          font-size: 11px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 40px;
        }
        
        /* Screen view optimization */
        .timetable-pdf-wrapper thead th {
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .timetable-pdf-wrapper tbody td {
          background-color: white;
          transition: background-color 0.15s ease;
        }
        
        .timetable-pdf-wrapper tbody td:first-child {
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Print-specific optimizations */
        @media print {
          .timetable-pdf-wrapper {
            margin: 0;
            padding: 0;
            page-break-after: auto;
          }
          
          .timetable-pdf-wrapper table {
            width: 100%;
            font-size: 10px;
            border: 1px solid #e5e7eb !important;
          }
          
          .timetable-pdf-wrapper thead {
            background: #ffffff !important;
          }
          
          .timetable-pdf-wrapper thead th {
            padding: 12px 10px;
            font-size: 12px;
            color: #111827 !important;
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .timetable-pdf-wrapper thead th:first-child {
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
          }
          
          .timetable-pdf-wrapper tbody td {
            padding: 8px 9px;
            font-size: 10px;
            border: 1px solid #e5e7eb !important;
            height: 54px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .timetable-pdf-wrapper tbody td:first-child {
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .timetable-pdf-wrapper tbody tr {
            border-bottom: 1px solid #e5e7eb !important;
          }
          
          .timetable-pdf-wrapper .lesson-card {
            background: none !important;
            border: none !important;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .timetable-pdf-wrapper .lesson-card-subject {
            font-size: 10px;
            margin-bottom: 1px;
          }
          
          .timetable-pdf-wrapper .lesson-card-details {
            font-size: 8px;
            margin-top: 1px;
          }
        }
      `}</style>
      
      {/* Header with logo */}
      <TimetablePDFHeader 
        schoolName={schoolName}
        selectedClass={selectedClass}
        weekInfo={weekInfo}
        logoUrl={logoUrl}
      />
      
      {/* Timetable content */}
      {children}
    </div>
  );
};

export default TimetablePDFWrapper;
