/**
 * FileUploadEditor — Reusable File Upload Component
 * 
 * Shared across LMS module for consistent file upload UX
 * - Toggle between URL and file upload
 * - Support for PDF, Word, Excel, PowerPoint
 * - File size and name display
 * - Optional custom accept types
 * 
 * Usage:
 *   <FileUploadEditor 
 *     block={block} 
 *     onChange={handleChange}
 *     label="Resource"
 *     acceptTypes=".pdf,.doc,.docx"
 *   />
 */

import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

export default function FileUploadEditor({
  block,
  onChange,
  label = 'URL',
  acceptTypes = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
}) {
  const [isFile, setIsFile] = useState(!!block?.content?.fileName);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange({
        ...block,
        content: {
          ...block.content,
          url: file.name,
          fileName: file.name,
          fileSize: file.size,
          fileMime: file.type,
          uploadedAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleClearFile = () => {
    onChange({
      ...block,
      content: {
        ...block.content,
        url: '',
        fileName: '',
        fileSize: 0,
        fileMime: '',
        uploadedAt: null,
      },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileSize = block?.content?.fileSize
    ? `${(block.content.fileSize / 1024 / 1024).toFixed(2)} MB`
    : '';

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setIsFile(false)}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            !isFile
              ? 'border-[#ff7900] text-[#ff7900]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          URL
        </button>
        <button
          onClick={() => setIsFile(true)}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            isFile
              ? 'border-[#ff7900] text-[#ff7900]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📎 Upload File
        </button>
      </div>

      {/* URL Input */}
      {!isFile && (
        <input
          type="text"
          value={block?.content?.url || ''}
          onChange={(e) =>
            onChange({
              ...block,
              content: { ...block.content, url: e.target.value },
            })
          }
          placeholder={`Enter ${label} (URL)...`}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      )}

      {/* File Upload */}
      {isFile && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept={acceptTypes}
            className="hidden"
          />

          {!block?.content?.fileName ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-6 border-2 border-dashed border-[#ff7900] rounded-lg text-[#ff7900] hover:bg-[#ff7900]/5 transition font-medium text-sm flex flex-col items-center justify-center gap-2"
            >
              <Upload size={24} />
              <span>Choose File</span>
              <span className="text-xs text-[#ff7900]/70">
                PDF, Word, Excel, PowerPoint
              </span>
            </button>
          ) : (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-900">
                    ✓ File Ready
                  </p>
                  <p className="text-sm text-green-800 break-all">
                    {block.content.fileName}
                  </p>
                  {fileSize && (
                    <p className="text-xs text-green-700 mt-1">{fileSize}</p>
                  )}
                </div>
                <button
                  onClick={handleClearFile}
                  className="p-1 rounded hover:bg-green-200 text-green-600 transition flex-shrink-0"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-2 px-3 py-1 text-xs text-green-700 hover:text-green-900 hover:bg-green-100 rounded transition"
              >
                Change File
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
